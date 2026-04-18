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
import { LoginRequiredPromptService } from '../../../core/login-required-prompt.service';
import {
  AccommodationRoomCategory,
  nightlyRateForCategory,
} from '../../../core/utils/accommodation-quote.util';
import { CurrencyService } from '../../../core/services/currency.service';
import { DualCurrencyPipe } from '../../../core/pipes/dual-currency.pipe';
import { createCurrencyDisplaySyncEffect } from '../../../core/utils/currency-display-sync';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, DualCurrencyPipe, TranslateModule],
  template: `
    <div class="page-container">
      <div class="booking-wrapper" [class.confirmation-mode]="step() === 3">
        @if (editingReservationId() != null) {
          <div class="heb-edit-banner" role="status">
            <i class="pi pi-pencil" aria-hidden="true"></i>
            <span>{{ 'ACCOMM.EDIT_BANNER' | translate }}</span>
          </div>
        }

        <!-- Left Panel: Reservation Form -->
        <div class="form-panel">

          <!-- Stepper -->
          <div class="stepper">
            @for (s of steps; track s.num) {
              <div class="step-item" [class.active]="step() === s.num" [class.done]="step() > s.num">
                <div class="step-circle">{{ step() > s.num ? '✓' : s.num }}</div>
                <span>{{ s.labelKey | translate }}</span>
              </div>
              @if (!$last) { <div class="step-line" [class.filled]="step() > s.num"></div> }
            }
          </div>

          <!-- Step 1: Guest Info -->
          @if (step() === 1) {
            <div class="step-content">
              <h2 class="step-h2"><i class="pi pi-user step-h2-ico"></i> {{ 'ACCOMM.GUEST_DETAILS_TITLE' | translate }}</h2>
              <form [formGroup]="guestForm" (ngSubmit)="nextStep()">
                <div class="form-row">
                  <div class="form-field">
                    <label>{{ 'ACCOMM.LABEL_FIRST_NAME' | translate }}</label>
                    <input type="text" formControlName="firstName" [placeholder]="'ACCOMM.PH_FIRST_NAME' | translate">
                    @if (guestForm.get('firstName')?.invalid && guestForm.get('firstName')?.touched) {
                      <span class="field-error">{{ 'ACCOMM.ERR_MIN_CHARS' | translate }}</span>
                    }
                  </div>
                  <div class="form-field">
                    <label>{{ 'ACCOMM.LABEL_LAST_NAME' | translate }}</label>
                    <input type="text" formControlName="lastName" [placeholder]="'ACCOMM.PH_LAST_NAME' | translate">
                    @if (guestForm.get('lastName')?.invalid && guestForm.get('lastName')?.touched) {
                      <span class="field-error">{{ 'ACCOMM.ERR_MIN_CHARS' | translate }}</span>
                    }
                  </div>
                </div>
                <div class="form-field">
                  <label>{{ 'ACCOMM.LABEL_EMAIL' | translate }}</label>
                  <input type="email" formControlName="email" [placeholder]="'ACCOMM.PH_EMAIL' | translate">
                  @if (guestForm.get('email')?.invalid && guestForm.get('email')?.touched) {
                    <span class="field-error">{{ 'ACCOMM.ERR_EMAIL' | translate }}</span>
                  }
                </div>
                <div class="form-field">
                  <label>{{ 'ACCOMM.LABEL_PHONE_OPT' | translate }}</label>
                  <input type="tel" formControlName="phone" [placeholder]="'ACCOMM.PH_PHONE' | translate">
                  @if (guestForm.get('phone')?.invalid && guestForm.get('phone')?.touched) {
                    <span class="field-error">{{ 'ACCOMM.ERR_PHONE' | translate }}</span>
                  }
                </div>
                <div class="form-field">
                  <label>{{ 'ACCOMM.LABEL_SPECIAL_OPT' | translate }}</label>
                  <textarea formControlName="notes" [placeholder]="'ACCOMM.PH_SPECIAL' | translate"></textarea>
                </div>
                <div class="step-actions">
                  <button type="button" class="btn-ghost" (click)="goBack()">{{ 'ACCOMM.BTN_BACK' | translate }}</button>
                  <button type="submit" class="btn-primary" [disabled]="guestForm.invalid">
                    {{ 'ACCOMM.BTN_CONTINUE' | translate }}
                  </button>
                </div>
              </form>
            </div>
          }

          <!-- Step 2: Summary & Payment -->
          @if (step() === 2) {
            <div class="step-content">
              <h2 class="step-h2"><img src="icones/money-bag.png" alt="" class="step-h2-img" width="24" height="24" /> {{ 'ACCOMM.SUMMARY_PAYMENT_TITLE' | translate }}</h2>

              <div class="summary-box">
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_GUEST' | translate }}</span>
                  <strong>{{ guestForm.value.firstName }} {{ guestForm.value.lastName }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_EMAIL' | translate }}</span>
                  <strong>{{ guestForm.value.email }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_PROPERTY' | translate }}</span>
                  <strong>{{ store.selectedAccommodation()?.name }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_CITY' | translate }}</span>
                  <strong>{{ store.selectedAccommodation()?.cityName }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_CHECKIN' | translate }}</span>
                  <strong>{{ store.dates().checkIn }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_CHECKOUT' | translate }}</span>
                  <strong>{{ store.dates().checkOut }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_STAY_LEN' | translate }}</span>
                  <strong>{{ nightCount() }} {{ 'ACCOMM.NIGHTS_UNIT' | translate }}</strong>
                </div>
                <div class="summary-row">
                  <span>{{ 'ACCOMM.SUM_ROOM' | translate }}</span>
                  <strong>{{ selectedRoomLabel() }}</strong>
                </div>
                <hr class="sum-divider">
                <div class="summary-row price-row">
                  <span>{{ quoteNightly() | dualCurrency }} {{ 'ACCOMM.X_NIGHTS' | translate: { n: nightCount() } }}</span>
                  <span>{{ baseTotal() | dualCurrency }}</span>
                </div>
                <div class="summary-row price-row">
                  <span>{{ 'ACCOMM.TAXES_PCT' | translate }}</span>
                  <span>{{ taxAmount() | dualCurrency }}</span>
                </div>
                <div class="summary-row total-row">
                  <strong>{{ 'ACCOMM.TOTAL_DUE' | translate }}</strong>
                  <strong class="total-amount">{{ grandTotal() | dualCurrency }}</strong>
                </div>
              </div>

              @if (editingReservationId() === null) {
                <div class="payment-section">
                  <h3 class="pay-title">
                    <img src="icones/money-bag.png" alt="" class="pay-title-ico" width="22" height="22" />
                    {{ 'ACCOMM.SECURE_PAYMENT' | translate }}
                  </h3>
                  <div class="payment-flow-hint" role="note">
                    <p class="payment-flow-hint__text">{{ 'ACCOMM.PAYMENT_FLOW' | translate }}</p>
                  </div>
                </div>
              } @else {
                <p class="secure-note edit-pay-note">
                  <i class="pi pi-info-circle secure-note-ico"></i>
                  {{ 'ACCOMM.EDIT_PAY_NOTE' | translate }}
                </p>
              }

              <div class="step-actions">
                <button type="button" class="btn-ghost" (click)="step.set(1)">{{ 'ACCOMM.BTN_EDIT' | translate }}</button>
                <button type="button" class="btn-primary" (click)="confirmBooking()" [disabled]="payButtonDisabled()">
                  @if (loading()) { <span class="spinner-sm"></span> {{ 'ACCOMM.PROCESSING' | translate }} }
                  @else if (editingReservationId() != null) { <i class="pi pi-save"></i> {{ 'ACCOMM.UPDATE_BOOKING' | translate }} }
                  @else { <i class="pi pi-check-circle"></i> {{ 'ACCOMM.PAY_CONFIRM' | translate }} }
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
              <h2 class="conf-title-heb">{{ (editingReservationId() != null ? 'ACCOMM.CONF_TITLE_UPDATE' : 'ACCOMM.CONF_TITLE_BOOKED') | translate }}</h2>
              <p class="conf-desc">
                @if (editingReservationId() != null) {
                  {{ 'ACCOMM.CONF_DESC_UPDATE' | translate: { name: store.selectedAccommodation()?.name ?? '' } }}
                } @else {
                  {{ 'ACCOMM.CONF_DESC_BOOKED' | translate: { name: store.selectedAccommodation()?.name ?? '' } }}
                }
              </p>
              <div class="conf-welcome">
                <span class="conf-wave"><i class="pi pi-heart-fill"></i></span>
                <p class="conf-welcome-msg">{{ 'ACCOMM.CONF_THANKS' | translate: { name: guestForm.value.firstName ?? '' } }}</p>
              </div>
              <p class="conf-email">{{ 'ACCOMM.CONF_EMAIL_SENT' | translate: { email: guestForm.value.email ?? '' } }}</p>
              <div class="conf-actions">
                <button class="btn-ghost" (click)="router.navigate(['/'])"><img src="icones/home.png" alt="" class="btn-ico" width="18" height="18" /> {{ 'ACCOMM.BTN_HOME' | translate }}</button>
                <button class="btn-primary" (click)="router.navigate(['/transport'])"><img src="icones/autobus.png" alt="" class="btn-ico" width="18" height="18" /> {{ 'ACCOMM.BTN_TRANSPORT' | translate }}</button>
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
                  <span class="date-lbl">{{ 'ACCOMM.CHECK_IN_UC' | translate }}</span>
                  <span class="date-val">{{ store.dates().checkIn || '—' }}</span>
                </div>
                <div class="nights-block">{{ nightCount() }} <span>{{ 'ACCOMM.NIGHTS_MID' | translate }}</span></div>
                <div class="date-block">
                  <span class="date-lbl">{{ 'ACCOMM.CHECK_OUT_UC' | translate }}</span>
                  <span class="date-val">{{ store.dates().checkOut || '—' }}</span>
                </div>
              </div>
              <div class="stay-total">
                <span>{{ 'ACCOMM.ESTIMATED_TOTAL' | translate }}</span>
                <strong>{{ grandTotal() | dualCurrency }}</strong>
              </div>
            </div>

            <!-- Guarantees -->
            <div class="guarantees">
              <div class="guarantee-item"><i class="pi pi-check-circle g-ico"></i><span>{{ 'ACCOMM.GUARANTEE_FLEX' | translate }}</span></div>
              <div class="guarantee-item"><i class="pi pi-lock g-ico"></i><span>{{ 'ACCOMM.GUARANTEE_SECURE' | translate }}</span></div>
              <div class="guarantee-item"><i class="pi pi-star-fill g-ico"></i><span>{{ 'ACCOMM.GUARANTEE_PRICE' | translate }}</span></div>
              <div class="guarantee-item"><i class="pi pi-phone g-ico"></i><span>{{ 'ACCOMM.GUARANTEE_SUPPORT' | translate }}</span></div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 2rem; min-height: 100vh; background: var(--bg-color); color: var(--text-color); }
    .booking-wrapper { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; max-width: 1100px; margin: 0 auto; align-items: start; }
    .booking-wrapper.confirmation-mode { grid-template-columns: 1fr; max-width: 680px; }

    /* Stepper */
    .stepper { display: flex; align-items: center; margin-bottom: 2.5rem; }
    .step-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .step-circle { width: 36px; height: 36px; border-radius: 50%; background: var(--surface-2); border: 2px solid var(--border-soft); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; color: var(--text-muted); transition: all 0.3s; }
    .step-item.active .step-circle { background: var(--tunisia-red); border-color: var(--tunisia-red); color: #fff; box-shadow: 0 0 15px var(--tunisia-red-glow); }
    .step-item.done .step-circle { background: var(--tunisia-red); border-color: var(--tunisia-red); color: #fff; }
    .step-item span { font-size: 0.78rem; color: var(--text-muted); }
    .step-item.active span { color: var(--text-color); }
    .step-line { flex: 1; height: 2px; background: var(--border-soft); margin: 0 8px; position: relative; top: -10px; transition: background 0.3s; }
    .step-line.filled { background: var(--tunisia-red); }

    /* Form Panel */
    .form-panel { background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 20px; padding: 2.5rem; box-shadow: var(--shadow-soft); }
    .step-content h2 { font-size: 1.5rem; color: var(--text-color); margin-bottom: 2rem; }
    .step-h2 { display: flex; align-items: center; gap: 10px; }
    .step-h2-ico { font-size: 1.35rem; color: var(--tunisia-red); opacity: 0.85; }
    .step-h2-img { object-fit: contain; flex-shrink: 0; }
    .pay-h3 { display: flex; align-items: center; gap: 8px; }
    .pay-h3-ico { font-size: 1rem; color: var(--text-muted); }
    .secure-note { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .secure-note-ico { font-size: 0.95rem; color: var(--text-muted); }
    .btn-ico { object-fit: contain; vertical-align: middle; margin-right: 6px; }
    .stay-type-badge { display: inline-flex; align-items: center; gap: 6px; }
    .stay-type-ico { object-fit: contain; }
    .stay-city { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--text-muted); margin-bottom: 6px; }
    .stay-city-ico { object-fit: contain; opacity: 0.85; flex-shrink: 0; }
    .g-ico { font-size: 1.1rem; color: var(--tunisia-red); flex-shrink: 0; }
    .conf-wave { display: flex; align-items: center; color: var(--tunisia-red); font-size: 1.25rem; }

    /* Form Fields */
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.2rem; }
    .form-field label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
    input, textarea, select {
      background: var(--input-bg); border: 1px solid var(--border-soft); border-radius: 10px;
      padding: 12px 14px; color: var(--text-color); font-size: 0.95rem; outline: none;
      transition: border-color 0.2s; width: 100%;
    }
    input:focus, textarea:focus { border-color: var(--tunisia-red); }
    textarea { height: 90px; resize: none; }
    .field-error { font-size: 0.78rem; color: var(--tunisia-red); }

    /* Actions */
    .step-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; }
    .btn-primary { padding: 13px 30px; background: var(--tunisia-red); color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
    .btn-primary:hover:not([disabled]) { filter: brightness(1.06); }
    .btn-primary[disabled] { opacity: 0.5; cursor: not-allowed; }
    .btn-ghost { background: none; border: 1px solid var(--border-soft); color: var(--text-color); padding: 13px 20px; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
    .btn-ghost:hover { border-color: var(--tunisia-red); color: var(--text-color); }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid var(--border-soft); border-top-color: var(--tunisia-red); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Summary Box */
    .summary-box { background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 0.9rem; color: var(--text-muted); }
    .summary-row strong { color: var(--text-color); }
    .sum-divider { border: none; border-top: 1px solid var(--border-soft); margin: 8px 0; }
    .price-row span { color: var(--text-muted); }
    .total-row { margin-top: 4px; font-size: 1.05rem; }
    .total-amount { color: var(--tunisia-red); font-size: 1.4rem; }

    /* Payment */
    .payment-section { margin-bottom: 2rem; }
    .pay-title { display: flex; align-items: center; gap: 10px; color: var(--text-color); font-size: 0.95rem; margin: 0 0 1rem 0; font-weight: 600; }
    .pay-title-ico { object-fit: contain; flex-shrink: 0; }
    .card-mock { background: linear-gradient(135deg, #1a0a14, #3d1828); border-radius: 14px; padding: 1.5rem; color: #fff; position: relative; box-shadow: 0 8px 20px rgba(241,37,69,0.2); }
    .card-chip { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .card-number { font-family: monospace; font-size: 1.3rem; letter-spacing: 3px; margin-bottom: 1rem; }
    .card-footer { display: flex; justify-content: space-between; opacity: 0.7; font-size: 0.85rem; }
    .secure-note { font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 0.75rem; }
    .edit-pay-note { margin-top: 1rem; }
    .payment-flow-hint {
      font-size: 0.85rem; color: var(--text-muted); line-height: 1.55; margin: 0 0 1rem 0;
    }
    .payment-flow-hint__text { margin: 0; white-space: pre-line; }
    .stripe-card-field { margin-bottom: 0.5rem; }
    .stripe-card-input { font-family: ui-monospace, monospace; letter-spacing: 0.04em; }

    /* Confirmation */
    .confirmation { text-align: center; padding: 2.5rem 1.5rem; }
    .conf-icon-wrap { margin-bottom: 1.5rem; }
    .conf-circle-heb {
      width: 76px; height: 76px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, var(--tunisia-red), #ff6b6b);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 32px var(--tunisia-red-glow);
      animation: pop 0.45s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .conf-check { font-size: 2rem; color: #fff; }
    .conf-title-heb { font-size: 2rem; font-weight: 800; color: var(--text-color); margin: 0 0 0.6rem; letter-spacing: -0.02em; }
    .conf-desc { color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem; }
    .conf-welcome {
      display: flex; align-items: center; gap: 0.75rem; justify-content: center;
      background: color-mix(in srgb, var(--tunisia-red) 8%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 22%, var(--border-soft));
      border-radius: 14px; padding: 1rem 1.5rem; margin-bottom: 1rem;
    }
    .conf-wave { font-size: 1.6rem; }
    .conf-welcome-msg { font-size: 1rem; color: var(--text-color); margin: 0; }
    .conf-welcome-msg strong { color: var(--text-color); font-weight: 700; }
    .conf-email { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0; }
    .conf-email strong { color: var(--text-color); }
    .conf-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }

    /* Stay Card (Right Panel) */
    .summary-panel { display: flex; flex-direction: column; gap: 1.5rem; }
    .stay-card { background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 20px; overflow: hidden; box-shadow: var(--shadow-soft); }
    .stay-img { height: 140px; display: flex; align-items: center; justify-content: center; position: relative; }
    .stay-type-badge { background: color-mix(in srgb, var(--tunisia-red) 92%, #000); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }
    .stay-info { padding: 1.2rem 1.5rem 0; }
    .stay-info h3 { color: var(--text-color); font-size: 1.1rem; margin: 0 0 4px 0; }
    .stay-rating { font-size: 0.9rem; color: #f1c40f; }
    .stay-rating span { color: var(--text-muted); margin-left: 4px; }
    .stay-dates { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; background: var(--surface-2); margin: 1rem 0 0 0; }
    .date-block { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .date-lbl { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .date-val { font-size: 0.95rem; color: var(--text-color); font-weight: 600; }
    .nights-block { font-size: 1.4rem; font-weight: 800; color: var(--tunisia-red); text-align: center; display: flex; flex-direction: column; align-items: center; }
    .nights-block span { font-size: 0.7rem; color: var(--text-muted); font-weight: 400; }
    .stay-total { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-top: 1px solid var(--border-soft); }
    .stay-total span { color: var(--text-muted); font-size: 0.9rem; }
    .stay-total strong { color: var(--tunisia-red); font-size: 1.3rem; }

    /* Guarantees */
    .guarantees { background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-soft); }
    .guarantee-item { display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: var(--text-color); }

    .heb-edit-banner {
      grid-column: 1 / -1;
      display: flex; align-items: flex-start; gap: 0.6rem;
      padding: 0.85rem 1rem; margin-bottom: 0.5rem; border-radius: 14px;
      background: color-mix(in srgb, var(--tunisia-red) 10%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 28%, var(--border-soft));
      font-size: 0.88rem; color: var(--text-color); line-height: 1.45;
    }
    .heb-edit-banner .pi { color: var(--tunisia-red); margin-top: 2px; }

    @media (max-width: 900px) {
      .booking-wrapper { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
    }
  `]
})
export class AccommodationBookingPageComponent implements OnInit {
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();
  private readonly currency = inject(CurrencyService);

