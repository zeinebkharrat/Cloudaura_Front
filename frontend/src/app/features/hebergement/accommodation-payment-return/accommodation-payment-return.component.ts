import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Reservation } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="apr">
      <p>Finalizing payment…</p>
    </div>
  `,
  styles: [
    `
      .apr {
        min-height: 40vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color, #e5e7eb);
      }
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
