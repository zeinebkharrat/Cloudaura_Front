import { CommonModule } from '@angular/common';
import {
  afterNextRender,
  Component,
  EventEmitter,
  ElementRef,
  OnDestroy,
  Input,
  Output,
  inject,
  Injector,
  signal,
  ViewChild,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';
import { CityOption } from './core/auth.types';
import {
  executeRecaptchaV3,
  getRecaptchaResponse,
  loadRecaptchaScript,
  loadRecaptchaV3Script,
  renderRecaptchaInContainer,
  resetRecaptchaWidget,
} from './core/recaptcha.util';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (!password || !confirmPassword) {
    return null;
  }
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css', './auth-pages.shared.css'],
})
export class SignUpComponent implements OnDestroy {
    @Input() embedded = false;
    @Output() switchMode = new EventEmitter<'signin'>();
    @Output() signupCompleted = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  @ViewChild('recaptchaHost') recaptchaHost?: ElementRef<HTMLDivElement>;

  readonly isLoading = signal(false);
  readonly isUploadingImage = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly uploadedImageUrl = signal<string | null>(null);
  readonly cities = signal<CityOption[]>([]);
  readonly nationalities = signal<string[]>([]);
  readonly captchaEnabled = signal(false);
  readonly captchaSiteKey = signal('');
  readonly captchaMisconfigured = signal(false);
  /** v3 = score-based execute (no checkbox) — matches Google « Type de clé » when keys are v3. */
  readonly captchaV3 = signal(false);
  /** False until first /captcha-config response (avoids signup with null token while backend expects captcha). */
  readonly captchaConfigReady = signal(false);
  /** True when captcha-config request failed — user must fix connectivity / backend. */
  readonly captchaConfigUnavailable = signal(false);
  readonly showCameraPanel = signal(false);
  readonly cameraBusy = signal(false);
  readonly cameraReady = signal(false);
  readonly cameraError = signal<string | null>(null);
  readonly passwordStrengthLabel = signal('Very weak');
  readonly passwordStrengthPercent = signal(0);
  readonly passwordStrengthTone = signal('#ef4444');
  readonly passwordMatchHint = signal('Waiting for confirmation');
  readonly passwordMatchOk = signal(false);

  private recaptchaWidgetId = -1;
  private recaptchaInitInFlight = false;
  private mediaStream: MediaStream | null = null;

