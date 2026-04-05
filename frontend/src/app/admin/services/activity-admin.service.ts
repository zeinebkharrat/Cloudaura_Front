import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Activity, ActivityMedia, ActivityRequest, MediaType, PageResponse } from '../admin-api.models';

@Injectable({ providedIn: 'root' })
export class ActivityAdminService {
  private readonly base = '/api/admin/activities';
  private readonly mediaBase = '/api/admin/activity-media';

  constructor(private readonly http: HttpClient) {}

  list(q: string, page: number, size: number, sort: string): Observable<PageResponse<Activity>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort);

    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    return this.http.get<PageResponse<Activity>>(this.base, { params });
  }

  create(payload: ActivityRequest): Observable<Activity> {
    return this.http.post<Activity>(this.base, payload);
  }

  update(id: number, payload: ActivityRequest): Observable<Activity> {
    return this.http.put<Activity>(`${this.base}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  listMedia(activityId: number | null, q: string, page: number, size: number, sort: string): Observable<PageResponse<ActivityMedia>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort);

    if (activityId != null) {
      params = params.set('activityId', activityId);
    }
    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    return this.http.get<PageResponse<ActivityMedia>>(this.mediaBase, { params });
  }

  uploadMedia(activityId: number, mediaType: MediaType, file: File): Observable<ActivityMedia> {
    const formData = new FormData();
    formData.set('activityId', String(activityId));
    formData.set('mediaType', mediaType);
    formData.set('file', file, file.name);
    return this.http.post<ActivityMedia>(`${this.mediaBase}/upload`, formData);
  }

  deleteMedia(mediaId: number): Observable<void> {
    return this.http.delete<void>(`${this.mediaBase}/${mediaId}`);
  }
}
