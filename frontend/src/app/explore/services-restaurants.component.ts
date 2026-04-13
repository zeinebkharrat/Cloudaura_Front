import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExploreService } from './explore.service';
import { City, Restaurant, VoiceTranscriptionResponse } from './explore.models';
import { VoiceSearchService } from './voice-search.service';
import { parseRestaurantVoiceQuery } from './voice-query.parser';

@Component({
  selector: 'app-services-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './services-restaurants.component.html',
  styleUrl: './services-restaurants.component.css',
})
export class ServicesRestaurantsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal('');
  restaurants = signal<Restaurant[]>([]);
  cities = signal<City[]>([]);
  cuisineOptions = signal<string[]>([]);
  q = signal('');
  voiceQuery = signal('');
  selectedCityId = signal<number | 'all'>('all');
  cuisineType = signal('');
  sort = signal('restaurantId,desc');
  page = signal(0);
  readonly size = 9;
  totalPages = signal(0);
  totalElements = signal(0);
  restaurantRatingById = signal<Record<number, number>>({});
  voiceSupported = signal(false);
  voiceListening = signal(false);
  voiceProcessing = signal(false);
  voiceError = signal('');
  lastTranscript = signal('');
  voiceSuggestion = signal('');
  voiceDetectedFilters = signal({ city: false, cuisine: false });

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private langSub: Subscription | null = null;

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index));

  constructor(
    private readonly exploreService: ExploreService,
    private readonly voiceSearchService: VoiceSearchService,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.voiceSupported.set(this.voiceSearchService.isSupported());
    this.loadCities();
    this.loadCuisineOptions();
    this.loadRestaurants();
    this.langSub = this.language.langChanged$.subscribe(() => {
      this.page.set(0);
      this.loadCuisineOptions();
      this.loadRestaurants();
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.langSub = null;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  onSearchChange(value: string): void {
    this.q.set(value);
    this.voiceQuery.set('');
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.page.set(0);
      this.loadRestaurants();
    }, 300);
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    this.page.set(0);
    this.loadRestaurants();
  }

  onCityFilterChange(value: number | 'all'): void {
    this.selectedCityId.set(value);
    this.page.set(0);
    this.loadRestaurants();
  }

  onCuisineTypeChange(value: string): void {
    this.cuisineType.set(value);
    this.page.set(0);
    this.loadRestaurants();
  }

  clearAvailabilityFilter(): void {
    this.q.set('');
    this.voiceQuery.set('');
    this.selectedCityId.set('all');
    this.cuisineType.set('');
    this.voiceSuggestion.set('');
    this.voiceError.set('');
    this.lastTranscript.set('');
    this.voiceDetectedFilters.set({ city: false, cuisine: false });
    this.page.set(0);
    this.loadRestaurants();
  }

  async onVoiceSearchClick(): Promise<void> {
    this.voiceError.set('');
    this.voiceSuggestion.set('');

    if (!this.voiceSupported()) {
      this.voiceError.set('Voice input is not supported on this browser.');
      return;
    }

    if (this.voiceProcessing()) {
      return;
    }

    if (!this.voiceListening()) {
      try {
        await this.voiceSearchService.startCapture();
        this.voiceListening.set(true);
      } catch {
        this.voiceError.set('Unable to access microphone. Please allow microphone permission.');
      }
      return;
    }

    this.voiceListening.set(false);
    this.voiceProcessing.set(true);

    try {
      const audioBlob = await this.voiceSearchService.stopCapture();
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-search.webm');

      this.http.post<VoiceTranscriptionResponse>('/api/public/voice/transcribe', formData).subscribe({
        next: (result: VoiceTranscriptionResponse) => {
          const transcript = (result.text || '').trim();
          if (!transcript) {
            this.voiceError.set('No speech detected. Please try again.');
            this.voiceProcessing.set(false);
            return;
          }

          const parsed = parseRestaurantVoiceQuery(transcript, this.cities(), this.cuisineOptions());
          this.lastTranscript.set(parsed.cleanedTranscript);
          this.voiceDetectedFilters.set(parsed.detected);
          this.voiceQuery.set(parsed.searchQuery);

          if (parsed.cityId != null) {
            this.selectedCityId.set(parsed.cityId);
          }

          if (parsed.cuisineType) {
            this.cuisineType.set(this.resolveCuisineOption(parsed.cuisineType));
          }

          const hasAnyDetected =
            parsed.detected.city ||
            parsed.detected.cuisine ||
            !!parsed.searchQuery;
          if (!hasAnyDetected) {
            this.voiceSuggestion.set('Try a structured phrase like: Tunisian restaurant in Tunis.');
            this.voiceProcessing.set(false);
            return;
          }

          this.page.set(0);
          this.loadRestaurants();
          this.voiceProcessing.set(false);
        },
        error: (err: any) => {
          this.voiceProcessing.set(false);
          this.voiceError.set(err?.error?.message ?? 'Voice transcription failed.');
        },
      });
    } catch {
      this.voiceProcessing.set(false);
      this.voiceError.set('Voice recording failed. Please try again.');
    }
  }

  previousPage(): void {
    if (this.page() <= 0) {
      return;
    }
    this.page.set(this.page() - 1);
    this.loadRestaurants();
  }

  nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) {
      return;
    }
    this.page.set(this.page() + 1);
    this.loadRestaurants();
  }

  goToPage(index: number): void {
    if (index < 0 || index >= this.totalPages() || index === this.page()) {
      return;
    }
    this.page.set(index);
    this.loadRestaurants();
  }

  restaurantStarStates(restaurantId: number): Array<'full' | 'empty'> {
    const safeRating = this.restaurantRatingById()[restaurantId] ?? 0;
    return Array.from({ length: 5 }, (_, index) => (safeRating >= index + 1 ? 'full' : 'empty'));
  }

  hasRestaurantReviews(restaurantId: number): boolean {
    return (this.restaurantRatingById()[restaurantId] ?? 0) > 0;
  }

  private loadCities(): void {
    this.exploreService.listPublicCities().subscribe({
      next: (cities) => {
        this.cities.set(cities.sort((a, b) => a.name.localeCompare(b.name)));
      },
      error: () => {
        this.cities.set([]);
      },
    });
  }

  private selectedCityNumericId(): number | null {
    const value = this.selectedCityId();
    return value === 'all' ? null : value;
  }

  private loadCuisineOptions(): void {
    const cuisineSet = new Set<string>();
    const maxPagesToScan = 12;

    const fetchPage = (page: number): void => {
      this.exploreService.listRestaurants({
        q: '',
        cityId: null,
        cuisineType: null,
        page,
        size: 100,
        sort: 'restaurantId,desc',
      }).subscribe({
        next: (res) => {
          for (const restaurant of res.content) {
            const cuisine = (restaurant.cuisineType || '').trim();
            if (cuisine) {
              cuisineSet.add(cuisine);
            }
          }

          const reachedEnd = page + 1 >= res.totalPages;
          const reachedSafetyLimit = page + 1 >= maxPagesToScan;
          if (reachedEnd || reachedSafetyLimit) {
            this.cuisineOptions.set(Array.from(cuisineSet).sort((a, b) => a.localeCompare(b)));
            return;
          }

          fetchPage(page + 1);
        },
        error: () => {
          this.cuisineOptions.set(Array.from(cuisineSet).sort((a, b) => a.localeCompare(b)));
        },
      });
    };

    fetchPage(0);
  }

  private loadRestaurants(): void {
    this.loading.set(true);
    this.error.set('');

    this.exploreService.listRestaurants({
      q: this.buildRestaurantQuery(),
      cityId: this.selectedCityNumericId(),
      cuisineType: this.cuisineType(),
      page: this.page(),
      size: this.size,
      sort: this.sort(),
    }).subscribe({
      next: (res) => {
        this.restaurants.set(res.content);
        this.loadRestaurantRatings(res.content);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? this.translate.instant('EXPLORE_SERVICES_RESTAURANTS.ERR_LOAD_RESTAURANTS'));
      },
    });
  }

  private loadRestaurantRatings(restaurants: Restaurant[]): void {
    this.restaurantRatingById.set({});
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

  private buildRestaurantQuery(): string {
    return [this.q().trim(), this.voiceQuery().trim()]
      .filter((value) => !!value)
      .join(' ')
      .trim();
  }

  private resolveCuisineOption(parsedCuisine: string): string {
    const options = this.cuisineOptions();
    if (!options.length) {
      return parsedCuisine;
    }

    const normalizedParsed = this.normalizeLabel(parsedCuisine);
    const exact = options.find((option) => this.normalizeLabel(option) === normalizedParsed);
    if (exact) {
      return exact;
    }

    const close = options.find((option) => {
      const normalizedOption = this.normalizeLabel(option);
      return normalizedOption.includes(normalizedParsed) || normalizedParsed.includes(normalizedOption);
    });

    return close ?? parsedCuisine;
  }

  private normalizeLabel(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
