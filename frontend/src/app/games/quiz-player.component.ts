import { Component, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LudificationService, Quiz, QuizQuestion } from '../core/ludification.service';
import { AuthService } from '../core/auth.service';
import { GamificationService } from '../core/gamification.service';
import { API_BASE_URL } from '../core/api-url';
import { AiService } from '../core/ai.service';


@Component({
  selector: 'app-quiz-player',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './quiz-player.component.html',
  styleUrl: './quiz-player.component.css',
})
export class QuizPlayerComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(LudificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly gamification = inject(GamificationService);
  private readonly translate = inject(TranslateService);
  private readonly ai = inject(AiService);


  quiz = signal<Quiz | null>(null);
  currentQuestion = signal<number>(0);
  score = signal<number>(0);
  isFinished = signal<boolean>(false);
  questions = signal<Array<{ text: string; options: string[]; correct: number }>>([]);
  isLoading = signal<boolean>(true);
  loadError = signal<string | null>(null);
  aiLoading = signal<boolean>(false);


  selectedOption = signal<number | null>(null);

  /** Temps restant (s) ; null si pas de chrono actif. */
  remainingSeconds = signal<number | null>(null);
  /** Étoiles « temps » (0–3) selon le tiers de temps restant pendant le jeu. */
  timeStarsDisplay = signal<number>(3);
  /** Étoiles finales selon le temps total pour terminer (3 tiers). */
  timeStarsFinal = signal<number>(0);
  /** Partie terminée par expiration du chrono. */
  timedOut = signal<boolean>(false);
  pointsClaimed = signal<boolean>(false);

  private roadmapNodeId: number | null = null;
  private roadmapRecorded = false;
  private standaloneReported = false;
  private quizId: number | null = null;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private quizStartedAtMs: number | null = null;
  /** Durée totale (s) — exposée au template. */
  totalTimeSeconds = 60;

  ngOnInit() {
    const rn = this.route.snapshot.queryParamMap.get('roadmapNode');
    if (rn) {
      const n = Number(rn);
      if (Number.isFinite(n) && n > 0) {
        this.roadmapNodeId = n;
      }
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const numericId = Number(id);
      this.quizId = Number.isFinite(numericId) ? numericId : null;
      this.api.getQuizById(numericId).subscribe({
        next: (found) => {
          this.quiz.set(found);
          this.questions.set(this.mapQuestions(found.questions ?? []));
          if (this.questions().length === 0) {
            this.loadError.set('i18n:QUIZ_PLAYER.ERR_NO_QUESTIONS');
          } else {
            this.loadError.set(null);
            this.initTimer(found);
          }
          this.isLoading.set(false);
          this.verifyRoadmapAccess();
        },
        error: () => {
          this.quiz.set(null);
          this.questions.set([]);
          this.loadError.set('i18n:QUIZ_PLAYER.ERR_LOAD');
          this.isLoading.set(false);
        },
      });
    } else {
      this.quiz.set(null);
      this.questions.set([]);
      this.loadError.set('i18n:QUIZ_PLAYER.ERR_INVALID_ID');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private initTimer(found: Quiz) {
    const raw = found.timeLimitSeconds;
    let t = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 60;
    t = Math.max(3, Math.min(3600, t));
    if (t % 3 !== 0) {
      t += 3 - (t % 3);
    }
    this.totalTimeSeconds = t;
    this.quizStartedAtMs = Date.now();
    this.remainingSeconds.set(t);
    this.updateTimeStarsFromRemaining(t);
    this.clearTimer();
    this.timerId = setInterval(() => this.tickTimer(), 1000);
  }

  private tickTimer() {
    if (this.isFinished() || this.timedOut()) {
      return;
    }
    const start = this.quizStartedAtMs;
    if (start == null) {
      return;
    }
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const left = Math.max(0, this.totalTimeSeconds - elapsed);
    this.remainingSeconds.set(left);
    this.updateTimeStarsFromRemaining(left);
    if (left <= 0) {
      this.finishByTimeout();
    }
  }

  /** Chaque tiers du temps total correspond à une étoile « restante » visuelle. */
  private updateTimeStarsFromRemaining(remaining: number) {
    const T = this.totalTimeSeconds;
    const third = T / 3;
    if (remaining <= 0) {
      this.timeStarsDisplay.set(0);
      return;
    }
    if (remaining > 2 * third) {
      this.timeStarsDisplay.set(3);
    } else if (remaining > third) {
      this.timeStarsDisplay.set(2);
    } else {
      this.timeStarsDisplay.set(1);
    }
  }

  /** Étoiles finales : plus tu termines vite, plus tu en gardes (3 si dans le 1er tiers du temps). */
  private computeTimeStarsFromElapsedSeconds(elapsedSec: number): number {
    const T = this.totalTimeSeconds;
    const third = T / 3;
    if (elapsedSec > T) {
      return 0;
    }
    if (elapsedSec <= third) {
      return 3;
    }
    if (elapsedSec <= 2 * third) {
      return 2;
    }
    return 1;
  }

  private finishByTimeout() {
    this.clearTimer();
    this.timedOut.set(true);
    this.timeStarsFinal.set(0);
    this.timeStarsDisplay.set(0);
    this.remainingSeconds.set(0);
    this.isFinished.set(true);
  }

  private clearTimer() {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  coverImageSrc(): string | null {
    const url = this.quiz()?.coverImageUrl;
    if (!url || !String(url).trim()) {
      return null;
    }
    const u = String(url).trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) {
      return u;
    }
    const base = API_BASE_URL || '';
    return `${base}${u.startsWith('/') ? u : '/' + u}`;
  }

  private verifyRoadmapAccess() {
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
          const msg = res.error?.trim();
          this.loadError.set(msg ? msg : 'i18n:QUIZ_PLAYER.ROADMAP_BLOCKED');
        }
      },
      error: () => {},
    });
  }

  private recordRoadmapProgress() {
    const nodeId = this.roadmapNodeId;
    if (!nodeId || this.roadmapRecorded) {
      return;
    }
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }
    const max = this.questions().length;
    const sc = this.score();
    this.api.completeRoadmapNode(nodeId, sc, max).subscribe({
      next: () => {
        this.roadmapRecorded = true;
      },
      error: () => {},
    });
  }

  selectOption(idx: number) {
    if (this.selectedOption() !== null) {
      return;
    }
    if (!this.questions().length || this.timedOut()) {
      return;
    }
    this.selectedOption.set(idx);

    if (idx === this.questions()[this.currentQuestion()].correct) {
      this.score.update((s) => s + 1);
    }

    setTimeout(() => {
      if (this.currentQuestion() < this.questions().length - 1) {
        this.currentQuestion.update((c) => c + 1);
        this.selectedOption.set(null);
      } else {
        this.completeQuizNormally();
      }
    }, 1200);
  }

  solveWithAi(): void {
    if (this.selectedOption() !== null || this.isFinished() || this.aiLoading()) {
      return;
    }
    const question = this.questions()[this.currentQuestion()];
    this.aiLoading.set(true);
    
    const prompt = `You are an expert in Tunisian culture and travel. 
    The current quiz question is: "${question.text}"
    Options: ${question.options.map((o, i) => `${i}: ${o}`).join(', ')}
    Tell me the index of the correct answer. 
    Return ONLY the index number.`;

    this.ai.getCustomResponse(prompt).subscribe({
      next: (res) => {
        const idx = parseInt(res.trim(), 10);
        if (!isNaN(idx) && idx >= 0 && idx < question.options.length) {
          this.selectOption(idx);
        }
        this.aiLoading.set(false);
      },
      error: () => this.aiLoading.set(false)
    });
  }


  private completeQuizNormally() {
    this.clearTimer();
    const start = this.quizStartedAtMs;
    const elapsedSec = start != null ? Math.floor((Date.now() - start) / 1000) : this.totalTimeSeconds;
    const stars = this.computeTimeStarsFromElapsedSeconds(elapsedSec);
    this.timeStarsFinal.set(stars);
    this.timeStarsDisplay.set(stars);
    this.isFinished.set(true);
  }

  claimPoints() {
    if (this.pointsClaimed() || !this.auth.currentUser()) return;
    this.pointsClaimed.set(true);
    this.recordRoadmapProgress();
    this.reportStandaloneIfNeeded();
  }

  private reportStandaloneIfNeeded(): void {
    if (this.roadmapNodeId != null) {
      return;
    }
    if (this.standaloneReported) {
      return;
    }
    const uid = this.auth.currentUser();
    const qid = this.quizId;
    if (!uid || qid == null) {
      return;
    }
    const max = this.questions().length;
    const sc = this.score();
    this.gamification
      .reportGame({ gameKind: 'QUIZ', gameId: qid, score: sc, maxScore: max })
      .subscribe({
        next: () => {
          this.standaloneReported = true;
          this.auth.fetchMe().subscribe({ error: () => {} });
        },
        error: () => {},
      });
  }

  backToHub() {
    this.router.navigate(['/games']);
  }

  /** Supports `i18n:KEY` for localised errors; otherwise returns raw message (e.g. API). */
  displayLoadError(): string {
    const e = this.loadError();
    if (!e) {
      return '';
    }
    if (e.startsWith('i18n:')) {
      return this.translate.instant(e.slice(5));
    }
    return e;
  }

  private mapQuestions(raw: QuizQuestion[]): Array<{ text: string; options: string[]; correct: number }> {
    return [...raw]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((question) => {
        let options: string[] = [];
        try {
          const parsed = JSON.parse(question.optionsJson || '[]');
          options = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
        } catch {
          options = [];
        }
        return {
          text: String(question.questionText ?? ''),
          options,
          correct: question.correctOptionIndex ?? 0,
        };
      })
      .filter((question) => question.text.trim().length > 0 && question.options.length > 0);
  }
}
