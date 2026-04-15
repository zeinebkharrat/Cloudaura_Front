import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  DataSourceAdapter,
  TransportCheckoutResult,
  TransportPayPalCreatePayload,
  TransportSearchParams,
} from './data-source.adapter';
import {
  City, Accommodation, Transport, Reservation,
  TransportRecommendation, TransportRecommendationRequest,
  TransportReservationInput, TransportReservation, TransportReservationUpdatePayload,
  TransportCheckoutPayload,
  AccommodationReservation,
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
    if (cityId != null && cityId > 0) params = params.set('cityId', cityId.toString());
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

  getAccommodationDetails(id: number, opts?: { checkIn?: string; checkOut?: string }): Observable<Accommodation> {
    let params = new HttpParams();
    if (opts?.checkIn) params = params.set('checkIn', opts.checkIn);
    if (opts?.checkOut) params = params.set('checkOut', opts.checkOut);
    return this.http.get<any>(`${this.BASE}/accommodations/${id}`, { params }).pipe(
      map(res => this.mapAccommodation(res.data))
    );
  }

  getTransports(params: TransportSearchParams): Observable<Transport[]> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('departureCityId', params.from);
    if (params.to) httpParams = httpParams.set('arrivalCityId', params.to);
    if (params.date) {
      const d = String(params.date);
      const travelDateOnly = d.includes('T') ? d.slice(0, 10) : d;
      httpParams = httpParams.set('travelDate', travelDateOnly);
    }
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
      map((res) => this.mapTransportReservation(res.data ?? res))
    );
  }

  createTransportCheckoutSession(payload: TransportCheckoutPayload): Observable<TransportCheckoutResult> {
    return this.http.post<any>(`${this.BASE}/transport/payments/checkout-session`, payload).pipe(
      map((res) => {
        const data = res.data ?? res;
        const url = data?.url as string | undefined;
        if (!url) {
          throw new Error('Missing checkout URL');
        }
        return { url };
      })
    );
  }

  createAccommodationCheckoutSession(payload: {
    roomId: number;
    userId: number;
    checkIn: string;
    checkOut: string;
    offerId?: number | null;
    presentmentCurrency?: string;
  }): Observable<TransportCheckoutResult> {
    return this.http.post<any>(`${this.BASE}/accommodation/payments/checkout-session`, payload).pipe(
      map((res) => {
        const data = res.data ?? res;
        const url = data?.url as string | undefined;
        if (!url) {
          throw new Error('Missing checkout URL');
        }
        return { url };
      })
    );
  }

  confirmTransportStripeSession(sessionId: string): Observable<TransportReservation> {
    const params = new HttpParams().set('session_id', sessionId);
    return this.http
      .get<any>(`${this.BASE}/transport/payments/confirm-session`, { params })
      .pipe(map((res) => this.mapTransportReservation(res.data ?? res)));
  }

  createTransportPayPalSession(payload: TransportPayPalCreatePayload): Observable<TransportCheckoutResult> {
    return this.http.post<any>(`${this.BASE}/transport/payments/paypal/create`, payload).pipe(
      map((res) => {
        const data = res.data ?? res;
        const url = data?.url as string | undefined;
        if (!url) {
          throw new Error('Missing PayPal approval URL');
        }
        return { url };
      })
    );
  }

  confirmTransportPayPalCapture(token: string, reservationId: number): Observable<TransportReservation> {
    const params = new HttpParams().set('token', token).set('reservationId', String(reservationId));
    return this.http.get<any>(`${this.BASE}/transport/payments/paypal/capture`, { params }).pipe(
      map((res) => {
        const wrap = res.data ?? res;
        const inner = wrap?.reservation ?? wrap;
        return this.mapTransportReservation(inner);
      })
    );
  }

  confirmAccommodationStripeSession(sessionId: string): Observable<Reservation> {
    const params = new HttpParams().set('session_id', sessionId);
    return this.http.get<any>(`${this.BASE}/accommodation/payments/confirm-session`, { params }).pipe(
      map((res) => {
        const d = res.data ?? res;
        return {
          id: d.reservationId ?? d.id,
          accommodationId: d.accommodationId != null ? Number(d.accommodationId) : undefined,
          status: d.status,
          totalPrice: d.totalPrice,
          checkInDate: typeof d.checkIn === 'string' ? d.checkIn.slice(0, 10) : undefined,
          checkOutDate: typeof d.checkOut === 'string' ? d.checkOut.slice(0, 10) : undefined,
          roomId: d.roomId != null ? Number(d.roomId) : undefined,
        } as Reservation;
      })
    );
  }

  getTransportReservation(reservationId: number, userId: number): Observable<TransportReservation> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.get<any>(`${this.BASE}/transport-reservations/${reservationId}`, { params }).pipe(
      map((res) => this.mapTransportReservation(res.data ?? res))
    );
  }

  updateTransportReservation(
    reservationId: number,
    userId: number,
    payload: TransportReservationUpdatePayload
  ): Observable<TransportReservation> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http
      .patch<any>(`${this.BASE}/transport-reservations/${reservationId}`, payload, { params })
      .pipe(map((res) => this.mapTransportReservation(res.data ?? res)));
  }

  getMyTransportReservations(userId: number): Observable<TransportReservation[]> {
    return this.http.get<any>(`${this.BASE}/transport-reservations/user/${userId}`).pipe(
      map((res) => (res.data ?? []).map((x: any) => this.mapTransportReservation(x)))
    );
  }

  cancelTransportReservation(reservationId: number, userId: number): Observable<void> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http
      .patch<any>(`${this.BASE}/transport-reservations/${reservationId}/cancel`, {}, { params })
      .pipe(map(() => undefined));
  }

  /** Backend DTO uses passengerFullName, LocalDateTime as string or array. */
  private mapTransportReservation(x: any): TransportReservation {
    const toIso = (v: unknown): string => {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && v.length >= 3) {
        const y = v[0] as number;
        const mo = v[1] as number;
        const d = v[2] as number;
        const h = (v[3] as number) ?? 0;
        const mi = (v[4] as number) ?? 0;
        return new Date(y, mo - 1, d, h, mi).toISOString();
      }
      return '';
    };
    const full = String(x.passengerFullName ?? '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const firstName = (x.passengerFirstName && String(x.passengerFirstName).trim()) || parts[0] || '';
    const lastName =
      (x.passengerLastName && String(x.passengerLastName).trim()) || parts.slice(1).join(' ') || '';
    return {
      transportReservationId: x.transportReservationId ?? x.id,
      transportId: x.transportId != null ? Number(x.transportId) : undefined,
      reservationRef: x.reservationRef ?? '',
      status: x.status,
      statusLabel: x.statusLabel,
      paymentStatus: x.paymentStatus,
      paymentStatusLabel: x.paymentStatusLabel,
      paymentMethod: x.paymentMethod,
      paymentMethodLabel: x.paymentMethodLabel,
      totalPrice: Number(x.totalPrice) || 0,
      numberOfSeats: Number(x.numberOfSeats) || 0,
      travelDate: toIso(x.travelDate),
      passengerFirstName: firstName,
      passengerLastName: lastName,
      passengerEmail: x.passengerEmail ?? '',
      passengerPhone: x.passengerPhone ?? '',
      qrCodeToken: x.qrCodeToken,
      createdAt: toIso(x.createdAt),
      transportType: x.transportType,
      type: x.type,
      transportTypeLabel: x.transportTypeLabel,
      typeLabel: x.typeLabel,
      departureCityName: x.departureCityName,
      arrivalCityName: x.arrivalCityName,
      departureCityLabel: x.departureCityLabel,
      arrivalCityLabel: x.arrivalCityLabel,
      departureTime: toIso(x.travelDate) || toIso(x.departureTime),
    };
  }

  getMyAccommodationReservations(userId: number): Observable<AccommodationReservation[]> {
    return this.http.get<any>(`${this.BASE}/reservations/user/${userId}`).pipe(
      map((res) => (res.data ?? []).map((x: any) => this.mapAccommodationReservation(x)))
    );
  }

  cancelAccommodationReservation(reservationId: number, userId: number): Observable<void> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http
      .patch<any>(`${this.BASE}/reservations/${reservationId}/cancel`, {}, { params })
      .pipe(map(() => undefined));
  }

  updateAccommodationReservation(
    reservationId: number,
    userId: number,
    checkIn: string,
    checkOut: string
  ): Observable<Reservation> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http
      .patch<any>(
        `${this.BASE}/reservations/${reservationId}`,
        { checkIn: checkIn.slice(0, 10), checkOut: checkOut.slice(0, 10) },
        { params }
      )
      .pipe(
        map((res) => {
          const d = res.data ?? res;
          return {
            id: d.reservationId ?? d.id,
            status: d.status,
            totalPrice: d.totalPrice,
            checkInDate: d.checkIn,
            checkOutDate: d.checkOut,
          } as Reservation;
        })
      );
  }

  private mapAccommodationReservation(x: any): AccommodationReservation {
    const toDateStr = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      if (typeof v === 'string') return v.slice(0, 10);
      if (Array.isArray(v) && v.length >= 3) {
        const y = v[0];
        const m = v[1];
        const d = v[2];
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      return undefined;
    };
    return {
      id: x.reservationId ?? x.id,
      accommodationId: x.accommodationId != null ? Number(x.accommodationId) : undefined,
      roomId: x.roomId != null ? Number(x.roomId) : undefined,
      status: x.status,
      statusLabel: x.statusLabel,
      totalPrice: x.totalPrice,
      accommodationName: x.accommodationName,
      nameLabel: x.nameLabel,
      accommodationCity: x.cityName,
      cityLabel: x.cityLabel,
      checkInDate: toDateStr(x.checkIn),
      checkOutDate: toDateStr(x.checkOut),
      nights: x.nights,
      roomType: x.roomType,
      roomTypeLabel: x.roomTypeLabel,
      paymentMethod: x.paymentMethod,
      paymentMethodLabel: x.paymentMethodLabel,
    };
  }

  createReservation(reservation: Partial<Reservation> & Record<string, unknown>): Observable<Reservation> {
    const r = reservation as Record<string, unknown>;
    const roomId = r['roomId'];
    if (roomId != null && Number(roomId) > 0) {
      return this.http.post<any>(`${this.BASE}/reservations`, {
        roomId: Number(roomId),
        userId: Number(r['userId']),
        checkIn: r['checkIn'],
        checkOut: r['checkOut'],
        offerId: r['offerId'] ?? null,
      }).pipe(
        map((res) => {
          const d = res.data ?? res;
          return {
            id: d.reservationId,
            status: d.status,
            totalPrice: d.totalPrice,
            checkInDate: d.checkIn,
            checkOutDate: d.checkOut,
            nights: d.nights,
            roomId: Number(roomId),
            userId: Number(r['userId']),
          } as Reservation;
        })
      );
    }
    return this.http.post<any>(`${this.BASE}/transport-reservations`, reservation).pipe(
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
      description: t.description,
    };
  }

  private mapAccommodation(a: any): Accommodation {
    const rooms = Array.isArray(a.rooms)
      ? a.rooms.map((room: any) => ({
          id: room.roomId ?? room.id,
          roomType: room.roomType,
          capacity: room.capacity,
          price: room.price,
          available: room.available !== false,
        }))
      : undefined;
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
      rooms,
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
