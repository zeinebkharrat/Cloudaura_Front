import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { concatMap, from, map, Observable, of, switchMap, toArray } from 'rxjs';
import Swal from 'sweetalert2';
import { Activity, City, CityMedia, CityRequest, Restaurant } from '../admin-api.models';
import { ActivityAdminService } from '../services/activity-admin.service';
import { CityAdminService } from '../services/city-admin.service';
import { RestaurantAdminService } from '../services/restaurant-admin.service';

@Component({
  selector: 'app-admin-cities',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-cities.component.html',
  styleUrl: './admin-cities.component.css',
})
export class AdminCitiesComponent implements OnInit, OnDestroy {
  cities: City[] = [];
  q = '';
  sort = 'cityId,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;

  loading = false;
  error = '';
  showCityModal = false;
  showDetailsModal = false;
  modalError = '';
  fieldErrors: Partial<Record<'name' | 'region' | 'description' | 'latitude' | 'longitude', string>> = {};

  editingCityId: number | null = null;
  cityForm: CityRequest = {
    name: '',
    region: null,
    description: null,
    latitude: null,
    longitude: null,
  };

  mediaCity: City | null = null;
  mediaItems: CityMedia[] = [];
  detailsCity: City | null = null;
  detailsMediaItems: CityMedia[] = [];
  detailsLoadingMedia = false;
  detailsMediaIndex = 0;
  detailsRestaurants: Restaurant[] = [];
  detailsActivities: Activity[] = [];
  detailsActivityImageById: Record<number, string> = {};
  detailsLoadingRelated = false;
  detailsRelatedPerPage = 3;
  detailsRestaurantPageIndex = 0;
  detailsActivityPageIndex = 0;
  mediaQ = '';
  mediaSort = 'mediaId,desc';
  mediaPage = 0;
  mediaSize = 200;
  mediaTotalPages = 0;
  /** Pending image uploads (multi-select); all are sent on save. */
  cityPendingFiles: File[] = [];
  cityPendingPreviewUrls: string[] = [];
  /** First saved gallery image when editing (no pending selection). */
  persistedCityCoverUrl: string | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private detailsSliderTimer: ReturnType<typeof setInterval> | null = null;
  private detailsRestaurantSliderTimer: ReturnType<typeof setInterval> | null = null;
  private detailsActivitySliderTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly cityService: CityAdminService,
    private readonly restaurantService: RestaurantAdminService,
    private readonly activityService: ActivityAdminService
  ) {}

  ngOnInit(): void {
    this.loadCities();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (this.mediaSearchDebounceTimer) {
      clearTimeout(this.mediaSearchDebounceTimer);
    }
    this.stopDetailsAutoSlide();
    this.stopRelatedAutoSlide();
    this.clearCityImageState();
  }

  loadCities(): void {
    this.loading = true;
    this.error = '';
    this.cityService.listCities(this.q, this.page, this.size, this.sort).subscribe({
      next: (res) => {
        this.cities = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Error loading cities';
      },
    });
  }

  searchCities(): void {
    this.page = 0;
    this.loadCities();
  }

  onSearchInputChange(): void {
    this.page = 0;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.loadCities(), 300);
  }

  changeCityPage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadCities();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadCities();
    }
  }

  sortChanged(): void {
    this.page = 0;
    this.loadCities();
  }

  editCity(city: City): void {
    this.editingCityId = city.cityId;
    this.cityForm = {
      name: city.name,
      region: city.region,
      description: city.description,
      latitude: city.latitude,
      longitude: city.longitude,
    };
    this.mediaCity = city;
    this.mediaPage = 0;
    this.mediaQ = '';
    this.clearValidationErrors();
    this.clearCityImageSelectionOnly();
    this.loadMedia();
    this.showCityModal = true;
  }

  resetCityForm(): void {
    this.editingCityId = null;
    this.cityForm = {
      name: '',
      region: null,
      description: null,
      latitude: null,
      longitude: null,
    };
    this.mediaCity = null;
    this.mediaItems = [];
    this.mediaPage = 0;
    this.mediaTotalPages = 0;
    this.mediaQ = '';
    this.clearValidationErrors();
    this.clearCityImageState();
  }

  openCreateModal(): void {
    this.error = '';
    this.modalError = '';
    this.resetCityForm();
    this.showCityModal = true;
  }

  closeCityModal(): void {
    this.showCityModal = false;
    this.resetCityForm();
  }

  openDetails(city: City): void {
    this.detailsCity = city;
    this.detailsMediaItems = [];
    this.detailsLoadingMedia = true;
    this.detailsMediaIndex = 0;
    this.detailsRestaurants = [];
    this.detailsActivities = [];
    this.detailsActivityImageById = {};
    this.detailsRestaurantPageIndex = 0;
    this.detailsActivityPageIndex = 0;
    this.detailsLoadingRelated = true;
    this.showDetailsModal = true;
    this.stopDetailsAutoSlide();
    this.stopRelatedAutoSlide();

    this.cityService.listCityMedia(city.cityId, '', 0, 24, 'mediaId,desc').subscribe({
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

    this.restaurantService.list('', 0, 200, 'restaurantId,desc').subscribe({
      next: (res) => {
        this.detailsRestaurants = res.content.filter((restaurant) => restaurant.cityId === city.cityId);
        this.detailsRestaurantPageIndex = 0;
        this.startRestaurantsAutoSlide();
        this.detailsLoadingRelated = false;
      },
      error: () => {
        this.detailsRestaurants = [];
        this.stopRestaurantsAutoSlide();
        this.detailsLoadingRelated = false;
      },
    });

    this.activityService.list('', 0, 200, 'activityId,desc').subscribe({
      next: (res) => {
        this.detailsActivities = res.content.filter((activity) => activity.cityId === city.cityId);
        this.detailsActivityPageIndex = 0;
        this.loadDetailsActivityImages();
        this.startActivitiesAutoSlide();
      },
      error: () => {
        this.detailsActivities = [];
        this.detailsActivityImageById = {};
        this.stopActivitiesAutoSlide();
      },
    });
  }

  closeDetailsModal(): void {
    this.stopDetailsAutoSlide();
    this.stopRelatedAutoSlide();
    this.showDetailsModal = false;
    this.detailsCity = null;
    this.detailsMediaItems = [];
    this.detailsLoadingMedia = false;
    this.detailsMediaIndex = 0;
    this.detailsRestaurants = [];
    this.detailsActivities = [];
    this.detailsActivityImageById = {};
    this.detailsRestaurantPageIndex = 0;
    this.detailsActivityPageIndex = 0;
    this.detailsLoadingRelated = false;
  }

  detailsRestaurantPages(): Restaurant[][] {
    return this.chunkRelated(this.detailsRestaurants);
  }

  detailsActivityPages(): Activity[][] {
    return this.chunkRelated(this.detailsActivities);
  }

  hasRestaurantCarouselControls(): boolean {
    return this.detailsRestaurantPages().length > 1;
  }

  hasActivityCarouselControls(): boolean {
    return this.detailsActivityPages().length > 1;
  }

  nextRestaurantPage(): void {
    const pages = this.detailsRestaurantPages();
    if (pages.length <= 1) {
      return;
    }
    this.detailsRestaurantPageIndex = (this.detailsRestaurantPageIndex + 1) % pages.length;
    this.restartRestaurantsAutoSlide();
  }

  previousRestaurantPage(): void {
    const pages = this.detailsRestaurantPages();
    if (pages.length <= 1) {
      return;
    }
    this.detailsRestaurantPageIndex = (this.detailsRestaurantPageIndex - 1 + pages.length) % pages.length;
    this.restartRestaurantsAutoSlide();
  }

  goToRestaurantPage(index: number): void {
    if (index < 0 || index >= this.detailsRestaurantPages().length) {
      return;
    }
    this.detailsRestaurantPageIndex = index;
    this.restartRestaurantsAutoSlide();
  }

  nextActivityPage(): void {
    const pages = this.detailsActivityPages();
    if (pages.length <= 1) {
      return;
    }
    this.detailsActivityPageIndex = (this.detailsActivityPageIndex + 1) % pages.length;
    this.restartActivitiesAutoSlide();
  }

  previousActivityPage(): void {
    const pages = this.detailsActivityPages();
    if (pages.length <= 1) {
      return;
    }
    this.detailsActivityPageIndex = (this.detailsActivityPageIndex - 1 + pages.length) % pages.length;
    this.restartActivitiesAutoSlide();
  }

  goToActivityPage(index: number): void {
    if (index < 0 || index >= this.detailsActivityPages().length) {
      return;
    }
    this.detailsActivityPageIndex = index;
    this.restartActivitiesAutoSlide();
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

  detailsActivityImage(activityId: number): string {
    return this.detailsActivityImageById[activityId] ?? 'assets/sidi_bou.png';
  }

  detailsCityFallbackImage(): string {
    return this.detailsMediaItems.length > 0 ? this.detailsMediaItems[0].url : 'assets/sidi_bou.png';
  }

  saveCity(): void {
    if (!this.validateCityForm()) {
      return;
    }

    const isEdit = this.editingCityId != null;
    const payload: CityRequest = {
      name: this.cityForm.name.trim(),
      region: this.nullIfBlank(this.cityForm.region),
      description: this.nullIfBlank(this.cityForm.description),
      latitude: this.cityForm.latitude,
      longitude: this.cityForm.longitude,
    };

    const request$ = !isEdit
      ? this.cityService.createCity(payload).pipe(
          switchMap((city) => this.uploadPendingCityImages(city.cityId).pipe(map(() => city)))
        )
      : this.cityService.updateCity(this.editingCityId!, payload).pipe(
          switchMap((city) => this.uploadPendingCityImages(city.cityId).pipe(map(() => city)))
        );

    request$.subscribe({
      next: async () => {
        this.closeCityModal();
        this.loadCities();
        await Swal.fire({
          icon: 'success',
          title: isEdit ? 'City updated' : 'City added',
          timer: 1400,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
          customClass: { container: 'swal-on-top' },
        });
      },
      error: (err) => {
        this.modalError = err?.error?.message ?? 'Error saving';
      },
    });
  }

  async deleteCity(city: City): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this city?',
      text: `${city.name} will be permanently deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
      customClass: { container: 'swal-on-top' },
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.cityService.deleteCity(city.cityId).subscribe({
      next: async () => {
        if (this.mediaCity?.cityId === city.cityId && this.showCityModal) {
          this.closeCityModal();
        }
        if (this.detailsCity?.cityId === city.cityId && this.showDetailsModal) {
          this.closeDetailsModal();
        }
        this.loadCities();
        await Swal.fire({
          icon: 'success',
          title: 'City deleted',
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

  loadMedia(): void {
    if (!this.mediaCity) {
      return;
    }
    this.cityService.listCityMedia(this.mediaCity.cityId, this.mediaQ, this.mediaPage, this.mediaSize, this.mediaSort).subscribe({
      next: (res) => {
        this.mediaItems = res.content;
        this.mediaTotalPages = res.totalPages;
        if (this.editingCityId && this.cityPendingFiles.length === 0) {
          const firstUrl = res.content[0]?.url ?? null;
          this.persistedCityCoverUrl = firstUrl;
        }
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error loading media';
      },
    });
  }

  searchMedia(): void {
    this.mediaPage = 0;
    this.loadMedia();
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

  onCityMultiImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      if (picked.length > 0) {
        this.modalError = 'Only images are allowed';
      }
      return;
    }
    this.modalError = '';
    for (const file of images) {
      this.cityPendingFiles.push(file);
      this.cityPendingPreviewUrls.push(URL.createObjectURL(file));
    }
  }

  removePendingCityImage(index: number): void {
    const url = this.cityPendingPreviewUrls[index];
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    this.cityPendingPreviewUrls.splice(index, 1);
    this.cityPendingFiles.splice(index, 1);
  }

  /** ImgBB / CDN hotlink: avoid broken img when referrer blocked; fallback if URL expired. */
  onExternalImgError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.dataset['fallbackApplied'] === '1') {
      return;
    }
    img.dataset['fallbackApplied'] = '1';
    img.src = 'assets/sidi_bou.png';
    img.onerror = null;
  }

  /** Clear staged uploads only; keep persisted gallery preview when editing. */
  clearCityImageSelection(): void {
    this.revokePendingCityPreviews();
    this.cityPendingFiles = [];
    this.cityPendingPreviewUrls = [];
  }

  async deleteMedia(media: CityMedia): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this media?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
      customClass: {
        container: 'swal-on-top',
      },
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.cityService.deleteCityMedia(media.mediaId).subscribe({
      next: () => this.loadMedia(),
      error: (err) => {
        this.error = err?.error?.message ?? 'Could not delete media';
      },
    });
  }

  private nullIfBlank(value: string | null): string | null {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  clearFieldError(field: 'name' | 'region' | 'description' | 'latitude' | 'longitude'): void {
    delete this.fieldErrors[field];
    this.modalError = '';
  }

  private clearValidationErrors(): void {
    this.fieldErrors = {};
    this.modalError = '';
  }

  private validateCityForm(): boolean {
    this.clearValidationErrors();

    const name = this.cityForm.name.trim();
    if (!name) {
      this.fieldErrors.name = 'Le nom de la ville est obligatoire.';
    }

    const region = this.nullIfBlank(this.cityForm.region);
    if (!region) {
      this.fieldErrors.region = 'Region is required.';
    }

    const description = this.nullIfBlank(this.cityForm.description);
    if (!description) {
      this.fieldErrors.description = 'Description is required.';
    }

    const latitude = this.cityForm.latitude;
    const longitude = this.cityForm.longitude;
    const hasLatitude = latitude !== null && latitude !== undefined;
    const hasLongitude = longitude !== null && longitude !== undefined;

    if (hasLatitude && (latitude as number) < -90 || hasLatitude && (latitude as number) > 90) {
      this.fieldErrors.latitude = 'Latitude must be between -90 and 90.';
    }

    if (hasLongitude && (longitude as number) < -180 || hasLongitude && (longitude as number) > 180) {
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

  private uploadPendingCityImages(cityId: number): Observable<unknown> {
    const files = [...this.cityPendingFiles];
    if (files.length === 0) {
      return of(null);
    }
    return from(files).pipe(
      concatMap((file) => this.cityService.uploadCityMedia(cityId, 'IMAGE', file)),
      toArray(),
      map(() => null)
    );
  }

  /** Reset staged files before loading existing media for edit. */
  private clearCityImageSelectionOnly(): void {
    this.revokePendingCityPreviews();
    this.cityPendingFiles = [];
    this.cityPendingPreviewUrls = [];
    this.persistedCityCoverUrl = null;
  }

  private clearCityImageState(): void {
    this.revokePendingCityPreviews();
    this.cityPendingFiles = [];
    this.cityPendingPreviewUrls = [];
    this.persistedCityCoverUrl = null;
  }

  private revokePendingCityPreviews(): void {
    for (const url of this.cityPendingPreviewUrls) {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
  }

  private loadDetailsActivityImages(): void {
    this.detailsActivityImageById = {};
    for (const activity of this.detailsActivities) {
      this.activityService.listMedia(activity.activityId, '', 0, 1, 'mediaId,desc').subscribe({
        next: (res) => {
          const imageUrl = res.content[0]?.url;
          if (!imageUrl) {
            return;
          }
          this.detailsActivityImageById = {
            ...this.detailsActivityImageById,
            [activity.activityId]: imageUrl,
          };
        },
        error: () => {
        },
      });
    }
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

  private chunkRelated<T>(items: T[]): T[][] {
    const pages: T[][] = [];
    const perPage = Math.max(1, this.detailsRelatedPerPage);

    for (let index = 0; index < items.length; index += perPage) {
      pages.push(items.slice(index, index + perPage));
    }

    return pages;
  }

  private startRestaurantsAutoSlide(): void {
    this.stopRestaurantsAutoSlide();
    if (!this.hasRestaurantCarouselControls()) {
      return;
    }

    this.detailsRestaurantSliderTimer = setInterval(() => {
      const pages = this.detailsRestaurantPages();
      if (pages.length <= 1) {
        return;
      }
      this.detailsRestaurantPageIndex = (this.detailsRestaurantPageIndex + 1) % pages.length;
    }, 4500);
  }

  private restartRestaurantsAutoSlide(): void {
    this.startRestaurantsAutoSlide();
  }

  private stopRestaurantsAutoSlide(): void {
    if (this.detailsRestaurantSliderTimer) {
      clearInterval(this.detailsRestaurantSliderTimer);
      this.detailsRestaurantSliderTimer = null;
    }
  }

  private startActivitiesAutoSlide(): void {
    this.stopActivitiesAutoSlide();
    if (!this.hasActivityCarouselControls()) {
      return;
    }

    this.detailsActivitySliderTimer = setInterval(() => {
      const pages = this.detailsActivityPages();
      if (pages.length <= 1) {
        return;
      }
      this.detailsActivityPageIndex = (this.detailsActivityPageIndex + 1) % pages.length;
    }, 5000);
  }

  private restartActivitiesAutoSlide(): void {
    this.startActivitiesAutoSlide();
  }

  private stopActivitiesAutoSlide(): void {
    if (this.detailsActivitySliderTimer) {
      clearInterval(this.detailsActivitySliderTimer);
      this.detailsActivitySliderTimer = null;
    }
  }

  private stopRelatedAutoSlide(): void {
    this.stopRestaurantsAutoSlide();
    this.stopActivitiesAutoSlide();
  }
}
