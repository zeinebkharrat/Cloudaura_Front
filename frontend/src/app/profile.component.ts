import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';
import { CityOption } from './core/auth.types';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
    phone: ['', [Validators.pattern(/^$|^(\+216)?[0-9]{8}$/)]],
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
        this.actionError.set('Could not load your profile.');
      },
    });

    this.profileForm.controls.nationality.valueChanges.subscribe((nationality) => {
      if (!this.isTunisiaNationality(nationality)) {
        this.profileForm.controls.cityId.setValue(null);
        this.profileForm.controls.cityId.setErrors(null);
      }
    });
  }

  controlInvalid(controlName: 'firstName' | 'lastName' | 'email' | 'phone' | 'cityId'): boolean {
    const control = this.profileForm.controls[controlName];
    return control.invalid && control.touched;
  }

  phoneErrorMessage(): string {
    return 'Format: 8 chiffres ou +216 suivi de 8 chiffres (WhatsApp).';
  }

  private normalizePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed;
  }

  cityErrorVisible(): boolean {
    const cityControl = this.profileForm.controls.cityId;
    return this.showCityField() && cityControl.touched && (cityControl.value == null || Number.isNaN(Number(cityControl.value)));
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
        this.actionError.set(extractApiErrorMessage(error, 'Image upload failed.'));
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
      this.profileForm.controls.cityId.setErrors({ required: true });
      this.profileForm.controls.cityId.markAsTouched();
      this.actionError.set('Please select a city if you choose Tunisia.');
      this.isSavingProfile.set(false);
      return;
    }

    this.authService
      .updateProfile({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: this.normalizePhone(payload.phone),
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
          this.actionSuccess.set('Profile updated successfully.');
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
      title: 'Change password',
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
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      html: `
        <div class="profile-swal-form">
          <p class="profile-swal-note">Use a strong, unique password.</p>
          <input id="sw-current-password" class="swal2-input profile-swal-input" type="password" placeholder="Current password" />
          <input id="sw-new-password" class="swal2-input profile-swal-input" type="password" placeholder="New password" />
          <input id="sw-confirm-password" class="swal2-input profile-swal-input" type="password" placeholder="Confirm new password" />
        </div>
      `,
      preConfirm: () => {
        const currentPassword = (document.getElementById('sw-current-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const newPassword = (document.getElementById('sw-new-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const confirmPassword = (document.getElementById('sw-confirm-password') as HTMLInputElement | null)?.value?.trim() ?? '';

        if (!currentPassword || !newPassword || !confirmPassword) {
          Swal.showValidationMessage('Please fill in all fields.');
          return null;
        }
        if (newPassword.length < 8) {
          Swal.showValidationMessage('The new password must be at least 8 characters.');
          return null;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage('Password confirmation does not match.');
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
        title: 'Password updated',
        text: 'Your password has been updated successfully.',
        background: 'var(--surface-1)',
        color: 'var(--text-color)',
        customClass: {
          popup: 'profile-swal-popup',
          confirmButton: 'profile-swal-confirm',
        },
        buttonsStyling: false,
        confirmButtonText: 'OK',
      });
      this.actionSuccess.set('Password updated successfully.');
    } catch (error) {
      const apiError = error as HttpErrorResponse;
      const message = extractApiErrorMessage(apiError, 'Could not change password.');
      this.actionError.set(message);
      await Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: message,
        background: 'var(--surface-1)',
        color: 'var(--text-color)',
        customClass: {
          popup: 'profile-swal-popup',
          confirmButton: 'profile-swal-confirm',
        },
        buttonsStyling: false,
        confirmButtonText: 'Close',
      });
    } finally {
      this.isChangingPassword.set(false);
    }
  }

  showCityField(): boolean {
    return this.isTunisiaNationality(this.profileForm.controls.nationality.value);
  }
}
