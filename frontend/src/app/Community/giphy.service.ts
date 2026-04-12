import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';

export type GiphyMediaType = 'gif' | 'sticker';

export interface GiphyItem {
  id: string;
  title: string;
  mediaType: GiphyMediaType;
  previewUrl: string;
  fullUrl: string;
}

@Injectable({ providedIn: 'root' })
export class GiphyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/public/giphy';

  search(query: string, type: GiphyMediaType, limit = 20): Observable<GiphyItem[]> {
    const q = query.trim();
    if (!q) {
      return of([]);
    }

    const params = new HttpParams()
      .set('q', q)
      .set('type', type)
      .set('limit', Math.max(1, Math.min(limit, 50)));

    return this.http
      .get<GiphyItem[]>(`${this.baseUrl}/search`, { params })
      .pipe(map((items) => (Array.isArray(items) ? items : [])));
  }
}
