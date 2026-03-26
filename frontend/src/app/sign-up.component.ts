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

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      nationality: [''],
      cityId: [null as number | null],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      becomeArtisant: [false],
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
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    const { confirmPassword: _confirmPassword, ...payload } = this.form.getRawValue();
    const isTunisia = this.isTunisiaNationality(payload.nationality);
    const cityId = payload.cityId ? Number(payload.cityId) : null;
    if (isTunisia && !payload.cityId) {
      this.formError.set('Veuillez selectionner une ville si vous choisissez Tunisie.');
      this.isLoading.set(false);
      return;
    }
    const finalPayload = {
      ...payload,
      cityId: isTunisia ? cityId : null,
      profileImageUrl: this.uploadedImageUrl(),
    };

    this.authService.signup(finalPayload).subscribe({
      next: (response) => {
        this.formSuccess.set(response.message || 'Compte cree. Verifiez votre email.');
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
