import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageSelectorComponent } from './core/components/language-selector/language-selector.component';
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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, LanguageSelectorComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

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
        this.actionError.set(this.translate.instant('PROFILE.ERR_LOAD_PROFILE'));
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
    return this.translate.instant('PROFILE.PHONE_ERR_FORMAT');
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
        this.actionError.set(extractApiErrorMessage(error, this.translate.instant('PROFILE.ERR_UPLOAD_FALLBACK')));
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
      this.actionError.set(this.translate.instant('PROFILE.ERR_CITY_REQUIRED'));
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
          this.actionSuccess.set(this.translate.instant('PROFILE.SUCCESS_PROFILE'));
        },
        error: (error: HttpErrorResponse) => {
          this.actionError.set(extractApiErrorMessage(error, this.translate.instant('PROFILE.ERR_UPDATE_FALLBACK')));
        },
        complete: () => this.isSavingProfile.set(false),
      });
  }

  async openChangePasswordPopup() {
    if (this.isChangingPassword()) {
      return;
    }

    const result = await Swal.fire({
      title: this.translate.instant('PROFILE.SWAL_PW_TITLE'),
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
      confirmButtonText: this.translate.instant('PROFILE.SWAL_CONFIRM'),
      cancelButtonText: this.translate.instant('PROFILE.SWAL_CANCEL'),
      focusConfirm: false,
      html: `
        <div class="profile-swal-form">
          <p class="profile-swal-note">${this.translate.instant('PROFILE.SWAL_PW_NOTE')}</p>
          <input id="sw-current-password" class="swal2-input profile-swal-input" type="password" placeholder="${this.translate.instant('PROFILE.SWAL_PW_CURRENT_PH')}" />
          <input id="sw-new-password" class="swal2-input profile-swal-input" type="password" placeholder="${this.translate.instant('PROFILE.SWAL_PW_NEW_PH')}" />
          <input id="sw-confirm-password" class="swal2-input profile-swal-input" type="password" placeholder="${this.translate.instant('PROFILE.SWAL_PW_CONFIRM_PH')}" />
        </div>
      `,
      preConfirm: () => {
        const currentPassword = (document.getElementById('sw-current-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const newPassword = (document.getElementById('sw-new-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const confirmPassword = (document.getElementById('sw-confirm-password') as HTMLInputElement | null)?.value?.trim() ?? '';

        if (!currentPassword || !newPassword || !confirmPassword) {
          Swal.showValidationMessage(this.translate.instant('PROFILE.SWAL_FILL_ALL'));
          return null;
        }
        if (newPassword.length < 8) {
          Swal.showValidationMessage(this.translate.instant('PROFILE.SWAL_PW_MIN'));
          return null;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage(this.translate.instant('PROFILE.SWAL_PW_MISMATCH'));
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
        title: this.translate.instant('PROFILE.SWAL_PW_SUCCESS_TITLE'),
        text: this.translate.instant('PROFILE.SWAL_PW_SUCCESS_TEXT'),
        background: 'var(--surface-1)',
        color: 'var(--text-color)',
        customClass: {
          popup: 'profile-swal-popup',
          confirmButton: 'profile-swal-confirm',
        },
        buttonsStyling: false,
        confirmButtonText: this.translate.instant('PROFILE.SWAL_OK'),
      });
      this.actionSuccess.set(this.translate.instant('PROFILE.SUCCESS_PASSWORD'));
    } catch (error) {
      const apiError = error as HttpErrorResponse;
      const message = extractApiErrorMessage(apiError, this.translate.instant('PROFILE.ERR_CHANGE_PW_FALLBACK'));
      this.actionError.set(message);
      await Swal.fire({
        icon: 'error',
        title: this.translate.instant('PROFILE.SWAL_FAILED_TITLE'),
        text: message,
        background: 'var(--surface-1)',
        color: 'var(--text-color)',
        customClass: {
          popup: 'profile-swal-popup',
          confirmButton: 'profile-swal-confirm',
        },
        buttonsStyling: false,
        confirmButtonText: this.translate.instant('PROFILE.SWAL_CLOSE'),
      });
    } finally {
      this.isChangingPassword.set(false);
    }
  }

  showCityField(): boolean {
    return this.isTunisiaNationality(this.profileForm.controls.nationality.value);
  }
}
