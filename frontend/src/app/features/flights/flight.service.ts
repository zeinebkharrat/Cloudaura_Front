import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AirportResolveResponse,
  ApiResponse,
  FlightDto,
  FlightSuggestionResponse,
} from './flight.models';

/**
 * All flight data goes through the Spring Boot proxy — never Aviationstack from the browser.
 */
@Injectable({ providedIn: 'root' })
export class FlightService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/flights';

  getAllFlights(limit?: number): Observable<ApiResponse<FlightDto[]>> {
    let params = new HttpParams();
    if (limit != null && limit > 0) {
      params = params.set('limit', String(limit));
    }
    return this.http.get<ApiResponse<FlightDto[]>>(this.base, { params });
  }

  searchByRoute(depIata: string, arrIata: string, limit?: number): Observable<ApiResponse<FlightDto[]>> {
    let params = new HttpParams().set('dep', depIata.trim()).set('arr', arrIata.trim());
    if (limit != null && limit > 0) {
      params = params.set('limit', String(limit));
    }
    return this.http.get<ApiResponse<FlightDto[]>>(`${this.base}/search`, { params });
  }

  suggestForDestination(
    destination: string,
    originIata = 'TUN',
    limit?: number,
  ): Observable<ApiResponse<FlightSuggestionResponse>> {
    let params = new HttpParams().set('destination', destination.trim()).set('origin', originIata.trim());
    if (limit != null && limit > 0) {
      params = params.set('limit', String(limit));
    }
    return this.http.get<ApiResponse<FlightSuggestionResponse>>(`${this.base}/suggest-for-destination`, {
      params,
    });
  }

  resolveAirport(query: string): Observable<ApiResponse<AirportResolveResponse>> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<ApiResponse<AirportResolveResponse>>(`${this.base}/resolve-airport`, { params });
  }
}
