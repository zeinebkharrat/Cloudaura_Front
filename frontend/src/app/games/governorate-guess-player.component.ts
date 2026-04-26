import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as echarts from 'echarts';
import { tunisiaGeoJson } from '../tunisia-map';
import { GOVERNORATE_LABEL_EN, GOVERNORATE_LABEL_FR } from '../tunisia-governorate-labels';
import { AuthService } from '../core/auth.service';
import { LudificationService } from '../core/ludification.service';

const TUNISIA_MAP_NAME_PROP = '_echartsRegionId';
const ECHARTS_MAP_NAME = 'TunisiaGovernorateGuess';

function tunisiaGeoWithUniqueRegionIds(geo: any) {
  return {
    ...geo,
    features: geo.features.map((f: any, i: number) => ({
      ...f,
      properties: {
        ...f.properties,
        [TUNISIA_MAP_NAME_PROP]: `${f.properties?.gouv_id ?? 'region'}_${i}`,
      },
    })),
  };
}

function getTunisiaMapGeoForGuess() {
  return tunisiaGeoWithUniqueRegionIds(tunisiaGeoJson);
}

function buildRegionIdToLabel(mapGeo: any): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of mapGeo.features) {
    const regionId = f.properties[TUNISIA_MAP_NAME_PROP] as string;
    const gid = f.properties?.gouv_id as string | undefined;
    const rawFr = f.properties?.gouv_fr as string | undefined;
    const label =
      (gid ? GOVERNORATE_LABEL_EN[gid] : undefined) ??
      (gid ? GOVERNORATE_LABEL_FR[gid] : undefined) ??
      rawFr ??
      regionId;
    m.set(regionId, label);
  }
  return m;
}

function extractFeatureCenter(geometry: any): [number, number] | null {
  const points: [number, number][] = [];
  const walk = (node: any): void => {
    if (!Array.isArray(node)) {
      return;
    }
    if (
      node.length >= 2 &&
      typeof node[0] === 'number' &&
      typeof node[1] === 'number'
    ) {
      points.push([node[0], node[1]]);
      return;
    }
    for (const child of node) {
      walk(child);
    }
  };
  walk(geometry?.coordinates);
  if (!points.length) {
    return null;
  }
  const sum = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0]
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function buildCentroidsByRegionId(mapGeo: any): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  for (const f of mapGeo.features) {
    const id = f.properties[TUNISIA_MAP_NAME_PROP] as string | undefined;
    const c = extractFeatureCenter(f.geometry);
    if (id && c) {
      m.set(id, c);
    }
  }
  return m;
}

function maxPairwiseHaversineKm(centroids: Map<string, [number, number]>): number {
  const ids = [...centroids.keys()];
  let max = 1;
  for (let i = 0; i < ids.length; i++) {
    const a = centroids.get(ids[i])!;
    for (let j = i + 1; j < ids.length; j++) {
      const b = centroids.get(ids[j])!;
      max = Math.max(max, haversineKm(a, b));
    }
  }
  return max;
}

function heatFillColor(closeness: number): string {
  const t = Math.max(0, Math.min(1, closeness));
  const L = 88 - t * 62;
  const S = 38 + t * 23;
  return `hsl(198, ${S}%, ${L}%)`;
}

