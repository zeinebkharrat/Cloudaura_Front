import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { FlightSearchParams, FlightService } from './flight.service';
import { FlightBookingRequest, FlightOfferDto } from './flight.models';
import {
  AirportOption,
  FlightDestinationSuggestion,
  FlightSearchComponent,
  FlightSearchFormValue,
  UiFlightType,
} from './flight-search.component';
import { FlightListComponent } from './flight-list.component';
import { TripContextStore } from '../../core/stores/trip-context.store';
import { Transport } from '../../core/models/travel.models';
import { compareFlights, SortKey } from './flight-status.util';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-flights-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    DropdownModule,
    TooltipModule,
    FlightSearchComponent,
    FlightListComponent,
  ],
  templateUrl: './flights-page.component.html',
  styleUrl: './flights-page.component.css',
})
export class FlightsPageComponent implements OnInit, OnDestroy {
  private readonly flightApi = inject(FlightService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(TripContextStore);
  private readonly auth = inject(AuthService);
  private readonly destroy$ = new Subject<void>();
  private readonly fromInput$ = new Subject<string>();
  private readonly recentStorageKey = 'flights_recent_searches_v1';

  readonly tunisianAirportOptions: AirportOption[] = [
    { iata: 'TUN', label: 'Tunis-Carthage (TUN)' },
    { iata: 'DJE', label: 'Djerba-Zarzis (DJE)' },
    { iata: 'MIR', label: 'Monastir Habib Bourguiba (MIR)' },
    { iata: 'SFA', label: 'Sfax-Thyna (SFA)' },
    { iata: 'NBE', label: 'Enfidha-Hammamet (NBE)' },
    { iata: 'TOE', label: 'Tozeur-Nefta (TOE)' },
    { iata: 'GAF', label: 'Gafsa-Ksar (GAF)' },
    { iata: 'TAB', label: 'Tabarka-Ain Draham (TAB)' },
  ];

  flightType: UiFlightType = 'internal';
  selectedFrom = 'TUN';
  selectedTo = 'DJE';
  selectedDate: Date | null = new Date();

  apiFlights: FlightOfferDto[] = [];
  loading = false;
  error: string | null = null;
  bookingMessage: string | null = null;
  bookingError: string | null = null;
  hasSearched = false;

  selected: FlightOfferDto | null = null;
  fromSuggestions: FlightDestinationSuggestion[] = [];
  maxPrice: number | null = null;
  recentSearches: string[] = [];

  sortKey: SortKey | 'price' = 'departure';
  readonly minTravelDate: Date;

  readonly sortOptions = [
    { label: 'Departure time', value: 'departure' as SortKey },
    { label: 'Price', value: 'price' as const },
    { label: 'Airline', value: 'airline' as SortKey },
  ];

  constructor() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    this.minTravelDate = d;
  }

