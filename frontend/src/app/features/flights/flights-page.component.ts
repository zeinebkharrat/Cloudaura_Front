import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TooltipModule } from 'primeng/tooltip';
import { FlightService } from './flight.service';
import { FlightDto, FlightSuggestionResponse } from './flight.models';
import { FlightSearchComponent, FlightDestinationSuggestion } from './flight-search.component';
import { FlightListComponent } from './flight-list.component';
import { FlightRouteMapComponent } from './flight-route-map.component';
import { TripContextStore } from '../../core/stores/trip-context.store';
import { Transport } from '../../core/models/travel.models';
import {
  compareFlights,
  matchesStatusFilter,
  SortKey,
  StatusFilterKey,
} from './flight-status.util';

@Component({
  selector: 'app-flights-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputSwitchModule,
    TooltipModule,
    FlightSearchComponent,
    FlightListComponent,
    FlightRouteMapComponent,
  ],
  templateUrl: './flights-page.component.html',
  styleUrl: './flights-page.component.css',
})
export class FlightsPageComponent implements OnInit, OnDestroy {
  private readonly flightApi = inject(FlightService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripStore = inject(TripContextStore);
  private readonly destroy$ = new Subject<void>();
  private readonly destinationInput$ = new Subject<string>();

  destinationQuery = '';
  originIata = 'TUN';
  mapMode = false;
  selected: FlightDto | null = null;
  suggestionMeta: FlightSuggestionResponse | null = null;

  apiFlights: FlightDto[] = [];
  loading = false;
  error: string | null = null;
  hasSearched = false;
  lastSearchDestination = '';
  lastSearchOrigin = 'TUN';
  passengers = 1;

  autocompleteSuggestions: FlightDestinationSuggestion[] = [];

  statusFilter: StatusFilterKey = 'all';
  airlineFilter: string | null = null;
  sortKey: SortKey = 'departure';

  readonly sortOptions = [
    { label: 'Departure time', value: 'departure' as SortKey },
    { label: 'Airline', value: 'airline' as SortKey },
    { label: 'Status', value: 'status' as SortKey },
  ];

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
      .subscribe((q) => this.runSuggest(q, this.originIata));

    this.route.queryParams.pipe(take(1)).subscribe((p: Params) => {
      const dest = typeof p['destination'] === 'string' ? p['destination'].trim() : '';
      const origin = typeof p['origin'] === 'string' ? p['origin'].trim() : '';
      const requestedPassengers = Number.parseInt(String(p['passengers'] ?? '1'), 10);
      this.passengers = Number.isFinite(requestedPassengers) && requestedPassengers > 0 ? requestedPassengers : 1;
      if (dest.length >= 2) {
        this.destinationQuery = dest;
        this.originIata = (origin || 'TUN').toUpperCase().slice(0, 4);
        this.runSuggest(dest, this.originIata);
      }
    });
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
    this.runSuggest(q, this.originIata);
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
    const q = this.lastSearchDestination.trim();
    if (q.length >= 2) {
      this.runSuggest(q, this.lastSearchOrigin);
    }
  }

  onMapToggle(on: boolean): void {
    this.mapMode = on;
    if (!on) {
      this.selected = null;
    }
  }

  onSelectFlight(f: FlightDto): void {
    this.selected = f;
  }

  onBookFlight(f: FlightDto): void {
    const syntheticId = -(Math.abs(this.hashCode(`${f.flightNumber}|${f.departureTime}|${f.arrivalTime}`)) + 1);
    const durationMinutes = this.estimateDurationMinutes(f);
    const pricePerSeat = this.estimateFlightSeatPrice(durationMinutes);

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

  setStatusFilter(key: StatusFilterKey): void {
    this.statusFilter = key;
  }

  clearFilters(): void {
    this.statusFilter = 'all';
    this.airlineFilter = null;
    this.sortKey = 'departure';
  }

  get displayFlights(): FlightDto[] {
    let list = [...this.apiFlights];
    if (this.statusFilter !== 'all') {
      list = list.filter((f) => matchesStatusFilter(f, this.statusFilter));
    }
    if (this.airlineFilter) {
      list = list.filter((f) => (f.airline || '') === this.airlineFilter);
    }
    list.sort((a, b) => compareFlights(a, b, this.sortKey));
    return list;
  }

  get airlineDropdownOptions(): { label: string; value: string }[] {
    const names = new Set<string>();
    for (const f of this.apiFlights) {
      const a = (f.airline || '').trim();
      if (a) {
        names.add(a);
      }
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((a) => ({ label: a, value: a }));
  }

  get idleHint(): string {
    return 'Type at least 3 characters in Destination — results update automatically, or press Search.';
  }

  get listEmptyMessage(): string {
    if (!this.hasSearched || this.loading || this.error) {
      return '';
    }
    if (this.apiFlights.length === 0) {
      return `No flights found from ${this.lastSearchOrigin} to ${this.lastSearchDestination}`;
    }
    if (this.displayFlights.length === 0) {
      return 'No flights match the selected filters.';
    }
    return '';
  }

  private runSuggest(destination: string, origin: string): void {
    const d = destination.trim();
    const o = (origin || 'TUN').trim().toUpperCase().slice(0, 4) || 'TUN';
    if (d.length < 2) {
      return;
    }
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
      },
      error: () => {
        this.useLocalFallback(d, o);
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

  private estimateDurationMinutes(f: FlightDto): number {
    const dep = Date.parse(f.departureTime || '');
    const arr = Date.parse(f.arrivalTime || '');
    if (Number.isFinite(dep) && Number.isFinite(arr) && arr > dep) {
      return Math.max(45, Math.round((arr - dep) / 60000));
    }
    return 95;
  }

  private estimateFlightSeatPrice(durationMinutes: number): number {
    const base = 48 + durationMinutes * 0.36;
    return Math.round(Math.min(180, Math.max(58, base)) * 100) / 100;
  }

  private hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
