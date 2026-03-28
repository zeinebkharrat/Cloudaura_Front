import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Post } from './community.types';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from '../core/api-url';

@Injectable({ providedIn: 'root' })
export class SavedPostService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_URL || API_FALLBACK_ORIGIN;

  toggleSave(postId: number): Observable<{ saved: boolean }> {
    return this.http.post<{ saved: boolean }>(`${this.base}/saved-post/toggle/${postId}`, {});
  }

  isSaved(postId: number): Observable<{ saved: boolean }> {
    return this.http.get<{ saved: boolean }>(`${this.base}/saved-post/is-saved/${postId}`);
  }

  mySavedPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.base}/saved-post/my`);
  }
}
