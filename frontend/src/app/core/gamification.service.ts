import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type LudificationGameKind = 'QUIZ' | 'CROSSWORD' | 'PUZZLE' | 'LUDO' | 'ROADMAP_NODE';

export interface GamificationBadgeEntry {
  badgeId: number;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  earnedAt?: string | null;
  tournamentId?: number | null;
  tournamentTitle?: string | null;
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

export interface TournamentRoundRow {
  roundId?: number;
  sequenceOrder: number;
  gameKind: LudificationGameKind;
  gameId: number;
  roundStartsAt?: string | null;
  roundEndsAt?: string | null;
}

export interface ActiveTournament {
  tournamentId: number;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status: string;
  winnerBadgeId?: number | null;
  winnerBadgeName?: string | null;
  rounds: TournamentRoundRow[];
}

export interface AdminBadge {
  badgeId: number;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
}

export interface AdminDailyChallenge extends DailyChallengeRow {
  active?: boolean;
}

export interface AdminTournament {
  tournamentId: number;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status: string;
  winnerBadge?: AdminBadge | null;
  rounds: TournamentRoundRow[];
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

  activeTournaments(): Observable<ActiveTournament[]> {
    return this.http.get<ActiveTournament[]>(`${this.base}/tournaments/active`);
  }

  reportGame(body: GamificationReportPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/report-game`, body);
  }

  adminListBadges(): Observable<AdminBadge[]> {
    return this.http.get<AdminBadge[]>(`${this.adminBase}/badges`);
  }

  adminCreateBadge(payload: { name: string; description?: string | null; iconUrl?: string | null }): Observable<AdminBadge> {
    return this.http.post<AdminBadge>(`${this.adminBase}/badges`, payload);
  }

  adminUpdateBadge(
    id: number,
    payload: { name: string; description?: string | null; iconUrl?: string | null }
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

  adminListTournaments(): Observable<AdminTournament[]> {
    return this.http.get<AdminTournament[]>(`${this.adminBase}/tournaments`);
  }

  adminCreateTournament(payload: Record<string, unknown>): Observable<AdminTournament> {
    return this.http.post<AdminTournament>(`${this.adminBase}/tournaments`, payload);
  }

  adminGoLiveTournament(id: number): Observable<{ status: string; tournamentId: number }> {
    return this.http.post<{ status: string; tournamentId: number }>(`${this.adminBase}/tournaments/${id}/go-live`, {});
  }

  adminFinalizeTournament(id: number): Observable<{ status: string; tournamentId: number }> {
    return this.http.post<{ status: string; tournamentId: number }>(`${this.adminBase}/tournaments/${id}/finalize`, {});
  }

  adminDeleteTournament(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminBase}/tournaments/${id}`);
  }

  adminUploadBadgeIcon(file: File): Observable<{ imageUrl: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ imageUrl: string }>(`/api/products/upload-image`, fd);
  }
}
