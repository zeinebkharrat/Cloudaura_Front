import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map } from 'rxjs';
import { DataSourceAdapter, TransportSearchParams } from './data-source.adapter';
import {
  City, Accommodation, Transport, Reservation,
  TransportRecommendation, TransportRecommendationRequest,
  TransportReservationInput, TransportReservation,
  AccommodationReservation,
  EngineRecommendationRequest, EngineRecommendationResponse
} from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class MockJsonDataSource implements DataSourceAdapter {
  constructor(private http: HttpClient) {}

  getCities(): Observable<City[]> {
    return this.http.get<{ cities: City[] }>('/assets/data/cities.json').pipe(
      map(res => res.cities),
      delay(800)
    );
  }

  getAccommodations(cityId: number | null): Observable<Accommodation[]> {
    return this.http.get<{ accommodations: Accommodation[] }>('/assets/data/accommodations.json').pipe(
      map(res => {
        if (!cityId) return res.accommodations;
        return res.accommodations.filter(acc => acc.cityId === cityId);
      }),
      delay(1000)
    );
  }

  getAccommodationDetails(id: number, _opts?: { checkIn?: string; checkOut?: string }): Observable<Accommodation> {
    return this.http.get<{ accommodations: Accommodation[] }>('/assets/data/accommodations.json').pipe(
      map(res => {
        const acc = res.accommodations.find(a => a.id === id);
        if (!acc) throw new Error('Accommodation not found');
        return acc;
      }),
      delay(500)
    );
  }

  getTransports(params: TransportSearchParams): Observable<Transport[]> {
    return this.http.get<{ transport: Transport[] }>('/assets/data/transport.json').pipe(
      map(res => res.transport.filter(t =>
        t.departureCityName?.toLowerCase() === params.from.toLowerCase() &&
        t.arrivalCityName?.toLowerCase() === params.to.toLowerCase()
      )),
      delay(1200)
    );
  }

  getTransportById(id: number): Observable<Transport> {
    return this.http.get<{ transport: Transport[] }>('/assets/data/transport.json').pipe(
      map(res => {
        const t = res.transport.find(tr => tr.id === id);
        if (!t) throw new Error('Transport not found');
        return t;
      }),
      delay(500)
    );
  }

  createTransportReservation(input: TransportReservationInput): Observable<TransportReservation> {
    return of({
      transportReservationId: Math.floor(Math.random() * 10000),
      reservationRef: 'YTN-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 99999)).padStart(5, '0'),
      status: 'CONFIRMED' as const,
      paymentStatus: 'PENDING' as const,
      paymentMethod: input.paymentMethod,
      totalPrice: input.numberOfSeats * 35,
      numberOfSeats: input.numberOfSeats,
      travelDate: new Date().toISOString(),
      passengerFirstName: input.passengerFirstName,
      passengerLastName: input.passengerLastName,
      passengerEmail: input.passengerEmail,
      passengerPhone: input.passengerPhone,
      qrCodeToken: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }).pipe(delay(1500));
  }

  getMyTransportReservations(_userId: number): Observable<TransportReservation[]> {
    return of([]).pipe(delay(500));
  }

  cancelTransportReservation(_reservationId: number, _userId: number): Observable<void> {
    return of(undefined).pipe(delay(500));
  }

  getMyAccommodationReservations(_userId: number): Observable<AccommodationReservation[]> {
    return of([]).pipe(delay(400));
  }

  cancelAccommodationReservation(_reservationId: number, _userId: number): Observable<void> {
    return of(undefined).pipe(delay(400));
  }

  createReservation(reservation: Partial<Reservation> & Record<string, unknown>): Observable<Reservation> {
    const r = reservation as Record<string, unknown>;
    if (r['roomId'] != null && Number(r['roomId']) > 0) {
      return of({
        id: Math.floor(Math.random() * 10000),
        status: 'CONFIRMED' as const,
        totalPrice: 0,
        roomId: Number(r['roomId']),
        userId: Number(r['userId']),
      } as Reservation).pipe(delay(1500));
    }
    return of({
      id: Math.floor(Math.random() * 10000),
      status: 'CONFIRMED' as const,
      totalPrice: (reservation as Reservation).totalPrice || 0,
      ...reservation,
    } as Reservation).pipe(delay(1500));
  }

  getTransportRecommendations(request: TransportRecommendationRequest): Observable<TransportRecommendation> {
    return of({
      bestOption: {
        transportType: request.preference === 'cheap' ? 'Bus SNTRI' : 'Taxi',
        price: request.preference === 'cheap' ? 25.5 : 120.0,
        priceFormatted: request.preference === 'cheap' ? '25.50 TND' : '120.00 TND',
        duration: '2h 30min',
        available: true,
        availabilityInfo: 'Disponible immediatement',
        description: 'Meilleure option selon vos criteres',
        score: 85.5,
        features: ['Confortable', 'Sur', 'Ponctuel']
      },
      alternativeOptions: [{
        transportType: 'Louage',
        price: 35.0,
        priceFormatted: '35.00 TND',
        duration: '3h 00min',
        available: true,
        availabilityInfo: 'Depart quand plein',
        description: 'Option economique partagee',
        score: 72.0,
        features: ['Economique', 'Frequent', 'Partage']
      }],
      recommendationReason: `Recommandation basee sur votre preference pour ${request.preference}`,
      combinationSuggestion: 'Taxi vers la station + Louage pour economiser 30%'
    }).pipe(delay(1000));
  }

  getEngineRecommendations(_request: EngineRecommendationRequest): Observable<EngineRecommendationResponse> {
    return of({
      bestOption: {
        transportId: null,
        type: 'Bus SNTRI',
        rawType: 'BUS',
        price: 12.5,
        pricePerPerson: 12.5,
        priceFormatted: '12.50 TND',
        duration: '2h10',
        durationMinutes: 130,
        departureTime: '06:30',
        arrivalTime: '08:40',
        seatsLeft: 35,
        available: true,
        virtual: true,
        description: 'Bus SNTRI – liaison directe',
        features: ['Très économique', 'Ponctuel', 'Clim + bagages inclus'],
        score: 0.15,
        aiScore: 85,
      },
      alternatives: [],
      allOptions: [],
      recommendationReason: 'Bus SNTRI est la solution la plus économique.',
      distanceKm: 178,
      fromCity: 'Tunis',
      toCity: 'Sousse',
      passengers: _request.passengers ?? 1,
    } as EngineRecommendationResponse).pipe(delay(1200));
  }
}
