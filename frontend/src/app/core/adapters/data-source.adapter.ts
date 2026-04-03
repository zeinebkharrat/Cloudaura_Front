import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  City, Accommodation, Transport, Reservation,
  TransportRecommendation, TransportRecommendationRequest,
  TransportReservationInput, TransportReservation,
  AccommodationReservation,
  EngineRecommendationRequest, EngineRecommendationResponse
} from '../models/travel.models';

export interface TransportSearchParams {
  from: string;
  to: string;
  date?: string;
  transportType?: string;
  passengers?: number;
}

export interface DataSourceAdapter {
  getCities(): Observable<City[]>;

  getAccommodations(cityId: number | null, filters?: {
    type?: string; minPrice?: number; maxPrice?: number;
    minRating?: number; checkIn?: string; checkOut?: string;
  }): Observable<Accommodation[]>;

  getAccommodationDetails(id: number, opts?: { checkIn?: string; checkOut?: string }): Observable<Accommodation>;

  getTransports(params: TransportSearchParams): Observable<Transport[]>;

  getTransportById(id: number): Observable<Transport>;

  createTransportReservation(input: TransportReservationInput): Observable<TransportReservation>;

  getMyTransportReservations(userId: number): Observable<TransportReservation[]>;

  cancelTransportReservation(reservationId: number, userId: number): Observable<void>;

  getMyAccommodationReservations(userId: number): Observable<AccommodationReservation[]>;

  cancelAccommodationReservation(reservationId: number, userId: number): Observable<void>;

  createReservation(reservation: Partial<Reservation> & Record<string, unknown>): Observable<Reservation>;

  getTransportRecommendations(request: TransportRecommendationRequest): Observable<TransportRecommendation>;

  /** DB-backed AI engine – city IDs + dynamic calculation. */
  getEngineRecommendations(request: EngineRecommendationRequest): Observable<EngineRecommendationResponse>;
}

export const DATA_SOURCE_TOKEN = new InjectionToken<DataSourceAdapter>('DataSourceAdapter');
