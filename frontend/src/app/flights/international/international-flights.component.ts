import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RippleModule } from 'primeng/ripple';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { Transport } from '../../core/models/travel.models';
import { CurrencyService } from '../../core/services/currency.service';
import { TripContextStore } from '../../core/stores/trip-context.store';
import {
  effectivePriceTnd,
  estimateDurationMinutes,
  filterBookableFlights,
  parseFlightOffer,
  pricePerSeatForBooking,
} from '../../features/flights/flight-display.util';
import { FlightDto } from '../../features/flights/flight.models';
import { FlightService } from '../../features/flights/flight.service';
import { FlightListComponent } from '../../features/flights/flight-list.component';
import { InternationalFlightLiveMapComponent } from './international-flight-live-map.component';

interface TunisianAirportOption {
  label: string;
  value: string;
}

type ExternalSearchPayload = {
  dep: string;
  arr: string;
};

@Component({
  selector: 'app-international-flights',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RippleModule,
    DatePickerModule,
    InputNumberModule,
    FlightListComponent,
    InternationalFlightLiveMapComponent,
  ],
  templateUrl: './international-flights.component.html',
  styleUrls: ['./international-flights.component.scss', '../../features/flights/live-flights-page.shared.css'],
})
export class InternationalFlightsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flightApi = inject(FlightService);
  private readonly tripStore = inject(TripContextStore);
  private readonly currency = inject(CurrencyService);

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

  private static readonly IATA = /^[A-Za-z]{3,4}$/;

  readonly form = this.fb.group({
    origin: ['', [Validators.required, Validators.pattern(InternationalFlightsComponent.IATA)]],
    destination: [
      'TUN',
      [Validators.required, Validators.pattern(InternationalFlightsComponent.IATA)],
    ],
    departureDate: [new Date(), Validators.required],
    passengers: [1, [Validators.required, Validators.min(1), Validators.max(9)]],
  });

  sortMode: 'best' | 'duration' | 'depart' = 'best';

  loading = false;
  hasSearched = false;
  submitError: string | null = null;
  /** Raw API rows before hiding past/completed flights (for empty-state messaging). */
  private lastRawResults: FlightDto[] = [];
  lastResults: FlightDto[] = [];
  selected: FlightDto | null = null;

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

    const originQ = (this.route.snapshot.queryParamMap.get('origin') || '').trim();
    if (originQ) {
      this.form.patchValue({ origin: originQ.toUpperCase() });
    }

    const dateQ = this.route.snapshot.queryParamMap.get('date');
    if (dateQ) {
      const d = new Date(dateQ);
      if (!Number.isNaN(d.getTime())) {
        this.form.patchValue({ departureDate: d });
      }
    }

    const paxQ = Number.parseInt(this.route.snapshot.queryParamMap.get('passengers') ?? '', 10);
    if (Number.isFinite(paxQ) && paxQ >= 1 && paxQ <= 9) {
      this.form.patchValue({ passengers: paxQ });
    }

    const initial = this.buildSearchPayload();
    if (initial) {
      this.runSearch(initial);
    }
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

  private runSearch(payload: ExternalSearchPayload): void {
    this.loading = true;
    this.hasSearched = false;
    this.submitError = null;

    this.flightApi.searchByRoute(payload.dep, payload.arr, 25).subscribe({
      next: (res) => {
        this.loading = false;
        this.hasSearched = true;
        if (!res.success) {
          this.lastRawResults = [];
          this.lastResults = [];
          this.selected = null;
          this.submitError = 'Unable to load international flights. Please try again.';
          return;
        }
        const raw = res.data ?? [];
        this.lastRawResults = raw;
        this.lastResults = filterBookableFlights(raw);
        this.selected = this.displayedFlights[0] ?? null;
      },
      error: () => {
        this.loading = false;
        this.hasSearched = true;
        this.lastRawResults = [];
        this.lastResults = [];
        this.selected = null;
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
      dep: origin.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4),
      arr: destination.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4),
    };
  }

  get travelDateForMap(): Date | null {
    const v = this.form.get('departureDate')?.value;
    return v instanceof Date && !Number.isNaN(v.getTime()) ? v : null;
  }

  get displayedFlights(): FlightDto[] {
    const rows = [...this.lastResults];
    if (this.sortMode === 'best') {
      rows.sort((a, b) => effectivePriceTnd(a, this.currency) - effectivePriceTnd(b, this.currency));
    } else if (this.sortMode === 'duration') {
      rows.sort((a, b) => estimateDurationMinutes(a) - estimateDurationMinutes(b));
    } else {
      rows.sort((a, b) => (Date.parse(a.departureTime || '') || 0) - (Date.parse(b.departureTime || '') || 0));
    }
    return rows;
  }

  setSort(mode: 'best' | 'duration' | 'depart'): void {
    this.sortMode = mode;
  }

  swapAirports(): void {
    const o = this.form.get('origin')?.value;
    const d = this.form.get('destination')?.value;
    this.form.patchValue({ origin: d, destination: o });
  }

  onSelectFlight(f: FlightDto): void {
    this.selected = f;
  }

  /**
   * Same pipeline as `/transport/flights`: synthetic plane → {@link TripContextStore} → `/transport/:id/book`
   * (Stripe / PayPal / cash with passenger form prefilled from account when logged in).
   */
  onBookFlight(f: FlightDto): void {
    const originFb =
      (this.form.get('origin')?.value ?? '').toString().trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) ||
      'CDG';
    const destFb = (this.form.get('destination')?.value ?? 'TUN').toString().trim().toUpperCase();
    const seats = Math.min(9, Math.max(1, Number(this.form.get('passengers')?.value) || 1));

    const syntheticId = -(Math.abs(this.hashCode(`${f.flightNumber}|${f.departureTime}|${f.arrivalTime}`)) + 1);
    const durationMinutes = estimateDurationMinutes(f);
    const pricePerSeat = pricePerSeatForBooking(f, seats, this.currency);

    const normIata = (code: string | null | undefined, fallback: string): string => {
      const raw = (code ?? fallback).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (raw.length >= 3) {
        return raw;
      }
      const fb = fallback.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      return fb.length >= 3 ? fb : 'TUN';
    };

    const depIata = normIata(f.departureIata, originFb);
    const arrIata = normIata(f.arrivalIata, destFb);
    const travelIso = this.resolveTravelIsoForFlight(f);

    const quote = parseFlightOffer(f);
    const selectedTransport: Transport = {
      id: syntheticId,
      type: 'PLANE',
      departureCityId: 0,
      arrivalCityId: 0,
      departureCityName: f.departureAirport || depIata,
      arrivalCityName: f.arrivalAirport || arrIata,
      departureTime: f.departureTime || travelIso,
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
    this.tripStore.setPassengers(seats);
    this.tripStore.setDates({ travelDate: travelIso });

    const dateParam = travelIso.includes('T') ? travelIso : `${travelIso.slice(0, 10)}T12:00:00`;

    void this.router.navigate(['/transport', selectedTransport.id, 'book'], {
      queryParams: {
        transportType: 'PLANE',
        passengers: seats,
        date: dateParam,
      },
    });
  }

  private resolveTravelIsoForFlight(f: FlightDto): string {
    if (f.departureTime?.includes('T')) {
      const d = new Date(f.departureTime);
      if (!Number.isNaN(d.getTime())) {
        return this.toLocalDateTimeIso(d);
      }
    }
    const pick = this.form.get('departureDate')?.value as Date | null;
    if (pick && !Number.isNaN(pick.getTime())) {
      const base = new Date(pick);
      let h = 12;
      let m = 0;
      if (f.departureTime) {
        const dt = new Date(f.departureTime);
        if (!Number.isNaN(dt.getTime())) {
          h = dt.getHours();
          m = dt.getMinutes();
        }
      }
      base.setHours(h, m, 0, 0);
      return this.toLocalDateTimeIso(base);
    }
    return this.toLocalDateTimeIso(new Date());
  }

  private toLocalDateTimeIso(d: Date): string {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}:${s}`;
  }

  private hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
    }
    return hash;
  }

  get listEmptyMessage(): string {
    if (!this.hasSearched || this.loading || this.submitError) {
      return '';
    }
    if (this.lastResults.length === 0 && this.lastRawResults.length > 0) {
      return 'No upcoming flights — completed or past departures are hidden.';
    }
    return 'No flights found.';
  }

  get idleHint(): string {
    return 'Enter IATA codes and search.';
  }

  hasError(field: 'origin' | 'destination' | 'departureDate' | 'passengers'): boolean {
    const ctrl = this.form.controls[field];
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }
}
