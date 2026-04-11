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
    <main class="wrap">
      <section class="card loading" *ngIf="status === 'loading'">
        <div class="status-icon status-icon--loading" aria-hidden="true"></div>
        <p class="kicker">Processing</p>
        <h1>Confirming your payment</h1>
        <p class="lead">We are finalizing your reservation. This usually takes a few seconds.</p>
      </section>

      <section class="card ok" *ngIf="status === 'ok'">
        <div class="status-icon status-icon--ok" aria-hidden="true">✓</div>
        <p class="kicker">Payment confirmed</p>
        <h1>You're in!</h1>
        <p class="lead">Your event booking is confirmed and your seat is reserved.</p>
        <p *ngIf="reservationId != null" class="ref">Reservation #{{ reservationId }}</p>
        <div class="actions">
          <a routerLink="/evenements" class="btn">Back to events</a>
        </div>
      </section>

      <section class="card err" *ngIf="status === 'error'">
        <div class="status-icon status-icon--err" aria-hidden="true">!</div>
        <p class="kicker">Payment issue</p>
        <h1>Could not confirm</h1>
        <p class="lead">{{ message }}</p>
        <div class="actions">
          <a routerLink="/evenements" class="btn">Back to events</a>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      .wrap {
        max-width: 640px;
        margin: clamp(3rem, 9vh, 6rem) auto;
        padding: 1.25rem;
      }

      .card {
        padding: 2rem 2rem 1.8rem;
        border-radius: 22px;
        background: linear-gradient(155deg, rgba(18, 25, 42, 0.96), rgba(12, 18, 31, 0.96));
        border: 1px solid rgba(148, 163, 184, 0.28);
        color: #e8edf3;
        box-shadow: 0 22px 44px rgba(2, 6, 23, 0.38);
        backdrop-filter: blur(8px);
      }

      .kicker {
        margin: 0.45rem 0 0;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
        font-weight: 700;
        color: #8aa4d0;
      }

      h1 {
        margin: 0.35rem 0 0.6rem;
        font-size: clamp(1.45rem, 2.6vw, 1.95rem);
        line-height: 1.2;
      }

      .card p {
        margin: 0.35rem 0;
      }

      .lead {
        margin: 0;
        color: rgba(226, 232, 240, 0.88);
        line-height: 1.5;
      }

      .status-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1.15rem;
      }

      .status-icon--loading {
        border: 3px solid rgba(148, 163, 184, 0.35);
        border-top-color: #60a5fa;
        animation: spin 1s linear infinite;
      }

      .status-icon--ok {
        background: rgba(52, 211, 153, 0.16);
        border: 1px solid rgba(52, 211, 153, 0.42);
        color: #34d399;
      }

      .status-icon--err {
        background: rgba(248, 113, 113, 0.16);
        border: 1px solid rgba(248, 113, 113, 0.42);
        color: #f87171;
      }

      .ok h1 {
        color: #34d399;
      }

      .err h1 {
        color: #f87171;
      }

      .ref {
        margin-top: 0.9rem;
        font-weight: 600;
        color: #dbeafe;
      }

      .actions {
        margin-top: 1.1rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0.65rem 1.25rem;
        border-radius: 12px;
        background: linear-gradient(135deg, #f12545 0%, #ff4d6d 100%);
        color: #fff;
        text-decoration: none;
        font-weight: 600;
        box-shadow: 0 10px 22px rgba(241, 37, 69, 0.28);
      }

      .btn:hover {
        filter: brightness(1.04);
      }

      :host-context(html:not([data-theme='dark'])) .card {
        background: linear-gradient(160deg, #ffffff 0%, #f4f8ff 100%);
        color: #10203d;
        border: 1px solid #d3e2f8;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.14);
      }

      :host-context(html:not([data-theme='dark'])) .kicker {
        color: #476da8;
      }

      :host-context(html:not([data-theme='dark'])) .lead {
        color: #3f5d8f;
      }

      :host-context(html:not([data-theme='dark'])) .status-icon--loading {
        border-color: rgba(71, 109, 168, 0.24);
        border-top-color: #2f66cc;
      }

      :host-context(html:not([data-theme='dark'])) .status-icon--ok {
        background: rgba(20, 184, 127, 0.14);
        border-color: rgba(20, 184, 127, 0.28);
        color: #089669;
      }

      :host-context(html:not([data-theme='dark'])) .status-icon--err {
        background: rgba(225, 29, 72, 0.13);
        border-color: rgba(225, 29, 72, 0.28);
        color: #e11d48;
      }

      :host-context(html:not([data-theme='dark'])) .ok h1 {
        color: #0ea871;
      }

      :host-context(html:not([data-theme='dark'])) .err h1 {
        color: #e11d48;
      }

      :host-context(html:not([data-theme='dark'])) .ref {
        color: #1f3d70;
      }

      :host-context(html:not([data-theme='dark'])) .btn {
        box-shadow: 0 12px 22px rgba(241, 37, 69, 0.2);
      }

      @media (max-width: 640px) {
        .wrap {
          margin-top: 2rem;
          padding: 0.9rem;
        }

        .card {
          border-radius: 18px;
          padding: 1.45rem 1.2rem;
        }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
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