  fb = inject(FormBuilder);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  router = inject(Router);
  route = inject(ActivatedRoute);
  auth = inject(AuthService);
  private loginPrompt = inject(LoginRequiredPromptService);
  private alerts = inject(AppAlertsService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  step = signal(1);
  loading = signal(false);
  reservationId = signal('');
  /** My bookings → Edit: PATCH stay dates instead of creating a new reservation. */
  editingReservationId = signal<number | null>(null);
  /** Locked room when editing (from query). */
  editingRoomId = signal<number | null>(null);

  steps = [
    { num: 1, labelKey: 'ACCOMM.STEP_GUEST' },
    { num: 2, labelKey: 'ACCOMM.STEP_PAYMENT' },
    { num: 3, labelKey: 'ACCOMM.STEP_DONE' },
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
    const cat = this.store.accommodationRoomCategory();
    const key =
      cat === 'SINGLE' ? 'ACCOMM.ROOM_SINGLE' : cat === 'DOUBLE' ? 'ACCOMM.ROOM_DOUBLE' : 'ACCOMM.ROOM_SUITE';
    return this.translate.instant(key);
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
            void this.alerts.error(
              this.translate.instant('ACCOMM.ERR_RES_LOAD_TITLE'),
              this.translate.instant('ACCOMM.ERR_RES_LOAD_TEXT')
            );
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
    if (quoted != null && (!acc.rooms || acc.rooms.length === 0)) {
      return { id: quoted };
    }
    if (quoted != null && acc.rooms?.some((r) => r.id === quoted && r.available !== false)) {
      return { id: quoted };
    }
    return this.pickRoom(acc);
  }

  nextStep() {
    if (!this.guestForm.valid) {
      this.guestForm.markAllAsTouched();
      void this.alerts.warning(
        this.translate.instant('ACCOMM.WARN_GUEST_TITLE'),
        this.translate.instant('ACCOMM.WARN_GUEST_TEXT')
      );
      return;
    }
    const ci = this.store.dates().checkIn;
    const co = this.store.dates().checkOut;
    if (!ci || !co) {
      void this.alerts.warning(
        this.translate.instant('ACCOMM.WARN_STAY_DATES_TITLE'),
        this.translate.instant('ACCOMM.WARN_STAY_DATES_TEXT')
      );
      return;
    }
    if (new Date(co) <= new Date(ci)) {
      void this.alerts.warning(
        this.translate.instant('ACCOMM.WARN_DATES_ORDER_TITLE'),
        this.translate.instant('ACCOMM.WARN_DATES_ORDER_TEXT')
      );
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
      this.loginPrompt.show({
        title: 'Sign in to reserve accommodation',
        message: 'Please sign in or create an account to confirm this accommodation booking.',
        returnUrl: this.router.url,
      });
      return;
    }

    const acc = this.store.selectedAccommodation();
    if (!acc) {
      void this.alerts.error(
        this.translate.instant('ACCOMM.ERR_NO_PROPERTY_TITLE'),
        this.translate.instant('ACCOMM.ERR_NO_PROPERTY_TEXT')
      );
      return;
    }

    const ci = this.store.dates().checkIn;
    const co = this.store.dates().checkOut;
    if (!ci || !co || new Date(co) <= new Date(ci)) {
      void this.alerts.warning(
        this.translate.instant('ACCOMM.WARN_STAY_INVALID_TITLE'),
        this.translate.instant('ACCOMM.WARN_STAY_INVALID_TEXT')
      );
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
        this.translate.instant('ACCOMM.ERR_NO_ROOM_TITLE'),
        this.translate.instant('ACCOMM.ERR_NO_ROOM_TEXT')
      );
      return;
    }

    const total = this.grandTotal();
    const totalLabel = this.currency.formatDual(total);
    const confirm = await this.alerts.confirm({
      title: this.translate.instant('ACCOMM.PAY_CONFIRM_TITLE'),
      html: `<p style="margin:0;text-align:left">${this.translate.instant('ACCOMM.PAY_CONFIRM_HTML', { amount: totalLabel })}</p>`,
      confirmText: this.translate.instant('ACCOMM.BTN_CONTINUE_PAY'),
      cancelText: this.translate.instant('COMMUNITY.CANCEL'),
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
        guestCount: 1,
        checkIn: ci.slice(0, 10),
        checkOut: co.slice(0, 10),
        offerId: null,
        presentmentCurrency: this.currency.selectedCode(),
      })
      .subscribe({
        next: (checkout) => {
          this.loading.set(false);
          this.cdr.markForCheck();
          const url = (checkout.url ?? '').trim();
          if (!url) {
            void this.alerts.error(
              this.translate.instant('ACCOMM.ERR_CHECKOUT_TITLE'),
              this.translate.instant('ACCOMM.ERR_CHECKOUT_INVALID')
            );
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
          void this.alerts.error(
            this.translate.instant('ACCOMM.ERR_CHECKOUT_TITLE'),
            this.translate.instant('ACCOMM.ERR_CHECKOUT_INVALID')
          );
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
                : this.translate.instant('ACCOMM.ERR_PAYMENT_START');
          void this.alerts.error(this.translate.instant('ACCOMM.ERR_CHECKOUT_TITLE'), msg);
        },
      });
  }

  /** Picks a bookable room for the API (requires real roomId from backend). */
  private pickRoom(acc: Accommodation): { id: number } | null {
    const rooms = acc.rooms ?? [];
    if (rooms.length === 0) return null;
    const pool = rooms.filter((r) => r.available !== false);
    const candidates = pool.length > 0 ? pool : rooms;
    const sorted = [...candidates].sort((a, b) => (a.price ?? acc.pricePerNight) - (b.price ?? acc.pricePerNight));
    const chosen = sorted[0];
    return chosen?.id != null ? { id: chosen.id } : null;
  }

  formatType(type?: string): string {
    if (!type) return '';
    const key = `ACCOMM.TYPE_${type}`;
    const t = this.translate.instant(key);
    return t !== key ? t : type;
  }

  typeIconSrc(type?: string): string {
    if (type === 'HOTEL') return 'icones/hotel.png';
    return 'icones/home.png';
  }

  getStars(rating: number): string {
    return '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');
  }
}
