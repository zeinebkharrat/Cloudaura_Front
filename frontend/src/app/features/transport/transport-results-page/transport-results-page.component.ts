import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { RippleModule } from 'primeng/ripple';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { Transport, City } from '../../../core/models/travel.models';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-transport-results-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rp">
      <!-- Header -->
      <header class="rp-header">
        <div class="rp-route">
          <span class="rp-city">{{ departureCityName() }}</span>
          <div class="rp-arrow">
            <span class="rp-line"></span>
            <span class="rp-emoji">{{ getTypeEmoji(queryParams.transportType) }}</span>
            <span class="rp-line"></span>
          </div>
          <span class="rp-city">{{ arrivalCityName() }}</span>
        </div>

        <div class="rp-badges">
          <span class="rp-badge"><i class="pi pi-calendar"></i> {{ formatSearchDateTime(queryParams.date) }}</span>
          <span class="rp-badge"><i class="pi pi-users"></i> {{ 'TRANSPORT_RESULTS.BADGE_PASSENGERS' | translate: { n: queryParams.passengers } }}</span>
          <span class="rp-badge rp-badge-accent">{{ getTypeEmoji(queryParams.transportType) }} {{ transportTypeLabelKey(queryParams.transportType) | translate }}</span>
        </div>

        <button class="rp-back" pRipple (click)="goBack()">
          <i class="pi pi-arrow-left"></i>
          <span>{{ 'TRANSPORT_RESULTS.BACK_EDIT' | translate }}</span>
        </button>
      </header>

      <!-- Results -->
      <section class="rp-body">
        @if (isEstimateOnlyMode()) {
          <p class="rp-estimate-strip" role="status">
            <i class="pi pi-info-circle"></i>
            <span>{{ 'TRANSPORT_RESULTS.ESTIMATE_ONLY_STRIP' | translate }}</span>
          </p>
        }
        @if (loading()) {
          <!-- Skeleton Loaders -->
          <div class="rp-list">
            @for (i of [1,2,3]; track i) {
              <div class="sk-card">
                <div class="sk-left">
                  <p-skeleton width="5rem" height="2rem" borderRadius="8px"></p-skeleton>
                  <p-skeleton width="8rem" height="1rem" borderRadius="6px"></p-skeleton>
                </div>
                <div class="sk-mid">
                  <p-skeleton width="100%" height="4px" borderRadius="2px"></p-skeleton>
                </div>
                <div class="sk-right">
                  <p-skeleton width="5rem" height="2rem" borderRadius="8px"></p-skeleton>
                  <p-skeleton width="8rem" height="1rem" borderRadius="6px"></p-skeleton>
                </div>
              </div>
            }
          </div>
        } @else if (sortedResults().length === 0) {
          <!-- Empty State -->
          <div class="rp-empty">
            <div class="rp-empty-icon">{{ getTypeEmoji(queryParams.transportType) }}</div>
            <h3>{{ 'TRANSPORT_RESULTS.EMPTY_TITLE' | translate }}</h3>
            <p><span>{{ 'TRANSPORT_RESULTS.EMPTY_PART1' | translate }}</span><strong>{{ transportTypeLabelKey(queryParams.transportType) | translate }}</strong><span>{{ 'TRANSPORT_RESULTS.EMPTY_PART2' | translate }}</span></p>
            <p class="rp-empty-hint">{{ 'TRANSPORT_RESULTS.EMPTY_HINT' | translate }}</p>
          </div>
        } @else {
          <!-- Results Count -->
          <p class="rp-count">{{ 'TRANSPORT_RESULTS.COUNT' | translate: { n: sortedResults().length } }}</p>

          <!-- Result Cards -->
          <div class="rp-list">
            @for (t of sortedResults(); track t.id) {
              <div class="tc" pRipple (click)="onSelect(t)">
                <!-- Top row: type badge + seats warning -->
                <div class="tc-top">
                  <p-tag [value]="('TRANSPORT.TYPE.' + (t.type || 'BUS')) | translate" [severity]="getTypeSeverity(t.type)"></p-tag>
                  @if (t.availableSeats !== undefined && t.availableSeats < 5) {
                    <span class="tc-warn"><i class="pi pi-exclamation-triangle"></i> {{ 'TRANSPORT_RESULTS.SEATS_LEFT' | translate: { n: t.availableSeats } }}</span>
                  }
                </div>

                <!-- Schedule row -->
                <div class="tc-schedule">
                  <div class="tc-point">
                    <span class="tc-time">{{ formatTime(t.departureTime) }}</span>
                    <span class="tc-city">{{ t.departureCityName }}</span>
                  </div>

                  <div class="tc-track">
                    <div class="tc-dot"></div>
                    <div class="tc-bar">
                      @if (t.durationMinutes) {
                        <span class="tc-dur">{{ formatDuration(t.durationMinutes) }}</span>
                      }
                    </div>
                    <div class="tc-dot"></div>
                  </div>

                  <div class="tc-point tc-end">
                    <span class="tc-time">{{ formatTime(t.arrivalTime) }}</span>
                    <span class="tc-city">{{ t.arrivalCityName }}</span>
                  </div>
                </div>

                <!-- Info + CTA row -->
                <div class="tc-bottom">
                  <div class="tc-details">
                    <span class="tc-seats"><i class="pi pi-users"></i> {{ 'TRANSPORT_RESULTS.SEATS' | translate: { n: (t.availableSeats ?? t.capacity) } }}</span>
                  </div>

                  <div class="tc-action" [class.tc-action--estimate-only]="isEstimateOnlyMode()">
                    @if (!isEstimateOnlyMode()) {
                      <div class="tc-price">
                        <span class="tc-amount">{{ displayPrice(t) }}</span>
                        <span class="tc-currency">TND</span>
                      </div>
                    }
                    <button pButton
                            [label]="(isEstimateOnlyMode() ? 'TRANSPORT_RESULTS.BTN_ESTIMATE' : 'TRANSPORT_RESULTS.BTN_BOOK') | translate"
                            [icon]="isEstimateOnlyMode() ? 'pi pi-calculator' : 'pi pi-arrow-right'"
                            iconPos="right" class="p-button-sm p-button-raised"></button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .rp { min-height: 100vh; padding-bottom: 4rem; }

    /* ---- Header ---- */
    .rp-header {
      text-align: center; padding: 2.5rem 2rem 2rem;
      background: linear-gradient(180deg, rgba(241,37,69,0.06) 0%, transparent 100%);
    }
    .rp-back {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: var(--surface-1, #111827); border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
      color: var(--text-color); padding: 0.6rem 1.3rem; border-radius: 50px;
      cursor: pointer; font-size: 0.88rem; font-weight: 500;
      transition: all 0.25s; margin-top: 1.5rem;
    }
    .rp-back:hover { border-color: #f12545; color: #f12545; background: rgba(241,37,69,0.06); }

    .rp-route {
      display: flex; align-items: center; justify-content: center;
      gap: 1.5rem; margin-bottom: 1.25rem;
    }
    .rp-city {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem; font-weight: 800; color: var(--text-color);
    }
    .rp-arrow { display: flex; align-items: center; gap: 0.6rem; }
    .rp-line { width: 48px; height: 2px; background: #f12545; opacity: 0.35; border-radius: 2px; }
    .rp-emoji { font-size: 1.6rem; }

    .rp-badges { display: flex; justify-content: center; gap: 0.6rem; flex-wrap: wrap; }
    .rp-badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--surface-1, #111827); border: 1px solid var(--glass-border);
      padding: 0.4rem 1rem; border-radius: 50px; font-size: 0.82rem;
      color: var(--text-color); opacity: 0.75;
    }
    .rp-badge-accent {
      background: rgba(241,37,69,0.1); border-color: rgba(241,37,69,0.3);
      opacity: 1; font-weight: 600; color: #f12545;
    }

    /* ---- Body ---- */
    .rp-body { max-width: 820px; margin: 0 auto; padding: 0 1.5rem; }
    .rp-estimate-strip {
      display: flex; align-items: flex-start; gap: 0.5rem;
      margin: 0 0 1.25rem; padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.86rem; line-height: 1.45; color: var(--text-color);
      background: color-mix(in srgb, #0ea5e9 10%, var(--surface-1));
      border: 1px solid color-mix(in srgb, #0ea5e9 28%, var(--glass-border));
    }
    .rp-estimate-strip .pi { color: #0ea5e9; flex-shrink: 0; margin-top: 2px; }
    .rp-count {
      font-size: 0.85rem; color: var(--text-muted, #a8b3c7);
      margin-bottom: 1.25rem; text-align: center;
    }

    /* ---- Card List ---- */
    .rp-list { display: flex; flex-direction: column; gap: 1rem; }

    .tc {
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
      border-radius: 20px; padding: 1.75rem 2rem;
      cursor: pointer; transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tc:hover {
      border-color: rgba(241,37,69,0.3);
      transform: translateY(-4px);
      box-shadow: 0 16px 48px rgba(241,37,69,0.08), 0 0 0 1px rgba(241,37,69,0.12);
    }

    /* Top */
    .tc-top {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem;
    }
    .tc-warn {
      font-size: 0.78rem; color: #fb923c; font-weight: 600;
      display: flex; align-items: center; gap: 5px;
    }

    /* Schedule */
    .tc-schedule {
      display: flex; align-items: center; gap: 1.25rem;
      margin-bottom: 1.5rem; padding: 0 0.25rem;
    }
    .tc-point { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .tc-end { text-align: right; }
    .tc-time {
      font-family: 'Outfit', sans-serif;
      font-size: 1.75rem; font-weight: 800; color: var(--text-color);
      line-height: 1.1; letter-spacing: -0.02em;
    }
    .tc-city { font-size: 0.82rem; color: var(--text-muted, #a8b3c7); }

    .tc-track {
      flex: 1; display: flex; align-items: center; gap: 0;
      min-width: 100px;
    }
    .tc-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #f12545; flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(241,37,69,0.15);
    }
    .tc-bar {
      flex: 1; height: 2px; background: rgba(241,37,69,0.15);
      position: relative; margin: 0 -1px;
    }
    .tc-dur {
      position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
      font-size: 0.75rem; font-weight: 600; color: #f12545;
      white-space: nowrap; background: var(--surface-1, #111827);
      padding: 0 0.5rem;
    }

    /* Bottom */
    .tc-bottom {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 1.25rem;
      border-top: 1px solid var(--glass-border, rgba(255,255,255,0.06));
    }
    .tc-details {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    }
    .tc-seats {
      display: flex; align-items: center; gap: 0.35rem;
      font-size: 0.82rem; color: var(--text-muted, #a8b3c7);
    }

    .tc-action { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
    .tc-action--estimate-only { justify-content: flex-end; }
    .tc-price { display: flex; align-items: baseline; gap: 4px; }
    .tc-amount {
      font-family: 'Outfit', sans-serif;
      font-size: 1.8rem; font-weight: 800; color: #f12545;
      line-height: 1;
    }
    .tc-currency { font-size: 0.8rem; font-weight: 500; color: var(--text-muted, #a8b3c7); }

    /* ---- Empty State ---- */
    .rp-empty {
      text-align: center; padding: 5rem 2rem;
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
    }
    .rp-empty-icon { font-size: 4rem; margin-bottom: 1.5rem; }
    .rp-empty h3 { font-size: 1.5rem; margin: 0 0 0.5rem; color: var(--text-color); }
    .rp-empty p { color: var(--text-muted, #a8b3c7); margin-bottom: 1rem; }
    .rp-empty-hint { font-size: 0.85rem; opacity: 0.5; }

    /* ---- Skeleton ---- */
    .sk-card {
      display: flex; align-items: center; gap: 1.5rem;
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border);
      border-radius: 20px; padding: 2rem;
    }
    .sk-left, .sk-right { display: flex; flex-direction: column; gap: 0.5rem; }
    .sk-mid { flex: 1; }

    /* ---- Responsive ---- */
    @media (max-width: 640px) {
      .rp-city { font-size: 1.5rem; }
      .rp-route { gap: 0.75rem; }
      .tc { padding: 1.25rem; border-radius: 16px; }
      .tc-schedule { flex-direction: column; gap: 1rem; }
      .tc-track { width: 100%; min-width: 0; }
      .tc-end { text-align: left; }
      .tc-time { font-size: 1.4rem; }
      .tc-bottom { flex-direction: column; gap: 1rem; align-items: flex-start; }
      .tc-action { width: 100%; justify-content: space-between; }
      .tc-action.tc-action--estimate-only { justify-content: flex-end; }
    }

    :host ::ng-deep .p-tag { font-size: 0.78rem; padding: 0.3rem 0.75rem; }
  `]
})
export class TransportResultsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(TripContextStore);
  private dataSource = inject(DATA_SOURCE_TOKEN);
  private alerts = inject(AppAlertsService);
  private translate = inject(TranslateService);

  loading = signal(true);
  allResults = signal<Transport[]>([]);
  cities = signal<City[]>([]);
  queryParams: any = {};

  sortedResults = computed(() => {
    return [...this.allResults()].sort((a, b) => this.displayPrice(a) - this.displayPrice(b));
  });

  departureCityName = computed(() => {
    const id = parseInt(this.queryParams.from);
    return this.cities().find(c => c.id === id)?.name ?? 'From';
  });

  arrivalCityName = computed(() => {
    const id = parseInt(this.queryParams.to);
    return this.cities().find(c => c.id === id)?.name ?? 'To';
  });

  ngOnInit() {
    this.dataSource.getCities().subscribe(data => this.cities.set(data));
    this.route.queryParams.subscribe(params => {
      this.queryParams = params;
      if (params['date']) {
        this.store.setDates({ travelDate: params['date'] });
      }
      this.loadResults();
    });
  }

  loadResults() {
    this.loading.set(true);
    this.dataSource.getTransports({
      from: this.queryParams.from,
      to: this.queryParams.to,
      date: this.queryParams.date,
      transportType: this.queryParams.transportType,
      passengers: this.queryParams.passengers ? parseInt(this.queryParams.passengers) : 1
    }).subscribe({
      next: data => {
        this.allResults.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        void this.alerts.error(
          this.translate.instant('TRANSPORT_RESULTS.ALERT_LOAD_TITLE'),
          this.translate.instant('TRANSPORT_RESULTS.ALERT_LOAD_BODY'),
        );
      },
    });
  }

  isEstimateOnlyMode(): boolean {
    const t = (this.queryParams.transportType ?? '').toString().toUpperCase();
    return t === 'TAXI' || t === 'BUS';
  }

  onSelect(transport: Transport) {
    if (transport.type === 'TAXI' || transport.type === 'BUS') {
      void this.router.navigate(['/transport/estimate'], {
        queryParams: {
          from: this.queryParams.from,
          to: this.queryParams.to,
          date: this.queryParams.date,
          transportType: this.queryParams.transportType ?? transport.type,
          passengers: this.queryParams.passengers ?? '1',
        },
      });
      return;
    }
    this.store.selectedTransport.set({
      ...transport,
      price: this.displayUnitPrice(transport),
    });
    this.router.navigate(['/transport', transport.id, 'book'], {
      queryParams: this.queryParams
    });
  }

  goBack() {
    this.router.navigate(['/transport'], {
      queryParams: {
        from: this.queryParams.from,
        to: this.queryParams.to,
        date: this.queryParams.date,
        passengers: this.queryParams.passengers
      }
    });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatSearchDateTime(raw: string | undefined): string {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return raw;
    }
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
  }

  transportTypeLabelKey(raw: string | undefined): string {
    const u = (raw ?? 'BUS').toString().toUpperCase();
    return `TRANSPORT.TYPE.${u}`;
  }

  getTypeEmoji(type: string): string {
    const map: Record<string, string> = {
      BUS: '\uD83D\uDE8C', VAN: '\uD83D\uDE90', TAXI: '\uD83D\uDE95',
      CAR: '\uD83D\uDE97', PLANE: '\u2708\uFE0F', TRAIN: '\uD83D\uDE86', FERRY: '\u26F4\uFE0F'
    };
    return map[type] ?? '';
  }

  getTypeSeverity(type: string): 'success' | 'warn' | 'danger' | undefined {
    const map: Record<string, 'success' | 'warn' | 'danger'> = {
      BUS: 'success',
      VAN: 'warn',
      TAXI: 'warn',
      PLANE: 'danger',
      CAR: 'success',
    };
    return map[type];
  }

  private passengerCount(): number {
    const seats = Number.parseInt(this.queryParams.passengers, 10);
    return Number.isFinite(seats) && seats > 0 ? seats : 1;
  }

  private routeKm(): number {
    return this.store.transportRouteKm() ?? 0;
  }

  private routeDurationMin(fallbackDurationMin: number): number {
    const fromStore = this.store.transportRouteDurationMin();
    if (fromStore != null && fromStore > 0) {
      return fromStore;
    }
    if (fallbackDurationMin > 0) {
      return fallbackDurationMin;
    }
    const km = this.routeKm();
    if (km <= 0) {
      return 0;
    }
    return Math.round((km / 60) * 60);
  }

  private isNightTravel(): boolean {
    const travelDate = this.store.dates().travelDate;
    if (!travelDate) {
      return false;
    }
    const d = new Date(travelDate);
    if (Number.isNaN(d.getTime())) {
      return false;
    }
    const h = d.getHours();
    return h >= 22 || h < 6;
  }

  private displayUnitPrice(t: Transport): number {
    const seats = this.passengerCount();
    if (t.type === 'TAXI') {
      return this.displayPrice(t);
    }
    if (t.type === 'CAR') {
      const days = Math.max(1, this.store.transportRentalDays() ?? 1);
      return Math.round((this.displayPrice(t) / days) * 100) / 100;
    }
    return Math.round((this.displayPrice(t) / seats) * 100) / 100;
  }

  displayPrice(t: Transport): number {
    const seats = this.passengerCount();
    const km = this.routeKm();
    const durationMin = this.routeDurationMin(t.durationMinutes ?? 0);

    if (t.type === 'TAXI') {
      let fare = 2 + km * 0.30 + durationMin * 0.05;
      if (this.isNightTravel()) {
        fare *= 1.1;
      }
      return Math.round(Math.max(3.5, fare) * 100) / 100;
    }

    if (t.type === 'BUS') {
      const perSeat = Math.max(1.5, 1.2 + km * 0.028 + durationMin * 0.0065);
      return Math.round(perSeat * seats * 100) / 100;
    }

    if (t.type === 'CAR') {
      const days = Math.max(1, this.store.transportRentalDays() ?? 1);
      const daily = Math.max(35, (t.price || 52) * 0.5);
      const extraKm = Math.max(0, km - days * 160);
      return Math.round((daily * days + extraKm * 0.07) * 100) / 100;
    }

    return Math.round(seats * t.price * 100) / 100;
  }
}
