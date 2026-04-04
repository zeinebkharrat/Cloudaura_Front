import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LudificationService, PuzzleImage, RoadmapNode, LudoCard } from '../core/ludification.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-user-games',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-games.component.html',
  styleUrl: './user-games.component.css',
})
export class UserGamesComponent implements OnInit {
  roadmapNodes = signal<RoadmapNode[]>([]);
  /** Étapes terminées (IDs) — aligné sur la table user_roadmap_completions */
  completedNodeIds = signal<number[]>([]);
  /** Parcours chargé depuis l’API (sinon mode secours sans persistance serveur) */
  roadmapFromApi = signal(false);
  puzzles = signal<PuzzleImage[]>([]);
  ludoCards = signal<LudoCard[]>([]);
  quizzes = signal<{ quizId?: number; published?: boolean }[]>([]);
  crosswords = signal<{ crosswordId?: number; published?: boolean }[]>([]);
  roadmapNotice = signal<string | null>(null);

  constructor(
    private api: LudificationService,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.api.getQuizzes().subscribe((list) => {
      this.quizzes.set((list ?? []).filter((q) => q.published));
    });

    this.api.getCrosswords().subscribe((list) => {
      this.crosswords.set((list ?? []).filter((c) => c.published));
    });

    this.api.getPuzzles().subscribe((list) => {
      this.puzzles.set((list ?? []).filter((p) => p.published));
    });
    this.api.getLudoCards().subscribe((cards) => {
      this.ludoCards.set((cards ?? []).filter((c) => c.published));
    });

    this.api.getRoadmap().subscribe({
      next: (nodes: unknown) => {
        let activeNodes: RoadmapNode[] = [];
        if (Array.isArray(nodes)) {
          activeNodes = nodes;
        } else if (nodes && typeof nodes === 'object' && Array.isArray((nodes as { content?: RoadmapNode[] }).content)) {
          activeNodes = (nodes as { content: RoadmapNode[] }).content;
        }

        if (activeNodes && activeNodes.length > 0) {
          const normalized = activeNodes.map((node) => ({
            ...node,
            quizId: node.quizId ?? node.quiz?.quizId,
            crosswordId: node.crosswordId ?? node.crossword?.crosswordId,
            puzzleId: node.puzzleId,
          }));
          this.roadmapNodes.set(
            [...normalized].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)),
          );
          this.roadmapFromApi.set(true);
          this.refreshRoadmapProgress();
        } else {
          this.loadFallbackFromQuizzes();
        }
      },
      error: (err) => {
        console.warn('Roadmap endpoint failed or empty, falling back to quizzes direct list', err);
        this.loadFallbackFromQuizzes();
      },
    });
  }

  /** Recharge la progression depuis le backend (à rappeler au retour sur la page). */
  refreshRoadmapProgress() {
    const u = this.auth.currentUser();
    if (!u || !this.roadmapFromApi()) {
      this.completedNodeIds.set([]);
      return;
    }
    this.api.getRoadmapProgress().subscribe({
      next: (r) => this.completedNodeIds.set(r.completedNodeIds ?? []),
      error: () => this.completedNodeIds.set([]),
    });
  }

  loadFallbackFromQuizzes() {
    this.roadmapFromApi.set(false);
    this.completedNodeIds.set([]);
    this.api.getQuizzes().subscribe({
      next: (quizzes) => {
        let fallbacks: RoadmapNode[] = quizzes.map((q, i) => ({
          nodeId: q.quizId,
          stepOrder: i,
          nodeLabel: q.title || `Niveau ${i + 1}`,
          quizId: q.quizId,
        }));

        if (fallbacks.length === 0) {
          fallbacks = Array.from({ length: 6 }, (_, i) => ({
            nodeId: i + 100,
            stepOrder: i,
            nodeLabel: `Épreuve secrète ${i + 1}`,
          }));
        }
        this.roadmapNodes.set(fallbacks);
      },
      error: () => {
        const fallbacks = Array.from({ length: 6 }, (_, i) => ({
          nodeId: i + 100,
          stepOrder: i,
          nodeLabel: `Épreuve réseau ${i + 1}`,
        }));
        this.roadmapNodes.set(fallbacks);
      },
    });
  }

  /** Étape débloquée : la 1re toujours ; les suivantes si l’étape précédente (dans l’ordre trié) est terminée. */
  isUnlocked(index: number): boolean {
    if (index === 0) return true;
    if (!this.roadmapFromApi()) {
      return false;
    }
    const nodes = this.roadmapNodes();
    const prev = nodes[index - 1];
    const prevId = prev?.nodeId;
    if (prevId == null) return false;
    return this.completedNodeIds().includes(prevId);
  }

  isNodeCompleted(index: number): boolean {
    const id = this.roadmapNodes()[index]?.nodeId;
    return id != null && this.completedNodeIds().includes(id);
  }

  /** Première étape accessible mais pas encore terminée (badge « CONTINUE »). */
  currentHighlightIndex(): number {
    const n = this.roadmapNodes();
    for (let i = 0; i < n.length; i++) {
      if (this.isUnlocked(i) && !this.isNodeCompleted(i)) {
        return i;
      }
    }
    return Math.max(0, n.length - 1);
  }

  playNode(node: RoadmapNode, index: number) {
    if (!this.isUnlocked(index)) {
      this.roadmapNotice.set('This step is locked. Complete the previous step first.');
      return;
    }

    const quizId = node.quizId ?? node.quiz?.quizId;
    const crosswordId = node.crosswordId ?? node.crossword?.crosswordId;
    const puzzleId = node.puzzleId;
    const nodeId = node.nodeId;

    const roadmapQuery =
      this.roadmapFromApi() && nodeId != null ? { roadmapNode: String(nodeId) } : undefined;

    if (quizId) {
      this.router.navigate(['/games/quiz', quizId], { queryParams: roadmapQuery });
      return;
    }

    if (crosswordId) {
      this.router.navigate(['/games/crossword', crosswordId], { queryParams: roadmapQuery });
      return;
    }

    if (puzzleId) {
      this.router.navigate(['/games/puzzle', puzzleId], { queryParams: roadmapQuery });
      return;
    }

    const firstRoadmapPlayable = this.roadmapNodes().find(
      (n) => (n.quizId ?? n.quiz?.quizId) || (n.crosswordId ?? n.crossword?.crosswordId) || n.puzzleId
    );

    if (firstRoadmapPlayable) {
      const rq = this.roadmapFromApi() && firstRoadmapPlayable.nodeId != null
        ? { roadmapNode: String(firstRoadmapPlayable.nodeId) }
        : undefined;

      const fallbackQuizId = firstRoadmapPlayable.quizId ?? firstRoadmapPlayable.quiz?.quizId;
      const fallbackCrosswordId = firstRoadmapPlayable.crosswordId ?? firstRoadmapPlayable.crossword?.crosswordId;
      const fallbackPuzzleId = firstRoadmapPlayable.puzzleId;

      if (fallbackQuizId) {
        this.roadmapNotice.set('This step is not set up yet. Redirecting to a playable step.');
        this.router.navigate(['/games/quiz', fallbackQuizId], { queryParams: rq });
        return;
      }
      if (fallbackCrosswordId) {
        this.roadmapNotice.set('This step is not set up yet. Redirecting to a playable step.');
        this.router.navigate(['/games/crossword', fallbackCrosswordId], { queryParams: rq });
        return;
      }
      if (fallbackPuzzleId) {
        this.roadmapNotice.set('This step is not set up yet. Redirecting to a playable step.');
        this.router.navigate(['/games/puzzle', fallbackPuzzleId], { queryParams: rq });
        return;
      }
    }

    const firstQuiz = this.quizzes()[0]?.quizId;
    if (firstQuiz) {
      this.roadmapNotice.set("Aucune liaison directe sur cette étape. Ouverture d'un quiz disponible.");
      this.router.navigate(['/games/quiz', firstQuiz]);
      return;
    }

    const firstCrossword = this.crosswords()[0]?.crosswordId;
    if (firstCrossword) {
      this.roadmapNotice.set('No direct link on this step. Opening an available crossword.');
      this.router.navigate(['/games/crossword', firstCrossword]);
      return;
    }

    const firstPuzzle = this.puzzles()[0]?.puzzleId;
    if (firstPuzzle) {
      this.roadmapNotice.set('No direct link on this step. Opening an available puzzle.');
      this.router.navigate(['/games/puzzle', firstPuzzle]);
      return;
    }

    this.roadmapNotice.set('This step has no game configured yet.');
  }

  playPuzzle(puzzleId: number): void {
    this.router.navigate(['/games/puzzle', puzzleId]);
  }

  playLudo(): void {
    this.router.navigate(['/games/ludo']);
  }
}
