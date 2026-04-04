import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Activity,
  ActivityAvailabilityDay,
  ActivityReservationListItem,
  ActivityMedia,
  ActivityReservationResponse,
  City,
  CityResolveResponse,
  CreatePublicReviewRequest,
  CreateActivityReservationRequest,
  PageResponse,
  PublicReviewPageResponse,
  PublicReview,
  PublicCityDetailsResponse,
  ReviewSummary,
  Restaurant,
} from './explore.models';

@Injectable({ providedIn: 'root' })
export class ExploreService {
  private readonly base = '/api/public';

  constructor(private readonly http: HttpClient) {}

  resolveCityByName(name: string): Observable<CityResolveResponse> {
    const params = new HttpParams().set('name', name);
    return this.http.get<CityResolveResponse>(`${this.base}/cities/resolve`, { params });
  }

  getCityDetails(cityId: number): Observable<PublicCityDetailsResponse> {
    return this.http.get<PublicCityDetailsResponse>(`${this.base}/cities/${cityId}/details`);
  }

  listPublicCities(): Observable<City[]> {
    return this.http.get<{ data?: City[] } | City[]>('/api/cities').pipe(
      map((res) => (Array.isArray(res) ? res : res?.data) ?? [])
    );
  }

  getRestaurantDetails(restaurantId: number): Observable<Restaurant> {
    return this.http.get<Restaurant>(`${this.base}/restaurants/${restaurantId}`);
  }

  listRestaurants(filters: {
    q?: string;
    cityId?: number | null;
    cuisineType?: string | null;
    page: number;
    size: number;
    sort: string;
  }): Observable<PageResponse<Restaurant>> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('size', filters.size)
      .set('sort', filters.sort);

    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }

    if (filters.cityId != null) {
      params = params.set('cityId', filters.cityId);
    }

    if (filters.cuisineType?.trim()) {
      params = params.set('cuisineType', filters.cuisineType.trim());
    }

    return this.http.get<PageResponse<Restaurant>>(`${this.base}/restaurants`, { params });
  }

  getActivityDetails(activityId: number): Observable<Activity> {
    return this.http.get<Activity>(`${this.base}/activities/${activityId}`);
  }

  listRestaurantReviews(restaurantId: number, page: number, size: number): Observable<PublicReviewPageResponse> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', 'createdAt,desc');
    return this.http.get<PublicReviewPageResponse>(`${this.base}/restaurants/${restaurantId}/reviews`, { params });
  }

  createOrUpdateRestaurantReview(restaurantId: number, payload: CreatePublicReviewRequest): Observable<PublicReview> {
    return this.http.post<PublicReview>(`${this.base}/restaurants/${restaurantId}/reviews`, payload);
  }

  getRestaurantReviewSummary(restaurantId: number): Observable<ReviewSummary> {
    return this.http.get<ReviewSummary>(`${this.base}/restaurants/${restaurantId}/reviews/summary`);
  }

  listActivities(filters: {
    q?: string;
    cityId?: number | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    date?: string | null;
    participants?: number | null;
    page: number;
    size: number;
    sort: string;
  }): Observable<PageResponse<Activity>> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('size', filters.size)
      .set('sort', filters.sort);

    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }

    if (filters.cityId != null) {
      params = params.set('cityId', filters.cityId);
    }

    if (filters.minPrice != null) {
      params = params.set('minPrice', filters.minPrice);
    }

    if (filters.maxPrice != null) {
      params = params.set('maxPrice', filters.maxPrice);
    }

    if (filters.date) {
      params = params.set('date', filters.date);
    }

    if (filters.participants != null) {
      params = params.set('participants', Math.max(1, filters.participants));
    }

    return this.http.get<PageResponse<Activity>>(`${this.base}/activities`, { params });
  }

  getActivityMedia(activityId: number): Observable<ActivityMedia[]> {
    return this.http.get<ActivityMedia[]>(`${this.base}/activities/${activityId}/media`);
  }

  listActivityReviews(activityId: number, page: number, size: number): Observable<PublicReviewPageResponse> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', 'createdAt,desc');
    return this.http.get<PublicReviewPageResponse>(`${this.base}/activities/${activityId}/reviews`, { params });
  }

  createOrUpdateActivityReview(activityId: number, payload: CreatePublicReviewRequest): Observable<PublicReview> {
    return this.http.post<PublicReview>(`${this.base}/activities/${activityId}/reviews`, payload);
  }

  getActivityReviewSummary(activityId: number): Observable<ReviewSummary> {
    return this.http.get<ReviewSummary>(`${this.base}/activities/${activityId}/reviews/summary`);
  }

  getActivityAvailability(
    activityId: number,
    from: string,
    days: number,
    participants: number
  ): Observable<ActivityAvailabilityDay[]> {
    const params = new HttpParams()
      .set('from', from)
      .set('days', days)
      .set('participants', participants);
    return this.http.get<ActivityAvailabilityDay[]>(`${this.base}/activities/${activityId}/availability`, { params });
  }

  reserveActivity(activityId: number, payload: CreateActivityReservationRequest): Observable<ActivityReservationResponse> {
    return this.http.post<ActivityReservationResponse>(`${this.base}/activities/${activityId}/reservations`, payload);
  }

  myActivityReservations(page: number, size: number, sort: string): Observable<PageResponse<ActivityReservationListItem>> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', sort);
    return this.http.get<PageResponse<ActivityReservationListItem>>(`${this.base}/my/activity-reservations`, { params });
  }
}
