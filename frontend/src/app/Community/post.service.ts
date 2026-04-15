import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Post } from './community.types';

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '';

  getAllPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/post/allPosts`);
  }

  getMyPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/post/myPosts`);
  }

  getPost(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/post/getPost/${postId}`);
  }

  addPost(post: Omit<Post, 'postId' | 'author' | 'createdAt' | 'updatedAt'>): Observable<Post> {
    // Backend will automatically set the author from JWT token
    return this.http.post<Post>(`${this.baseUrl}/post/addPost`, post);
  }

  updatePost(postId: number, post: Omit<Post, 'postId' | 'author' | 'createdAt' | 'updatedAt'>): Observable<Post> {
    // Backend will automatically set the author from JWT token
    return this.http.put<Post>(`${this.baseUrl}/post/updatePost/${postId}`, post);
  }

  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/post/deletePost/${postId}`);
  }

  repost(postId: number, caption = ''): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/post/repost/${postId}`, { caption });
  }

  recordView(postId: number): Observable<{ counted: boolean }> {
    return this.http.post<{ counted: boolean }>(`${this.baseUrl}/post/recordView/${postId}`, {});
  }
}

