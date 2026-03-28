import { Component, inject, signal, OnInit, Renderer2, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth.service';
import { ShopService } from './core/shop.service';
import { ChatService } from './chat/chat.service';
import { ChatBubbleComponent } from './chat/chat-bubble/chat-bubble.component';

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

  isDarkMode = signal(true);
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  readonly isArtisan = this.auth.isArtisan;
  isUserMenuOpen = signal(false);

  constructor() {
    effect(() => {
      if (this.isAuthenticated()) {
        this.chatService.connect();
        this.chatService.loadConversations();
      } else {
        this.chatService.disconnect();
      }
    }, { allowSignalWrites: true });
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
  }

  isAdminArea(): boolean {
    return this.router.url.startsWith('/admin');
  }

  logout(): void {
    this.isUserMenuOpen.set(false);
    this.shop.cartCount.set(0);
    this.auth.logout();
    this.router.navigateByUrl('/');
  }

  toggleTheme() {
    this.isDarkMode.set(!this.isDarkMode());
    const theme = this.isDarkMode() ? 'dark' : 'light';
    this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  closeUserMenu() {
    this.isUserMenuOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.isUserMenuOpen.set(false);
  }
}
