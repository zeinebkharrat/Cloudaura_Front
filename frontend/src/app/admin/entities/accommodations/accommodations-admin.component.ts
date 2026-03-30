import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

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

  constructor() {
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
      .subscribe(response => {
        if (response?.success) {
          this.accommodations.set(response.data || []);
        }
        this.isLoading.set(false);
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

  openEditForm(accommodation: Accommodation) {
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
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${accommodation.name}" ?`)) {
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
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette chambre ?')) return;

    const accommodationId = this.selectedAccommodation()?.accommodationId;
    this.http.delete(`/api/admin/accommodations/${accommodationId}/rooms/${room.roomId}`)
      .subscribe(() => this.loadAccommodations());
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'HOTEL': 'Hôtel',
      'GUESTHOUSE': 'Maison d\'hôtes',
      'MAISON_HOTE': 'Maison d\'hôte',
      'AUTRE': 'Autre'
    };
    return labels[type] || type;
  }

  getStatusBadgeClass(status: string): string {
    return status === 'AVAILABLE' ? 'badge-success' : 'badge-danger';
  }
}
