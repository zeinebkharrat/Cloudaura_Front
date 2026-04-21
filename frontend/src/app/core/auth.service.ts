import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, tap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ChatE2eeService } from '../chat/chat-e2ee.service';
import { isBackendLoginRedirectError } from '../api-error.util';
import {
  AuthMessageResponse,
  AuthResponse,
  CityOption,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ProfileUpdatePayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  RevokeOtherSessionsResponse,
  SignInPayload,
  SignUpPayload,
  SocialProviders,
  UserDeviceSession,
  UserProfile,
  CaptchaConfig,
} from './auth.types';

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

/** Browser redirect for OAuth2 must hit the backend directly; keep in sync with proxy.conf.json target port. */
const OAUTH_BACKEND_ORIGIN = 'http://localhost:9091';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly e2ee = inject(ChatE2eeService);
  /** Relative `/api` so `ng serve` proxies every call (same origin as the Angular app). */
  private readonly apiBase = '/api';

  readonly token = signal<string | null>(null);
  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = signal(false);

  readonly isAdmin = computed(() => this.hasRole('ROLE_ADMIN'));
  readonly isArtisan = computed(() => this.hasRole('ROLE_ARTISAN'));

  signin(payload: SignInPayload) {
    return this.http.post<AuthResponse>(`${OAUTH_BACKEND_ORIGIN}${this.apiBase}/auth/signin`, payload).pipe(
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

  getCaptchaConfig() {
    return this.http.get<CaptchaConfig>(`${this.apiBase}/auth/captcha-config`).pipe(
      catchError(() =>
        of({
          enabled: false,
          siteKey: '',
          secretConfiguredButMissingSiteKey: false,
          version: 'v2',
          configUnavailable: true,
        } as CaptchaConfig)
      )
    );
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

  getDeviceSessions() {
    return this.http.get<UserDeviceSession[]>(`${this.apiBase}/profile/sessions`);
  }

  revokeDeviceSession(sessionId: string) {
    return this.http.delete<void>(`${this.apiBase}/profile/sessions/${encodeURIComponent(sessionId)}`);
  }

  revokeOtherDeviceSessions() {
    return this.http.delete<RevokeOtherSessionsResponse>(`${this.apiBase}/profile/sessions/revoke-others`);
  }

  uploadProfileImage(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiBase}/public/uploads/profile-image`, body);
  }

  getCities() {
    return this.http
      .get<
        | CityOption[]
        | { success?: boolean; data?: Array<{ cityId?: number; id?: number; name?: string; region?: string | null }> }
      >(`${this.apiBase}/cities`)
      .pipe(
        map((res) => {
          const raw = Array.isArray(res) ? res : res?.data;
          return Array.isArray(raw) ? raw : [];
        }),
        map((cities) => {
          const normalized: CityOption[] = [];
          for (const city of cities) {
            const resolvedId = city.id ?? city.cityId;
            if (resolvedId == null || city.name == null) {
              continue;
            }
            normalized.push({
              id: Number(resolvedId),
              cityId: city.cityId ?? Number(resolvedId),
              name: city.name,
              region: city.region ?? '',
            });
          }
          normalized.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
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

          const unique = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'fr'));
          const tun = unique.findIndex((n) => n.toLowerCase() === 'tunisia');
          if (tun > 0) {
            unique.splice(tun, 1);
            unique.unshift('Tunisia');
          }
          return unique;
        }),
        catchError(() => of([] as string[]))
      );
  }

  fetchMe() {
    return this.http.get<UserProfile>(`${this.apiBase}/auth/me`).pipe(
      tap((user) => {
        this.isAuthenticated.set(true);
        this.currentUser.set(user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        this.bootstrapE2eeForUser(user.id);
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
    this.isAuthenticated.set(false);

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
    this.bootstrapE2eeForUser(response.user.id);
  }

  private clearSessionState() {
    this.token.set(null);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private bootstrapE2eeForUser(userId: number): void {
    if (!Number.isFinite(userId)) {
      return;
    }

    this.e2ee.ensureKeyPairReady(userId).catch((err) => {
      const httpError = err as HttpErrorResponse;
      if (httpError?.status === 401 || isBackendLoginRedirectError(httpError)) {
        return;
      }
      console.error('Failed to bootstrap E2EE keys:', err);
    });
  }
}
