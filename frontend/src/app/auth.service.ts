import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, tap } from 'rxjs';
import { AuthResponse, SignInPayload, SignUpPayload, UserProfile } from './auth.types';

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(null);
  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = signal(false);

  signin(payload: SignInPayload) {
    return this.http.post<AuthResponse>('/api/auth/signin', payload).pipe(
      tap((response) => this.storeSession(response)),
      map((response) => response.user)
    );
  }

  signup(payload: SignUpPayload) {
    return this.http.post<AuthResponse>('/api/auth/signup', payload).pipe(
      tap((response) => this.storeSession(response)),
      map((response) => response.user)
    );
  }

  fetchMe() {
    return this.http.get<UserProfile>('/api/auth/me').pipe(
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
