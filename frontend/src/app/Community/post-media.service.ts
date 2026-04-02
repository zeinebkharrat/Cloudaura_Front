import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MediaType, PostMedia } from './community.types';

@Injectable({ providedIn: 'root' })
export class PostMediaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '';

  getAllMedias(): Observable<PostMedia[]> {
    return this.http.get<PostMedia[]>(`${this.baseUrl}/media/allMedias`);
  }

  getMedia(mediaId: number): Observable<PostMedia> {
    return this.http.get<PostMedia>(`${this.baseUrl}/media/getMedia/${mediaId}`);
  }

  addMedia(media: PostMedia): Observable<PostMedia> {
    return this.http.post<PostMedia>(`${this.baseUrl}/media/addMedia`, media);
  }

  updateMedia(media: PostMedia): Observable<PostMedia> {
    return this.http.put<PostMedia>(`${this.baseUrl}/media/updateMedia`, media);
  }

  deleteMedia(mediaId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/media/deleteMedia/${mediaId}`);
  }

  /**
   * Uploads an image/video file, stores it on the backend, and creates a PostMedia record.
   * Backend endpoint (to be added): POST /media/upload
   */
  uploadMedia(
    file: File,
    postId: number,
    mediaType: MediaType,
    orderIndex?: number
  ): Observable<PostMedia> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('postId', String(postId));
    fd.append('mediaType', String(mediaType));
    if (orderIndex != null) fd.append('orderIndex', String(orderIndex));

    return this.http.post<PostMedia>(`${this.baseUrl}/media/upload`, fd);
  }
}

