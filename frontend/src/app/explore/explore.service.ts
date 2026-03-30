import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Activity,
  ActivityMedia,
  ActivityReservationResponse,
  CityResolveResponse,
  CreateActivityReservationRequest,
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

  reserveActivity(activityId: number, payload: CreateActivityReservationRequest): Observable<ActivityReservationResponse> {
    return this.http.post<ActivityReservationResponse>(`${this.base}/activities/${activityId}/reservations`, payload);
  }
}
