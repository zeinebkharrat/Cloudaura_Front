import { CommonModule } from '@angular/common';
import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';
import {
  executeRecaptchaV3,
  getRecaptchaResponse,
  loadRecaptchaScript,
  loadRecaptchaV3Script,
  renderRecaptchaInContainer,
  resetRecaptchaWidget,
} from './core/recaptcha.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css', './auth-pages.shared.css'],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  @ViewChild('recaptchaHost') recaptchaHost?: ElementRef<HTMLDivElement>;

  readonly isLoading = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly captchaEnabled = signal(false);
  readonly captchaSiteKey = signal('');
  readonly captchaMisconfigured = signal(false);
  readonly captchaV3 = signal(false);
  readonly captchaConfigReady = signal(false);
  readonly captchaConfigUnavailable = signal(false);

  private recaptchaWidgetId = -1;
  private recaptchaInitInFlight = false;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.authService.getCaptchaConfig().subscribe({
      next: (cfg) => {
        this.captchaConfigReady.set(true);
        this.captchaConfigUnavailable.set(!!cfg.configUnavailable);
        this.captchaMisconfigured.set(!!cfg.secretConfiguredButMissingSiteKey);
        this.captchaV3.set(cfg.version === 'v3');
        this.captchaEnabled.set(!!cfg.enabled && !!cfg.siteKey);
        this.captchaSiteKey.set(cfg.siteKey || '');
        afterNextRender(() => this.tryInitRecaptcha(), { injector: this.injector });
      },
    });
  }

  ngAfterViewInit(): void {
    afterNextRender(() => this.tryInitRecaptcha(), { injector: this.injector });
  }

  private tryInitRecaptcha(): void {
    if (!this.captchaEnabled() || !this.captchaSiteKey()) {
      return;
    }
    if (this.captchaV3()) {
      if (this.recaptchaInitInFlight) {
        return;
      }
      this.recaptchaInitInFlight = true;
      loadRecaptchaV3Script(this.captchaSiteKey())
        .catch(() => {
          this.formError.set('Could not load reCAPTCHA v3.');
        })
        .finally(() => {
          this.recaptchaInitInFlight = false;
        });
      return;
    }
    const el = this.recaptchaHost?.nativeElement;
    if (!el || this.recaptchaWidgetId >= 0 || this.recaptchaInitInFlight) {
      return;
    }
    this.recaptchaInitInFlight = true;
    loadRecaptchaScript()
      .then(() => renderRecaptchaInContainer(el, this.captchaSiteKey()))
      .then((id) => {
        if (this.recaptchaWidgetId < 0) {
          this.recaptchaWidgetId = id;
        }
      })
      .catch(() => {
        this.formError.set('Could not load the captcha.');
      })
      .finally(() => {
        this.recaptchaInitInFlight = false;
      });
  }

  controlInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  emailErrorMessage(): string {
    if (this.form.controls.email.hasError('required')) {
      return 'Email is required.';
    }
    return 'Please enter a valid email address.';
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.captchaConfigReady()) {
      this.formError.set('Loading bot protection… Please wait a moment.');
      return;
    }

    if (this.captchaConfigUnavailable()) {
      this.formError.set(
        'Cannot reach the server for reCAPTCHA configuration. Start the backend and reload the page.'
      );
      return;
    }

    if (this.captchaMisconfigured()) {
      this.formError.set(
        'reCAPTCHA is misconfigured on the server: add app.recaptcha.site-key in application.properties.'
      );
      return;
    }

    let captchaToken: string | null = null;
    if (this.captchaEnabled() && !this.captchaV3()) {
      captchaToken = getRecaptchaResponse(this.recaptchaWidgetId);
      if (!captchaToken) {
        this.formError.set('Please complete reCAPTCHA.');
        return;
      }
    }

    if (this.captchaEnabled() && this.captchaV3()) {
      this.isLoading.set(true);
      this.formError.set(null);
      this.formSuccess.set(null);
      const key = this.captchaSiteKey();
      const email = this.form.controls.email.value.trim();
      loadRecaptchaV3Script(key)
        .then(() => executeRecaptchaV3(key, 'forgot_password'))
        .then((token) => {
          if (!token?.trim()) {
            this.formError.set('reCAPTCHA v3: empty token.');
            this.isLoading.set(false);
            return;
          }
          this.runForgotPassword(email, token);
        })
        .catch(() => {
          this.formError.set('reCAPTCHA v3 unavailable. Reload the page.');
          this.isLoading.set(false);
        });
      return;
    }

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.runForgotPassword(this.form.controls.email.value.trim(), captchaToken);
  }

  private runForgotPassword(email: string, captchaToken: string | null): void {
    this.authService
      .forgotPassword({
        email,
        captchaToken,
      })
      .subscribe({
        next: (response) => this.formSuccess.set(response.message),
        error: (error: HttpErrorResponse) => {
          this.formError.set(
            extractApiErrorMessage(error, 'Could not send the password reset email.')
          );
          resetRecaptchaWidget(this.recaptchaWidgetId);
        },
        complete: () => this.isLoading.set(false),
      });
  }
}
