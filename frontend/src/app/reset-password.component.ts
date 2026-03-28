import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (!password || !confirmPassword) {
    return null;
  }
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  controlInvalid(controlName: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  passwordMismatchVisible(): boolean {
    return this.form.hasError('passwordMismatch') && this.form.controls.confirmPassword.touched;
  }

  newPasswordErrorMessage(): string {
    if (this.form.controls.newPassword.hasError('required')) {
      return 'Le nouveau mot de passe est obligatoire.';
    }
    return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.formError.set('Token de reinitialisation manquant ou invalide.');
      return;
    }

    const raw = this.form.getRawValue();

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.resetPassword({ token, newPassword: raw.newPassword }).subscribe({
      next: (response) => {
        this.formSuccess.set(response.message);
        setTimeout(() => this.router.navigateByUrl('/signin'), 1200);
      },
      error: (error: HttpErrorResponse) => {
        this.formError.set(extractApiErrorMessage(error, 'Reinitialisation impossible.'));
      },
      complete: () => this.isLoading.set(false),
    });
  }
}
