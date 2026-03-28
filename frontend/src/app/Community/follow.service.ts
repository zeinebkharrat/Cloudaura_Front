import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from '../core/api-url';

export interface ToggleFollowResponse {
  following: boolean;
  followersCount: number;
  followingCount: number;
}

@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_URL || API_FALLBACK_ORIGIN;

  toggleFollow(targetUserId: number): Observable<ToggleFollowResponse> {
    return this.http.post<ToggleFollowResponse>(`${this.base}/follow/toggle/${targetUserId}`, {});
  }

  isFollowing(targetUserId: number): Observable<{ following: boolean }> {
    return this.http.get<{ following: boolean }>(`${this.base}/follow/is-following/${targetUserId}`);
  }

  followersCount(userId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/follow/followers/${userId}`);
  }
}
