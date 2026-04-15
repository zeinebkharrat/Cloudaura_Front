import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
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
        filter((q) => q.length >= 2),
        takeUntil(this.destroy$),
      )
      .subscribe((q) => this.runSuggest(q, this.originIata));

    this.route.queryParams.pipe(take(1)).subscribe((p: Params) => {
      const dest = typeof p['destination'] === 'string' ? p['destination'].trim() : '';
      const origin = typeof p['origin'] === 'string' ? p['origin'].trim() : '';
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
    return 'Type at least 2 characters in Destination — results update automatically, or press Search.';
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
          this.apiFlights = [];
          this.error = 'Unable to load flights, please try again';
          return;
        }
        const body = res.data;
        this.suggestionMeta = body ?? null;
        this.apiFlights = body?.flights ?? [];
        this.error = null;
      },
      error: () => {
        this.loading = false;
        this.hasSearched = true;
        this.apiFlights = [];
        this.suggestionMeta = null;
        this.error = 'Unable to load flights, please try again';
      },
    });
  }
}
