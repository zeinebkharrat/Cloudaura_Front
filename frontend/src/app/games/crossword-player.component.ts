import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Crossword, LudificationService } from '../core/ludification.service';

type CrosswordWord = {
  word?: string;
  clue?: string;
  x?: number;
  y?: number;
  dir?: string;
};

type ParsedGrid = {
  rows: number;
  cols: number;
  words: CrosswordWord[];
};

type CrosswordClue = {
  number: number;
  clue: string;
  direction: 'H' | 'V';
  row: number;
  col: number;
  length: number;
};

type CrosswordCell = {
  blocked: boolean;
  solution: string;
  value: string;
  clueNumbers: number[];
  isActive?: boolean;
};

@Component({
  selector: 'app-crossword-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './crossword-player.component.html',
  styleUrl: './crossword-player.component.css',
})
export class CrosswordPlayerComponent implements OnInit {
  crossword = signal<Crossword | null>(null);
  parsedGrid = signal<ParsedGrid | null>(null);
  gridCells = signal<CrosswordCell[][]>([]);
  horizontalClues = signal<CrosswordClue[]>([]);
  verticalClues = signal<CrosswordClue[]>([]);
  validationMessage = signal<{ text: string; success: boolean } | null>(null);
  isLoading = signal(true);
  loadError = signal<string | null>(null);
  
  // Track current direction to help auto-advance
  currentDirection = 'H';

