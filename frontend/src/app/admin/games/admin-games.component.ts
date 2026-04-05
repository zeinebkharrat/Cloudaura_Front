import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  LudificationService,
  Quiz,
  Crossword,
  RoadmapNode,
  QuizQuestion,
  PuzzleImage,
  LudoCard,
} from '../../core/ludification.service';

@Component({
  selector: 'app-admin-games',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-games.component.html',
  styleUrl: './admin-games.component.css'
})
export class AdminGamesComponent implements OnInit {
  activeTab = signal<'QUIZ' | 'CROSSWORD' | 'ROADMAP' | 'PUZZLE' | 'LUDO'>('QUIZ');
  
  quizzes = signal<Quiz[]>([]);
  crosswords = signal<Crossword[]>([]);
  roadmaps = signal<RoadmapNode[]>([]);
  puzzles = signal<PuzzleImage[]>([]);
  ludoCards = signal<LudoCard[]>([]);

  creationMode = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  newQuiz = signal<Partial<Quiz>>({ published: false, title: '', description: '', questions: [] });
  newCrossword = signal<Partial<Crossword>>({ published: false, title: '', description: '', gridJson: '{"words":[]}' });
  crosswordWords = signal<{ word: string, clue: string, x: number, y: number, dir: 'H' | 'V' }[]>([]);
  gridRows = signal<number>(10);
  gridCols = signal<number>(10);
  newRoadmap = signal<Partial<RoadmapNode>>({ stepOrder: 1, nodeLabel: '' });
  newPuzzle = signal<{ title: string; imageDataUrl: string; published: boolean }>({
    title: '',
    imageDataUrl: '',
    published: true,
  });
  puzzleFile = signal<File | null>(null);
  newLudo = signal<Partial<LudoCard>>({
    title: '',
    description: '',
    effectSteps: 0,
    category: 'GENERAL',
    published: true,
  });
  
  constructor(private api: LudificationService) {}

  ngOnInit() { this.refreshAll(); }

  refreshAll() {
    this.api.getQuizzes().subscribe(d => {
      // Parse optionsJson for each question so we can edit it if we ever implement edit mode
      d.forEach(q => {
         if (q.questions) {
            q.questions.forEach(qs => {
               try { qs._tempOptions = JSON.parse(qs.optionsJson ?? '[]'); } catch { qs._tempOptions = ['','','','']; }
            });
         }
      });
      this.quizzes.set(d);
    });
    this.api.getCrosswords().subscribe(d => this.crosswords.set(d));
    this.api.getRoadmap().subscribe(d => this.roadmaps.set(d));
    this.api.getPuzzles().subscribe(d => this.puzzles.set(d));
    this.api.getLudoCards().subscribe(d => this.ludoCards.set(d));
  }
  
  setTab(tab: 'QUIZ' | 'CROSSWORD' | 'ROADMAP' | 'PUZZLE' | 'LUDO') {
    this.activeTab.set(tab); this.creationMode.set(false);
  }

  openCreate() {
    this.creationMode.set(true);
    this.isEditMode.set(false);
    if (this.activeTab() === 'QUIZ') this.newQuiz.set({ published: false, title: '', description: '', questions: [{ questionText: '', optionsJson: '', correctOptionIndex: 0, _tempOptions: ['','','',''], orderIndex: 1 }] });
    else if (this.activeTab() === 'CROSSWORD') {
      this.newCrossword.set({ published: false, title: '', description: '', gridJson: '{"words":[]}' });
      this.crosswordWords.set([]);
      this.gridRows.set(10);
      this.gridCols.set(10);
    }
    else if (this.activeTab() === 'ROADMAP') this.newRoadmap.set({ stepOrder: this.roadmaps().length + 1, nodeLabel: '' });
    else if (this.activeTab() === 'PUZZLE') {
      this.newPuzzle.set({ title: '', imageDataUrl: '', published: true });
      this.puzzleFile.set(null);
    } else {
      this.newLudo.set({ title: '', description: '', effectSteps: 0, category: 'GENERAL', published: true });
    }
  }

