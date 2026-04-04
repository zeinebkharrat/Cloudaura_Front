import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminPost, PageResponse } from '../admin-api.models';

@Injectable({ providedIn: 'root' })
export class PostAdminService {
  private readonly base = '/api/admin/posts';

  constructor(private readonly http: HttpClient) {}

  list(
    q: string,
    userId: number | null,
    tag: string,
    page: number,
    size: number,
    sort: string
  ): Observable<PageResponse<AdminPost>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort);

    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    if (userId != null) {
      params = params.set('userId', userId);
    }

    if (tag.trim()) {
      params = params.set('tag', tag.trim());
    }

    return this.http.get<PageResponse<AdminPost>>(this.base, { params });
  }

  delete(postId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${postId}`);
  }
}