  @ViewChildren('cellInput') cellInputs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: LudificationService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.loadError.set('Identifiant mots croisés invalide.');
      this.isLoading.set(false);
      return;
    }

    this.api.getCrosswordById(id).subscribe({
      next: (crossword) => {
        this.crossword.set(crossword);
        const parsed = this.parseGrid(crossword.gridJson ?? '{}');
        this.parsedGrid.set(parsed);
        if (parsed) {
          this.buildCrosswordBoard(parsed);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Mots croisés introuvables.');
        this.isLoading.set(false);
      },
    });
  }

  backToHub(): void {
    this.router.navigate(['/games']);
  }

  onCellFocus(row: number, col: number): void {
    // Reset active state
    const next = this.gridCells().map(r => r.map(c => ({...c, isActive: false})));
    if (next[row]?.[col]) next[row][col].isActive = true;
    this.gridCells.set(next);
  }

  onCellInput(row: number, col: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const char = (input.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    
    const nextCells = this.gridCells().map(r => r.map(c => ({...c})));
    const cell = nextCells[row]?.[col];
    
    if (!cell || cell.blocked) return;
    
    cell.value = char;
    this.gridCells.set(nextCells);

    if (char) {
      this.moveToNextCell(row, col);
    }
  }

  onKeyDown(row: number, col: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowRight':
        this.currentDirection = 'H';
        this.focusCell(row, col + 1);
        break;
      case 'ArrowLeft':
        this.currentDirection = 'H';
        this.focusCell(row, col - 1);
        break;
      case 'ArrowUp':
        this.currentDirection = 'V';
        this.focusCell(row - 1, col);
        break;
      case 'ArrowDown':
        this.currentDirection = 'V';
        this.focusCell(row + 1, col);
        break;
      case 'Backspace':
        // If current cell is empty, move back
        if (!this.gridCells()[row][col].value) {
          if (this.currentDirection === 'H') this.focusCell(row, col - 1);
          else this.focusCell(row - 1, col);
        }
        break;
      case ' ': // Space toggles direction
        this.currentDirection = this.currentDirection === 'H' ? 'V' : 'H';
        event.preventDefault();
        break;
    }
  }

  private focusCell(row: number, col: number): void {
    const grid = this.gridCells();
    if (row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length || 0)) {
      if (!grid[row][col].blocked) {
        const index = row * (grid[0]?.length || 0) + col;
        const input = this.cellInputs.toArray()[index]?.nativeElement;
        input?.focus();
        input?.select();
      }
    }
  }

  private moveToNextCell(row: number, col: number): void {
    if (this.currentDirection === 'H') {
      this.focusCell(row, col + 1);
    } else {
      this.focusCell(row + 1, col);
    }
  }

  clearGrid(): void {
    const next = this.gridCells().map((row) =>
      row.map((cell) => (cell.blocked ? cell : { ...cell, value: '' }))
    );
    this.gridCells.set(next);
    this.validationMessage.set(null);
  }

  checkGrid(): void {
    const cells = this.gridCells();
    let total = 0;
    let correct = 0;
    let isComplete = true;

    for (const row of cells) {
      for (const cell of row) {
        if (cell.blocked) continue;
        total += 1;
        if (!cell.value) isComplete = false;
        if (cell.value.toUpperCase() === cell.solution.toUpperCase()) {
          correct += 1;
        }
      }
    }

    if (total === 0) {
      this.validationMessage.set({ text: 'Aucune case jouable détectée.', success: false });
      return;
    }

    if (correct === total) {
      this.validationMessage.set({ text: 'Toutes les réponses sont correctes ! Félicitations 🎉', success: true });
    } else if (isComplete) {
      this.validationMessage.set({ text: `Certaines lettres sont incorrectes (${correct}/${total}).`, success: false });
    } else {
      this.validationMessage.set({ text: `Progression : ${correct}/${total} lettres correctes. Continuez !`, success: false });
    }
  }

  private parseGrid(gridJson: string): ParsedGrid | null {
    try {
      const parsed = JSON.parse(gridJson) as Partial<ParsedGrid>;
      return {
        rows: Number(parsed.rows ?? 0),
        cols: Number(parsed.cols ?? 0),
        words: Array.isArray(parsed.words) ? parsed.words : [],
      };
    } catch {
      return null;
    }
  }

  private buildCrosswordBoard(grid: ParsedGrid): void {
    if (grid.rows <= 0 || grid.cols <= 0) {
      this.loadError.set('Grille invalide.');
      this.gridCells.set([]);
      return;
    }

    const board: CrosswordCell[][] = Array.from({ length: grid.rows }, () =>
      Array.from({ length: grid.cols }, () => ({
        blocked: true,
        solution: '',
        value: '',
        clueNumbers: [],
      }))
    );

    const horizontal: CrosswordClue[] = [];
    const vertical: CrosswordClue[] = [];

    grid.words.forEach((word, index) => {
      // CRITICAL: Aligned with ADMIN. x = Row, y = Col.
      // And we remove non-alphabetic chars from word (like spaces)
      const cleanWord = (word.word || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!cleanWord) return;
      
      const direction = word.dir === 'V' ? 'V' : 'H';
      const rowStart = Number(word.x ?? 0); // Changed from word.y
      const colStart = Number(word.y ?? 0); // Changed from word.x
      const clueNumber = index + 1;

      const clue: CrosswordClue = {
        number: clueNumber,
        clue: word.clue || 'Indice indisponible',
        direction,
        row: rowStart,
        col: colStart,
        length: cleanWord.length,
      };
      
      if (direction === 'H') horizontal.push(clue);
      else vertical.push(clue);

      for (let i = 0; i < cleanWord.length; i += 1) {
        const row = direction === 'H' ? rowStart : rowStart + i;
        const col = direction === 'H' ? colStart + i : colStart;
        
        if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) continue;
        
        const cell = board[row][col];
        cell.blocked = false;
        if (!cell.solution) {
          cell.solution = cleanWord[i];
        }
      }

      if (rowStart >= 0 && colStart >= 0 && rowStart < grid.rows && colStart < grid.cols) {
        if (!board[rowStart][colStart].clueNumbers.includes(clueNumber)) {
          board[rowStart][colStart].clueNumbers.push(clueNumber);
        }
      }
    });

    this.gridCells.set(board);
    this.horizontalClues.set(horizontal);
    this.verticalClues.set(vertical);
  }
}
