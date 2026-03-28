import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map } from 'rxjs';
import { DataSourceAdapter } from './data-source.adapter';
import { City, Accommodation, Transport, Reservation } from '../models/travel.models';

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

  getAccommodationDetails(id: number): Observable<Accommodation> {
    return this.http.get<{ accommodations: Accommodation[] }>('/assets/data/accommodations.json').pipe(
      map(res => {
        const acc = res.accommodations.find(a => a.id === id);
        if (!acc) throw new Error('Accommodation not found');
        return acc;
      }),
      delay(500)
    );
  }

  getTransports(params: { from: string; to: string; date?: string }): Observable<Transport[]> {
    return this.http.get<{ transport: Transport[] }>('/assets/data/transport.json').pipe(
      map(res => {
        return res.transport.filter(t => 
          t.departure.toLowerCase() === params.from.toLowerCase() && 
          t.arrival.toLowerCase() === params.to.toLowerCase()
        );
      }),
      delay(1200)
    );
  }

  createReservation(reservation: Partial<Reservation>): Observable<Reservation> {
    const newReservation: Reservation = {
      id: crypto.randomUUID(),
      status: 'CONFIRMED',
      totalPrice: reservation.totalPrice || 0,
      ...reservation
    } as Reservation;
    
    return of(newReservation).pipe(delay(1500));
  }
}
