import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { map, of, switchMap } from 'rxjs';
import * as L from 'leaflet';
import Swal from 'sweetalert2';
import { City, Restaurant, RestaurantRequest } from '../admin-api.models';
import { CityAdminService } from '../services/city-admin.service';
import { RestaurantAdminService } from '../services/restaurant-admin.service';

@Component({
  selector: 'app-admin-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-restaurants.component.html',
  styleUrl: './admin-restaurants.component.css',
})
export class AdminRestaurantsComponent implements OnInit, OnDestroy {
  restaurants: Restaurant[] = [];
  reviewAverageByRestaurantId: Record<number, number | null> = {};
  reviewCountByRestaurantId: Record<number, number> = {};
  cities: City[] = [];
  q = '';
  cuisineFilter = '';
  sort = 'restaurantId,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  error = '';
  showModal = false;
  showDetailsModal = false;
  modalError = '';
  fieldErrors: Partial<Record<'cityId' | 'name' | 'rating' | 'latitude' | 'longitude', string>> = {};
  geocodeMessage = '';
  imagePreviewUrl: string | null = null;
  selectedImageFile: File | null = null;
  persistedImageUrl: string | null = null;
  detailsRestaurant: Restaurant | null = null;

  editingId: number | null = null;
  form: {
    cityId: number | null;
    name: string;
    cuisineType: string;
    rating: number | null;
    description: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  } = {
    cityId: null,
    name: '',
    cuisineType: '',
    rating: null,
    description: '',
    address: '',
    latitude: null,
    longitude: null,
  };

