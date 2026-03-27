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

  getCommentsByPost(postId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/comment/byPost/${postId}`);
  }

  addComment(comment: Omit<Comment, 'commentId' | 'author' | 'createdAt' | 'updatedAt'>): Observable<Comment> {
    // Backend will automatically set the author from JWT token
    return this.http.post<Comment>(`${this.baseUrl}/comment/addComment`, comment);
  }

  updateComment(commentId: number, comment: Omit<Comment, 'commentId' | 'author' | 'createdAt' | 'updatedAt'>): Observable<Comment> {
    // Backend will automatically set the author from JWT token
    return this.http.put<Comment>(`${this.baseUrl}/comment/updateComment/${commentId}`, comment);
  }

  deleteComment(commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comment/deleteComment/${commentId}`);
  }
}

