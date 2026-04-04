import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly message = signal<string | null>(null);
  readonly type = signal<ToastType>('success');
  private timer: any = null;

  show(msg: string, type: ToastType = 'success', duration = 3500): void {
    if (this.timer) clearTimeout(this.timer);
    this.message.set(msg);
    this.type.set(type);
    this.timer = setTimeout(() => this.message.set(null), duration);
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.message.set(null);
  }
}
