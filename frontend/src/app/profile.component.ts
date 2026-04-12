import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
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
export class ProfileComponent implements OnDestroy {
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
  readonly showCameraPanel = signal(false);
  readonly cameraBusy = signal(false);
  readonly cameraReady = signal(false);
  readonly cameraError = signal<string | null>(null);
  readonly coverUploadBusy = signal(false);
  readonly coverImageUrl = signal('/assets/banner.png');

  @ViewChild('cameraVideo') private cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') private cameraCanvasRef?: ElementRef<HTMLCanvasElement>;

  private mediaStream: MediaStream | null = null;

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(/^$|^(\+216)?[0-9]{8}$/)]],
    nationality: [''],
    cityId: [null as number | null],
    profileImageUrl: [''],
  });

  ngOnDestroy(): void {
    this.stopCameraStream();
  }

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
        const coverKey = this.coverStorageKey(user.id);
        const savedCover = localStorage.getItem(coverKey);
        if (savedCover) {
          this.coverImageUrl.set(savedCover);
        }

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

  uploadCoverImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.coverUploadBusy()) {
      return;
    }

    this.coverUploadBusy.set(true);
    this.actionError.set(null);

    this.authService.uploadProfileImage(file).subscribe({
      next: (response) => {
        this.coverImageUrl.set(response.url);
        const userId = this.currentUser()?.id;
        if (userId != null) {
          localStorage.setItem(this.coverStorageKey(userId), response.url);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Cover upload failed.'));
      },
      complete: () => this.coverUploadBusy.set(false),
    });
  }

  resetCoverPhoto() {
    this.coverImageUrl.set('/assets/banner.png');
    const userId = this.currentUser()?.id;
    if (userId != null) {
      localStorage.removeItem(this.coverStorageKey(userId));
    }
  }

  coverBackground(): string {
    return `linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.3)), url('${this.coverImageUrl()}')`;
  }

  private coverStorageKey(userId: number): string {
    return `profile-cover-${userId}`;
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
    } catch (error) {
      console.error(error);
      this.cameraError.set('Could not access the camera. Please allow permission and try again.');
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
    if (this.uploadBusy() || this.cameraBusy()) {
      return;
    }

    const videoElement = this.cameraVideoRef?.nativeElement;
    const canvasElement = this.cameraCanvasRef?.nativeElement;
    if (!videoElement || !canvasElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      this.cameraError.set('Camera preview is not ready yet.');
      return;
    }

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    const context = canvasElement.getContext('2d');
    if (!context) {
      this.cameraError.set('Could not capture photo. Please retry.');
      return;
    }

    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    this.uploadBusy.set(true);
    this.cameraError.set(null);

    canvasElement.toBlob(
      (blob) => {
        if (!blob) {
          this.uploadBusy.set(false);
          this.cameraError.set('Could not generate image from camera capture.');
          return;
        }

        const photoFile = new File([blob], `profile-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        this.authService.uploadProfileImage(photoFile).subscribe({
          next: (response) => {
            this.profileForm.patchValue({ profileImageUrl: response.url });
            this.actionSuccess.set('Profile photo updated from camera.');
            this.showCameraPanel.set(false);
            this.stopCameraStream();
          },
          error: (error: HttpErrorResponse) => {
            this.cameraError.set(extractApiErrorMessage(error, 'Camera upload failed.'));
          },
          complete: () => this.uploadBusy.set(false),
        });
      },
      'image/jpeg',
      0.92,
    );
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
        <div class="profile-swal-shell">
          <div class="profile-swal-hero">
            <span class="profile-swal-badge">Security</span>
            <h3>Refresh your password</h3>
            <p class="profile-swal-note">Use at least 8 characters with letters, numbers and symbols.</p>
          </div>
          <div class="profile-swal-form">
            <div class="profile-swal-input-wrap">
              <input id="sw-current-password" class="swal2-input profile-swal-input" type="password" placeholder="Current password" />
            </div>
            <div class="profile-swal-input-wrap">
              <input id="sw-new-password" class="swal2-input profile-swal-input" type="password" placeholder="New password" />
              <div class="profile-swal-meter"><span id="sw-password-meter-bar"></span></div>
              <small id="sw-password-meter-text" class="profile-swal-meter-text">Strength: -</small>
            </div>
            <div class="profile-swal-input-wrap">
              <input id="sw-confirm-password" class="swal2-input profile-swal-input" type="password" placeholder="Confirm new password" />
              <small id="sw-password-match-text" class="profile-swal-meter-text">Waiting for confirmation</small>
            </div>
          </div>
        </div>
      `,
      didOpen: () => {
        const newInput = document.getElementById('sw-new-password') as HTMLInputElement | null;
        const confirmInput = document.getElementById('sw-confirm-password') as HTMLInputElement | null;
        const meterBar = document.getElementById('sw-password-meter-bar') as HTMLSpanElement | null;
        const meterText = document.getElementById('sw-password-meter-text') as HTMLSpanElement | null;
        const matchText = document.getElementById('sw-password-match-text') as HTMLSpanElement | null;

        const updateStrength = () => {
          if (!newInput || !meterBar || !meterText) {
            return;
          }

          const value = newInput.value;
          let score = 0;
          if (value.length >= 8) score += 1;
          if (/[A-Z]/.test(value)) score += 1;
          if (/[0-9]/.test(value)) score += 1;
          if (/[^A-Za-z0-9]/.test(value)) score += 1;

          const widths = ['0%', '28%', '52%', '76%', '100%'];
          const labels = ['Very weak', 'Weak', 'Medium', 'Strong', 'Excellent'];
          const tones = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#16a34a'];

          meterBar.style.width = widths[score];
          meterBar.style.background = tones[score];
          meterText.textContent = `Strength: ${labels[score]}`;
        };

        const updateMatch = () => {
          if (!newInput || !confirmInput || !matchText) {
            return;
          }

          if (!confirmInput.value) {
            matchText.textContent = 'Waiting for confirmation';
            matchText.style.color = 'var(--text-muted)';
            return;
          }

          const matches = newInput.value === confirmInput.value;
          matchText.textContent = matches ? 'Passwords match' : 'Passwords do not match';
          matchText.style.color = matches ? '#10b981' : '#ef4444';
        };

        newInput?.addEventListener('input', () => {
          updateStrength();
          updateMatch();
        });
        confirmInput?.addEventListener('input', updateMatch);
      },
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
