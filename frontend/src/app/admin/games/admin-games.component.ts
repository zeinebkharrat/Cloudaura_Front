import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LudificationService, Quiz, Crossword, RoadmapNode, QuizQuestion } from '../../core/ludification.service';

@Component({
  selector: 'app-admin-games',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-games.component.html',
  styleUrl: './admin-games.component.css'
})
export class AdminGamesComponent implements OnInit {
  activeTab = signal<'QUIZ' | 'CROSSWORD' | 'ROADMAP'>('QUIZ');
  
  quizzes = signal<Quiz[]>([]);
  crosswords = signal<Crossword[]>([]);
  roadmaps = signal<RoadmapNode[]>([]);

  creationMode = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  newQuiz = signal<Partial<Quiz>>({ published: false, title: '', description: '', questions: [] });
  newCrossword = signal<Partial<Crossword>>({ published: false, title: '', description: '', gridJson: '{"words":[]}' });
  crosswordWords = signal<{ word: string, clue: string, x: number, y: number, dir: 'H' | 'V' }[]>([]);
  gridRows = signal<number>(10);
  gridCols = signal<number>(10);
  newRoadmap = signal<Partial<RoadmapNode>>({ stepOrder: 1, nodeLabel: '' });
  
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
  }
  
  setTab(tab: 'QUIZ' | 'CROSSWORD' | 'ROADMAP') {
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
    else this.newRoadmap.set({ stepOrder: this.roadmaps().length + 1, nodeLabel: '' });
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
      const qzToSave = JSON.parse(JSON.stringify(this.newQuiz()));
      if (qzToSave.questions) {
        qzToSave.questions.forEach((q: QuizQuestion) => {
          if (q._tempOptions) q.optionsJson = JSON.stringify(q._tempOptions);
        });
      }
      if (this.isEditMode() && qzToSave.quizId) {
        this.api.updateQuiz(qzToSave.quizId, qzToSave).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      } else {
        this.api.createQuiz(qzToSave).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      }
    } else if (this.activeTab() === 'CROSSWORD') {
      const c = this.newCrossword();
      c.gridJson = JSON.stringify({ rows: this.gridRows(), cols: this.gridCols(), words: this.crosswordWords() });
      if (this.isEditMode() && c.crosswordId) {
        this.api.updateCrossword(c.crosswordId, c).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      } else {
        this.api.createCrossword(c).subscribe(() => { this.refreshAll(); this.closeCreate(); });
      }
    } else if (this.activeTab() === 'ROADMAP') {
      const r = this.newRoadmap();
      const payload: Partial<RoadmapNode> = {
        stepOrder: Number(r.stepOrder || 1),
        nodeLabel: String(r.nodeLabel || '').trim(),
        quizId: r.quizId,
        crosswordId: r.crosswordId,
        quiz: r.quizId ? { quizId: r.quizId } : undefined,
        crossword: r.crosswordId ? { crosswordId: r.crosswordId } : undefined,
      };
      this.api.createRoadmapNode(payload).subscribe(() => { this.refreshAll(); this.closeCreate(); });
    }
  }

  deleteItem(id: number | undefined, type: 'QUIZ' | 'CROSSWORD' | 'ROADMAP') {
    if(!id) return;
    if (type === 'QUIZ') this.api.deleteQuiz(id).subscribe(() => this.refreshAll());
    if (type === 'CROSSWORD') this.api.deleteCrossword(id).subscribe(() => this.refreshAll());
    if (type === 'ROADMAP') this.api.deleteRoadmapNode(id).subscribe(() => this.refreshAll());
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

