import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Story, StoryInteractionUser } from './story.types';

@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '';

  getFeedStories(): Observable<Story[]> {
    return this.http.get<Story[]>(`${this.baseUrl}/story/feed`);
  }

  getMyStories(): Observable<Story[]> {
    return this.http.get<Story[]>(`${this.baseUrl}/story/my`);
  }

  createStory(file: File, caption?: string, visibility = 'PUBLIC'): Observable<Story> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption && caption.trim()) {
      formData.append('caption', caption.trim());
    }
    formData.append('visibility', visibility);
    formData.append('mediaType', file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE');
    return this.http.post<Story>(`${this.baseUrl}/story/add`, formData);
  }

  markViewed(storyId: number): Observable<Story> {
    return this.http.post<Story>(`${this.baseUrl}/story/view/${storyId}`, {});
  }

  likeStory(storyId: number): Observable<Story> {
    return this.http.post<Story>(`${this.baseUrl}/story/like/${storyId}`, {});
  }

  unlikeStory(storyId: number): Observable<Story> {
    return this.http.delete<Story>(`${this.baseUrl}/story/like/${storyId}`);
  }

  getStoryViewers(storyId: number): Observable<StoryInteractionUser[]> {
    return this.http.get<StoryInteractionUser[]>(`${this.baseUrl}/story/viewers/${storyId}`);
  }

  getStoryLikers(storyId: number): Observable<StoryInteractionUser[]> {
    return this.http.get<StoryInteractionUser[]>(`${this.baseUrl}/story/likers/${storyId}`);
  }
}
