import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { SliderModule } from 'primeng/slider';
import { AppAlertsService } from '../../../core/services/app-alerts.service';

interface AdminApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string;
}

interface Transport {
  transportId: number;
  type: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  price: number;
  description: string;
  isActive: boolean;
  departureCityId: number;
  departureCityName?: string;
  arrivalCityId: number;
  arrivalCityName?: string;
  operatorName?: string;
  flightCode?: string;
  availableSeats: number;
  bookedSeats: number;
}

interface City {
  cityId: number;
  name: string;
  region: string;
  hasAirport?: boolean;
  hasBusStation?: boolean;
}

interface TransportStats {
  totalTransports: number;
  activeTransports: number;
  totalAvailableSeats: number;
  todayReservations: number;
}

interface TransportReservation {
  transportReservationId: number;
  reservationRef: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPrice: number;
  numberOfSeats: number;
  travelDate: string;
  passengerFirstName: string;
  passengerLastName: string;
  passengerEmail: string;
  passengerPhone: string;
  createdAt: string;
}

@Component({
  selector: 'app-transports-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    DialogModule, ButtonModule, InputTextModule,
    DropdownModule, InputNumberModule, SliderModule,
  ],
  templateUrl: './transports-admin.component.html',
  styleUrl: './transports-admin.component.css'
})
export class TransportsAdminComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private alerts = inject(AppAlertsService);

  readonly PAGE_SIZE = 7;

  transports = signal<Transport[]>([]);
  cities     = signal<City[]>([]);
  reservations = signal<TransportReservation[]>([]);
  stats = signal<TransportStats | null>(null);

  selectedTransport = signal<Transport | null>(null);

  isLoading = signal(false);
  showTransportDialog   = false;
  showReservationsDialog = false;

  showAirlineField  = false;
  calculatedDuration: string | null = null;
  durationWarning: string | null = null;
  priceWarning: string | null = null;

  transportSearch  = signal('');
  filterTypeValue  = signal('');

  transportPageSig = signal(1);

  get transportPage() { return this.transportPageSig(); }
  set transportPage(v: number) { this.transportPageSig.set(v); }

  /** Admin UI: only these four modes; legacy DB rows may still use other enum values. */
  transportTypes: { label: string; value: string; icon: string }[] = [
    { label: 'Flight', value: 'PLANE', icon: 'pi pi-send' },
    { label: 'Car', value: 'CAR', icon: 'pi pi-car' },
    { label: 'Bus', value: 'BUS', icon: 'pi pi-car' },
    { label: 'Taxi', value: 'TAXI', icon: 'pi pi-map-marker' },
  ];

  airlines = [
    { label: 'Tunisair',        value: 'Tunisair' },
    { label: 'Nouvelair',       value: 'Nouvelair' },
    { label: 'Tunisair Express', value: 'Tunisair Express' },
    { label: 'Transavia',       value: 'Transavia' },
    { label: 'Air Arabia',      value: 'Air Arabia' },
  ];

  transportForm: FormGroup;

  totalTransportsCount  = computed(() => this.stats()?.totalTransports  ?? this.transports().length);
  activeTransportCount  = computed(() => this.stats()?.activeTransports  ?? this.transports().filter(t => t.isActive).length);
  totalAvailableSeats   = computed(() => this.stats()?.totalAvailableSeats ?? 0);
  todayReservationsCount = computed(() => this.stats()?.todayReservations ?? 0);

  filteredTransports = computed(() => {
    const q    = this.transportSearch().toLowerCase().trim();
    const type = this.filterTypeValue();
    return this.transports().filter(t => {
      const matchType = !type || t.type === type;
      if (!q) return matchType;
      const haystack = [
        t.type, this.getTypeLabel(t.type),
        t.departureCityName ?? '', t.arrivalCityName ?? '',
        t.operatorName ?? '', t.flightCode ?? '',
        String(t.price), t.isActive ? 'active' : 'inactive',
        t.departureTime, t.arrivalTime,
        String(t.capacity), String(t.availableSeats ?? ''),
      ].join(' ').toLowerCase();
      return matchType && haystack.includes(q);
    });
  });

  pagedTransports = computed(() => {
    const start = (this.transportPageSig() - 1) * this.PAGE_SIZE;
    return this.filteredTransports().slice(start, start + this.PAGE_SIZE);
  });

  totalTransportPages = computed(() => Math.max(1, Math.ceil(this.filteredTransports().length / this.PAGE_SIZE)));

  constructor() {
    this.transportForm = this.fb.group({
      type:            ['PLANE', Validators.required],
      departureCityId: [null, Validators.required],
      arrivalCityId:   [null, Validators.required],
      departureTime:   ['', Validators.required],
      arrivalTime:     ['', Validators.required],
      capacity:        [null, [Validators.required, Validators.min(1)]],
      price:           [0, [Validators.required, Validators.min(0)]],
      description:     [''],
      operatorName:    [null],
      flightCode:      [null],
      isActive:        [true],
    });

    this.loadAll();
  }

  loadAll() {
    this.loadCities();
    this.loadTransports();
    this.loadStats();
  }

  loadStats() {
    this.http.get<any>('/api/admin/transports/stats')
      .pipe(catchError(() => of(null)))
      .subscribe(r => { if (r?.data) this.stats.set(r.data); });
  }

  loadCities() {
    this.http
      .get<unknown>('/api/cities')
      .pipe(catchError(() => of(null)))
      .subscribe((r) => this.cities.set(this.normalizeCityListPayload(r)));
  }

  private normalizeCityListPayload(payload: unknown): City[] {
    if (payload == null) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload as City[];
    }
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
      const data = (payload as { data?: unknown }).data;
      if (Array.isArray(data)) {
        return data as City[];
      }
    }
    return [];
  }

  /** Business caps: taxi/car 4, bus 45, plane 100. */
  private seatCapacityMaxForType(type: string | null | undefined): number {
    switch (type) {
      case 'TAXI':
      case 'CAR':
        return 4;
      case 'BUS':
        return 45;
      case 'PLANE':
        return 100;
      default:
        return 100;
    }
  }

  capacitySliderMax(): number {
    return this.seatCapacityMaxForType(this.transportForm.get('type')?.value);
  }

  loadTransports() {
    this.isLoading.set(true);
    this.http.get<any>('/api/admin/transports')
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(r => {
        this.transports.set(r?.data ?? []);
        this.isLoading.set(false);
        this.transportPageSig.set(1);
      });
  }

  loadReservations(transportId: number) {
    this.http.get<any>(`/api/admin/transports/${transportId}/reservations`)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(r => this.reservations.set(r?.data ?? []));
  }

  clearTransportSearch() {
    this.transportSearch.set('');
    this.filterTypeValue.set('');
    this.transportPageSig.set(1);
  }

  onTransportSearch(v: string) { this.transportSearch.set(v); this.transportPageSig.set(1); }
  onTypeFilter(v: string)      { this.filterTypeValue.set(v); this.transportPageSig.set(1); }

  getTransportPageNumbers() { return this.buildPageArray(this.transportPage, this.totalTransportPages()); }

  private buildPageArray(current: number, total: number): number[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== -1) {
        pages.push(-1);
      }
    }
    return pages;
  }

  private applyTransportTypeValidators(type: string, clearIncompatibleFields: boolean): void {
    this.showAirlineField = type === 'PLANE';

    if (clearIncompatibleFields) {
      this.durationWarning = null;
    }

    const cap = this.transportForm.get('capacity')!;
    const op = this.transportForm.get('operatorName')!;
    const maxSeats = this.seatCapacityMaxForType(type);

    if (type === 'PLANE') {
      if (clearIncompatibleFields) {
        op.reset();
      }
      op.setValidators([Validators.required]);
      cap.setValidators([Validators.required, Validators.min(1), Validators.max(maxSeats)]);
    } else {
      if (clearIncompatibleFields) {
        this.transportForm.get('operatorName')!.reset();
        this.transportForm.get('flightCode')!.reset();
      }
      op.clearValidators();
      cap.setValidators([Validators.required, Validators.min(1), Validators.max(maxSeats)]);
    }

    const cur = cap.value;
    if (cur != null && Number(cur) > maxSeats) {
      cap.setValue(maxSeats, { emitEvent: false });
    }

    op.updateValueAndValidity();
    cap.updateValueAndValidity();
  }

  onTypeChange(event: { value?: string } | string) {
    const type = typeof event === 'string' ? event : (event?.value ?? '');
    this.applyTransportTypeValidators(type, true);
  }

  selectTransportType(value: string): void {
    this.transportForm.patchValue({ type: value });
    this.applyTransportTypeValidators(value, true);
  }

  fieldInvalid(name: string): boolean {
    const c = this.transportForm.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  fieldValid(name: string): boolean {
    const c = this.transportForm.get(name);
    if (!c || !c.valid || !(c.dirty || c.touched)) return false;
    const v = c.value;
    return v != null && v !== '';
  }

  resizeDescription(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), 220)}px`;
  }

  onTimeChange() {
    const dep = this.transportForm.get('departureTime')!.value;
    const arr = this.transportForm.get('arrivalTime')!.value;
    if (dep && arr) {
      const diffMs  = new Date(arr).getTime() - new Date(dep).getTime();
      if (diffMs <= 0) { this.calculatedDuration = null; return; }
      const diffH   = Math.floor(diffMs / 3600000);
      const diffMin = Math.floor((diffMs % 3600000) / 60000);
      this.calculatedDuration = diffH > 0
        ? `${diffH}h${diffMin > 0 ? ' ' + diffMin + 'm' : ''}`
        : `${diffMin} min`;
      this.checkDurationWarning(diffH);
    }
  }

  checkDurationWarning(hours: number) {
    const MAX: Record<string, number> = { PLANE: 3, TAXI: 8, CAR: 12, VAN: 8, BUS: 12, TRAIN: 12, FERRY: 24 };
    const type = this.transportForm.get('type')!.value;
    const max = MAX[type];
    if (type && max && hours > max) {
      this.durationWarning = `Unusually long duration for a ${type} (recommended max ${max}h)`;
    } else {
      this.durationWarning = null;
    }
  }

  onPriceChange(value: number | null | string) {
    if (value == null) { this.priceWarning = null; return; }
    const v = typeof value === 'string' ? parseFloat(value) : value;
    const MAX: Record<string, number> = { PLANE: 400, TAXI: 300, CAR: 500, VAN: 400, BUS: 80, TRAIN: 100, FERRY: 200 };
    const type = this.transportForm.get('type')!.value;
    const max = MAX[type];
    if (type && max && v > max) {
      this.priceWarning = `High price for a ${type} (recommended max: ${max} TND)`;
    } else {
      this.priceWarning = null;
    }
  }

  getSeatClass(t: Transport): string {
    const avail = t.availableSeats ?? 0;
    const cap   = t.capacity ?? 1;
    if (avail === 0) return 'seats-full';
    if (avail / cap <= 0.2) return 'seats-low';
    return 'seats-available';
  }

  openTransportDialog(transport?: Transport) {
    this.calculatedDuration = null;
    this.durationWarning = null;
    this.priceWarning = null;

    if (transport) {
      this.selectedTransport.set(transport);
      const type = transport.type;
      this.showAirlineField = type === 'PLANE';

      this.transportForm.patchValue({
        ...transport,
        departureTime: this.toDateTimeLocal(transport.departureTime),
        arrivalTime:   this.toDateTimeLocal(transport.arrivalTime),
      });
      this.applyTransportTypeValidators(type, false);
    } else {
      this.selectedTransport.set(null);
      this.showAirlineField = false;
      this.transportForm.reset({ type: 'BUS', price: 0, capacity: 45, isActive: true });
      this.applyTransportTypeValidators('BUS', false);
    }
    this.showTransportDialog = true;
  }

  saveTransport() {
    if (this.transportForm.invalid) { this.transportForm.markAllAsTouched(); return; }

    const raw = this.transportForm.getRawValue();
    const type = String(raw.type ?? '');
    const fromCity = this.cities().find(c => c.cityId === raw.departureCityId)?.name ?? '';
    const toCity   = this.cities().find(c => c.cityId === raw.arrivalCityId)?.name ?? '';
    const id = this.selectedTransport()?.transportId;

    const departureTime = this.toBackendLocalDateTime(raw.departureTime);
    const arrivalTime = this.toBackendLocalDateTime(raw.arrivalTime);
    if (!departureTime || !arrivalTime) {
      void this.alerts.warning('Validation', 'Departure and arrival times are required.');
      return;
    }

    const priceNum = Number(raw.price ?? 0);
    const price = Number.isFinite(priceNum) ? priceNum : 0;

    const op = raw.operatorName != null ? String(raw.operatorName).trim() : '';
    const fc = raw.flightCode != null ? String(raw.flightCode).trim() : '';

    const payload = {
      type,
      departureCityId: raw.departureCityId != null ? Number(raw.departureCityId) : null,
      arrivalCityId: raw.arrivalCityId != null ? Number(raw.arrivalCityId) : null,
      departureTime,
      arrivalTime,
      capacity: raw.capacity != null ? Number(raw.capacity) : null,
      price,
      description: (raw.description ?? '').toString(),
      isActive: raw.isActive !== false,
      operatorName: type === 'PLANE' ? (op || null) : null,
      flightCode: type === 'PLANE' ? (fc || null) : null,
    };

    const req = id
      ? this.http.put<any>(`/api/admin/transports/${id}`, payload)
      : this.http.post<any>('/api/admin/transports', payload);

    req.subscribe({
      next: () => {
        this.loadTransports();
        this.loadStats();
        this.showTransportDialog = false;
        void this.alerts.success(
          id ? 'Transport updated' : 'Transport created',
          id
            ? `Route ${fromCity} → ${toCity} was updated successfully.`
            : `New route ${fromCity} → ${toCity} was created successfully.`,
        );
      },
      error: (err) => {
        const msg = this.friendlyApiMessage(err, 'Could not complete this operation.');
        void this.alerts.warning('Validation', msg);
      },
    });
  }

  deleteTransport(transport: Transport) {
    void this.alerts
      .confirm({
        title: 'Confirm deletion',
        text: `Delete ${this.getTypeLabel(transport.type)} — ${transport.departureCityName} → ${transport.arrivalCityName}? If there are no linked bookings it will be removed; otherwise it will be deactivated only.`,
        confirmText: 'Yes, delete',
        cancelText: 'Cancel',
        icon: 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http.delete(`/api/admin/transports/${transport.transportId}`, { observe: 'response' }).subscribe({
          next: (res) => {
            this.loadTransports();
            this.loadStats();
            if (res.status === 204) {
              void this.alerts.success(
                'Transport removed',
                `Route ${transport.departureCityName} → ${transport.arrivalCityName} was deleted.`,
              );
            } else {
              const body = res.body as AdminApiEnvelope<null> | null;
              const msg = body?.message;
              if (msg && msg !== 'OK') {
                void this.alerts.info('Transport deactivated', msg);
              } else {
                void this.alerts.success(
                  'Transport removed',
                  `Route ${transport.departureCityName} → ${transport.arrivalCityName} was deleted.`,
                );
              }
            }
          },
          error: (err) => {
            const msg = this.friendlyApiMessage(err, 'Deletion failed.');
            void this.alerts.error('Could not delete', msg);
          },
        });
      });
  }

  toggleTransportStatus(transport: Transport) {
    const willActivate = !transport.isActive;
    void this.alerts
      .confirm({
        title: willActivate ? 'Activate transport' : 'Deactivate transport',
        text: willActivate
          ? `Activate route ${transport.departureCityName} → ${transport.arrivalCityName}?`
          : `Deactivate route ${transport.departureCityName} → ${transport.arrivalCityName}? New bookings will be blocked.`,
        confirmText: willActivate ? 'Yes, activate' : 'Yes, deactivate',
        cancelText: 'Cancel',
        icon: willActivate ? 'question' : 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http
          .patch<AdminApiEnvelope<unknown>>(`/api/admin/transports/${transport.transportId}/status`, { isActive: willActivate })
          .subscribe({
            next: () => {
              this.loadTransports();
              this.loadStats();
              void this.alerts.success(
                willActivate ? 'Transport activated' : 'Transport deactivated',
                `Route ${transport.departureCityName} → ${transport.arrivalCityName} is now ${willActivate ? 'active' : 'inactive'}.`,
              );
            },
            error: (err) => {
              const msg = this.friendlyApiMessage(err, 'Could not change status.');
              void this.alerts.error('Error', msg);
            },
          });
      });
  }

  viewReservations(transport: Transport) {
    this.selectedTransport.set(transport);
    this.loadReservations(transport.transportId);
    this.showReservationsDialog = true;
  }

  confirmReservation(res: TransportReservation) {
    void this.alerts
      .confirm({
        title: 'Confirm booking',
        text: `Confirm ${res.reservationRef} for ${res.passengerFirstName} ${res.passengerLastName} — ${res.numberOfSeats} seat(s)?`,
        confirmText: 'Yes, confirm',
        cancelText: 'Cancel',
        icon: 'question',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http.patch<AdminApiEnvelope<unknown>>(`/api/admin/transport-reservations/${res.transportReservationId}/confirm`, {}).subscribe({
          next: () => {
            if (this.selectedTransport()) this.loadReservations(this.selectedTransport()!.transportId);
            void this.alerts.success(
              'Booking confirmed',
              `${res.reservationRef} — ${res.passengerFirstName} ${res.passengerLastName}`,
            );
          },
          error: (err) => {
            const msg = this.friendlyApiMessage(err, 'Could not confirm this booking.');
            void this.alerts.error('Error', msg);
          },
        });
      });
  }

  cancelReservation(res: TransportReservation) {
    void this.alerts
      .confirm({
        title: 'Cancel booking',
        text: `Cancel ${res.reservationRef} for ${res.passengerFirstName} ${res.passengerLastName}?`,
        confirmText: 'Yes, cancel',
        cancelText: 'Keep',
        icon: 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http
          .patch<AdminApiEnvelope<unknown>>(`/api/admin/transport-reservations/${res.transportReservationId}/cancel`, { reason: 'Admin' })
          .subscribe({
            next: () => {
              if (this.selectedTransport()) this.loadReservations(this.selectedTransport()!.transportId);
              void this.alerts.success('Booking cancelled', `${res.reservationRef} was cancelled.`);
            },
            error: (err) => {
              const msg = this.friendlyApiMessage(err, 'Could not cancel this booking.');
              void this.alerts.error('Error', msg);
            },
          });
      });
  }

  tPageEnd()  { return Math.min(this.transportPageSig() * this.PAGE_SIZE, this.filteredTransports().length); }

  getTypeLabel(type: string): string {
    const hit = this.transportTypes.find((t) => t.value === type)?.label;
    if (hit) return hit;
    const legacy: Record<string, string> = {
      VAN: 'Van',
      TRAIN: 'Train',
      FERRY: 'Ferry',
    };
    return legacy[type] ?? type;
  }

  private toDateTimeLocal(dt: string): string {
    if (!dt) return '';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private toBackendLocalDateTime(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    const v = String(value).trim();
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00`;
    return v;
  }

  private friendlyApiMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { message?: string } })?.error;
    const m = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!m) return fallback;
    const lower = m.toLowerCase();
    if (lower.includes('could not execute statement') || lower.includes('foreign key')) {
      return 'This action is blocked because related bookings or other records still exist.';
    }
    if (lower.startsWith('unexpected server error')) {
      return 'Something went wrong on the server. Please try again.';
    }
    return m;
  }
}
