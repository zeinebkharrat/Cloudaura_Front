import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LoginRequiredPromptService {
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  readonly open = signal(false);
  readonly title = signal('');
  readonly message = signal('');
  readonly returnUrl = signal<string>('/');

  show(options?: { title?: string; message?: string; returnUrl?: string }): void {
    if (this.auth.isAuthenticated()) {
      this.open.set(false);
      return;
    }

    this.title.set(options?.title ?? this.translate.instant('LOGIN_REQUIRED.TITLE'));
    this.message.set(options?.message ?? this.translate.instant('LOGIN_REQUIRED.MESSAGE'));
    this.returnUrl.set(options?.returnUrl ?? '/');
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }
}
