import { Component, inject, signal, OnInit, Renderer2, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ShopService } from './core/shop.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {

  private readonly router   = inject(Router);
  private readonly renderer = inject(Renderer2);
  readonly auth             = inject(AuthService);
  readonly shop             = inject(ShopService);

  isDarkMode = signal(true);
  isUserMenuOpen = signal(false);
  selectedCityName = signal<string | null>(null);

  readonly isAdmin = this.auth.isAdmin;
  readonly isArtisan = this.auth.isArtisan;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;

  ngOnInit() {
    this.auth.restoreSession();

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

  logout() {
    this.auth.logout();
    this.isUserMenuOpen.set(false);
    this.router.navigate(['/signin']);
  }
}
