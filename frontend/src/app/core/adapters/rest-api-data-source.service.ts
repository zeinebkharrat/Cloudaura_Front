import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DataSourceAdapter, TransportSearchParams } from './data-source.adapter';
import {
  City, Accommodation, Transport, Reservation,
  TransportRecommendation, TransportRecommendationRequest,
  TransportReservationInput, TransportReservation,
  EngineRecommendationRequest, EngineRecommendationResponse
} from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class RestApiDataSource implements DataSourceAdapter {
  private http = inject(HttpClient);
  private readonly BASE = '/api';

  getCities(): Observable<City[]> {
    return this.http.get<any>(`${this.BASE}/cities`).pipe(
      map(res => {
        const raw = Array.isArray(res) ? res : res.data ?? [];
        return raw.map((c: any) => ({
          id: c.cityId ?? c.id,
          name: c.name,
          region: c.region,
          description: c.description,
          latitude: c.latitude,
          longitude: c.longitude,
          coords: { lat: c.latitude, lng: c.longitude },
          stations: {
            bus: !!c.hasBusStation,
            airport: !!c.hasAirport,
            ferry: !!c.hasFerryPort,
            train: !!c.hasTrainStation,
          }
        }));
      })
    );
  }

  getAccommodations(cityId: number | null, filters?: {
    type?: string; minPrice?: number; maxPrice?: number;
    minRating?: number; checkIn?: string; checkOut?: string;
  }): Observable<Accommodation[]> {
    let params = new HttpParams();
    if (cityId) params = params.set('cityId', cityId.toString());
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.minPrice != null) params = params.set('minPrice', filters.minPrice.toString());
    if (filters?.maxPrice != null) params = params.set('maxPrice', filters.maxPrice.toString());
    if (filters?.minRating != null) params = params.set('minRating', filters.minRating.toString());
    if (filters?.checkIn) params = params.set('checkIn', filters.checkIn);
    if (filters?.checkOut) params = params.set('checkOut', filters.checkOut);

    return this.http.get<any>(`${this.BASE}/accommodations/search`, { params }).pipe(
      map(res => (res.data ?? []).map((a: any) => this.mapAccommodation(a)))
    );
  }

  getAccommodationDetails(id: number): Observable<Accommodation> {
    return this.http.get<any>(`${this.BASE}/accommodations/${id}`).pipe(
      map(res => this.mapAccommodation(res.data))
    );
  }

  getTransports(params: TransportSearchParams): Observable<Transport[]> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('departureCityId', params.from);
    if (params.to) httpParams = httpParams.set('arrivalCityId', params.to);
    if (params.date) httpParams = httpParams.set('travelDate', params.date);
    if (params.transportType) httpParams = httpParams.set('type', params.transportType);
    if (params.passengers) httpParams = httpParams.set('numberOfPassengers', params.passengers.toString());

    return this.http.get<any>(`${this.BASE}/transports/search`, { params: httpParams }).pipe(
      map(res => (res.data ?? []).map((t: any) => this.mapTransport(t, params)))
    );
  }

  getTransportById(id: number): Observable<Transport> {
    return this.http.get<any>(`${this.BASE}/transports/${id}`).pipe(
      map(res => {
        const t = res.data ?? res;
        return this.mapTransport(t, {});
      })
    );
  }

  createTransportReservation(input: TransportReservationInput): Observable<TransportReservation> {
    return this.http.post<any>(`${this.BASE}/transport-reservations`, input).pipe(
      map(res => res.data ?? res)
    );
  }

  getMyTransportReservations(): Observable<TransportReservation[]> {
    return this.http.get<any>(`${this.BASE}/transport-reservations/my`).pipe(
      map(res => res.data ?? [])
    );
  }

  cancelTransportReservation(id: number): Observable<void> {
    return this.http.patch<any>(`${this.BASE}/transport-reservations/${id}/cancel`, {}).pipe(
      map(() => undefined)
    );
  }

  createReservation(reservation: Partial<Reservation>): Observable<Reservation> {
    const isAccommodation = !!reservation.roomId;
    const endpoint = isAccommodation
      ? `${this.BASE}/reservations`
      : `${this.BASE}/transport-reservations`;

    return this.http.post<any>(endpoint, reservation).pipe(
      map(res => res.data ?? res)
    );
  }

  getTransportRecommendations(request: TransportRecommendationRequest): Observable<TransportRecommendation> {
    return this.http.post<any>(`${this.BASE}/transport-recommendations`, request).pipe(
      map(res => res.data ?? res)
    );
  }

  private mapTransport(t: any, params: Partial<TransportSearchParams>): Transport {
    return {
      id: t.transportId ?? t.id,
      type: t.type,
      departureTime: t.departureTime,
      arrivalTime: t.arrivalTime,
      price: t.price,
      capacity: t.capacity,
      availableSeats: t.availableSeats,
      durationMinutes: t.durationMinutes,
      isActive: t.isActive ?? true,
      departureCityId: t.departureCityId ?? parseInt(params.from ?? '0'),
      arrivalCityId: t.arrivalCityId ?? parseInt(params.to ?? '0'),
      departureCityName: t.departureCityName,
      arrivalCityName: t.arrivalCityName,
      vehicleBrand: t.vehicleBrand,
      vehicleModel: t.vehicleModel,
      vehiclePhotoUrl: t.vehiclePhotoUrl,
      driverName: t.driverName,
      driverRating: t.driverRating,
      description: t.description,
    };
  }

  private mapAccommodation(a: any): Accommodation {
    return {
      id: a.accommodationId ?? a.id,
      name: a.name,
      type: a.type,
      status: a.status,
      rating: a.rating,
      pricePerNight: a.pricePerNight,
      cityId: a.cityId ?? 0,
      cityName: a.cityName,
      cityRegion: a.cityRegion,
      address: a.address,
      description: a.description,
      mainPhotoUrl: a.mainPhotoUrl,
      availableRoomsCount: a.availableRoomsCount,
      rooms: a.rooms,
      imageUrl: a.imageUrl ?? a.mainPhotoUrl,
      amenities: a.amenities,
    };
  }

  getEngineRecommendations(request: EngineRecommendationRequest): Observable<EngineRecommendationResponse> {
    return this.http.post<any>(`${this.BASE}/engine/recommend`, request).pipe(
      map(res => res.data ?? res)
    );
  }
}
