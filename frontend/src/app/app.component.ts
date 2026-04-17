import { ApplicationRef, Component, inject, signal, OnInit, Renderer2, effect, HostListener, computed } from '@angular/core';
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
import { GamificationBadgeEntry, GamificationService } from './core/gamification.service';
import { ReservationNotificationItem, ReservationNotificationsService } from './core/reservation-notifications.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from './core/services/language.service';
import { CurrencySelectorComponent } from './core/components/currency-selector/currency-selector.component';

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
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private static readonly APP_BASE_TITLE = 'YallaTN+ - Premium Tunisian Tourism';
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  private readonly appRef = inject(ApplicationRef);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly chatService = inject(ChatService);
  private readonly gamification = inject(GamificationService);
  private readonly reservationNotificationsService = inject(ReservationNotificationsService);
  readonly notifier = inject(NotificationService);
  readonly loginPrompt = inject(LoginRequiredPromptService);

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
  }

  clearToast(): void {
    this.notifier.clear();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const threshold = this.isHeroRoute() ? 110 : 20;
    this.isScrolled.set(window.scrollY > threshold);
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
  }

  private syncRouteState(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    this.isHomeRoute.set(path === '' || path === '/');
    this.isCityRoute.set(path.startsWith('/city/'));
    this.isMobileNavOpen.set(false);
    this.onWindowScroll();
  }

  isStaysNavActive(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path.startsWith('/planifier-voyage') || path.startsWith('/hebergement') || path.startsWith('/my-bookings');
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
    this.isUserMenuOpen.set(false);
    this.isServicesMenuOpen.set(false);
    this.isChallengesPopupOpen.set(false);
    this.isMobileNavOpen.set(false);
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
