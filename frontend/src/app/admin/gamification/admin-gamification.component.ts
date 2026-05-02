import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, switchMap, of, Observable, map } from 'rxjs';
import {
  GamificationService,
  AdminBadge,
  AdminDailyChallenge,
  AdminGameUnlockCost,
  AdminPointPackage,
  LudificationGameKind,
} from '../../core/gamification.service';
import { LudificationService, Quiz, Crossword, PuzzleImage, LudoCard, QuizView } from '../../core/ludification.service';
import { AiService } from '../../core/ai.service';
import { KaraokeService, KaraokeSong } from '../../core/karaoke.service';

type Tab = 'badges' | 'challenges' | 'unlocks' | 'point-packages';

interface NewChallengeForm {
  title: string;
  description: string;
  pointsReward: number;
  gameKind: LudificationGameKind;
  targetId: number | null;
  active: boolean;
}

@Component({
  selector: 'app-admin-gamification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-gamification.component.html',
  styleUrl: './admin-gamification.component.css',
})
export class AdminGamificationComponent implements OnInit {
  private readonly gamification = inject(GamificationService);
  private readonly ludification = inject(LudificationService);
  private readonly ai = inject(AiService);
  private readonly karaoke = inject(KaraokeService);

  readonly activeTab = signal<Tab>('badges');
  readonly busy = signal(false);
  readonly aiBusy = signal(false);
  readonly aiGenerated = signal(false);
  readonly error = signal<string | null>(null);

  readonly badges = signal<AdminBadge[]>([]);
  readonly challenges = signal<AdminDailyChallenge[]>([]);
  readonly unlockCosts = signal<AdminGameUnlockCost[]>([]);
  readonly pointPackages = signal<AdminPointPackage[]>([]);

  readonly allQuizzes = signal<Quiz[]>([]);
  readonly allCrosswords = signal<Crossword[]>([]);
  readonly allPuzzles = signal<PuzzleImage[]>([]);
  readonly allSongs = signal<KaraokeSong[]>([]);
  readonly allLudoCards = signal<LudoCard[]>([]);

  readonly gameKinds: LudificationGameKind[] = [
    'QUIZ', 'CROSSWORD', 'PUZZLE', 'LUDO', 'ROADMAP_NODE', 
    'KARAOKE', 'GOVERNORATE_GUESS', 'EL_JEM_QUEST', 
    'CHEF_QUEST', 'CHKOBBA', 'MUSIC'
  ];

  newBadge = { 
    name: '', 
    description: '', 
    iconUrl: '', 
    targetGameId: null as string | null, 
    targetGameKind: null as LudificationGameKind | null 
  };
  selectedBadgeFile: File | null = null;
  badgePreviewUrl: string | null = null;
  editBadgeId: number | null = null;

  /** Shown after admin picks a game type. */
  challengeKind: LudificationGameKind | null = null;

  newChallenge: NewChallengeForm = {
    title: '',
    description: '',
    pointsReward: 10,
    gameKind: 'QUIZ',
    targetId: null,
    active: true,
  };

  newUnlockCost = { gameId: '', costPoints: 0 };
  
  newPointPackage: AdminPointPackage = { name: '', pointsAmount: 100, price: 1.0, active: true };
  editPointPackageId: number | null = null;

  ngOnInit(): void {
    this.refreshAll();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.error.set(null);
  }

