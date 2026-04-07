import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppAlertsService } from '../../../core/services/app-alerts.service';

@Component({
  selector: 'app-transport-payment-cancel',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pc">
      <p>Returning to transport search…</p>
    </div>
  `,
  styles: [
    `
      .pc {
        min-height: 40vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color);
        font-size: 0.95rem;
      }
    `,
  ],
})
export class TransportPaymentCancelComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly alerts = inject(AppAlertsService);

  ngOnInit(): void {
    void this.alerts.warning('PayPal', 'You cancelled the PayPal payment.');
    void this.router.navigate(['/transport']);
  }
}
