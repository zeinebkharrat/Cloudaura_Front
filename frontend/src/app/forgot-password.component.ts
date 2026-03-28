import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { extractApiErrorMessage } from './api-error.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  controlInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  emailErrorMessage(): string {
    if (this.form.controls.email.hasError('required')) {
      return 'L\'email est obligatoire.';
    }
    return 'Veuillez saisir un email valide.';
  }

  submit() {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.forgotPassword(this.form.getRawValue()).subscribe({
      next: (response) => this.formSuccess.set(response.message),
      error: (error: HttpErrorResponse) => {
        this.formError.set(extractApiErrorMessage(error, 'Impossible d envoyer le mail de reinitialisation.'));
      },
      complete: () => this.isLoading.set(false),
    });
  }
}
