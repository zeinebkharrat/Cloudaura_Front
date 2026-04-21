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
import { InputSwitchModule } from 'primeng/inputswitch';
import { TooltipModule } from 'primeng/tooltip';
import { FlightService } from './flight.service';
import { FlightDto, FlightSuggestionResponse } from './flight.models';
import { FlightSearchComponent, FlightDestinationSuggestion } from './flight-search.component';
import { FlightListComponent } from './flight-list.component';
import { FlightRouteMapComponent } from './flight-route-map.component';
import { CurrencyService } from '../../core/services/currency.service';
import { TripContextStore } from '../../core/stores/trip-context.store';
import { City, Transport } from '../../core/models/travel.models';
import {
  estimateDurationMinutes,
  filterBookableFlights,
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
    RouterLink,
    FormsModule,
    ButtonModule,
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
  private readonly currency = inject(CurrencyService);
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
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

    if (dest.length >= 2) {
      this.destinationInput$.next(dest);
      this.runSuggest(dest, this.originIata);
    }
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
    const durationMinutes = estimateDurationMinutes(f);
    const pricePerSeat = pricePerSeatForBooking(f, this.passengers, this.currency);

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
    const list = filterBookableFlights(this.apiFlights);
    return [...list].sort((a, b) => compareFlights(a, b, 'departure'));
  }

  get idleHint(): string {
    return 'Type at least 3 characters in Destination — results update automatically, or press Search.';
  }

  get listEmptyMessage(): string {
    if (!this.hasSearched || this.loading || this.error) {
      return '';
    }
    if (this.displayFlights.length === 0) {
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

  private hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
