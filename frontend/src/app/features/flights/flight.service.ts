import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AircraftTrackResponse,
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

  /** IATA flight code (e.g. TU712) or numeric flight number (e.g. 712); optional yyyy-MM-dd UTC date. */
  searchByFlight(flight: string, date?: string | null, limit?: number): Observable<ApiResponse<FlightDto[]>> {
    let params = new HttpParams().set('flight', flight.trim());
    if (date != null && String(date).trim().length > 0) {
      params = params.set('date', String(date).trim().slice(0, 10));
    }
    if (limit != null && limit > 0) {
      params = params.set('limit', String(limit));
    }
    return this.http.get<ApiResponse<FlightDto[]>>(`${this.base}/by-flight`, { params });
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

  /** Live position by ICAO24 address (hex, lowercase in URL). */
  trackByIcao24(icao24: string): Observable<ApiResponse<AircraftTrackResponse>> {
    const hex = icao24.trim().toLowerCase();
    return this.http.get<ApiResponse<AircraftTrackResponse>>(`${this.base}/track/${encodeURIComponent(hex)}`);
  }

  /**
   * Resolve schedule via server then OpenSky. {@code flight} e.g. TU712; {@code date} yyyy-MM-dd;
   * optional IATA {@code dep} / {@code arr} sharpen matching.
   */
  trackByFlight(
    flight: string,
    date?: string | null,
    depIata?: string | null,
    arrIata?: string | null,
  ): Observable<ApiResponse<AircraftTrackResponse>> {
    let params = new HttpParams().set('flight', flight.trim());
    if (date != null && String(date).trim().length > 0) {
      params = params.set('date', String(date).trim().slice(0, 10));
    }
    if (depIata != null && String(depIata).trim().length > 0) {
      params = params.set('dep', String(depIata).trim().toUpperCase().slice(0, 4));
    }
    if (arrIata != null && String(arrIata).trim().length > 0) {
      params = params.set('arr', String(arrIata).trim().toUpperCase().slice(0, 4));
    }
    return this.http.get<ApiResponse<AircraftTrackResponse>>(`${this.base}/track`, { params });
  }
}
