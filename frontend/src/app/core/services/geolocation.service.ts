import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, catchError, map, switchMap, tap } from 'rxjs';
import { City, GeoReverseResult } from '../models/travel.models';

const SESSION_KEY = 'ytn_geolocation_city';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private http = inject(HttpClient);

  detectCity(): Observable<City | null> {
    const cached = this.getCached();
    if (cached) return of(cached);

    return this.getBrowserPosition().pipe(
      switchMap(pos =>
        this.http.get<{ data: GeoReverseResult }>('/api/geo/reverse', {
          params: { lat: pos.lat.toString(), lng: pos.lng.toString() }
        })
      ),
      map(res => {
        const geo = res.data;
        if (geo?.matchedInSystem && geo.cityId) {
          const city: City = {
            id: geo.cityId,
            name: geo.name ?? '',
            region: geo.region ?? '',
            latitude: geo.latitude,
            longitude: geo.longitude,
          };
          this.cache(city);
          return city;
        }
        return null;
      }),
      catchError(err => {
        console.warn('Geolocation detection failed:', err);
        return of(null);
      })
    );
  }

  private getBrowserPosition(): Observable<{ lat: number; lng: number }> {
    return new Observable(subscriber => {
      if (!navigator.geolocation) {
        subscriber.error('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          subscriber.next({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          subscriber.complete();
        },
        err => subscriber.error(err),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  private getCached(): City | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private cache(city: City): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(city));
    } catch { /* quota */ }
  }

  clearCache(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
