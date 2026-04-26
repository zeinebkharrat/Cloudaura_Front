import { Component, signal, effect, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LudificationService, PuzzleImage, RoadmapNode, LudoCard, PointPackage } from '../core/ludification.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-user-games',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
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

  unlockCosts = signal<Map<string, number>>(new Map());
  unlockedGames = signal<Set<string>>(new Set());
  
  pointPackages = signal<PointPackage[]>([]);
  buyingPackageId = signal<number | null>(null);

  private readonly translate = inject(TranslateService);

  constructor(
    private api: LudificationService,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
  ) {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.api.getUnlockedGames().subscribe(unlocked => {
          this.unlockedGames.set(new Set(unlocked));
        });
      } else {
        this.unlockedGames.set(new Set());
      }
    }, { allowSignalWrites: true });
  }

  /** Accès au Ludo réservé aux utilisateurs connectés (voir route `games/ludo` + authGuard). */
  isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];
      if (sessionId) {
        this.roadmapNotice.set("Verification de l'achat en cours...");
        this.api.verifyCheckout(sessionId).subscribe({
          next: (res) => {
            if (res.success) {
               this.roadmapNotice.set(`Achat réussi ! ${res.addedPoints ?? ''} points ajoutés à votre compte.`);
               if ((this.auth as any).fetchMe) {
                 (this.auth as any).fetchMe().subscribe();
               }
               // Remove session_id from URL so it doesn't verify again on refresh
               this.router.navigate([], { queryParams: { session_id: null, package_id: null }, queryParamsHandling: 'merge', replaceUrl: true });
            }
          },
          error: (err) => {
            this.roadmapNotice.set("La méthode de paiement n'a pas pu être vérifiée ou a déjà été validée.");
          }
        });
      }
    });

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

    this.api.getUnlockCosts().subscribe(costs => {
      const map = new Map<string, number>();
      costs.forEach(c => map.set(c.gameId, c.costPoints));
      this.unlockCosts.set(map);
    });

    this.api.getPointPackages().subscribe(pkgs => {
      this.pointPackages.set(pkgs || []);
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
          nodeLabel: q.title || this.translate.instant('GAMES_HUB.FALLBACK_LEVEL', { n: i + 1 }),
          quizId: q.quizId,
        }));

        if (fallbacks.length === 0) {
          fallbacks = Array.from({ length: 6 }, (_, i) => ({
            nodeId: i + 100,
            stepOrder: i,
            nodeLabel: this.translate.instant('GAMES_HUB.FALLBACK_SECRET', { n: i + 1 }),
          }));
        }
        this.roadmapNodes.set(fallbacks);
      },
      error: () => {
        const fallbacks = Array.from({ length: 6 }, (_, i) => ({
          nodeId: i + 100,
          stepOrder: i,
          nodeLabel: this.translate.instant('GAMES_HUB.FALLBACK_NETWORK', { n: i + 1 }),
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
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    if (!this.isUnlocked(index)) {
      this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_STEP_LOCKED'));
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
        this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_REDIRECT_PLAYABLE'));
        this.router.navigate(['/games/quiz', fallbackQuizId], { queryParams: rq });
        return;
      }
      if (fallbackCrosswordId) {
        this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_REDIRECT_PLAYABLE'));
        this.router.navigate(['/games/crossword', fallbackCrosswordId], { queryParams: rq });
        return;
      }
      if (fallbackPuzzleId) {
        this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_REDIRECT_PLAYABLE'));
        this.router.navigate(['/games/puzzle', fallbackPuzzleId], { queryParams: rq });
        return;
      }
    }

    const firstQuiz = this.quizzes()[0]?.quizId;
    if (firstQuiz) {
      this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_FALLBACK_QUIZ'));
      this.router.navigate(['/games/quiz', firstQuiz]);
      return;
    }

    const firstCrossword = this.crosswords()[0]?.crosswordId;
    if (firstCrossword) {
      this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_FALLBACK_CROSSWORD'));
      this.router.navigate(['/games/crossword', firstCrossword]);
      return;
    }

    const firstPuzzle = this.puzzles()[0]?.puzzleId;
    if (firstPuzzle) {
      this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_FALLBACK_PUZZLE'));
      this.router.navigate(['/games/puzzle', firstPuzzle]);
      return;
    }

    this.roadmapNotice.set(this.translate.instant('GAMES_HUB.MSG_NO_GAME'));
  }

  playPuzzle(puzzleId: number): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/puzzle', puzzleId]);
  }

  playLudo(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/ludo']);
  }

  playGovernorateGuess(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/governorate-guess']);
  }

  playElJemQuest(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/el-jem-quest']);
  }

  playChefQuest(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/chef-quest']);
  }

  playChkobba(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/chkobba']);
  }

  playMusic(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/music']);
  }

  /** Navigate to the Karaoke game player. */
  playKaraoke(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/games/karaoke']);
  }

  getGameCost(gameId: string): number {
    return this.unlockCosts().get(gameId) ?? 0;
  }

  isGameUnlocked(gameId: string): boolean {
    if (this.getGameCost(gameId) === 0) return true;
    return this.unlockedGames().has(gameId);
  }

  unlockGame(gameId: string, event: Event): void {
    event.stopPropagation();
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    const cost = this.getGameCost(gameId);
    const pts = this.auth.currentUser()?.points ?? 0;
    if (pts < cost) {
      this.roadmapNotice.set(`Points insuffisants. Il vous faut ${cost} points pour débloquer ce jeu (vous avez ${pts} pts).`);
      return;
    }

    this.api.unlockGame(gameId).subscribe({
      next: (res) => {
        if (res.success) {
          const s = new Set(this.unlockedGames());
          s.add(gameId);
          this.unlockedGames.set(s);
          // Refresh points
          if (typeof (this.auth as any).fetchMe === 'function') {
            (this.auth as any).fetchMe().subscribe();
          }
        }
      },
      error: () => {
        this.roadmapNotice.set("Erreur lors du déverrouillage du jeu.");
      }
    });
  }

  lockCheckAndNavigate(gameId: string, routeFn: () => void): void {
    if (!this.isGameUnlocked(gameId)) {
      this.roadmapNotice.set(`Ce jeu est verrouillé ! Son déverrouillage coûte ${this.getGameCost(gameId)} points.`);
      return;
    }
    routeFn();
  }

  buyPackage(pkg: PointPackage): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.buyingPackageId.set(pkg.id);
    this.api.checkoutPointPackage(pkg.id).subscribe({
      next: (res) => {
        if (res.url) {
          window.location.href = res.url; // Redirect to Stripe Checkout
        }
      },
      error: () => {
        this.buyingPackageId.set(null);
        this.roadmapNotice.set("Erreur de connexion à la boutique de paiement sécurisé.");
      }
    });
  }
}
