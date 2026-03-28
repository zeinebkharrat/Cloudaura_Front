import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { extractApiErrorMessage } from './api-error.util';
import { CityOption } from './auth.types';

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
  styleUrl: './sign-up.component.css',
})
export class SignUpComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly isUploadingImage = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly uploadedImageUrl = signal<string | null>(null);
  readonly cities = signal<CityOption[]>([]);
  readonly nationalities = signal<string[]>([]);
  readonly captchaQuestion = signal('');
  private captchaExpectedAnswer = 0;

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
      captchaAnswer: ['', [Validators.required]],
      becomeArtisan: [false],
    },
    { validators: passwordsMatch }
  );

  private isTunisiaNationality(value: string | null | undefined): boolean {
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized === 'tunisia' || normalized === 'tunisian' || normalized === 'tunisie';
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

    this.generateCaptcha();
  }

  controlInvalid(controlName: 'firstName' | 'lastName' | 'username' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'captchaAnswer' | 'cityId'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  private generateCaptcha(): void {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 2;
    this.captchaExpectedAnswer = a + b;
    this.captchaQuestion.set(`${a} + ${b} = ?`);
  }

  regenerateCaptcha(): void {
    this.form.controls.captchaAnswer.setValue('');
    this.form.controls.captchaAnswer.markAsUntouched();
    this.generateCaptcha();
  }

  private captchaIsValid(): boolean {
    const answer = Number(this.form.controls.captchaAnswer.value?.trim());
    return !Number.isNaN(answer) && answer === this.captchaExpectedAnswer;
  }

  phoneErrorMessage(): string {
    return 'Numéro téléphone invalide (8 à 20 chiffres, espaces ou tirets autorisés).';
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
      return;
    }

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    if (!this.captchaIsValid()) {
      this.form.controls.captchaAnswer.markAsTouched();
      this.formError.set('Captcha invalide. Merci de réessayer.');
      this.isLoading.set(false);
      this.regenerateCaptcha();
      return;
    }

    const { confirmPassword: _confirmPassword, captchaAnswer: _captchaAnswer, ...payload } = this.form.getRawValue();
    const isTunisia = this.isTunisiaNationality(payload.nationality);
    const cityId = payload.cityId != null ? Number(payload.cityId) : null;
    if (isTunisia && (cityId == null || Number.isNaN(cityId))) {
      this.form.controls.cityId.markAsTouched();
      this.formError.set('Veuillez selectionner une ville si vous choisissez Tunisie.');
      this.isLoading.set(false);
      return;
    }
    const finalPayload = {
      ...payload,
      phone: this.normalizePhone(payload.phone),
      cityId: isTunisia ? cityId : null,
      profileImageUrl: this.uploadedImageUrl(),
    };

    this.authService.signup(finalPayload).subscribe({
      next: (response) => {
        this.formSuccess.set(response.message || 'Compte cree. Verifiez votre email.');
        this.regenerateCaptcha();
        setTimeout(() => {
          this.router.navigateByUrl('/signin');
        }, 1200);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(extractApiErrorMessage(error, 'Inscription impossible. Veuillez réessayer.'));
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
        this.formError.set(extractApiErrorMessage(error, 'Upload image impossible.'));
      },
      complete: () => this.isUploadingImage.set(false),
    });
  }

  showCityField(): boolean {
    return this.isTunisiaNationality(this.form.controls.nationality.value);
  }
}