  openEdit(item: any) {
    this.creationMode.set(true);
    this.isEditMode.set(true);
    if (this.activeTab() === 'QUIZ') {
      const id = item.quizId;
      if (id != null) {
        this.api.getQuizById(id).subscribe({
          next: (full) => {
            const clone = JSON.parse(JSON.stringify(full));
            if (clone.questions) {
              clone.questions.forEach((qs: QuizQuestion) => {
                try {
                  qs._tempOptions = JSON.parse(qs.optionsJson || '[]');
                } catch {
                  qs._tempOptions = ['', '', '', ''];
                }
              });
            }
            this.newQuiz.set(clone);
          },
          error: () => {
            const clone = JSON.parse(JSON.stringify(item));
            this.newQuiz.set(clone);
          },
        });
      } else {
        this.newQuiz.set(JSON.parse(JSON.stringify(item)));
      }
    } else if (this.activeTab() === 'CROSSWORD') {
      this.newCrossword.set({ ...item });
      try {
        const parsed = JSON.parse(item.gridJson);
        this.crosswordWords.set(parsed.words || []);
        this.gridRows.set(parsed.rows || 10);
        this.gridCols.set(parsed.cols || 10);
      } catch (e) { this.crosswordWords.set([]); this.gridRows.set(10); this.gridCols.set(10); }
    }
  }

  closeCreate() { this.creationMode.set(false); }

  addQuestion() {
    const qz = this.newQuiz();
    const arr = qz.questions || [];
    qz.questions = [...arr, { questionText: '', optionsJson: '', correctOptionIndex: 0, _tempOptions: ['','','',''], orderIndex: arr.length + 1 }];
    this.newQuiz.set({...qz});
  }

  removeQuestion(idx: number) {
    const qz = this.newQuiz();
    if (qz.questions) {
      qz.questions.splice(idx, 1);
      qz.questions.forEach((q, i) => q.orderIndex = i + 1);
      this.newQuiz.set({...qz});
    }
  }

  addCrosswordWord() {
    this.crosswordWords.update(old => [...old, { word: '', clue: '', x: 0, y: 0, dir: 'H' }]);
  }

  removeCrosswordWord(idx: number) {
    this.crosswordWords.update(old => old.filter((_, i) => i !== idx));
  }

