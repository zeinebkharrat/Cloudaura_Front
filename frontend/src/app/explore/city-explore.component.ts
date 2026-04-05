import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ExploreService } from './explore.service';
import { Activity, OpenMeteoCurrentResponse, PublicCityDetailsResponse, Restaurant } from './explore.models';

const HOME_MAP_RETURN_CONTEXT_KEY = 'homeMapReturnContext';

@Component({
  selector: 'app-city-explore',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './city-explore.component.html',
  styleUrl: './city-explore.component.css',
})
export class CityExploreComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal('');
  details = signal<PublicCityDetailsResponse | null>(null);
  activityImageById = signal<Record<number, string>>({});
  restaurantRatingById = signal<Record<number, number>>({});
  activityRatingById = signal<Record<number, number>>({});
  activityReviewCountById = signal<Record<number, number>>({});
  currentImageIndex = signal(0);
  activitiesPerPage = signal(2);
  restaurantPageIndex = signal(0);
  activityPageIndex = signal(0);
  weatherLoading = signal(false);
  weatherError = signal('');
  weatherLabel = signal('');
  weatherIcon = signal('⛅');
  weatherTemperature = signal<number | null>(null);
  weatherWind = signal<number | null>(null);

  media = computed(() => this.details()?.media ?? []);
  currentMedia = computed(() => {
    const gallery = this.media();
    if (!gallery.length) {
      return null;
    }
    return gallery[this.currentImageIndex() % gallery.length];
  });

  heroImage = computed(() => this.currentMedia()?.url ?? 'assets/sidi_bou.png');
  hasMultipleImages = computed(() => this.media().length > 1);
  currentCaption = computed(() => {
    const cityName = this.details()?.city.name ?? 'this destination';
    const media = this.currentMedia();
    if (!media) {
      return `Discover ${cityName} and its iconic spots.`;
    }

    if (media.mediaType === 'PANORAMA') {
      return `Immersive panoramic view of ${cityName}.`;
    }
    if (media.mediaType === 'VIDEO') {
      return `A vivid moment in ${cityName}, blending culture and local atmosphere.`;
    }
    return `Postcard-perfect scene from ${cityName}.`;
  });
  activityPages = computed(() => {
    const activities = this.details()?.activities ?? [];
    const perPage = Math.max(1, this.activitiesPerPage());
    const pages: Activity[][] = [];

    for (let index = 0; index < activities.length; index += perPage) {
      pages.push(activities.slice(index, index + perPage));
    }

    return pages;
  });
  restaurantPages = computed(() => {
    const restaurants = this.details()?.restaurants ?? [];
    const perPage = Math.max(1, this.activitiesPerPage());
    const pages: Restaurant[][] = [];

    for (let index = 0; index < restaurants.length; index += perPage) {
      pages.push(restaurants.slice(index, index + perPage));
    }

    return pages;
  });
  hasRestaurantCarouselControls = computed(() => this.restaurantPages().length > 1);
  hasActivityCarouselControls = computed(() => this.activityPages().length > 1);

  private sliderTimer: ReturnType<typeof setInterval> | null = null;
  private restaurantSliderTimer: ReturnType<typeof setInterval> | null = null;
  private activitySliderTimer: ReturnType<typeof setInterval> | null = null;
  private returnRegionId: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly exploreService: ExploreService,
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.returnRegionId = this.route.snapshot.queryParamMap.get('region');
    this.activitiesPerPage.set(this.getActivitiesPerPage());

    const cityId = Number(this.route.snapshot.paramMap.get('cityId'));
    if (!cityId) {
      this.error.set('Invalid city');
      this.loading.set(false);
      return;
    }

    this.exploreService.getCityDetails(cityId).subscribe({
      next: (details) => {
        this.details.set(details);
        this.activityImageById.set({});
        this.restaurantRatingById.set({});
        this.activityRatingById.set({});
        this.activityReviewCountById.set({});
        this.restaurantPageIndex.set(0);
        this.activityPageIndex.set(0);
        this.loadRestaurantRatings(details.restaurants);
        this.loadActivityImages(details.activities);
        this.loadActivityRatings(details.activities);
        this.currentImageIndex.set(0);
        this.loadCurrentWeather(details.city.latitude, details.city.longitude);
        this.startAutoSlide();
        this.startRestaurantsAutoSlide();
        this.startActivitiesAutoSlide();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Unable to load this city');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
    this.stopRestaurantsAutoSlide();
    this.stopActivitiesAutoSlide();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateActivitiesPerPage();
  }

  onHeroClick(event: MouseEvent): void {
    if (!this.hasMultipleImages()) {
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const isRight = clickX > bounds.width / 2;

    if (isRight) {
      this.nextImage();
      return;
    }

    this.previousImage();
  }

  nextImage(): void {
    const total = this.media().length;
    if (!total) {
      return;
    }
    this.currentImageIndex.set((this.currentImageIndex() + 1) % total);
    this.restartAutoSlide();
  }

  previousImage(): void {
    const total = this.media().length;
    if (!total) {
      return;
    }
    this.currentImageIndex.set((this.currentImageIndex() - 1 + total) % total);
    this.restartAutoSlide();
  }

  private startAutoSlide(): void {
    this.stopAutoSlide();
    if (!this.hasMultipleImages()) {
      return;
    }

    this.sliderTimer = setInterval(() => {
      const total = this.media().length;
      if (total <= 1) {
        return;
      }
      this.currentImageIndex.set((this.currentImageIndex() + 1) % total);
    }, 4200);
  }

  private stopAutoSlide(): void {
    if (this.sliderTimer) {
      clearInterval(this.sliderTimer);
      this.sliderTimer = null;
    }
  }

  private restartAutoSlide(): void {
    this.startAutoSlide();
  }

  nextRestaurantPage(): void {
    const pages = this.restaurantPages();
    if (pages.length <= 1) {
      return;
    }

    this.restaurantPageIndex.set((this.restaurantPageIndex() + 1) % pages.length);
    this.restartRestaurantsAutoSlide();
  }

  previousRestaurantPage(): void {
    const pages = this.restaurantPages();
    if (pages.length <= 1) {
      return;
    }

    this.restaurantPageIndex.set((this.restaurantPageIndex() - 1 + pages.length) % pages.length);
    this.restartRestaurantsAutoSlide();
  }

  goToRestaurantPage(index: number): void {
    const pages = this.restaurantPages();
    if (index < 0 || index >= pages.length) {
      return;
    }

    this.restaurantPageIndex.set(index);
    this.restartRestaurantsAutoSlide();
  }

  nextActivityPage(): void {
    const pages = this.activityPages();
    if (pages.length <= 1) {
      return;
    }

    this.activityPageIndex.set((this.activityPageIndex() + 1) % pages.length);
    this.restartActivitiesAutoSlide();
  }

  previousActivityPage(): void {
    const pages = this.activityPages();
    if (pages.length <= 1) {
      return;
    }

    this.activityPageIndex.set((this.activityPageIndex() - 1 + pages.length) % pages.length);
    this.restartActivitiesAutoSlide();
  }

  goToActivityPage(index: number): void {
    const pages = this.activityPages();
    if (index < 0 || index >= pages.length) {
      return;
    }

    this.activityPageIndex.set(index);
    this.restartActivitiesAutoSlide();
  }

  goBack(): void {
    const routeCityId = Number(this.route.snapshot.paramMap.get('cityId'));
    const city = this.details()?.city;
    const cityName = city?.name ?? null;
    const cityId = city?.cityId ?? (Number.isNaN(routeCityId) ? null : routeCityId);
    const cityLat = city?.latitude ?? null;
    const cityLng = city?.longitude ?? null;
    const returnRegion = this.returnRegionId ?? cityName ?? undefined;

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        HOME_MAP_RETURN_CONTEXT_KEY,
        JSON.stringify({
          zoomOut: 1,
          returnRegion,
          returnCity: cityName ?? undefined,
          returnCityId: cityId ?? undefined,
          returnLat: cityLat ?? undefined,
          returnLng: cityLng ?? undefined,
        })
      );
    }

    this.router.navigate(['/destination-map'], {
      fragment: 'map-section',
      queryParams: {
        zoomOut: 1,
        returnRegion,
        returnCity: cityName ?? undefined,
        returnCityId: cityId ?? undefined,
        returnLat: cityLat ?? undefined,
        returnLng: cityLng ?? undefined,
      },
    });
  }

  goToMapZoomOut(): void {
    this.goBack();
  }

  activityCardImage(activity: Activity): string {
    return (
      this.activityImageById()[activity.activityId] ||
      activity.imageUrl ||
      'assets/sidi_bou.png'
    );
  }

  starStates(value: number | null): Array<'full' | 'empty'> {
    const safe = value ?? 0;
    return Array.from({ length: 5 }, (_, index) => (safe >= index + 1 ? 'full' : 'empty'));
  }

  activityRating(activityId: number): number {
    return this.activityRatingById()[activityId] ?? 0;
  }

  restaurantRating(restaurantId: number): number {
    return this.restaurantRatingById()[restaurantId] ?? 0;
  }

  activityReviewCount(activityId: number): number {
    return this.activityReviewCountById()[activityId] ?? 0;
  }

  scrollToSection(sectionId: 'restaurants' | 'activities'): void {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private loadActivityImages(activities: Activity[]): void {
    for (const activity of activities) {
      this.exploreService.getActivityMedia(activity.activityId).subscribe({
        next: (media) => {
          const mediaImage = media.find((item) => item.mediaType === 'IMAGE')?.url ?? media[0]?.url;
          if (!mediaImage) {
            return;
          }

          this.activityImageById.update((current) => ({
            ...current,
            [activity.activityId]: mediaImage,
          }));
        },
        error: () => {
        },
      });
    }
  }

  private loadRestaurantRatings(restaurants: Restaurant[]): void {
    for (const restaurant of restaurants) {
      this.exploreService.getRestaurantReviewSummary(restaurant.restaurantId).subscribe({
        next: (summary) => {
          this.restaurantRatingById.update((current) => ({
            ...current,
            [restaurant.restaurantId]: summary?.averageStars ?? 0,
          }));
        },
        error: () => {
          this.restaurantRatingById.update((current) => ({
            ...current,
            [restaurant.restaurantId]: 0,
          }));
        },
      });
    }
  }

  private loadActivityRatings(activities: Activity[]): void {
    for (const activity of activities) {
      this.exploreService.getActivityReviewSummary(activity.activityId).subscribe({
        next: (summary) => {
          this.activityRatingById.update((current) => ({
            ...current,
            [activity.activityId]: summary?.averageStars ?? 0,
          }));

          this.activityReviewCountById.update((current) => ({
            ...current,
            [activity.activityId]: summary?.totalReviews ?? 0,
          }));
        },
        error: () => {
          this.activityRatingById.update((current) => ({
            ...current,
            [activity.activityId]: 0,
          }));

          this.activityReviewCountById.update((current) => ({
            ...current,
            [activity.activityId]: 0,
          }));
        },
      });
    }
  }

  private updateActivitiesPerPage(): void {
    const nextPerPage = this.getActivitiesPerPage();
    if (this.activitiesPerPage() === nextPerPage) {
      return;
    }

    this.activitiesPerPage.set(nextPerPage);
    const maxRestaurantPageIndex = Math.max(0, this.restaurantPages().length - 1);
    if (this.restaurantPageIndex() > maxRestaurantPageIndex) {
      this.restaurantPageIndex.set(maxRestaurantPageIndex);
    }
    const maxPageIndex = Math.max(0, this.activityPages().length - 1);
    if (this.activityPageIndex() > maxPageIndex) {
      this.activityPageIndex.set(maxPageIndex);
    }
    this.restartRestaurantsAutoSlide();
    this.restartActivitiesAutoSlide();
  }

  private getActivitiesPerPage(): number {
    if (typeof window === 'undefined') {
      return 3;
    }

    if (window.innerWidth < 760) {
      return 1;
    }

    if (window.innerWidth < 1180) {
      return 2;
    }

    return 3;
  }

  private startActivitiesAutoSlide(): void {
    this.stopActivitiesAutoSlide();
    if (!this.hasActivityCarouselControls()) {
      return;
    }

    this.activitySliderTimer = setInterval(() => {
      const pages = this.activityPages();
      if (pages.length <= 1) {
        return;
      }
      this.activityPageIndex.set((this.activityPageIndex() + 1) % pages.length);
    }, 5200);
  }

  private startRestaurantsAutoSlide(): void {
    this.stopRestaurantsAutoSlide();
    if (!this.hasRestaurantCarouselControls()) {
      return;
    }

    this.restaurantSliderTimer = setInterval(() => {
      const pages = this.restaurantPages();
      if (pages.length <= 1) {
        return;
      }
      this.restaurantPageIndex.set((this.restaurantPageIndex() + 1) % pages.length);
    }, 4800);
  }

  private stopRestaurantsAutoSlide(): void {
    if (this.restaurantSliderTimer) {
      clearInterval(this.restaurantSliderTimer);
      this.restaurantSliderTimer = null;
    }
  }

  private restartRestaurantsAutoSlide(): void {
    this.startRestaurantsAutoSlide();
  }

  private stopActivitiesAutoSlide(): void {
    if (this.activitySliderTimer) {
      clearInterval(this.activitySliderTimer);
      this.activitySliderTimer = null;
    }
  }

  private restartActivitiesAutoSlide(): void {
    this.startActivitiesAutoSlide();
  }

  private loadCurrentWeather(latitude: number | null, longitude: number | null): void {
    if (latitude == null || longitude == null) {
      this.weatherError.set('Weather unavailable for this city coordinates.');
      this.weatherLoading.set(false);
      return;
    }

    this.weatherLoading.set(true);
    this.weatherError.set('');

    const params = new HttpParams()
      .set('latitude', latitude)
      .set('longitude', longitude)
      .set('current', 'temperature_2m,weather_code,wind_speed_10m')
      .set('timezone', 'auto');

    this.http.get<OpenMeteoCurrentResponse>('https://api.open-meteo.com/v1/forecast', { params }).subscribe({
      next: (response: OpenMeteoCurrentResponse) => {
        const current = response.current;
        if (!current) {
          this.weatherError.set('Weather data unavailable right now.');
          this.weatherLoading.set(false);
          return;
        }

        this.weatherTemperature.set(
          typeof current.temperature_2m === 'number' ? current.temperature_2m : null
        );
        this.weatherWind.set(
          typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : null
        );

        const summary = this.describeWeatherCode(current.weather_code ?? 0);
        this.weatherLabel.set(summary.label);
        this.weatherIcon.set(summary.icon);
        this.weatherLoading.set(false);
      },
      error: () => {
        this.weatherLoading.set(false);
        this.weatherError.set('Unable to load weather now.');
      },
    });
  }

  private describeWeatherCode(code: number): { label: string; icon: string } {
    if (code === 0) {
      return { label: 'Clear sky', icon: '☀️' };
    }
    if (code >= 1 && code <= 3) {
      return { label: 'Partly cloudy', icon: '⛅' };
    }
    if (code >= 45 && code <= 48) {
      return { label: 'Foggy', icon: '🌫️' };
    }
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return { label: 'Rainy', icon: '🌧️' };
    }
    if (code >= 71 && code <= 77) {
      return { label: 'Snowy', icon: '❄️' };
    }
    if (code >= 95) {
      return { label: 'Stormy', icon: '⛈️' };
    }
    return { label: 'Variable weather', icon: '🌤️' };
  }
}
