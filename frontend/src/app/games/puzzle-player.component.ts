import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LudificationService, PuzzleImage } from '../core/ludification.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-puzzle-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './puzzle-player.component.html',
  styleUrl: './puzzle-player.component.css',
})
export class PuzzlePlayerComponent implements OnInit {
  readonly gridSize = 3;
  readonly moves = signal(0);
  readonly won = signal(false);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly puzzle = signal<PuzzleImage | null>(null);
  readonly board = signal<number[]>([]);

  private roadmapNodeId: number | null = null;
  private roadmapRecorded = false;

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
    this.api.canPlayRoadmapNode(nodeId, user.username).subscribe({
      next: (res) => {
        if (!res.allowed) {
          this.loadError.set(res.error ?? 'Cette étape du parcours n’est pas accessible.');
        }
      },
      error: () => {},
    });
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
    this.api.completeRoadmapNode(user.username, nodeId, 1, 1).subscribe({
      next: () => {
        this.roadmapRecorded = true;
      },
      error: () => {},
    });
  }

  backToHub(): void {
    this.router.navigate(['/games']);
  }

  resetBoard(): void {
    const solved = this.solvedBoard();
    const shuffled = [...solved];
    let empty = shuffled.length - 1;
    for (let i = 0; i < 120; i++) {
      const neighbours = this.getNeighbourIndexes(empty);
      const next = neighbours[Math.floor(Math.random() * neighbours.length)];
      [shuffled[empty], shuffled[next]] = [shuffled[next], shuffled[empty]];
      empty = next;
    }
    this.board.set(shuffled);
    this.moves.set(0);
    this.won.set(false);
  }

  tileClicked(index: number): void {
    if (this.won()) return;
    const cells = [...this.board()];
    const empty = cells.indexOf(0);
    if (!this.areAdjacent(index, empty)) return;
    [cells[index], cells[empty]] = [cells[empty], cells[index]];
    this.board.set(cells);
    this.moves.update((m) => m + 1);
    if (this.isSolved(cells)) {
      this.won.set(true);
      this.recordRoadmapProgress();
    }
  }

  getTileStyle(tile: number): Record<string, string> {
    if (tile === 0 || !this.puzzle()?.imageDataUrl) return {};
    const row = Math.floor((tile - 1) / this.gridSize);
    const col = (tile - 1) % this.gridSize;
    return {
      backgroundImage: `url(${this.puzzle()!.imageDataUrl})`,
      backgroundSize: `${this.gridSize * 100}% ${this.gridSize * 100}%`,
      backgroundPosition: `${(col / (this.gridSize - 1)) * 100}% ${(row / (this.gridSize - 1)) * 100}%`,
    };
  }

  private solvedBoard(): number[] {
    const total = this.gridSize * this.gridSize;
    return Array.from({ length: total }, (_, i) => (i + 1) % total);
  }

  private isSolved(cells: number[]): boolean {
    const solved = this.solvedBoard();
    return cells.every((value, i) => value === solved[i]);
  }

  private areAdjacent(a: number, b: number): boolean {
    const ar = Math.floor(a / this.gridSize);
    const ac = a % this.gridSize;
    const br = Math.floor(b / this.gridSize);
    const bc = b % this.gridSize;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  private getNeighbourIndexes(index: number): number[] {
    const row = Math.floor(index / this.gridSize);
    const col = index % this.gridSize;
    const neighbours: number[] = [];
    if (row > 0) neighbours.push(index - this.gridSize);
    if (row < this.gridSize - 1) neighbours.push(index + this.gridSize);
    if (col > 0) neighbours.push(index - 1);
    if (col < this.gridSize - 1) neighbours.push(index + 1);
    return neighbours;
  }
}
