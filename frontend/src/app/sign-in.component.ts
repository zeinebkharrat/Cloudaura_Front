import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly isResendingVerification = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);
  readonly socialProviders = signal({ google: false, github: false, facebook: false, instagram: false });

  readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  controlInvalid(controlName: 'identifier' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  passwordErrorMessage(): string {
    const control = this.form.controls.password;
    if (control.hasError('required')) {
      return 'Le mot de passe est obligatoire.';
    }
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }

  ngOnInit() {
    this.authService.getSocialProviders().subscribe({
      next: (providers) => this.socialProviders.set(providers),
      error: () => this.socialProviders.set({ google: false, github: false, facebook: false, instagram: false }),
    });

    const token = this.route.snapshot.queryParamMap.get('token');
    const socialError = this.route.snapshot.queryParamMap.get('error');
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';

    if (socialError) {
      this.formError.set('Connexion sociale impossible. Reessayez avec un provider disponible.');
      return;
    }

    if (!token) {
      return;
    }

    this.isLoading.set(true);
    this.authService.completeSocialSignin(token).subscribe({
      next: () => {
        if (this.authService.hasRole('ROLE_ADMIN')) {
          this.router.navigateByUrl('/admin/dashboard');
          return;
        }
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(extractApiErrorMessage(error, 'Token social invalide. Merci de réessayer.'));
      },
      complete: () => this.isLoading.set(false),
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

    this.authService.signin(this.form.getRawValue()).subscribe({
      next: () => {
        if (this.authService.hasRole('ROLE_ADMIN')) {
          this.router.navigateByUrl('/admin/dashboard');
          return;
        }
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(extractApiErrorMessage(error, 'Connexion impossible. Vérifiez vos identifiants.'));
      },
      complete: () => this.isLoading.set(false),
    });
  }

  resendVerificationEmail() {
    const identifier = this.form.controls.identifier.value.trim();
    if (!identifier) {
      this.formError.set('Saisissez email ou username pour renvoyer le lien de verification.');
      return;
    }
    if (this.isResendingVerification()) {
      return;
    }

    this.isResendingVerification.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.authService.resendVerification({ identifier }).subscribe({
      next: (response) => this.formSuccess.set(response.message),
      error: (error: HttpErrorResponse) => {
        this.formError.set(extractApiErrorMessage(error, 'Impossible de renvoyer le lien de verification.'));
      },
      complete: () => this.isResendingVerification.set(false),
    });
  }

  loginWithGoogle() {
    if (!this.socialProviders().google) {
      this.formError.set('Google login non configuré côté serveur. Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('google');
  }

  loginWithGithub() {
    if (!this.socialProviders().github) {
      this.formError.set('GitHub login non configuré côté serveur. Ajoutez GITHUB_CLIENT_ID et GITHUB_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('github');
  }

  loginWithFacebook() {
    if (!this.socialProviders().facebook) {
      this.formError.set('Facebook login non configure cote serveur. Ajoutez FACEBOOK_CLIENT_ID et FACEBOOK_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('facebook');
  }

  loginWithInstagram() {
    if (!this.socialProviders().instagram) {
      this.formError.set('Instagram login non configure cote serveur. Ajoutez INSTAGRAM_CLIENT_ID et INSTAGRAM_CLIENT_SECRET.');
      return;
    }
    this.authService.startSocialLogin('instagram');
  }
}
