import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';

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
      next: () => {
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

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.signin(this.form.getRawValue()).subscribe({
      next: () => {
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
              : this.translate.instant('AUTH_SIGNIN.MSG_VERIFY_REMINDER')
          );
          return;
        }
        this.formError.set(extractApiErrorMessage(error, this.translate.instant('AUTH_SIGNIN.MSG_SIGNIN_FAILED')));
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

  loginWithGithub() {
    if (!this.socialProviders().github) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_GITHUB_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('github');
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
