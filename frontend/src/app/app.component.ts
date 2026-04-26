import { Component, inject, signal, OnInit, Renderer2, effect, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { ShopService } from './core/shop.service';
import { ChatService } from './chat/chat.service';
import { ChatBubbleComponent } from './chat/chat-bubble/chat-bubble.component';
import { NotificationService } from './core/notification.service';
import { LoginRequiredPromptService } from './core/login-required-prompt.service';
import { SignInComponent } from './sign-in.component';
import { SignUpComponent } from './sign-up.component';
import { DailyChallengeRow, GamificationBadgeEntry, GamificationService } from './core/gamification.service';
import { ReservationNotificationItem, ReservationNotificationsService } from './core/reservation-notifications.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from './core/services/language.service';
import { CurrencySelectorComponent } from './core/components/currency-selector/currency-selector.component';
import { HomeAssistantWidgetComponent } from './home-assistant-widget.component';
import { BackgroundAudioService } from './core/background-audio.service';

type NavbarTourMenuContext = 'services' | 'user' | null;

interface NavbarTourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  menuContext: NavbarTourMenuContext;
  imageKey: string;
  pose: 'left' | 'right' | 'top' | 'think' | 'gotit';
}
import { AiService } from './core/ai.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    ChatBubbleComponent,
    SignInComponent,
    SignUpComponent,
    CurrencySelectorComponent,
    HomeAssistantWidgetComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private static readonly APP_BASE_TITLE = 'YallaTN+ - Premium Tunisian Tourism';
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly chatService = inject(ChatService);
  private readonly gamification = inject(GamificationService);
  private readonly reservationNotificationsService = inject(ReservationNotificationsService);
  readonly notifier = inject(NotificationService);
  readonly loginPrompt = inject(LoginRequiredPromptService);
  readonly backgroundAudio = inject(BackgroundAudioService);
  private readonly ai = inject(AiService);

  isDarkMode = signal(true);
  isUserMenuOpen = signal(false);
  isServicesMenuOpen = signal(false);
  isMobileNavOpen = signal(false);
  selectedCityName = signal<string | null>(null);
  isScrolled = signal(false);
  isHomeRoute = signal(false);
  isCityRoute = signal(false);

  readonly isAdmin = this.auth.isAdmin;
  readonly isArtisan = this.auth.isArtisan;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;

  readonly toastMessage = this.notifier.message;
  readonly toastType = this.notifier.type;

  readonly authModalMode = signal<'signin' | 'signup'>('signin');
  readonly isChallengesPopupOpen = signal(false);
  readonly reservationNotifications = this.reservationNotificationsService.items;
  readonly notificationsBusy = this.reservationNotificationsService.busy;
  readonly userBadgeCollection = signal<GamificationBadgeEntry[]>([]);
  readonly acknowledgedNotificationIds = signal<Set<number>>(new Set());
  readonly userPoints = computed(() => {
    const fromAuth = this.currentUser()?.points;
    if (fromAuth != null) {
      return fromAuth;
    }
    return 0;
  });
  readonly challengeCount = computed(() => {
    const acknowledged = this.acknowledgedNotificationIds();
    return this.reservationNotifications().filter((n) => !n.read && !acknowledged.has(n.notificationId)).length;
  });
  readonly unreadNotificationCount = computed(() => this.reservationNotifications().filter((n) => !n.read).length);
  private gamificationRequestVersion = 0;

  readonly isNavbarTourActive = signal(false);
  readonly navbarTourSteps = signal<NavbarTourStep[]>([]);
  readonly navbarTourIndex = signal(0);
  readonly navbarTourSpotlightStyle = signal<Record<string, string>>({});
  readonly navbarTourCoachStyle = signal<Record<string, string>>({});
  readonly navbarTourCoachBelow = signal(true);
  readonly navbarTourCurrentStep = computed(() => this.navbarTourSteps()[this.navbarTourIndex()] ?? null);
  readonly navbarTourProgress = computed(() => {
    const total = this.navbarTourSteps().length;
    if (!total) {
      return 0;
    }
    return Math.round(((this.navbarTourIndex() + 1) / total) * 100);
  });
  readonly navbarGuideName = computed(() => (this.currentUser()?.gender === 'FEMALE' ? 'Zina' : 'Hamma'));
  readonly navbarGuideImage = computed(() => {
    const step = this.navbarTourCurrentStep();
    if (!step) {
      return 'assets/guide-mascot.png';
    }

    const isFemale = this.currentUser()?.gender === 'FEMALE';
    const byStep: Record<string, string> = isFemale
      ? {
          home: 'assets/zina_home.png',
          destinations: 'assets/zina_destination.png',
          services: 'assets/zina_activity.png',
          'services-activities': 'assets/zina_activity.png',
          'services-events': 'assets/zina_event.png',
          'services-restaurants': 'assets/zina_restaurant.png',
          'services-stays': 'assets/zina_community.png',
          'services-transport': 'assets/zina_destination.png',
          crafts: 'assets/zina_artisan.png',
          community: 'assets/zina_community.png',
          games: 'assets/zina_quiz.png',
          tour360: 'assets/zina_destination.png',
          'user-menu': 'assets/zina_think-removebg-preview.png',
          'user-settings': 'assets/zina_think-removebg-preview.png',
          favorites: 'assets/zina_favoris.png',
          cart: 'assets/zina_panier.png',
          challenges: 'assets/zina_quiz.png',
          currency: 'assets/zina_destination.png',
          audio: 'assets/zina_destination.png',
          theme: 'assets/zina_gotit-removebg-preview.png',
        }
      : {
          home: 'assets/hamma_home.png',
          destinations: 'assets/hamma_destination.png',
          services: 'assets/hamma_activity.png',
          'services-activities': 'assets/hamma_activity.png',
          'services-events': 'assets/hamma_event.png',
          'services-restaurants': 'assets/hamma_restaurant.png',
          'services-stays': 'assets/hamma_stays.png',
          'services-transport': 'assets/hamma_destination.png',
          crafts: 'assets/hama_artisan.png',
          community: 'assets/hamma_think-removebg-preview.png',
          games: 'assets/hamma_quiz.png',
          tour360: 'assets/hamma_destination.png',
          'user-menu': 'assets/hamma_think-removebg-preview.png',
          'user-settings': 'assets/hamma_think-removebg-preview.png',
          favorites: 'assets/hamma_favoris.png',
          cart: 'assets/hamma_panier.png',
          challenges: 'assets/hamma_quiz.png',
          currency: 'assets/hamma_exchange.png',
          audio: 'assets/hamma_exchange.png',
          theme: 'assets/hama_darkmode.png',
        };

    const fallback = isFemale ? 'assets/zina_right-removebg-preview.png' : 'assets/hamma_right-removebg-preview.png';
    return byStep[step.imageKey] ?? fallback;
  });
  readonly isNavbarTourLastStep = computed(
    () => this.navbarTourSteps().length > 0 && this.navbarTourIndex() >= this.navbarTourSteps().length - 1
  );

  private navbarTourUserId: number | null = null;
  private navbarTourAnimationFrameId: number | null = null;
  private navbarTourActiveTarget: HTMLElement | null = null;

  constructor() {
    effect(
      () => {
        if (this.isAuthenticated()) {
          this.chatService.connect();
          this.chatService.loadConversations();
          this.shop.refreshCartCount();
          this.reservationNotificationsService.connect();
          this.reservationNotificationsService.load();
        } else {
          this.chatService.disconnect();
          this.shop.cartCount.set(0);
          this.reservationNotificationsService.disconnect();
          this.reservationNotifications.set([]);
          this.acknowledgedNotificationIds.set(new Set());
        }
      },
      { allowSignalWrites: true }
    );

    effect(() => {
      const count = this.isAuthenticated() ? this.unreadNotificationCount() : 0;
      if (count > 0) {
        document.title = '(' + count + ') ' + AppComponent.APP_BASE_TITLE;
        return;
      }
      document.title = AppComponent.APP_BASE_TITLE;
    });

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.syncRouteState());

    effect(
      () => {
        if (this.isAuthenticated()) {
          this.loadGamificationSummary();
        } else {
          this.gamificationRequestVersion++;
          this.userBadgeCollection.set([]);
          this.isChallengesPopupOpen.set(false);
        }
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        if (!this.isAuthenticated() || this.isAdminArea()) {
          return;
        }

        const user = this.currentUser();
        if (!user) {
          return;
        }

        this.tryStartNavbarTourForUser(user.id);
      },
      { allowSignalWrites: true }
    );
  }

  clearToast(): void {
    this.notifier.clear();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const threshold = this.isHeroRoute() ? 110 : 20;
    this.isScrolled.set(window.scrollY > threshold);

    if (this.isNavbarTourActive()) {
      this.scheduleNavbarTourReposition();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isNavbarTourActive()) {
      this.scheduleNavbarTourReposition();
    }
  }

  ngOnInit() {
    this.auth.restoreSession();
    this.shop.refreshCartCount();

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      this.isDarkMode.set(false);
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'light');
    } else {
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'dark');
    }

    this.syncRouteState();
    this.backgroundAudio.init();
  }

  private syncRouteState(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    this.isHomeRoute.set(path === '' || path === '/');
    this.isCityRoute.set(path.startsWith('/city/'));
    this.isMobileNavOpen.set(false);
    this.onWindowScroll();

    if (this.isAdminArea() && this.isNavbarTourActive()) {
      this.skipNavbarTour();
    }

    const userId = this.currentUser()?.id;
    if (userId && !this.isNavbarTourActive()) {
      this.tryStartNavbarTourForUser(userId);
    }
  }

  isStaysNavActive(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path.startsWith('/hebergement') || path.startsWith('/my-bookings');
  }

  isHeroRoute(): boolean {
    return this.isHomeRoute() || this.isCityRoute();
  }

  isAdminArea(): boolean {
    return this.router.url.startsWith('/admin');
  }

  toggleTheme() {
    this.isDarkMode.set(!this.isDarkMode());
    const theme = this.isDarkMode() ? 'dark' : 'light';
    this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  toggleBackgroundAudio(): void {
    this.backgroundAudio.toggleMute();
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  closeUserMenu() {
    this.isUserMenuOpen.set(false);
  }

  toggleServicesMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isServicesMenuOpen.set(!this.isServicesMenuOpen());
  }

  closeServicesMenu() {
    this.isServicesMenuOpen.set(false);
  }

  toggleMobileNav(event: Event): void {
    event.stopPropagation();
    this.isMobileNavOpen.set(!this.isMobileNavOpen());
  }

  closeMobileNav(): void {
    this.isMobileNavOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.isNavbarTourActive()) {
      return;
    }

    this.isUserMenuOpen.set(false);
    this.isServicesMenuOpen.set(false);
    this.isChallengesPopupOpen.set(false);
    this.isMobileNavOpen.set(false);
  }

  nextNavbarTourStep(): void {
    if (!this.isNavbarTourActive()) {
      return;
    }

    this.goToNavbarTourStep(this.navbarTourIndex() + 1);
  }

  previousNavbarTourStep(): void {
    if (!this.isNavbarTourActive()) {
      return;
    }

    this.goToNavbarTourStep(Math.max(this.navbarTourIndex() - 1, 0));
  }

  skipNavbarTour(): void {
    this.finishNavbarTour(true);
  }

  finishNavbarTour(markCompleted = true): void {
    const userId = this.navbarTourUserId ?? this.currentUser()?.id ?? null;

    if (userId != null) {
      localStorage.removeItem(this.navbarTourPendingKey(userId));
      if (markCompleted) {
        localStorage.setItem(this.navbarTourDoneKey(userId), '1');
      }
    }

    this.navbarTourUserId = null;
    this.isNavbarTourActive.set(false);
    this.navbarTourSteps.set([]);
    this.navbarTourIndex.set(0);
    this.navbarTourSpotlightStyle.set({});
    this.navbarTourCoachStyle.set({});
    this.isServicesMenuOpen.set(false);
    this.isUserMenuOpen.set(false);
    this.clearNavbarTourTargetPulse();
  }

  private tryStartNavbarTourForUser(userId: number): void {
    const pendingKey = this.navbarTourPendingKey(userId);
    const doneKey = this.navbarTourDoneKey(userId);

    if (localStorage.getItem(doneKey) === '1') {
      localStorage.removeItem(pendingKey);
      return;
    }

    if (localStorage.getItem(pendingKey) !== '1') {
      return;
    }

    if (!this.isHomeRoute() || this.isAdminArea()) {
      return;
    }

    window.setTimeout(() => {
      if (this.isAdminArea() || !this.isAuthenticated()) {
        return;
      }

      this.startNavbarTour(userId);
    }, 40);
  }

  private startNavbarTour(userId: number): void {
    const steps = this.buildNavbarTourSteps();
    if (!steps.length) {
      localStorage.removeItem(this.navbarTourPendingKey(userId));
      return;
    }

    this.navbarTourUserId = userId;
    this.navbarTourSteps.set(steps);
    this.navbarTourIndex.set(0);
    this.isNavbarTourActive.set(true);
    this.goToNavbarTourStep(0);
  }

  private goToNavbarTourStep(index: number): void {
    const steps = this.navbarTourSteps();
    if (!steps.length) {
      this.finishNavbarTour(false);
      return;
    }

    if (index >= steps.length) {
      this.finishNavbarTour(true);
      return;
    }

    if (index < 0) {
      this.navbarTourIndex.set(0);
      return;
    }

    const step = steps[index];
    this.applyNavbarTourMenuContext(step.menuContext);

    window.setTimeout(() => {
      const target = document.querySelector(step.selector) as HTMLElement | null;
      if (!target) {
        this.goToNavbarTourStep(index + 1);
        return;
      }

      this.navbarTourIndex.set(index);
      this.setNavbarTourTargetPulse(target);
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      window.setTimeout(() => this.positionNavbarTour(target), 140);
    }, 60);
  }

  private positionNavbarTour(target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const gap = 8;
    const spotlightTop = Math.max(8, rect.top - gap);
    const spotlightLeft = Math.max(8, rect.left - gap);
    const spotlightWidth = Math.min(window.innerWidth - 16, rect.width + gap * 2);
    const spotlightHeight = Math.min(window.innerHeight - 16, rect.height + gap * 2);

    this.navbarTourSpotlightStyle.set({
      top: `${spotlightTop}px`,
      left: `${spotlightLeft}px`,
      width: `${spotlightWidth}px`,
      height: `${spotlightHeight}px`,
    });

    const coachWidth = Math.min(390, window.innerWidth - 24);
    const placeBelow = rect.top < window.innerHeight * 0.44;
    this.navbarTourCoachBelow.set(placeBelow);

    const preferredTop = placeBelow ? rect.bottom + 16 : rect.top - 250;
    const coachTop = Math.max(12, Math.min(preferredTop, window.innerHeight - 240));
    const coachLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - coachWidth / 2, window.innerWidth - coachWidth - 12));

    this.navbarTourCoachStyle.set({
      top: `${coachTop}px`,
      left: `${coachLeft}px`,
      width: `${coachWidth}px`,
    });
  }

  private scheduleNavbarTourReposition(): void {
    if (this.navbarTourAnimationFrameId != null) {
      window.cancelAnimationFrame(this.navbarTourAnimationFrameId);
    }

    this.navbarTourAnimationFrameId = window.requestAnimationFrame(() => {
      this.navbarTourAnimationFrameId = null;
      const step = this.navbarTourCurrentStep();
      if (!step) {
        return;
      }

      const target = document.querySelector(step.selector) as HTMLElement | null;
      if (!target) {
        return;
      }

      this.positionNavbarTour(target);
    });
  }

  private applyNavbarTourMenuContext(context: NavbarTourMenuContext): void {
    this.isServicesMenuOpen.set(context === 'services');
    this.isUserMenuOpen.set(context === 'user');
  }

  private setNavbarTourTargetPulse(target: HTMLElement): void {
    if (this.navbarTourActiveTarget === target) {
      return;
    }

    this.clearNavbarTourTargetPulse();
    target.classList.add('tour-target-active');
    this.navbarTourActiveTarget = target;
  }

  private clearNavbarTourTargetPulse(): void {
    document.querySelectorAll('.tour-target-active').forEach((node) => {
      (node as HTMLElement).classList.remove('tour-target-active');
    });

    if (!this.navbarTourActiveTarget) {
      return;
    }

    this.navbarTourActiveTarget.classList.remove('tour-target-active');
    this.navbarTourActiveTarget = null;
  }

  private navbarTourPendingKey(userId: number): string {
    return `navbar-tour-pending-${userId}`;
  }

  private navbarTourDoneKey(userId: number): string {
    return `navbar-tour-done-${userId}`;
  }

  private buildNavbarTourSteps(): NavbarTourStep[] {
    const guideName = this.navbarGuideName();
    return [
      {
        id: 'home',
        selector: '[data-tour-id="nav-home"]',
        title: `Welcome, I am ${guideName}`,
        description: 'I will guide you through your navigation bar. Start from Home anytime to reset your trip planning.',
        menuContext: null,
        imageKey: 'home',
        pose: 'think',
      },
      {
        id: 'destinations',
        selector: '[data-tour-id="nav-destinations"]',
        title: 'Destinations map',
        description: 'Discover Tunisian places on an interactive map and jump directly into cities you love.',
        menuContext: null,
        imageKey: 'destinations',
        pose: 'right',
      },
      {
        id: 'services',
        selector: '[data-tour-id="nav-services"]',
        title: 'Services menu',
        description: 'This menu groups your activity booking essentials.',
        menuContext: null,
        imageKey: 'services',
        pose: 'left',
      },
      {
        id: 'services-activities',
        selector: '[data-tour-id="services-activities"]',
        title: 'Services: Activities',
        description: 'Book adventures, guided tours, and local experiences from one place.',
        menuContext: 'services',
        imageKey: 'services-activities',
        pose: 'right',
      },
      {
        id: 'services-events',
        selector: '[data-tour-id="services-events"]',
        title: 'Services: Events',
        description: 'Find cultural events and upcoming happenings around Tunisia.',
        menuContext: 'services',
        imageKey: 'services-events',
        pose: 'left',
      },
      {
        id: 'services-restaurants',
        selector: '[data-tour-id="services-restaurants"]',
        title: 'Services: Restaurants',
        description: 'Browse dining spots and cuisine recommendations tailored to your profile.',
        menuContext: 'services',
        imageKey: 'services-restaurants',
        pose: 'right',
      },
      {
        id: 'services-stays',
        selector: '[data-tour-id="services-stays"]',
        title: 'Services: Stays',
        description: 'Plan and reserve hotels or accommodations for each stage of your trip.',
        menuContext: 'services',
        imageKey: 'services-stays',
        pose: 'left',
      },
      {
        id: 'services-transport',
        selector: '[data-tour-id="services-transport"]',
        title: 'Services: Transport',
        description: 'Compare mobility options and move between destinations effortlessly.',
        menuContext: 'services',
        imageKey: 'services-transport',
        pose: 'right',
      },
      {
        id: 'crafts',
        selector: '[data-tour-id="nav-crafts"]',
        title: 'Crafts',
        description: 'Support local artisans and discover authentic handmade products.',
        menuContext: null,
        imageKey: 'crafts',
        pose: 'top',
      },
      {
        id: 'community',
        selector: '[data-tour-id="nav-community"]',
        title: 'Community',
        description: 'Post stories, share tips, and connect with fellow travelers.',
        menuContext: null,
        imageKey: 'community',
        pose: 'top',
      },
      {
        id: 'games',
        selector: '[data-tour-id="nav-games"]',
        title: 'Games',
        description: 'Earn rewards and points by playing challenges.',
        menuContext: null,
        imageKey: 'games',
        pose: 'think',
      },
      {
        id: 'tour360',
        selector: '[data-tour-id="nav-tour360"]',
        title: '360 Tour',
        description: 'Preview places with immersive virtual exploration before visiting.',
        menuContext: null,
        imageKey: 'tour360',
        pose: 'top',
      },
      {
        id: 'user-menu',
        selector: '[data-tour-id="user-menu-trigger"]',
        title: 'Your account hub',
        description: 'Open your profile menu to access purchases, favorites, and personal settings.',
        menuContext: null,
        imageKey: 'user-menu',
        pose: 'left',
      },
      {
        id: 'user-settings',
        selector: '[data-tour-id="user-settings"]',
        title: 'Settings',
        description: 'Manage your account information and profile from here.',
        menuContext: 'user',
        imageKey: 'user-settings',
        pose: 'right',
      },
      {
        id: 'favorites',
        selector: '[data-tour-id="nav-favorites"]',
        title: 'Favorites quick access',
        description: 'This icon jumps straight to your saved items.',
        menuContext: null,
        imageKey: 'favorites',
        pose: 'left',
      },
      {
        id: 'cart',
        selector: '[data-tour-id="nav-cart"]',
        title: 'Cart',
        description: 'Track selected products and checkout when you are ready.',
        menuContext: null,
        imageKey: 'cart',
        pose: 'right',
      },
      {
        id: 'challenges',
        selector: '[data-tour-id="nav-challenges"]',
        title: 'Daily challenges',
        description: 'Check your daily challenge feed and collect extra points.',
        menuContext: null,
        imageKey: 'challenges',
        pose: 'think',
      },
      {
        id: 'currency',
        selector: '[data-tour-id="nav-currency"]',
        title: 'Currency selector',
        description: 'Switch prices to your preferred currency instantly.',
        menuContext: null,
        imageKey: 'currency',
        pose: 'left',
      },
      {
        id: 'audio',
        selector: '[data-tour-id="nav-audio"]',
        title: 'Background music',
        description: 'Mute or unmute the site background music without losing your place when you browse.',
        menuContext: null,
        imageKey: 'audio',
        pose: 'left',
      },
      {
        id: 'theme',
        selector: '[data-tour-id="nav-theme"]',
        title: 'Theme toggle',
        description: 'Use this to switch light and dark mode anytime.',
        menuContext: null,
        imageKey: 'theme',
        pose: 'gotit',
      },
    ];
  }

  toggleChallengesPopup(event: Event): void {
    event.stopPropagation();
    const next = !this.isChallengesPopupOpen();
    this.isChallengesPopupOpen.set(next);
    if (next) {
      this.acknowledgeCurrentUnreadNotifications();
      if (this.reservationNotifications().length === 0) {
        this.reservationNotificationsService.load();
      }
    }
  }

  closeChallengesPopup(): void {
    this.isChallengesPopupOpen.set(false);
  }

  readonly challengeAiHelp = signal<Record<number, string>>({});
  readonly challengeAiLoading = signal<Record<number, boolean>>({});

  getAiHelp(challenge: DailyChallengeRow): void {
    if (this.challengeAiHelp()[challenge.challengeId]) {
      // Toggle off if already shown
      const next = { ...this.challengeAiHelp() };
      delete next[challenge.challengeId];
      this.challengeAiHelp.set(next);
      return;
    }

    this.challengeAiLoading.update(prev => ({ ...prev, [challenge.challengeId]: true }));
    this.ai.getHelpForChallenge(challenge).subscribe({
      next: (help: string) => {
        this.challengeAiHelp.update(prev => ({ ...prev, [challenge.challengeId]: help }));
        this.challengeAiLoading.update(prev => ({ ...prev, [challenge.challengeId]: false }));
      },
      error: () => {
        this.challengeAiLoading.update(prev => ({ ...prev, [challenge.challengeId]: false }));
      }
    });
  }


  private loadGamificationSummary(): void {
    const userId = this.currentUser()?.id;
    if (!userId) {
      this.userBadgeCollection.set([]);
      return;
    }

    const requestVersion = ++this.gamificationRequestVersion;

    this.gamification.me().subscribe({
      next: (me) => {
        if (requestVersion !== this.gamificationRequestVersion) {
          return;
        }
        if (!this.isAuthenticated() || this.currentUser()?.id !== userId) {
          return;
        }
        this.userBadgeCollection.set(me.badges ?? []);
      },
      error: () => {
        if (requestVersion !== this.gamificationRequestVersion) {
          return;
        }
        if (!this.isAuthenticated() || this.currentUser()?.id !== userId) {
          return;
        }
        this.userBadgeCollection.set([]);
      },
    });

  }

  openNotification(item: ReservationNotificationItem): void {
    if (!item.read) {
      this.reservationNotificationsService.markAsRead(item.notificationId);
    }
    this.closeChallengesPopup();
    if (this.isSocialNotification(item)) {
      const queryParams: Record<string, string | number> = {};
      if (item.reservationId != null) {
        queryParams['postId'] = item.reservationId;
      }
      void this.router.navigate([item.route || '/communaute'], { queryParams });
      return;
    }

    const type = this.notificationTypeKey(item.reservationType);
    void this.router.navigate(['/settings'], {
      queryParams: {
        section: 'history',
        type,
      },
    });
  }

  markAllNotificationsRead(event: Event): void {
    event.stopPropagation();
    this.reservationNotificationsService.markAllAsRead();
    this.acknowledgedNotificationIds.set(new Set());
  }

  private acknowledgeCurrentUnreadNotifications(): void {
    const next = new Set(this.acknowledgedNotificationIds());
    for (const item of this.reservationNotifications()) {
      if (!item.read) {
        next.add(item.notificationId);
      }
    }
    this.acknowledgedNotificationIds.set(next);
  }

  notificationTypeLabel(value: string | null | undefined): string {
    const key = this.notificationTypeKey(value);
    if (key === 'stay') {
      return 'Stay';
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  notificationCategoryLabel(item: ReservationNotificationItem): string {
    const normalizedType = (item.type ?? '').toUpperCase();
    if (normalizedType === 'POST_LIKE') {
      return 'Likes';
    }
    if (normalizedType === 'POST_COMMENT') {
      return 'Comments';
    }
    if (normalizedType === 'POST_REPOST') {
      return 'Reposts';
    }
    return this.notificationTypeLabel(item.reservationType);
  }

  notificationActorInitial(item: ReservationNotificationItem): string {
    const value = item.lastActorName?.trim();
    if (!value) {
      return 'U';
    }
    return value.charAt(0).toUpperCase();
  }

  isSocialNotificationPublic(item: ReservationNotificationItem): boolean {
    const normalizedType = (item.type ?? '').toUpperCase();
    return normalizedType === 'POST_LIKE' || normalizedType === 'POST_COMMENT' || normalizedType === 'POST_REPOST';
  }

  notificationReactionEmoji(item: ReservationNotificationItem): string {
    const normalizedType = (item.type ?? '').toUpperCase();
    if (normalizedType === 'POST_LIKE') {
      return '❤';
    }
    if (normalizedType === 'POST_COMMENT') {
      return '💬';
    }
    if (normalizedType === 'POST_REPOST') {
      return '🔁';
    }
    return '';
  }

  private isSocialNotification(item: ReservationNotificationItem): boolean {
    return this.isSocialNotificationPublic(item);
  }

  private notificationTypeKey(value: string | null | undefined): 'transport' | 'stay' | 'activity' | 'event' | 'artisan' {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized === 'TRANSPORT') {
      return 'transport';
    }
    if (normalized === 'STAY' || normalized === 'ACCOMMODATION' || normalized === 'HEBERGEMENT') {
      return 'stay';
    }
    if (normalized === 'ACTIVITY') {
      return 'activity';
    }
    if (normalized === 'EVENT') {
      return 'event';
    }
    if (normalized === 'ARTISAN' || normalized === 'ORDER') {
      return 'artisan';
    }
    return 'transport';
  }

  formatNotificationDate(value: string | null | undefined): string {
    if (!value) {
      return 'Unknown date';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsed);
  }

  logout() {
    this.gamificationRequestVersion++;
    this.reservationNotificationsService.disconnect();
    this.reservationNotifications.set([]);
    this.acknowledgedNotificationIds.set(new Set());
    this.userBadgeCollection.set([]);
    this.isChallengesPopupOpen.set(false);
    this.shop.cartCount.set(0);
    this.auth.logout();
    this.isUserMenuOpen.set(false);
    this.router.navigate(['/signin']);
  }

  closeLoginPrompt(): void {
    this.loginPrompt.hide();
  }

  goToSignInFromPrompt(): void {
    this.authModalMode.set('signin');
  }

  goToSignUpFromPrompt(): void {
    this.authModalMode.set('signup');
  }

  handlePopupAuthSuccess(): void {
    const returnUrl = this.loginPrompt.returnUrl();
    this.closeLoginPrompt();
    if (this.auth.hasRole('ROLE_ADMIN')) {
      this.router.navigateByUrl('/admin/dashboard');
      return;
    }
    this.router.navigateByUrl(returnUrl || '/');
  }

  handlePopupSignupDone(): void {
    this.authModalMode.set('signin');
  }
}
