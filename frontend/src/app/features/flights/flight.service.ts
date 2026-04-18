import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AirportResolveResponse,
  ApiResponse,
  FlightBookingRequest,
  FlightBookingResponse,
  FlightOfferDto,
  FlightSuggestionResponse,
} from './flight.models';

export type FlightSearchType = 'internal' | 'external';

export interface FlightSearchParams {
  dep: string;
  arr?: string;
  date?: string;
  adults?: number;
  cabinClass?: string;
  limit?: number;
  type: FlightSearchType;
}

@Injectable({ providedIn: 'root' })
export class FlightService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/flights';

  getAllFlights(limit?: number): Observable<ApiResponse<FlightOfferDto[]>> {
    let params = new HttpParams();
    if (limit != null && limit > 0) {
      params = params.set('limit', String(limit));
    }
    return this.http.get<ApiResponse<FlightOfferDto[]>>(this.base, { params });
  }

  searchFlights(search: FlightSearchParams): Observable<ApiResponse<FlightOfferDto[]>> {
    let params = new HttpParams()
      .set('dep', search.dep.trim().toUpperCase())
      .set('type', search.type)
      .set('adults', String(Math.max(1, search.adults ?? 1)))
      .set('cabinClass', (search.cabinClass || 'economy').trim());

    const arr = (search.arr || '').trim().toUpperCase();
    if (arr) {
      params = params.set('arr', arr);
    }
    if (search.date) {
      params = params.set('date', search.date);
    }
    if (search.limit != null && search.limit > 0) {
      params = params.set('limit', String(search.limit));
    }

    return this.http.get<ApiResponse<FlightOfferDto[]>>(`${this.base}/search`, { params });
  }

  suggestFlights(
    destination: string,
    originIata?: string,
    limit?: number,
  ): Observable<ApiResponse<FlightSuggestionResponse>> {
    let params = new HttpParams().set('destination', destination.trim());
    const origin = (originIata || '').trim();
    if (origin) {
      params = params.set('origin', origin);
    }
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

  getOfferById(offerId: string): Observable<ApiResponse<FlightOfferDto>> {
    return this.http.get<ApiResponse<FlightOfferDto>>(`${this.base}/offers/${encodeURIComponent(offerId)}`);
  }

  bookFlight(payload: FlightBookingRequest): Observable<ApiResponse<FlightBookingResponse>> {
    return this.http.post<ApiResponse<FlightBookingResponse>>(`${this.base}/book`, payload);
  }

  // Compatibility wrappers for existing call sites.
  searchByRoute(
    depIata: string,
    arrIata: string,
    departureDate?: string,
    adults = 1,
    cabinClass = 'economy',
    limit?: number,
  ): Observable<ApiResponse<FlightOfferDto[]>> {
    return this.searchFlights({
      dep: depIata,
      arr: arrIata,
      date: departureDate,
      adults,
      cabinClass,
      limit,
      type: 'internal',
    });
  }

  suggestForDestination(
    destination: string,
    originIata?: string,
    limit?: number,
  ): Observable<ApiResponse<FlightSuggestionResponse>> {
    return this.suggestFlights(destination, originIata, limit);
  }

  createOrder(payload: FlightBookingRequest): Observable<ApiResponse<FlightBookingResponse>> {
    return this.bookFlight(payload);
  }
}
