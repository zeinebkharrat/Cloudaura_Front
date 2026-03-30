import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, tap } from 'rxjs';
import {
  AuthMessageResponse,
  AuthResponse,
  CityOption,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ProfileUpdatePayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  SignInPayload,
  SignUpPayload,
  SocialProviders,
  UserProfile,
} from './auth.types';

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

/** Browser redirect for OAuth2 must hit the backend directly; keep in sync with proxy.conf.json target port. */
const OAUTH_BACKEND_ORIGIN = 'http://localhost:9091';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  /** Relative `/api` so `ng serve` proxies every call (same origin as the Angular app). */
  private readonly apiBase = '/api';

  readonly token = signal<string | null>(null);
  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = signal(false);

  readonly isAdmin = computed(() => this.hasRole('ROLE_ADMIN'));
  readonly isArtisan = computed(() => {
    const user = this.currentUser();
    const hasRole = this.hasRole('ROLE_ARTISAN');
    const hasPendingRequest = user?.artisanRequestPending === true;
    return hasRole || hasPendingRequest;
  });

  signin(payload: SignInPayload) {
    return this.http.post<AuthResponse>(`${this.apiBase}/auth/signin`, payload).pipe(
      tap((response) => this.storeSession(response)),
      map((response) => response.user)
    );
  }

  hasStoredToken(): boolean {
    return !!localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  completeSocialSignin(token: string) {
    this.token.set(token);
    this.isAuthenticated.set(true);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    return this.fetchMe().pipe(map((user) => user));
  }

  startSocialLogin(provider: 'google' | 'github' | 'facebook' | 'instagram') {
    window.location.href = `${OAUTH_BACKEND_ORIGIN}/oauth2/authorization/${provider}`;
  }

  getSocialProviders() {
    return this.http.get<SocialProviders>(`${this.apiBase}/auth/social/providers`);
  }

  hasRole(role: string): boolean {
    const user = this.currentUser();
    return !!user && user.roles.includes(role);
  }

  signup(payload: SignUpPayload) {
    return this.http.post<AuthMessageResponse>(`${this.apiBase}/auth/signup`, payload);
  }

  verifyEmail(token: string) {
    return this.http.get<AuthMessageResponse>(`${this.apiBase}/auth/verify-email`, { params: { token } });
  }

  resendVerification(payload: ResendVerificationPayload) {
    return this.http.post<AuthMessageResponse>(`${this.apiBase}/auth/resend-verification`, payload);
  }

  forgotPassword(payload: ForgotPasswordPayload) {
    return this.http.post<AuthMessageResponse>(`${this.apiBase}/auth/forgot-password`, payload);
  }

  resetPassword(payload: ResetPasswordPayload) {
    return this.http.post<AuthMessageResponse>(`${this.apiBase}/auth/reset-password`, payload);
  }

  getProfile() {
    return this.http.get<UserProfile>(`${this.apiBase}/profile`).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      })
    );
  }

  updateProfile(payload: ProfileUpdatePayload) {
    return this.http.put<UserProfile>(`${this.apiBase}/profile`, payload).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      })
    );
  }

  changePassword(payload: ChangePasswordPayload) {
    return this.http.patch<void>(`${this.apiBase}/profile/password`, payload);
  }

  uploadProfileImage(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiBase}/public/uploads/profile-image`, body);
  }

  getCities() {
    return this.http.get<Array<CityOption & { cityId?: number; id?: number }>>(`${this.apiBase}/cities`).pipe(
      map((cities) => {
        const normalized: CityOption[] = [];
        for (const city of cities) {
          const resolvedId = city.id ?? city.cityId;
          if (resolvedId == null) {
            continue;
          }
          normalized.push({
            id: Number(resolvedId),
            cityId: city.cityId ?? Number(resolvedId),
            name: city.name,
            region: city.region,
          });
        }
        return normalized;
      })
    );
  }

  getNationalities() {
    return this.http
      .get<Array<{ name?: { common?: string } }>>('https://restcountries.com/v3.1/all?fields=name')
      .pipe(
        map((countries) => {
          const values = countries
            .map((item) => item.name?.common?.trim() ?? '')
            .filter((name) => !!name);

          return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
        }),
        catchError(() => of([] as string[]))
      );
  }

  fetchMe() {
    return this.http.get<UserProfile>(`${this.apiBase}/auth/me`).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      })
    );
  }

  restoreSession() {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (!savedToken) {
      this.clearSessionState();
      return;
    }

    this.token.set(savedToken);
    this.isAuthenticated.set(true);

    if (savedUser) {
      this.currentUser.set(JSON.parse(savedUser) as UserProfile);
    }

    this.fetchMe()
      .pipe(
        catchError(() => {
          this.logout();
          return of(null);
        })
      )
      .subscribe();
  }

  logout() {
    this.clearSessionState();
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  private storeSession(response: AuthResponse) {
    this.token.set(response.token);
    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
  }

  private clearSessionState() {
    this.token.set(null);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }
}
