import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  username = '';
  password = '';
  error    = signal('');
  loading  = signal(false);
  showPw   = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    if (auth.isLoggedIn()) router.navigate([auth.isAdmin() ? '/admin' : '/']);
  }

  fill(role: 'admin' | 'user') {
    this.username = role === 'admin' ? 'admin' : 'user';
    this.password = role === 'admin' ? 'admin123' : 'user123';
    this.error.set('');
  }

  submit() {
    if (!this.username || !this.password) { this.error.set('Remplissez tous les champs.'); return; }
    this.loading.set(true); this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: () => { this.loading.set(false); this.router.navigate([this.auth.isAdmin() ? '/admin' : '/']); },
      error: () => { this.loading.set(false); this.error.set('Identifiants invalides. Réessayez.'); },
    });
  }
}
