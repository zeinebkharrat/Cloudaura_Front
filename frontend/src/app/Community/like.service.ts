import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LikeEntity } from './community.types';

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

