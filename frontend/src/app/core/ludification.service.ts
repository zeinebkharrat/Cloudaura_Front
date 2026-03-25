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
  quiz?: { quizId?: number };
  crossword?: { crosswordId?: number };
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
    };
    return this.http.post<RoadmapNode>(`${this.base}/roadmap`, body);
  }

  deleteRoadmapNode(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/roadmap/${id}`);
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
