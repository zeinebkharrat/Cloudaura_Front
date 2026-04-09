import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';

@Component({
  selector: 'app-transport-payment-return',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pr">
      <p>Finalizing payment…</p>
    </div>
  `,
  styles: [
    `
      .pr {
        min-height: 40vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color);
      }
    `,
  ],
})
export class TransportPaymentReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
  private readonly alerts = inject(AppAlertsService);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const sessionId = qp.get('session_id');
    const localSim =
      qp.get('local') === 'true' || qp.get('session') === 'local';
    const reservationId = qp.get('reservationId');
    const transportId = qp.get('transportId');
    const method = qp.get('method');
    const payPalToken = qp.get('token');

    if (localSim && reservationId && transportId) {
      void this.router.navigate(['/transport', transportId, 'book'], {
        queryParams: { paid: '1', reservationId },
      });
      return;
    }

    if (method === 'paypal' && payPalToken && reservationId) {
      const rid = parseInt(reservationId, 10);
      if (!Number.isFinite(rid)) {
        void this.alerts.error('PayPal', 'Invalid reservation reference.');
        void this.router.navigate(['/transport']);
        return;
      }
      this.dataSource.confirmTransportPayPalCapture(payPalToken, rid).subscribe({
        next: (payload) => {
          const tid =
            payload.transportId ?? (transportId != null ? Number(transportId) : undefined);
          if (tid != null && Number.isFinite(tid)) {
            void this.router.navigate(['/transport', String(tid), 'book'], {
              queryParams: { paid: '1', reservationId: payload.transportReservationId },
            });
          } else {
            void this.router.navigate(['/mes-reservations'], { queryParams: { tab: 'transport' } });
          }
        },
        error: (err: { error?: { status?: string; message?: string } }) => {
          if (err?.error?.status === 'FAILED') {
            void this.alerts.error('PayPal', 'PayPal payment failed.');
          } else {
            void this.alerts.error('PayPal', err.error?.message ?? 'PayPal payment failed.');
          }
          void this.router.navigate(['/transport']);
        },
      });
      return;
    }

    if (!sessionId) {
      void this.alerts.error('Payment', 'Payment session not found.');
      void this.router.navigate(['/transport']);
      return;
    }

    this.dataSource.confirmTransportStripeSession(sessionId).subscribe({
      next: (payload) => {
        const tid = payload.transportId ?? (transportId != null ? Number(transportId) : undefined);
        const rid = payload.transportReservationId ?? (reservationId != null ? Number(reservationId) : undefined);
        if (tid != null && Number.isFinite(tid)) {
          void this.router.navigate(['/transport', String(tid), 'book'], {
            queryParams: { paid: '1', reservationId: rid },
          });
        } else {
          void this.router.navigate(['/mes-reservations'], { queryParams: { tab: 'transport' } });
        }
      },
      error: (err: { error?: { message?: string } }) => {
        void this.alerts.error('Payment', err.error?.message ?? 'Could not confirm Stripe payment.');
        void this.router.navigate(['/transport']);
      },
    });
  }
}
