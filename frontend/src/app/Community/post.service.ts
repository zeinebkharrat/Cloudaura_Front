import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Post } from './community.types';

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getAllPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/post/allPosts`);
  }

  getPost(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/post/getPost/${postId}`);
  }

  addPost(post: Post): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/post/addPost`, post);
  }

  updatePost(post: Post): Observable<Post> {
    return this.http.put<Post>(`${this.baseUrl}/post/updatePost`, post);
  }

  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/post/deletePost/${postId}`);
  }
}

