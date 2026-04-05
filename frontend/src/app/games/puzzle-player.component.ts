import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LudificationService, PuzzleImage, RoadmapNode } from '../core/ludification.service';
import { AuthService } from '../core/auth.service';

/**
 * Puzzle « fragments » : les pièces (0 … n²-1) commencent dans les colonnes latérales,
 * l’utilisateur les glisse vers le plateau central. Chaque pièce i ne peut être posée
 * que sur la case d’index i.
 */
@Component({
  selector: 'app-puzzle-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './puzzle-player.component.html',
  styleUrl: './puzzle-player.component.css',
})
export class PuzzlePlayerComponent implements OnInit {
  readonly gridSize = 3;

  /** Case i contient la pièce verrouillée, ou null si encore vide */
  readonly slots = signal<(number | null)[]>([]);
  /** Identifiants des pièces encore dans les bancs gauche/droit */
  readonly bankPieces = signal<number[]>([]);

  readonly moves = signal(0);
  readonly won = signal(false);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly puzzle = signal<PuzzleImage | null>(null);

  private roadmapNodeId: number | null = null;
  private roadmapRecorded = false;

  readonly roadmapStageHint = signal<string | null>(null);
  readonly roadmapStageSaved = signal(false);
  /** Si l’API /complete échoue, on débloque quand même le bouton « suivant » */
  readonly roadmapSaveFailed = signal(false);