  refreshAll(): void {
    this.busy.set(true);
    forkJoin({
      badges: this.gamification.adminListBadges(),
      challenges: this.gamification.adminListChallenges(),
      unlocks: this.gamification.adminListUnlockCosts(),
      packages: this.gamification.adminListPointPackages(),
    })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) => {
          this.badges.set(r.badges);
          this.challenges.set(r.challenges);
          this.unlockCosts.set(r.unlocks);
          this.pointPackages.set(r.packages);
        },
        error: () => this.error.set('Could not load gamification data.'),
      });

    this.ludification.getQuizzes().subscribe((d) => this.allQuizzes.set(d));
    this.ludification.getCrosswords().subscribe((d) => this.allCrosswords.set(d));
    this.ludification.getPuzzles().subscribe((d) => this.allPuzzles.set(d));
    this.karaoke.getAllSongs().subscribe((d) => this.allSongs.set(d));
    this.ludification.getLudoCards().subscribe((d) => this.allLudoCards.set(d));
  }

  startEditBadge(b: AdminBadge): void {
    this.editBadgeId = b.badgeId;
    this.newBadge = { 
      name: b.name, 
      description: b.description ?? '', 
      iconUrl: b.iconUrl ?? '',
      targetGameId: b.targetGameId ?? null,
      targetGameKind: b.targetGameKind ?? null
    };
  }

  cancelEditBadge(): void {
    this.editBadgeId = null;
    this.newBadge = { name: '', description: '', iconUrl: '', targetGameId: null, targetGameKind: null };
  }

  saveBadge(): void {
    const name = String(this.newBadge.name ?? '').trim();
    if (!name) {
      this.error.set('Badge name required.');
      return;
    }
    this.busy.set(true);

    if (this.selectedBadgeFile) {
      this.gamification.adminUploadBadgeIcon(this.selectedBadgeFile).subscribe({
        next: (res) => {
          this.newBadge.iconUrl = res.imageUrl;
          this.proceedSaveBadge();
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Image upload failed.');
        }
      });
    } else {
      this.proceedSaveBadge();
    }
  }

  private proceedSaveBadge(): void {
    const payload = {
      name: this.newBadge.name,
      description: this.newBadge.description || null,
      iconUrl: this.newBadge.iconUrl || null,
      targetGameId: this.newBadge.targetGameId || null,
      targetGameKind: this.newBadge.targetGameKind || null
    };

    const req =
      this.editBadgeId != null
        ? this.gamification.adminUpdateBadge(this.editBadgeId, payload)
        : this.gamification.adminCreateBadge(payload);

    req.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.newBadge = { name: '', description: '', iconUrl: '', targetGameId: null, targetGameKind: null };
        this.selectedBadgeFile = null;
        this.badgePreviewUrl = null;
        this.cancelEditBadge();
        this.refreshAll();
      },
      error: () => this.error.set('Save badge failed.'),
    });
  }

  onBadgeFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.badgePreviewUrl = typeof reader.result === 'string' ? reader.result : '';
      this.selectedBadgeFile = file;
    };
    reader.readAsDataURL(file);
  }

  deleteBadge(id: number): void {
    if (!confirm('Delete this badge?')) {
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminDeleteBadge(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Delete failed.'),
      });
  }

  private challengePayload(): Record<string, unknown> {
    const c = this.newChallenge;
    const kind = this.challengeKind;
    if (!kind) {
      return {};
    }
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return {
      title: c.title.trim(),
      description: c.description || null,
      pointsReward: Number(c.pointsReward) || 0,
      gameKind: kind,
      targetId: c.targetId == null ? null : Number(c.targetId),
      active: c.active !== false,
      validFrom: now.toISOString(),
      validTo: tomorrow.toISOString(),
    };
  }

  saveChallenge(): void {
    if (!this.challengeKind) {
      this.error.set('Select a game type first.');
      return;
    }
    if (this.challengeKind === 'QUIZ' && (!this.aiGenerated() || this.newChallenge.targetId == null)) {
      this.error.set('Generate a new quiz with AI before creating the challenge.');
      return;
    }
    const title = String(this.newChallenge.title ?? '').trim();
    if (!title) {
      this.error.set('Challenge title required.');
      return;
    }
    this.newChallenge.gameKind = this.challengeKind;
    this.busy.set(true);
    this.gamification
      .adminCreateChallenge(this.challengePayload())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.challengeKind = null;
          this.newChallenge = {
            title: '',
            description: '',
            pointsReward: 10,
            gameKind: 'QUIZ',
            targetId: null,
            active: true,
          };
          this.aiGenerated.set(false);
          this.refreshAll();
        },
        error: () => this.error.set('Create challenge failed.'),
      });
  }

  deleteChallenge(id: number): void {
    if (!confirm('Delete this challenge?')) {
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminDeleteChallenge(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Delete failed.'),
      });
  }

  generateAiChallenge(): void {
    if (!this.challengeKind) {
      this.error.set('Please select a game type first.');
      return;
    }
    this.aiBusy.set(true);
    this.error.set(null);
    this.aiGenerated.set(false);

    // 1. Generate challenge metadata
    this.ai.generateDailyChallenge(this.challengeKind)
      .pipe(
        switchMap(data => {
          // 2. Handle based on game type
          if (this.challengeKind === 'QUIZ') {
            return this.generateAiQuiz(data).pipe(
              map(quizRes => ({ challengeData: data, quizRes }))
            );
          }
          // We only support generating full games for QUIZ right now
          return of({ challengeData: data, quizRes: null });
        }),
        finalize(() => this.aiBusy.set(false))
      )
      .subscribe({
        next: (result: any) => {
          if (!result) return;
          const { challengeData, quizRes } = result;

          // Only update UI if the whole process succeeded
          this.newChallenge.title = challengeData.title;
          this.newChallenge.description = challengeData.description;
          this.newChallenge.pointsReward = challengeData.points;

          if (quizRes && quizRes.quizId) {
            this.newChallenge.targetId = quizRes.quizId;
            this.aiGenerated.set(true);
          }
        },
        error: (err) => {
          console.error('AI generation failed', err);
          this.error.set('AI generation failed: ' + (err.message || 'Unknown error'));
        }
      });
  }

  private generateAiQuiz(challengeData: any): Observable<any> {
    const topic = this.cleanText(challengeData?.title) || 'Tunisian travel';
    return this.ai.generateFullQuiz(topic).pipe(
      map((quizData: any) => this.buildQuizPayload(challengeData, quizData)),
      switchMap((payload) => this.ludification.createQuiz(payload))
    );
  }

  private buildQuizPayload(challengeData: any, quizData: any): {
    title: string;
    description: string;
    published: boolean;
    coverImageUrl?: string | null;
    timeLimitSeconds: number;
    questions: Array<{
      orderIndex: number;
      questionText: string;
      imageUrl?: string;
      optionsJson: string;
      correctOptionIndex: number;
    }>;
  } {
    if (!quizData || typeof quizData !== 'object' || !Array.isArray(quizData.questions)) {
      throw new Error('AI did not return a valid quiz question list');
    }

    const questions = quizData.questions
      .map((question: any, index: number) => this.normalizeQuizQuestion(question, index))
      .filter((question: any) => question.questionText.length > 0 && question.optionsJson.length > 0)
      .slice(0, 5);

    if (questions.length < 5) {
      throw new Error('AI returned fewer than 5 valid quiz questions');
    }

    return {
      title: this.cleanText(quizData.title) || this.cleanText(challengeData?.title) || 'Generated Quiz',
      description: this.cleanText(quizData.description) || this.cleanText(challengeData?.description) || '',
      published: true,
      coverImageUrl: null,
      timeLimitSeconds: 120,
      questions,
    };
  }

  private normalizeQuizQuestion(question: any, index: number) {
    const rawOptions = Array.isArray(question?.options) ? question.options : [];
    const options = rawOptions.map((option: any) => this.cleanText(option)).filter((option: string) => option.length > 0).slice(0, 4);
    if (options.length < 4) {
      throw new Error(`AI question ${index + 1} does not contain 4 valid options`);
    }
    const rawCorrect = Number(question?.correctOptionIndex);
    if (!Number.isInteger(rawCorrect) || rawCorrect < 0 || rawCorrect >= options.length) {
      throw new Error(`AI question ${index + 1} has an invalid correctOptionIndex`);
    }

    return {
      orderIndex: index,
      questionText: this.cleanText(question?.questionText || question?.question),
      imageUrl: undefined,
      optionsJson: JSON.stringify(options),
      correctOptionIndex: rawCorrect,
    };
  }

  private cleanText(value: any): string {
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  }

  saveUnlockCost(): void {
    const gameId = this.newUnlockCost.gameId.trim();
    if (!gameId) {
      this.error.set('Game ID required.');
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminSaveUnlockCost({ gameId, costPoints: this.newUnlockCost.costPoints })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.newUnlockCost = { gameId: '', costPoints: 0 };
          this.refreshAll();
        },
        error: () => this.error.set('Save unlock cost failed.'),
      });
  }

  deleteUnlockCost(gameId: string): void {
    if (!confirm('Remove this game lock? The game will become free.')) {
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminDeleteUnlockCost(gameId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Delete failed.'),
      });
  }

  startEditUnlockCost(u: AdminGameUnlockCost): void {
    this.newUnlockCost = { gameId: u.gameId, costPoints: u.costPoints };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  savePointPackage(): void {
    const name = this.newPointPackage.name.trim();
    if (!name) {
      this.error.set('Package name required.');
      return;
    }
    this.busy.set(true);

    const req = this.editPointPackageId != null
      ? this.gamification.adminUpdatePointPackage(this.editPointPackageId, this.newPointPackage)
      : this.gamification.adminCreatePointPackage(this.newPointPackage);

    req.pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.newPointPackage = { name: '', pointsAmount: 100, price: 1.0, active: true };
          this.editPointPackageId = null;
          this.refreshAll();
        },
        error: () => this.error.set('Save point package failed.'),
      });
  }

  deletePointPackage(id: number): void {
    if (!confirm('Delete this point package?')) {
      return;
    }
    this.busy.set(true);
    this.gamification.adminDeletePointPackage(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Delete package failed.'),
      });
  }

  startEditPointPackage(p: AdminPointPackage): void {
    this.editPointPackageId = p.id ?? null;
    this.newPointPackage = { ...p };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEditPointPackage(): void {
    this.editPointPackageId = null;
    this.newPointPackage = { name: '', pointsAmount: 100, price: 1.0, active: true };
  }
}
