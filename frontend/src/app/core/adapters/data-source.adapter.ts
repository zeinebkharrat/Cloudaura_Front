import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { City, Accommodation, Transport, Reservation } from '../models/travel.models';

export interface DataSourceAdapter {
  getCities(): Observable<City[]>;
  getAccommodations(cityId: number|null): Observable<Accommodation[]>;
  getAccommodationDetails(id: number): Observable<Accommodation>;
  getTransports(params: { from: string; to: string; date?: string }): Observable<Transport[]>;
  createReservation(reservation: Partial<Reservation>): Observable<Reservation>;
}

export const DATA_SOURCE_TOKEN = new InjectionToken<DataSourceAdapter>('DataSourceAdapter');