  readonly draggingPieceId = signal<number | null>(null);
  readonly dragOverSlotIndex = signal<number | null>(null);
  readonly rejectHint = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: LudificationService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    const rn = this.route.snapshot.queryParamMap.get('roadmapNode');
    if (rn) {
      const n = Number(rn);
      if (Number.isFinite(n) && n > 0) {
        this.roadmapNodeId = n;
      }
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.loadError.set('Puzzle introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.api.getPuzzleById(id).subscribe({
      next: (p) => {
        this.puzzle.set(p);
        this.resetBoard();
        this.isLoading.set(false);
        this.updateRoadmapHint();
        this.verifyRoadmapAccess();
      },
      error: () => {
        this.loadError.set('Puzzle introuvable.');
        this.isLoading.set(false);
      },
    });
  }

  private verifyRoadmapAccess(): void {
    const nodeId = this.roadmapNodeId;
    if (!nodeId) {
      return;
    }
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }
    this.api.canPlayRoadmapNode(nodeId).subscribe({
      next: (res) => {
        if (!res.allowed) {
          this.loadError.set(res.error ?? 'This roadmap step is not available.');
        }
      },
      error: () => {},
    });
  }

  private updateRoadmapHint(): void {
    if (!this.roadmapNodeId) {
      this.roadmapStageHint.set(
        'Astuce : pour valider une étape du parcours, ouvrez ce puzzle depuis la carte du hub Jeux (lien avec étape), pas depuis la liste « Puzzles images ».',
      );
      return;
    }
    if (!this.auth.currentUser()) {
      this.roadmapStageHint.set('Sign in to save the roadmap step when you finish the puzzle.');
      return;
    }
    this.roadmapStageHint.set('Linked path: progress will save automatically when the image is complete.');
  }

  private recordRoadmapProgress(): void {
    const nodeId = this.roadmapNodeId;
    if (!nodeId || this.roadmapRecorded) {
      return;
    }
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }
    this.api.completeRoadmapNode(nodeId, 1, 1).subscribe({
      next: () => {
        this.roadmapRecorded = true;
        this.roadmapStageSaved.set(true);
        this.roadmapStageHint.set(null);
      },
      error: () => {
        this.roadmapSaveFailed.set(true);
        this.roadmapStageHint.set(
          'Could not save the step (network or previous step not completed). Try again from the hub.',
        );
      },
    });
  }

  backToHub(): void {
    this.router.navigate(['/games']);
  }

  /**
   * Après image 100 % reconstituée : va au jeu de l’étape suivante du parcours
   * (même logique que le hub), ou retourne au hub s’il n’y a pas d’étape suivante / pas de parcours.
   */
  goToNextStage(): void {
    if (!this.won()) {
      return;
    }
    const currentId = this.roadmapNodeId;
    if (!currentId) {
      this.router.navigate(['/games']);
      return;
    }

    this.api.getRoadmap().subscribe({
      next: (raw) => {
        const nodes: RoadmapNode[] = Array.isArray(raw) ? raw : [];
        const sorted = [...nodes]
          .map((n) => this.normalizeRoadmapNode(n))
          .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));

        const idx = sorted.findIndex((n) => n.nodeId === currentId);
        if (idx < 0 || idx >= sorted.length - 1) {
          this.router.navigate(['/games']);
          return;
        }
        const next = sorted[idx + 1];
        const nextId = next.nodeId;
        if (nextId == null) {
          this.router.navigate(['/games']);
          return;
        }
        const queryParams = { roadmapNode: String(nextId) };

        const quizId = next.quizId ?? next.quiz?.quizId;
        const crosswordId = next.crosswordId ?? next.crossword?.crosswordId;
        const puzzleId = next.puzzleId;

        if (quizId != null) {
          this.router.navigate(['/games/quiz', quizId], { queryParams });
        } else if (crosswordId != null) {
          this.router.navigate(['/games/crossword', crosswordId], { queryParams });
        } else if (puzzleId != null) {
          this.router.navigate(['/games/puzzle', puzzleId], { queryParams });
        } else {
          this.router.navigate(['/games']);
        }
      },
      error: () => this.router.navigate(['/games']),
    });
  }

  private normalizeRoadmapNode(n: RoadmapNode): RoadmapNode {
    return {
      ...n,
      nodeId: n.nodeId,
      quizId: n.quizId ?? n.quiz?.quizId,
      crosswordId: n.crosswordId ?? n.crossword?.crosswordId,
      puzzleId: n.puzzleId,
      stepOrder: n.stepOrder,
    };
  }

  resetBoard(): void {
    const total = this.gridSize * this.gridSize;
    const ids = Array.from({ length: total }, (_, i) => i);
    this.shuffleInPlace(ids);
    this.bankPieces.set(ids);
    this.slots.set(Array(total).fill(null));
    this.moves.set(0);
    this.won.set(false);
    this.roadmapStageSaved.set(false);
    this.roadmapSaveFailed.set(false);
    this.rejectHint.set(null);
    this.updateRoadmapHint();
  }

  private shuffleInPlace(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /** Moitié des pièces à gauche, moitié à droite */
  bankLeft(): number[] {
    const b = this.bankPieces();
    if (b.length === 0) {
      return [];
    }
    const split = Math.ceil(b.length / 2);
    return b.slice(0, split);
  }

  bankRight(): number[] {
    const b = this.bankPieces();
    if (b.length === 0) {
      return [];
    }
    const split = Math.ceil(b.length / 2);
    return b.slice(split);
  }

  onBankDragStart(event: DragEvent, pieceId: number): void {
    if (this.won()) {
      event.preventDefault();
      return;
    }
    this.draggingPieceId.set(pieceId);
    event.dataTransfer?.setData('application/x-puzzle-piece', String(pieceId));
    event.dataTransfer?.setData('text/plain', String(pieceId));
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onDragEnd(): void {
    this.draggingPieceId.set(null);
    this.dragOverSlotIndex.set(null);
  }

  onSlotDragOver(event: DragEvent, slotIndex: number): void {
    if (this.slots()[slotIndex] !== null) {
      return;
    }
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.dragOverSlotIndex.set(slotIndex);
  }

  onSlotDragLeave(slotIndex: number): void {
    if (this.dragOverSlotIndex() === slotIndex) {
      this.dragOverSlotIndex.set(null);
    }
  }

  onSlotDrop(event: DragEvent, slotIndex: number): void {
    event.preventDefault();
    this.dragOverSlotIndex.set(null);
    if (this.won()) {
      this.onDragEnd();
      return;
    }
    if (this.slots()[slotIndex] !== null) {
      this.onDragEnd();
      return;
    }
    const raw =
      event.dataTransfer?.getData('application/x-puzzle-piece') ||
      event.dataTransfer?.getData('text/plain');
    const pieceId = Number(raw);
    if (!Number.isFinite(pieceId)) {
      this.onDragEnd();
      return;
    }

    if (pieceId !== slotIndex) {
      this.rejectHint.set('Ce fragment ne va pas ici — essayez une autre case.');
      setTimeout(() => this.rejectHint.set(null), 1800);
      this.onDragEnd();
      return;
    }

    this.slots.update((s) => {
      const next = [...s];
      next[slotIndex] = pieceId;
      return next;
    });
    this.bankPieces.update((b) => b.filter((x) => x !== pieceId));
    this.moves.update((m) => m + 1);

    if (this.bankPieces().length === 0) {
      this.won.set(true);
      this.recordRoadmapProgress();
    }
    this.onDragEnd();
  }

  /** Parcours lié (?roadmapNode=) — pour le template */
  hasLinkedRoadmap(): boolean {
    return this.roadmapNodeId !== null;
  }

  isLoggedIn(): boolean {
    return !!this.auth.currentUser();
  }

  /**
   * Bouton « stage suivant » après image 100 % : si parcours + session, on attend l’API ;
   * sans connexion, pas d’enregistrement — le bouton reste utilisable pour le hub / étape suivante.
   */
  canProceedToNextStage(): boolean {
    if (!this.won()) {
      return false;
    }
    if (!this.roadmapNodeId) {
      return true;
    }
    if (!this.auth.currentUser()) {
      return true;
    }
    return this.roadmapStageSaved() || this.roadmapSaveFailed();
  }

  getPieceStyle(pieceId: number): Record<string, string> {
    if (!this.puzzle()?.imageDataUrl) {
      return {};
    }
    const row = Math.floor(pieceId / this.gridSize);
    const col = pieceId % this.gridSize;
    const g = this.gridSize;
    return {
      backgroundImage: `url(${this.puzzle()!.imageDataUrl})`,
      backgroundSize: `${g * 100}% ${g * 100}%`,
      backgroundPosition: `${(col / (g - 1)) * 100}% ${(row / (g - 1)) * 100}%`,
    };
  }
}