  ngOnInit(): void {
    this.recentSearches = this.readRecentSearches();

    this.fromInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        map((s) => s.trim()),
        switchMap((q) => {
          if (q.length < 2) {
            this.fromSuggestions = [];
            return of(null);
          }
          return this.flightApi.resolveAirport(q).pipe(
            tap((res) => {
              if (res.success && res.data?.found && res.data.iata) {
                const d = res.data;
                this.fromSuggestions = [
                  {
                    label: `${d.label} (${d.iata})`,
                    pickValue: (d.iata || q).toUpperCase(),
                  },
                ];
              } else {
                this.fromSuggestions = [];
              }
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Prefill from URL once, then keep fields user-editable without being overwritten.
    this.route.queryParams.pipe(take(1), takeUntil(this.destroy$)).subscribe((p: Params) => {
      const type = typeof p['type'] === 'string' ? p['type'].trim() : '';
      const from = typeof p['from'] === 'string' ? p['from'].trim() : '';
      const to = typeof p['to'] === 'string' ? p['to'].trim() : '';
      const date = typeof p['date'] === 'string' ? p['date'].trim() : '';

      if (type === 'external') {
        this.flightType = 'external';
      }
      if (this.isValidIata(from)) {
        this.selectedFrom = from.toUpperCase();
      }
      if (this.isValidIata(to)) {
        this.selectedTo = to.toUpperCase();
      }
      if (date) {
        const parsed = new Date(date);
        if (!Number.isNaN(parsed.getTime())) {
          this.selectedDate = parsed;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFlightTypeChange(next: UiFlightType): void {
    this.flightType = next;
    this.error = null;
    if (next === 'internal' && !this.isTunisianIata(this.selectedFrom)) {
      this.selectedFrom = 'TUN';
    }
  }

  onFromChange(value: string): void {
    const next = this.normalizeIata(value);
    this.selectedFrom = next;
    if (this.flightType === 'external') {
      this.fromInput$.next(next);
    }
  }

  onToChange(value: string): void {
    this.selectedTo = this.normalizeIata(value);
  }

  onDateChange(value: Date | null): void {
    this.selectedDate = value;
  }

  onPickFromSuggestion(iata: string): void {
    this.selectedFrom = this.normalizeIata(iata);
    this.fromSuggestions = [];
  }

  onSwapRequested(): void {
    if (this.flightType !== 'internal') {
      return;
    }
    const currentFrom = this.selectedFrom;
    this.selectedFrom = this.selectedTo;
    this.selectedTo = currentFrom;
  }

  onSearchSubmit(value: FlightSearchFormValue): void {
    this.searchFlights(value, 'internal');
  }

  onExternalSearch(value: FlightSearchFormValue): void {
    this.searchFlights(value, 'external');
  }

  onSelectFlight(f: FlightOfferDto): void {
    this.selected = f;
  }

  onBookFlight(f: FlightOfferDto): void {
    if (!f.transportId) {
      this.bookingError = 'Offer is not bookable.';
      this.bookingMessage = null;
      return;
    }

    const transport: Transport = {
      id: f.transportId,
      type: 'PLANE',
      departureCityId: 0,
      arrivalCityId: 0,
      departureCityName: f.departureAirport || f.departureIata || 'Departure airport',
      arrivalCityName: f.arrivalAirport || f.arrivalIata || 'Arrival airport',
      departureTime: f.departureTime || new Date().toISOString(),
      arrivalTime: f.arrivalTime || new Date().toISOString(),
      price: Number(f.totalAmount ?? 0) || 0,
      capacity: 180,
      availableSeats: 180,
      description: f.flightNumber || f.offerId,
      isActive: true,
    };

    this.store.selectedTransport.set(transport);
    this.store.setPax({ adults: 1, children: 0 });
    const travelDate = transport.departureTime ? transport.departureTime.slice(0, 10) : '';
    void this.router.navigate(['/transport', String(f.transportId), 'book'], {
      queryParams: travelDate ? { date: travelDate } : undefined,
    });
  }

  clearFiltersAndSort(): void {
    this.maxPrice = null;
    this.sortKey = 'departure';
  }

  get displayFlights(): FlightOfferDto[] {
    let list = [...this.apiFlights];

    if (this.maxPrice != null && this.maxPrice > 0) {
      list = list.filter((f) => {
        const p = this.numericPrice(f);
        return p != null && p <= this.maxPrice!;
      });
    }

    if (this.sortKey === 'price') {
      list.sort((a, b) => {
        const pa = this.numericPrice(a) ?? Number.MAX_SAFE_INTEGER;
        const pb = this.numericPrice(b) ?? Number.MAX_SAFE_INTEGER;
        return pa - pb;
      });
    } else {
      list.sort((a, b) => compareFlights(a, b, this.sortKey as SortKey));
    }

    return list;
  }

  get idleHint(): string {
    return 'Pick route and date, then search flights.';
  }

  get hasPastDate(): boolean {
    if (!this.selectedDate) {
      return false;
    }
    return this.selectedDate.getTime() < this.minTravelDate.getTime();
  }

  get hasSameAirport(): boolean {
    if (this.flightType !== 'internal') {
      return false;
    }
    return this.isValidIata(this.selectedFrom) && this.isValidIata(this.selectedTo) && this.selectedFrom === this.selectedTo;
  }

  get searchValidationMessage(): string | null {
    if (this.hasPastDate) {
      return 'Travel date cannot be in the past.';
    }
    if (this.hasSameAirport) {
      return 'Departure and arrival airports must be different.';
    }
    return this.error;
  }

  get listEmptyMessage(): string {
    if (!this.hasSearched || this.loading || this.error) {
      return '';
    }
    if (this.apiFlights.length === 0) {
      return 'No flights found.';
    }
    if (this.displayFlights.length === 0) {
      return 'No flights match the selected filters.';
    }
    return '';
  }

  get internalSearchDisabled(): boolean {
    if (this.loading || !this.selectedDate || this.hasPastDate) {
      return true;
    }

    if (this.flightType === 'internal') {
      if (!this.isTunisianIata(this.selectedFrom) || !this.isTunisianIata(this.selectedTo)) {
        return true;
      }
      if (this.selectedFrom === this.selectedTo) {
        return true;
      }
      return false;
    }

    return !this.isValidIata(this.selectedFrom);
  }

  get externalSearchDisabled(): boolean {
    return this.loading || !this.selectedDate || !this.isValidIata(this.selectedFrom);
  }

  get cheapestOfferId(): string | null {
    let cheapest: FlightOfferDto | null = null;
    for (const f of this.displayFlights) {
      const p = this.numericPrice(f);
      if (p == null) {
        continue;
      }
      if (!cheapest || p < (this.numericPrice(cheapest) ?? Number.MAX_SAFE_INTEGER)) {
        cheapest = f;
      }
    }
    return cheapest?.offerId ?? null;
  }

  private searchFlights(value: FlightSearchFormValue, triggerType: UiFlightType): void {
    const from = this.normalizeIata(value.from);
    const to = this.normalizeIata(value.to);
    const date = value.date;

    this.error = null;
    this.bookingError = null;
    this.bookingMessage = null;
    this.selected = null;

    if (!date) {
      this.error = 'Please select a travel date.';
      return;
    }

    if (date.getTime() < this.minTravelDate.getTime()) {
      this.error = 'Travel date cannot be in the past.';
      return;
    }

    if (!this.isValidIata(from)) {
      this.error = 'Departure airport must be a valid IATA code (3 letters).';
      return;
    }

    if (triggerType === 'internal') {
      if (!this.isTunisianIata(from) || !this.isTunisianIata(to)) {
        this.error = 'Internal flights require Tunisian airports only.';
        return;
      }
      if (from === to) {
        this.error = 'Departure and arrival must be different.';
        return;
      }
    }

    const params: FlightSearchParams = {
      dep: from,
      date: this.toApiDate(date),
      type: triggerType,
      adults: 1,
      cabinClass: 'economy',
      limit: 25,
    };

    if (triggerType === 'internal') {
      params.arr = to;
    }

    this.loading = true;
    this.pushRecentSearch(`${triggerType}:${from}${triggerType === 'internal' ? `-${to}` : ''}`);

    this.flightApi.searchFlights(params).subscribe({
      next: (res) => {
        this.loading = false;
        this.hasSearched = true;
        if (!res.success) {
          this.apiFlights = [];
          this.error = 'Unable to load flights, please try again';
          return;
        }

        this.apiFlights = res.data ?? [];
        this.error = null;

        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            type: triggerType,
            from,
            to: triggerType === 'internal' ? to : null,
            date: this.toApiDate(date),
          },
          queryParamsHandling: 'merge',
        });
      },
      error: () => {
        this.loading = false;
        this.hasSearched = true;
        this.apiFlights = [];
        this.error = 'Unable to load flights, please try again';
      },
    });
  }

  private normalizeIata(value: string): string {
    return (value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  }

  private isValidIata(value: string): boolean {
    return /^[A-Z]{3}$/.test(value);
  }

  private isTunisianIata(value: string): boolean {
    return this.tunisianAirportOptions.some((a) => a.iata === value);
  }

  private toApiDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private numericPrice(f: FlightOfferDto): number | null {
    const raw = (f.totalAmount || '').trim();
    if (!raw) {
      return null;
    }
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  private readRecentSearches(): string[] {
    try {
      const raw = localStorage.getItem(this.recentStorageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((v) => typeof v === 'string').slice(0, 6);
    } catch {
      return [];
    }
  }

  private pushRecentSearch(entry: string): void {
    const next = [entry, ...this.recentSearches.filter((x) => x !== entry)].slice(0, 6);
    this.recentSearches = next;
    try {
      localStorage.setItem(this.recentStorageKey, JSON.stringify(next));
    } catch {
      // Ignore storage write errors (private mode/quota).
    }
  }

  quickSearchFromRecent(entry: string): void {
    const [type, route] = entry.split(':');
    if (!route || (type !== 'internal' && type !== 'external')) {
      return;
    }

    const [from, to] = route.split('-');
    this.flightType = type;
    this.selectedFrom = this.normalizeIata(from);
    this.selectedTo = this.normalizeIata(to || this.selectedTo);

    this.searchFlights(
      {
        flightType: this.flightType,
        from: this.selectedFrom,
        to: this.selectedTo,
        date: this.selectedDate,
      },
      this.flightType,
    );
  }

  bookNowFromList(flight: FlightOfferDto): void {
    const payload = this.buildBookingPayload(flight);

    this.flightApi.bookFlight(payload).subscribe({
      next: (res) => {
        if (!res.success) {
          this.bookingError = res.message || 'Booking failed.';
          this.bookingMessage = null;
          return;
        }
        this.bookingError = null;
        this.bookingMessage = `Booking confirmed: ${res.data?.bookingReference || res.data?.orderId || 'created'}`;
      },
      error: (err: unknown) => {
        const serverMessage = this.extractHttpErrorMessage(err);
        if ((err as HttpErrorResponse)?.status === 422) {
          this.bookingError = serverMessage || 'Booking failed (422): the offer may have expired. Please search flights again and retry.';
        } else {
          this.bookingError = serverMessage || 'Booking failed. Please try again.';
        }
        this.bookingMessage = null;
      },
    });
  }

  private buildBookingPayload(flight: FlightOfferDto): FlightBookingRequest {
    const currentUser = this.auth.currentUser();
    const givenName = this.cleanName(currentUser?.firstName, 'Guest');
    const familyName = this.cleanName(currentUser?.lastName, 'Traveler');
    const email = this.cleanEmail(currentUser?.email, 'guest@yallatn.com');

    return {
      offerId: flight.offerId,
      givenName,
      familyName,
      email,
      phoneNumber: this.normalizePhone(currentUser?.phone),
      bornOn: this.normalizeBirthDate(currentUser?.dateOfBirth),
    };
  }

  private extractHttpErrorMessage(err: unknown): string | null {
    if (!(err instanceof HttpErrorResponse)) {
      return null;
    }
    const body = err.error as { message?: string; code?: string } | null;
    if (body?.message && typeof body.message === 'string' && body.message.trim().length > 0) {
      return body.message.trim();
    }
    return null;
  }

  private cleanName(value: string | null | undefined, fallback: string): string {
    const cleaned = (value || '').trim().replace(/[^\p{L}\p{M}\s'\-]/gu, '');
    return cleaned.length > 0 ? cleaned : fallback;
  }

  private cleanEmail(value: string | null | undefined, fallback: string): string {
    const email = (value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : fallback;
  }

  private normalizePhone(value: string | null | undefined): string {
    const raw = (value || '').trim();
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.startsWith('+') && /^\+[1-9]\d{7,14}$/.test(digits)) {
      return digits;
    }
    const onlyDigits = digits.replace(/\D/g, '');
    if (onlyDigits.length >= 8 && onlyDigits.length <= 15) {
      return `+${onlyDigits}`;
    }
    return '+21620111222';
  }

  private normalizeBirthDate(value: string | null | undefined): string {
    const raw = (value || '').trim();
    const date = raw.length >= 10 ? raw.slice(0, 10) : raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return '1990-01-01';
  }
}
