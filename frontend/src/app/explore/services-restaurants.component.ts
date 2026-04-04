import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExploreService } from './explore.service';
import { City, Restaurant } from './explore.models';

@Component({
  selector: 'app-services-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './services-restaurants.component.html',
  styleUrl: './services-restaurants.component.css',
})
export class ServicesRestaurantsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal('');
  restaurants = signal<Restaurant[]>([]);
  cities = signal<City[]>([]);
  q = signal('');
  selectedCityId = signal<number | 'all'>('all');
  cuisineType = signal('');
  sort = signal('restaurantId,desc');
  page = signal(0);
  readonly size = 9;
  totalPages = signal(0);
  totalElements = signal(0);
  restaurantRatingById = signal<Record<number, number>>({});

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index));

  constructor(private readonly exploreService: ExploreService) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadRestaurants();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  onSearchChange(value: string): void {
    this.q.set(value);
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

  private loadRestaurants(): void {
    this.loading.set(true);
    this.error.set('');

    this.exploreService.listRestaurants({
      q: this.q(),
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
        this.error.set(err?.error?.message ?? 'Unable to load restaurants');
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
}
