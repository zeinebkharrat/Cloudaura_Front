import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subscription } from 'rxjs';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { AmadeusCarOffer, City, Transport } from '../../../core/models/travel.models';
import { GovernorateCityPickerComponent } from '../../../shared/components/governorate-city-picker/governorate-city-picker.component';
import { TripContextStore } from '../../../core/stores/trip-context.store';

@Component({
  selector: 'app-car-rental-amadeus-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    ButtonModule,
    RippleModule,
    ProgressSpinnerModule,
    GovernorateCityPickerComponent,
  ],
  templateUrl: './car-rental-amadeus-page.component.html',
  styleUrl: './car-rental-amadeus-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarRentalAmadeusPageComponent implements OnInit, OnDestroy {
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
  private readonly translate = inject(TranslateService);
  private readonly alerts = inject(AppAlertsService);
  private readonly currency = inject(CurrencyService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripStore = inject(TripContextStore);
  private readonly renderer = inject(Renderer2);

  /** Re-render when currency changes */
  readonly currencyDisplay = this.currency.selectedCode;

  private qpSub: Subscription | null = null;

  /** True once we skipped or started geolocation for this page visit (no URL city override). */
  private locationAutoTried = false;

  readonly valueProps: ReadonlyArray<{ icon: string; titleKey: string; descKey: string }> = [
    { icon: 'pi-shield', titleKey: 'CAR_AMADEUS.VALUE_SECURE_TITLE', descKey: 'CAR_AMADEUS.VALUE_SECURE_DESC' },
    { icon: 'pi-bolt', titleKey: 'CAR_AMADEUS.VALUE_LIVE_TITLE', descKey: 'CAR_AMADEUS.VALUE_LIVE_DESC' },
    { icon: 'pi-car', titleKey: 'CAR_AMADEUS.VALUE_FLEET_TITLE', descKey: 'CAR_AMADEUS.VALUE_FLEET_DESC' },
    { icon: 'pi-headphones', titleKey: 'CAR_AMADEUS.VALUE_SUPPORT_TITLE', descKey: 'CAR_AMADEUS.VALUE_SUPPORT_DESC' },
  ];

  /** Quick filters: canonical governorate / tourism names (backend aliases resolve variants). */
  readonly popularCities: ReadonlyArray<{ name: string; labelKey: string }> = [
    { name: 'Tunis', labelKey: 'CAR_AMADEUS.PICK_TUNIS' },
    { name: 'Sousse', labelKey: 'CAR_AMADEUS.PICK_SOUSSE' },
    { name: 'Sfax', labelKey: 'CAR_AMADEUS.PICK_SFAX' },
    { name: 'Djerba', labelKey: 'CAR_AMADEUS.PICK_DJERBA' },
    { name: 'Monastir', labelKey: 'CAR_AMADEUS.PICK_MONASTIR' },
    { name: 'Hammamet', labelKey: 'CAR_AMADEUS.PICK_HAMMAMET' },
  ];

  /** Fallback city name for API `location` when no governorate id (chips + default). */
  location = 'Tunis';
  startDate = '';
  endDate = '';

  /** 24 governorates from `/api/cities` for direct fleet search by `cityId`. */
  governorates = signal<City[]>([]);

  /** Explicit city (0 = none); takes precedence over deep-link `pickedCityId`. */
  governoratePickerId = signal(0);

  pickedCityId = signal<number | null>(null);
  cityHintFromTransport = signal<string | null>(null);

  loading = signal(false);
  searched = signal(false);
  errorMsg = signal<string | null>(null);
  offers = signal<AmadeusCarOffer[]>([]);

  ngOnInit(): void {
    this.ensureDocumentTheme();

    const t = new Date();
    const d0 = t.toISOString().slice(0, 10);
    const t1 = new Date(t);
    t1.setDate(t1.getDate() + 3);
    const d1 = t1.toISOString().slice(0, 10);
    this.startDate = d0;
    this.endDate = d1;

    this.dataSource.getCities().subscribe((rows) => {
      const sorted = [...rows].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
      this.governorates.set(sorted);
      this.cdr.markForCheck();
      this.tryApplyLocationFromDevice(this.route.snapshot.queryParamMap);
    });

    this.qpSub = this.route.queryParamMap.subscribe((pm) => {
      const cidStr = pm.get('cityId');
      if (cidStr && /^\d+$/.test(cidStr.trim())) {
        const cid = parseInt(cidStr.trim(), 10);
        this.pickedCityId.set(cid);
        this.governoratePickerId.set(cid);
      } else {
        this.pickedCityId.set(null);
        this.governoratePickerId.set(0);
      }
      const cityHint = pm.get('city');
      this.cityHintFromTransport.set(cityHint && cityHint.trim() ? cityHint.trim() : null);

      const loc = pm.get('location');
      const cityName = cityHint && cityHint.trim() ? cityHint.trim() : '';
      if (loc && loc.trim()) {
        const tloc = loc.trim();
        if (/^[A-Za-z]{3}$/.test(tloc) && cityName) {
          this.location = cityName;
        } else if (!/^[A-Za-z]{3}$/.test(tloc)) {
          this.location = tloc;
        }
      } else if (cityName) {
        this.location = cityName;
      }
      const s = pm.get('start');
      const e = pm.get('end');
      if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        this.startDate = s;
      }
      if (e && /^\d{4}-\d{2}-\d{2}$/.test(e)) {
        this.endDate = e;
      }
      this.cdr.markForCheck();
      queueMicrotask(() => this.runSearch());
      this.tryApplyLocationFromDevice(pm);
    });
  }

  ngOnDestroy(): void {
    this.qpSub?.unsubscribe();
    this.qpSub = null;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  /** Aligns `html[data-theme]` with app shell / localStorage (no duplicate theme toggle on this page). */
  /**
   * When the user opens the page without a city in the URL, asks for the device position
   * and maps it to a Tunisian governorate from `/api/cities` (reverse geocode via OSM Nominatim).
   */
  private tryApplyLocationFromDevice(query: ParamMap): void {
    if (this.locationAutoTried) {
      return;
    }
    const cityIdParam = query.get('cityId');
    if (cityIdParam && /^\d+$/.test(cityIdParam.trim())) {
      this.locationAutoTried = true;
      return;
    }
    if (query.get('city')?.trim()) {
      this.locationAutoTried = true;
      return;
    }
    const loc = query.get('location')?.trim() ?? '';
    if (loc && !/^[A-Za-z]{3}$/.test(loc)) {
      this.locationAutoTried = true;
      return;
    }
    if (loc && /^[A-Za-z]{3}$/.test(loc)) {
      this.locationAutoTried = true;
      return;
    }

    const cities = this.governorates();
    if (cities.length === 0) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationAutoTried = true;
      return;
    }

    this.locationAutoTried = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void this.applyCityFromCoordinates(pos.coords.latitude, pos.coords.longitude, cities);
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 600_000 },
    );
  }

  private async applyCityFromCoordinates(lat: number, lon: number, cities: City[]): Promise<void> {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('accept-language', 'fr,en,ar');

      const ctrl = new AbortController();
      const tid = window.setTimeout(() => ctrl.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
      } finally {
        window.clearTimeout(tid);
      }
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { address?: Record<string, string> };
      const addr = data.address;
      if (!addr) {
        return;
      }
      const cc = (addr['country_code'] || '').toLowerCase();
      if (cc !== 'tn') {
        return;
      }
      const hit = this.matchGovernorateFromAddress(addr, cities);
      if (!hit) {
        return;
      }
      if (this.governoratePickerId() !== 0) {
        return;
      }
      this.governoratePickerId.set(hit.id);
      this.pickedCityId.set(null);
      this.cityHintFromTransport.set(null);
      this.location = hit.name;
      this.cdr.markForCheck();
      queueMicrotask(() => this.runSearch());
    } catch {
      /* network / abort */
    }
  }

  private matchGovernorateFromAddress(addr: Record<string, string>, cities: City[]): City | null {
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const parts: string[] = [];
    for (const v of Object.values(addr)) {
      if (typeof v === 'string' && v.trim()) {
        parts.push(norm(v));
      }
    }
    if (!parts.length) {
      return null;
    }

    const sorted = [...cities].sort((a, b) => b.name.length - a.name.length);
    for (const city of sorted) {
      const cn = norm(city.name);
      if (cn.length < 2) {
        continue;
      }
      for (const p of parts) {
        if (p === cn || p.includes(cn) || cn.includes(p)) {
          return city;
        }
      }
    }
    return null;
  }

  private ensureDocumentTheme(): void {
    const saved = localStorage.getItem('theme');
    const attr = document.documentElement.getAttribute('data-theme');
    const mode: 'light' | 'dark' =
      saved === 'light' || saved === 'dark'
        ? saved
        : attr === 'light' || attr === 'dark'
          ? attr
          : 'dark';
    this.renderer.setAttribute(document.documentElement, 'data-theme', mode);
  }

  applyQuickCity(name: string): void {
    this.location = name;
    this.pickedCityId.set(null);
    this.governoratePickerId.set(0);
    this.cityHintFromTransport.set(null);
    this.cdr.markForCheck();
  }

  onGovernorateSelect(value: number | null): void {
    const v = value == null || value === 0 ? 0 : value;
    this.governoratePickerId.set(v);
    this.pickedCityId.set(null);
    this.cityHintFromTransport.set(null);
    if (v > 0) {
      const c = this.governorates().find((x) => x.id === v);
      if (c) {
        this.location = c.name;
      }
    } else {
      this.location = 'Tunis';
    }
    this.cdr.markForCheck();
    // Auto-search after governorate change with debounce
    this.debouncedSearch();
  }

  private searchDebounceTimer: any = null;

  debouncedSearch(delay = 500): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.runSearch();
    }, delay);
  }

  onDateChange(): void {
    this.debouncedSearch(300);
  }

  runSearch(): void {
    this.errorMsg.set(null);
    if (!this.startDate || !this.endDate) {
      return;
    }
    const g = this.governoratePickerId();
    const p = this.pickedCityId();
    const depotCityId = g > 0 ? g : p != null && p > 0 ? p : null;
    const rawLoc = (this.location || '').trim();
    if (depotCityId == null) {
      if (rawLoc.length < 2) {
        void this.alerts.warning(
          this.translate.instant('CAR_AMADEUS.ALERT_LOC_TITLE'),
          this.translate.instant('CAR_AMADEUS.ALERT_LOC_BODY'),
        );
        return;
      }
    }
    this.loading.set(true);
    this.searched.set(false);
    this.cdr.markForCheck();
    this.dataSource
      .searchAmadeusCars({
        cityId: depotCityId ?? undefined,
        location: rawLoc,
        startDate: this.startDate,
        endDate: this.endDate,
        passengers: 1,
      })
      .subscribe({
        next: (rows) => {
          this.offers.set(rows ?? []);
          this.loading.set(false);
          this.searched.set(true);
          this.cdr.markForCheck();
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.searched.set(true);
          const status = e instanceof HttpErrorResponse ? e.status : undefined;
          let msg = this.translate.instant('CAR_AMADEUS.ERROR_GENERIC');
          if (status === 503) {
            msg = this.translate.instant('CAR_AMADEUS.ERROR_503');
          } else if (status === 401 || status === 403) {
            msg = this.translate.instant('CAR_AMADEUS.ERROR_AUTH');
          } else if (status === 502 || status === 504) {
            msg = this.translate.instant('CAR_AMADEUS.ERROR_UPSTREAM');
          }
          this.errorMsg.set(msg);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Book a car rental - creates a Transport object and navigates to booking page
   * Similar to onBookFlight in flights-page.component.ts
   */
  onBookCar(o: AmadeusCarOffer): void {
    // Calculate rental days from start and end dates
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = end.getTime() - start.getTime();
    const rentalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Create a synthetic transport ID (negative to indicate synthetic/offers)
    const syntheticId = -(Math.abs(this.hashCode(`${o.offerId}|${o.model}|${o.location}`)) + 1);

    // Build location names
    const locationName = o.location || this.location || 'Tunis';
    const providerName = o.provider || 'Car Rental';

    const selectedTransport: Transport = {
      id: syntheticId,
      type: 'CAR',
      departureCityId: this.governoratePickerId() || 0,
      arrivalCityId: this.governoratePickerId() || 0,
      departureCityName: locationName,
      arrivalCityName: locationName,
      departureTime: this.startDate ? `${this.startDate}T09:00:00` : new Date().toISOString(),
      arrivalTime: this.endDate ? `${this.endDate}T18:00:00` : new Date().toISOString(),
      price: o.price,
      capacity: 5,
      availableSeats: 1,
      durationMinutes: rentalDays * 24 * 60,
      description: `${providerName} - ${o.model}`,
      isActive: true,
    };

    // Store in trip context
    this.tripStore.selectedTransport.set(selectedTransport);
    this.tripStore.setPassengers(1);
    this.tripStore.setTransportRentalDays(rentalDays);
    this.tripStore.setDates({ travelDate: this.startDate });

    // Navigate to booking page
    this.router.navigate(['/transport', selectedTransport.id, 'book'], {
      queryParams: {
        transportType: 'CAR',
        passengers: 1,
        date: this.startDate,
      },
    });
  }

  /** Format price with currency service for dual currency display */
  formatPrice(price: number): string {
    return this.currency.formatDual(price);
  }

  private hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
