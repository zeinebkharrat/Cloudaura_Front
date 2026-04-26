import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import {
  LudificationService,
  Quiz,
  Crossword,
  RoadmapNode,
  QuizQuestion,
  PuzzleImage,
  LudoCard,
} from '../../core/ludification.service';
import { ChefQuestService } from '../../games/chef-quest.service';
import { KaraokeService, KaraokeSong } from '../../core/karaoke.service';

@Component({
  selector: 'app-admin-games',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-games.component.html',
  styleUrl: './admin-games.component.css'
})
export class AdminGamesComponent implements OnInit {
  private readonly http = inject(HttpClient);

  activeTab = signal<'QUIZ' | 'CROSSWORD' | 'ROADMAP' | 'PUZZLE' | 'LUDO' | 'CHEF' | 'KARAOKE'>('QUIZ');
  
  quizzes = signal<Quiz[]>([]);
  crosswords = signal<Crossword[]>([]);
  roadmaps = signal<RoadmapNode[]>([]);
  puzzles = signal<PuzzleImage[]>([]);
  ludoCards = signal<LudoCard[]>([]);
  karaokeSongs = signal<any[]>([]);
  
  // Chef Quest Data
  chefRecipes = signal<any[]>([]);
  chefIngredients = signal<any[]>([]);

  creationMode = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  /** Évite les doubles POST quiz (409 duplicate) */
  quizSaving = signal<boolean>(false);
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
  newKaraoke = signal<Partial<KaraokeSong>>({ title: '', artist: '', audioUrl: '', instrumentalUrl: '', lyricsJson: '[]', published: false });
  isGeneratingKaraoke = signal<boolean>(false);
  rawLyricsInput = '';

  // Chef Quest New Items
  newChefIngredient = signal<any>({ name: '', iconUrl: '', x: 50, y: 50 });
  newChefRecipe = signal<any>({ title: '', description: '', rewardPoints: 1000, ingredients: [], bgImageUrl: 'assets/images/chef_bg.png', finalDishImageUrl: '' });
  
  private chefService = inject(ChefQuestService);
  private karaokeService = inject(KaraokeService);
  
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
    
    // Load Chef Quest Data
    this.chefService.getRecipes().subscribe(d => this.chefRecipes.set(d));
    this.chefService.getIngredients().subscribe(d => this.chefIngredients.set(d));
    
