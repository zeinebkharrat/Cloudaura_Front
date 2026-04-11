import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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

  readonly isLoading = signal(false);
  readonly isResendingVerification = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly socialProviders = signal({ google: false, github: false, facebook: false, instagram: false });

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
      return 'Password is required.';
    }
    return 'Invalid password.';
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
      this.formError.set('Social sign-in failed. Try another provider.');
      return;
    }

    if (!token) {
      return;
    }

    this.isLoading.set(true);
    this.authService.completeSocialSignin(token).subscribe({
      next: async () => {
        await this.showFirstSigninWelcomeIfNeeded();
        this.finishAuthFlow(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(extractApiErrorMessage(error, 'Invalid social token. Please try again.'));
      },
      complete: () => this.isLoading.set(false),
    });
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.signin(this.form.getRawValue()).subscribe({
      next: async () => {
        await this.showFirstSigninWelcomeIfNeeded();
        const returnUrl = this.getReturnUrl();
        this.finishAuthFlow(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (error.status === 403) {
          const fromApi = extractApiErrorMessage(error, '');
          this.formError.set(
            fromApi && fromApi.trim().length > 0
              ? fromApi
              : 'Your email is not verified yet. Check your inbox or use “Resend verification email” below.'
          );
          return;
        }
        this.formError.set(extractApiErrorMessage(error, 'Sign-in failed. Check your credentials.'));
      },
      complete: () => this.isLoading.set(false),
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
        popup: 'signin-welcome-popup',
        confirmButton: 'signin-welcome-confirm',
      },
      buttonsStyling: false,
      confirmButtonText: 'Start my journey',
      html: `
        <div class="signin-welcome-shell">
          <img src="assets/guide_welcome.png" alt="YallaTN+ guide" class="signin-welcome-image" />
          <h3>Welcome back, ${user.firstName || user.username}</h3>
          <p class="signin-welcome-typed"><span id="signin-welcome-typed-text"></span><span class="signin-welcome-cursor">|</span></p>
        </div>
      `,
      didOpen: () => {
        const target = document.getElementById('signin-welcome-typed-text');
        if (!target) {
          return;
        }

        const text = 'Are you ready for the best Tunisian visit and unforgettable moments?';
        let index = 0;
        const writer = window.setInterval(() => {
          index += 1;
          target.textContent = text.slice(0, index);
          if (index >= text.length) {
            window.clearInterval(writer);
          }
        }, 30);
      },
    });

    localStorage.setItem(key, '1');
  }

  resendVerificationEmail() {
    const identifier = this.form.controls.identifier.value.trim();
    if (!identifier) {
      this.formError.set('Enter your email or username to resend the verification link.');
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
        this.formError.set(extractApiErrorMessage(error, 'Could not resend the verification link.'));
      },
      complete: () => this.isResendingVerification.set(false),
    });
  }

  loginWithGoogle() {
    if (!this.socialProviders().google) {
      this.formError.set('Google sign-in is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('google');
  }

  loginWithFacebook() {
    if (!this.socialProviders().facebook) {
      this.formError.set('Facebook sign-in is not configured on the server. Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('facebook');
  }

  loginWithInstagram() {
    if (!this.socialProviders().instagram) {
      this.formError.set('Instagram sign-in is not configured on the server. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('instagram');
  }
}
