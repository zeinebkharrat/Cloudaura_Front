import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type LudificationGameKind = 'QUIZ' | 'CROSSWORD' | 'PUZZLE' | 'LUDO' | 'ROADMAP_NODE' | 'KARAOKE' | 'GOVERNORATE_GUESS' | 'EL_JEM_QUEST' | 'CHEF_QUEST' | 'CHKOBBA' | 'MUSIC';

export interface GamificationBadgeEntry {
  badgeId: number;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  earnedAt?: string | null;
}

export interface GamificationMe {
  points: number;
  badges: GamificationBadgeEntry[];
}

export interface DailyChallengeRow {
  challengeId: number;
  title: string;
  description?: string | null;
  pointsReward: number;
  validFrom?: string | null;
  validTo?: string | null;
  gameKind: LudificationGameKind;
  targetId?: number | null;
  completed?: boolean;
}



export interface AdminBadge {
  badgeId: number;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  targetGameId?: string | null;
  targetGameKind?: LudificationGameKind | null;
}

export interface AdminDailyChallenge extends DailyChallengeRow {
  active?: boolean;
}

export interface AdminGameUnlockCost {
  gameId: string;
  costPoints: number;
}

export interface AdminPointPackage {
  id?: number;
  name: string;
  pointsAmount: number;
  price: number;
  active: boolean;
}



export interface GamificationReportPayload {
  gameKind: LudificationGameKind;
  gameId: number;
  score: number | null;
  maxScore: number | null;
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/gamification';
  private readonly adminBase = '/api/admin/gamification';

  me(): Observable<GamificationMe> {
    return this.http.get<GamificationMe>(`${this.base}/me`);
  }

  todayChallenges(): Observable<DailyChallengeRow[]> {
    return this.http.get<DailyChallengeRow[]>(`${this.base}/challenges/today`);
  }



  reportGame(body: GamificationReportPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/report-game`, body);
  }

  adminListBadges(): Observable<AdminBadge[]> {
    return this.http.get<AdminBadge[]>(`${this.adminBase}/badges`);
  }

  adminCreateBadge(payload: { name: string; description?: string | null; iconUrl?: string | null; targetGameId?: string | null; targetGameKind?: LudificationGameKind | null }): Observable<AdminBadge> {
    return this.http.post<AdminBadge>(`${this.adminBase}/badges`, payload);
  }

  adminUpdateBadge(
    id: number,
    payload: { name: string; description?: string | null; iconUrl?: string | null; targetGameId?: string | null; targetGameKind?: LudificationGameKind | null }
  ): Observable<AdminBadge> {
    return this.http.put<AdminBadge>(`${this.adminBase}/badges/${id}`, payload);
  }

  adminDeleteBadge(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminBase}/badges/${id}`);
  }

  adminListChallenges(): Observable<AdminDailyChallenge[]> {
    return this.http.get<AdminDailyChallenge[]>(`${this.adminBase}/daily-challenges`);
  }

  adminCreateChallenge(payload: Record<string, unknown>): Observable<AdminDailyChallenge> {
    return this.http.post<AdminDailyChallenge>(`${this.adminBase}/daily-challenges`, payload);
  }

  adminUpdateChallenge(id: number, payload: Record<string, unknown>): Observable<AdminDailyChallenge> {
    return this.http.put<AdminDailyChallenge>(`${this.adminBase}/daily-challenges/${id}`, payload);
  }

  adminDeleteChallenge(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminBase}/daily-challenges/${id}`);
  }



  adminUploadBadgeIcon(file: File): Observable<{ imageUrl: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ imageUrl: string }>(`/api/products/upload-image`, fd);
  }

  adminListUnlockCosts(): Observable<AdminGameUnlockCost[]> {
    return this.http.get<AdminGameUnlockCost[]>(`${this.adminBase}/unlock-costs`);
  }

  adminSaveUnlockCost(payload: { gameId: string; costPoints: number }): Observable<AdminGameUnlockCost> {
    return this.http.post<AdminGameUnlockCost>(`${this.adminBase}/unlock-costs`, payload);
  }

  adminDeleteUnlockCost(gameId: string): Observable<void> {
    return this.http.delete<void>(`${this.adminBase}/unlock-costs/${gameId}`);
  }

  adminListPointPackages(): Observable<AdminPointPackage[]> {
    return this.http.get<AdminPointPackage[]>(`${this.adminBase}/point-packages`);
  }

  adminCreatePointPackage(payload: AdminPointPackage): Observable<AdminPointPackage> {
    return this.http.post<AdminPointPackage>(`${this.adminBase}/point-packages`, payload);
  }

  adminUpdatePointPackage(id: number, payload: AdminPointPackage): Observable<AdminPointPackage> {
    return this.http.put<AdminPointPackage>(`${this.adminBase}/point-packages/${id}`, payload);
  }

  adminDeletePointPackage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminBase}/point-packages/${id}`);
  }
}
