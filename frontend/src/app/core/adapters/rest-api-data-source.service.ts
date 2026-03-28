import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DataSourceAdapter } from './data-source.adapter';
import { City, Accommodation, Transport, Reservation } from '../models/travel.models';

@Injectable({
  providedIn: 'root'
})
export class RestApiDataSource implements DataSourceAdapter {
  private http = inject(HttpClient);
  private readonly BASE_URL = 'http://localhost:8080/api';

  getCities(): Observable<City[]> {
    return this.http.get<any>(`${this.BASE_URL}/cities`).pipe(
      map(res => res.data.map((c: any) => ({
        id: c.cityId,
        name: c.name,
        region: c.region,
        description: c.description,
        coords: { lat: c.latitude, lng: c.longitude },
        stations: { 
          bus: !!c.hasBusStation, 
          airport: !!c.hasAirport, 
          ferry: !!c.hasFerryPort, 
          train: false 
        }
      })))
    );
  }

  getAccommodations(cityId: number | null): Observable<Accommodation[]> {
    let params = new HttpParams();
    if (cityId) params = params.set('cityId', cityId.toString());
    
    return this.http.get<any>(`${this.BASE_URL}/accommodations/search`, { params }).pipe(
      map(res => res.data.map((a: any) => this.mapAccommodation(a)))
    );
  }

  getAccommodationDetails(id: number): Observable<Accommodation> {
    return this.http.get<any>(`${this.BASE_URL}/accommodations/${id}`).pipe(
      map(res => this.mapAccommodation(res.data))
    );
  }

  getTransports(params: { from: string; to: string; date?: string }): Observable<Transport[]> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('departureCityId', params.from);
    if (params.to) httpParams = httpParams.set('arrivalCityId', params.to);
    if (params.date) httpParams = httpParams.set('travelDate', params.date);

    return this.http.get<any>(`${this.BASE_URL}/transports/search`, { params: httpParams }).pipe(
      map(res => res.data.map((t: any) => ({
        id: t.transportId,
        type: t.type,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        price: t.price,
        capacity: t.capacity,
        isActive: t.isActive,
        departureCityId: parseInt(params.from),
        arrivalCityId: parseInt(params.to),
        departureCityName: t.departureCityName,
        arrivalCityName: t.arrivalCityName,
        vehicleBrand: t.vehicleBrand,
        vehicleModel: t.vehicleModel
      })))
    );
  }

  createReservation(reservation: Partial<Reservation>): Observable<Reservation> {
    const isAccommodation = !!reservation.roomId;
    const endpoint = isAccommodation ? `${this.BASE_URL}/reservations` : `${this.BASE_URL}/transport-reservations`;
    
    return this.http.post<any>(endpoint, reservation).pipe(
      map(res => res.data)
    );
  }

  private mapAccommodation(a: any): Accommodation {
    return {
      id: a.accommodationId,
      name: a.name,
      type: a.type,
      status: a.status,
      rating: a.rating,
      pricePerNight: a.pricePerNight,
      cityId: a.city?.cityId || 0,
      cityName: a.city?.name,
      cityRegion: a.city?.region,
      imageUrl: a.imageUrl,
      amenities: a.amenities
    };
  }
}
