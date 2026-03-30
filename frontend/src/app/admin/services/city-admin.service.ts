import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { City, CityMedia, CityMediaRequest, CityRequest, MediaType, PageResponse } from '../admin-api.models';

@Injectable({ providedIn: 'root' })
export class CityAdminService {
  private readonly base = '/api/admin';

  constructor(private readonly http: HttpClient) {}

  listCities(q: string, page: number, size: number, sort: string): Observable<PageResponse<City>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort);

    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    return this.http.get<PageResponse<City>>(`${this.base}/cities`, { params });
  }

  createCity(payload: CityRequest): Observable<City> {
    return this.http.post<City>(`${this.base}/cities`, payload);
  }

  updateCity(cityId: number, payload: CityRequest): Observable<City> {
    return this.http.put<City>(`${this.base}/cities/${cityId}`, payload);
  }

  deleteCity(cityId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/cities/${cityId}`);
  }

  listCityMedia(cityId: number | null, q: string, page: number, size: number, sort: string): Observable<PageResponse<CityMedia>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort);

    if (cityId != null) {
      params = params.set('cityId', cityId);
    }
    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    return this.http.get<PageResponse<CityMedia>>(`${this.base}/city-media`, { params });
  }

  createCityMedia(payload: CityMediaRequest): Observable<CityMedia> {
    return this.http.post<CityMedia>(`${this.base}/city-media`, payload);
  }

  uploadCityMedia(cityId: number, mediaType: MediaType, file: File): Observable<CityMedia> {
    const formData = new FormData();
    formData.set('cityId', String(cityId));
    formData.set('mediaType', mediaType);
    formData.set('file', file, file.name);
    return this.http.post<CityMedia>(`${this.base}/city-media/upload`, formData);
  }

  deleteCityMedia(mediaId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/city-media/${mediaId}`);
  }
}
