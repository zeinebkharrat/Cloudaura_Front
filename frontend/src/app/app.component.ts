import { Component, inject, signal, OnInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';


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

  isDarkMode = signal(true);
  isUserMenuOpen = signal(false);
  readonly isAdmin = this.auth.isAdmin;
  readonly isArtisan = this.auth.isArtisan;

  ngOnInit() {
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

  logout() {
    this.auth.logout();
    this.router.navigate(['/auth/signin']);
  }
}
