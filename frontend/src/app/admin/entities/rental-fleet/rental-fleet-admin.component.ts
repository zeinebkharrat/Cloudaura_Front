import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { AppAlertsService } from '../../../core/services/app-alerts.service';

interface AdminApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string;
}

interface FleetCar {
  fleetCarId: number;
  cityId: number;
  cityName: string;
  category: string;
  modelLabel: string;
  dailyRateTnd: number;
  isActive: boolean;
  reservationCount: number;
}

interface City {
  cityId: number;
  name: string;
  region: string;
}

interface FleetStats {
  totalFleetCars: number;
  activeFleetCars: number;
  distinctCities: number;
  totalRentalReservations: number;
}

@Component({
  selector: 'app-rental-fleet-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule,
  ],
  templateUrl: './rental-fleet-admin.component.html',
  styleUrl: './rental-fleet-admin.component.css',
})
export class RentalFleetAdminComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AppAlertsService);

  readonly PAGE_SIZE = 7;

  fleet = signal<FleetCar[]>([]);
  cities = signal<City[]>([]);
  stats = signal<FleetStats | null>(null);
  selectedCar = signal<FleetCar | null>(null);
  isLoading = signal(false);
  apiBanner = signal<string | null>(null);
  search = signal('');
  pageSig = signal(1);
  showDialog = false;

  readonly categoryOptions = [
    { label: 'Economy', value: 'ECONOMY' },
    { label: 'Compact', value: 'COMPACT' },
    { label: 'Intermediate', value: 'INTERMEDIATE' },
    { label: 'SUV', value: 'SUV' },
    { label: 'Minivan', value: 'MINIVAN' },
    { label: 'Luxury', value: 'LUXURY' },
  ];

  fleetForm: FormGroup;

  get page() {
    return this.pageSig();
  }
  set page(v: number) {
    this.pageSig.set(v);
  }

  totalCount = computed(() => this.stats()?.totalFleetCars ?? this.fleet().length);
  activeCount = computed(() => this.stats()?.activeFleetCars ?? this.fleet().filter((c) => c.isActive).length);
  citiesCount = computed(() => this.stats()?.distinctCities ?? 0);
  reservationsCount = computed(() => this.stats()?.totalRentalReservations ?? 0);

  filteredFleet = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.fleet().filter((c) => {
      if (!q) return true;
      const hay = [
        c.cityName,
        c.category,
        c.modelLabel,
        String(c.dailyRateTnd),
        String(c.reservationCount),
        c.isActive ? 'active' : 'inactive',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  pagedFleet = computed(() => {
    const start = (this.pageSig() - 1) * this.PAGE_SIZE;
    return this.filteredFleet().slice(start, start + this.PAGE_SIZE);
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredFleet().length / this.PAGE_SIZE)));

  constructor() {
    this.fleetForm = this.fb.group({
      cityId: [null, Validators.required],
      category: ['ECONOMY', Validators.required],
      modelLabel: ['', [Validators.required, Validators.maxLength(160)]],
      dailyRateTnd: [null as number | null, [Validators.required, Validators.min(0.01)]],
      isActive: [true],
    });
    this.loadAll();
  }

  loadAll(): void {
    this.loadCities();
    this.loadFleet();
    this.loadStats();
  }

  loadCities(): void {
    this.http.get<unknown>('/api/cities').subscribe({
      next: (r) => this.cities.set(this.normalizeCityList(r)),
      error: () => {
        void this.alerts.warning('Cities', 'Could not load cities.');
        this.cities.set([]);
      },
    });
  }

  loadStats(): void {
    this.http.get<AdminApiEnvelope<FleetStats>>('/api/admin/rental-fleet/stats').subscribe({
      next: (r) => {
        const p = this.parseEnvelope<FleetStats>(r);
        if (p.ok && p.data) {
          this.stats.set(p.data);
          this.apiBanner.set(null);
        }
      },
      error: (err) => this.onHttpError(err, 'Could not load fleet statistics.'),
    });
  }

  loadFleet(): void {
    this.isLoading.set(true);
    this.http.get<AdminApiEnvelope<FleetCar[]>>('/api/admin/rental-fleet').subscribe({
      next: (r) => {
        const p = this.parseEnvelope<FleetCar[]>(r);
        if (p.ok && Array.isArray(p.data)) {
          this.fleet.set(p.data);
          this.apiBanner.set(null);
        } else {
          this.fleet.set([]);
        }
        this.isLoading.set(false);
        this.pageSig.set(1);
      },
      error: (err) => {
        this.onHttpError(err, 'Could not load rental fleet.');
        this.fleet.set([]);
        this.isLoading.set(false);
        this.pageSig.set(1);
      },
    });
  }

  openDialog(car?: FleetCar): void {
    if (car) {
      this.selectedCar.set(car);
      const rate = typeof car.dailyRateTnd === 'number' ? car.dailyRateTnd : parseFloat(String(car.dailyRateTnd));
      this.fleetForm.patchValue({
        cityId: car.cityId,
        category: car.category,
        modelLabel: car.modelLabel,
        dailyRateTnd: Number.isFinite(rate) ? rate : null,
        isActive: car.isActive,
      });
    } else {
      this.selectedCar.set(null);
      this.fleetForm.reset({
        cityId: null,
        category: 'ECONOMY',
        modelLabel: '',
        dailyRateTnd: null,
        isActive: true,
      });
    }
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
  }

  saveFleetCar(): void {
    if (this.fleetForm.invalid) {
      this.fleetForm.markAllAsTouched();
      return;
    }
    const raw = this.fleetForm.getRawValue();
    const id = this.selectedCar()?.fleetCarId;
    const payload = {
      cityId: raw.cityId != null ? Number(raw.cityId) : null,
      category: String(raw.category ?? '').trim(),
      modelLabel: String(raw.modelLabel ?? '').trim(),
      dailyRateTnd: raw.dailyRateTnd != null ? Number(raw.dailyRateTnd) : null,
      isActive: raw.isActive !== false,
    };
    const req = id
      ? this.http.put<AdminApiEnvelope<FleetCar>>(`/api/admin/rental-fleet/${id}`, payload)
      : this.http.post<AdminApiEnvelope<FleetCar>>('/api/admin/rental-fleet', payload);
    req.subscribe({
      next: () => {
        this.loadFleet();
        this.loadStats();
        this.closeDialog();
        void this.alerts.success(
          id ? 'Vehicle updated' : 'Vehicle created',
          id ? 'Changes were saved to the catalogue.' : 'The new vehicle is now in the catalogue.',
        );
      },
      error: (err) => void this.alerts.warning('Validation', this.friendlyMessage(err, 'Could not save.')),
    });
  }

  toggleStatus(car: FleetCar): void {
    const will = !car.isActive;
    void this.alerts
      .confirm({
        title: will ? 'Activate vehicle' : 'Deactivate vehicle',
        text: will
          ? `Show "${car.modelLabel}" in ${car.cityName} searches again?`
          : `Hide "${car.modelLabel}" in ${car.cityName} from new searches? Existing booking history is kept.`,
        confirmText: will ? 'Yes, activate' : 'Yes, deactivate',
        cancelText: 'Cancel',
        icon: will ? 'question' : 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http
          .patch<AdminApiEnvelope<unknown>>(`/api/admin/rental-fleet/${car.fleetCarId}/status`, { isActive: will })
          .subscribe({
            next: () => {
              this.loadFleet();
              this.loadStats();
              void this.alerts.success(
                will ? 'Activated' : 'Deactivated',
                `${car.modelLabel} — ${car.cityName}`,
              );
            },
            error: (err) => void this.alerts.error('Error', this.friendlyMessage(err, 'Could not change status.')),
          });
      });
  }

  deleteCar(car: FleetCar): void {
    void this.alerts
      .confirm({
        title: 'Confirm removal',
        text: `Remove "${car.modelLabel}" in ${car.cityName}? If there are no linked simulations/bookings it will be deleted; otherwise it will be deactivated only.`,
        confirmText: 'Yes, remove',
        cancelText: 'Cancel',
        icon: 'warning',
      })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.http.delete(`/api/admin/rental-fleet/${car.fleetCarId}`, { observe: 'response' }).subscribe({
          next: (res) => {
            this.loadFleet();
            this.loadStats();
            if (res.status === 204) {
              void this.alerts.success('Removed', `${car.modelLabel} was deleted from the catalogue.`);
            } else {
              const body = res.body as AdminApiEnvelope<null> | null;
              const msg = body?.message;
              if (msg && msg !== 'OK') {
                void this.alerts.info('Deactivated instead', msg);
              } else {
                void this.alerts.success('Removed', `${car.modelLabel} was deleted.`);
              }
            }
          },
          error: (err) => void this.alerts.error('Error', this.friendlyMessage(err, 'Deletion failed.')),
        });
      });
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.pageSig.set(1);
  }

  clearSearch(): void {
    this.search.set('');
    this.pageSig.set(1);
  }

  dismissBanner(): void {
    this.apiBanner.set(null);
  }

  pageEnd(): number {
    return Math.min(this.pageSig() * this.PAGE_SIZE, this.filteredFleet().length);
  }

  getPageNumbers(): number[] {
    const current = this.pageSig();
    const total = this.totalPages();
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

  fieldInvalid(name: string): boolean {
    const c = this.fleetForm.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  fieldValid(name: string): boolean {
    const c = this.fleetForm.get(name);
    if (!c || !c.valid || !(c.dirty || c.touched)) return false;
    const v = c.value;
    return v != null && v !== '';
  }

  resizeDescription(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), 220)}px`;
  }

  private normalizeCityList(payload: unknown): City[] {
    if (payload == null) return [];
    if (Array.isArray(payload)) return payload as City[];
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
      const data = (payload as { data?: unknown }).data;
      if (Array.isArray(data)) return data as City[];
    }
    return [];
  }

  private parseEnvelope<T>(body: unknown): { ok: boolean; data: T | null; message?: string } {
    if (body == null || typeof body !== 'object') return { ok: false, data: null };
    const o = body as { success?: boolean; data?: T; message?: string };
    if (o.success === false) return { ok: false, data: null, message: o.message };
    return { ok: true, data: (o.data ?? null) as T | null, message: o.message };
  }

  private friendlyMessage(err: unknown, fallback: string): string {
    const httpErr = err as HttpErrorResponse;
    const status = httpErr?.status;
    if (status === 401) return 'Session expired. Sign in again with an admin account.';
    if (status === 403) return 'Access denied (ROLE_ADMIN required).';
    const raw = httpErr?.error;
    let m = '';
    if (raw != null && typeof raw === 'object' && 'message' in raw) {
      m = String((raw as { message?: unknown }).message ?? '').trim();
    } else if (typeof raw === 'string') m = raw.trim();
    return m || fallback;
  }

  private onHttpError(err: unknown, fallback: string): void {
    const msg = this.friendlyMessage(err, fallback);
    const status = (err as HttpErrorResponse)?.status;
    if (status === 401 || status === 403) {
      this.apiBanner.set(msg);
      void this.alerts.warning('Admin — Rental fleet', msg);
    } else {
      this.apiBanner.set(msg);
      void this.alerts.error('Admin — Rental fleet', msg);
    }
  }
}
