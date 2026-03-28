import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Activity,
  ActivityAvailabilityDay,
  ActivityReservationListItem,
  ActivityMedia,
  ActivityReservationResponse,
  CityResolveResponse,
  CreateActivityReservationRequest,
  PageResponse,
  PublicCityDetailsResponse,
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

  getRestaurantDetails(restaurantId: number): Observable<Restaurant> {
    return this.http.get<Restaurant>(`${this.base}/restaurants/${restaurantId}`);
  }

  getActivityDetails(activityId: number): Observable<Activity> {
    return this.http.get<Activity>(`${this.base}/activities/${activityId}`);
  }

  getActivityMedia(activityId: number): Observable<ActivityMedia[]> {
    return this.http.get<ActivityMedia[]>(`${this.base}/activities/${activityId}/media`);
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