import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-url';

export interface KaraokeSong {
  id?: number;
  title: string;
  artist: string;
  audioUrl: string;
  instrumentalUrl?: string;
  lyricsJson: string;
  published: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class KaraokeService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/api/games/karaoke`;

  getPublishedSongs(): Observable<KaraokeSong[]> {
    return this.http.get<KaraokeSong[]>(`${this.apiUrl}/songs`);
  }

  // Admin methods
  getAllSongs(): Observable<KaraokeSong[]> {
    return this.http.get<KaraokeSong[]>(`${this.apiUrl}/admin/songs`);
  }

  saveSong(song: KaraokeSong): Observable<KaraokeSong> {
    return this.http.post<KaraokeSong>(`${this.apiUrl}/admin/songs`, song);
  }

  deleteSong(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/songs/${id}`);
  }

  generateLyrics(title: string, artist: string): Observable<{ lyrics: string }> {
    return this.http.post<{ lyrics: string }>(`${this.apiUrl}/admin/generate-lyrics`, { title, artist });
  }
}
