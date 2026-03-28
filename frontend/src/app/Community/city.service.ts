import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CityOption {
  cityId: number;
  name: string;
  region?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CityService {
  private readonly http = inject(HttpClient);

  getCities(): Observable<CityOption[]> {
    return this.http.get<CityOption[]>('/api/cities');
  }
}
