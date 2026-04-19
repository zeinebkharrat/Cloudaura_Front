import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';
import { PersonalizationService, PreferenceSurveyPayload } from './core/personalization.service';
import Swal from 'sweetalert2';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css', './auth-pages.shared.css'],
})
export class SignInComponent implements OnInit {
    @Input() embedded = false;
    @Input() returnUrlOverride: string | null = null;
    @Output() switchMode = new EventEmitter<'signup'>();
    @Output() authenticated = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly personalizationService = inject(PersonalizationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

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
      return this.translate.instant('AUTH_SIGNIN.ERR_PASSWORD_REQUIRED');
    }
    return this.translate.instant('AUTH_SIGNIN.ERR_PASSWORD_INVALID');
  }

  ngOnInit() {
    this.authService.getSocialProviders().subscribe({
      next: (providers) => this.socialProviders.set(providers),
      error: () => this.socialProviders.set({ google: false, github: false, facebook: false, instagram: false }),
    });

    const token = this.route.snapshot.queryParamMap.get('token');
    const socialError = this.route.snapshot.queryParamMap.get('error');
    const returnUrl = this.getReturnUrl();

    if (socialError) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_SOCIAL_FAILED'));
      return;
    }

    if (!token) {
      return;
    }

    this.isLoading.set(true);
    this.authService.completeSocialSignin(token).subscribe({
      next: async () => {
        await this.showFirstSigninWelcomeIfNeeded();
        this.finishAuthFlow(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(extractApiErrorMessage(error, this.translate.instant('AUTH_SIGNIN.MSG_SOCIAL_TOKEN_INVALID')));
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
      next: async () => {
        await this.showFirstSigninWelcomeIfNeeded();
        const returnUrl = this.getReturnUrl();
        this.finishAuthFlow(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (error.status === 403) {
          const fromApi = extractApiErrorMessage(error, '');
          this.formError.set(
            fromApi && fromApi.trim().length > 0
              ? fromApi
              : this.translate.instant('AUTH_SIGNIN.MSG_VERIFY_REMINDER')
          );
          return;
        }
        this.formError.set(extractApiErrorMessage(error, this.translate.instant('AUTH_SIGNIN.MSG_SIGNIN_FAILED')));
      },
      complete: () => this.isLoading.set(false),
    });
  }

  private getReturnUrl(): string {
    return this.returnUrlOverride || this.route.snapshot.queryParamMap.get('returnUrl') || '/';
  }

  private finishAuthFlow(returnUrl: string): void {
    if (this.embedded) {
      this.authenticated.emit();
      return;
    }
    if (this.authService.hasRole('ROLE_ADMIN')) {
      this.router.navigateByUrl('/admin/dashboard');
      return;
    }
    this.router.navigateByUrl(returnUrl);
  }

  private async showFirstSigninWelcomeIfNeeded() {
    const user = this.authService.currentUser();
    if (!user) {
      return;
    }

    const key = `signin-first-welcome-shown-${user.id}`;
    if (localStorage.getItem(key) === '1') {
      return;
    }

    const alreadyCompletedOnServer = await firstValueFrom(
      this.personalizationService.getStatus().pipe(
        // If status endpoint fails, keep the onboarding popup available.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catchError((_error) => of(false))
      )
    );

    if (alreadyCompletedOnServer) {
      localStorage.setItem(key, '1');
      return;
    }

    const payload = await this.runGuideQuestionnaire(user.firstName || user.username || user.username);
    if (!payload) {
      return;
    }

    await firstValueFrom(this.personalizationService.savePreferences(payload));

    await Swal.fire({
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      width: 760,
      customClass: {
        popup: 'signin-wizard-popup',
        confirmButton: 'signin-wizard-confirm',
      },
      buttonsStyling: false,
      confirmButtonText: 'Enter Home',
      html: `
        <div class="signin-wizard-shell">
          <img src="assets/guide_welcome.png" alt="YallaTN+ guide" class="signin-wizard-guide" />
          <h3>Welcome to YallaTN+, ${user.firstName || user.username}!</h3>
          <p class="signin-wizard-sub">Your personalized world is ready. Let us explore Tunisia together.</p>
        </div>
      `,
    });

    localStorage.setItem(key, '1');
  }

  private async runGuideQuestionnaire(displayName: string): Promise<PreferenceSurveyPayload | null> {
    const intro = await Swal.fire({
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      width: 760,
      customClass: {
        popup: 'signin-wizard-popup',
        confirmButton: 'signin-wizard-confirm',
        cancelButton: 'signin-wizard-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      cancelButtonText: 'Skip',
      confirmButtonText: 'Suivant',
      html: `
        <div class="signin-wizard-shell">
          <img src="assets/guide_welcome.png" alt="YallaTN+ guide" class="signin-wizard-guide" />
          <h3>Hello ${displayName}, I have some questions for you.</h3>
          <p class="signin-wizard-sub">This takes less than one minute and unlocks futuristic personalized recommendations.</p>
        </div>
      `,
    });

    if (!intro.isConfirmed) {
      return null;
    }

    const interestsStep = await Swal.fire({
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      width: 860,
      customClass: {
        popup: 'signin-wizard-popup',
        confirmButton: 'signin-wizard-confirm',
        cancelButton: 'signin-wizard-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Suivant',
      html: `
        <div class="signin-wizard-shell">
          <h3>What vibes do you want?</h3>
          <p class="signin-wizard-sub">Pick at least one style.</p>
          <div id="wizard-interests" class="signin-wizard-card-grid signin-wizard-card-grid--interest">
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="beaches" checked><img src="assets/sidi_bou.png" alt="Beaches"><span>Beaches</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="nightlife"><img src="assets/el_jem.png" alt="Nightlife"><span>Nightlife</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="culture"><img src="assets/el_jem.png" alt="Culture"><span>Culture</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="adventure"><img src="assets/sahara.png" alt="Adventure"><span>Adventure</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="nature"><img src="assets/sahara.png" alt="Nature"><span>Nature</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="food"><img src="assets/banner.png" alt="Food"><span>Food</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="family"><img src="assets/banner.png" alt="Family"><span>Family</span></label>
            <label class="wizard-card wizard-card--interest"><input type="checkbox" value="relaxation"><img src="assets/sidi_bou.png" alt="Relaxation"><span>Relaxation</span></label>
          </div>
        </div>
      `,
      preConfirm: () => {
        const interests = Array.from(document.querySelectorAll<HTMLInputElement>('#wizard-interests input[type="checkbox"]:checked'))
          .map((el) => el.value);
        if (!interests.length) {
          Swal.showValidationMessage('Select at least one interest.');
          return null;
        }
        return interests;
      },
    });

    if (!interestsStep.isConfirmed || !interestsStep.value) {
      return null;
    }

    const profileStep = await Swal.fire({
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      width: 820,
      customClass: {
        popup: 'signin-wizard-popup',
        confirmButton: 'signin-wizard-confirm',
        cancelButton: 'signin-wizard-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Suivant',
      html: `
        <div class="signin-wizard-shell">
          <h3>Travel profile</h3>
          <p class="signin-wizard-sub">Tell us your route style.</p>
          <div class="signin-wizard-form-grid">
            <label>Preferred region<select id="wiz-region" class="signin-wizard-select"><option value="">Any</option><option value="north">North</option><option value="sahel">Sahel</option><option value="south">South</option><option value="coastal">Coastal</option><option value="desert">Desert</option></select></label>
            <label>Traveling with<select id="wiz-with" class="signin-wizard-select"><option value="solo">Solo</option><option value="couple">Couple</option><option value="friends">Friends</option><option value="family">Family</option></select></label>
            <label>Budget<select id="wiz-budget" class="signin-wizard-select"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="premium">Premium</option></select></label>
            <label>Stay<select id="wiz-stay" class="signin-wizard-select"><option value="hotel">Hotel</option><option value="resort">Resort</option><option value="guesthouse">Guesthouse</option><option value="hostel">Hostel</option></select></label>
          </div>
        </div>
      `,
      preConfirm: () => {
        const get = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? '';
        return {
          preferredRegion: get('wiz-region'),
          travelWith: get('wiz-with'),
          budgetLevel: get('wiz-budget'),
          accommodationType: get('wiz-stay'),
        };
      },
    });

    if (!profileStep.isConfirmed || !profileStep.value) {
      return null;
    }

    const mobilityStep = await Swal.fire({
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      width: 820,
      customClass: {
        popup: 'signin-wizard-popup',
        confirmButton: 'signin-wizard-confirm',
        cancelButton: 'signin-wizard-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Finish',
      html: `
        <div class="signin-wizard-shell">
          <h3>Mobility and cuisine</h3>
          <p class="signin-wizard-sub">Final step.</p>
          <div class="signin-wizard-card-grid">
            <label class="wizard-card wizard-card--compact"><span class="wizard-icon">🚗</span><span>Transport</span><select id="wiz-transport" class="signin-wizard-select"><option value="car">Car</option><option value="train">Train</option><option value="taxi">Taxi</option><option value="bus">Bus</option></select></label>
            <label class="wizard-card wizard-card--compact"><span class="wizard-icon">🍽️</span><span>Cuisine</span><select id="wiz-cuisine" class="signin-wizard-select"><option value="tunisian">Tunisian</option><option value="mediterranean">Mediterranean</option><option value="seafood">Seafood</option><option value="street food">Street food</option></select></label>
          </div>
        </div>
      `,
      preConfirm: () => {
        const get = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? '';
        return {
          transportPreference: get('wiz-transport'),
          preferredCuisine: get('wiz-cuisine'),
        };
      },
    });

    if (!mobilityStep.isConfirmed || !mobilityStep.value) {
      return null;
    }

    return {
      interests: interestsStep.value,
      preferredRegion: profileStep.value.preferredRegion,
      travelWith: profileStep.value.travelWith,
      budgetLevel: profileStep.value.budgetLevel,
      accommodationType: profileStep.value.accommodationType,
      transportPreference: mobilityStep.value.transportPreference,
      preferredCuisine: mobilityStep.value.preferredCuisine,
    };
  }

  resendVerificationEmail() {
    const identifier = this.form.controls.identifier.value.trim();
    if (!identifier) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_RESEND_NEED_IDENTIFIER'));
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
        this.formError.set(extractApiErrorMessage(error, this.translate.instant('AUTH_SIGNIN.MSG_RESEND_FAILED')));
      },
      complete: () => this.isResendingVerification.set(false),
    });
  }

  loginWithGoogle() {
    if (!this.socialProviders().google) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_GOOGLE_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('google');
  }

  loginWithFacebook() {
    if (!this.socialProviders().facebook) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_FACEBOOK_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('facebook');
  }

  loginWithInstagram() {
    if (!this.socialProviders().instagram) {
      this.formError.set(this.translate.instant('AUTH_SIGNIN.MSG_INSTAGRAM_NOT_CONFIGURED'));
      return;
    }
    this.authService.startSocialLogin('instagram');
  }
}
