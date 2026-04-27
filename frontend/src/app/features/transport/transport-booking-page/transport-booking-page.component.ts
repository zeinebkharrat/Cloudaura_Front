import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AuthService } from '../../../core/auth.service';
import { LoginRequiredPromptService } from '../../../core/login-required-prompt.service';
import {
  Transport,
  TransportReservation,
  ReservationStatus,
  SyntheticFlightOfferPayload,
} from '../../../core/models/travel.models';
import { TransportTrackingSseService } from '../transport-tracking-sse.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { createCurrencyDisplaySyncEffect } from '../../../core/utils/currency-display-sync';

@Component({
  selector: 'app-transport-booking-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transport-booking-page.component.html',
  styles: [`
    .bp { min-height: 100vh; padding: 1rem 1rem 4rem; background: var(--bg-color); }
    .bp-wrap { max-width: 740px; margin: 0 auto; }
    .bp-edit-banner {
      display: flex; align-items: flex-start; gap: 0.6rem;
      padding: 0.85rem 1rem; margin-bottom: 1rem; border-radius: 14px;
      background: color-mix(in srgb, var(--tunisia-red) 7%, var(--surface-1));
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 22%, var(--glass-border));
      font-size: 0.88rem; color: var(--text-color); line-height: 1.45;
    }
    .bp-edit-banner .pi { color: var(--tunisia-red); margin-top: 2px; }

    .trip-inline {
      display: flex; align-items: center; gap: 0.85rem;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--tunisia-red) 8%, var(--surface-1)) 0%,
        color-mix(in srgb, var(--tunisia-red) 3%, var(--surface-1)) 100%
      );
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 16%, var(--glass-border));
      border-radius: 14px; padding: 0.9rem 1.25rem;
      margin-bottom: 1.75rem;
    }
    .trip-emoji { font-size: 1.6rem; flex-shrink: 0; }
    .trip-detail { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .trip-route { font-weight: 700; font-size: 0.95rem; color: var(--text-color); }
    .trip-meta { font-size: 0.78rem; color: var(--text-muted); margin-top: 1px; }
    .trip-price {
      font-family: 'Outfit', sans-serif; font-size: 1.35rem;
      font-weight: 800; color: var(--tunisia-red); white-space: nowrap; flex-shrink: 0;
    }
    .trip-price small { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }
    .trip-price-col { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
    .trip-quote-note {
      display: block;
      margin-top: 0.35rem;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-muted);
      line-height: 1.35;
      max-width: 22rem;
    }

    .stepper-wrap {
      background: var(--surface-1);
      border: 1px solid var(--glass-border);
      border-radius: 20px; padding: 2rem 2.25rem;
      box-shadow: var(--shadow-card);
    }

    :host ::ng-deep {
      .manual-steps {
        display: flex; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 1.35rem;
        font-size: 0.76rem; font-weight: 600; color: var(--text-muted);
      }
      .manual-steps span {
        padding: 0.32rem 0.7rem; border-radius: 999px;
        border: 1px solid var(--glass-border); background: var(--surface-2);
      }
      .manual-steps span.active {
        border-color: var(--tunisia-red);
        color: var(--tunisia-red);
        background: color-mix(in srgb, var(--tunisia-red) 8%, var(--surface-1));
      }
      .bp .p-inputtext {
        width: 100%;
        background: var(--input-bg) !important;
        color: var(--text-color) !important;
        border: none !important;
        box-shadow: none !important;
      }
      .bp .p-inputtext::placeholder {
        color: var(--text-muted) !important;
        opacity: 0.55 !important;
      }
      .bp .p-inputtext:enabled:focus {
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
      }
    }

    .step { padding: 1.5rem 0 0; }
    .step-head { text-align: center; margin-bottom: 2rem; }
    .step-head h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem; font-weight: 700; margin: 0 0 0.3rem; color: var(--text-color);
    }
    .step-head p { font-size: 0.88rem; color: var(--text-muted); margin: 0; }

    .f { display: flex; flex-direction: column; gap: 1.4rem; }
    .f-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
    .f-group { display: flex; flex-direction: column; gap: 0.35rem; }

    .f-label {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.4px; color: var(--text-muted);
      display: flex; align-items: center; gap: 0.35rem;
    }
    .f-label i { font-size: 0.8rem; color: var(--tunisia-red); }

    .f-input-wrap {
      border: 1.5px solid var(--glass-border);
      border-radius: 12px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: var(--input-bg);
    }
    .f-input-wrap:focus-within {
      border-color: var(--tunisia-red);
      box-shadow: 0 0 0 3px var(--tunisia-red-glow);
    }
    .f-input-wrap.f-error { border-color: #f87171; }
    .f-input-wrap.f-error:focus-within { box-shadow: 0 0 0 3px rgba(248,113,113,0.12); }

    .f-input {
      border: none !important; background: transparent !important;
      box-shadow: none !important;
      padding: 0.75rem 1rem !important; font-size: 0.95rem !important;
      color: var(--text-color) !important; font-weight: 500 !important;
    }
    .f-input::placeholder { color: var(--text-muted) !important; opacity: 0.5 !important; }

    .f-phone {
      display: flex; align-items: stretch;
      border: 1.5px solid var(--glass-border);
      border-radius: 12px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: var(--input-bg);
    }
    .f-phone:focus-within {
      border-color: var(--tunisia-red);
      box-shadow: 0 0 0 3px var(--tunisia-red-glow);
    }
    .f-phone.f-error { border-color: #f87171; }
    .f-prefix {
      display: flex; align-items: center; padding: 0 0.85rem;
      font-weight: 700; font-size: 0.88rem; color: var(--tunisia-red);
      background: color-mix(in srgb, var(--tunisia-red) 6%, var(--surface-1));
      border-right: 1px solid var(--glass-border);
    }

    .f-err-msg { font-size: 0.72rem; color: #f87171; font-weight: 500; padding-left: 2px; }

    .f-seats {
      display: flex; align-items: center; gap: 0.85rem;
      background: color-mix(in srgb, var(--tunisia-red) 6%, var(--surface-1));
      border: 1.5px solid color-mix(in srgb, var(--tunisia-red) 18%, var(--glass-border));
      border-radius: 12px; padding: 0.75rem 1.1rem;
    }
    .f-seats-badge {
      width: 38px; height: 38px; border-radius: 10px;
      background: var(--tunisia-red); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; font-weight: 800; flex-shrink: 0;
    }
    .f-seats-txt { font-size: 0.88rem; color: var(--text-muted); font-weight: 500; }

    .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2.5rem; }

    .sum {
      background: var(--surface-2);
      border: 1px solid var(--glass-border);
      border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;
    }
    .sum-route { display: flex; align-items: center; justify-content: space-between; }
    .sum-point { display: flex; flex-direction: column; gap: 2px; }
    .sum-end { text-align: right; }
    .sum-city { font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700; color: var(--text-color); }
    .sum-time { font-size: 0.8rem; color: var(--text-muted); }
    .sum-track { flex: 1; display: flex; align-items: center; gap: 0; margin: 0 1rem; }
    .sum-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--tunisia-red); flex-shrink: 0;
      box-shadow: 0 0 0 3px var(--tunisia-red-glow);
    }
    .sum-line {
      flex: 1; height: 2px;
      background: color-mix(in srgb, var(--tunisia-red) 18%, var(--surface-3));
    }
    .sum-emoji { font-size: 1rem; margin: 0 0.3rem; }

    .sum-divider { height: 1px; background: var(--glass-border); margin: 1.1rem 0; }

    .sum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .sum-item { display: flex; flex-direction: column; gap: 2px; }
    .sum-k { font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
    .sum-k i { font-size: 0.75rem; color: var(--tunisia-red); }
    .sum-v { font-size: 0.92rem; font-weight: 600; color: var(--text-color); }

    .sum-pricing { display: flex; flex-direction: column; gap: 0.4rem; }
    .sum-pl { display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--text-muted); }
    .sum-total { font-weight: 700; color: var(--text-color); padding-top: 0.6rem; border-top: 1px dashed var(--glass-border); font-size: 1rem; }
    .sum-total-val { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 800; color: var(--tunisia-red); }

    .pay { margin-bottom: 0.5rem; }
    .pay-title { font-size: 0.92rem; font-weight: 700; color: var(--text-color); margin: 0 0 0.85rem; }
    .pay-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
    .pay-opt {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem 1.1rem; border-radius: 14px; cursor: pointer;
      background: var(--surface-2);
      border: 1.5px solid var(--glass-border);
      transition: all 0.25s;
    }
    .pay-opt:hover { border-color: color-mix(in srgb, var(--tunisia-red) 35%, var(--glass-border)); }
    .pay-active {
      border-color: var(--tunisia-red) !important;
      background: color-mix(in srgb, var(--tunisia-red) 7%, var(--surface-2)) !important;
    }

    .pay-radio {
      width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
      border: 2px solid var(--glass-border); transition: all 0.2s;
      position: relative;
    }
    .pay-checked { border-color: var(--tunisia-red); }
    .pay-checked::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--tunisia-red);
    }

    .pay-icon { font-size: 1.2rem; color: var(--tunisia-red); }
    .pay-txt { display: flex; flex-direction: column; }
    .pay-name { font-weight: 700; font-size: 0.88rem; color: var(--text-color); }
    .pay-desc { font-size: 0.72rem; color: var(--text-muted); }
    .pay-paypal.pay-active {
      border-color: var(--tunisia-red) !important;
      background: color-mix(in srgb, var(--tunisia-red) 8%, var(--surface-2)) !important;
    }
    .paypal-mark {
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--text-color);
      letter-spacing: 0.02em;
    }
    .paypal-note {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-weight: 600;
      margin-top: 0.4rem;
      line-height: 1.35;
    }

    .conf-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid var(--glass-border);
      background: var(--surface-2);
      color: var(--text-color);
    }
    .conf-pill--pay {
      text-transform: none;
      font-weight: 600;
      letter-spacing: 0.02em;
      background: color-mix(in srgb, var(--tunisia-red) 6%, var(--surface-1));
      border-color: color-mix(in srgb, var(--tunisia-red) 18%, var(--glass-border));
      color: var(--text-color);
    }
    .conf-pill--ok {
      background: color-mix(in srgb, var(--tunisia-red) 10%, var(--surface-1));
      border-color: color-mix(in srgb, var(--tunisia-red) 28%, var(--glass-border));
      color: var(--tunisia-red);
    }
    .conf-pill--pending {
      background: color-mix(in srgb, var(--tunisia-red) 5%, var(--surface-2));
      border-color: color-mix(in srgb, #f59e0b 35%, var(--glass-border));
      color: #b45309;
    }
    .conf-pill--cancelled {
      background: color-mix(in srgb, #f87171 8%, var(--surface-1));
      border-color: rgba(248,113,113,0.35);
      color: #b91c1c;
    }

    .conf { text-align: center; padding-top: 2rem !important; }
    .conf-icon { margin-bottom: 1.25rem; }
    .conf-circle {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--tunisia-red), #ff6b6b);
      box-shadow: 0 8px 30px var(--tunisia-red-glow);
      animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .conf-circle i { font-size: 2rem; color: #fff; }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }

    .conf-title { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; margin: 0 0 0.75rem; color: var(--text-color); }
    .conf-welcome-msg {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: color-mix(in srgb, var(--tunisia-red) 8%, var(--surface-1));
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 22%, var(--glass-border));
      border-radius: 50px; padding: 0.5rem 1.1rem; margin-bottom: 1.75rem;
      font-size: 0.9rem; color: var(--text-muted);
    }
    .conf-welcome-msg strong { color: var(--text-color); }

    .conf-card {
      background: var(--surface-2);
      border: 1px solid var(--glass-border);
      border-radius: 16px; padding: 1.5rem;
      text-align: left; max-width: 420px; margin: 0 auto 2rem;
    }
    .conf-ref { text-align: center; }
    .conf-ref-label { display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
    .conf-ref-val { display: block; font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 800; color: var(--tunisia-red); letter-spacing: 1px; margin-top: 0.2rem; }
    .conf-divider { height: 1px; background: var(--glass-border); margin: 1rem 0; }
    .conf-rows { display: flex; flex-direction: column; gap: 0.6rem; }
    .conf-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; color: var(--text-muted); }
    .conf-row strong { color: var(--text-color); }

    .conf-qr { text-align: center; }
    .conf-qr p { font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.75rem; }
    .conf-qr-box {
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      padding: 1.25rem; background: var(--surface-2); border-radius: 12px;
      border: 1px solid var(--glass-border);
    }
    .conf-qr-box i { font-size: 3.5rem; color: var(--text-muted); opacity: 0.3; }
    .conf-qr-img { display: block; border-radius: 8px; background: #fff; padding: 8px; }
    .conf-qr-wait { font-size: 0.85rem; color: var(--text-muted); }

    .conf-btns { display: flex; justify-content: center; gap: 0.75rem; }

    @media (max-width: 640px) {
      .stepper-wrap { padding: 1.25rem; border-radius: 16px; }
      .f-row { grid-template-columns: 1fr; }
      .pay-grid { grid-template-columns: 1fr; }
      .step-nav { flex-direction: column-reverse; gap: 0.75rem; }
      .step-nav button { width: 100%; }
      .trip-inline { flex-wrap: wrap; }
    }
  `],
})
export class TransportBookingPageComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private alerts = inject(AppAlertsService);
  private cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currency = inject(CurrencyService);
  private http = inject(HttpClient);
  authService = inject(AuthService);
  private loginPrompt = inject(LoginRequiredPromptService);
  private dataSource = inject(DATA_SOURCE_TOKEN);
  private trackingSse = inject(TransportTrackingSseService);

  router = inject(Router);
  store = inject(TripContextStore);

  transport = signal<Transport | null>(null);
  reservation = signal<TransportReservation | null>(null);
  qrBoardingImageUrl = signal<string | null>(null);
  editingReservationId = signal<number | null>(null);
  activeStep = signal(0);
  loading = signal(false);
  showQrDialog = false;
  paymentMethod = signal<'CASH' | 'KONNECT' | 'STRIPE' | 'PAYPAL'>('CASH');
  paymentMethodValue = 'CASH';

  /** Re-render OnPush views when the global currency or FX snapshot changes. */
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();

  /** Avoid refilling passenger fields when the same profile was already applied. */
  private syncedPassengerProfileUserId: number | null = null;

  passengerForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    seats: [1, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());

    effect(() => {
      const user = this.authService.currentUser();
      if (!user) {
        this.syncedPassengerProfileUserId = null;
        return;
      }
      if (this.route.snapshot.queryParamMap.get('edit')) {
        return;
      }
      if (this.editingReservationId() != null) {
        return;
      }
      if (this.syncedPassengerProfileUserId === user.id) {
        return;
      }
      this.syncedPassengerProfileUserId = user.id;
      const digits = (user.phone?.replace(/\+216\s*/, '').replace(/\D/g, '') ?? '').slice(-8);
      this.passengerForm.patchValue(
        {
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? '',
          phone: digits,
        },
        { emitEvent: false },
      );
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    const qpDate = this.route.snapshot.queryParamMap.get('date');
    if (qpDate) {
      this.store.setDates({ travelDate: qpDate });
    }

    this.passengerForm.patchValue({ seats: this.store.pax().adults || 1 });

    const user = this.authService.currentUser();

    const routeId = this.route.snapshot.paramMap.get('id');
    const editParam = this.route.snapshot.queryParamMap.get('edit');
    const transportIdNum = routeId ? parseInt(routeId, 10) : NaN;

    const selected = this.store.selectedTransport();
    if (selected && Number.isFinite(transportIdNum) && selected.id === transportIdNum) {
      this.transport.set(selected);
      this.applySeatCapacityValidators(selected);
      this.maybeRedirectEstimateOnly(selected);
    } else if (Number.isFinite(transportIdNum) && transportIdNum > 0) {
      // Only load from server for positive IDs (real transports)
      // Synthetic transports (negative IDs) don't exist in database
      this.dataSource.getTransportById(transportIdNum).subscribe({
        next: (t) => {
          this.transport.set(t);
          this.applySeatCapacityValidators(t);
          this.maybeRedirectEstimateOnly(t);
          this.cdr.markForCheck();
        },
        error: () => {
          void this.alerts.error(
            this.translate.instant('TRANSPORT_BOOKING.ALERT_TRIP_NOT_FOUND'),
            this.translate.instant('TRANSPORT_BOOKING.ALERT_TRIP_NOT_FOUND_BODY'),
          );
          this.router.navigate(['/transport']);
        },
      });
    } else if (Number.isFinite(transportIdNum) && transportIdNum < 0) {
      // Synthetic transport (negative ID) not in store - redirect back
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_BOOKING.ALERT_TRIP_NOT_FOUND'),
        this.translate.instant('TRANSPORT_BOOKING.ALERT_TRIP_NOT_FOUND_BODY'),
      );
      this.router.navigate(['/transport']);
    } else if (selected) {
      this.transport.set(selected);
      this.applySeatCapacityValidators(selected);
      this.maybeRedirectEstimateOnly(selected);
    }

    const paid = this.route.snapshot.queryParamMap.get('paid');
    const paidRid = this.route.snapshot.queryParamMap.get('reservationId');
    const uidEarly = user
      ? ((user as { id?: number; userId?: number }).id ?? (user as { userId?: number }).userId)
      : null;
    if (paid === '1' && paidRid && uidEarly != null) {
      const prid = Number(paidRid);
      if (Number.isFinite(prid)) {
        this.dataSource.getTransportReservation(prid, uidEarly as number).subscribe({
          next: (existing) => {
            this.reservation.set(existing);
            this.activeStep.set(2);
            if (existing.status === 'CONFIRMED') {
              this.trackingSse.startJourneyTracking(existing.transportReservationId);
              this.loadBoardingQrPng(existing.transportReservationId);
            }
            this.cdr.markForCheck();
          },
          error: () => {
            void this.alerts.error(
              this.translate.instant('TRANSPORT_BOOKING.ALERT_PAID_LOAD'),
              this.translate.instant('TRANSPORT_BOOKING.ALERT_PAID_LOAD_BODY'),
            );
          },
        });
      }
    }

    if (editParam && user) {
      const rid = parseInt(editParam, 10);
      if (Number.isFinite(rid)) {
        this.dataSource.getTransportReservation(rid, (user as { id: number }).id).subscribe({
          next: (existing) => {
            if (Number.isFinite(transportIdNum) && existing.transportId != null && existing.transportId !== transportIdNum) {
              void this.alerts.warning(
                this.translate.instant('TRANSPORT_BOOKING.ALERT_DIFF_TRIP'),
                this.translate.instant('TRANSPORT_BOOKING.ALERT_DIFF_TRIP_BODY'),
              );
              void this.router.navigate(['/mes-reservations'], { queryParams: { tab: 'transport' } });
              return;
            }
            this.editingReservationId.set(existing.transportReservationId);
            const rawPhone = existing.passengerPhone ?? '';
            const phoneDigits = rawPhone.replace(/\+216\s*/, '').replace(/\D/g, '').slice(-8);
            this.passengerForm.patchValue({
              firstName: existing.passengerFirstName || '',
              lastName: existing.passengerLastName || '',
              email: existing.passengerEmail || '',
              phone: phoneDigits || this.passengerForm.get('phone')?.value,
              seats: existing.numberOfSeats || 1,
            });
            this.paymentMethod.set(existing.paymentMethod);
            this.paymentMethodValue = existing.paymentMethod;
            if (existing.travelDate) {
              this.store.setDates({ travelDate: existing.travelDate });
            }
            const t = this.transport();
            if (t) this.applySeatCapacityValidators(t);
            if (existing.status === 'CONFIRMED') {
              this.loadBoardingQrPng(existing.transportReservationId);
            }
            this.cdr.markForCheck();
          },
          error: () => {
            void this.alerts.error(
              this.translate.instant('TRANSPORT_BOOKING.ALERT_BOOKING_NOT_FOUND'),
              this.translate.instant('TRANSPORT_BOOKING.ALERT_BOOKING_NOT_FOUND_BODY'),
            );
            void this.router.navigate(['/mes-reservations'], { queryParams: { tab: 'transport' } });
          },
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.revokeBoardingQrUrl();
  }

  private revokeBoardingQrUrl(): void {
    const u = this.qrBoardingImageUrl();
    if (u) {
      URL.revokeObjectURL(u);
      this.qrBoardingImageUrl.set(null);
    }
  }

  private loadBoardingQrPng(reservationId: number): void {
    this.revokeBoardingQrUrl();
    this.http.get(`/api/tickets/${reservationId}/qr`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.qrBoardingImageUrl.set(url);
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      },
    });
  }

  goToStep2(): void {
    if (this.passengerForm.valid) {
      this.activeStep.set(1);
    } else {
      this.passengerForm.markAllAsTouched();
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_BOOKING.ALERT_CHECK_PASS'),
        this.translate.instant('TRANSPORT_BOOKING.ALERT_CHECK_PASS_BODY'),
      );
    }
  }

  /**
   * Events module pattern: POST checkout-session then full-page navigation to the returned URL (Stripe hosted or return path).
   */
  private redirectToCheckoutUrl(url: string): void {
    const trimmed = (url ?? '').trim();
    if (!trimmed) {
      void this.alerts.error(
        this.translate.instant('TRANSPORT_BOOKING.ALERT_CHECKOUT'),
        this.translate.instant('TRANSPORT_BOOKING.ALERT_CHECKOUT_INVALID'),
      );
      return;
    }
    window.location.href = new URL(trimmed, window.location.origin).href;
  }

  confirmBooking(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.loginPrompt.show({
        title: this.translate.instant('TRANSPORT_BOOKING.LOGIN_TITLE'),
        message: this.translate.instant('TRANSPORT_BOOKING.LOGIN_MSG'),
        returnUrl: this.router.url,
      });
      return;
    }

    const t = this.transport();
    if (!t) return;

    const syntheticOffer = this.buildSyntheticFlightOfferPayload(t);
    // Only require synthetic flight offer for flight bookings (PLANE type with negative ID)
    // Car rentals (CAR type) can have negative IDs but don't need flight offer payload
    if (t.id < 0 && t.type === 'PLANE' && !syntheticOffer) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_BOOKING.ALERT_SYNTHETIC_FLIGHT_TITLE'),
        this.translate.instant('TRANSPORT_BOOKING.ALERT_SYNTHETIC_FLIGHT_BODY'),
      );
      return;
    }

    const seats = this.passengerForm.get('seats')?.value ?? 1;
    const maxSeats = this.maxBookableSeats(t);
    if (seats > maxSeats) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_BOOKING.ALERT_NOT_ENOUGH_SEATS'),
        this.translate.instant('TRANSPORT_BOOKING.ALERT_NOT_ENOUGH_SEATS_BODY', { n: maxSeats }),
      );
      return;
    }

    const uid = (user as { id?: number; userId?: number }).id ?? (user as { userId?: number }).userId;
    const editId = this.editingReservationId();

    this.loading.set(true);

    if (editId != null) {
      this.dataSource
        .updateTransportReservation(editId, uid as number, {
          numberOfSeats: this.passengerForm.get('seats')?.value ?? 1,
          passengerFirstName: this.passengerForm.get('firstName')?.value ?? '',
          passengerLastName: this.passengerForm.get('lastName')?.value ?? '',
          passengerEmail: this.passengerForm.get('email')?.value ?? '',
          passengerPhone: '+216 ' + (this.passengerForm.get('phone')?.value ?? ''),
          paymentMethod: this.paymentMethod(),
        })
        .subscribe({
          next: (res) => {
            this.loading.set(false);
            this.reservation.set(res);
            if (res.status === 'CONFIRMED') {
              this.loadBoardingQrPng(res.transportReservationId);
            }
            this.activeStep.set(2);
          },
          error: (err) => {
            this.loading.set(false);
            void this.alerts.error(
              this.translate.instant('TRANSPORT_BOOKING.ALERT_UPDATE_FAIL'),
              typeof err?.error?.message === 'string' && err.error.message
                ? err.error.message
                : this.translate.instant('TRANSPORT_BOOKING.ALERT_UPDATE_FAIL_BODY'),
            );
          },
        });
      return;
    }

    if (this.paymentMethod() === 'STRIPE') {
      const travelDate = this.buildTravelDateTimeIso();
      if (!travelDate) {
        this.loading.set(false);
        void this.alerts.warning(
          this.translate.instant('TRANSPORT_BOOKING.ALERT_DATE'),
          this.translate.instant('TRANSPORT_BOOKING.ALERT_DATE_BODY'),
        );
        return;
      }
      const routeKm = ['TAXI', 'BUS', 'CAR'].includes(t.type) ? this.store.transportRouteKm() : undefined;
      const routeDurationMin = ['TAXI', 'BUS', 'CAR'].includes(t.type) ? this.store.transportRouteDurationMin() : undefined;
      if (t.type === 'TAXI' && (routeKm == null || routeKm <= 0)) {
        this.loading.set(false);
        void this.alerts.warning(
          this.translate.instant('TRANSPORT_BOOKING.ALERT_ROUTE_TITLE'),
          this.translate.instant('TRANSPORT_BOOKING.ALERT_TAXI_ROUTE_BODY'),
        );
        return;
      }
      const idempotencyKey = crypto.randomUUID();
      this.dataSource
        .createTransportCheckoutSession({
          transportId: t.id,
          numberOfSeats: seats,
          travelDate,
          routeKm: routeKm ?? undefined,
          routeDurationMin: routeDurationMin ?? undefined,
          rentalDays: t.type === 'CAR' ? this.store.transportRentalDays() : undefined,
          passengerFirstName: this.passengerForm.get('firstName')?.value ?? '',
          passengerLastName: this.passengerForm.get('lastName')?.value ?? '',
          passengerEmail: this.passengerForm.get('email')?.value ?? '',
          passengerPhone: '+216 ' + (this.passengerForm.get('phone')?.value ?? ''),
          idempotencyKey,
          presentmentCurrency: this.currency.selectedCode(),
          ...(syntheticOffer ? { syntheticFlightOffer: syntheticOffer } : {}),
        })
        .subscribe({
          next: (checkout) => {
            this.loading.set(false);
            this.redirectToCheckoutUrl(checkout.url ?? '');
          },
          error: (err: unknown) => {
            this.loading.set(false);
            const body = err && typeof err === 'object' && 'error' in err ? (err as { error?: unknown }).error : undefined;
            const msg =
              typeof body === 'object' && body !== null && 'message' in body
                ? String((body as { message?: string }).message)
                : typeof body === 'string'
                  ? body
                  : this.translate.instant('TRANSPORT_BOOKING.STRIPE_CHECKOUT_FAIL');
            void this.alerts.error(this.translate.instant('TRANSPORT_BOOKING.ALERT_STRIPE_FAIL'), msg);
          },
        });
      return;
    }

    if (this.paymentMethod() === 'PAYPAL') {
      const travelDate = this.buildTravelDateTimeIso();
      if (!travelDate) {
        this.loading.set(false);
        void this.alerts.warning(
          this.translate.instant('TRANSPORT_BOOKING.ALERT_DATE'),
          this.translate.instant('TRANSPORT_BOOKING.ALERT_DATE_BODY'),
        );
        return;
      }
      const routeKm = ['TAXI', 'BUS', 'CAR'].includes(t.type) ? this.store.transportRouteKm() : undefined;
      const routeDurationMin = ['TAXI', 'BUS', 'CAR'].includes(t.type) ? this.store.transportRouteDurationMin() : undefined;
      if (t.type === 'TAXI' && (routeKm == null || routeKm <= 0)) {
        this.loading.set(false);
        void this.alerts.warning(
          this.translate.instant('TRANSPORT_BOOKING.ALERT_ROUTE_TITLE'),
          this.translate.instant('TRANSPORT_BOOKING.ALERT_TAXI_ROUTE_BODY'),
        );
        return;
      }
      const amountTnd = this.calculateTotal();
      this.dataSource
        .createTransportPayPalSession({
          transportId: t.id,
          seats,
          travelDate,
          routeKm: routeKm ?? undefined,
          routeDurationMin: routeDurationMin ?? undefined,
          amountTnd,
          passengerFirstName: this.passengerForm.get('firstName')?.value ?? '',
          passengerLastName: this.passengerForm.get('lastName')?.value ?? '',
          passengerEmail: this.passengerForm.get('email')?.value ?? '',
          passengerPhone: '+216 ' + (this.passengerForm.get('phone')?.value ?? ''),
          ...(syntheticOffer ? { syntheticFlightOffer: syntheticOffer } : {}),
        })
        .subscribe({
          next: (checkout) => {
            this.loading.set(false);
            this.redirectToCheckoutUrl(checkout.url ?? '');
          },
          error: (err: unknown) => {
            this.loading.set(false);
            const body = err && typeof err === 'object' && 'error' in err ? (err as { error?: unknown }).error : undefined;
            const msg =
              typeof body === 'object' && body !== null && 'message' in body
                ? String((body as { message?: string }).message)
                : typeof body === 'string'
                  ? body
                  : this.translate.instant('TRANSPORT_BOOKING.PAYPAL_CHECKOUT_FAIL');
            void this.alerts.error(this.translate.instant('TRANSPORT_BOOKING.ALERT_PAYPAL_FAIL'), msg);
          },
        });
      return;
    }

    const idempotencyKey = crypto.randomUUID();

    this.dataSource
      .createTransportReservation({
        transportId: t.id,
        userId: uid as number,
        passengerFirstName: this.passengerForm.get('firstName')?.value ?? '',
        passengerLastName: this.passengerForm.get('lastName')?.value ?? '',
        passengerEmail: this.passengerForm.get('email')?.value ?? '',
        passengerPhone: '+216 ' + (this.passengerForm.get('phone')?.value ?? ''),
        numberOfSeats: this.passengerForm.get('seats')?.value ?? 1,
        paymentMethod: this.paymentMethod(),
        idempotencyKey,
        travelDate: this.buildTravelDateTimeIso() ?? undefined,
        routeKm: ['TAXI', 'BUS', 'CAR'].includes(t.type) ? (this.store.transportRouteKm() ?? undefined) : undefined,
        routeDurationMin: ['TAXI', 'BUS', 'CAR'].includes(t.type)
          ? (this.store.transportRouteDurationMin() ?? undefined)
          : undefined,
        rentalDays: t.type === 'CAR' ? this.store.transportRentalDays() : undefined,
        departureCityId: t.departureCityId || undefined,
        arrivalCityId: t.arrivalCityId || undefined,
        ...(syntheticOffer ? { syntheticFlightOffer: syntheticOffer } : {}),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.reservation.set(res);
          if (res.status === 'CONFIRMED') {
            this.trackingSse.startJourneyTracking(res.transportReservationId);
            this.loadBoardingQrPng(res.transportReservationId);
          }
          this.activeStep.set(2);
        },
        error: (err) => {
          this.loading.set(false);
          void this.alerts.error(
            this.translate.instant('TRANSPORT_BOOKING.ALERT_BOOKING_FAIL'),
            typeof err?.error?.message === 'string' && err.error.message
              ? err.error.message
              : this.translate.instant('TRANSPORT_BOOKING.ALERT_BOOKING_FAIL_BODY'),
          );
        },
      });
  }

  confirmButtonLabel(): string {
    const money = this.currency.formatDual(this.calculateTotal());
    if (this.editingReservationId() != null) {
      return this.translate.instant('TRANSPORT_BOOKING.BTN_UPDATE', { money });
    }
    if (this.paymentMethod() === 'STRIPE' || this.paymentMethod() === 'PAYPAL') {
      return this.translate.instant('TRANSPORT_BOOKING.BTN_PAY', { money });
    }
    return this.translate.instant('TRANSPORT_BOOKING.BTN_CONFIRM', { money });
  }

  /** Status chip on confirmation — brand palette only (no PrimeNG info blue). */
  statusPillClass(status: ReservationStatus): Record<string, boolean> {
    return {
      'conf-pill--ok': status === 'CONFIRMED',
      'conf-pill--pending': status === 'PENDING',
      'conf-pill--cancelled': status === 'CANCELLED',
    };
  }

  private maxBookableSeats(t: Transport): number {
    const cap = t.availableSeats ?? t.capacity ?? 20;
    return Math.min(20, Math.max(1, cap));
  }

  private applySeatCapacityValidators(t: Transport): void {
    const ctrl = this.passengerForm.get('seats');
    if (!ctrl) return;
    const max = this.maxBookableSeats(t);
    ctrl.setValidators([Validators.required, Validators.min(1), Validators.max(max)]);
    const current = ctrl.value ?? 1;
    if (current > max) {
      ctrl.patchValue(max, { emitEvent: false });
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /** PayPal charges in USD; estimate from cached FX when available. */
  paypalUsdFromTnd(): number {
    const total = this.calculateTotal();
    const usd = this.currency.rateFor('USD');
    if (usd != null && usd > 0) {
      return Math.round(total * usd * 100) / 100;
    }
    return Math.round(total * 0.32 * 100) / 100;
  }

  /** Approximate USD per 1 TND for the PayPal note (live snapshot or legacy 0.32). */
  paypalUsdPerTndDisplay(): string {
    const usd = this.currency.rateFor('USD');
    if (usd != null && usd > 0) {
      return usd.toFixed(4);
    }
    return '0.32';
  }

  calculateTotal(): number {
    const t = this.transport();
    const seats = this.passengerForm.get('seats')?.value ?? 1;
    if (!t) {
      return 0;
    }

    const km = this.store.transportRouteKm() ?? 0;
    const durationMin = this.routeDurationMinutesForPricing(km, t.durationMinutes ?? 0);

    if (t.type === 'TAXI') {
      let fare = 2 + km * 0.30 + durationMin * 0.05;
      if (this.isNightTravel()) {
        fare *= 1.1;
      }
      return Math.round(Math.max(3.5, fare) * 100) / 100;
    }
    if (t.type === 'BUS') {
      const perSeat = Math.max(1.5, 1.2 + km * 0.028 + durationMin * 0.0065);
      return Math.round(perSeat * Math.max(1, seats) * 100) / 100;
    }
    if (t.type === 'CAR') {
      const days = this.store.transportRentalDays() ?? 1;
      const safeDays = Math.max(1, days);
      const daily = Math.max(35, (t.price || 52) * 0.5);
      const extraKm = Math.max(0, km - safeDays * 160);
      return Math.round((daily * safeDays + extraKm * 0.07) * 100) / 100;
    }
    return Math.round(seats * t.price * 100) / 100;
  }

  private routeDurationMinutesForPricing(routeKm: number, fallbackDurationMin: number): number {
    const fromStore = this.store.transportRouteDurationMin();
    if (fromStore != null && fromStore > 0) {
      return fromStore;
    }
    if (fallbackDurationMin > 0) {
      return fallbackDurationMin;
    }
    if (routeKm <= 0) {
      return 0;
    }
    return Math.round((routeKm / 60) * 60);
  }

  private isNightTravel(): boolean {
    const travelDate = this.store.dates().travelDate;
    if (!travelDate) {
      return false;
    }
    const d = new Date(travelDate);
    if (Number.isNaN(d.getTime())) {
      return false;
    }
    const hour = d.getHours();
    return hour >= 22 || hour < 6;
  }

  private buildTravelDateTimeIso(): string | null {
    const dateStr = this.store.dates().travelDate;
    const t = this.transport();
    if (!dateStr || !t?.departureTime) {
      return null;
    }
    if (dateStr.includes('T')) {
      const user = new Date(dateStr);
      if (Number.isNaN(user.getTime())) {
        return null;
      }
      const y = user.getFullYear();
      const mo = String(user.getMonth() + 1).padStart(2, '0');
      const day = String(user.getDate()).padStart(2, '0');
      const h = String(user.getHours()).padStart(2, '0');
      const m = String(user.getMinutes()).padStart(2, '0');
      const s = String(user.getSeconds()).padStart(2, '0');
      return `${y}-${mo}-${day}T${h}:${m}:${s}`;
    }
    const dep = new Date(t.departureTime);
    const h = String(dep.getHours()).padStart(2, '0');
    const m = String(dep.getMinutes()).padStart(2, '0');
    const s = String(dep.getSeconds()).padStart(2, '0');
    return `${dateStr}T${h}:${m}:${s}`;
  }

  /** Payload for API when booking a flight-search row (negative transport id). */
  private buildSyntheticFlightOfferPayload(t: Transport): SyntheticFlightOfferPayload | null {
    if (t.id >= 0) {
      return null;
    }
    const o = t.syntheticFlightOffer;
    if (!o) {
      return null;
    }
    return {
      operatorName: (o.operatorName ?? 'Airline').trim() || 'Airline',
      flightCode: o.flightCode,
      departureIata: o.departureIata,
      arrivalIata: o.arrivalIata,
      pricePerSeatTnd: t.price,
      departureTimeIso: o.departureTimeIso ?? t.departureTime,
      arrivalTimeIso: o.arrivalTimeIso ?? t.arrivalTime,
      description: (o.description ?? t.description)?.trim(),
      quoteOriginalAmount: o.quoteOriginalAmount,
      quoteOriginalCurrency: o.quoteOriginalCurrency,
    };
  }

  /**
   * Taxi and bus are quote-only: deep links to /transport/:id/book must land on the estimate page.
   */
  private maybeRedirectEstimateOnly(t: Transport): void {
    if (t.type !== 'TAXI' && t.type !== 'BUS') {
      return;
    }
    if (this.route.snapshot.queryParamMap.get('edit')) {
      return;
    }
    if (this.route.snapshot.queryParamMap.get('paid') === '1') {
      return;
    }
    const q: Record<string, string> = { ...(this.route.snapshot.queryParams as Record<string, string>) };
    q['from'] = String(t.departureCityId);
    q['to'] = String(t.arrivalCityId);
    q['transportType'] = t.type;
    const td = this.store.dates().travelDate;
    if (!q['date'] && td) {
      q['date'] = td;
    }
    if (!q['passengers']) {
      q['passengers'] = String(Math.max(1, this.store.pax().adults || 1));
    }
    void this.router.navigate(['/transport/estimate'], { queryParams: q });
  }

  goBack() { this.router.navigate(['/transport/results'], { queryParams: this.route.snapshot.queryParams }); }

  /** Provider list price (e.g. EUR); payable TND is shown via dualCurrency on {@code t.price}. */
  syntheticQuoteLabel(t: Transport): string | null {
    const o = t.syntheticFlightOffer;
    if (!o?.quoteOriginalCurrency || o.quoteOriginalAmount == null) {
      return null;
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: o.quoteOriginalCurrency.trim().toUpperCase(),
        maximumFractionDigits: 2,
      }).format(o.quoteOriginalAmount);
    } catch {
      return `${o.quoteOriginalAmount} ${o.quoteOriginalCurrency}`;
    }
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatTravelDate(date: string | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  transportTypeLabelKey(raw: string | undefined): string {
    const u = (raw ?? 'BUS').toString().toUpperCase();
    return `TRANSPORT.TYPE.${u}`;
  }

  getTypeEmoji(type: string): string {
    const map: Record<string, string> = { BUS: '\uD83D\uDE8C', VAN: '\uD83D\uDE90', TAXI: '\uD83D\uDE95', CAR: '\uD83D\uDE97', PLANE: '\u2708\uFE0F', TRAIN: '\uD83D\uDE86', FERRY: '\u26F4\uFE0F' };
    return map[type] ?? '';
  }
}
