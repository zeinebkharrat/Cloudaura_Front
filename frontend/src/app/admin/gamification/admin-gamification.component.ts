import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import {
  GamificationService,
  AdminBadge,
  AdminDailyChallenge,
  AdminTournament,
  LudificationGameKind,
} from '../../core/gamification.service';
import { LudificationService, Quiz, Crossword, PuzzleImage } from '../../core/ludification.service';

type Tab = 'badges' | 'challenges' | 'tournaments';

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

  readonly activeTab = signal<Tab>('badges');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly badges = signal<AdminBadge[]>([]);
  readonly challenges = signal<AdminDailyChallenge[]>([]);
  readonly tournaments = signal<AdminTournament[]>([]);

  readonly allQuizzes = signal<Quiz[]>([]);
  readonly allCrosswords = signal<Crossword[]>([]);
  readonly allPuzzles = signal<PuzzleImage[]>([]);

  readonly gameKinds: LudificationGameKind[] = ['QUIZ', 'CROSSWORD', 'PUZZLE', 'LUDO', 'ROADMAP_NODE'];

  newBadge = { name: '', description: '', iconUrl: '' };
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

  newTournament: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    winnerBadgeId: number | null;
  } = {
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    winnerBadgeId: null,
  };

  tournamentRounds: Array<{
    sequenceOrder: number;
    gameKind: LudificationGameKind;
    gameId: number | null;
    gameTitle?: string;
  }> = [];

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
      tournaments: this.gamification.adminListTournaments(),
    })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) => {
          this.badges.set(r.badges);
          this.challenges.set(r.challenges);
          this.tournaments.set(r.tournaments);
        },
        error: () => this.error.set('Could not load gamification data.'),
      });

    this.ludification.getQuizzes().subscribe((d) => this.allQuizzes.set(d));
    this.ludification.getCrosswords().subscribe((d) => this.allCrosswords.set(d));
    this.ludification.getPuzzles().subscribe((d) => this.allPuzzles.set(d));
  }

  startEditBadge(b: AdminBadge): void {
    this.editBadgeId = b.badgeId;
    this.newBadge = { name: b.name, description: b.description ?? '', iconUrl: b.iconUrl ?? '' };
  }

  cancelEditBadge(): void {
    this.editBadgeId = null;
    this.newBadge = { name: '', description: '', iconUrl: '' };
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
      iconUrl: this.newBadge.iconUrl || null
    };

    const req =
      this.editBadgeId != null
        ? this.gamification.adminUpdateBadge(this.editBadgeId, payload)
        : this.gamification.adminCreateBadge(payload);

    req.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.newBadge = { name: '', description: '', iconUrl: '' };
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

  addRoundRow(): void {
    const n = this.tournamentRounds.length + 1;
    const { kind, id, title } = this.pickRandomGame();
    this.tournamentRounds = [
      ...this.tournamentRounds,
      { sequenceOrder: n, gameKind: kind, gameId: id, gameTitle: title },
    ];
  }

  private pickRandomGame(): { kind: LudificationGameKind; id: number; title: string } {
    const pool: { kind: LudificationGameKind; id: number; title: string }[] = [];
    this.allQuizzes().forEach(q => pool.push({ kind: 'QUIZ', id: q.quizId, title: q.title }));
    this.allCrosswords().forEach(c => pool.push({ kind: 'CROSSWORD', id: c.crosswordId, title: c.title }));
    this.allPuzzles().forEach(p => pool.push({ kind: 'PUZZLE', id: p.puzzleId, title: p.title }));

    if (pool.length === 0) return { kind: 'QUIZ', id: 0, title: 'No games available' };
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  removeRoundRow(idx: number): void {
    this.tournamentRounds = this.tournamentRounds.filter((_, i) => i !== idx);
    this.tournamentRounds = this.tournamentRounds.map((r, i) => ({ ...r, sequenceOrder: i + 1 }));
  }

  saveTournament(): void {
    const title = String(this.newTournament.title ?? '').trim();
    if (!title) {
      this.error.set('Tournament title required.');
      return;
    }
    const tStarts = this.newTournament.startsAt ? new Date(this.newTournament.startsAt).toISOString() : new Date().toISOString();
    const tEnds = this.newTournament.endsAt ? new Date(this.newTournament.endsAt).toISOString() : new Date(Date.now() + 86400000 * 7).toISOString();

    const rounds = this.tournamentRounds
      .filter((r) => r.gameId != null)
      .map((r) => ({
        sequenceOrder: r.sequenceOrder,
        gameKind: r.gameKind,
        gameId: Number(r.gameId),
        roundStartsAt: tStarts,
        roundEndsAt: tEnds,
      }));

    if (rounds.length === 0) {
      this.error.set('Add at least one round.');
      return;
    }
    const payload: Record<string, unknown> = {
      title,
      description: this.newTournament.description || null,
      startsAt: this.newTournament.startsAt ? new Date(this.newTournament.startsAt).toISOString() : null,
      endsAt: this.newTournament.endsAt ? new Date(this.newTournament.endsAt).toISOString() : null,
      winnerBadgeId: this.newTournament.winnerBadgeId != null ? Number(this.newTournament.winnerBadgeId) : null,
      rounds,
    };
    this.busy.set(true);
    this.gamification
      .adminCreateTournament(payload)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.newTournament = {
            title: '',
            description: '',
            startsAt: '',
            endsAt: '',
            winnerBadgeId: null,
          };
          this.tournamentRounds = [];
          this.refreshAll();
        },
        error: () => this.error.set('Create tournament failed.'),
      });
  }

  goLive(id: number): void {
    this.busy.set(true);
    this.gamification
      .adminGoLiveTournament(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Go live failed.'),
      });
  }

  finalize(id: number): void {
    if (!confirm('Finalize tournament and award winner badge?')) {
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminFinalizeTournament(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Finalize failed.'),
      });
  }

  deleteTournament(id: number): void {
    if (!confirm('Delete this tournament?')) {
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminDeleteTournament(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.refreshAll(),
        error: () => this.error.set('Delete failed.'),
      });
  }
}
