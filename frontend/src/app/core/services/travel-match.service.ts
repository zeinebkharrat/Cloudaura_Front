import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CityMatchScore,
  RecommendationProfile,
  TravelPreferencePayload,
  TravelRecommendationApiResponse,
  TravelRecommendationModelJson,
} from '../travel-match.types';

@Injectable({ providedIn: 'root' })
export class TravelMatchService {
  private readonly http = inject(HttpClient);
  private model$?: Observable<TravelRecommendationModelJson>;

  private loadModel(): Observable<TravelRecommendationModelJson> {
    if (!this.model$) {
      this.model$ = this.http
        .get<TravelRecommendationModelJson>('/assets/travel-match-model.json')
        .pipe(shareReplay(1));
    }
    return this.model$;
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private normalizeStyle(style: unknown): string {
    const raw = this.normalize(style);
    if (!raw) {
      return '';
    }
    const parts = raw
      .split('|')
      .map((x) => this.normalize(x))
      .filter(Boolean);
    return [...new Set(parts)].sort().join('|');
  }

  private resolveBudgetRange(prefs: TravelPreferencePayload): { min: number; max: number } {
    const directMin = Number(prefs.budget_min ?? prefs.budgetMin);
    const directMax = Number(prefs.budget_max ?? prefs.budgetMax);
    if (Number.isFinite(directMin) && Number.isFinite(directMax)) {
      return directMin <= directMax
        ? { min: directMin, max: directMax }
        : { min: directMax, max: directMin };
    }

    const avg = Number(prefs.budget_avg ?? 180);
    const approxMin = Number.isFinite(directMin) ? directMin : avg * 0.7;
    const approxMax = Number.isFinite(directMax) ? directMax : avg * 1.3;
    return approxMin <= approxMax
      ? { min: approxMin, max: approxMax }
      : { min: approxMax, max: approxMin };
  }

  private encodePreferenceFeatures(prefs: TravelPreferencePayload) {
    const styles = Array.isArray(prefs.travel_styles)
      ? prefs.travel_styles.map((s) => this.normalize(s)).filter(Boolean)
      : [];
    const style = styles.length
      ? this.normalizeStyle(styles.join('|'))
      : this.normalizeStyle(prefs.travel_style ?? '');
    const budget = this.resolveBudgetRange(prefs);

    return {
      accommodation_type: this.normalize(prefs.accommodation_type),
      preferred_cuisine: this.normalize(prefs.preferred_cuisine),
      preferred_region: this.normalize(prefs.preferred_region),
      transport_preference: this.normalize(prefs.transport_preference),
      travel_style: style,
      travel_with: this.normalize(prefs.travel_with),
      budget_min: budget.min,
      budget_max: budget.max,
    };
  }

  private scoreProfile(
    pref: ReturnType<TravelMatchService['encodePreferenceFeatures']>,
    profile: RecommendationProfile
  ): number {
    const f = profile.features;
    const sameAccommodation = pref.accommodation_type === this.normalize(f.accommodation_type) ? 1 : 0;
    const sameCuisine = pref.preferred_cuisine === this.normalize(f.preferred_cuisine) ? 1 : 0;
    const sameRegion = pref.preferred_region === this.normalize(f.preferred_region) ? 1 : 0;
    const sameTransport = pref.transport_preference === this.normalize(f.transport_preference) ? 1 : 0;
    const sameTravelWith = pref.travel_with === this.normalize(f.travel_with) ? 1 : 0;
    const profileStyle = this.normalizeStyle(f.travel_style);
    const prefStyles = new Set(pref.travel_style.split('|').filter(Boolean));
    const profileStyles = new Set(profileStyle.split('|').filter(Boolean));
    let sameStyle = 0;
    if (pref.travel_style && profileStyle) {
      const overlap = [...prefStyles].filter((token) => profileStyles.has(token)).length;
      const denom = Math.max(prefStyles.size, profileStyles.size, 1);
      sameStyle = overlap / denom;
    }

    const pMid = (pref.budget_min + pref.budget_max) / 2;
    const rMid = (Number(f.budget_min) + Number(f.budget_max)) / 2;
    const dist = Math.abs(pMid - rMid);
    const budgetScore = Math.max(0, 1 - dist / 300);

    return (
      sameRegion * 0.22 +
      sameStyle * 0.2 +
      sameTravelWith * 0.13 +
      sameCuisine * 0.12 +
      sameAccommodation * 0.12 +
      sameTransport * 0.09 +
      budgetScore * 0.12
    );
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
      cityName: c.recommended_city_name || c.cityName,
      score01: c.score01,
      percent: 0,
      cityId: c.recommended_city_id,
      recommendedRegion: c.recommended_region,
      recommendedActivities: c.recommended_activities,
      recommendedEvent: c.recommended_event,
    }));

    const displayGamma = 0.34;
    let boosted = rows.map((r) => Math.pow(Math.max(r.score01, 1e-15), displayGamma));
    const sumB = boosted.reduce((s, v) => s + v, 0) || 1;
    boosted = boosted.map((v) => v / sumB);
    const ranked = rows.map((r, i) => ({ ...r, score01: boosted[i], percent: 0 }));
    this.applyCalibratedMatchPercents(ranked);
    return ranked;
  }

  private rankFromStaticModel(prefs: TravelPreferencePayload, topN: number): Observable<CityMatchScore[]> {
    return this.loadModel().pipe(
      map((model) => {
        const pref = this.encodePreferenceFeatures(prefs);
        const byCity = new Map<string, CityMatchScore & { totalScore: number; supportCount: number }>();

        for (const p of model.profiles) {
          const cityName = p.labels.recommended_city_name;
          const current = byCity.get(cityName);
          const score = this.scoreProfile(pref, p);

          if (!current) {
            byCity.set(cityName, {
              cityName,
              score01: score,
              percent: 0,
              totalScore: score,
              supportCount: 1,
              cityId: p.labels.recommended_city_id,
              recommendedRegion: p.labels.recommended_region,
              recommendedActivities: p.labels.recommended_activities,
              recommendedEvent: p.labels.recommended_event,
            });
          } else {
            current.score01 = Math.max(current.score01, score);
            current.totalScore += score;
            current.supportCount += 1;
          }
        }

        const rows = [...byCity.values()]
          .map((row) => {
            const averageScore = row.totalScore / Math.max(1, row.supportCount);
            const support = Math.min(1, row.supportCount / 5);
            return {
              ...row,
              score01: row.score01 * 0.68 + averageScore * 0.22 + support * 0.1,
            };
          })
          .sort((a, b) => b.score01 - a.score01)
          .slice(0, topN);

        const sum = rows.reduce((acc, x) => acc + x.score01, 0) || 1;
        for (const r of rows) {
          r.score01 = r.score01 / sum;
        }

        this.applyCalibratedMatchPercents(rows);
        return rows;
      })
    );
  }

  rankCities(prefs: TravelPreferencePayload, topN = 8, temperature = 0.26): Observable<CityMatchScore[]> {
    void temperature;
    const baseUrl = environment.travelRecommendationApiUrl?.trim();
    if (baseUrl) {
      return this.http
        .post<TravelRecommendationApiResponse>(`${baseUrl}/api/recommend`, {
          ...prefs,
          topN,
        })
        .pipe(
          map((res) => this.mapApiToRanked(res, topN)),
          catchError(() => this.rankFromStaticModel(prefs, topN))
        );
    }
    return this.rankFromStaticModel(prefs, topN);
  }
}
