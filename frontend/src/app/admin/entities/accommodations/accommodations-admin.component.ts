import { Component, inject, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

interface Accommodation {
  accommodationId: number;
  name: string;
  type: 'HOTEL' | 'GUESTHOUSE' | 'MAISON_HOTE' | 'AUTRE';
  pricePerNight: number;
  rating: number;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  cityId: number;
  cityName?: string;
  rooms?: Room[];
}

interface Room {
  roomId: number;
  roomType: 'SINGLE' | 'DOUBLE' | 'SUITE' | 'FAMILY' | 'STUDIO';
  capacity: number;
  price: number;
  accommodationId: number;
}

interface City {
  cityId: number;
  name: string;
  region: string;
}

@Component({
  selector: 'app-accommodations-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './accommodations-admin.component.html',
  styleUrl: './accommodations-admin.component.css'
})
export class AccommodationsAdminComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  readonly PAGE_SIZE = 7;
  accPage = signal(1);

  // Signals for state management
  accommodations = signal<Accommodation[]>([]);
  cities = signal<City[]>([]);
  selectedAccommodation = signal<Accommodation | null>(null);
  isLoading = signal(false);
  showForm = signal(false);
  searchQuery = signal('');
  filterType = signal<string>('');
  filterStatus = signal<string>('');

  // Form
  accommodationForm: FormGroup;
  roomForm: FormGroup;
  showRoomForm = signal(false);
  editingRoom = signal<Room | null>(null);

  // Enums for dropdowns
  accommodationTypes = ['HOTEL', 'GUESTHOUSE', 'MAISON_HOTE', 'AUTRE'];
  roomTypes = ['SINGLE', 'DOUBLE', 'SUITE', 'FAMILY', 'STUDIO'];
  statusOptions = ['AVAILABLE', 'UNAVAILABLE'];

  // Filtered accommodations
  filteredAccommodations = computed(() => {
    let result = this.accommodations();
    const query = this.searchQuery().toLowerCase();
    const type = this.filterType();
    const status = this.filterStatus();

    if (query) {
      result = result.filter(a => 
        a.name.toLowerCase().includes(query) || 
        a.cityName?.toLowerCase().includes(query)
      );
    }
    if (type) {
      result = result.filter(a => a.type === type);
    }
    if (status) {
      result = result.filter(a => a.status === status);
    }
    return result;
  });

  pagedAccommodations = computed(() => {
    const list = this.filteredAccommodations();
    const start = (this.accPage() - 1) * this.PAGE_SIZE;
    return list.slice(start, start + this.PAGE_SIZE);
  });

  totalAccPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAccommodations().length / this.PAGE_SIZE))
  );

  /** KPIs aligned with accommodation business */
  totalPropertiesCount = computed(() => this.accommodations().length);
  activeListingsCount = computed(() =>
    this.accommodations().filter((a) => a.status === 'AVAILABLE').length
  );
  totalRoomsCount = computed(() =>
    this.accommodations().reduce((s, a) => s + (a.rooms?.length ?? 0), 0)
  );
  totalGuestCapacity = computed(() =>
    this.accommodations().reduce(
      (s, a) => s + (a.rooms?.reduce((rs, r) => rs + r.capacity, 0) ?? 0),
      0
    )
  );
  avgRatingLabel = computed(() => {
    const rated = this.accommodations().filter((a) => (a.rating ?? 0) > 0);
    if (!rated.length) {
      return '—';
    }
    const avg = rated.reduce((s, a) => s + (a.rating ?? 0), 0) / rated.length;
    return avg.toFixed(1);
  });
  unavailableListingsCount = computed(() =>
    this.accommodations().filter((a) => a.status === 'UNAVAILABLE').length
  );

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {
    this.accommodationForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      type: ['HOTEL', Validators.required],
      pricePerNight: [0, [Validators.required, Validators.min(0)]],
      rating: [0, [Validators.min(0), Validators.max(5)]],
      status: ['AVAILABLE', Validators.required],
      cityId: [null, Validators.required]
    });

    this.roomForm = this.fb.group({
      roomType: ['SINGLE', Validators.required],
      capacity: [1, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]]
    });

    this.loadAccommodations();
    this.loadCities();
  }

  onAccSearch(v: string): void {
    this.searchQuery.set(v);
    this.accPage.set(1);
  }

  onAccTypeFilter(v: string): void {
    this.filterType.set(v);
    this.accPage.set(1);
  }

  onAccStatusFilter(v: string): void {
    this.filterStatus.set(v);
    this.accPage.set(1);
  }

  clearAccFilters(): void {
    this.searchQuery.set('');
    this.filterType.set('');
    this.filterStatus.set('');
    this.accPage.set(1);
  }

  accPageEnd(): number {
    return Math.min(this.accPage() * this.PAGE_SIZE, this.filteredAccommodations().length);
  }

  prevAccPage(): void {
    this.accPage.update((p) => Math.max(1, p - 1));
  }

  nextAccPage(): void {
    this.accPage.update((p) => Math.min(this.totalAccPages(), p + 1));
  }

  getAccPageNumbers(): number[] {
    return this.buildPageArray(this.accPage(), this.totalAccPages());
  }

  private buildPageArray(current: number, total: number): number[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
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

  typeBadgeClass(type: string): string {
    const m: Record<string, string> = {
      HOTEL: 'hotel',
      GUESTHOUSE: 'guesthouse',
      MAISON_HOTE: 'maison_hote',
      AUTRE: 'autre',
    };
    return m[type] ?? 'autre';
  }

  roomCount(acc: Accommodation): number {
    return acc.rooms?.length ?? 0;
  }

  guestCapacityTotal(acc: Accommodation): number {
    return acc.rooms?.reduce((s, r) => s + r.capacity, 0) ?? 0;
  }

  loadAccommodations() {
    this.isLoading.set(true);
    this.http.get<{success: boolean, data: Accommodation[]}>(`/api/admin/accommodations`)
      .pipe(
        catchError(error => {
          console.error('Error loading accommodations:', error);
          // Fallback: try public endpoint
          return this.http.get<{success: boolean, data: Accommodation[]}>(`/api/accommodations/search?cityId=1`);
        })
      )
      .subscribe((response) => {
        if (response?.success) {
          this.accommodations.set(response.data || []);
        }
        this.isLoading.set(false);
        const maxPage = Math.max(1, Math.ceil(this.filteredAccommodations().length / this.PAGE_SIZE));
        if (this.accPage() > maxPage) {
          this.accPage.set(maxPage);
        }
      });
  }

  loadCities() {
    this.http.get<{success: boolean, data: City[]}>(`/api/cities`)
      .subscribe(response => {
        if (response?.success) {
          this.cities.set(response.data || []);
        }
      });
  }

  openCreateForm() {
    this.selectedAccommodation.set(null);
    this.accommodationForm.reset({
      type: 'HOTEL',
      status: 'AVAILABLE',
      pricePerNight: 0,
      rating: 0
    });
    this.showForm.set(true);
  }

  openEditForm(accommodation: Accommodation, opts?: { focusRooms?: boolean }) {
    this.selectedAccommodation.set(accommodation);
    this.accommodationForm.patchValue({
      name: accommodation.name,
      type: accommodation.type,
      pricePerNight: accommodation.pricePerNight,
      rating: accommodation.rating,
      status: accommodation.status,
      cityId: accommodation.cityId
    });
    this.showForm.set(true);
    if (opts?.focusRooms && isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        document.querySelector('.acc-rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }

  closeForm() {
    this.showForm.set(false);
    this.selectedAccommodation.set(null);
    this.accommodationForm.reset();
  }

  saveAccommodation() {
    if (this.accommodationForm.invalid) {
      this.accommodationForm.markAllAsTouched();
      return;
    }

    const formData = this.accommodationForm.value;
    const accommodationId = this.selectedAccommodation()?.accommodationId;

    const request = accommodationId
      ? this.http.put<{success: boolean, data: Accommodation}>(`/api/admin/accommodations/${accommodationId}`, formData)
      : this.http.post<{success: boolean, data: Accommodation}>(`/api/admin/accommodations`, formData);

    request.subscribe(response => {
      if (response?.success) {
        this.loadAccommodations();
        this.closeForm();
      }
    });
  }

  deleteAccommodation(accommodation: Accommodation) {
    if (!confirm(`Are you sure you want to delete "${accommodation.name}"?`)) {
      return;
    }

    this.http.delete<{success: boolean}>(`/api/admin/accommodations/${accommodation.accommodationId}`)
      .subscribe(response => {
        if (response?.success) {
          this.loadAccommodations();
        }
      });
  }

  toggleStatus(accommodation: Accommodation) {
    const newStatus = accommodation.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    this.http.patch<{success: boolean}>(`/api/admin/accommodations/${accommodation.accommodationId}/status`, { status: newStatus })
      .subscribe(response => {
        if (response?.success) {
          this.loadAccommodations();
        }
      });
  }

  // Room management
  openRoomForm(room?: Room) {
    if (room) {
      this.editingRoom.set(room);
      this.roomForm.patchValue({
        roomType: room.roomType,
        capacity: room.capacity,
        price: room.price
      });
    } else {
      this.editingRoom.set(null);
      this.roomForm.reset({
        roomType: 'SINGLE',
        capacity: 1,
        price: 0
      });
    }
    this.showRoomForm.set(true);
  }

  closeRoomForm() {
    this.showRoomForm.set(false);
    this.editingRoom.set(null);
    this.roomForm.reset();
  }

  saveRoom() {
    if (this.roomForm.invalid) return;

    const accommodationId = this.selectedAccommodation()?.accommodationId;
    if (!accommodationId) return;

    const formData = this.roomForm.value;
    const roomId = this.editingRoom()?.roomId;

    const request = roomId
      ? this.http.put(`/api/admin/accommodations/${accommodationId}/rooms/${roomId}`, formData)
      : this.http.post(`/api/admin/accommodations/${accommodationId}/rooms`, formData);

    request.subscribe(() => {
      this.loadAccommodations();
      this.closeRoomForm();
    });
  }

  deleteRoom(room: Room) {
    if (!confirm('Are you sure you want to delete this room?')) return;

    const accommodationId = this.selectedAccommodation()?.accommodationId;
    this.http.delete(`/api/admin/accommodations/${accommodationId}/rooms/${room.roomId}`)
      .subscribe(() => this.loadAccommodations());
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'HOTEL': 'Hotel',
      'GUESTHOUSE': 'Guest house',
      'MAISON_HOTE': 'Guest house',
      'AUTRE': 'Other'
    };
    return labels[type] || type;
  }

}
