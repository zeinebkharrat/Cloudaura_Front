import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LikeEntity } from './community.types';

export interface ToggleLikeResponse {
  liked: boolean;
  like: LikeEntity | null;
  message: string;
}

export interface LikeStatusResponse {
  liked: boolean;
}

export interface LikesByPostResponse {
  likes: LikeEntity[];
  count: number;
  isLikedByCurrentUser: boolean;
  userNicknames: string[];
}

export interface UnlikeResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class LikeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getAllLikes(): Observable<LikeEntity[]> {
    return this.http.get<LikeEntity[]>(`${this.baseUrl}/like/allLikes`);
  }

  getLike(likeId: number): Observable<LikeEntity> {
    return this.http.get<LikeEntity>(`${this.baseUrl}/like/getLike/${likeId}`);
  }

  // New JWT-authenticated methods
  toggleLike(postId: number): Observable<ToggleLikeResponse> {
    return this.http.post<ToggleLikeResponse>(`${this.baseUrl}/like/toggleLike/${postId}`, {});
  }

  isPostLikedByUser(postId: number): Observable<LikeStatusResponse> {
    return this.http.get<LikeStatusResponse>(`${this.baseUrl}/like/isLiked/${postId}`);
  }

  getLikesByPost(postId: number): Observable<LikesByPostResponse> {
    return this.http.get<LikesByPostResponse>(`${this.baseUrl}/like/byPost/${postId}`);
  }

  unlikePost(postId: number): Observable<UnlikeResponse> {
    return this.http.delete<UnlikeResponse>(`${this.baseUrl}/like/unlike/${postId}`);
  }

  // Legacy methods - kept for backward compatibility
  addLike(like: LikeEntity): Observable<LikeEntity> {
    return this.http.post<LikeEntity>(`${this.baseUrl}/like/addLike`, like);
  }

  updateLike(like: LikeEntity): Observable<LikeEntity> {
    return this.http.put<LikeEntity>(`${this.baseUrl}/like/updateLike`, like);
  }

  deleteLike(likeId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/like/deleteLike/${likeId}`);
  }
}

