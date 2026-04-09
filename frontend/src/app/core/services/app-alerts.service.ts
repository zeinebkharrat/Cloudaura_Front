import { Injectable } from '@angular/core';
import Swal, { SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

/**
 * Unified modal alerts (same visual language as event management): dark panel, brand confirm color.
 * Use for validation, success, errors, and confirmations across transport, accommodation, and admin flows.
 */
@Injectable({ providedIn: 'root' })
export class AppAlertsService {
  private readonly mixin = Swal.mixin({
    customClass: {
      popup: 'yalla-swal-popup',
      confirmButton: 'yalla-swal-confirm',
      cancelButton: 'yalla-swal-cancel',
      title: 'yalla-swal-title',
    },
    buttonsStyling: true,
    confirmButtonColor: '#f12545',
    cancelButtonColor: '#374151',
    background: '#111827',
    color: '#e5e7eb',
    backdrop: `rgba(0,0,0,0.72)`,
  });

  success(title: string, text?: string): Promise<SweetAlertResult> {
    return this.mixin.fire({ icon: 'success', title, text });
  }

  error(title: string, text?: string): Promise<SweetAlertResult> {
    return this.mixin.fire({ icon: 'error', title, text });
  }

  warning(title: string, text?: string): Promise<SweetAlertResult> {
    return this.mixin.fire({ icon: 'warning', title, text });
  }

  info(title: string, text?: string): Promise<SweetAlertResult> {
    return this.mixin.fire({ icon: 'info', title, text });
  }

  /** Destructive / OK choice — returns isConfirmed */
  confirm(options: {
    title: string;
    text?: string;
    html?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: SweetAlertOptions['icon'];
  }): Promise<SweetAlertResult> {
    const base: SweetAlertOptions = {
      icon: options.icon ?? 'warning',
      title: options.title,
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Yes',
      cancelButtonText: options.cancelText ?? 'Cancel',
    };
    if (options.html) {
      base.html = options.html;
    } else {
      base.text = options.text;
    }
    return this.mixin.fire(base);
  }

  /** Fire fully custom options (still uses mixin styling). */
  fire(opts: SweetAlertOptions): Promise<SweetAlertResult> {
    return this.mixin.fire(opts);
  }
}