    // Load Karaoke Data
    this.karaokeService.getAllSongs().subscribe(d => this.karaokeSongs.set(d));
  }
  
  setTab(tab: 'QUIZ' | 'CROSSWORD' | 'ROADMAP' | 'PUZZLE' | 'LUDO' | 'CHEF' | 'KARAOKE') {
    this.activeTab.set(tab); this.creationMode.set(false);
  }

  openCreate() {
    this.creationMode.set(true);
    this.isEditMode.set(false);
    if (this.activeTab() === 'QUIZ') {
      this.newQuiz.set({
        published: false,
        title: '',
        description: '',
        coverImageUrl: '',
        timeLimitSeconds: 60,
        questions: [
          { questionText: '', optionsJson: '', correctOptionIndex: 0, _tempOptions: ['', '', '', ''], orderIndex: 1 },
        ],
      });
    }
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
    } else if (this.activeTab() === 'LUDO') {
      this.newLudo.set({ title: '', description: '', effectSteps: 0, category: 'GENERAL', published: true });
    } else if (this.activeTab() === 'CHEF') {
      this.newChefIngredient.set({ name: '', iconUrl: '', x: 50, y: 50 });
      this.newChefRecipe.set({ title: '', description: '', rewardPoints: 1000, ingredients: [], bgImageUrl: 'assets/images/chef_bg.png' });
    } else if (this.activeTab() === 'KARAOKE') {
      this.newKaraoke.set({ title: '', artist: '', audioUrl: '', lyricsJson: '[]', published: false });
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
    } else if (this.activeTab() === 'CHEF') {
      if (item.title) {
        this.newChefRecipe.set({ ...item });
        this.newChefIngredient.set({ name: '', iconUrl: '', x: 50, y: 50 }); 
      } else {
        this.newChefIngredient.set({ ...item });
        this.newChefRecipe.set({ title: '', description: '', rewardPoints: 1000, ingredients: [], bgImageUrl: 'assets/images/chef_bg.png', finalDishImageUrl: '' }); 
      }
    } else if (this.activeTab() === 'KARAOKE') {
      this.newKaraoke.set({ ...item });
    }
  }

  closeCreate() {
    this.creationMode.set(false);
  }

  /** Upload couverture quiz (même endpoint public que la photo de profil). */
  uploadQuizCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    this.http.post<{ url: string }>('/api/public/uploads/profile-image', body).subscribe({
      next: (res) => {
        const qz = this.newQuiz();
        qz.coverImageUrl = res.url;
        this.newQuiz.set({ ...qz });
      },
      error: () => alert('Échec de l’upload. Vérifiez la taille du fichier et le backend.'),
    });
    input.value = '';
  }

  uploadChefIngIcon(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    this.http.post<{ url: string }>('/api/public/uploads/profile-image', body).subscribe({
      next: (res) => {
        const ing = this.newChefIngredient();
        ing.iconUrl = res.url;
        this.newChefIngredient.set({ ...ing });
      },
      error: () => alert('Upload failed.')
    });
    input.value = '';
  }

  uploadChefRecipeBg(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    this.http.post<{ url: string }>('/api/public/uploads/profile-image', body).subscribe({
      next: (res) => {
        const rec = this.newChefRecipe();
        rec.bgImageUrl = res.url;
        this.newChefRecipe.set({ ...rec });
      },
      error: () => alert('Upload failed.')
    });
    input.value = '';
  }

  uploadChefRecipeFinal(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    this.http.post<{ url: string }>('/api/public/uploads/profile-image', body).subscribe({
      next: (res) => {
        const rec = this.newChefRecipe();
        rec.finalDishImageUrl = res.url;
        this.newChefRecipe.set({ ...rec });
      },
      error: () => alert('Upload failed.')
    });
    input.value = '';
  }


  /** Force un multiple de 3 pour le chrono (3 tiers = 3 étoiles côté joueur). */
  snapQuizTimeSeconds(): void {
    const qz = this.newQuiz();
    let t = Math.floor(Number(qz.timeLimitSeconds ?? 60));
    if (!Number.isFinite(t) || t < 3) {
      t = 60;
    }
    const mod = t % 3;
    if (mod !== 0) {
      t += 3 - mod;
    }
    qz.timeLimitSeconds = Math.min(3600, t);
    this.newQuiz.set({ ...qz });
  }

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
      if (this.quizSaving()) {
        return;
      }
      this.quizSaving.set(true);
      const qz = this.newQuiz();
      const title = String(qz.title ?? '').trim();
      if (!title) {
        this.quizSaving.set(false);
        alert('Enter a title for the quiz.');
        return;
      }
      const questions = qz.questions ?? [];
      if (questions.length === 0) {
        this.quizSaving.set(false);
        alert('Ajoutez au moins une question.');
        return;
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!String(q.questionText ?? '').trim()) {
          this.quizSaving.set(false);
          alert(`Question ${i + 1}: enter the question text.`);
          return;
        }
        const opts = q._tempOptions ?? ['', '', '', ''];
        for (let j = 0; j < 4; j++) {
          if (!String(opts[j] ?? '').trim()) {
            this.quizSaving.set(false);
            alert(`Question ${i + 1}: fill in all 4 answer options.`);
            return;
          }
        }
        const ci = q.correctOptionIndex ?? 0;
        if (ci < 0 || ci > 3) {
          this.quizSaving.set(false);
          alert(`Question ${i + 1} : choisissez la bonne réponse (une des 4 options).`);
          return;
        }
      }
      this.snapQuizTimeSeconds();
      const qzToSave = JSON.parse(JSON.stringify(this.newQuiz()));
      if (qzToSave.questions) {
        qzToSave.questions.forEach((q: QuizQuestion) => {
          if (q._tempOptions) q.optionsJson = JSON.stringify(q._tempOptions);
        });
      }
      qzToSave.title = title;
      const ci = String(qzToSave.coverImageUrl ?? '').trim();
      qzToSave.coverImageUrl = ci.length ? ci : null;
      const done = () => {
        this.refreshAll();
        this.closeCreate();
      };
      const onErr = (err: unknown) => {
        const body = err && typeof err === 'object' && 'error' in err ? (err as { error?: { message?: string } }).error : undefined;
        const msg = body?.message ?? 'Could not save the quiz.';
        alert(msg);
      };
      if (this.isEditMode() && qzToSave.quizId) {
        this.api
          .updateQuiz(qzToSave.quizId, qzToSave)
          .pipe(finalize(() => this.quizSaving.set(false)))
          .subscribe({ next: done, error: onErr });
      } else {
        this.api
          .createQuiz(qzToSave)
          .pipe(finalize(() => this.quizSaving.set(false)))
          .subscribe({ next: done, error: onErr });
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
    } else if (this.activeTab() === 'CHEF') {
      const recipe = this.newChefRecipe();
      const ingredient = this.newChefIngredient();

      if (recipe.title && recipe.title.trim() && recipe.title !== ' ') {
        const obs = (this.isEditMode() && recipe.id) 
          ? this.chefService.updateRecipe(recipe.id, recipe)
          : this.chefService.saveRecipe(recipe);
          
        obs.subscribe({
          next: () => {
            alert('Recipe saved successfully!');
            this.refreshAll();
            this.closeCreate();
          },
          error: (err) => {
            console.error(err);
            alert('Failed to save recipe. Check if the server is running.');
          }
        });
      } else if (ingredient.name && ingredient.name.trim()) {
        const obs = (this.isEditMode() && ingredient.id)
          ? this.chefService.updateIngredient(ingredient.id, ingredient)
          : this.chefService.saveIngredient(ingredient);

        obs.subscribe({
          next: () => {
            alert('Ingredient saved successfully!');
            this.refreshAll();
            this.closeCreate();
          },
          error: (err) => {
            console.error(err);
            alert('Failed to save ingredient.');
          }
        });
      } else {
        alert('Please fill in a valid Title for the Recipe or Name for the Ingredient.');
      }
    } else if (this.activeTab() === 'KARAOKE') {
      const song = this.newKaraoke();
      if (!song.title || !song.artist) {
        alert('Title and Artist are required.');
        return;
      }
      this.karaokeService.saveSong(song as KaraokeSong).subscribe(() => {
        this.refreshAll();
        this.closeCreate();
      });
    }
  }

  deleteItem(id: number | undefined, type: 'QUIZ' | 'CROSSWORD' | 'ROADMAP' | 'PUZZLE' | 'LUDO' | 'CHEF' | 'KARAOKE', subType?: 'ING' | 'REC') {
    if(!id) return;
    if (type === 'QUIZ') this.api.deleteQuiz(id).subscribe(() => this.refreshAll());
    if (type === 'CROSSWORD') this.api.deleteCrossword(id).subscribe(() => this.refreshAll());
    if (type === 'ROADMAP') this.api.deleteRoadmapNode(id).subscribe(() => this.refreshAll());
    if (type === 'PUZZLE') this.api.deletePuzzle(id).subscribe(() => this.refreshAll());
    if (type === 'LUDO') this.api.deleteLudoCard(id).subscribe(() => this.refreshAll());
    if (type === 'CHEF') {
      if (subType === 'ING') {
        this.chefService.deleteIngredient(id).subscribe(() => this.refreshAll());
      } else {
        this.chefService.deleteRecipe(id).subscribe(() => this.refreshAll());
      }
    }
    if (type === 'KARAOKE') this.karaokeService.deleteSong(id).subscribe(() => this.refreshAll());
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

  isIngInRecipe(ing: any): boolean {
    const list = this.newChefRecipe().ingredients || [];
    return list.some((i: any) => i.id === ing.id);
  }

  toggleIngInRecipe(ing: any) {
    const r = this.newChefRecipe();
    let list = r.ingredients || [];
    if (this.isIngInRecipe(ing)) {
      list = list.filter((i: any) => i.id !== ing.id);
    } else {
      list = [...list, ing];
    }
    r.ingredients = list;
    this.newChefRecipe.set({ ...r });
  }

  toggleChefMode(mode: 'ING' | 'REC') {
    if (mode === 'ING') {
      this.newChefRecipe.set({ ...this.newChefRecipe(), title: '' });
    } else {
      this.newChefRecipe.set({ ...this.newChefRecipe(), title: ' ' }); // Trigger recipe mode
    }
  }

  generateKaraokeWithAI() {
    const song = this.newKaraoke();
    if (!song.title || !song.artist) {
      alert('Titre et Artiste requis.');
      return;
    }
    this.isGeneratingKaraoke.set(true);
    
    // On passe title, artist et éventuellement les paroles brutes
    this.http.post<{ lyrics: string }>('/api/games/karaoke/admin/generate-lyrics', {
      title: song.title,
      artist: song.artist,
      lyricsText: this.rawLyricsInput
    }).subscribe({
      next: (res) => {
        this.newKaraoke.set({ ...song, lyricsJson: res.lyrics });
        this.isGeneratingKaraoke.set(false);
        this.rawLyricsInput = ''; 
      },
      error: (err) => {
        console.error(err);
        alert('Erreur lors de la génération (Vérifiez la console).');
        this.isGeneratingKaraoke.set(false);
      }
    });
  }

  transcribeWithWhisper() {
    const song = this.newKaraoke();
    if (!song.audioUrl) {
      alert('Veuillez d\'abord uploader un fichier audio.');
      return;
    }
    
    this.isGeneratingKaraoke.set(true);
    this.http.post<{ lyrics: string }>('/api/games/karaoke/admin/transcribe', {
      audioUrl: song.audioUrl,
      title: song.title,
      artist: song.artist
    }).subscribe({
      next: (res) => {
        this.newKaraoke.set({ ...song, lyricsJson: res.lyrics });
        alert('Transcription Whisper v3 terminée avec succès !');
        this.isGeneratingKaraoke.set(false);
      },
      error: (err) => {
        console.error(err);
        alert('Erreur de transcription : ' + (err.error?.message || err.statusText));
        this.isGeneratingKaraoke.set(false);
      }
    });
  }

  uploadKaraokeAudio(event: any, type: 'vocal' | 'instrumental' = 'vocal') {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subDir', 'audio');

    this.http.post<any>('http://localhost:9091/api/public/uploads/audio', formData)
      .subscribe({
        next: (res) => {
          if (type === 'vocal') {
            this.newKaraoke.update(k => ({ ...k, audioUrl: res.url }));
          } else {
            this.newKaraoke.update(k => ({ ...k, instrumentalUrl: res.url }));
          }
          alert(`Fichier ${type} uploadé avec succès !`);
        },
        error: (err) => {
          console.error(err);
          alert('Erreur lors de l\'upload de l\'audio.');
        }
      });
  }
}

