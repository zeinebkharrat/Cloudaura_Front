import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { RippleModule } from 'primeng/ripple';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { FlightService } from './flight.service';
import { FlightDto, FlightSuggestionResponse } from './flight.models';
import { FlightDestinationSuggestion } from './flight-search.component';
import { FlightListComponent } from './flight-list.component';
import { InternationalFlightLiveMapComponent } from '../../flights/international/international-flight-live-map.component';
import { CurrencyService } from '../../core/services/currency.service';
import { TripContextStore } from '../../core/stores/trip-context.store';
import { City, Transport } from '../../core/models/travel.models';
import {
  effectivePriceTnd,
  estimateDurationMinutes,
  filterBookableFlights,
  parseFlightOffer,
  pricePerSeatForBooking,
} from './flight-display.util';
import { compareFlights } from './flight-status.util';
import { DATA_SOURCE_TOKEN } from '../../core/adapters/data-source.adapter';
import { tunisiaAirportIataForCity } from '../../core/utils/tunisia-airport-iata.util';

@Component({
  selector: 'app-flights-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RippleModule,
    DatePickerModule,
    InputNumberModule,
    FlightListComponent,
    InternationalFlightLiveMapComponent,
  ],
  templateUrl: './flights-page.component.html',
  styleUrls: ['./flights-page.component.css', './live-flights-page.shared.css'],
})
export class FlightsPageComponent implements OnInit, OnDestroy {
  private readonly flightApi = inject(FlightService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripStore = inject(TripContextStore);
  private readonly currency = inject(CurrencyService);
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
  private readonly destroy$ = new Subject<void>();
  private readonly destinationInput$ = new Subject<string>();

  destinationQuery = '';
  originIata = 'TUN';
  selected: FlightDto | null = null;
  sortMode: 'best' | 'duration' | 'depart' = 'best';
  suggestionMeta: FlightSuggestionResponse | null = null;

  apiFlights: FlightDto[] = [];
  loading = false;
  error: string | null = null;
  hasSearched = false;
  lastSearchDestination = '';
  lastSearchOrigin = 'TUN';
  passengers = 1;

  /** Search by flight number (Aviationstack `flight_iata` / `flight_number`). */
  flightNumberQuery = '';
  flightSearchDate = '';
  flightNumberSearchActive = false;
  lastFlightQuery = '';

  autocompleteSuggestions: FlightDestinationSuggestion[] = [];

  readonly today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  departureDate: Date = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  ngOnInit(): void {
    this.destinationInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        map((s) => s.trim()),
        switchMap((q) => {
          if (q.length < 2) {
            this.autocompleteSuggestions = [];
            return of(null);
          }
          return this.flightApi.resolveAirport(q).pipe(
            tap((res) => {
              if (res.success && res.data?.found && res.data.iata) {
                const d = res.data;
                this.autocompleteSuggestions = [
                  {
                    label: `${d.label} (${d.iata})`,
                    pickValue: (d.label || d.iata || q) as string,
                  },
                ];
              } else {
                this.autocompleteSuggestions = [];
              }
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.destinationInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        map((s) => s.trim()),
        filter((q) => q.length >= 3),
        takeUntil(this.destroy$),
      )
      .subscribe((q) => {
        this.flightNumberSearchActive = false;
        this.runSuggest(q, this.originIata);
      });

    this.dataSource
      .getCities()
      .pipe(take(1))
      .subscribe((cities) => {
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((p: Params) => {
          this.applyRouteAndStoreHydration(p, cities);
        });
      });
  }

  /**
   * Prefills schedule search from `/transport` query params and/or {@link TripContextStore.transportSearchLeg}.
   */
  private applyRouteAndStoreHydration(p: Params, cities: City[]): void {
    const leg = this.tripStore.transportSearchLeg();
    let dest = typeof p['destination'] === 'string' ? p['destination'].trim() : '';
    const originParam = typeof p['origin'] === 'string' ? p['origin'].trim() : '';

    const fromId = Number.parseInt(String(p['from'] ?? ''), 10);
    const toId = Number.parseInt(String(p['to'] ?? ''), 10);
    const fromCity = Number.isFinite(fromId) ? cities.find((c) => c.id === fromId) ?? null : null;
    const toCity = Number.isFinite(toId) ? cities.find((c) => c.id === toId) ?? null : null;
    const fromCityLeg =
      leg.fromCityId != null ? cities.find((c) => c.id === leg.fromCityId) ?? null : null;
    const toCityLeg =
      leg.toCityId != null ? cities.find((c) => c.id === leg.toCityId) ?? null : null;

    if (dest.length < 2) {
      if (toCity?.name?.trim()) {
        dest = toCity.name.trim();
      } else if (toCityLeg?.name?.trim()) {
        dest = toCityLeg.name.trim();
      }
    }

    let nextOrigin = 'TUN';
    if (originParam) {
      nextOrigin = originParam.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'TUN';
    } else {
      const fc = fromCity ?? fromCityLeg;
      const mapped = tunisiaAirportIataForCity(fc);
      if (mapped) {
        nextOrigin = mapped;
      }
    }

    const dateFromQuery = typeof p['date'] === 'string' ? p['date'].trim() : '';
    let travelIso = dateFromQuery || leg.travelDateIso || this.tripStore.dates().travelDate || '';
    if (travelIso) {
      const normalized = travelIso.includes('T') ? travelIso : `${travelIso}T12:00:00`;
      this.tripStore.setDates({ travelDate: normalized });
    }

    let pax = Number.parseInt(String(p['passengers'] ?? ''), 10);
    if (!Number.isFinite(pax) || pax < 1) {
      pax = leg.passengers >= 1 ? leg.passengers : this.tripStore.pax().adults;
    }
    this.passengers = Math.min(20, Math.max(1, pax));
    this.tripStore.setPassengers(this.passengers);

    this.destinationQuery = dest;
    this.originIata = nextOrigin;
    this.syncFlightSearchDateFromStore();

    if (dest.length >= 2) {
      this.destinationInput$.next(dest);
      this.runSuggest(dest, this.originIata);
    }

    this.syncDepartureDateFromStore();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDestinationQueryChange(value: string): void {
    this.destinationQuery = value;
    this.destinationInput$.next(value);
  }

  onOriginIataChange(value: string): void {
    const next = (value || 'TUN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'TUN';
    this.originIata = next;
    this.flightNumberSearchActive = false;
    const q = this.destinationQuery.trim();
    if (q.length >= 2) {
      this.runSuggest(q, this.originIata);
    }
  }

  onSearchSubmit(): void {
    const q = this.destinationQuery.trim();
    if (q.length < 2) {
      return;
    }
    this.flightNumberSearchActive = false;
    this.runSuggest(q, this.originIata);
  }

  onMainSearch(): void {
    this.tripStore.setPassengers(this.passengers);
    this.onDepartureDateChange(this.departureDate);
    this.onSearchSubmit();
  }

  onDepartureDateChange(d: Date | null): void {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      return;
    }
    this.departureDate = d;
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = `${y}-${mo}-${day}T12:00:00`;
    this.tripStore.setDates({ travelDate: iso });
    this.flightSearchDate = `${y}-${mo}-${day}`;
  }

  onPassengersChange(n: number | null): void {
    const v = Math.min(20, Math.max(1, Number(n) || 1));
    this.passengers = v;
    this.tripStore.setPassengers(v);
  }

  onFlightSearchDateFieldChange(v: string): void {
    this.onFlightSearchDateChange(typeof v === 'string' ? v : '');
  }

  isFlightQueryValid(): boolean {
    const q = (this.flightNumberQuery || '').trim();
    if (q.length < 2) {
      return false;
    }
    if (/^\d{1,4}$/.test(q)) {
      return true;
    }
    return /^[A-Za-z]{2}\s*\d{1,4}$/.test(q);
  }

  onFlightNumberQueryChange(value: string): void {
    this.flightNumberQuery = value;
  }

  onFlightSearchDateChange(value: string): void {
    this.flightSearchDate = value;
  }

  onFlightSearchSubmit(): void {
    this.runFlightNumberSearch();
  }

  onPickSuggestion(pickValue: string): void {
    this.destinationQuery = pickValue;
    this.autocompleteSuggestions = [];
    const q = pickValue.trim();
    if (q.length >= 2) {
      this.runSuggest(q, this.originIata);
    }
  }

  refreshResults(): void {
    if (this.flightNumberSearchActive && this.lastFlightQuery.trim().length > 0) {
      this.runFlightNumberSearch();
      return;
    }
    const q = this.lastSearchDestination.trim();
    if (q.length >= 2) {
      this.runSuggest(q, this.lastSearchOrigin);
    }
  }

  onSelectFlight(f: FlightDto): void {
    this.selected = f;
  }

  onBookFlight(f: FlightDto): void {
    const syntheticId = -(Math.abs(this.hashCode(`${f.flightNumber}|${f.departureTime}|${f.arrivalTime}`)) + 1);
    const durationMinutes = estimateDurationMinutes(f);
    const pricePerSeat = pricePerSeatForBooking(f, this.passengers, this.currency);
    const quote = parseFlightOffer(f);

    const normIata = (code: string | null | undefined, fallback: string): string => {
      const raw = (code ?? fallback).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (raw.length >= 3) {
        return raw;
      }
      const fb = fallback.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      return fb.length >= 3 ? fb : 'TUN';
    };
    const depIata = normIata(f.departureIata, this.lastSearchOrigin);
    const arrIata = normIata(f.arrivalIata, this.lastSearchDestination);

    const selectedTransport: Transport = {
      id: syntheticId,
      type: 'PLANE',
      departureCityId: 0,
      arrivalCityId: 0,
      departureCityName: f.departureAirport || f.departureIata || this.lastSearchOrigin,
      arrivalCityName: f.arrivalAirport || f.arrivalIata || this.lastSearchDestination,
      departureTime: f.departureTime || new Date().toISOString(),
      arrivalTime: f.arrivalTime || new Date(Date.now() + durationMinutes * 60_000).toISOString(),
      price: pricePerSeat,
      capacity: 180,
      availableSeats: 180,
      durationMinutes,
      description: `${f.airline || 'Airline'} ${f.flightNumber || ''}`.trim(),
      isActive: true,
      syntheticFlightOffer: {
        operatorName: (f.airline || 'Airline').trim() || 'Airline',
        flightCode: f.flightNumber || undefined,
        departureIata: depIata,
        arrivalIata: arrIata,
        pricePerSeatTnd: pricePerSeat,
        departureTimeIso: f.departureTime ?? undefined,
        arrivalTimeIso: f.arrivalTime ?? undefined,
        description: `${f.airline || 'Airline'} ${f.flightNumber || ''}`.trim(),
        quoteOriginalAmount: quote?.amount,
        quoteOriginalCurrency: quote?.currency,
      },
    };

    this.tripStore.selectedTransport.set(selectedTransport);
    this.tripStore.setPassengers(this.passengers);

    const bookingDate = selectedTransport.departureTime?.slice(0, 10);
    if (bookingDate) {
      this.tripStore.setDates({ travelDate: bookingDate });
    }

    this.router.navigate(['/transport', selectedTransport.id, 'book'], {
      queryParams: {
        transportType: 'PLANE',
        passengers: this.passengers,
        date: bookingDate,
      },
    });
  }

  get displayFlights(): FlightDto[] {
    const list = this.flightNumberSearchActive
      ? [...this.apiFlights]
      : filterBookableFlights(this.apiFlights);
    const sorted = [...list];
    if (this.sortMode === 'best') {
      sorted.sort((a, b) => effectivePriceTnd(a, this.currency) - effectivePriceTnd(b, this.currency));
    } else if (this.sortMode === 'duration') {
      sorted.sort((a, b) => estimateDurationMinutes(a) - estimateDurationMinutes(b));
    } else {
      sorted.sort((a, b) => compareFlights(a, b, 'departure'));
    }
    return sorted;
  }

  get travelDateForMap(): Date | null {
    if (this.flightNumberSearchActive && this.flightSearchDate?.trim()) {
      const d = new Date(this.flightSearchDate.trim().slice(0, 10));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const iso = this.tripStore.dates().travelDate;
    if (iso && iso.length >= 10) {
      const d = new Date(iso.slice(0, 10));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  get arrIataForMap(): string {
    const m = this.suggestionMeta?.destinationAirportIata?.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (m && m.length === 3) {
      return m;
    }
    const p = this.lastSearchDestination.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    return p.length === 3 ? p : '';
  }

  setSort(mode: string): void {
    if (mode === 'best' || mode === 'duration' || mode === 'depart') {
      this.sortMode = mode;
    }
  }

  swapRoute(): void {
    const destIata = this.suggestionMeta?.destinationAirportIata?.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const probe = this.destinationQuery.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const normOrigin = (this.originIata || 'TUN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'TUN';
    if (destIata && destIata.length === 3) {
      this.originIata = destIata;
      this.destinationQuery = normOrigin;
      this.flightNumberSearchActive = false;
      const q = this.destinationQuery.trim();
      if (q.length >= 2) {
        this.runSuggest(q, this.originIata);
      }
      return;
    }
    if (probe.length === 3) {
      this.originIata = probe;
      this.destinationQuery = normOrigin;
      this.flightNumberSearchActive = false;
      const q = this.destinationQuery.trim();
      if (q.length >= 2) {
        this.runSuggest(q, this.originIata);
      }
    }
  }

  get idleHint(): string {
    return 'Enter route details, then search.';
  }

  get listEmptyMessage(): string {
    if (!this.hasSearched || this.loading || this.error) {
      return '';
    }
    if (this.displayFlights.length === 0) {
      if (this.flightNumberSearchActive) {
        return this.apiFlights.length > 0
          ? 'No rows to display for this filter.'
          : `No flights found for ${this.lastFlightQuery} on ${this.flightSearchDate || 'the selected date'}.`;
      }
      if (this.apiFlights.length > 0) {
        return 'No upcoming flights — completed or past departures are hidden.';
      }
      return `No flights found from ${this.lastSearchOrigin} to ${this.lastSearchDestination}`;
    }
    return '';
  }

  private runSuggest(destination: string, origin: string): void {
    const d = destination.trim();
    const o = (origin || 'TUN').trim().toUpperCase().slice(0, 4) || 'TUN';
    if (d.length < 2) {
      return;
    }
    this.flightNumberSearchActive = false;
    this.loading = true;
    this.error = null;
    this.selected = null;
    this.lastSearchDestination = d;
    this.lastSearchOrigin = o;
    this.suggestionMeta = null;

    this.flightApi.suggestForDestination(d, o, 25).subscribe({
      next: (res) => {
        this.loading = false;
        this.hasSearched = true;
        if (!res.success) {
          this.useLocalFallback(d, o);
          return;
        }
        const body = res.data;
        this.suggestionMeta = body ?? null;
        this.apiFlights = body?.flights ?? [];
        if ((this.apiFlights?.length ?? 0) === 0) {
          this.useLocalFallback(d, o);
          return;
        }
        this.error = null;
        this.selected = this.displayFlights[0] ?? null;
      },
      error: () => {
        this.useLocalFallback(d, o);
      },
    });
  }

  private syncFlightSearchDateFromStore(): void {
    const d = this.tripStore.dates().travelDate;
    if (d && d.length >= 10) {
      this.flightSearchDate = d.slice(0, 10);
    } else if (!this.flightSearchDate) {
      this.flightSearchDate = new Date().toISOString().slice(0, 10);
    }
  }

  private syncDepartureDateFromStore(): void {
    const iso = this.tripStore.dates().travelDate;
    if (iso && iso.length >= 10) {
      const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        this.departureDate = d;
        return;
      }
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    this.departureDate = d;
  }

  private runFlightNumberSearch(): void {
    const raw = this.flightNumberQuery.trim();
    if (raw.length < 2) {
      return;
    }
    if (!/^\d{1,4}$/.test(raw) && !/^[A-Za-z]{2}\s*\d{1,4}$/.test(raw)) {
      this.error = 'Enter airline + number (e.g. TU712) or 1–4 digits.';
      return;
    }
    this.loading = true;
    this.error = null;
    this.selected = null;
    this.flightNumberSearchActive = true;
    this.lastFlightQuery = raw.toUpperCase().replace(/\s+/g, '');
    this.suggestionMeta = null;
    this.hasSearched = true;

    const dateParam = this.flightSearchDate?.trim() ? this.flightSearchDate.trim().slice(0, 10) : null;

    this.flightApi.searchByFlight(raw, dateParam, 25).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res.success) {
          this.apiFlights = [];
          this.selected = null;
          this.error = res.message ?? 'Flight search failed.';
          return;
        }
        this.apiFlights = res.data ?? [];
        this.error = null;
        this.selected = this.displayFlights[0] ?? null;
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading = false;
        this.apiFlights = [];
        this.selected = null;
        this.error = err?.error?.message ?? 'Could not search by flight number.';
      },
    });
  }

  private useLocalFallback(destination: string, origin: string): void {
    this.flightApi.resolveAirport(destination).subscribe({
      next: (res) => {
        const iata = (res.data?.found && res.data.iata ? res.data.iata : this.guessIata(destination)) || 'NBE';
        const label = (res.data?.found && res.data.label ? res.data.label : `${destination} (${iata})`) || `${destination} (${iata})`;
        this.suggestionMeta = {
          originAirportIata: origin,
          destinationAirportIata: iata,
          resolvedDestinationLabel: label,
          hint: 'Fallback data is shown while live provider is unavailable.',
          flights: this.buildFallbackFlights(origin, iata, label),
        };
        this.apiFlights = this.suggestionMeta.flights;
        this.loading = false;
        this.hasSearched = true;
        this.error = null;
        this.selected = this.displayFlights[0] ?? null;
      },
      error: () => {
        const iata = this.guessIata(destination) || 'NBE';
        const label = `${destination} (${iata})`;
        this.suggestionMeta = {
          originAirportIata: origin,
          destinationAirportIata: iata,
          resolvedDestinationLabel: label,
          hint: 'Fallback data is shown while live provider is unavailable.',
          flights: this.buildFallbackFlights(origin, iata, label),
        };
        this.apiFlights = this.suggestionMeta.flights;
        this.loading = false;
        this.hasSearched = true;
        this.error = null;
        this.selected = this.displayFlights[0] ?? null;
      },
    });
  }

  private buildFallbackFlights(originIata: string, destinationIata: string, destinationLabel: string): FlightDto[] {
    const now = new Date();
    const mk = (hoursAhead: number, minsDuration: number, flightNumber: string, airline: string, status: string, statusCategory: string): FlightDto => {
      const dep = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
      const arr = new Date(dep.getTime() + minsDuration * 60 * 1000);
      return {
        flightNumber,
        airline,
        departureAirport: originIata,
        departureIata: originIata,
        arrivalAirport: destinationLabel,
        arrivalIata: destinationIata,
        departureTime: dep.toISOString(),
        arrivalTime: arr.toISOString(),
        status,
        statusCategory,
        departureLatitude: null,
        departureLongitude: null,
        arrivalLatitude: null,
        arrivalLongitude: null,
      };
    };

    return [
      mk(1, 55, 'YT101', 'YallaTN Air', 'scheduled', 'ON_TIME'),
      mk(3, 50, 'YT205', 'Carthage Wings', 'active', 'ON_TIME'),
      mk(5, 60, 'YT309', 'Sahel Connect', 'scheduled', 'DELAYED'),
    ];
  }

  private guessIata(destination: string): string | null {
    const raw = destination.trim();
    if (!raw) {
      return null;
    }
    if (/^[A-Za-z]{3}$/.test(raw)) {
      return raw.toUpperCase();
    }
    const key = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    const map: Record<string, string> = {
      tunis: 'TUN',
      sousse: 'NBE',
      hammamet: 'NBE',
      monastir: 'MIR',
      sfax: 'SFA',
      djerba: 'DJE',
      medenine: 'DJE',
      mednine: 'DJE',
      mednin: 'DJE',
      zarzis: 'DJE',
      tataouine: 'DJE',
      tozeur: 'TOE',
      gafsa: 'GAF',
      gabes: 'GAE',
      tabarka: 'TBJ',
      bizerte: 'TUN',
      nabeul: 'NBE',
      paris: 'CDG',
      london: 'LHR',
      dubai: 'DXB',
      doha: 'DOH',
      istanbul: 'IST',
      rome: 'FCO',
      madrid: 'MAD',
    };
    return map[key] ?? null;
  }

  private hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
