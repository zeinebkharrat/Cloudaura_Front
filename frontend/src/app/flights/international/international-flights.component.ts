import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { FlightOfferDto } from '../../features/flights/flight.models';
import { FlightService } from '../../features/flights/flight.service';
import { FlightListComponent } from '../../features/flights/flight-list.component';
import { TripContextStore } from '../../core/stores/trip-context.store';
import { Transport } from '../../core/models/travel.models';

interface TunisianAirportOption {
  label: string;
  value: string;
}

type ExternalSearchPayload = {
  dep: string;
  arr: string;
  date: string;
  adults: number;
  type: 'external';
  cabinClass: 'economy';
  limit: number;
};

@Component({
  selector: 'app-international-flights',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    SelectModule,
    FlightListComponent,
  ],
  templateUrl: './international-flights.component.html',
  styleUrl: './international-flights.component.scss',
})
export class InternationalFlightsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flightApi = inject(FlightService);
  private readonly store = inject(TripContextStore);

  readonly today: Date;
  readonly tunisianAirports: TunisianAirportOption[] = [
    { value: 'TUN', label: 'TUN - Tunis-Carthage' },
    { value: 'DJE', label: 'DJE - Djerba-Zarzis' },
    { value: 'SFA', label: 'SFA - Sfax-Thyna' },
    { value: 'MIR', label: 'MIR - Monastir' },
    { value: 'NBE', label: 'NBE - Enfidha-Hammamet' },
    { value: 'TOE', label: 'TOE - Tozeur' },
    { value: 'GAF', label: 'GAF - Gafsa' },
  ];

  readonly form = this.fb.group({
    origin: ['', Validators.required],
    destination: ['TUN', Validators.required],
    departureDate: [new Date(), Validators.required],
    passengers: [1, [Validators.required, Validators.min(1), Validators.max(9)]],
  });

  loading = false;
  hasSearched = false;
  submitError: string | null = null;
  lastResults: FlightOfferDto[] = [];
  selected: FlightOfferDto | null = null;
  private readonly subs = new Subscription();

  constructor() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    this.today = d;
  }

  ngOnInit(): void {
    const to = (this.route.snapshot.queryParamMap.get('to') || '').trim().toUpperCase();
    if (this.tunisianAirports.some((a) => a.value === to)) {
      this.form.patchValue({ destination: to });
    }

    this.setupDynamicSearch();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildSearchPayload();
    if (!payload) {
      return;
    }

    this.runSearch(payload);
  }

  private setupDynamicSearch(): void {
    const sub = this.form.valueChanges.pipe(
      debounceTime(550),
      map(() => this.buildSearchPayload()),
      filter((payload): payload is ExternalSearchPayload => !!payload),
      distinctUntilChanged((a, b) => this.payloadKey(a) === this.payloadKey(b)),
      tap(() => {
        this.loading = true;
        this.hasSearched = false;
        this.submitError = null;
      }),
      switchMap((payload) => this.flightApi.searchFlights(payload).pipe(
        map((res) => ({ res, failed: false })),
        catchError(() => of({ res: null, failed: true }))
      )),
    ).subscribe(({ res, failed }) => {
      this.loading = false;
      this.hasSearched = true;

      if (failed || !res?.success) {
        this.lastResults = [];
        this.submitError = 'Unable to load international flights. Please try again.';
        return;
      }

      this.lastResults = res.data ?? [];
      this.submitError = null;
    });

    this.subs.add(sub);
  }

  private runSearch(payload: ExternalSearchPayload): void {
    this.loading = true;
    this.hasSearched = false;
    this.submitError = null;

    this.flightApi
      .searchFlights(payload)
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.hasSearched = true;
          if (!res.success) {
            this.lastResults = [];
            this.submitError = 'Unable to load international flights. Please try again.';
            return;
          }
          this.lastResults = res.data ?? [];
        },
        error: () => {
          this.loading = false;
          this.hasSearched = true;
          this.lastResults = [];
          this.submitError = 'Unable to load international flights. Please try again.';
        },
      });
  }

  private buildSearchPayload(): ExternalSearchPayload | null {
    const { origin, destination, departureDate, passengers } = this.form.getRawValue();
    if (!origin || !destination || !departureDate || !passengers || this.form.invalid) {
      return null;
    }

    return {
      dep: origin.trim().toUpperCase(),
      arr: destination,
      date: departureDate.toISOString().slice(0, 10),
      adults: passengers,
      type: 'external',
      cabinClass: 'economy',
      limit: 25,
    };
  }

  private payloadKey(payload: ExternalSearchPayload): string {
    return `${payload.dep}|${payload.arr}|${payload.date}|${payload.adults}`;
  }

  onSelectFlight(f: FlightOfferDto): void {
    this.selected = f;
  }

  onBookFlight(f: FlightOfferDto): void {
    if (!f.transportId) {
      this.submitError = 'Offer is not bookable.';
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

  get cheapestOfferId(): string | null {
    let cheapest: FlightOfferDto | null = null;
    for (const f of this.lastResults) {
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

  get listEmptyMessage(): string {
    if (!this.hasSearched || this.loading || this.submitError) {
      return '';
    }
    return 'No flights found.';
  }

  get idleHint(): string {
    return 'Pick route and date, then search flights.';
  }

  private numericPrice(f: FlightOfferDto): number | null {
    const raw = (f.totalAmount || '').trim();
    if (!raw) {
      return null;
    }
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  hasError(field: 'origin' | 'destination' | 'departureDate' | 'passengers'): boolean {
    const ctrl = this.form.controls[field];
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }
}
