import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { extractApiErrorMessage } from '../api-error.util';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css', '../auth-pages.shared.css'],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

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

  private detectAttack(value: string, isPassword = false): string[] {
    const text = value.trim();
    const findings: string[] = [];

    // SQL Injection - more strict for passwords
    if (/\bunion\b\s+\bselect\b/i.test(text) || /(?:\bor\b|\band\b)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i.test(text)) {
      findings.push('SQL injection');
    } else if (!isPassword && /--|#|\/\*|\*\//.test(text)) {
      findings.push('SQL injection');
    }

    // XSS
    if (/<script|javascript:|onerror=|onload=|<img|<iframe|<svg/i.test(text)) {
      findings.push('XSS');
    }

    // Command Injection
    if (/[&`]|\$\(|<|>/.test(text)) {
      findings.push('Command injection');
    } else if (!isPassword && /[;|\|]/.test(text)) {
      findings.push('Command injection');
    }

    // Path Traversal
    if (/\.\.[/\\]|\/etc\/|\/var\/|C:\\|Windows\\/i.test(text)) {
      findings.push('Path traversal');
    }

    // NoSQL Injection
    if (/\$gt|\$ne|\$eq|\$where|\$regex/i.test(text)) {
      findings.push('NoSQL injection');
    }

    // Sensitive file probe
    if (/\.(passwd|shadow|htpasswd|config|ini|env|git|bak|sql|old|log|db|yaml|json|yml)\b/i.test(text)) {
      findings.push('Sensitive file probe');
    }

    return findings;
  }

  private showFraudAlert(findings: string[], message = 'Vous ete un hacker') {
    const details = findings.length > 0 ? `<ul style="text-align:left;margin:0;padding-left:18px">${findings.map((item) => `<li>${item}</li>`).join('')}</ul>` : '';
    void Swal.fire({
      icon: 'error',
      title: 'Fraud detected',
      html: `${message}<br><br><strong>Alert only:</strong> no one was actually banned.${details ? `<br><br>${details}` : ''}`,
      confirmButtonText: 'Understood',
    });
  }

  submit() {
    if (!this.username || !this.password) {
      this.error.set('Remplissez tous les champs.');
      return;
    }

    const credentials = {
      identifier: this.username.trim(),
      password: this.password,
    };

    const localFindings = [
      ...this.detectAttack(credentials.identifier, false),
      ...this.detectAttack(credentials.password, true)
    ];
    if (localFindings.length > 0) {
      this.loading.set(false);
      this.error.set('');
      this.showFraudAlert(Array.from(new Set(localFindings)));
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.auth.checkLoginRisk(credentials).subscribe({
      next: (risk) => {
        if (risk.status === 'blocked' || !risk.trusted) {
          this.loading.set(false);
          this.showFraudAlert(risk.details ?? [], risk.message || 'Vous ete un hacker');
          return;
        }

        this.auth.signin(credentials).subscribe({
          next: () => {
            this.loading.set(false);
            void this.router.navigateByUrl(this.auth.hasRole('ROLE_ADMIN') ? '/admin/dashboard' : '/');
          },
          error: (e: HttpErrorResponse) => {
            this.loading.set(false);
            const msg = extractApiErrorMessage(e, 'AUTH_SIGNIN.MSG_SIGNIN_FAILED');
            this.error.set(this.translate.instant(msg));
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('');
        const fallbackFindings = [...this.detectAttack(credentials.identifier), ...this.detectAttack(credentials.password)];
        if (fallbackFindings.length > 0) {
          this.showFraudAlert(Array.from(new Set(fallbackFindings)));
          return;
        }

        this.loading.set(true);
        this.auth.signin(credentials).subscribe({
          next: () => {
            this.loading.set(false);
            void this.router.navigateByUrl(this.auth.hasRole('ROLE_ADMIN') ? '/admin/dashboard' : '/');
          },
          error: (e: HttpErrorResponse) => {
            this.loading.set(false);
            const msg = extractApiErrorMessage(e, 'AUTH_SIGNIN.MSG_SIGNIN_FAILED');
            this.error.set(this.translate.instant(msg));
          },
        });
      },
    });
  }
}
