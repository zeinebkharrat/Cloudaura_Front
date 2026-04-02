import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-url';

/** Aligné sur le backend : liste /api/ludification/quizzes */
export interface Quiz {
  quizId?: number;
  title?: string;
  description?: string;
  published?: boolean;
  createdAt?: string | Date;
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  questionId?: number;
  orderIndex?: number;
  questionText?: string;
  imageUrl?: string;
  optionsJson?: string;
  correctOptionIndex?: number;
  /** Utilisé par l’admin pour éditer les choix avant sérialisation */
  _tempOptions?: string[];
}

/** Réponse GET /quizzes/:id (record côté Java) */
export interface QuizView extends Quiz {
  questions?: QuizQuestion[];
}

export interface Crossword {
  crosswordId?: number;
  title?: string;
  description?: string;
  published?: boolean;
  createdAt?: string | Date;
  gridJson?: string;
}

export interface RoadmapNode {
  nodeId?: number;
  stepOrder?: number;
  nodeLabel?: string;
  quizId?: number;
  crosswordId?: number;
  puzzleId?: number;
  quiz?: { quizId?: number };
  crossword?: { crosswordId?: number };
}

export interface PuzzleImage {
  puzzleId: number;
  title: string;
  imageDataUrl: string;
  published: boolean;
  createdAt: string;
}

export interface LudoCard {
  cardId?: number;
  title: string;
  description: string;
  effectSteps: number;
  category?: string;
  published?: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class LudificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/api/ludification`;

  getQuizzes(): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(`${this.base}/quizzes`);
  }

  getQuizById(id: number): Observable<QuizView> {
    return this.http.get<QuizView>(`${this.base}/quizzes/${id}`);
  }

  createQuiz(payload: Partial<Quiz>): Observable<QuizView> {
    return this.http.post<QuizView>(`${this.base}/quizzes`, this.toQuizUpsertBody(payload));
  }

  updateQuiz(id: number, payload: Partial<Quiz>): Observable<QuizView> {
    return this.http.put<QuizView>(`${this.base}/quizzes/${id}`, this.toQuizUpsertBody(payload));
  }

  deleteQuiz(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/quizzes/${id}`);
  }

  getCrosswords(): Observable<Crossword[]> {
    return this.http.get<Crossword[]>(`${this.base}/crosswords`);
  }

  getCrosswordById(id: number): Observable<Crossword> {
    return this.http.get<Crossword>(`${this.base}/crosswords/${id}`);
  }

  createCrossword(c: Crossword): Observable<Crossword> {
    return this.http.post<Crossword>(`${this.base}/crosswords`, c);
  }

  updateCrossword(id: number, c: Crossword): Observable<Crossword> {
    return this.http.put<Crossword>(`${this.base}/crosswords/${id}`, c);
  }

  deleteCrossword(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/crosswords/${id}`);
  }

  getRoadmap(): Observable<RoadmapNode[]> {
    return this.http.get<RoadmapNode[]>(`${this.base}/roadmap`);
  }

  createRoadmapNode(payload: Partial<RoadmapNode>): Observable<RoadmapNode> {
    const body = {
      stepOrder: payload.stepOrder ?? null,
      nodeLabel: payload.nodeLabel ?? null,
      quizId: payload.quizId ?? null,
      crosswordId: payload.crosswordId ?? null,
      puzzleId: payload.puzzleId ?? null,
    };
    return this.http.post<RoadmapNode>(`${this.base}/roadmap`, body);
  }

  deleteRoadmapNode(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/roadmap/${id}`);
  }

  /** IDs des étapes roadmap terminées (table user_roadmap_completions côté backend). */
  getRoadmapProgress(): Observable<{ completedNodeIds: number[]; username?: string }> {
    return this.http.get<{ completedNodeIds: number[]; username?: string }>(
      `${this.base}/roadmap/progress`
    );
  }

  canPlayRoadmapNode(nodeId: number): Observable<{ allowed: boolean; error?: string }> {
    return this.http.get<{ allowed: boolean; error?: string }>(
      `${this.base}/roadmap/nodes/${nodeId}/can-play`
    );
  }

  completeRoadmapNode(
    nodeId: number,
    score?: number,
    maxScore?: number,
  ): Observable<{ saved?: boolean; alreadyCompleted?: boolean; nodeId?: number; error?: string }> {
    const body: Record<string, number | undefined> = {};
    if (score !== undefined) body['score'] = score;
    if (maxScore !== undefined) body['maxScore'] = maxScore;
    return this.http.post<{ saved?: boolean; alreadyCompleted?: boolean; nodeId?: number; error?: string }>(
      `${this.base}/roadmap/nodes/${nodeId}/complete`,
      body,
    );
  }

  // --- Puzzle image (front local storage) ---
  getPuzzles(): Observable<PuzzleImage[]> {
    return this.http.get<PuzzleImage[]>(`${this.base}/puzzles`);
  }

  getPuzzleById(id: number): Observable<PuzzleImage> {
    return this.http.get<PuzzleImage>(`${this.base}/puzzles/${id}`);
  }

  createPuzzle(payload: { title: string; imageDataUrl: string; published?: boolean }): Observable<PuzzleImage> {
    return this.http.post<PuzzleImage>(`${this.base}/puzzles`, {
      title: payload.title.trim(),
      imageDataUrl: payload.imageDataUrl,
      published: payload.published ?? true,
    });
  }

  createPuzzleWithFile(payload: { title: string; file: File; published?: boolean }): Observable<PuzzleImage> {
    const form = new FormData();
    form.append('title', payload.title.trim());
    form.append('published', String(payload.published ?? true));
    form.append('file', payload.file);
    return this.http.post<PuzzleImage>(`${this.base}/puzzles/upload`, form);
  }

  deletePuzzle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/puzzles/${id}`);
  }

  getLudoCards(): Observable<LudoCard[]> {
    return this.http.get<LudoCard[]>(`${this.base}/ludo/cards`);
  }

  createLudoCard(payload: Partial<LudoCard>): Observable<LudoCard> {
    return this.http.post<LudoCard>(`${this.base}/ludo/cards`, {
      title: payload.title ?? '',
      description: payload.description ?? '',
      effectSteps: payload.effectSteps ?? 0,
      category: payload.category ?? 'GENERAL',
      published: payload.published ?? true,
    });
  }

  deleteLudoCard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/ludo/cards/${id}`);
  }

  private toQuizUpsertBody(p: Partial<Quiz>): Record<string, unknown> {
    return {
      title: p.title ?? null,
      description: p.description ?? null,
      published: p.published ?? null,
      createdAt: p.createdAt ?? null,
      questions: (p.questions ?? []).map((q) => ({
        orderIndex: q.orderIndex ?? null,
        questionText: q.questionText ?? null,
        imageUrl: q.imageUrl ?? null,
        optionsJson: q.optionsJson ?? null,
        correctOptionIndex: q.correctOptionIndex ?? null,
      })),
    };
  }

}