  save() {
    if (this.activeTab() === 'QUIZ') {
      const qz = this.newQuiz();
      const title = String(qz.title ?? '').trim();
      if (!title) {
        alert('Enter a title for the quiz.');
        return;
      }
      const questions = qz.questions ?? [];
      if (questions.length === 0) {
        alert('Ajoutez au moins une question.');
        return;
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!String(q.questionText ?? '').trim()) {
          alert(`Question ${i + 1}: enter the question text.`);
          return;
        }
        const opts = q._tempOptions ?? ['', '', '', ''];
        for (let j = 0; j < 4; j++) {
          if (!String(opts[j] ?? '').trim()) {
            alert(`Question ${i + 1}: fill in all 4 answer options.`);
            return;
          }
        }
        const ci = q.correctOptionIndex ?? 0;
        if (ci < 0 || ci > 3) {
          alert(`Question ${i + 1} : choisissez la bonne réponse (une des 4 options).`);
          return;
        }
      }
      const qzToSave = JSON.parse(JSON.stringify(this.newQuiz()));
      if (qzToSave.questions) {
        qzToSave.questions.forEach((q: QuizQuestion) => {
          if (q._tempOptions) q.optionsJson = JSON.stringify(q._tempOptions);
        });
      }
      qzToSave.title = title;
      if (this.isEditMode() && qzToSave.quizId) {
        this.api.updateQuiz(qzToSave.quizId, qzToSave).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      } else {
        this.api.createQuiz(qzToSave).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      }
    } else if (this.activeTab() === 'CROSSWORD') {
      const c = this.newCrossword();
      const ct = String(c.title ?? '').trim();
      if (!ct) {
        alert('Enter a title for the crossword.');
        return;
      }
      let rows = Math.floor(Number(this.gridRows()));
      let cols = Math.floor(Number(this.gridCols()));
      if (!Number.isFinite(rows) || rows < 3 || rows > 40) {
        alert('Row count must be between 3 and 40.');
        return;
      }
      if (!Number.isFinite(cols) || cols < 3 || cols > 40) {
        alert('Column count must be between 3 and 40.');
        return;
      }
      const words = this.crosswordWords();
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const word = String(w.word ?? '').trim().toUpperCase();
        if (!word) {
          alert(`Word #${i + 1}: word cannot be empty (remove the row or fill it in).`);
          return;
        }
        const len = word.length;
        const x = Math.floor(Number(w.x));
        const y = Math.floor(Number(w.y));
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          alert(`Word "${word}": invalid row/column position.`);
          return;
        }
        // x = ligne, y = colonne (comme l’aperçu : H avance les colonnes, V les lignes)
        if (w.dir === 'H') {
          if (x < 0 || x >= rows || y < 0 || y + len > cols) {
            alert(`Word "${word}" does not fit in the grid (${rows}×${cols}).`);
            return;
          }
        } else {
          if (y < 0 || y >= cols || x < 0 || x + len > rows) {
            alert(`Word "${word}" does not fit in the grid (${rows}×${cols}).`);
            return;
          }
        }
      }
      c.title = ct;
      c.gridJson = JSON.stringify({ rows, cols, words: this.crosswordWords() });
      if (this.isEditMode() && c.crosswordId) {
        this.api.updateCrossword(c.crosswordId, c).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      } else {
        this.api.createCrossword(c).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      }
    } else if (this.activeTab() === 'ROADMAP') {
      const r = this.newRoadmap();
      const label = String(r.nodeLabel ?? '').trim();
      if (!label) {
        alert('Enter a label for the roadmap step.');
        return;
      }
      const stepOrder = Math.floor(Number(r.stepOrder));
      if (!Number.isFinite(stepOrder) || stepOrder < 1) {
        alert('Step order must be an integer ≥ 1.');
        return;
      }
      const payload: Partial<RoadmapNode> = {
        stepOrder,
        nodeLabel: label,
        quizId: r.quizId,
        crosswordId: r.crosswordId,
        puzzleId: r.puzzleId,
        quiz: r.quizId ? { quizId: r.quizId } : undefined,
        crossword: r.crosswordId ? { crosswordId: r.crosswordId } : undefined,
      };
      this.api.createRoadmapNode(payload).subscribe(() => { this.refreshAll(); this.closeCreate(); });
    } else if (this.activeTab() === 'PUZZLE') {
      const p = this.newPuzzle();
      const title = p.title.trim();
      if (!title) {
        alert('Enter a puzzle title.');
        return;
      }
      if (!this.puzzleFile()) {
        alert('Add an image to create the puzzle.');
        return;
      }
      this.api
        .createPuzzleWithFile({ title, file: this.puzzleFile()!, published: p.published })
        .subscribe(() => {
          this.refreshAll();
          this.closeCreate();
        });
    } else if (this.activeTab() === 'LUDO') {
      const ludo = this.newLudo();
      if (!String(ludo.title ?? '').trim()) {
        alert('Enter a title for the Ludo card.');
        return;
      }
      let eff = Number(ludo.effectSteps ?? 0);
      if (!Number.isFinite(eff)) {
        alert('L’effet (cases) doit être un nombre valide.');
        return;
      }
      eff = Math.trunc(eff);
      if (eff < -99 || eff > 99) {
        alert('Effect (spaces) must be between -99 and 99.');
        return;
      }
      this.api
        .createLudoCard({
          title: String(ludo.title ?? '').trim(),
          description: String(ludo.description ?? '').trim(),
          effectSteps: eff,
          category: String(ludo.category ?? 'GENERAL'),
          published: Boolean(ludo.published ?? true),
        })
        .subscribe(() => {
          this.refreshAll();
          this.closeCreate();
        });
    }
  }

  deleteItem(id: number | undefined, type: 'QUIZ' | 'CROSSWORD' | 'ROADMAP' | 'PUZZLE' | 'LUDO') {
    if(!id) return;
    if (type === 'QUIZ') this.api.deleteQuiz(id).subscribe(() => this.refreshAll());
    if (type === 'CROSSWORD') this.api.deleteCrossword(id).subscribe(() => this.refreshAll());
    if (type === 'ROADMAP') this.api.deleteRoadmapNode(id).subscribe(() => this.refreshAll());
    if (type === 'PUZZLE') this.api.deletePuzzle(id).subscribe(() => this.refreshAll());
    if (type === 'LUDO') this.api.deleteLudoCard(id).subscribe(() => this.refreshAll());
  }

  onPuzzleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';
      this.newPuzzle.update((old) => ({ ...old, imageDataUrl }));
      this.puzzleFile.set(file);
    };
    reader.readAsDataURL(file);
  }

  get gridPreview(): string[][] {
    const rCount = this.gridRows();
    const cCount = this.gridCols();
    const grid: string[][] = Array(rCount).fill(null).map(() => Array(cCount).fill(''));
    this.crosswordWords().forEach(w => {
       if(!w.word) return;
       for (let i=0; i<w.word.length; i++) {
         const r = w.dir === 'V' ? +w.x + i : +w.x;
         const c = w.dir === 'H' ? +w.y + i : +w.y;
         if (r >= 0 && r < rCount && c >= 0 && c < cCount) {
            grid[r][c] = w.word[i].toUpperCase();
         }
       }
    });
    return grid;
  }
}

