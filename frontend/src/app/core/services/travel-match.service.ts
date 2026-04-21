import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CityMatchScore,
  TravelMatchModelJson,
  TravelPreferencePayload,
  TravelRecommendationApiResponse,
} from '../travel-match.types';

@Injectable({ providedIn: 'root' })
export class TravelMatchService {
  private readonly http = inject(HttpClient);
  private model$?: Observable<TravelMatchModelJson>;

  private loadModel(): Observable<TravelMatchModelJson> {
    if (!this.model$) {
      this.model$ = this.http
        .get<TravelMatchModelJson>('/assets/travel-match-model.json')
        .pipe(shareReplay(1));
    }
    return this.model$;
  }

  /** Encode user prefs to the same vector space as training (column order must match Python). */
  encodePreferences(model: TravelMatchModelJson, prefs: TravelPreferencePayload): number[] {
    const row: number[] = [];
    const raw = prefs as unknown as Record<string, unknown>;
    for (const col of model.categoricalColumns) {
      const allowed = model.categories[col];
      if (col === 'travel_style') {
        const arr = Array.isArray(raw['travel_styles'])
          ? (raw['travel_styles'] as unknown[])
          : raw['travel_style']
            ? [raw['travel_style']]
            : [];
        const selected = new Set(
          arr.map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean)
        );
        for (const opt of allowed) {
          row.push(selected.has(String(opt).trim().toLowerCase()) ? 1 : 0);
        }
        continue;
      }
      const v = String(raw[col] ?? '').trim().toLowerCase();
      for (const opt of allowed) {
        row.push(opt.toLowerCase() === v ? 1 : 0);
      }
    }
    for (let i = 0; i < model.numericColumns.length; i++) {
      const name = model.numericColumns[i];
      const rawNum = Number((prefs as unknown as Record<string, unknown>)[name]);
      const z = (rawNum - model.numericMean[i]) / (model.numericScale[i] || 1);
      row.push(Number.isFinite(z) ? z : 0);
    }
    return row;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d < 1e-12 ? 0 : dot / d;
  }

  private softmax(logits: number[], temperature: number): number[] {
    const t = Math.max(0.08, temperature);
    const scaled = logits.map((x) => x / t);
    const max = Math.max(...scaled);
    const exps = scaled.map((x) => Math.exp(x - max));
    const sum = exps.reduce((s, v) => s + v, 0);
    return exps.map((v) => v / sum);
  }

  /**
   * Turn raw weights into human-facing %: best match reads as a strong fit (typically &gt;90%),
   * while preserving rank order from the model.
   */
  private applyCalibratedMatchPercents(rows: CityMatchScore[]): void {
    if (!rows.length) {
      return;
    }
    const w = rows.map((r) => Math.max(r.score01, 1e-15));
    const sum = w.reduce((a, b) => a + b, 0);
    const rel = w.map((x) => x / sum);
    const k = rows.length;
    const uniform = 1 / k;

    const separation = k > 1 ? Math.min(1, (rel[0] - rel[1]) / Math.max(rel[0], 1e-9)) : 1;
    const vsUniform = Math.max(0, (rel[0] - uniform) / Math.max(uniform, 1e-9));
    let top = 91 + Math.min(8, 4 * separation + 2.5 * vsUniform + rel[0] * k * 0.55);
    top = Math.min(99, Math.max(92, top));
    rows[0].percent = Math.round(top * 10) / 10;

    for (let i = 1; i < rows.length; i++) {
      const ratio = rel[i] / rel[0];
      const floor = Math.max(34, rows[0].percent - 22 - i * 5);
      const blended =
        rows[0].percent * (0.42 * ratio + 0.28 * (1 / (i + 1))) + ratio * 6 - i * 4;
      rows[i].percent = Math.round(Math.max(floor, Math.min(rows[0].percent - 4, blended)) * 10) / 10;
    }
  }

  private mapApiToRanked(res: TravelRecommendationApiResponse, topN: number): CityMatchScore[] {
    const rows: CityMatchScore[] = (res.cities ?? []).slice(0, topN).map((c) => ({
      cityName: c.cityName,
      score01: c.score01,
      percent: 0,
    }));
    /** Same “decisive” gamma as centroid path for comparable UI. */
    const displayGamma = 0.34;
    let boosted = rows.map((r) => Math.pow(Math.max(r.score01, 1e-15), displayGamma));
    const sumB = boosted.reduce((s, v) => s + v, 0) || 1;
    boosted = boosted.map((v) => v / sumB);
    const ranked = rows.map((r, i) => ({
      cityName: r.cityName,
      score01: boosted[i],
      percent: 0,
    }));
    this.applyCalibratedMatchPercents(ranked);
    return ranked;
  }

  private rankCentroidFromStaticModel(
    prefs: TravelPreferencePayload,
    topN: number,
    temperature: number
  ): Observable<CityMatchScore[]> {
    return this.loadModel().pipe(
      map((model) => {
        const u = this.encodePreferences(model, prefs);
        const logits: number[] = [];
        for (const city of model.cities) {
          const c = model.centroids[city];
          if (!c || c.length !== u.length) {
            logits.push(-1e9);
            continue;
          }
          const sim = this.cosineSimilarity(u, c);
          const prior = model.cityPriors[city] ?? 1 / model.cities.length;
          const blended = sim * (0.28 + 0.72 * Math.sqrt(prior));
          logits.push(blended);
        }
        const probs = this.softmax(logits, temperature);
        const displayGamma = 0.34;
        let ranked = model.cities
          .map((cityName, i) => ({
            cityName,
            score01: probs[i],
            percent: 0,
          }))
          .sort((a, b) => b.score01 - a.score01)
          .slice(0, topN);
        const boosted = ranked.map((r) => Math.pow(Math.max(r.score01, 1e-15), displayGamma));
        const sumB = boosted.reduce((s, v) => s + v, 0) || 1;
        ranked = ranked.map((r, i) => {
          const p = boosted[i] / sumB;
          return {
            cityName: r.cityName,
            score01: p,
            percent: 0,
          };
        });
        this.applyCalibratedMatchPercents(ranked);
        return ranked;
      })
    );
  }

  /**
   * Ranks governorates using the Flask microservice when `environment.travelRecommendationApiUrl`
   * is set; otherwise uses static `travel-match-model.json` centroid ranking.
   */
  rankCities(prefs: TravelPreferencePayload, topN = 8, temperature = 0.26): Observable<CityMatchScore[]> {
    const baseUrl = environment.travelRecommendationApiUrl?.trim();
    if (baseUrl) {
      return this.http
        .post<TravelRecommendationApiResponse>(`${baseUrl}/api/recommend`, {
          ...prefs,
          topN,
        })
        .pipe(
          map((res) => this.mapApiToRanked(res, topN)),
          catchError(() => this.rankCentroidFromStaticModel(prefs, topN, temperature))
        );
    }
    return this.rankCentroidFromStaticModel(prefs, topN, temperature);
  }
}
