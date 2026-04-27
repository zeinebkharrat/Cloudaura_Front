import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  City, Accommodation, Transport, Reservation,
  TransportRecommendation, TransportRecommendationRequest,
  TransportReservationInput, TransportReservation, TransportReservationUpdatePayload,
  TransportCheckoutPayload,
  TransportPayPalCreatePayload,
  AccommodationReservation,
  EngineRecommendationRequest, EngineRecommendationResponse,
  TransportEstimateInput,
  TransportEstimateResult,
  AmadeusCarSearchParams,
  AmadeusCarOffer,
  CarBookSimulationResult,
} from '../models/travel.models';

export interface TransportSearchParams {
  from: string;
  to: string;
  date?: string;
  transportType?: string;
  passengers?: number;
}

/** POST /api/transport/payments/checkout-session — absolute Stripe URL or in-app path starting with `/`. */
export interface TransportCheckoutResult {
  url: string;
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

  /** Taxi & bus indicative price band (+ holiday advisory). */
  estimateTransport(input: TransportEstimateInput): Observable<TransportEstimateResult>;

  /** Car rental search (GET /api/cars/search): Tunisia fleet by city/IATA; optional Amadeus when enabled. */
  searchAmadeusCars(params: AmadeusCarSearchParams): Observable<AmadeusCarOffer[]>;

  /** Simulated booking (POST /api/cars/book-simulation). */
  simulateAmadeusCarBooking(offerId: string): Observable<CarBookSimulationResult>;

  createTransportReservation(input: TransportReservationInput): Observable<TransportReservation>;

  createTransportCheckoutSession(payload: TransportCheckoutPayload): Observable<TransportCheckoutResult>;

  /** POST /api/accommodation/payments/checkout-session */
  createAccommodationCheckoutSession(payload: {
    roomId: number;
    userId: number;
    guestCount: number;
    checkIn: string;
    checkOut: string;
    offerId?: number | null;
    presentmentCurrency?: string;
  }): Observable<TransportCheckoutResult>;

  confirmTransportStripeSession(sessionId: string): Observable<TransportReservation>;

  createTransportPayPalSession(payload: TransportPayPalCreatePayload): Observable<TransportCheckoutResult>;

  confirmTransportPayPalCapture(token: string, reservationId: number): Observable<TransportReservation>;

  confirmAccommodationStripeSession(sessionId: string): Observable<Reservation>;

  getTransportReservation(reservationId: number, userId: number): Observable<TransportReservation>;

  updateTransportReservation(
    reservationId: number,
    userId: number,
    payload: TransportReservationUpdatePayload
  ): Observable<TransportReservation>;

  getMyTransportReservations(userId: number): Observable<TransportReservation[]>;

  cancelTransportReservation(reservationId: number, userId: number): Observable<void>;

  getMyAccommodationReservations(userId: number): Observable<AccommodationReservation[]>;

  cancelAccommodationReservation(reservationId: number, userId: number): Observable<void>;

  updateAccommodationReservation(
    reservationId: number,
    userId: number,
    checkIn: string,
    checkOut: string
  ): Observable<Reservation>;

  createReservation(reservation: Partial<Reservation> & Record<string, unknown>): Observable<Reservation>;

  getTransportRecommendations(request: TransportRecommendationRequest): Observable<TransportRecommendation>;

  /** DB-backed AI engine – city IDs + dynamic calculation. */
  getEngineRecommendations(request: EngineRecommendationRequest): Observable<EngineRecommendationResponse>;
}

export const DATA_SOURCE_TOKEN = new InjectionToken<DataSourceAdapter>('DataSourceAdapter');
