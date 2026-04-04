import { Component, inject, signal, OnInit, Renderer2, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { ShopService } from './core/shop.service';
import { ChatService } from './chat/chat.service';
import { ChatBubbleComponent } from './chat/chat-bubble/chat-bubble.component';
import { NotificationService } from './core/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ChatBubbleComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly chatService = inject(ChatService);
  readonly notifier = inject(NotificationService);

  isDarkMode = signal(true);
  isUserMenuOpen = signal(false);
  isServicesMenuOpen = signal(false);
  selectedCityName = signal<string | null>(null);
  isScrolled = signal(false);
  isHomeRoute = signal(false);

  readonly isAdmin = this.auth.isAdmin;
  readonly isArtisan = this.auth.isArtisan;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;

  readonly toastMessage = this.notifier.message;
  readonly toastType = this.notifier.type;

  constructor() {
    effect(
      () => {
        if (this.isAuthenticated()) {
          this.chatService.connect();
          this.chatService.loadConversations();
        } else {
          this.chatService.disconnect();
        }
      },
      { allowSignalWrites: true }
    );

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.syncRouteState());
  }

  clearToast(): void {
    this.notifier.clear();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const threshold = this.isHomeRoute() ? 110 : 20;
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
    this.onWindowScroll();
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

  @HostListener('document:click')
  onDocumentClick() {
    this.isUserMenuOpen.set(false);
    this.isServicesMenuOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.isUserMenuOpen.set(false);
    this.router.navigate(['/signin']);
  }
}
