import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { City, TransportType, TRANSPORT_TYPE_META, TransportTypeAvailability } from '../../../core/models/travel.models';
import { TunisiaCityMatchService } from '../tunisia-city-match.service';

interface TypeCard {
  type: TransportType;
  label: string;
  iconPath: string;
  available: boolean;
  reason?: string;
}

const VISIBLE_TYPES: TransportType[] = ['BUS', 'TAXI', 'CAR', 'PLANE'];

@Component({
  selector: 'app-transport-search-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="transport-home">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-glow"></div>
        <div class="hero-content">
          <h1 class="hero-title">Find your ride</h1>
          <p class="hero-sub">Compare and book buses, taxis, car rentals and flights across Tunisia</p>
        </div>
      </section>

      <!-- Search Bar -->
      <section class="search-section">
        <form [formGroup]="searchForm" class="search-bar">
          <!-- Departure -->
          <div class="sb-field sb-city">
            <span class="sb-icon"><i class="pi pi-map-marker"></i></span>
            <div class="sb-inner">
              <span class="sb-label">From</span>
              <p-dropdown
                formControlName="from"
                [options]="cities()"
                optionLabel="name"
                optionValue="id"
                [filter]="true"
                filterBy="name"
                placeholder="Departure city"
                [showClear]="false"
                appendTo="body"
                styleClass="sb-dropdown">
              </p-dropdown>
            </div>
          </div>

          <!-- Swap -->
          <button type="button" class="sb-swap" (click)="swapCities()" pRipple
                  pTooltip="Swap cities" tooltipPosition="top">
            <i class="pi pi-arrows-h"></i>
          </button>

          <!-- Arrival -->
          <div class="sb-field sb-city">
            <span class="sb-icon"><i class="pi pi-flag"></i></span>
            <div class="sb-inner">
              <span class="sb-label">To</span>
              <p-dropdown
                formControlName="to"
                [options]="cities()"
                optionLabel="name"
                optionValue="id"
                [filter]="true"
                filterBy="name"
                placeholder="Arrival city"
                [showClear]="false"
                appendTo="body"
                styleClass="sb-dropdown">
              </p-dropdown>
            </div>
          </div>

          <div class="sb-divider"></div>

          <!-- Date -->
          <div class="sb-field sb-date">
            <span class="sb-icon"><i class="pi pi-calendar"></i></span>
            <div class="sb-inner">
              <span class="sb-label">Date &amp; time</span>
              <p-calendar
                formControlName="date"
                dateFormat="dd/mm/yy"
                [minDate]="today"
                [showTime]="true"
                hourFormat="24"
                [showSeconds]="false"
                [stepMinute]="15"
                [showIcon]="true"
                placeholder="Departure date & time"
                appendTo="body"
                styleClass="sb-calendar">
              </p-calendar>
            </div>
          </div>

          <div class="sb-divider"></div>

          <!-- Passengers -->
          <div class="sb-field sb-pax">
            <span class="sb-icon"><i class="pi pi-users"></i></span>
            <div class="sb-inner">
              <span class="sb-label">Passengers</span>
              <p-inputNumber
                formControlName="passengers"
                [min]="1" [max]="20"
                [showButtons]="true"
                buttonLayout="horizontal"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                styleClass="sb-pax-input">
              </p-inputNumber>
            </div>
          </div>
        </form>
      </section>

      @if (hasBothCities()) {
        <section class="map-section">
          <app-transport-route-map
            [fromCity]="cityById(fromCityId())"
            [toCity]="cityById(toCityId())"
            (routeSummary)="onRouteSummary($event)" />
        </section>
      }

      <!-- Transport Types -->
      <section class="types-section">
        <h2 class="types-title">
          {{ hasBothCities() ? 'Choose how you want to travel' : 'Select cities to see available modes' }}
        </h2>

        <div class="types-grid">
          @for (card of typeCards(); track card.type) {
            <div class="tcard"
                 [class.tcard-active]="card.available"
                 [class.tcard-disabled]="!card.available && hasBothCities()"
                 [class.tcard-waiting]="!hasBothCities()"
                 [pTooltip]="card.reason ?? ''"
                 tooltipPosition="top"
                 (click)="onTypeClick(card)">

              <div class="tcard-icon"><img [src]="card.iconPath" [alt]="card.label" class="tcard-img" /></div>
              <span class="tcard-name">{{ card.label }}</span>

              @if (card.available) {
                <span class="tcard-badge tcard-ok">Available</span>
              } @else if (hasBothCities()) {
                <span class="tcard-badge tcard-no">Unavailable</span>
              }
            </div>
          }
        </div>
      </section>

      <!-- Popular Routes -->
      <section class="popular">
        <h3 class="popular-heading">Popular routes</h3>
        <div class="popular-list">
          @for (r of popularRoutes; track r.label) {
            <button class="pop-chip" pRipple (click)="quickSearch(r)">
              <img [src]="r.icon" [alt]="r.type" class="pop-icon-img" />
              {{ r.label }}
              <i class="pi pi-chevron-right pop-arrow"></i>
            </button>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .transport-home { min-height: 100vh; padding-bottom: 4rem; }

    /* ---- Hero ---- */
    .hero { position: relative; text-align: center; padding: 3rem 2rem 2.5rem; overflow: hidden; }
    .hero-glow {
      position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 60% 50% at 50% 0%, rgba(241,37,69,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 80% 20%, rgba(200,30,60,0.06) 0%, transparent 70%);
    }
    .hero-content { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; }
    .hero-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.6rem; font-weight: 800; margin: 0 0 0.6rem;
      background: linear-gradient(135deg, var(--text-color) 0%, rgba(241,37,69,0.85) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero-sub { font-size: 1.05rem; color: var(--text-muted, #a8b3c7); margin: 0; line-height: 1.6; }

    /* ---- Search Bar ---- */
    .search-section { padding: 0 1.5rem; margin-top: 0.5rem; position: relative; z-index: 5; }
    .map-section { max-width: 1060px; margin: 1rem auto 0; padding: 0 1.5rem; }
    .search-bar {
      max-width: 1060px; margin: 0 auto;
      display: flex; align-items: stretch;
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(241,37,69,0.08);
      transition: box-shadow 0.3s;
    }
    .search-bar:focus-within {
      box-shadow: 0 4px 32px rgba(241,37,69,0.12), 0 0 0 2px rgba(241,37,69,0.2);
    }

    .sb-field {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.85rem 1.1rem; flex: 1; min-width: 0;
      transition: background 0.2s;
    }
    .sb-field:hover { background: rgba(255,255,255,0.03); }
    .sb-city { flex: 1.4; }
    .sb-date { flex: 1; }
    .sb-pax { flex: 0.85; }

    .sb-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(241,37,69,0.1);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-icon i { font-size: 0.95rem; color: #f12545; }

    .sb-inner { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .sb-label {
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; color: var(--text-muted, #667085); margin-bottom: 1px;
    }

    .sb-divider { width: 1px; background: var(--glass-border, rgba(255,255,255,0.08)); margin: 0.6rem 0; flex-shrink: 0; }

    .sb-swap {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      background: var(--surface-3, #1f2d44); border: 1px solid var(--glass-border);
      color: var(--text-color); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      align-self: center; margin: 0 -0.3rem;
      transition: all 0.3s; z-index: 2;
    }
    .sb-swap:hover { background: #f12545; color: #fff; transform: rotate(180deg); }
    .sb-swap i { font-size: 0.8rem; }

    /* ---- PrimeNG overrides inside search bar ---- */
    :host ::ng-deep {
      .sb-dropdown, .sb-calendar, .sb-pax-input { width: 100%; }

      .sb-dropdown .p-dropdown {
        background: transparent !important; border: none !important;
        box-shadow: none !important; padding: 0;
      }
      .sb-dropdown .p-dropdown-label {
        padding: 0.25rem 0 !important; font-weight: 600;
        font-size: 0.95rem; color: var(--text-color) !important;
      }
      .sb-dropdown .p-dropdown-trigger { color: var(--text-muted) !important; }
      .sb-dropdown .p-dropdown-clear-icon { color: var(--text-muted) !important; }

      .sb-calendar .p-calendar { background: transparent !important; }
      .sb-calendar .p-inputtext {
        background: transparent !important; border: none !important;
        box-shadow: none !important; padding: 0.25rem 0 !important;
        font-weight: 600; font-size: 0.95rem; color: var(--text-color) !important;
      }
      .sb-calendar .p-datepicker-trigger {
        background: transparent !important; border: none !important;
        color: var(--text-muted) !important;
      }

      .p-datepicker-panel .p-timepicker,
      .p-datepicker-panel .p-datepicker-time-picker {
        border-top: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        padding-top: 0.5rem;
      }
      .p-datepicker-panel .p-timepicker span,
      .p-datepicker-panel .p-datepicker-time-picker button,
      .p-datepicker-panel .p-datepicker-time-picker span {
        color: var(--text-color, #e5e7eb);
      }

      .sb-pax-input .p-inputnumber { background: transparent !important; }
      .sb-pax-input .p-inputnumber-input {
        background: transparent !important; border: none !important;
        box-shadow: none !important; padding: 0.25rem 0 !important;
        font-weight: 700; font-size: 1rem; color: var(--text-color) !important;
        text-align: center; width: 3rem;
      }
      .sb-pax-input .p-inputnumber-button {
        background: rgba(241,37,69,0.12) !important; border: none !important;
        color: #f12545 !important; width: 28px; height: 28px;
      }
      .sb-pax-input .p-inputnumber-button:hover { background: #f12545 !important; color: #fff !important; }
    }

    /* ---- Transport Type Cards ---- */
    .types-section { max-width: 900px; margin: 2.5rem auto 0; padding: 0 1.5rem; }
    .types-title {
      text-align: center; font-size: 1.15rem; font-weight: 600;
      color: var(--text-muted); margin-bottom: 1.75rem;
    }
    .types-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
    }

    .tcard {
      display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
      padding: 2rem 1rem 1.5rem;
      background: var(--surface-1, #111827);
      border: 2px solid var(--glass-border, rgba(255,255,255,0.08));
      border-radius: 18px; cursor: pointer; position: relative;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tcard-icon {
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .tcard-img {
      width: 2.8rem; height: 2.8rem; object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));
    }
    .tcard-disabled .tcard-img, .tcard-waiting .tcard-img { opacity: 0.4; filter: grayscale(1); }
    .tcard-name { font-weight: 700; font-size: 0.95rem; color: var(--text-color); }
    .tcard-badge {
      font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.65rem;
      border-radius: 50px; letter-spacing: 0.2px;
    }
    .tcard-ok { background: rgba(241,37,69,0.12); color: #f12545; }
    .tcard-no { background: rgba(239,68,68,0.12); color: #f87171; }

    .tcard-waiting { opacity: 0.4; cursor: default; }

    .tcard-active {
      opacity: 1;
      background: linear-gradient(180deg, rgba(241,37,69,0.05) 0%, transparent 60%);
      border-color: rgba(241,37,69,0.2);
    }
    .tcard-active:hover {
      transform: translateY(-8px);
      border-color: #f12545;
      box-shadow: 0 16px 40px rgba(241,37,69,0.15);
    }
    .tcard-active:hover .tcard-icon { transform: scale(1.2) rotate(-5deg); }

    .tcard-disabled {
      opacity: 0.25; cursor: not-allowed;
      filter: grayscale(0.6);
    }

    /* ---- Popular ---- */
    .popular { max-width: 900px; margin: 3rem auto 0; padding: 0 1.5rem; }
    .popular-heading {
      text-align: center; font-size: 0.75rem; text-transform: uppercase;
      letter-spacing: 1.2px; color: var(--text-muted); opacity: 0.5;
      margin-bottom: 1rem;
    }
    .popular-list { display: flex; justify-content: center; gap: 0.65rem; flex-wrap: wrap; }
    .pop-chip {
      display: flex; align-items: center; gap: 0.45rem;
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border);
      padding: 0.55rem 1.15rem; border-radius: 50px;
      color: var(--text-color); cursor: pointer; font-size: 0.88rem;
      transition: all 0.25s;
    }
    .pop-chip:hover {
      border-color: rgba(241,37,69,0.3); background: rgba(241,37,69,0.05);
      transform: translateY(-2px);
    }
    .pop-icon-img { width: 1.2rem; height: 1.2rem; object-fit: contain; }
    .pop-arrow { font-size: 0.6rem; opacity: 0.3; transition: all 0.2s; margin-left: 0.2rem; }
    .pop-chip:hover .pop-arrow { opacity: 1; transform: translateX(3px); }

    /* ---- Responsive ---- */
    @media (max-width: 768px) {
      .hero-title { font-size: 2rem; }
      .search-bar { flex-direction: column; border-radius: 20px; }
      .sb-divider { width: 100%; height: 1px; margin: 0; }
      .sb-swap { align-self: center; margin: -0.6rem 0; }
      .types-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class TransportSearchPageComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private store = inject(TripContextStore);
  private dataSource = inject(DATA_SOURCE_TOKEN);
  private cdr = inject(ChangeDetectorRef);
  private alerts = inject(AppAlertsService);
  private cityMatch = inject(TunisiaCityMatchService);
  private subs = new Subscription();

  cities = signal<City[]>([]);
  today = new Date();

  fromCityId = signal<number | null>(null);
  toCityId = signal<number | null>(null);

  searchForm = this.fb.group({
    from: [null as number | null, Validators.required],
    to: [null as number | null, Validators.required],
    date: [null as Date | null, Validators.required],
    passengers: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
  });

  hasBothCities = computed(() => !!this.fromCityId() && !!this.toCityId());

  typeCards = computed<TypeCard[]>(() => {
    const fromId = this.fromCityId();
    const toId = this.toCityId();
    const fromCity = this.cities().find(c => c.id === fromId);
    const toCity = this.cities().find(c => c.id === toId);

    return VISIBLE_TYPES.map(type => {
      const meta = TRANSPORT_TYPE_META[type];
      let available = true;
      let reason: string | undefined;

      if (fromCity && toCity) {
        if (meta.requiresFrom && !fromCity.stations?.[meta.requiresFrom]) {
          available = false;
          reason = `No ${this.infraLabel(meta.requiresFrom)} in ${fromCity.name}`;
        }
        if (available && meta.requiresTo && !toCity.stations?.[meta.requiresTo]) {
          available = false;
          reason = `No ${this.infraLabel(meta.requiresTo)} in ${toCity.name}`;
        }
      } else {
        available = false;
      }

      return {
        type,
        label: meta.label,
        iconPath: this.iconFor(type),
        available,
        reason,
      };
    });
  });

  popularRoutes = [
    { fromId: 1, toId: 3, type: 'BUS',   label: 'Tunis → Sousse',     icon: '/icones/bus.png' },
    { fromId: 1, toId: 8, type: 'PLANE', label: 'Tunis → Djerba',     icon: '/icones/plane.png' },
    { fromId: 3, toId: 5, type: 'TAXI',  label: 'Sousse → Hammamet',  icon: '/icones/taxi.png' },
    { fromId: 1, toId: 4, type: 'CAR',   label: 'Tunis → Sfax',       icon: '/icones/car.png' },
  ];

  ngOnInit() {
    const qp = this.route.snapshot.queryParams;

    this.dataSource.getCities().subscribe(data => {
      this.cities.set(data);

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void this.cityMatch
              .reverseGeocodeThenNearestCity(pos.coords.latitude, pos.coords.longitude, data)
              .then((match) => {
                if (!match || qp['from']) {
                  return;
                }
                this.searchForm.patchValue({ from: match.id });
                this.fromCityId.set(match.id);
                this.cdr.markForCheck();
              });
          },
          () => {
            /* denied */
          },
          { maximumAge: 120_000, timeout: 15_000, enableHighAccuracy: false }
        );
      }

      if (qp['from']) {
        const fromId = Number(qp['from']);
        this.searchForm.patchValue({ from: fromId });
        this.fromCityId.set(fromId);
      } else {
        const current = data.find(c => c.id === this.store.selectedCityId());
        if (current) {
          this.searchForm.patchValue({ from: current.id });
          this.fromCityId.set(current.id);
        }
      }

      if (qp['to']) {
        const toId = Number(qp['to']);
        this.searchForm.patchValue({ to: toId });
        this.toCityId.set(toId);
      }
    });

    if (qp['date']) {
      this.searchForm.patchValue({ date: new Date(qp['date']) });
    } else if (this.store.dates().travelDate) {
      this.searchForm.patchValue({ date: new Date(this.store.dates().travelDate!) });
    }

    const pax = qp['passengers'] ? Number(qp['passengers']) : this.store.pax().adults;
    this.searchForm.patchValue({ passengers: pax });

    this.subs.add(
      this.searchForm.get('from')!.valueChanges.subscribe(v => {
        this.fromCityId.set(v);
        this.cdr.markForCheck();
      })
    );
    this.subs.add(
      this.searchForm.get('to')!.valueChanges.subscribe(v => {
        this.toCityId.set(v);
        this.cdr.markForCheck();
      })
    );

  }

  cityById(id: number | null): City | null {
    if (id == null) {
      return null;
    }
    return this.cities().find((c) => c.id === id) ?? null;
  }

  onRouteSummary(ev: { distanceKm: number; durationSeconds: number }): void {
    this.store.setTransportRouteMetrics(ev.distanceKm, ev.durationSeconds);
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  onTypeClick(card: TypeCard) {
    if (!card.available) return;
    if (!this.validateSearchBusinessRules()) {
      return;
    }
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      void this.alerts.warning('Check your search', 'Please fill in all required fields correctly.');
      return;
    }

    const v = this.searchForm.value;
    const dateStr = v.date ? this.travelDateTimeLocalIso(v.date) : '';
    this.store.setDates({ travelDate: dateStr });
    this.store.setPax({ adults: v.passengers ?? 1, children: 0 });

    this.router.navigate(['/transport/results'], {
      queryParams: { from: v.from, to: v.to, date: dateStr, transportType: card.type, passengers: v.passengers }
    });
  }

  swapCities() {
    const f = this.searchForm.get('from')!.value;
    const t = this.searchForm.get('to')!.value;
    this.searchForm.patchValue({ from: t, to: f });
  }

  quickSearch(route: { fromId: number; toId: number; type: string }) {
    if (route.fromId === route.toId) {
      void this.alerts.warning('Invalid route', 'Departure and destination must be different.');
      return;
    }
    this.searchForm.patchValue({ from: route.fromId, to: route.toId });
    const dateVal = this.searchForm.get('date')?.value ?? new Date();
    if (!this.isDateNotInPast(dateVal)) {
      void this.alerts.warning('Invalid date', 'Departure date and time cannot be in the past.');
      return;
    }
    const dateStr = this.travelDateTimeLocalIso(dateVal);
    this.store.setDates({ travelDate: dateStr });
    this.store.setPax({ adults: this.searchForm.get('passengers')?.value ?? 1, children: 0 });
    this.router.navigate(['/transport/results'], {
      queryParams: { from: route.fromId, to: route.toId, date: dateStr, transportType: route.type, passengers: this.searchForm.get('passengers')?.value ?? 1 }
    });
  }

  private iconFor(type: TransportType): string {
    const map: Record<string, string> = {
      BUS: '/icones/bus.png',
      TAXI: '/icones/taxi.png',
      CAR: '/icones/car.png',
      PLANE: '/icones/plane.png',
    };
    return map[type] ?? '';
  }

  /** Local `YYYY-MM-DDTHH:mm:ss` for store, URL, and booking (Twilio-friendly). */
  private travelDateTimeLocalIso(date: Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}:${s}`;
  }

  private infraLabel(key: string): string {
    const map: Record<string, string> = {
      bus: 'bus station',
      airport: 'airport',
      ferry: 'ferry port',
      train: 'train station',
    };
    return map[key] ?? key;
  }

  /** Business rules before navigating to results. */
  private validateSearchBusinessRules(): boolean {
    const v = this.searchForm.getRawValue();
    if (v.from == null || v.to == null || !v.date) {
      this.searchForm.markAllAsTouched();
      void this.alerts.warning('Incomplete search', 'Please select departure city, arrival city, and departure date & time.');
      return false;
    }
    if (v.from === v.to) {
      void this.alerts.warning('Invalid route', 'Departure and destination must be different cities.');
      return false;
    }
    if (!this.isDateNotInPast(v.date)) {
      void this.alerts.warning('Invalid date', 'Departure date and time cannot be in the past.');
      return false;
    }
    const p = v.passengers ?? 1;
    if (p < 1 || p > 20) {
      void this.alerts.warning('Passengers', 'Number of passengers must be between 1 and 20.');
      return false;
    }
    return true;
  }

  private isDateNotInPast(d: Date): boolean {
    const now = Date.now();
    const slackMs = 60_000;
    return d.getTime() >= now - slackMs;
  }
}
