import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse, Restaurant, RestaurantRequest } from '../admin-api.models';

@Injectable({ providedIn: 'root' })
export class RestaurantAdminService {
  private readonly base = '/api/admin/restaurants';

  constructor(private readonly http: HttpClient) {}

  list(q: string, page: number, size: number, sort: string): Observable<PageResponse<Restaurant>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort);

    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    return this.http.get<PageResponse<Restaurant>>(this.base, { params });
  }

  create(payload: RestaurantRequest): Observable<Restaurant> {
    return this.http.post<Restaurant>(this.base, payload);
  }

  update(id: number, payload: RestaurantRequest): Observable<Restaurant> {
    return this.http.put<Restaurant>(`${this.base}/${id}`, payload);
  }

  uploadImage(id: number, file: File): Observable<Restaurant> {
    const formData = new FormData();
    formData.set('file', file, file.name);
    return this.http.post<Restaurant>(`${this.base}/${id}/upload-image`, formData);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
