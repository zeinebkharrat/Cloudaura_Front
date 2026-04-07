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
import { TabViewModule } from 'primeng/tabview';
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
  vehicleId?: number;
  vehicleInfo?: string;
  vehicleCapacity?: number;
  driverId?: number;
  driverName?: string;
  operatorName?: string;
  flightCode?: string;
  availableSeats: number;
  bookedSeats: number;
}

interface Vehicle {
  vehicleId: number;
  brand: string;
  model: string;
  type: string;
  capacity: number;
  plateNumber: string;
  pricePerTrip: number;
  color?: string;
  year?: number;
  isActive: boolean;
  displayLabel?: string;
}

interface Driver {
  driverId: number;
  firstName: string;
  lastName: string;
  fullName?: string;
  licenseNumber: string;
  phone?: string;
  email?: string;
  rating: number;
  totalTrips: number;
  isActive: boolean;
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
  totalVehicles: number;
  totalDrivers: number;
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
    DropdownModule, InputNumberModule, TabViewModule,
  ],
  templateUrl: './transports-admin.component.html',
  styleUrl: './transports-admin.component.css'
})
export class TransportsAdminComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private alerts = inject(AppAlertsService);

  readonly PAGE_SIZE = 7;

  activeTabIndex = 0;

  transports = signal<Transport[]>([]);
  vehicles   = signal<Vehicle[]>([]);
  drivers    = signal<Driver[]>([]);
  cities     = signal<City[]>([]);
  reservations = signal<TransportReservation[]>([]);
  stats = signal<TransportStats | null>(null);

  // Available (slot-based) lists for the form
  availableVehicles = signal<Vehicle[]>([]);
  availableDrivers  = signal<Driver[]>([]);

  selectedTransport = signal<Transport | null>(null);
  selectedVehicle   = signal<Vehicle | null>(null);
  selectedDriver    = signal<Driver | null>(null);

  isLoading = signal(false);
  showTransportDialog   = false;
  showVehicleDialog     = false;
  showDriverDialog      = false;
  showReservationsDialog = false;

  // Dynamic form flags
  showVehicleField  = true;
  showDriverField   = true;
  showAirlineField  = false;
  showCapacityField = false;
  selectedVehicleCapacity: number | null = null;
  calculatedDuration: string | null = null;
  durationWarning: string | null = null;
  priceWarning: string | null = null;

  // Search signals (reactive)
  transportSearch  = signal('');
  filterTypeValue  = signal('');
  vehicleSearch    = signal('');
  driverSearch     = signal('');

  // Pagination signals
  transportPageSig = signal(1);
  vehiclePageSig   = signal(1);
  driverPageSig    = signal(1);

  get transportPage() { return this.transportPageSig(); }
  set transportPage(v: number) { this.transportPageSig.set(v); }
  get vehiclePage()   { return this.vehiclePageSig(); }
  set vehiclePage(v: number)   { this.vehiclePageSig.set(v); }
  get driverPage()    { return this.driverPageSig(); }
  set driverPage(v: number)    { this.driverPageSig.set(v); }

  transportTypes = [
    { label: 'Bus',                 value: 'BUS'   },
    { label: 'Taxi',                value: 'TAXI'  },
    { label: 'Van / shared taxi',   value: 'VAN'   },
    { label: 'Car',                 value: 'CAR'   },
    { label: 'Plane',               value: 'PLANE' },
    { label: 'Train',               value: 'TRAIN' },
    { label: 'Ferry',               value: 'FERRY' },
  ];

  airlines = [
    { label: 'Tunisair',        value: 'Tunisair' },
    { label: 'Nouvelair',       value: 'Nouvelair' },
    { label: 'Tunisair Express', value: 'Tunisair Express' },
    { label: 'Transavia',       value: 'Transavia' },
    { label: 'Air Arabia',      value: 'Air Arabia' },
  ];

  vehicleTypes = [
    { label: 'Bus',    value: 'BUS'   },
    { label: 'Taxi',   value: 'TAXI'  },
    { label: 'Van',    value: 'VAN'   },
    { label: 'Car',    value: 'CAR'  },
    { label: 'Train',  value: 'TRAIN' },
    { label: 'Ferry',  value: 'FERRY' },
  ];

  transportForm: FormGroup;
  vehicleForm: FormGroup;
  driverForm: FormGroup;

  // ── Stats from API ──────────────────────────────────
  totalTransportsCount  = computed(() => this.stats()?.totalTransports  ?? this.transports().length);
  activeTransportCount  = computed(() => this.stats()?.activeTransports  ?? this.transports().filter(t => t.isActive).length);
  totalAvailableSeats   = computed(() => this.stats()?.totalAvailableSeats ?? 0);
  totalVehiclesCount    = computed(() => this.stats()?.totalVehicles    ?? this.vehicles().length);
  totalDriversCount     = computed(() => this.stats()?.totalDrivers     ?? this.drivers().length);
  todayReservationsCount = computed(() => this.stats()?.todayReservations ?? 0);

  // ── Filtered lists (all attributes, reactive) ─────────
  filteredTransports = computed(() => {
    const q    = this.transportSearch().toLowerCase().trim();
    const type = this.filterTypeValue();
    return this.transports().filter(t => {
      const matchType = !type || t.type === type;
      if (!q) return matchType;
      const haystack = [
        t.type, this.getTypeLabel(t.type),
        t.departureCityName ?? '', t.arrivalCityName ?? '',
        t.vehicleInfo ?? '', t.driverName ?? '',
        t.operatorName ?? '', t.flightCode ?? '',
        String(t.price), t.isActive ? 'active' : 'inactive',
        t.departureTime, t.arrivalTime,
        String(t.capacity), String(t.availableSeats ?? ''),
      ].join(' ').toLowerCase();
      return matchType && haystack.includes(q);
    });
  });

  filteredVehicles = computed(() => {
    const q = this.vehicleSearch().toLowerCase().trim();
    if (!q) return this.vehicles();
    return this.vehicles().filter(v => {
      const haystack = [
        v.brand, v.model, v.plateNumber, v.type,
        v.color ?? '', String(v.year ?? ''),
        String(v.pricePerTrip), String(v.capacity),
        v.isActive ? 'actif' : 'inactif',
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  });

  filteredDrivers = computed(() => {
    const q = this.driverSearch().toLowerCase().trim();
    if (!q) return this.drivers();
    return this.drivers().filter(d => {
      const haystack = [
        d.firstName, d.lastName, d.licenseNumber,
        d.phone ?? '', d.email ?? '',
        String(d.rating), String(d.totalTrips),
        d.isActive ? 'actif' : 'inactif',
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  });

  // ── Paged lists ────────────────────────────────────────
  pagedTransports = computed(() => {
    const start = (this.transportPageSig() - 1) * this.PAGE_SIZE;
    return this.filteredTransports().slice(start, start + this.PAGE_SIZE);
  });
  pagedVehicles = computed(() => {
    const start = (this.vehiclePageSig() - 1) * this.PAGE_SIZE;
    return this.filteredVehicles().slice(start, start + this.PAGE_SIZE);
  });
  pagedDrivers = computed(() => {
    const start = (this.driverPageSig() - 1) * this.PAGE_SIZE;
    return this.filteredDrivers().slice(start, start + this.PAGE_SIZE);
  });

  totalTransportPages = computed(() => Math.max(1, Math.ceil(this.filteredTransports().length / this.PAGE_SIZE)));
  totalVehiclePages   = computed(() => Math.max(1, Math.ceil(this.filteredVehicles().length  / this.PAGE_SIZE)));
  totalDriverPages    = computed(() => Math.max(1, Math.ceil(this.filteredDrivers().length   / this.PAGE_SIZE)));

  constructor() {
    this.transportForm = this.fb.group({
      type:            ['BUS', Validators.required],
      departureCityId: [null, Validators.required],
      arrivalCityId:   [null, Validators.required],
      departureTime:   ['', Validators.required],
      arrivalTime:     ['', Validators.required],
      capacity:        [null],
      price:           [0, [Validators.required, Validators.min(0)]],
      description:     [''],
      vehicleId:       [null, Validators.required],
      driverId:        [null, Validators.required],
      operatorName:    [null],
      flightCode:      [null],
      isActive:        [true],
    });

    this.vehicleForm = this.fb.group({
      brand:        ['', [Validators.required, Validators.minLength(2)]],
      model:        ['', [Validators.required, Validators.minLength(2)]],
      type:         ['BUS', Validators.required],
      capacity:     [1,  [Validators.required, Validators.min(1)]],
      plateNumber:  ['', Validators.required],
      pricePerTrip: [0,  [Validators.required, Validators.min(0)]],
      color:        ['', Validators.required],
      year:         [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2030)]],
      isActive:     [true],
    });

    this.driverForm = this.fb.group({
      firstName:     ['', [Validators.required, Validators.minLength(2)]],
      lastName:      ['', [Validators.required, Validators.minLength(2)]],
      licenseNumber: ['', Validators.required],
      phone:         [''],
      email:         ['', [Validators.required, Validators.email]],
      isActive:      [true],
    });

    this.loadAll();
  }

  loadAll() {
    this.loadCities();
    this.loadTransports();
    this.loadVehicles();
    this.loadDrivers();
    this.loadStats();
  }

  loadStats() {
    this.http.get<any>('/api/admin/transports/stats')
      .pipe(catchError(() => of(null)))
      .subscribe(r => { if (r?.data) this.stats.set(r.data); });
  }

  loadCities() {
    this.http.get<any>('/api/cities').pipe(catchError(() => of({ data: [] }))).subscribe(r => {
      this.cities.set(Array.isArray(r) ? r : r.data ?? []);
    });
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

  loadVehicles() {
    this.http.get<any>('/api/admin/vehicles').pipe(catchError(() => of({ data: [] }))).subscribe(r => {
      this.vehicles.set(r?.data ?? []);
      this.vehiclePageSig.set(1);
    });
  }

  loadDrivers() {
    this.http.get<any>('/api/admin/drivers').pipe(catchError(() => of({ data: [] }))).subscribe(r => {
      this.drivers.set(r?.data ?? []);
      this.driverPageSig.set(1);
    });
  }

  loadReservations(transportId: number) {
    this.http.get<any>(`/api/admin/transports/${transportId}/reservations`)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(r => this.reservations.set(r?.data ?? []));
  }

  loadAvailableVehicles() {
    const { type, departureTime, arrivalTime } = this.transportForm.value;
    if (!type || type === 'PLANE') { this.availableVehicles.set([]); return; }

    let url = `/api/admin/transports/available-vehicles?type=${type}`;
    if (departureTime && arrivalTime) {
      const d = this.toBackendLocalDateTime(departureTime);
      const a = this.toBackendLocalDateTime(arrivalTime);
      if (d && a) {
        url += `&departure=${encodeURIComponent(d)}`;
        url += `&arrival=${encodeURIComponent(a)}`;
      }
    }
    this.http.get<any>(url).pipe(catchError(() => of({ data: [] }))).subscribe(r => {
      this.availableVehicles.set(r?.data ?? []);
    });
  }

  loadAvailableDrivers() {
    const { type, departureTime, arrivalTime } = this.transportForm.value;
    if (!type || type === 'PLANE') { this.availableDrivers.set([]); return; }

    let url = `/api/admin/transports/available-drivers`;
    if (departureTime && arrivalTime) {
      const d = this.toBackendLocalDateTime(departureTime);
      const a = this.toBackendLocalDateTime(arrivalTime);
      if (d && a) {
        url += `?departure=${encodeURIComponent(d)}`;
        url += `&arrival=${encodeURIComponent(a)}`;
      }
    }
    this.http.get<any>(url).pipe(catchError(() => of({ data: [] }))).subscribe(r => {
      this.availableDrivers.set(r?.data ?? []);
    });
  }

  // ── Search helpers ────────────────────────────────────
  clearTransportSearch() {
    this.transportSearch.set('');
    this.filterTypeValue.set('');
    this.transportPageSig.set(1);
  }
  clearVehicleSearch() { this.vehicleSearch.set(''); this.vehiclePageSig.set(1); }
  clearDriverSearch()  { this.driverSearch.set('');  this.driverPageSig.set(1); }

  onTransportSearch(v: string) { this.transportSearch.set(v); this.transportPageSig.set(1); }
  onVehicleSearch(v: string)   { this.vehicleSearch.set(v);   this.vehiclePageSig.set(1);   }
  onDriverSearch(v: string)    { this.driverSearch.set(v);    this.driverPageSig.set(1);    }
  onTypeFilter(v: string)      { this.filterTypeValue.set(v); this.transportPageSig.set(1); }

  // ── Pagination helper ─────────────────────────────────
  getTransportPageNumbers() { return this.buildPageArray(this.transportPage, this.totalTransportPages()); }
  getVehiclePageNumbers()   { return this.buildPageArray(this.vehiclePage,   this.totalVehiclePages());   }
  getDriverPageNumbers()    { return this.buildPageArray(this.driverPage,    this.totalDriverPages());    }

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

  // ── Dynamic form logic ────────────────────────────────
  /**
   * Align validators and field visibility with transport type.
   * When the user changes type in the dropdown, clear incompatible fields.
   * When opening edit, pass clearIncompatibleFields=false so patchValue is kept.
   */
  private applyTransportTypeValidators(type: string, clearIncompatibleFields: boolean): void {
    this.showVehicleField  = type !== 'PLANE';
    this.showDriverField   = type !== 'PLANE';
    this.showAirlineField  = type === 'PLANE';
    this.showCapacityField = type === 'PLANE';

    if (clearIncompatibleFields) {
      this.selectedVehicleCapacity = null;
      this.durationWarning = null;
    }

    if (type === 'PLANE') {
      if (clearIncompatibleFields) {
        this.transportForm.get('vehicleId')!.reset();
        this.transportForm.get('driverId')!.reset();
      }
      this.transportForm.get('vehicleId')!.clearValidators();
      this.transportForm.get('driverId')!.clearValidators();
      this.transportForm.get('operatorName')!.setValidators([Validators.required]);
      this.transportForm.get('capacity')!.setValidators([Validators.required, Validators.min(1)]);
    } else {
      if (clearIncompatibleFields) {
        this.transportForm.get('operatorName')!.reset();
        this.transportForm.get('flightCode')!.reset();
      }
      this.transportForm.get('vehicleId')!.setValidators([Validators.required]);
      this.transportForm.get('driverId')!.setValidators([Validators.required]);
      this.transportForm.get('operatorName')!.clearValidators();
      this.transportForm.get('capacity')!.clearValidators();
    }
    this.transportForm.get('vehicleId')!.updateValueAndValidity();
    this.transportForm.get('driverId')!.updateValueAndValidity();
    this.transportForm.get('operatorName')!.updateValueAndValidity();
    this.transportForm.get('capacity')!.updateValueAndValidity();
  }

  onTypeChange(event: any) {
    const type = event?.value ?? event;
    this.applyTransportTypeValidators(type, true);
    this.loadAvailableVehicles();
    this.loadAvailableDrivers();
  }

  onVehicleChange(vehicleId: number) {
    const vehicle = this.availableVehicles().find(v => v.vehicleId === vehicleId)
                 ?? this.vehicles().find(v => v.vehicleId === vehicleId);
    if (vehicle) {
      this.selectedVehicleCapacity = vehicle.capacity;
    }
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
      this.loadAvailableVehicles();
      this.loadAvailableDrivers();
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

  // ── Seat color helper ─────────────────────────────────
  getSeatClass(t: Transport): string {
    const avail = t.availableSeats ?? 0;
    const cap   = t.capacity ?? 1;
    if (avail === 0) return 'seats-full';
    if (avail / cap <= 0.2) return 'seats-low';
    return 'seats-available';
  }

  getSeatLabel(t: Transport): string {
    const avail = t.availableSeats ?? 0;
    if (avail === 0) return 'FULL';
    return `${avail} / ${t.capacity}`;
  }

  // ── Transport CRUD ────────────────────────────────────
  openTransportDialog(transport?: Transport) {
    this.calculatedDuration = null;
    this.durationWarning = null;
    this.priceWarning = null;
    this.selectedVehicleCapacity = null;

    if (transport) {
      this.selectedTransport.set(transport);
      const type = transport.type;
      this.showVehicleField  = type !== 'PLANE';
      this.showDriverField   = type !== 'PLANE';
      this.showAirlineField  = type === 'PLANE';
      this.showCapacityField = type === 'PLANE';

      this.transportForm.patchValue({
        ...transport,
        departureTime: this.toDateTimeLocal(transport.departureTime),
        arrivalTime:   this.toDateTimeLocal(transport.arrivalTime),
      });
      this.applyTransportTypeValidators(type, false);
      if (transport.vehicleId) {
        this.selectedVehicleCapacity = transport.vehicleCapacity ?? null;
      }
      this.loadAvailableVehicles();
      this.loadAvailableDrivers();
    } else {
      this.selectedTransport.set(null);
      this.showVehicleField  = true;
      this.showDriverField   = true;
      this.showAirlineField  = false;
      this.showCapacityField = false;
      this.transportForm.reset({ type: 'BUS', price: 0, isActive: true });
      this.applyTransportTypeValidators('BUS', false);
      this.availableVehicles.set([]);
      this.availableDrivers.set([]);
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

    const base = {
      type,
      departureCityId: raw.departureCityId != null ? Number(raw.departureCityId) : null,
      arrivalCityId: raw.arrivalCityId != null ? Number(raw.arrivalCityId) : null,
      departureTime,
      arrivalTime,
      price,
      description: (raw.description ?? '').toString(),
      isActive: raw.isActive !== false,
    };

    const op = raw.operatorName != null ? String(raw.operatorName).trim() : '';
    const fc = raw.flightCode != null ? String(raw.flightCode).trim() : '';

    const payload =
      type === 'PLANE'
        ? {
            ...base,
            capacity: raw.capacity != null ? Number(raw.capacity) : null,
            operatorName: op || null,
            flightCode: fc || null,
            vehicleId: null,
            driverId: null,
          }
        : {
            ...base,
            capacity: raw.capacity != null ? Number(raw.capacity) : null,
            operatorName: op || null,
            flightCode: fc || null,
            vehicleId: raw.vehicleId != null ? Number(raw.vehicleId) : null,
            driverId: raw.driverId != null ? Number(raw.driverId) : null,
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
        this.http.delete<AdminApiEnvelope<null>>(`/api/admin/transports/${transport.transportId}`).subscribe({
          next: (res) => {
            this.loadTransports();
            this.loadStats();
            const msg = res?.message;
            if (msg && msg !== 'OK') {
              void this.alerts.info('Transport deactivated', msg);
            } else {
              void this.alerts.success(
                'Transport removed',
                `Route ${transport.departureCityName} → ${transport.arrivalCityName} was deleted.`,
              );
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

  // ── Vehicle CRUD ──────────────────────────────────────
  openVehicleDialog(vehicle?: Vehicle) {
    if (vehicle) { this.selectedVehicle.set(vehicle); this.vehicleForm.patchValue(vehicle); }
    else { this.selectedVehicle.set(null); this.vehicleForm.reset({ type: 'BUS', capacity: 1, year: new Date().getFullYear(), isActive: true }); }
    this.showVehicleDialog = true;
  }

  saveVehicle() {
    if (this.vehicleForm.invalid) { this.vehicleForm.markAllAsTouched(); return; }
    const data = this.vehicleForm.value;
    const id   = this.selectedVehicle()?.vehicleId;
    const req  = id
      ? this.http.put<any>(`/api/admin/vehicles/${id}`, data)
      : this.http.post<any>('/api/admin/vehicles', data);
    req.subscribe({
      next: () => {
        this.loadVehicles();
        this.loadStats();
        this.showVehicleDialog = false;
        void this.alerts.success(
          id ? 'Vehicle updated' : 'Vehicle added',
          `${data.brand} ${data.model} (${data.plateNumber}) ${id ? 'updated' : 'added to the fleet'}.`,
        );
      },
      error: (err) => {
        const msg = this.friendlyApiMessage(err, 'Could not save this vehicle.');
        void this.alerts.warning('Validation', msg);
      },
    });
  }

  deleteVehicle(vehicle: Vehicle) {
    void this.alerts
      .confirm({
        title: 'Delete vehicle',
        text: `Remove ${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber}) from the fleet?`,
        confirmText: 'Yes, delete',
        cancelText: 'Cancel',
        icon: 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http.delete<AdminApiEnvelope<null>>(`/api/admin/vehicles/${vehicle.vehicleId}`).subscribe({
          next: () => {
            this.loadVehicles();
            this.loadStats();
            void this.alerts.success('Vehicle removed', `${vehicle.brand} ${vehicle.model} removed from the fleet.`);
          },
          error: (err) => {
            const msg = this.friendlyApiMessage(err, 'This vehicle may be assigned to an active route.');
            void this.alerts.error('Could not delete', msg);
          },
        });
      });
  }

  // ── Driver CRUD ───────────────────────────────────────
  openDriverDialog(driver?: Driver) {
    if (driver) { this.selectedDriver.set(driver); this.driverForm.patchValue(driver); }
    else { this.selectedDriver.set(null); this.driverForm.reset({ isActive: true }); }
    this.showDriverDialog = true;
  }

  saveDriver() {
    if (this.driverForm.invalid) { this.driverForm.markAllAsTouched(); return; }
    const data = this.driverForm.value;
    const id   = this.selectedDriver()?.driverId;
    const req  = id
      ? this.http.put<any>(`/api/admin/drivers/${id}`, data)
      : this.http.post<any>('/api/admin/drivers', data);
    req.subscribe({
      next: () => {
        this.loadDrivers();
        this.loadStats();
        this.showDriverDialog = false;
        void this.alerts.success(
          id ? 'Driver updated' : 'Driver added',
          `${data.firstName} ${data.lastName} ${id ? 'updated' : 'added to the team'}.`,
        );
      },
      error: (err) => {
        const msg = this.friendlyApiMessage(err, 'Could not save this driver.');
        void this.alerts.warning('Validation', msg);
      },
    });
  }

  deleteDriver(driver: Driver) {
    void this.alerts
      .confirm({
        title: 'Delete driver',
        text: `Remove ${driver.firstName} ${driver.lastName} from the team?`,
        confirmText: 'Yes, delete',
        cancelText: 'Cancel',
        icon: 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http.delete<AdminApiEnvelope<null>>(`/api/admin/drivers/${driver.driverId}`).subscribe({
          next: () => {
            this.loadDrivers();
            this.loadStats();
            void this.alerts.success('Driver removed', `${driver.firstName} ${driver.lastName} was removed from the team.`);
          },
          error: (err) => {
            const msg = this.friendlyApiMessage(err, 'This driver may be assigned to an active route.');
            void this.alerts.error('Could not delete', msg);
          },
        });
      });
  }

  // ── Reservations ──────────────────────────────────────
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

  // ── Pagination display helpers ────────────────────────
  tPageEnd()  { return Math.min(this.transportPageSig() * this.PAGE_SIZE, this.filteredTransports().length); }
  vPageEnd()  { return Math.min(this.vehiclePageSig()   * this.PAGE_SIZE, this.filteredVehicles().length); }
  dPageEnd()  { return Math.min(this.driverPageSig()    * this.PAGE_SIZE, this.filteredDrivers().length); }

  // ── Helpers ───────────────────────────────────────────
  getTypeLabel(type: string): string {
    return this.transportTypes.find(t => t.value === type)?.label ?? type;
  }

  getVehicleDisplayLabel(vehicleId: number): string {
    const v = this.vehicles().find(v => v.vehicleId === vehicleId);
    return v ? `${v.brand} ${v.model} (${v.plateNumber})` : '—';
  }

  private toDateTimeLocal(dt: string): string {
    if (!dt) return '';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Format datetime-local value as yyyy-MM-ddTHH:mm:ss for Spring LocalDateTime (no timezone). */
  private toBackendLocalDateTime(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    const v = String(value).trim();
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00`;
    return v;
  }

  /** Avoid showing raw SQL / JDBC text in modals. */
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
