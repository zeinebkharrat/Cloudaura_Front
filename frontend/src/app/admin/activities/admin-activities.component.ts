import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { concatMap, from, Observable, of, switchMap, toArray } from 'rxjs';
import * as L from 'leaflet';
import Swal from 'sweetalert2';
import { Activity, ActivityMedia, ActivityRequest, City } from '../admin-api.models';
import { ActivityAdminService } from '../services/activity-admin.service';
import { CityAdminService } from '../services/city-admin.service';

@Component({
  selector: 'app-admin-activities',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-activities.component.html',
  styleUrl: './admin-activities.component.css',
})
export class AdminActivitiesComponent implements OnInit, OnDestroy {
  activities: Activity[] = [];
  cities: City[] = [];
  q = '';
  sort = 'activityId,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  error = '';
  modalError = '';
  showModal = false;
  showDetailsModal = false;
  geocodeMessage = '';
  fieldErrors: Partial<Record<'cityId' | 'name' | 'price' | 'latitude' | 'longitude' | 'maxParticipantsPerDay', string>> = {};

  mediaItems: ActivityMedia[] = [];
  detailsActivity: Activity | null = null;
  detailsMediaItems: ActivityMedia[] = [];
  detailsLoadingMedia = false;
  detailsMediaIndex = 0;
  detailsRating = 0;
  detailsReviewCount = 0;
  mediaQ = '';
  mediaSort = 'mediaId,desc';
  mediaPage = 0;
  mediaSize = 200;
  mediaTotalPages = 0;
  uploadFiles: File[] = [];
  mediaPreviewUrls: string[] = [];
  activityForMedia: Activity | null = null;

  editingId: number | null = null;
  form: {
    cityId: number | null;
    name: string;
    type: string;
    price: number | null;
    description: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    maxParticipantsPerDay: number | null;
    maxParticipantsStartDate: string | null;
  } = {
    cityId: null,
    name: '',
    type: '',
    price: null,
    description: '',
    address: '',
    latitude: null,
    longitude: null,
    maxParticipantsPerDay: null,
    maxParticipantsStartDate: null,
  };