function winFillColor(): string {
  return 'hsl(145, 55%, 42%)';
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Chaque forme normalisee -> ids region (plusieurs si homonymes dans les donnees). */
function buildAliasToRegionIds(
  mapGeo: any,
  regionIdToLabel: Map<string, string>
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (norm: string, rid: string) => {
    if (!norm) {
      return;
    }
    const arr = m.get(norm) ?? [];
    if (!arr.includes(rid)) {
      arr.push(rid);
    }
    m.set(norm, arr);
  };

  for (const f of mapGeo.features) {
    const rid = f.properties[TUNISIA_MAP_NAME_PROP] as string;
    const gid = f.properties?.gouv_id as string | undefined;
    const labels = new Set<string>();
    
    // We strictly use GOVERNORATE_LABEL (FR/EN) and the GID (e.g. TN22) as the source of truth.
    // We ignore f.properties.gouv_fr/ar because they are often incorrect or mismatched in our GeoJSON.
    if (gid) {
      add(normalizeToken(gid), rid);
      if (GOVERNORATE_LABEL_FR[gid]) {
        labels.add(GOVERNORATE_LABEL_FR[gid]);
      }
      if (GOVERNORATE_LABEL_EN[gid]) {
        labels.add(GOVERNORATE_LABEL_EN[gid]);
      }
    }
    
    for (const lb of labels) {
      add(normalizeToken(lb), rid);
      // Also allow "Kef" for "Le Kef"
      const stripped = lb.replace(/^le\s+/i, '').trim();
      if (stripped !== lb) {
        add(normalizeToken(stripped), rid);
      }
    }
  }
  return m;
}

@Component({
  selector: 'app-governorate-guess-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="gg-page">
      <header class="gg-head">
        <a routerLink="/games" class="gg-back">Retour aux jeux</a>
        <h1>Devine le gouvernorat</h1>
        <p class="gg-sub">
          Un gouvernorat secret est tire au sort. Saisissez son nom ci-dessous : la carte se colore
          (<strong>sombre</strong> = proche, <strong>clair</strong> = loin). La carte est seulement
          indicative — pas de clic.
        </p>
      </header>

      <form class="gg-form" (submit)="$event.preventDefault(); submitGuess()">
        <label class="gg-label" for="gg-guess-input">Votre proposition</label>
        <div class="gg-form-row">
          <input
            id="gg-guess-input"
            type="text"
            name="guess"
            class="gg-input"
            autocomplete="off"
            [disabled]="won() || !!chartError()"
            [(ngModel)]="guessText"
            placeholder="Ex. Sfax, Tunis, Le Kef..."
          />
          <button type="submit" class="gg-submit" [disabled]="won() || !!chartError()">
            Valider
          </button>
        </div>
        @if (inputError()) {
          <p class="gg-input-error" role="status">{{ inputError() }}</p>
        }
      </form>

      <div class="gg-status">
        <span>Tentatives : <strong>{{ attempts() }}</strong></span>
        @if (lastGuessLabel()) {
          <span>Derniere proposition : <strong>{{ lastGuessLabel() }}</strong></span>
        }
        @if (lastDistanceKm() != null) {
          <span
            >Distance au secret : <strong>~{{ lastDistanceKm() }} km</strong> (a vol d'oiseau)</span
          >
        }
        @if (won()) {
          @if (!pointsClaimed()) {
            <button type="button" class="gg-btn" style="background: linear-gradient(135deg, #10b981, #059669); border-color: #34d399;" (click)="claimPoints()">Réclamer mes points</button>
          } @else {
            <button type="button" class="gg-btn" style="opacity: 0.7;" disabled>Points réclamés !</button>
          }
        }
        <button type="button" class="gg-btn" (click)="newRound()">Nouvelle partie</button>
      </div>

      <p class="gg-hint" [class.gg-hint--win]="won()">{{ hint() }}</p>

      @if (chartError()) {
        <p class="gg-chart-error" role="alert">{{ chartError() }}</p>
      }

      <div class="gg-map-wrap">
        <div
          #mapHost
          class="gg-map-host"
          role="img"
          aria-label="Carte des gouvernorats tunisiens, jeu chaud-froid"
        ></div>
      </div>
    </div>
  `,
  styles: [
    `
      .gg-page {
        min-height: 100vh;
        padding: 2rem 1.25rem 2rem;
        box-sizing: border-box;
        background: radial-gradient(ellipse 120% 80% at 50% 0%, #1e3a5f 0%, #0f172a 50%, #020617 100%);
        color: #e2e8f0;
      }

      .gg-head {
        max-width: 52rem;
        margin: 0 auto 1.5rem;
        color: #cbd5e1;
        font-size: 0.95rem;
      }

      .gg-back {
        display: inline-block;
        margin-bottom: 0.75rem;
        color: #7dd3fc;
        text-decoration: none;
        font-size: 0.9rem;
      }

      .gg-back:hover {
        text-decoration: underline;
      }

      .gg-head h1 {
        margin: 0 0 0.5rem;
        font-size: 1.6rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #f1f5f9;
      }

      .gg-sub {
        margin: 0;
        line-height: 1.55;
        font-size: 0.95rem;
      }

      .gg-sub strong {
        color: #fde68a;
      }

      .gg-status {
        max-width: 52rem;
        margin: 0 auto 1rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem 1.25rem;
        font-size: 0.9rem;
        color: #94a3b8;
      }

      .gg-status strong {
        color: #e2e8f0;
      }

      .gg-form {
        max-width: 52rem;
        margin: 0 auto 1.25rem;
      }

      .gg-label {
        display: block;
        font-size: 0.85rem;
        color: #94a3b8;
        margin-bottom: 0.4rem;
      }

      .gg-form-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        align-items: stretch;
      }

      .gg-input {
        flex: 1 1 14rem;
        min-width: 12rem;
        padding: 0.55rem 0.85rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.85);
        color: #f1f5f9;
        font-size: 1rem;
      }

      .gg-input::placeholder {
        color: #64748b;
      }

      .gg-input:focus {
        outline: none;
        border-color: rgba(125, 211, 252, 0.55);
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
      }

      .gg-input:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .gg-submit {
        padding: 0.55rem 1.25rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(125, 211, 252, 0.45);
        background: linear-gradient(180deg, rgba(56, 99, 148, 0.9), rgba(30, 58, 95, 0.95));
        color: #f0f9ff;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: filter 0.15s, border-color 0.15s;
      }

      .gg-submit:hover:not(:disabled) {
        filter: brightness(1.08);
      }

      .gg-submit:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .gg-input-error {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: #fca5a5;
      }

      .gg-btn {
        margin-left: auto;
        padding: 0.45rem 1rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(125, 211, 252, 0.35);
        background: rgba(30, 58, 95, 0.6);
        color: #e0f2fe;
        font-size: 0.875rem;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }

      .gg-btn:hover {
        background: rgba(56, 99, 148, 0.75);
        border-color: rgba(125, 211, 252, 0.55);
      }

      .gg-hint {
        max-width: 52rem;
        margin: 0 auto 1rem;
        padding: 0.65rem 1rem;
        border-radius: 0.5rem;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(71, 85, 105, 0.5);
        font-size: 0.95rem;
        color: #cbd5e1;
      }

      .gg-hint--win {
        border-color: rgba(52, 211, 153, 0.45);
        background: rgba(6, 78, 59, 0.35);
        color: #a7f3d0;
      }

      .gg-chart-error {
        max-width: 52rem;
        margin: 0 auto 1rem;
        padding: 0.65rem 1rem;
        border-radius: 0.5rem;
        background: rgba(127, 29, 29, 0.35);
        border: 1px solid rgba(248, 113, 113, 0.45);
        color: #fecaca;
        font-size: 0.9rem;
      }

      .gg-map-wrap {
        max-width: min(960px, 100%);
        margin: 0 auto;
        border-radius: 0.75rem;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 0.5),
          0 20px 50px rgba(0, 0, 0, 0.45);
      }

      .gg-map-host {
        width: 100%;
        height: 72vh;
        max-height: 560px;
        min-height: 360px;
        background: #0b1220;
      }
    `,
  ],
})
export class GovernorateGuessPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapHost', { static: false }) mapHost!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private readonly auth = inject(AuthService);
  private readonly api = inject(LudificationService);

  readonly attempts = signal(0);
  readonly pointsClaimed = signal(false);
  readonly lastGuessLabel = signal<string | null>(null);
  readonly lastDistanceKm = signal<number | null>(null);
  readonly won = signal(false);
  readonly hint = signal('Saisissez un gouvernorat puis Valider.');
  readonly chartError = signal<string | null>(null);
  readonly inputError = signal<string | null>(null);

  /** Lie au champ texte (ngModel). */
  guessText = '';

  private chart?: echarts.ECharts;
  private mapGeo: any;
  private regionIds: string[] = [];
  private regionIdToLabel = new Map<string, string>();
  private aliasToRegionIds = new Map<string, string[]>();
  private centroids = new Map<string, [number, number]>();
  private maxDistKm = 1;
  private secretId: string | null = null;
  private heat = new Map<string, number>();
  private resizeObserver?: ResizeObserver;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      queueMicrotask(() => this.zone.run(() => this.initChart()));
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.chart?.dispose();
    this.chart = undefined;
  }

  newRound(): void {
    this.attempts.set(0);
    this.lastGuessLabel.set(null);
    this.lastDistanceKm.set(null);
    this.won.set(false);
    this.pointsClaimed.set(false);
    this.heat.clear();
    this.chartError.set(null);
    this.inputError.set(null);
    this.guessText = '';
    this.pickSecret();
    this.hint.set('Nouvelle partie. Saisissez un gouvernorat.');
    this.applyChartOption();
  }

  private initChart(): void {
    try {
      const el = this.mapHost?.nativeElement;
      if (!el) {
        this.chartError.set('Conteneur carte introuvable.');
        return;
      }

      this.mapGeo = getTunisiaMapGeoForGuess();
      this.regionIdToLabel = buildRegionIdToLabel(this.mapGeo);
      this.aliasToRegionIds = buildAliasToRegionIds(this.mapGeo, this.regionIdToLabel);
      this.centroids = buildCentroidsByRegionId(this.mapGeo);
      this.maxDistKm = Math.max(1, maxPairwiseHaversineKm(this.centroids));
      this.regionIds = [...this.centroids.keys()];

      echarts.registerMap(ECHARTS_MAP_NAME, this.mapGeo);
      this.chart = echarts.init(el);

      this.resizeObserver = new ResizeObserver(() => this.scheduleChartResize());
      this.resizeObserver.observe(el);
      this.scheduleChartResize();

      this.newRound();
    } catch (e) {
      console.error(e);
      this.chartError.set("Impossible d'afficher la carte.");
    }
  }

  private scheduleChartResize(): void {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.chart?.resize();
    }, 120);
  }

  private pickSecret(): void {
    if (!this.regionIds.length) {
      return;
    }
    const i = Math.floor(Math.random() * this.regionIds.length);
    this.secretId = this.regionIds[i];
  }

  submitGuess(): void {
    this.inputError.set(null);
    const secret = this.secretId;
    if (this.won() || !secret || this.chartError()) {
      return;
    }
    const resolved = this.resolveRegionFromText(this.guessText);
    if ('error' in resolved) {
      this.inputError.set(resolved.error);
      return;
    }
    this.applyGuessForRegions(resolved.ids, secret);
  }

  private resolveRegionFromText(raw: string): { ids: string[] } | { error: string } {
    const q = normalizeToken(raw);
    if (!q) {
      return { error: 'Entrez un nom de gouvernorat.' };
    }

    const exact = this.aliasToRegionIds.get(q);
    if (exact && exact.length > 0) {
      // If we find an exact match for a label, we take all IDs associated with it (e.g. multi-part polygons)
      return { ids: exact };
    }

    if (q.length >= 3) {
      const partial = new Set<string>();
      for (const rid of this.regionIds) {
        const disp = normalizeToken(this.regionIdToLabel.get(rid) ?? '');
        if (disp.includes(q)) {
          partial.add(rid);
        }
      }
      const uniq = [...partial];
      if (uniq.length > 0) {
        // If they are all parts of the same governorate name, it's fine.
        // If they are different governorates, might still be fuzzy.
        return { ids: uniq };
      }
    }

    return { error: 'Gouvernorat non reconnu. Verifiez l orthographe.' };
  }

  private applyGuessForRegions(regionIds: string[], secret: string): void {
    if (this.won() || !secret || !regionIds.length) {
      return;
    }

    let isMatch = false;
    let minDistance = Infinity;
    let bestRegionId = regionIds[0];

    for (const rid of regionIds) {
      if (rid === secret) {
        isMatch = true;
      }
      const d = haversineKm(this.centroids.get(rid)!, this.centroids.get(secret)!);
      if (d < minDistance) {
        minDistance = d;
        bestRegionId = rid;
      }
    }

    if (isMatch) {
      this.won.set(true);
      for (const rid of regionIds) {
        this.heat.set(rid, 1);
      }
      this.hint.set("Bravo ! C'est le bon gouvernorat.");
      this.lastGuessLabel.set(this.regionIdToLabel.get(secret) ?? 'Gouvernorat');
      this.lastDistanceKm.set(0);
      this.applyChartOption();
      return;
    }

    const closeness = 1 - Math.min(1, minDistance / this.maxDistKm);

    for (const rid of regionIds) {
      const prev = this.heat.get(rid);
      if (prev == null || closeness > prev) {
        this.heat.set(rid, closeness);
      }
    }

    this.attempts.update((a) => a + 1);
    this.lastGuessLabel.set(this.regionIdToLabel.get(bestRegionId) ?? bestRegionId);
    this.lastDistanceKm.set(Math.round(minDistance));
    this.hint.set('Encore un effort... (~' + Math.round(minDistance) + ' km du secret)');
    this.applyChartOption();
  }

  private applyChartOption(): void {
    if (!this.chart) {
      return;
    }

    const data = [...this.centroids.keys()].map((id) => {
      const cl = this.heat.get(id);
      const itemStyle =
        cl != null
          ? {
              areaColor:
                id === this.secretId && this.won() ? winFillColor() : heatFillColor(cl),
            }
          : { areaColor: 'rgba(15, 30, 45, 0.35)' };
      return {
        name: id,
        value: 0,
        itemStyle,
      };
    });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const raw = p as { name?: string };
          const id = raw?.name ?? '';
          const label = this.regionIdToLabel.get(id) ?? id;
          const cl = this.heat.get(id);
          if (cl == null) {
            return `${label}`;
          }
          if (this.won() && id === this.secretId) {
            return `${label} — trouvé !`;
          }
          return `${label} — indice : ${Math.round(cl * 100)} %`;
        },
      },
      series: [
        {
          type: 'map',
          map: ECHARTS_MAP_NAME,
          nameProperty: TUNISIA_MAP_NAME_PROP,
          silent: true,
          roam: true,
          zoom: 1.15,
          aspectScale: 0.9,
          emphasis: { disabled: true },
          label: { show: false },
          itemStyle: {
            borderColor: 'rgba(148, 163, 184, 0.45)',
            borderWidth: 1,
          },
          data,
        },
      ],
    };

    this.chart.setOption(option, { notMerge: true });
  }

  claimPoints(): void {
    if (this.pointsClaimed() || !this.auth.currentUser()) return;
    this.pointsClaimed.set(true);
    this.api.reportStandaloneGame({
      gameKind: 'GOVERNORATE_GUESS',
      gameId: 1, 
      score: Math.max(10 - this.attempts(), 1) * 10, // give score based on attempts
      maxScore: 100
    }).subscribe();
  }
}
