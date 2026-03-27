import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
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
    const cityId = payload.cityId != null ? Number(payload.cityId) : null;
    if (isTunisia && (cityId == null || Number.isNaN(cityId))) {
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

  async openChangePasswordPopup() {
    if (this.isChangingPassword()) {
      return;
    }

    const result = await Swal.fire({
      title: 'Changer mot de passe',
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      customClass: {
        popup: 'profile-swal-popup',
        title: 'profile-swal-title',
        confirmButton: 'profile-swal-confirm',
        cancelButton: 'profile-swal-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      confirmButtonText: 'Valider',
      cancelButtonText: 'Annuler',
      focusConfirm: false,
      html: `
        <div class="profile-swal-form">
          <p class="profile-swal-note">Mettez a jour votre mot de passe avec une valeur forte et unique.</p>
          <input id="sw-current-password" class="swal2-input profile-swal-input" type="password" placeholder="Mot de passe actuel" />
          <input id="sw-new-password" class="swal2-input profile-swal-input" type="password" placeholder="Nouveau mot de passe" />
          <input id="sw-confirm-password" class="swal2-input profile-swal-input" type="password" placeholder="Confirmer le nouveau mot de passe" />
        </div>
      `,
      preConfirm: () => {
        const currentPassword = (document.getElementById('sw-current-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const newPassword = (document.getElementById('sw-new-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const confirmPassword = (document.getElementById('sw-confirm-password') as HTMLInputElement | null)?.value?.trim() ?? '';

        if (!currentPassword || !newPassword || !confirmPassword) {
          Swal.showValidationMessage('Veuillez remplir tous les champs.');
          return null;
        }
        if (newPassword.length < 8) {
          Swal.showValidationMessage('Le nouveau mot de passe doit contenir au moins 8 caracteres.');
          return null;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage('La confirmation du mot de passe est invalide.');
          return null;
        }
        return { currentPassword, newPassword };
      }
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.isChangingPassword.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    try {
      await firstValueFrom(this.authService.changePassword(result.value));
      await Swal.fire({
        icon: 'success',
        title: 'Mot de passe modifie',
        text: 'Votre mot de passe a ete mis a jour avec succes.',
        background: 'var(--surface-1)',
        color: 'var(--text-color)',
        customClass: {
          popup: 'profile-swal-popup',
          confirmButton: 'profile-swal-confirm',
        },
        buttonsStyling: false,
        confirmButtonText: 'OK',
      });
      this.actionSuccess.set('Mot de passe modifie avec succes.');
    } catch (error) {
      const apiError = error as HttpErrorResponse;
      const message = extractApiErrorMessage(apiError, 'Changement de mot de passe impossible.');
      this.actionError.set(message);
      await Swal.fire({
        icon: 'error',
        title: 'Echec',
        text: message,
        background: 'var(--surface-1)',
        color: 'var(--text-color)',
        customClass: {
          popup: 'profile-swal-popup',
          confirmButton: 'profile-swal-confirm',
        },
        buttonsStyling: false,
        confirmButtonText: 'Fermer',
      });
    } finally {
      this.isChangingPassword.set(false);
    }
  }

  showCityField(): boolean {
    return this.isTunisiaNationality(this.profileForm.controls.nationality.value);
  }
}
