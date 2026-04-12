import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../../core/auth.service';
import { extractApiErrorMessage } from '../../api-error.util';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-profile.component.html',
  styleUrl: './admin-profile.component.css',
})
export class AdminProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly user = this.auth.currentUser;
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(/^$|^(\+216)?[0-9]{8}$/)]],
    profileImageUrl: [''],
  });

  constructor() {
    this.auth.getProfile().subscribe({
      next: (profile) => {
        this.form.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone ?? '',
          profileImageUrl: profile.profileImageUrl ?? '',
        });
      },
      error: () => {
        this.error.set('Unable to load admin profile.');
      },
    });
  }

  controlInvalid(name: 'firstName' | 'lastName' | 'email' | 'phone') {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  uploadAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.uploading()) {
      return;
    }

    this.uploading.set(true);
    this.error.set(null);

    this.auth.uploadProfileImage(file).subscribe({
      next: (res) => {
        this.form.patchValue({ profileImageUrl: res.url });
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(extractApiErrorMessage(err, 'Avatar upload failed.'));
      },
      complete: () => this.uploading.set(false),
    });
  }

  save() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);

    const data = this.form.getRawValue();
    this.auth
      .updateProfile({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim() || null,
        nationality: this.user()?.nationality ?? null,
        cityId: this.user()?.cityId ?? null,
        profileImageUrl: data.profileImageUrl || null,
      })
      .subscribe({
        next: () => this.message.set('Admin profile updated successfully.'),
        error: (err: HttpErrorResponse) => {
          this.error.set(extractApiErrorMessage(err, 'Could not update admin profile.'));
        },
        complete: () => this.saving.set(false),
      });
  }

  async changePassword() {
    const result = await Swal.fire({
      title: 'Change admin password',
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      customClass: {
        popup: 'password-popup-modern',
        confirmButton: 'password-popup-confirm',
        cancelButton: 'password-popup-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      confirmButtonText: 'Update password',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      html: `
        <div class="password-popup-wrap">
          <label for="admin-current-password">Current password</label>
          <input id="admin-current-password" class="swal2-input" type="password" autocomplete="current-password" />
          <label for="admin-new-password">New password</label>
          <input id="admin-new-password" class="swal2-input" type="password" autocomplete="new-password" />
        </div>
      `,
      preConfirm: async () => {
        const currentPassword = (document.getElementById('admin-current-password') as HTMLInputElement | null)?.value ?? '';
        const newPassword = (document.getElementById('admin-new-password') as HTMLInputElement | null)?.value ?? '';

        if (!currentPassword || !newPassword) {
          Swal.showValidationMessage('Please fill both password fields.');
          return;
        }

        if (newPassword.length < 8) {
          Swal.showValidationMessage('New password must have at least 8 characters.');
          return;
        }

        await firstValueFrom(this.auth.changePassword({ currentPassword, newPassword }));
        return true;
      },
    });

    if (result.isConfirmed) {
      this.message.set('Admin password updated successfully.');
      this.error.set(null);
    }
  }
}