  @ViewChild('cameraVideo') private cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') private cameraCanvasRef?: ElementRef<HTMLCanvasElement>;

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\+?[0-9\s-]{8,20}$/)]],
      nationality: [''],
      cityId: [null as number | null],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      becomeArtisan: [false],
    },
    { validators: passwordsMatch }
  );

  private isTunisiaNationality(value: string | null | undefined): boolean {
    const normalized = (value ?? '').trim().toLowerCase();
    return (
      normalized === 'tunisia' ||
      normalized === 'tunisian' ||
      normalized === 'tunisie' ||
      normalized === 'tunisien' ||
      normalized === 'tunisienne'
    );
  }

  constructor() {
    this.authService.getNationalities().subscribe({
      next: (list) => this.nationalities.set(list),
      error: () => this.nationalities.set([]),
    });

    this.authService.getCities().subscribe({
      next: (cities) => this.cities.set(cities),
      error: () => this.cities.set([]),
    });

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

    this.form.controls.nationality.valueChanges.subscribe((nat) => {
      if (!this.isTunisiaNationality(nat)) {
        this.form.controls.cityId.setValue(null);
        this.form.controls.cityId.markAsUntouched();
      }
    });

    this.form.controls.password.valueChanges.subscribe((value) => {
      this.updatePasswordStrength(value ?? '');
      this.updatePasswordMatchHint();
    });

    this.form.controls.confirmPassword.valueChanges.subscribe(() => {
      this.updatePasswordMatchHint();
    });
  }

  ngOnDestroy(): void {
    this.stopCameraStream();
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
          this.formError.set('Could not load reCAPTCHA v3. Reload the page.');
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
        this.formError.set('Could not load the captcha. Reload the page.');
      })
      .finally(() => {
        this.recaptchaInitInFlight = false;
      });
  }

  controlInvalid(
    controlName: 'firstName' | 'lastName' | 'username' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'cityId'
  ): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  phoneErrorMessage(): string {
    return 'Invalid phone number (8–20 digits; spaces or hyphens allowed).';
  }

  private normalizePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed;
  }

  cityErrorVisible(): boolean {
    const control = this.form.controls.cityId;
    return this.showCityField() && (control.touched || this.form.touched) && (control.value == null || Number.isNaN(Number(control.value)));
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      if (this.form.hasError('passwordMismatch')) {
        this.formError.set('Password confirmation does not match.');
      } else {
        this.formError.set('Please correct the highlighted fields before continuing.');
      }
      return;
    }

    if (!this.captchaConfigReady()) {
      this.formError.set('Loading bot protection… Try again in a moment.');
      return;
    }

    if (this.captchaConfigUnavailable()) {
      this.formError.set(
        'Could not reach the server for reCAPTCHA configuration. Ensure the backend is running (proxy /api) and reload the page.'
      );
      return;
    }

    if (this.captchaMisconfigured()) {
      this.formError.set(
        'reCAPTCHA is misconfigured on the server: secret key without site key. Set app.recaptcha.site-key in application.properties.'
      );
      return;
    }

    const raw = this.form.getRawValue();
    const isTunisia = this.isTunisiaNationality(raw.nationality);
    const cityId = raw.cityId != null ? Number(raw.cityId) : null;
    if (isTunisia && (cityId == null || Number.isNaN(cityId))) {
      this.form.controls.cityId.markAsTouched();
      this.formError.set('Please select a city for Tunisia.');
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
      loadRecaptchaV3Script(key)
        .then(() => executeRecaptchaV3(key, 'signup'))
        .then((token) => {
          if (!token?.trim()) {
            this.formError.set('reCAPTCHA v3: empty token. Try again.');
            this.isLoading.set(false);
            return;
          }
          this.runSignupRequest(raw, isTunisia, cityId, token);
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
    this.runSignupRequest(raw, isTunisia, cityId, captchaToken);
  }

  private runSignupRequest(
    raw: {
      firstName: string;
      lastName: string;
      username: string;
      email: string;
      phone: string;
      nationality: string;
      cityId: number | null;
      password: string;
      confirmPassword: string;
      becomeArtisan: boolean;
    },
    isTunisia: boolean,
    cityId: number | null,
    captchaToken: string | null
  ): void {
    const finalPayload = {
      username: raw.username,
      email: raw.email,
      phone: this.normalizePhone(raw.phone),
      password: raw.password,
      firstName: raw.firstName,
      lastName: raw.lastName,
      becomeArtisan: raw.becomeArtisan,
      nationality: raw.nationality?.trim() || null,
      cityId: isTunisia ? cityId : null,
      profileImageUrl: this.uploadedImageUrl(),
      captchaToken,
    };

    this.authService.signup(finalPayload).subscribe({
      next: (response) => {
        this.formSuccess.set(response.message || 'Account created. Check your email.');
        resetRecaptchaWidget(this.recaptchaWidgetId);
        if (this.embedded) {
          this.signupCompleted.emit();
          this.switchMode.emit('signin');
          return;
        }
        setTimeout(() => {
          this.router.navigateByUrl('/signin');
        }, 2800);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        resetRecaptchaWidget(this.recaptchaWidgetId);
        this.formError.set(extractApiErrorMessage(error, 'Sign-up failed. Please try again.'));
      },
      complete: () => this.isLoading.set(false),
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.isUploadingImage()) {
      return;
    }

    this.isUploadingImage.set(true);
    this.formError.set(null);

    this.authService.uploadProfileImage(file).subscribe({
      next: (response) => {
        this.uploadedImageUrl.set(response.url);
      },
      error: (error: HttpErrorResponse) => {
        this.formError.set(extractApiErrorMessage(error, 'Image upload failed.'));
      },
      complete: () => this.isUploadingImage.set(false),
    });
  }

  async toggleCameraPanel() {
    if (this.showCameraPanel()) {
      this.showCameraPanel.set(false);
      this.stopCameraStream();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Camera is not supported on this browser.');
      return;
    }

    this.cameraError.set(null);
    this.showCameraPanel.set(true);
    await this.startCamera();
  }

  async startCamera() {
    if (this.cameraBusy()) {
      return;
    }

    this.cameraBusy.set(true);
    this.cameraReady.set(false);
    this.cameraError.set(null);

    try {
      this.stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      this.mediaStream = stream;

      const videoElement = this.cameraVideoRef?.nativeElement;
      if (!videoElement) {
        throw new Error('Camera preview is unavailable.');
      }

      videoElement.srcObject = stream;
      await videoElement.play();
      this.cameraReady.set(true);
    } catch {
      this.cameraError.set('Could not access camera. Please allow permission and retry.');
      this.showCameraPanel.set(false);
      this.stopCameraStream();
    } finally {
      this.cameraBusy.set(false);
    }
  }

  stopCameraStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    const videoElement = this.cameraVideoRef?.nativeElement;
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
    this.cameraReady.set(false);
  }

  captureFromCamera() {
    if (this.isUploadingImage() || this.cameraBusy()) {
      return;
    }

    const videoElement = this.cameraVideoRef?.nativeElement;
    const canvasElement = this.cameraCanvasRef?.nativeElement;
    if (!videoElement || !canvasElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      this.cameraError.set('Camera is not ready yet.');
      return;
    }

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    const context = canvasElement.getContext('2d');
    if (!context) {
      this.cameraError.set('Could not capture photo.');
      return;
    }

    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    this.isUploadingImage.set(true);
    this.cameraError.set(null);

    canvasElement.toBlob(
      (blob) => {
        if (!blob) {
          this.isUploadingImage.set(false);
          this.cameraError.set('Failed to generate image from camera.');
          return;
        }

        const photoFile = new File([blob], `signup-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        this.authService.uploadProfileImage(photoFile).subscribe({
          next: (response) => {
            this.uploadedImageUrl.set(response.url);
            this.formSuccess.set('Profile photo captured successfully.');
            this.showCameraPanel.set(false);
            this.stopCameraStream();
          },
          error: (error: HttpErrorResponse) => {
            this.cameraError.set(extractApiErrorMessage(error, 'Camera upload failed.'));
          },
          complete: () => this.isUploadingImage.set(false),
        });
      },
      'image/jpeg',
      0.92,
    );
  }

  private updatePasswordStrength(password: string) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    const labels = ['Very weak', 'Weak', 'Medium', 'Strong', 'Excellent'];
    const percents = [12, 30, 56, 78, 100];
    const tones = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#16a34a'];

    this.passwordStrengthLabel.set(labels[score]);
    this.passwordStrengthPercent.set(percents[score]);
    this.passwordStrengthTone.set(tones[score]);
  }

  private updatePasswordMatchHint() {
    const password = this.form.controls.password.value;
    const confirm = this.form.controls.confirmPassword.value;

    if (!confirm) {
      this.passwordMatchHint.set('Waiting for confirmation');
      this.passwordMatchOk.set(false);
      return;
    }

    const match = password === confirm;
    this.passwordMatchOk.set(match);
    this.passwordMatchHint.set(match ? 'Passwords match' : 'Passwords do not match');
  }

  showCityField(): boolean {
    return this.isTunisiaNationality(this.form.controls.nationality.value);
  }
}
