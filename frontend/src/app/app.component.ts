import { Component, HostListener, inject, signal, OnInit, Renderer2, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth.service';
import { ShopService } from './core/shop.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);

  isDarkMode = signal(true);
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  readonly isArtisan = this.auth.isArtisan;
  isUserMenuOpen = signal(false);

  ngOnInit() {
    this.auth.restoreSession();
    this.shop.refreshCartCount();

    // DEBUG: Forcer l'affichage des infos utilisateur
    console.log('=== DEBUG AUTH ===');
    console.log('Token:', this.auth.token());
    console.log('Current user:', this.auth.currentUser());
    console.log('Is authenticated:', this.auth.isAuthenticated());
    console.log('Has ROLE_ARTISAN:', this.auth.hasRole('ROLE_ARTISAN'));
    console.log('Username:', this.auth.currentUser()?.username);
    console.log('==================');

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
