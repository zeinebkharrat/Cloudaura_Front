import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { MessageService, ConfirmationService } from 'primeng/api';

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
    DropdownModule, ToastModule, ConfirmDialogModule,
    InputNumberModule, TabViewModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './transports-admin.component.html',
  styleUrl: './transports-admin.component.css'
})
export class TransportsAdminComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmService = inject(ConfirmationService);

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
    { label: 'Bus',          value: 'BUS'   },
    { label: 'Taxi',         value: 'TAXI'  },
    { label: 'Van / Louage', value: 'VAN'   },
    { label: 'Voiture',      value: 'CAR'   },
    { label: 'Avion',        value: 'PLANE' },
    { label: 'Train',        value: 'TRAIN' },
    { label: 'Ferry',        value: 'FERRY' },
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
    { label: 'Voiture', value: 'CAR'  },
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
        String(t.price), t.isActive ? 'actif' : 'inactif',
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
      url += `&departure=${encodeURIComponent(new Date(departureTime).toISOString())}`;
      url += `&arrival=${encodeURIComponent(new Date(arrivalTime).toISOString())}`;
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
      url += `?departure=${encodeURIComponent(new Date(departureTime).toISOString())}`;
      url += `&arrival=${encodeURIComponent(new Date(arrivalTime).toISOString())}`;
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
  onTypeChange(event: any) {
    const type = event?.value ?? event;
    this.showVehicleField  = type !== 'PLANE';
    this.showDriverField   = type !== 'PLANE';
    this.showAirlineField  = type === 'PLANE';
    this.showCapacityField = type === 'PLANE';
    this.selectedVehicleCapacity = null;
    this.durationWarning = null;

    if (type === 'PLANE') {
      this.transportForm.get('vehicleId')!.reset();
      this.transportForm.get('driverId')!.reset();
      this.transportForm.get('vehicleId')!.clearValidators();
      this.transportForm.get('driverId')!.clearValidators();
      this.transportForm.get('operatorName')!.setValidators([Validators.required]);
      this.transportForm.get('capacity')!.setValidators([Validators.required, Validators.min(1)]);
    } else {
      this.transportForm.get('operatorName')!.reset();
      this.transportForm.get('flightCode')!.reset();
      this.transportForm.get('vehicleId')!.setValidators([Validators.required]);
      this.transportForm.get('driverId')!.setValidators([Validators.required]);
      this.transportForm.get('operatorName')!.clearValidators();
      this.transportForm.get('capacity')!.clearValidators();
    }
    this.transportForm.get('vehicleId')!.updateValueAndValidity();
    this.transportForm.get('driverId')!.updateValueAndValidity();
    this.transportForm.get('operatorName')!.updateValueAndValidity();
    this.transportForm.get('capacity')!.updateValueAndValidity();
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
        ? `${diffH}h${diffMin > 0 ? diffMin + 'min' : ''}`
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
      this.durationWarning = `Durée anormalement longue pour un ${type} (max ${max}h recommandé)`;
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
      this.priceWarning = `Prix élevé pour un ${type} (max recommandé : ${max} TND)`;
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
    if (avail === 0) return 'COMPLET';
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
      this.transportForm.get('vehicleId')!.setValidators([Validators.required]);
      this.transportForm.get('driverId')!.setValidators([Validators.required]);
      this.transportForm.get('operatorName')!.clearValidators();
      this.transportForm.get('capacity')!.clearValidators();
      this.transportForm.get('vehicleId')!.updateValueAndValidity();
      this.transportForm.get('driverId')!.updateValueAndValidity();
      this.availableVehicles.set([]);
      this.availableDrivers.set([]);
    }
    this.showTransportDialog = true;
  }

  saveTransport() {
    if (this.transportForm.invalid) { this.transportForm.markAllAsTouched(); return; }

    const raw = this.transportForm.value;
    const fromCity = this.cities().find(c => c.cityId === raw.departureCityId)?.name ?? '';
    const toCity   = this.cities().find(c => c.cityId === raw.arrivalCityId)?.name ?? '';
    const id = this.selectedTransport()?.transportId;

    // Convert datetime-local strings to ISO
    const payload = {
      ...raw,
      departureTime: raw.departureTime ? new Date(raw.departureTime).toISOString() : null,
      arrivalTime:   raw.arrivalTime   ? new Date(raw.arrivalTime).toISOString()   : null,
    };

    const req = id
      ? this.http.put<any>(`/api/admin/transports/${id}`, payload)
      : this.http.post<any>('/api/admin/transports', payload);

    req.subscribe({
      next: () => {
        this.loadTransports();
        this.loadStats();
        this.showTransportDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: id ? 'Transport mis à jour' : 'Transport créé',
          detail: id
            ? `Le trajet ${fromCity} → ${toCity} a été modifié avec succès.`
            : `Nouveau trajet ${fromCity} → ${toCity} créé avec succès.`,
          life: 4500,
        });
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Impossible d\'effectuer cette opération.';
        this.messageService.add({ severity: 'warn', summary: 'Validation', detail: msg, life: 6000 });
      },
    });
  }

  deleteTransport(transport: Transport) {
    this.confirmService.confirm({
      header: 'Confirmer la suppression',
      message: `Supprimer le transport <strong>${this.getTypeLabel(transport.type)}</strong> — <strong>${transport.departureCityName} → ${transport.arrivalCityName}</strong> ? Cette action est irréversible.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete<any>(`/api/admin/transports/${transport.transportId}`).subscribe({
          next: () => {
            this.loadTransports();
            this.loadStats();
            this.messageService.add({
              severity: 'warn',
              summary: 'Transport supprimé',
              detail: `Le trajet ${transport.departureCityName} → ${transport.arrivalCityName} a été supprimé.`,
              life: 4500,
            });
          },
          error: (err) => {
            const msg = err?.error?.message ?? 'La suppression a échoué.';
            this.messageService.add({ severity: 'error', summary: 'Suppression impossible', detail: msg, life: 6000 });
          },
        });
      },
    });
  }

  toggleTransportStatus(transport: Transport) {
    const willActivate = !transport.isActive;
    this.confirmService.confirm({
      header: willActivate ? 'Activer le transport' : 'Désactiver le transport',
      message: willActivate
        ? `Voulez-vous activer le trajet <strong>${transport.departureCityName} → ${transport.arrivalCityName}</strong> ?`
        : `Voulez-vous désactiver le trajet <strong>${transport.departureCityName} → ${transport.arrivalCityName}</strong> ? Les nouvelles réservations seront bloquées.`,
      icon: willActivate ? 'pi pi-check-circle' : 'pi pi-ban',
      acceptLabel: willActivate ? 'Oui, activer' : 'Oui, désactiver',
      rejectLabel: 'Annuler',
      accept: () => {
        this.http.patch<any>(`/api/admin/transports/${transport.transportId}/status`, { isActive: willActivate }).subscribe({
          next: () => {
            this.loadTransports();
            this.loadStats();
            this.messageService.add({
              severity: willActivate ? 'success' : 'warn',
              summary: willActivate ? 'Transport activé' : 'Transport désactivé',
              detail: `Le trajet ${transport.departureCityName} → ${transport.arrivalCityName} est maintenant ${willActivate ? 'actif' : 'inactif'}.`,
              life: 4500,
            });
          },
          error: (err) => {
            const msg = err?.error?.message ?? 'Impossible de changer le statut.';
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: msg, life: 6000 });
          },
        });
      },
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
        this.messageService.add({
          severity: 'success',
          summary: id ? 'Véhicule mis à jour' : 'Véhicule ajouté',
          detail: `${data.brand} ${data.model} (${data.plateNumber}) ${id ? 'modifié' : 'ajouté à la flotte'}.`,
          life: 4500,
        });
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Impossible d\'enregistrer ce véhicule.';
        this.messageService.add({ severity: 'warn', summary: 'Validation', detail: msg, life: 6000 });
      },
    });
  }

  deleteVehicle(vehicle: Vehicle) {
    this.confirmService.confirm({
      header: 'Supprimer le véhicule',
      message: `Supprimer <strong>${vehicle.brand} ${vehicle.model}</strong> (${vehicle.plateNumber}) de la flotte ?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, supprimer', rejectLabel: 'Annuler', acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete<any>(`/api/admin/vehicles/${vehicle.vehicleId}`).subscribe({
          next: () => {
            this.loadVehicles();
            this.loadStats();
            this.messageService.add({ severity: 'warn', summary: 'Véhicule supprimé', detail: `${vehicle.brand} ${vehicle.model} retiré de la flotte.`, life: 4500 });
          },
          error: (err) => {
            const msg = err?.error?.message ?? 'Ce véhicule est peut-être assigné à un trajet actif.';
            this.messageService.add({ severity: 'error', summary: 'Suppression impossible', detail: msg, life: 6000 });
          },
        });
      },
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
        this.messageService.add({
          severity: 'success',
          summary: id ? 'Conducteur mis à jour' : 'Conducteur ajouté',
          detail: `${data.firstName} ${data.lastName} ${id ? 'mis à jour' : 'ajouté à l\'équipe'}.`,
          life: 4500,
        });
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Impossible d\'enregistrer ce conducteur.';
        this.messageService.add({ severity: 'warn', summary: 'Validation', detail: msg, life: 6000 });
      },
    });
  }

  deleteDriver(driver: Driver) {
    this.confirmService.confirm({
      header: 'Supprimer le conducteur',
      message: `Supprimer <strong>${driver.firstName} ${driver.lastName}</strong> de l'équipe ?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, supprimer', rejectLabel: 'Annuler', acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete<any>(`/api/admin/drivers/${driver.driverId}`).subscribe({
          next: () => {
            this.loadDrivers();
            this.loadStats();
            this.messageService.add({ severity: 'warn', summary: 'Conducteur supprimé', detail: `${driver.firstName} ${driver.lastName} retiré de l'équipe.`, life: 4500 });
          },
          error: (err) => {
            const msg = err?.error?.message ?? 'Ce conducteur est peut-être assigné à un trajet actif.';
            this.messageService.add({ severity: 'error', summary: 'Suppression impossible', detail: msg, life: 6000 });
          },
        });
      },
    });
  }

  // ── Reservations ──────────────────────────────────────
  viewReservations(transport: Transport) {
    this.selectedTransport.set(transport);
    this.loadReservations(transport.transportId);
    this.showReservationsDialog = true;
  }

  confirmReservation(res: TransportReservation) {
    this.confirmService.confirm({
      header: 'Confirmer la réservation',
      message: `Confirmer <strong>${res.reservationRef}</strong> de <strong>${res.passengerFirstName} ${res.passengerLastName}</strong> — ${res.numberOfSeats} place(s) ?`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Oui, confirmer', rejectLabel: 'Annuler',
      accept: () => {
        this.http.patch<any>(`/api/admin/transport-reservations/${res.transportReservationId}/confirm`, {}).subscribe({
          next: () => {
            if (this.selectedTransport()) this.loadReservations(this.selectedTransport()!.transportId);
            this.messageService.add({ severity: 'success', summary: 'Réservation confirmée', detail: `${res.reservationRef} — ${res.passengerFirstName} ${res.passengerLastName}`, life: 4500 });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de confirmer cette réservation.', life: 5000 }),
        });
      },
    });
  }

  cancelReservation(res: TransportReservation) {
    this.confirmService.confirm({
      header: 'Annuler la réservation',
      message: `Annuler <strong>${res.reservationRef}</strong> de <strong>${res.passengerFirstName} ${res.passengerLastName}</strong> ?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, annuler', rejectLabel: 'Garder', acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.patch<any>(`/api/admin/transport-reservations/${res.transportReservationId}/cancel`, { reason: 'Admin' }).subscribe({
          next: () => {
            if (this.selectedTransport()) this.loadReservations(this.selectedTransport()!.transportId);
            this.messageService.add({ severity: 'warn', summary: 'Réservation annulée', detail: `${res.reservationRef} annulée.`, life: 4500 });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible d\'annuler cette réservation.', life: 5000 }),
        });
      },
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
    return new Date(dt).toISOString().slice(0, 16);
  }
}
