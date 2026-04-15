import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LoginRequiredPromptService {
  private readonly auth = inject(AuthService);

  readonly open = signal(false);
  readonly title = signal('Sign in required');
  readonly message = signal('Please sign in to continue.');
  readonly returnUrl = signal<string>('/');

  show(options?: { title?: string; message?: string; returnUrl?: string }): void {
    if (this.auth.isAuthenticated()) {
      this.open.set(false);
      return;
    }

    this.title.set(options?.title ?? 'Sign in required');
    this.message.set(options?.message ?? 'Please sign in to continue.');
    this.returnUrl.set(options?.returnUrl ?? '/');
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }
}
