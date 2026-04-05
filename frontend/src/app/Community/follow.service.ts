import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-url';

export interface ToggleFollowResponse {
  following: boolean;
  followersCount: number;
  followingCount: number;
}

export interface FollowUserSummary {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly http = inject(HttpClient);
  /** Must stay same-origin (empty) so `ng serve` proxies `/follow` and the auth interceptor attaches JWT. */
  private readonly base = API_BASE_URL.length > 0 ? API_BASE_URL : '';

  toggleFollow(targetUserId: number): Observable<ToggleFollowResponse> {
    return this.http.post<ToggleFollowResponse>(`${this.base}/follow/toggle/${targetUserId}`, {});
  }

  isFollowing(targetUserId: number): Observable<{ following: boolean }> {
    return this.http.get<{ following: boolean }>(`${this.base}/follow/is-following/${targetUserId}`);
  }

  followersCount(userId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/follow/followers/${userId}`);
  }

  followingCount(userId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/follow/following/${userId}`);
  }

  followersList(userId: number): Observable<{ users: FollowUserSummary[] }> {
    return this.http.get<{ users: FollowUserSummary[] }>(`${this.base}/follow/followers-list/${userId}`);
  }

  followingList(userId: number): Observable<{ users: FollowUserSummary[] }> {
    return this.http.get<{ users: FollowUserSummary[] }>(`${this.base}/follow/following-list/${userId}`);
  }
}
