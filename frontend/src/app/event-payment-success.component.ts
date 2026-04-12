import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EventService } from './event.service';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';

@Component({
  standalone: true,
  selector: 'app-event-payment-success',
  imports: [CommonModule, RouterLink],
  template: `
    <main class="payment-page">
      <div class="payment-inner animate-in">
        <header class="payment-head">
          <p class="kicker">Paiement securise</p>
          <h1 class="title">YallaTN<span class="accent">+</span> · <span class="sub">events</span></h1>
        </header>

      <div class="state-card" *ngIf="status === 'loading'">
        <p class="lead">Confirming your payment...</p>
      </div>

      <div class="state-card ok" *ngIf="status === 'ok'">
        <div class="success-icon-wrap"><i class="pi pi-check-circle success-icon"></i></div>
        <h2>Paiement confirme</h2>
        <p>Votre reservation d'evenement est validee.</p>
        <p *ngIf="reservationId != null" class="ref">Reservation #{{ reservationId }}</p>
        <a routerLink="/evenements" class="btn-pay">Retour aux evenements</a>
      </div>

      <div class="state-card err" *ngIf="status === 'error'">
        <h2>Echec de confirmation</h2>
        <p>{{ message }}</p>
        <a routerLink="/evenements" class="btn-pay">Retour aux evenements</a>
      </div>

      <footer class="payment-foot">
        <span class="security"><i class="pi pi-lock"></i> Confirmation securisee</span>
      </footer>
      </div>
    </main>
  `,
  styles: [
    `
      .payment-page {
        max-width: 560px;
        margin: 0 auto;
        padding: 88px 20px 48px;
      }
      .payment-inner {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .payment-head { text-align: center; }
      .kicker {
        margin: 0 0 8px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .title {
        margin: 0;
        font-size: clamp(1.25rem, 3vw, 1.7rem);
        font-weight: 800;
      }
      .accent { color: var(--tunisia-red); }
      .sub { font-size: 0.85em; color: var(--text-muted); font-weight: 600; }
      .state-card {
        padding: 28px 26px 30px;
        border-radius: 24px;
        background: var(--glass-bg, rgba(255,255,255,0.08));
        border: 1px solid var(--glass-border, rgba(255,255,255,0.15));
        text-align: center;
      }
      .lead {
        margin: 0;
        color: var(--text-muted);
      }
      .ok h2 {
        margin: 0 0 8px;
        color: #22c55e;
      }
      .err h2 { margin: 0 0 8px; color: #f87171; }
      .success-icon-wrap {
        width: 76px;
        height: 76px;
        background: rgba(34, 197, 94, 0.12);
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }
      .success-icon { font-size: 2.5rem; color: #22c55e; }
      .ref {
        font-weight: 600;
        color: var(--text-color);
      }
      .btn-pay {
        display: inline-block;
        margin-top: 1.25rem;
        padding: 13px 16px;
        border-radius: 14px;
        background: linear-gradient(135deg, #ff4b4b, var(--tunisia-red));
        color: #fff;
        text-decoration: none;
        font-weight: 700;
      }
      .payment-foot { text-align: center; color: var(--text-muted); font-size: 0.78rem; }
      .security { display: inline-flex; align-items: center; gap: 6px; }
      .animate-in { animation: fadeIn .35s ease both; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
      @media (max-width: 640px) {
        .state-card { padding: 22px 18px; }
      }
    `,
  ],
})
export class EventPaymentSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly auth = inject(AuthService);

  status: 'loading' | 'ok' | 'error' = 'loading';
  message = '';
  reservationId: number | null = null;

  ngOnInit(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      this.status = 'error';
      this.message = 'Missing payment session. Please return to events and try booking again.';
      return;
    }
    if (!this.auth.token()) {
      this.status = 'error';
      this.message =
        'Sign in with the same account you used to book, then use the return link from Stripe or book again.';
      return;
    }
    this.eventService.finalizeCheckout(sessionId).subscribe({
      next: (res) => {
        this.status = 'ok';
        this.reservationId = res.eventReservationId ?? null;
      },
      error: (err: HttpErrorResponse) => {
        this.status = 'error';
        this.message = extractApiErrorMessage(err, 'Could not confirm payment.');
      },
    });
  }
}