  private map?: L.Map;
  private mapMarker?: L.CircleMarker;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly restaurantService: RestaurantAdminService,
    private readonly cityService: CityAdminService,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadRestaurants();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.revokeImagePreviewIfBlob();
    if (this.map) {
      this.map.remove();
      this.map = undefined;
      this.mapMarker = undefined;
    }
  }

  loadCities(): void {
    this.cityService.listCities('', 0, 200, 'name,asc').subscribe({
      next: (res) => {
        this.cities = res.content;
      },
      error: () => {
        this.error = 'Could not load cities list';
      },
    });
  }

  loadRestaurants(): void {
    this.restaurantService.list(this.q, this.page, this.size, this.sort, this.cuisineFilter).subscribe({
      next: (res) => {
        this.restaurants = res.content;
        this.loadReviewSummaries(res.content);
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error loading restaurants';
      },
    });
  }

  search(): void {
    this.page = 0;
    this.loadRestaurants();
  }

  onSearchInputChange(): void {
    this.page = 0;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.loadRestaurants(), 300);
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadRestaurants();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadRestaurants();
    }
  }

  edit(item: Restaurant): void {
    this.editingId = item.restaurantId;
    this.form = {
      cityId: item.cityId,
      name: item.name,
      cuisineType: item.cuisineType ?? '',
      rating: item.rating,
      description: item.description ?? '',
      address: item.address ?? '',
      latitude: item.latitude,
      longitude: item.longitude,
    };
    this.setImagePreview(item.imageUrl ?? null);
    this.selectedImageFile = null;
    this.geocodeMessage = '';
    this.clearValidationErrors();
    this.showModal = true;
    this.renderMapLater();
  }

  openCreateModal(): void {
    this.resetForm();
    this.error = '';
    this.modalError = '';
    this.geocodeMessage = '';
    this.showModal = true;
    this.renderMapLater();
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
    this.geocodeMessage = '';
    if (this.map) {
      this.map.remove();
      this.map = undefined;
      this.mapMarker = undefined;
    }
  }

  openDetails(item: Restaurant): void {
    this.detailsRestaurant = item;
    this.loadReviewSummary(item.restaurantId);
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsRestaurant = null;
  }

  starStates(value: number | null): Array<'full' | 'empty'> {
    const safe = value ?? 0;
    return Array.from({ length: 5 }, (_, index) => (safe >= index + 1 ? 'full' : 'empty'));
  }

  getRestaurantReviewAverage(restaurantId: number): number | null {
    return this.reviewAverageByRestaurantId[restaurantId] ?? null;
  }

  getRestaurantReviewCount(restaurantId: number): number {
    return this.reviewCountByRestaurantId[restaurantId] ?? 0;
  }

  resetForm(): void {
    this.editingId = null;
    this.form = {
      cityId: null,
      name: '',
      cuisineType: '',
      rating: null,
      description: '',
      address: '',
      latitude: null,
      longitude: null,
    };
    this.persistedImageUrl = null;
    this.clearValidationErrors();
    this.clearImageSelection();
  }

  save(): void {
    if (!this.validateRestaurantForm()) {
      return;
    }

    const payload: RestaurantRequest = {
      cityId: this.form.cityId!,
      name: this.form.name.trim(),
      cuisineType: this.form.cuisineType.trim() || null,
      rating: this.form.rating,
      description: this.form.description.trim() || null,
      address: this.form.address.trim() || null,
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      imageUrl: this.persistedImageUrl,
    };

    const request$ = this.editingId == null
      ? this.restaurantService.create(payload)
      : this.restaurantService.update(this.editingId, payload);

    request$
      .pipe(
        switchMap((savedRestaurant) => {
          if (!this.selectedImageFile) {
            return of(savedRestaurant);
          }

          return this.restaurantService
            .uploadImage(savedRestaurant.restaurantId, this.selectedImageFile)
            .pipe(map(() => savedRestaurant));
        })
      )
      .subscribe({
      next: () => {
        this.closeModal();
        this.loadRestaurants();
      },
      error: (err) => {
        this.modalError = err?.error?.message ?? 'Error saving';
      },
    });
  }

  geocodeFromName(): void {
    const name = this.form.name.trim();
    if (!name) {
      this.geocodeMessage = 'Enter a restaurant name to locate it.';
      return;
    }

    const selectedCity = this.cities.find((city) => city.cityId === this.form.cityId)?.name ?? '';
    const query = selectedCity ? `${name}, ${selectedCity}, Tunisia` : `${name}, Tunisia`;

    this.geocodeMessage = 'Locating…';

    this.http
      .get<Array<{ lat: string; lon: string; display_name: string }>>(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      )
      .subscribe({
        next: (results) => {
          if (!results.length) {
            this.geocodeMessage = 'No location found for this name.';
            return;
          }

          const first = results[0];
          this.form.latitude = Number(first.lat);
          this.form.longitude = Number(first.lon);
          this.form.address = first.display_name;
          this.geocodeMessage = 'Restaurant located automatically.';
          this.renderMapLater();
        },
        error: () => {
          this.geocodeMessage = 'Automatic geocoding failed. Enter latitude/longitude manually.';
        },
      });
  }

  openDirectionsFromCurrentPosition(): void {
    if (this.form.latitude == null || this.form.longitude == null) {
      return;
    }

    const targetLat = this.form.latitude;
    const targetLng = this.form.longitude;

    const openMaps = (fromLat: number, fromLng: number) => {
      const url = `https://www.google.com/maps/dir/${fromLat},${fromLng}/${targetLat},${targetLng}`;
      window.open(url, '_blank');
    };

    if (!navigator.geolocation) {
      const fallback = `https://www.google.com/maps/search/?api=1&query=${targetLat},${targetLng}`;
      window.open(fallback, '_blank');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => openMaps(position.coords.latitude, position.coords.longitude),
      () => {
        const fallback = `https://www.google.com/maps/search/?api=1&query=${targetLat},${targetLng}`;
        window.open(fallback, '_blank');
      }
    );
  }

  onCoordinatesChanged(): void {
    this.renderMapLater();
  }

  onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = (input.files ?? [])[0] ?? null;

    if (!file) {
      this.clearImageSelection();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.modalError = 'Only images are allowed for the restaurant';
      this.clearImageSelection();
      return;
    }

    this.revokeImagePreviewIfBlob();
    this.selectedImageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  clearImageSelection(): void {
    this.selectedImageFile = null;
    this.revokeImagePreviewIfBlob();
    this.imagePreviewUrl = this.persistedImageUrl;
  }

  removeCurrentImage(): void {
    this.selectedImageFile = null;
    this.persistedImageUrl = null;
    this.revokeImagePreviewIfBlob();
    this.imagePreviewUrl = null;
  }

  private setImagePreview(url: string | null): void {
    this.revokeImagePreviewIfBlob();
    this.persistedImageUrl = url;
    this.imagePreviewUrl = url;
  }

  private revokeImagePreviewIfBlob(): void {
    if (this.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
  }

  private renderMapLater(): void {
    setTimeout(() => this.initOrUpdateMap(), 0);
  }

  clearFieldError(field: 'cityId' | 'name' | 'rating' | 'latitude' | 'longitude'): void {
    delete this.fieldErrors[field];
    this.modalError = '';
  }

  private clearValidationErrors(): void {
    this.fieldErrors = {};
    this.modalError = '';
  }

  private validateRestaurantForm(): boolean {
    this.clearValidationErrors();

    if (this.form.cityId == null) {
      this.fieldErrors.cityId = 'City is required.';
    }

    if (!this.form.name.trim()) {
      this.fieldErrors.name = 'Restaurant name is required.';
    }

    if (this.form.rating != null && (this.form.rating < 0 || this.form.rating > 5)) {
      this.fieldErrors.rating = 'Rating must be between 0 and 5.';
    }

    const latitude = this.form.latitude;
    const longitude = this.form.longitude;
    const hasLatitude = latitude !== null && latitude !== undefined;
    const hasLongitude = longitude !== null && longitude !== undefined;

    if (hasLatitude && ((latitude as number) < -90 || (latitude as number) > 90)) {
      this.fieldErrors.latitude = 'Latitude must be between -90 and 90.';
    }

    if (hasLongitude && ((longitude as number) < -180 || (longitude as number) > 180)) {
      this.fieldErrors.longitude = 'Longitude must be between -180 and 180.';
    }

    if (hasLatitude !== hasLongitude) {
      if (!hasLatitude) {
        this.fieldErrors.latitude = 'Latitude is required when longitude is set.';
      }
      if (!hasLongitude) {
        this.fieldErrors.longitude = 'Longitude is required when latitude is set.';
      }
    }

    if (Object.keys(this.fieldErrors).length > 0) {
      this.modalError = 'Please fix the invalid fields.';
      return false;
    }

    return true;
  }

  private initOrUpdateMap(): void {
    if (!this.showModal) {
      return;
    }

    const mapContainer = document.getElementById('adminRestaurantMap');
    if (!mapContainer) {
      return;
    }

    if (this.form.latitude == null || this.form.longitude == null) {
      if (this.mapMarker) {
        this.mapMarker.remove();
        this.mapMarker = undefined;
      }
      return;
    }

    const lat = this.form.latitude;
    const lng = this.form.longitude;

    if (!this.map) {
      this.map = L.map('adminRestaurantMap').setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.map);
    } else {
      this.map.setView([lat, lng], 14);
      this.map.invalidateSize();
    }

    if (this.mapMarker) {
      this.mapMarker.remove();
    }

    this.mapMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#e63946',
      fillColor: '#e63946',
      fillOpacity: 0.9,
    })
      .addTo(this.map)
      .bindPopup(this.form.name || 'Restaurant')
      .openPopup();
  }

  private loadReviewSummaries(restaurants: Restaurant[]): void {
    this.reviewAverageByRestaurantId = {};
    this.reviewCountByRestaurantId = {};
    for (const restaurant of restaurants) {
      this.loadReviewSummary(restaurant.restaurantId);
    }
  }

  private loadReviewSummary(restaurantId: number): void {
    this.http
      .get<{ averageStars: number; totalReviews: number }>(`/api/public/restaurants/${restaurantId}/reviews/summary`)
      .subscribe({
        next: (summary) => {
          this.reviewAverageByRestaurantId[restaurantId] = (summary?.totalReviews ?? 0) > 0
            ? (summary?.averageStars ?? 0)
            : null;
          this.reviewCountByRestaurantId[restaurantId] = summary?.totalReviews ?? 0;
        },
        error: () => {
          this.reviewAverageByRestaurantId[restaurantId] = null;
          this.reviewCountByRestaurantId[restaurantId] = 0;
        },
      });
  }

  async delete(item: Restaurant): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this restaurant?',
      text: `${item.name} will be permanently deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.restaurantService.delete(item.restaurantId).subscribe({
      next: async () => {
        if (this.detailsRestaurant?.restaurantId === item.restaurantId && this.showDetailsModal) {
          this.closeDetailsModal();
        }
        this.loadRestaurants();
        await Swal.fire({
          icon: 'success',
          title: 'Restaurant deleted',
          timer: 1300,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
        });
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Could not delete';
      },
    });
  }
}
