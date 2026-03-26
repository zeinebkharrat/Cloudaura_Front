import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { extractApiErrorMessage } from './api-error.util';
import { CityOption } from './auth.types';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isSavingProfile = signal(false);
  readonly isChangingPassword = signal(false);
  readonly uploadBusy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly currentUser = this.authService.currentUser;
  readonly cities = signal<CityOption[]>([]);
  readonly nationalities = signal<string[]>([]);

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    nationality: [''],
    cityId: [null as number | null],
    profileImageUrl: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

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

    this.authService.getProfile().subscribe({
      next: (user) => {
        this.profileForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ?? '',
          nationality: user.nationality ?? '',
          cityId: user.cityId ?? null,
          profileImageUrl: user.profileImageUrl ?? '',
        });
      },
      error: () => {
        this.actionError.set('Impossible de charger votre profil.');
      },
    });
  }

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.uploadBusy()) {
      return;
    }

    this.uploadBusy.set(true);
    this.actionError.set(null);

    this.authService.uploadProfileImage(file).subscribe({
      next: (response) => {
        this.profileForm.patchValue({ profileImageUrl: response.url });
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Upload image impossible.'));
      },
      complete: () => this.uploadBusy.set(false),
    });
  }

  saveProfile() {
    if (this.profileForm.invalid || this.isSavingProfile()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const payload = this.profileForm.getRawValue();
    const isTunisia = this.isTunisiaNationality(payload.nationality);
    const cityId = payload.cityId ? Number(payload.cityId) : null;
    if (isTunisia && !payload.cityId) {
      this.actionError.set('Veuillez selectionner une ville si vous choisissez Tunisie.');
      this.isSavingProfile.set(false);
      return;
    }

    this.authService
      .updateProfile({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone || null,
        nationality: payload.nationality || null,
        cityId: isTunisia ? cityId : null,
        profileImageUrl: payload.profileImageUrl || null,
      })
      .subscribe({
        next: (user) => {
          this.profileForm.patchValue({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone ?? '',
            nationality: user.nationality ?? '',
            cityId: user.cityId ?? null,
            profileImageUrl: user.profileImageUrl ?? '',
          });
          this.actionSuccess.set('Profil mis a jour avec succes.');
        },
        error: (error: HttpErrorResponse) => {
          this.actionError.set(extractApiErrorMessage(error, 'Mise a jour impossible.'));
        },
        complete: () => this.isSavingProfile.set(false),
      });
  }

  changePassword() {
    const value = this.passwordForm.getRawValue();
    if (this.passwordForm.invalid || this.isChangingPassword()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    if (value.newPassword !== value.confirmPassword) {
      this.actionError.set('La confirmation du nouveau mot de passe est invalide.');
      return;
    }

    this.isChangingPassword.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.authService
      .changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.actionSuccess.set('Mot de passe modifie avec succes.');
        },
        error: (error: HttpErrorResponse) => {
          this.actionError.set(extractApiErrorMessage(error, 'Changement de mot de passe impossible.'));
        },
        complete: () => this.isChangingPassword.set(false),
      });
  }

  showCityField(): boolean {
    return this.isTunisiaNationality(this.profileForm.controls.nationality.value);
  }
}
