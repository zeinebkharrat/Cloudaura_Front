import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExploreService } from './explore.service';
import { Activity, City } from './explore.models';

@Component({
  selector: 'app-services-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './services-activities.component.html',
  styleUrl: './services-activities.component.css',
})
export class ServicesActivitiesComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal('');
  activities = signal<Activity[]>([]);
  cities = signal<City[]>([]);
  q = signal('');
  selectedCityId = signal<number | 'all'>('all');
  sort = signal('activityId,desc');
  selectedDate = signal('');
  participants = signal(1);
  readonly sliderMin = 0;
  readonly sliderMax = 1000;
  minPrice = signal(0);
  maxPrice = signal(1000);
  page = signal(0);
  readonly size = 9;
  totalPages = signal(0);
  totalElements = signal(0);
  activityRatingById = signal<Record<number, number>>({});

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private priceDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index));

  constructor(private readonly exploreService: ExploreService) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadActivities();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (this.priceDebounceTimer) {
      clearTimeout(this.priceDebounceTimer);
    }
  }

  onSearchChange(value: string): void {
    this.q.set(value);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.page.set(0);
      this.loadActivities();
    }, 300);
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    this.page.set(0);
    this.loadActivities();
  }

  onCityFilterChange(value: number | 'all'): void {
    this.selectedCityId.set(value);
    this.page.set(0);
    this.loadActivities();
  }

  onMinPriceSliderChange(value: number): void {
    const normalized = Math.max(this.sliderMin, Math.min(value, this.maxPrice()));
    this.minPrice.set(normalized);
    this.schedulePriceFiltering();
  }

  onMaxPriceSliderChange(value: number): void {
    const normalized = Math.min(this.sliderMax, Math.max(value, this.minPrice()));
    this.maxPrice.set(normalized);
    this.schedulePriceFiltering();
  }

  onMinPriceInputChange(value: number): void {
    const normalized = Number.isFinite(value)
      ? Math.max(this.sliderMin, Math.min(value, this.maxPrice()))
      : this.sliderMin;
    this.minPrice.set(normalized);
    this.schedulePriceFiltering();
  }

  onMaxPriceInputChange(value: number): void {
    const normalized = Number.isFinite(value)
      ? Math.min(this.sliderMax, Math.max(value, this.minPrice()))
      : this.sliderMax;
    this.maxPrice.set(normalized);
    this.schedulePriceFiltering();
  }

  onDateChange(value: string): void {
    this.selectedDate.set(value);
    this.page.set(0);
    this.loadActivities();
  }

  onParticipantsChange(value: number): void {
    const normalized = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
    this.participants.set(normalized);
    if (!this.selectedDate()) {
      return;
    }
    this.page.set(0);
    this.loadActivities();
  }

  clearAvailabilityFilter(): void {
    this.selectedDate.set('');
    this.participants.set(1);
    this.page.set(0);
    this.loadActivities();
  }

  previousPage(): void {
    if (this.page() <= 0) {
      return;
    }
    this.page.set(this.page() - 1);
    this.loadActivities();
  }

  nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) {
      return;
    }
    this.page.set(this.page() + 1);
    this.loadActivities();
  }

  goToPage(index: number): void {
    if (index < 0 || index >= this.totalPages() || index === this.page()) {
      return;
    }
    this.page.set(index);
    this.loadActivities();
  }

  activityStarStates(activityId: number): Array<'full' | 'empty'> {
    const safeRating = this.activityRatingById()[activityId] ?? 0;
    return Array.from({ length: 5 }, (_, index) => (safeRating >= index + 1 ? 'full' : 'empty'));
  }

  hasActivityReviews(activityId: number): boolean {
    return (this.activityRatingById()[activityId] ?? 0) > 0;
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

  private schedulePriceFiltering(): void {
    if (this.priceDebounceTimer) {
      clearTimeout(this.priceDebounceTimer);
    }
    this.priceDebounceTimer = setTimeout(() => {
      this.page.set(0);
      this.loadActivities();
    }, 250);
  }

  private loadActivities(): void {
    this.loading.set(true);
    this.error.set('');

    this.exploreService.listActivities({
      q: this.q(),
      cityId: this.selectedCityNumericId(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      date: this.selectedDate() || null,
      participants: this.participants(),
      page: this.page(),
      size: this.size,
      sort: this.sort(),
    }).subscribe({
      next: (res) => {
        this.activities.set(res.content);
        this.loadActivityRatings(res.content);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Unable to load activities');
      },
    });
  }

  private loadActivityRatings(activities: Activity[]): void {
    this.activityRatingById.set({});
    for (const activity of activities) {
      this.exploreService.getActivityReviewSummary(activity.activityId).subscribe({
        next: (summary) => {
          this.activityRatingById.update((current) => ({
            ...current,
            [activity.activityId]: summary?.averageStars ?? 0,
          }));
        },
        error: () => {
          this.activityRatingById.update((current) => ({
            ...current,
            [activity.activityId]: 0,
          }));
        },
      });
    }
  }
}
