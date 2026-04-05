import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { extractApiErrorMessage } from '../api-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  error = signal('');
  loading = signal(false);
  showPw = signal(false);

  constructor() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.auth.hasRole('ROLE_ADMIN') ? '/admin/dashboard' : '/');
    }
  }

  fill(role: 'admin' | 'user') {
    this.username = role === 'admin' ? 'admin' : 'user';
    this.password = role === 'admin' ? 'admin123' : 'user123';
    this.error.set('');
  }

  submit() {
    if (!this.username || !this.password) {
      this.error.set('Remplissez tous les champs.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.signin({ identifier: this.username.trim(), password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl(this.auth.hasRole('ROLE_ADMIN') ? '/admin/dashboard' : '/');
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extractApiErrorMessage(e, 'Identifiants invalides. Réessayez.'));
      },
    });
  }
}
