import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Reservation } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="payment-page">
      <section class="state-card animate-in">
        <p class="kicker">Paiement securise</p>
        <h1>YallaTN<span class="accent">+</span> · hebergement</h1>
        <div class="spinner-wrap"><i class="pi pi-spin pi-spinner"></i></div>
        <p class="lead">Finalizing payment...</p>
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
      .spinner-wrap i { font-size: 2rem; color: var(--tunisia-red); }
      .lead { color: var(--text-muted); margin-top: 12px; }
      .animate-in { animation: fadeIn .3s ease both; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
    `,
  ],
})
export class AccommodationPaymentReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
  private readonly alerts = inject(AppAlertsService);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const sessionId = qp.get('session_id');
    const localSim = qp.get('local') === 'true';
    const reservationId = qp.get('reservationId');
    const accommodationId = qp.get('accommodationId');

    if (localSim && reservationId && accommodationId) {
      void this.router.navigate(['/hebergement', accommodationId, 'book'], {
        queryParams: { paid: '1', reservationId },
      });
      return;
    }

    if (!sessionId) {
      void this.alerts.error('Payment', 'Payment session not found.');
      void this.router.navigate(['/hebergement']);
      return;
    }

    this.dataSource.confirmAccommodationStripeSession(sessionId).subscribe({
      next: (payload: Reservation) => {
        const accId = payload.accommodationId;
        const rid = payload.id ?? (reservationId != null ? Number(reservationId) : undefined);
        if (accId != null && Number.isFinite(accId) && rid != null && Number.isFinite(rid)) {
          void this.router.navigate(['/hebergement', String(accId), 'book'], {
            queryParams: { paid: '1', reservationId: rid },
          });
        } else {
          void this.router.navigate(['/mes-reservations'], { queryParams: { tab: 'hebergement' } });
        }
      },
      error: (err: { error?: { message?: string } }) => {
        void this.alerts.error('Payment', err.error?.message ?? 'Could not confirm Stripe payment.');
        void this.router.navigate(['/hebergement']);
      },
    });
  }
}
