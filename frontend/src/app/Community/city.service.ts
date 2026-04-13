import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CityOption {
  cityId: number;
  name: string;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Backend CityController wraps list in ApiResponse { success, data, ... }. */
interface ApiResponseWrapper<T> {
  success?: boolean;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class CityService {
  private readonly http = inject(HttpClient);

  getCities(): Observable<CityOption[]> {
    return this.http.get<ApiResponseWrapper<CityOption[]> | CityOption[]>('/api/cities').pipe(
      map((res) => {
        if (Array.isArray(res)) {
          return res;
        }
        const data = (res as ApiResponseWrapper<CityOption[]>)?.data;
        return Array.isArray(data) ? data : [];
      })
    );
  }
}
