import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AuthService } from '../../../core/auth.service';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { Accommodation } from '../../../core/models/travel.models';
import {
  AccommodationRoomCategory,
  nightlyRateForCategory,
} from '../../../core/utils/accommodation-quote.util';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="booking-wrapper" [class.confirmation-mode]="step() === 3">
        @if (editingReservationId() != null) {
          <div class="heb-edit-banner" role="status">
            <i class="pi pi-pencil" aria-hidden="true"></i>
            <span>Updating your stay — save to apply new dates to this booking (same room).</span>
          </div>
        }

        <!-- Left Panel: Reservation Form -->
        <div class="form-panel">

          <!-- Stepper -->
          <div class="stepper">
            @for (s of steps; track s.num) {
              <div class="step-item" [class.active]="step() === s.num" [class.done]="step() > s.num">
                <div class="step-circle">{{ step() > s.num ? '✓' : s.num }}</div>
                <span>{{ s.label }}</span>
              </div>
              @if (!$last) { <div class="step-line" [class.filled]="step() > s.num"></div> }
            }
          </div>

          <!-- Step 1: Guest Info -->
          @if (step() === 1) {
            <div class="step-content">
              <h2 class="step-h2"><i class="pi pi-user step-h2-ico"></i> Guest details</h2>
              <form [formGroup]="guestForm" (ngSubmit)="nextStep()">
                <div class="form-row">
                  <div class="form-field">
                    <label>First name *</label>
                    <input type="text" formControlName="firstName" placeholder="First name">
                    @if (guestForm.get('firstName')?.invalid && guestForm.get('firstName')?.touched) {
                      <span class="field-error">At least 2 characters</span>
                    }
                  </div>
                  <div class="form-field">
                    <label>Last name *</label>
                    <input type="text" formControlName="lastName" placeholder="Last name">
                    @if (guestForm.get('lastName')?.invalid && guestForm.get('lastName')?.touched) {
                      <span class="field-error">At least 2 characters</span>
                    }
                  </div>
                </div>
                <div class="form-field">
                  <label>Email *</label>
                  <input type="email" formControlName="email" placeholder="you@example.com">
                  @if (guestForm.get('email')?.invalid && guestForm.get('email')?.touched) {
                    <span class="field-error">Valid email required</span>
                  }
                </div>
                <div class="form-field">
                  <label>Phone (optional)</label>
                  <input type="tel" formControlName="phone" placeholder="+216 XX XXX XXX">
                  @if (guestForm.get('phone')?.invalid && guestForm.get('phone')?.touched) {
                    <span class="field-error">Use +216 and 8+ digits, or leave empty</span>
                  }
                </div>
                <div class="form-field">
                  <label>Special requests (optional)</label>
                  <textarea formControlName="notes" placeholder="e.g. quiet room, late arrival…"></textarea>
                </div>
                <div class="step-actions">
                  <button type="button" class="btn-ghost" (click)="goBack()">← Back</button>
                  <button type="submit" class="btn-primary" [disabled]="guestForm.invalid">
                    Continue →
                  </button>
                </div>
              </form>
            </div>
          }

          <!-- Step 2: Summary & Payment -->
          @if (step() === 2) {
            <div class="step-content">
              <h2 class="step-h2"><img src="icones/money-bag.png" alt="" class="step-h2-img" width="24" height="24" /> Summary &amp; payment</h2>

              <div class="summary-box">
                <div class="summary-row">
                  <span>Guest</span>
                  <strong>{{ guestForm.value.firstName }} {{ guestForm.value.lastName }}</strong>
                </div>
                <div class="summary-row">
                  <span>Email</span>
                  <strong>{{ guestForm.value.email }}</strong>
                </div>
                <div class="summary-row">
                  <span>Property</span>
                  <strong>{{ store.selectedAccommodation()?.name }}</strong>
                </div>
                <div class="summary-row">
                  <span>City</span>
                  <strong>{{ store.selectedAccommodation()?.cityName }}</strong>
                </div>
                <div class="summary-row">
                  <span>Check-in</span>
                  <strong>{{ store.dates().checkIn }}</strong>
                </div>
                <div class="summary-row">
                  <span>Check-out</span>
                  <strong>{{ store.dates().checkOut }}</strong>
                </div>
                <div class="summary-row">
                  <span>Length of stay</span>
                  <strong>{{ nightCount() }} night(s)</strong>
                </div>
                <div class="summary-row">
                  <span>Guests</span>
                  <strong>{{ store.pax().adults }} guest(s)</strong>
                </div>
                <div class="summary-row">
                  <span>Room</span>
                  <strong>{{ selectedRoomLabel() }}</strong>
                </div>
                <hr class="sum-divider">
                <div class="summary-row price-row">
                  <span>{{ quoteNightly() | number:'1.0-0' }} TND × {{ nightCount() }} night(s)</span>
                  <span>{{ baseTotal() | number:'1.0-0' }} TND</span>
                </div>
                <div class="summary-row price-row">
                  <span>Taxes (10%)</span>
                  <span>{{ taxAmount() | number:'1.0-0' }} TND</span>
                </div>
                <div class="summary-row total-row">
                  <strong>Total due</strong>
                  <strong class="total-amount">{{ grandTotal() | number:'1.0-0' }} TND</strong>
                </div>
              </div>

              @if (editingReservationId() === null) {
                <div class="payment-section">
                  <h3 class="pay-title">
                    <img src="icones/money-bag.png" alt="" class="pay-title-ico" width="22" height="22" />
                    Secure payment (Stripe)
                  </h3>
                  <p class="stripe-flow-hint">
                    After you confirm, you are redirected to <strong>Stripe Checkout</strong> (same flow as events).
                    Enter your card on Stripe’s page. In test mode use <code>4242&nbsp;4242&nbsp;4242&nbsp;4242</code>,
                    any future expiry, any CVC.
                  </p>
                  <p class="secure-note">
                    <i class="pi pi-lock secure-note-ico"></i>
                    Card data is never stored on YallaTN — only processed by Stripe.
                  </p>
                </div>
              } @else {
                <p class="secure-note edit-pay-note">
                  <i class="pi pi-info-circle secure-note-ico"></i>
                  Updating dates only — no new payment.
                </p>
              }

              <div class="step-actions">
                <button type="button" class="btn-ghost" (click)="step.set(1)">← Edit</button>
                <button type="button" class="btn-primary" (click)="confirmBooking()" [disabled]="payButtonDisabled()">
                  @if (loading()) { <span class="spinner-sm"></span> Processing... }
                  @else if (editingReservationId() != null) { <i class="pi pi-save"></i> Update booking }
                  @else { <i class="pi pi-check-circle"></i> Pay & confirm }
                </button>
              </div>
            </div>
          }

          <!-- Step 3: Confirmation -->
          @if (step() === 3) {
            <div class="step-content confirmation">
              <div class="conf-icon-wrap">
                <div class="conf-circle-heb">
                  <i class="pi pi-check conf-check"></i>
                </div>
              </div>
              <h2 class="conf-title-heb">{{ editingReservationId() != null ? 'Stay updated' : 'Booking confirmed' }}</h2>
              <p class="conf-desc">
                @if (editingReservationId() != null) {
                  Your dates at <strong>{{ store.selectedAccommodation()?.name }}</strong> have been updated.
                } @else {
                  Your stay at <strong>{{ store.selectedAccommodation()?.name }}</strong> has been reserved.
                }
              </p>
              <div class="conf-welcome">
                <span class="conf-wave"><i class="pi pi-heart-fill"></i></span>
                <p class="conf-welcome-msg">Thank you <strong>{{ guestForm.value.firstName }}</strong>, you’re all set.</p>
              </div>
              <p class="conf-email">A confirmation summary was sent to <strong>{{ guestForm.value.email }}</strong></p>
              <div class="conf-actions">
                <button class="btn-ghost" (click)="router.navigate(['/'])"><img src="icones/home.png" alt="" class="btn-ico" width="18" height="18" /> Home</button>
                <button class="btn-primary" (click)="router.navigate(['/transport'])"><img src="icones/bus.png" alt="" class="btn-ico" width="18" height="18" /> Find transport</button>
              </div>
            </div>
          }

        </div>

        <!-- Right Panel: Stay Summary Card -->
        @if (step() < 3) {
          <div class="summary-panel">
            <div class="stay-card">
              <div class="stay-img" [style.background]="'linear-gradient(135deg, #1a0a14, #2d0d1c)'">
                <span class="stay-type-badge"><img [src]="typeIconSrc(store.selectedAccommodation()?.type)" alt="" class="stay-type-ico" width="16" height="16" />{{ formatType(store.selectedAccommodation()?.type) }}</span>
              </div>
              <div class="stay-info">
                <h3>{{ store.selectedAccommodation()?.name }}</h3>
                <p class="stay-city"><img src="icones/city.png" alt="" class="stay-city-ico" width="16" height="16" /> {{ store.selectedAccommodation()?.cityName }}</p>
                <div class="stay-rating">
                  {{ getStars(store.selectedAccommodation()?.rating || 0) }}
                  <span>{{ store.selectedAccommodation()?.rating }}/5</span>
                </div>
              </div>
              <div class="stay-dates">
                <div class="date-block">
                  <span class="date-lbl">CHECK-IN</span>
                  <span class="date-val">{{ store.dates().checkIn || '—' }}</span>
                </div>
                <div class="nights-block">{{ nightCount() }} <span>nights</span></div>
                <div class="date-block">
                  <span class="date-lbl">CHECK-OUT</span>
                  <span class="date-val">{{ store.dates().checkOut || '—' }}</span>
                </div>
              </div>
              <div class="stay-total">
                <span>Estimated total</span>
                <strong>{{ grandTotal() | number:'1.0-0' }} TND</strong>
              </div>
            </div>

            <!-- Guarantees -->
            <div class="guarantees">
              <div class="guarantee-item"><i class="pi pi-check-circle g-ico"></i><span>Flexible cancellation (where applicable)</span></div>
              <div class="guarantee-item"><i class="pi pi-lock g-ico"></i><span>Secure checkout</span></div>
              <div class="guarantee-item"><i class="pi pi-star-fill g-ico"></i><span>Best price focus</span></div>
              <div class="guarantee-item"><i class="pi pi-phone g-ico"></i><span>24/7 assistance</span></div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 2rem; min-height: 100vh; background: #0d0f18; }
    .booking-wrapper { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; max-width: 1100px; margin: 0 auto; align-items: start; }
    .booking-wrapper.confirmation-mode { grid-template-columns: 1fr; max-width: 680px; }

    /* Stepper */
    .stepper { display: flex; align-items: center; margin-bottom: 2.5rem; }
    .step-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .step-circle { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; color: rgba(255,255,255,0.4); transition: all 0.3s; }
    .step-item.active .step-circle { background: #f12545; border-color: #f12545; color: #fff; box-shadow: 0 0 15px rgba(241,37,69,0.4); }
    .step-item.done .step-circle { background: #f12545; border-color: #f12545; color: #fff; }
    .step-item span { font-size: 0.78rem; color: rgba(255,255,255,0.4); }
    .step-item.active span { color: #fff; }
    .step-line { flex: 1; height: 2px; background: rgba(255,255,255,0.1); margin: 0 8px; position: relative; top: -10px; transition: background 0.3s; }
    .step-line.filled { background: #f12545; }

    /* Form Panel */
    .form-panel { background: #161922; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 2.5rem; }
    .step-content h2 { font-size: 1.5rem; color: #fff; margin-bottom: 2rem; }
    .step-h2 { display: flex; align-items: center; gap: 10px; }
    .step-h2-ico { font-size: 1.35rem; color: #a78bfa; }
    .step-h2-img { object-fit: contain; flex-shrink: 0; }
    .pay-h3 { display: flex; align-items: center; gap: 8px; }
    .pay-h3-ico { font-size: 1rem; color: #94a3b8; }
    .secure-note { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .secure-note-ico { font-size: 0.95rem; color: rgba(255,255,255,0.45); }
    .btn-ico { object-fit: contain; vertical-align: middle; margin-right: 6px; }
    .stay-type-badge { display: inline-flex; align-items: center; gap: 6px; }
    .stay-type-ico { object-fit: contain; }
    .stay-city { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: rgba(255,255,255,0.5); margin-bottom: 6px; }
    .stay-city-ico { object-fit: contain; opacity: 0.85; flex-shrink: 0; }
    .g-ico { font-size: 1.1rem; color: #f12545; flex-shrink: 0; }
    .conf-wave { display: flex; align-items: center; color: #f12545; font-size: 1.25rem; }

    /* Form Fields */
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.2rem; }
    .form-field label { font-size: 0.85rem; color: rgba(255,255,255,0.55); font-weight: 500; }
    input, textarea, select {
      background: #0d0f18; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      padding: 12px 14px; color: #fff; font-size: 0.95rem; outline: none;
      transition: border-color 0.2s; width: 100%;
    }
    input:focus, textarea:focus { border-color: #f12545; }
    textarea { height: 90px; resize: none; }
    .field-error { font-size: 0.78rem; color: #f12545; }

    /* Actions */
    .step-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; }
    .btn-primary { padding: 13px 30px; background: #f12545; color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
    .btn-primary:hover:not([disabled]) { background: #ff3355; }
    .btn-primary[disabled] { opacity: 0.5; cursor: not-allowed; }
    .btn-ghost { background: none; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); padding: 13px 20px; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
    .btn-ghost:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Summary Box */
    .summary-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 0.9rem; color: rgba(255,255,255,0.65); }
    .summary-row strong { color: #fff; }
    .sum-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 8px 0; }
    .price-row span { color: rgba(255,255,255,0.5); }
    .total-row { margin-top: 4px; font-size: 1.05rem; }
    .total-amount { color: #f12545; font-size: 1.4rem; }

    /* Payment */
    .payment-section { margin-bottom: 2rem; }
    .pay-title { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.7); font-size: 0.95rem; margin: 0 0 1rem 0; font-weight: 600; }
    .pay-title-ico { object-fit: contain; flex-shrink: 0; }
    .card-mock { background: linear-gradient(135deg, #1a0a14, #3d1828); border-radius: 14px; padding: 1.5rem; color: #fff; position: relative; box-shadow: 0 8px 20px rgba(241,37,69,0.2); }
    .card-chip { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .card-number { font-family: monospace; font-size: 1.3rem; letter-spacing: 3px; margin-bottom: 1rem; }
    .card-footer { display: flex; justify-content: space-between; opacity: 0.7; font-size: 0.85rem; }
    .secure-note { font-size: 0.8rem; color: rgba(255,255,255,0.35); text-align: center; margin-top: 0.75rem; }
    .edit-pay-note { margin-top: 1rem; }
    .stripe-flow-hint {
      font-size: 0.85rem; color: rgba(255,255,255,0.55); line-height: 1.5; margin: 0 0 1rem 0;
    }
    .stripe-flow-hint code { color: #fca5a5; font-size: 0.82rem; }
    .stripe-card-field { margin-bottom: 0.5rem; }
    .stripe-card-input { font-family: ui-monospace, monospace; letter-spacing: 0.04em; }

    /* Confirmation */
    .confirmation { text-align: center; padding: 2.5rem 1.5rem; }
    .conf-icon-wrap { margin-bottom: 1.5rem; }
    .conf-circle-heb {
      width: 76px; height: 76px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, #f12545, #ff6b6b);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 32px rgba(241,37,69,0.35);
      animation: pop 0.45s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .conf-check { font-size: 2rem; color: #fff; }
    .conf-title-heb { font-size: 2rem; font-weight: 800; color: #fff; margin: 0 0 0.6rem; letter-spacing: -0.02em; }
    .conf-desc { color: rgba(255,255,255,0.6); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem; }
    .conf-welcome {
      display: flex; align-items: center; gap: 0.75rem; justify-content: center;
      background: rgba(241,37,69,0.06);
      border: 1px solid rgba(241,37,69,0.15);
      border-radius: 14px; padding: 1rem 1.5rem; margin-bottom: 1rem;
    }
    .conf-wave { font-size: 1.6rem; }
    .conf-welcome-msg { font-size: 1rem; color: rgba(255,255,255,0.8); margin: 0; }
    .conf-welcome-msg strong { color: #fff; font-weight: 700; }
    .conf-email { font-size: 0.85rem; color: rgba(255,255,255,0.45); margin-bottom: 0; }
    .conf-email strong { color: rgba(255,255,255,0.75); }
    .conf-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }

    /* Stay Card (Right Panel) */
    .summary-panel { display: flex; flex-direction: column; gap: 1.5rem; }
    .stay-card { background: #161922; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; }
    .stay-img { height: 140px; display: flex; align-items: center; justify-content: center; position: relative; }
    .stay-type-badge { background: rgba(241,37,69,0.9); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }
    .stay-info { padding: 1.2rem 1.5rem 0; }
    .stay-info h3 { color: #fff; font-size: 1.1rem; margin: 0 0 4px 0; }
    .stay-rating { font-size: 0.9rem; color: #f1c40f; }
    .stay-rating span { color: rgba(255,255,255,0.5); margin-left: 4px; }
    .stay-dates { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; background: rgba(255,255,255,0.03); margin: 1rem 0 0 0; }
    .date-block { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .date-lbl { font-size: 0.68rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; }
    .date-val { font-size: 0.95rem; color: #fff; font-weight: 600; }
    .nights-block { font-size: 1.4rem; font-weight: 800; color: #f12545; text-align: center; display: flex; flex-direction: column; align-items: center; }
    .nights-block span { font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: 400; }
    .stay-total { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.06); }
    .stay-total span { color: rgba(255,255,255,0.5); font-size: 0.9rem; }
    .stay-total strong { color: #f12545; font-size: 1.3rem; }

    /* Guarantees */
    .guarantees { background: #161922; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px; }
    .guarantee-item { display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: rgba(255,255,255,0.7); }

    .heb-edit-banner {
      grid-column: 1 / -1;
      display: flex; align-items: flex-start; gap: 0.6rem;
      padding: 0.85rem 1rem; margin-bottom: 0.5rem; border-radius: 14px;
      background: rgba(0, 119, 182, 0.15); border: 1px solid rgba(0, 119, 182, 0.35);
      font-size: 0.88rem; color: rgba(255,255,255,0.92); line-height: 1.45;
    }
    .heb-edit-banner .pi { color: #38bdf8; margin-top: 2px; }

    @media (max-width: 900px) {
      .booking-wrapper { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
    }
  `]
})
export class AccommodationBookingPageComponent implements OnInit {
  fb = inject(FormBuilder);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  router = inject(Router);
  route = inject(ActivatedRoute);
  auth = inject(AuthService);
  private alerts = inject(AppAlertsService);
  private cdr = inject(ChangeDetectorRef);

  step = signal(1);
  loading = signal(false);
  reservationId = signal('');
  /** My bookings → Edit: PATCH stay dates instead of creating a new reservation. */
  editingReservationId = signal<number | null>(null);
  /** Locked room when editing (from query). */
  editingRoomId = signal<number | null>(null);

  steps = [
    { num: 1, label: 'Guest' },
    { num: 2, label: 'Payment' },
    { num: 3, label: 'Done' },
  ];

  guestForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(/^$|^(\+216\s?)?[0-9\s]{8,12}$/)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  nightCount = computed(() => {
    const ci = this.store.dates().checkIn;
    const co = this.store.dates().checkOut;
    if (!ci || !co) return 1;
    const diff = new Date(co).getTime() - new Date(ci).getTime();
    return Math.max(1, Math.floor(diff / 86400000));
  });

  quoteNightly = computed(() => {
    const acc = this.store.selectedAccommodation();
    if (!acc) return 0;
    return nightlyRateForCategory(acc, this.store.accommodationRoomCategory());
  });

  baseTotal = computed(() => this.quoteNightly() * this.nightCount());
  taxAmount = computed(() => Math.round(this.baseTotal() * 0.1));
  grandTotal = computed(() => this.baseTotal() + this.taxAmount());

  selectedRoomLabel(): string {
    const labels: Record<AccommodationRoomCategory, string> = {
      SINGLE: 'Single room',
      DOUBLE: 'Double room',
      SUITE: 'Luxury suite',
    };
    return labels[this.store.accommodationRoomCategory()];
  }

  payButtonDisabled(): boolean {
    return this.loading();
  }

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const checkInQ = qp.get('checkIn');
    const checkOutQ = qp.get('checkOut');
    if (checkInQ && checkOutQ) {
      this.store.setDates({ checkIn: checkInQ, checkOut: checkOutQ });
    }
    const edit = qp.get('edit');
    const roomIdQ = qp.get('roomId');
    if (edit) {
      const eid = parseInt(edit, 10);
      if (Number.isFinite(eid)) this.editingReservationId.set(eid);
    }
    if (roomIdQ) {
      const rid = parseInt(roomIdQ, 10);
      if (Number.isFinite(rid)) this.editingRoomId.set(rid);
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.dataSource
        .getAccommodationDetails(id, {
          checkIn: this.store.dates().checkIn ?? undefined,
          checkOut: this.store.dates().checkOut ?? undefined,
        })
        .subscribe((data) => this.store.selectedAccommodation.set(data));
    }

    const user = this.auth.currentUser();
    if (user) {
      this.guestForm.patchValue({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }

    const paid = qp.get('paid');
    const paidRid = qp.get('reservationId');
    const uidEarly = user?.id;
    if (paid === '1' && paidRid && uidEarly != null) {
      const prid = Number(paidRid);
      if (Number.isFinite(prid)) {
        this.dataSource.getMyAccommodationReservations(uidEarly).subscribe({
          next: (list) => {
            const found = list.find((x) => x.id === prid);
            if (found) {
              this.reservationId.set(String(found.id));
              this.step.set(3);
              this.cdr.markForCheck();
            }
          },
          error: () => {
            void this.alerts.error('Booking', 'Could not load your stay reservation.');
          },
        });
      }
    }
  }

  private resolveRoomIdForSubmit(acc: Accommodation): { id: number } | null {
    const locked = this.editingRoomId();
    if (locked != null && Number.isFinite(locked)) {
      return { id: locked };
    }
    const quoted = this.store.accommodationQuoteRoomId();
    const guests = this.store.pax().adults;
    if (quoted != null && acc.rooms?.some((r) => r.id === quoted && r.available !== false)) {
      const r = acc.rooms!.find((x) => x.id === quoted)!;
      if ((r.capacity ?? 0) >= guests) {
        return { id: quoted };
      }
    }
    return this.pickRoom(acc, guests);
  }

  nextStep() {
    if (!this.guestForm.valid) {
      this.guestForm.markAllAsTouched();
      void this.alerts.warning('Guest details', 'Please complete all required fields correctly.');
      return;
    }
    const ci = this.store.dates().checkIn;
    const co = this.store.dates().checkOut;
    if (!ci || !co) {
      void this.alerts.warning('Stay dates', 'Check-in and check-out are required for this booking.');
      return;
    }
    if (new Date(co) <= new Date(ci)) {
      void this.alerts.warning('Invalid dates', 'Check-out must be after check-in.');
      return;
    }
    this.step.set(2);
  }

  goBack() {
    const accId = this.store.selectedAccommodation()?.id;
    this.router.navigate(['/hebergement', accId]);
  }

  async confirmBooking() {
    const user = this.auth.currentUser();
    if (!user) {
      void this.alerts.warning('Sign in required', 'Please sign in to complete your stay booking.');
      this.router.navigate(['/signin']);
      return;
    }

    const acc = this.store.selectedAccommodation();
    if (!acc) {
      void this.alerts.error('Missing listing', 'No property selected. Please choose an accommodation again.');
      return;
    }

    const ci = this.store.dates().checkIn;
    const co = this.store.dates().checkOut;
    if (!ci || !co || new Date(co) <= new Date(ci)) {
      void this.alerts.warning('Invalid stay', 'Check-in and check-out dates must be valid.');
      return;
    }

    const guests = this.store.pax().adults;
    if (guests < 1 || guests > 20) {
      void this.alerts.warning('Guests', 'Number of guests must be between 1 and 20.');
      return;
    }

    const editId = this.editingReservationId();
    if (editId != null) {
      this.loading.set(true);
      this.dataSource.updateAccommodationReservation(editId, user.id, ci, co).subscribe({
        next: (res) => {
          this.loading.set(false);
          this.reservationId.set(res?.id?.toString() ?? String(editId));
          this.step.set(3);
        },
        error: (err) => {
          this.loading.set(false);
          void this.alerts.error(
            'Update failed',
            err.error?.message ??
              'We could not update these dates. They may conflict with another booking — try different dates.'
          );
        },
      });
      return;
    }

    const roomPick = this.resolveRoomIdForSubmit(acc);
    if (!roomPick) {
      void this.alerts.error(
        'No room available',
        'This listing has no room that fits your dates or guest count. Try other dates or another property.'
      );
      return;
    }

    const total = this.grandTotal();
    const confirm = await this.alerts.confirm({
      title: 'Confirm payment',
      text: `You will be redirected to Stripe to pay ${total} TND for this stay. Continue?`,
      confirmText: 'Yes, continue to Stripe',
      cancelText: 'Cancel',
      icon: 'question',
    });
    if (!confirm.isConfirmed) {
      return;
    }

    this.loading.set(true);
    this.cdr.markForCheck();

    this.dataSource
      .createAccommodationCheckoutSession({
        roomId: roomPick.id,
        userId: user.id,
        checkIn: ci.slice(0, 10),
        checkOut: co.slice(0, 10),
        offerId: null,
      })
      .subscribe({
        next: (checkout) => {
          this.loading.set(false);
          this.cdr.markForCheck();
          const url = (checkout.url ?? '').trim();
          if (!url) {
            void this.alerts.error('Checkout', 'Invalid payment response from server.');
            return;
          }
          let stripeHost = '';
          try {
            stripeHost = new URL(url).hostname.toLowerCase();
          } catch {
            /* ignore */
          }
          if (stripeHost === 'checkout.stripe.com' || stripeHost.endsWith('.checkout.stripe.com')) {
            window.location.assign(url);
            return;
          }
          if (url.startsWith('/')) {
            void this.router.navigateByUrl(url);
            return;
          }
          if (url.startsWith('https://') || url.startsWith('http://')) {
            window.location.assign(url);
            return;
          }
          void this.alerts.error('Checkout', 'Invalid payment response from server.');
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.cdr.markForCheck();
          const body =
            err && typeof err === 'object' && 'error' in err ? (err as { error?: unknown }).error : undefined;
          const msg =
            typeof body === 'object' && body !== null && 'message' in body
              ? String((body as { message?: string }).message)
              : typeof body === 'string'
                ? body
                : 'Could not start Stripe checkout.';
          void this.alerts.error('Checkout', msg);
        },
      });
  }

  /** Picks a bookable room for the API (requires real roomId from backend). */
  private pickRoom(acc: Accommodation, guestCount: number): { id: number } | null {
    const rooms = acc.rooms ?? [];
    if (rooms.length === 0) return null;
    const fits = rooms.filter((r) => r.available !== false && (r.capacity ?? 0) >= guestCount);
    const pool = fits.length > 0 ? fits : rooms.filter((r) => r.available !== false);
    const candidates = pool.length > 0 ? pool : rooms;
    const sorted = [...candidates].sort((a, b) => (a.price ?? acc.pricePerNight) - (b.price ?? acc.pricePerNight));
    const chosen = sorted[0];
    return chosen?.id != null ? { id: chosen.id } : null;
  }

  formatType(type?: string): string {
    if (!type) return '';
    const map: Record<string, string> = {
      HOTEL: 'Hotel',
      MAISON_HOTE: 'Guest house',
      GUESTHOUSE: 'Rural guesthouse',
      AUTRE: 'Stay',
    };
    return map[type] || type;
  }

  typeIconSrc(type?: string): string {
    if (type === 'HOTEL') return 'icones/hotel.png';
    return 'icones/home.png';
  }

  getStars(rating: number): string {
    return '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');
  }
}
