import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { travelPrefsStorageKey } from './core/travel-match.storage';
import { extractApiErrorMessage } from './api-error.util';
import Swal from 'sweetalert2';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css', './auth-pages.shared.css'],
})
export class SignInComponent implements OnInit {
    @Input() embedded = false;
    @Input() returnUrlOverride: string | null = null;
    @Output() switchMode = new EventEmitter<'signup'>();
    @Output() authenticated = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  readonly isLoading = signal(false);
  readonly isResendingVerification = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly socialProviders = signal({ google: false, github: false, facebook: false, instagram: false });
  readonly showPw = signal(false);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  controlInvalid(controlName: 'identifier' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  passwordErrorMessage(): string {
    const control = this.form.controls.password;
    if (control.hasError('required')) {
      return this.translate.instant('AUTH_SIGNIN.ERR_PASSWORD_REQUIRED');
    }
    return this.translate.instant('AUTH_SIGNIN.ERR_PASSWORD_INVALID');
  }

  private detectAttack(value: string, isPassword = false): string[] {
    const text = value.trim();
    const findings: string[] = [];

    if (/\bunion\b\s+\bselect\b/i.test(text) || /(?:\bor\b|\band\b)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i.test(text) || /--|#|\/\*|\*\//.test(text)) {
      findings.push('SQL injection');
    }
    if (/<script|javascript:|onerror=|onload=|<img|<iframe|<svg/i.test(text)) {
      findings.push('XSS');
    }
    // Command Injection
    if (/[&`] |\$\(|<|>/.test(text)) {
      findings.push('Command injection');
    } else if (!isPassword && /[;|\|]/.test(text)) {
      findings.push('Command injection');
    }
    if (/\.\.[/\\]|\/etc\/|\/var\/|C:\\|Windows\\/i.test(text)) {
      findings.push('Path traversal');
    }
    if (/\$gt|\$ne|\$eq|\$where|\$regex/i.test(text)) {
      findings.push('NoSQL injection');
    }
    if (/\.(passwd|shadow|htpasswd|config|ini|env|git|bak|sql|old|log|db|yaml|json|yml)\b/i.test(text)) {
      findings.push('Sensitive file probe');
    }

    return findings;
  }

  private showFraudAlert(findings: string[], message = 'Vous êtes un hacker') {
    const details = findings.length > 0
      ? `<ul style="text-align:left;margin:0;padding-left:18px">${findings.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '';

    void Swal.fire({
      icon: 'error',
      title: 'Fraud detected',
      html: `${message}<br><br><strong>Alert only:</strong> no one was actually banned.${details ? `<br><br>${details}` : ''}`,
      confirmButtonText: 'Understood',
    });
  }

  private formatBackendMessage(message: string | null | undefined, fallbackKey: string): string {
    const raw = (message ?? '').trim();
    if (!raw) {
      return this.translate.instant(fallbackKey);
    }
    if (raw.startsWith('ui:')) {
      return raw.substring(3).trim();
    }
    if (raw.startsWith('AUTH_SIGNIN.') || raw.startsWith('api.error.')) {
      return this.translate.instant(raw);
    }
    return raw;
  }

  ngOnInit() {
    this.authService.getSocialProviders().subscribe({
      next: (providers) => this.socialProviders.set(providers),
      error: () => this.socialProviders.set({ google: false, github: false, facebook: false, instagram: false }),
    });

    const token = this.route.snapshot.queryParamMap.get('token');
    const socialError = this.route.snapshot.queryParamMap.get('error');
    const returnUrl = this.getReturnUrl();

    if (socialError) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_SOCIAL_FAILED'));
      return;
    }

    if (!token) {
      return;
    }

    this.isLoading.set(true);
    this.authService.completeSocialSignin(token).subscribe({
      next: async () => {
        await this.showFirstSigninWelcomeIfNeeded();
        this.markNavbarTutorialPending();
        this.finishAuthFlow(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(extractApiErrorMessage(error, this.translate.instant('AUTH_SIGNIN.MSG_SOCIAL_TOKEN_INVALID')));
      },
      complete: () => this.isLoading.set(false),
    });
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    const credentials = this.form.getRawValue();
    const localFindings = [
      ...this.detectAttack(credentials.identifier, false),
      ...this.detectAttack(credentials.password, true)
    ];
    if (localFindings.length > 0) {
      this.formError.set(null);
      this.formSuccess.set(null);
      this.showFraudAlert(Array.from(new Set(localFindings)));
      return;
    }

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.checkLoginRisk(credentials).subscribe({
      next: (risk) => {
        this.isLoading.set(false);
        if (risk.status === 'blocked' || !risk.trusted) {
          this.showFraudAlert(risk.details ?? [], risk.message || 'Vous êtes un hacker');
          return;
        }

        this.authService.signin(credentials).subscribe({
          next: async () => {
            await this.showFirstSigninWelcomeIfNeeded();
            this.markNavbarTutorialPending();
            const returnUrl = this.getReturnUrl();
            this.finishAuthFlow(returnUrl);
          },
          error: (error: HttpErrorResponse) => {
            this.isLoading.set(false);
            if (error.status === 403) {
              const fromApi = extractApiErrorMessage(error, '');
              this.formError.set(this.formatBackendMessage(fromApi, 'AUTH_SIGNIN.MSG_VERIFY_REMINDER'));
              return;
            }
            const msg = extractApiErrorMessage(error, 'AUTH_SIGNIN.MSG_SIGNIN_FAILED');
            this.formError.set(this.formatBackendMessage(msg, 'AUTH_SIGNIN.MSG_SIGNIN_FAILED'));
          },
          complete: () => this.isLoading.set(false),
        });
      },
      error: () => {
        this.isLoading.set(false);
        const fallbackFindings = [...this.detectAttack(credentials.identifier), ...this.detectAttack(credentials.password)];
        if (fallbackFindings.length > 0) {
          this.showFraudAlert(Array.from(new Set(fallbackFindings)));
          return;
        }

        this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_SIGNIN_FAILED'));
      },
    });
  }

  private getReturnUrl(): string {
    return this.returnUrlOverride || this.route.snapshot.queryParamMap.get('returnUrl') || '/';
  }

  private finishAuthFlow(returnUrl: string): void {
    if (this.embedded) {
      this.authenticated.emit();
      return;
    }
    if (this.authService.hasRole('ROLE_ADMIN')) {
      this.router.navigateByUrl('/admin/dashboard');
      return;
    }
    const user = this.authService.currentUser();
    const needsPrefs =
      !!user?.id &&
      typeof localStorage !== 'undefined' &&
      !localStorage.getItem(travelPrefsStorageKey(user.id));
    if (needsPrefs) {
      const q = encodeURIComponent(returnUrl || '/');
      void this.router.navigateByUrl(`/welcome-travel-style?next=${q}`);
      return;
    }
    this.router.navigateByUrl(returnUrl);
  }

  private async showFirstSigninWelcomeIfNeeded() {
    const user = this.authService.currentUser();
    if (!user) {
      return;
    }

    const key = `signin-first-welcome-shown-${user.id}`;
    if (localStorage.getItem(key) === '1') {
      return;
    }

    await Swal.fire({
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      width: 760,
      customClass: {
        popup: 'signin-wizard-popup',
        confirmButton: 'signin-wizard-confirm',
      },
      buttonsStyling: false,
      confirmButtonText: 'Enter Home',
      html: `
        <div class="signin-wizard-shell">
          <img src="assets/guide_welcome.png" alt="YallaTN+ guide" class="signin-wizard-guide" />
          <h3>Welcome to YallaTN+, ${user.firstName || user.username}!</h3>
          <p class="signin-wizard-sub">Your personalized world is ready. Let us explore Tunisia together.</p>
        </div>
      `,
    });

    localStorage.setItem(key, '1');
  }

  private markNavbarTutorialPending(): void {
    const user = this.authService.currentUser();
    if (!user?.id) {
      return;
    }

    const doneKey = `navbar-tour-done-${user.id}`;
    if (localStorage.getItem(doneKey) === '1') {
      return;
    }

    localStorage.setItem(`navbar-tour-pending-${user.id}`, '1');
  }

  resendVerificationEmail() {
    const identifier = this.form.controls.identifier.value.trim();
    if (!identifier) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_RESEND_NEED_IDENTIFIER'));
      return;
    }
    if (this.isResendingVerification()) {
      return;
    }

    this.isResendingVerification.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.resendVerification({ identifier }).subscribe({
      next: (response) => this.formSuccess.set(response.message),
      error: (error: HttpErrorResponse) => {
        this.formError.set(extractApiErrorMessage(error, this.translate.instant('AUTH_SIGNIN.MSG_RESEND_FAILED')));
      },
      complete: () => this.isResendingVerification.set(false),
    });
  }

  loginWithGoogle() {
    if (!this.socialProviders().google) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_GOOGLE_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('google');
  }

  loginWithFacebook() {
    if (!this.socialProviders().facebook) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_FACEBOOK_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('facebook');
  }

  loginWithInstagram() {
    if (!this.socialProviders().instagram) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_INSTAGRAM_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('instagram');
  }
}
