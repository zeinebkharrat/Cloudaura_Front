import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppAlertsService } from '../../../core/services/app-alerts.service';

@Component({
  selector: 'app-transport-payment-cancel',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="payment-page">
      <section class="state-card animate-in">
        <p class="kicker">Paiement annule</p>
        <h1>YallaTN<span class="accent">+</span> · transport</h1>
        <div class="icon-wrap"><i class="pi pi-times-circle"></i></div>
        <p class="lead">You cancelled the PayPal payment.</p>
        <button type="button" class="btn-pay" (click)="goBackNow()">Back to transport search</button>
      </section>
    </main>
  `,
  styles: [
    `
      .payment-page {
        max-width: 560px;
        margin: 0 auto;
        padding: 88px 20px 48px;
      }
      .state-card {
        text-align: center;
        padding: 28px 24px;
        border-radius: 24px;
        background: var(--glass-bg, rgba(255,255,255,0.08));
        border: 1px solid var(--glass-border, rgba(255,255,255,0.14));
        color: var(--text-color);
      }
      .kicker {
        margin: 0 0 8px;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      h1 { margin: 0 0 14px; font-size: 1.45rem; }
      .accent { color: var(--tunisia-red); }
      .icon-wrap i { font-size: 2.3rem; color: #f87171; }
      .lead { color: var(--text-muted); margin: 12px 0 16px; }
      .btn-pay {
        border: none;
        border-radius: 14px;
        padding: 13px 16px;
        background: linear-gradient(135deg, #ff4b4b, var(--tunisia-red));
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      .animate-in { animation: fadeIn .3s ease both; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
    `,
  ],
})
export class TransportPaymentCancelComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly alerts = inject(AppAlertsService);
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.alerts.warning('PayPal', 'You cancelled the PayPal payment.');
    this.redirectTimer = setTimeout(() => {
      void this.router.navigate(['/transport']);
    }, 3500);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  goBackNow(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
    void this.router.navigate(['/transport']);
  }
}
