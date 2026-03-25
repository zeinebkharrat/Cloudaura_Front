import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Comment } from './community.types';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getAllComments(): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/comment/allComments`);
  }

  getComment(commentId: number): Observable<Comment> {
    return this.http.get<Comment>(
      `${this.baseUrl}/comment/getComment/${commentId}`
    );
  }

  addComment(comment: Comment): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseUrl}/comment/addComment`, comment);
  }

  updateComment(comment: Comment): Observable<Comment> {
    return this.http.put<Comment>(`${this.baseUrl}/comment/updateComment`, comment);
  }

  deleteComment(commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comment/deleteComment/${commentId}`);
  }
}