  private map?: L.Map;
  private mapMarker?: L.CircleMarker;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private detailsSliderTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly activityService: ActivityAdminService,
    private readonly cityService: CityAdminService,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadActivities();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (this.mediaSearchDebounceTimer) {
      clearTimeout(this.mediaSearchDebounceTimer);
    }
    this.stopDetailsAutoSlide();
    this.clearSelectedFiles();
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
        this.error = 'Could not load cities';
      },
    });
  }

  loadActivities(): void {
    this.activityService.list(this.q, this.page, this.size, this.sort).subscribe({
      next: (res) => {
        this.activities = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error loading activities';
      },
    });
  }

  search(): void {
    this.page = 0;
    this.loadActivities();
  }

  onSearchInputChange(): void {
    this.page = 0;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.loadActivities(), 300);
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadActivities();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadActivities();
    }
  }

  averageDisplayedPrice(): string {
    const prices = this.activities
      .map((activity) => activity.price)
      .filter((price): price is number => price != null);
    if (!prices.length) {
      return '—';
    }
    const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    return `${average.toFixed(1)} DT`;
  }

  maxDisplayedPrice(): string {
    const prices = this.activities
      .map((activity) => activity.price)
      .filter((price): price is number => price != null);
    if (!prices.length) {
      return '—';
    }
    return `${Math.max(...prices).toFixed(1)} DT`;
  }

  edit(item: Activity): void {
    this.editingId = item.activityId;
    this.form = {
      cityId: item.cityId,
      name: item.name,
      type: item.type ?? '',
      price: item.price,
      description: item.description ?? '',
      address: item.address ?? '',
      latitude: item.latitude,
      longitude: item.longitude,
      maxParticipantsPerDay: item.maxParticipantsPerDay,
      maxParticipantsStartDate: item.maxParticipantsStartDate,
    };
    this.activityForMedia = item;
    this.mediaPage = 0;
    this.mediaQ = '';
    this.geocodeMessage = '';
    this.clearValidationErrors();
    this.loadMedia();
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

  openDetails(item: Activity): void {
    this.detailsActivity = item;
    this.detailsMediaItems = [];
    this.detailsLoadingMedia = true;
    this.detailsMediaIndex = 0;
    this.detailsRating = 0;
    this.detailsReviewCount = 0;
    this.showDetailsModal = true;
    this.stopDetailsAutoSlide();

    this.http
      .get<{ averageStars: number; totalReviews: number }>(`/api/public/activities/${item.activityId}/reviews/summary`)
      .subscribe({
        next: (summary) => {
          this.detailsRating = summary?.averageStars ?? 0;
          this.detailsReviewCount = summary?.totalReviews ?? 0;
        },
        error: () => {
          this.detailsRating = 0;
          this.detailsReviewCount = 0;
        },
      });

    this.activityService.listMedia(item.activityId, '', 0, 24, 'mediaId,desc').subscribe({
      next: (res) => {
        this.detailsMediaItems = res.content;
        this.detailsMediaIndex = 0;
        this.startDetailsAutoSlide();
        this.detailsLoadingMedia = false;
      },
      error: () => {
        this.stopDetailsAutoSlide();
        this.detailsLoadingMedia = false;
      },
    });
  }

  closeDetailsModal(): void {
    this.stopDetailsAutoSlide();
    this.showDetailsModal = false;
    this.detailsActivity = null;
    this.detailsMediaItems = [];
    this.detailsLoadingMedia = false;
    this.detailsMediaIndex = 0;
    this.detailsRating = 0;
    this.detailsReviewCount = 0;
  }

  starStates(value: number | null): Array<'full' | 'empty'> {
    const safe = value ?? 0;
    return Array.from({ length: 5 }, (_, index) => (safe >= index + 1 ? 'full' : 'empty'));
  }

  nextDetailsMedia(): void {
    if (this.detailsMediaItems.length <= 1) {
      return;
    }
    this.detailsMediaIndex = (this.detailsMediaIndex + 1) % this.detailsMediaItems.length;
    this.restartDetailsAutoSlide();
  }

  previousDetailsMedia(): void {
    if (this.detailsMediaItems.length <= 1) {
      return;
    }
    this.detailsMediaIndex = (this.detailsMediaIndex - 1 + this.detailsMediaItems.length) % this.detailsMediaItems.length;
    this.restartDetailsAutoSlide();
  }

  selectDetailsMedia(index: number): void {
    if (index < 0 || index >= this.detailsMediaItems.length) {
      return;
    }
    this.detailsMediaIndex = index;
    this.restartDetailsAutoSlide();
  }

  resetForm(): void {
    this.editingId = null;
    this.form = {
      cityId: null,
      name: '',
      type: '',
      price: null,
      description: '',
      address: '',
      latitude: null,
      longitude: null,
      maxParticipantsPerDay: null,
      maxParticipantsStartDate: null,
    };
    this.activityForMedia = null;
    this.mediaItems = [];
    this.mediaPage = 0;
    this.mediaTotalPages = 0;
    this.mediaQ = '';
    this.clearValidationErrors();
    this.clearSelectedFiles();
  }

  save(): void {
    if (!this.validateActivityForm()) {
      return;
    }

    const payload: ActivityRequest = {
      cityId: this.form.cityId!,
      name: this.form.name.trim(),
      type: this.form.type.trim() || null,
      price: this.form.price,
      description: this.nullIfBlank(this.form.description),
      address: this.nullIfBlank(this.form.address),
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      maxParticipantsPerDay: this.form.maxParticipantsPerDay,
      maxParticipantsStartDate: this.editingId ? this.form.maxParticipantsStartDate : null,
    };

    const request$ = this.editingId == null
      ? this.activityService.create(payload)
      : this.activityService.update(this.editingId, payload);

    request$
      .pipe(
        switchMap((savedActivity) => {
          if (!this.uploadFiles.length) {
            return of(savedActivity);
          }
          return this.uploadSelectedMedia(savedActivity.activityId).pipe(
            switchMap(() => of(savedActivity))
          );
        })
      )
      .subscribe({
      next: () => {
        this.closeModal();
        this.loadActivities();
      },
      error: (err) => {
        this.modalError = err?.error?.message ?? 'Error saving';
      },
    });
  }

  geocodeFromName(): void {
    const name = this.form.name.trim();
    if (!name) {
      this.geocodeMessage = 'Enter an activity name to locate it.';
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
          this.geocodeMessage = 'Activity located automatically.';
          this.renderMapLater();
        },
        error: () => {
          this.geocodeMessage = 'Automatic geolocation failed. Enter latitude and longitude manually.';
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

  loadMedia(): void {
    if (!this.activityForMedia) {
      return;
    }

    this.activityService
      .listMedia(this.activityForMedia.activityId, this.mediaQ, this.mediaPage, this.mediaSize, this.mediaSort)
      .subscribe({
        next: (res) => {
          this.mediaItems = res.content;
          this.mediaTotalPages = res.totalPages;
        },
        error: (err) => {
          this.modalError = err?.error?.message ?? 'Error loading media';
        },
      });
  }

  onMediaSearchInputChange(): void {
    this.mediaPage = 0;
    if (this.mediaSearchDebounceTimer) {
      clearTimeout(this.mediaSearchDebounceTimer);
    }
    this.mediaSearchDebounceTimer = setTimeout(() => this.loadMedia(), 300);
  }

  changeMediaPage(next: boolean): void {
    if (next && this.mediaPage + 1 < this.mediaTotalPages) {
      this.mediaPage++;
      this.loadMedia();
    } else if (!next && this.mediaPage > 0) {
      this.mediaPage--;
      this.loadMedia();
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.clearSelectedFiles();

    const files = Array.from(input.files ?? []);
    const accepted = files.filter((file) => file.type.startsWith('image/'));
    if (accepted.length !== files.length) {
      this.modalError = 'Only images are allowed';
    }

    this.uploadFiles = accepted;
    this.mediaPreviewUrls = accepted.map((file) => URL.createObjectURL(file));
  }

  removeSelectedFile(index: number): void {
    if (index < 0 || index >= this.uploadFiles.length) {
      return;
    }
    const [removedPreview] = this.mediaPreviewUrls.splice(index, 1);
    if (removedPreview) {
      URL.revokeObjectURL(removedPreview);
    }
    this.uploadFiles.splice(index, 1);
  }

  clearUploadSelection(): void {
    this.clearSelectedFiles();
  }

  uploadMedia(): void {
    if (!this.activityForMedia || this.uploadFiles.length === 0) {
      this.modalError = 'Select an activity and a file first';
      return;
    }

    this.uploadSelectedMedia(this.activityForMedia.activityId).subscribe({
      next: () => {
        this.clearSelectedFiles();
        this.loadMedia();
      },
      error: (err: any) => {
        this.modalError = err?.error?.message ?? 'Image upload failed';
      },
    });
  }

  deleteMedia(media: ActivityMedia): void {
    this.activityService.deleteMedia(media.mediaId).subscribe({
      next: () => this.loadMedia(),
      error: (err) => {
        this.modalError = err?.error?.message ?? 'Could not delete media';
      },
    });
  }

  clearFieldError(field: 'cityId' | 'name' | 'price' | 'latitude' | 'longitude' | 'maxParticipantsPerDay'): void {
    delete this.fieldErrors[field];
    this.modalError = '';
  }

  private clearValidationErrors(): void {
    this.fieldErrors = {};
    this.modalError = '';
  }

  private validateActivityForm(): boolean {
    this.clearValidationErrors();

    if (this.form.cityId == null) {
      this.fieldErrors.cityId = 'City is required.';
    }

    if (!this.form.name.trim()) {
      this.fieldErrors.name = 'Activity name is required.';
    }

    if (this.form.price != null && this.form.price < 0) {
      this.fieldErrors.price = 'Price must be greater than or equal to 0.';
    }

    if (this.form.maxParticipantsPerDay != null && this.form.maxParticipantsPerDay < 1) {
      this.fieldErrors.maxParticipantsPerDay = 'Maximum participants per day must be at least 1.';
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

  private nullIfBlank(value: string | null): string | null {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private uploadSelectedMedia(activityId: number): Observable<unknown> {
    if (this.uploadFiles.length === 0) {
      return of(null);
    }

    return from(this.uploadFiles).pipe(
      concatMap((file) => this.activityService.uploadMedia(activityId, 'IMAGE', file)),
      toArray()
    );
  }

  private clearSelectedFiles(): void {
    for (const url of this.mediaPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.mediaPreviewUrls = [];
    this.uploadFiles = [];
  }

  private renderMapLater(): void {
    setTimeout(() => this.initOrUpdateMap(), 0);
  }

  private initOrUpdateMap(): void {
    if (!this.showModal) {
      return;
    }

    const mapContainer = document.getElementById('adminActivityMap');
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
      this.map = L.map('adminActivityMap').setView([lat, lng], 14);
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
      .bindPopup(this.form.name || 'Activity')
      .openPopup();
  }

  async delete(item: Activity): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this activity?',
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

    this.activityService.delete(item.activityId).subscribe({
      next: async () => {
        if (this.detailsActivity?.activityId === item.activityId && this.showDetailsModal) {
          this.closeDetailsModal();
        }
        this.loadActivities();
        await Swal.fire({
          icon: 'success',
          title: 'Activity deleted',
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

  private startDetailsAutoSlide(): void {
    this.stopDetailsAutoSlide();
    if (this.detailsMediaItems.length <= 1) {
      return;
    }

    this.detailsSliderTimer = setInterval(() => {
      if (this.detailsMediaItems.length <= 1) {
        return;
      }
      this.detailsMediaIndex = (this.detailsMediaIndex + 1) % this.detailsMediaItems.length;
    }, 3400);
  }

  private restartDetailsAutoSlide(): void {
    this.startDetailsAutoSlide();
  }

  private stopDetailsAutoSlide(): void {
    if (this.detailsSliderTimer) {
      clearInterval(this.detailsSliderTimer);
      this.detailsSliderTimer = null;
    }
  }
}
