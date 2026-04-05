import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { RadioButtonModule } from 'primeng/radiobutton';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { RippleModule } from 'primeng/ripple';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AuthService } from '../../../core/auth.service';
import { Transport, TransportReservation, TRANSPORT_TYPE_META, TransportType } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    StepperModule, ButtonModule, InputTextModule,
    InputMaskModule, RadioButtonModule, DividerModule,
    TagModule, RippleModule,
  ],
  template: `
    <div class="bp">
      <div class="bp-wrap">

        <!-- Stepper — PrimeNG v18 API -->
        <div class="stepper-wrap">
          <p-stepper [linear]="true" [(value)]="activeStepValue">

            <p-step-list>
              <p-step [value]="1">Passengers</p-step>
              <p-step [value]="2">Payment</p-step>
              <p-step [value]="3">Confirmation</p-step>
            </p-step-list>

            <p-step-panels>

              <!-- ═══ Step 1: Passenger ═══ -->
              <p-step-panel [value]="1">
                <ng-template #content let-activateCallback="activateCallback">
                  <div class="step">
                    <!-- Inline trip summary -->
                    @if (transport(); as t) {
                      <div class="trip-inline">
                        <span class="trip-emoji">{{ getTypeEmoji(t.type) }}</span>
                        <div class="trip-detail">
                          <span class="trip-route">{{ t.departureCityName }} → {{ t.arrivalCityName }}</span>
                          <span class="trip-meta">{{ getTypeLabel(t.type) }} · {{ formatTime(t.departureTime) }} – {{ formatTime(t.arrivalTime) }} · {{ passengerForm.get('seats')?.value }} seat(s)</span>
                        </div>
                        <span class="trip-price">{{ t.price }} <small>TND</small></span>
                      </div>
                    }

                    <div class="step-head">
                      <h2>Passenger details</h2>
                      <p>Primary traveller contact information</p>
                    </div>

                    <form [formGroup]="passengerForm" class="f">
                      <!-- Name Row -->
                      <div class="f-row">
                        <div class="f-group">
                          <label class="f-label"><i class="pi pi-user"></i> First name</label>
                          <div class="f-input-wrap" [class.f-error]="passengerForm.get('firstName')?.invalid && passengerForm.get('firstName')?.touched">
                            <input pInputText formControlName="firstName" placeholder="First name" class="f-input" />
                          </div>
                          @if (passengerForm.get('firstName')?.invalid && passengerForm.get('firstName')?.touched) {
                            <small class="f-err-msg">First name is required (min. 2 characters)</small>
                          }
                        </div>
                        <div class="f-group">
                          <label class="f-label"><i class="pi pi-user"></i> Last name</label>
                          <div class="f-input-wrap" [class.f-error]="passengerForm.get('lastName')?.invalid && passengerForm.get('lastName')?.touched">
                            <input pInputText formControlName="lastName" placeholder="Last name" class="f-input" />
                          </div>
                          @if (passengerForm.get('lastName')?.invalid && passengerForm.get('lastName')?.touched) {
                            <small class="f-err-msg">Last name is required (min. 2 characters)</small>
                          }
                        </div>
                      </div>

                      <!-- Email + Phone Row -->
                      <div class="f-row">
                        <div class="f-group">
                          <label class="f-label"><i class="pi pi-envelope"></i> Email</label>
                          <div class="f-input-wrap" [class.f-error]="passengerForm.get('email')?.invalid && passengerForm.get('email')?.touched">
                            <input pInputText formControlName="email" placeholder="votre@email.com" class="f-input" />
                          </div>
                          @if (passengerForm.get('email')?.invalid && passengerForm.get('email')?.touched) {
                            <small class="f-err-msg">Enter a valid email address</small>
                          }
                        </div>
                        <div class="f-group">
                          <label class="f-label"><i class="pi pi-phone"></i> Phone</label>
                          <div class="f-phone" [class.f-error]="passengerForm.get('phone')?.invalid && passengerForm.get('phone')?.touched">
                            <span class="f-prefix">+216</span>
                            <input pInputText formControlName="phone" placeholder="98 765 432" class="f-input" />
                          </div>
                          @if (passengerForm.get('phone')?.invalid && passengerForm.get('phone')?.touched) {
                            <small class="f-err-msg">Enter 8 digits (Tunisia mobile without +216)</small>
                          }
                        </div>
                      </div>

                      <!-- Seats (read-only) -->
                      <div class="f-seats">
                        <div class="f-seats-badge">{{ passengerForm.get('seats')?.value }}</div>
                        <span class="f-seats-txt">seat(s) reserved</span>
                      </div>
                    </form>

                    <div class="step-nav">
                      <span></span>
                      <button pButton label="Continue" icon="pi pi-arrow-right" iconPos="right"
                              class="p-button-raised" (click)="goToStep2(activateCallback)"
                              [disabled]="passengerForm.invalid"></button>
                    </div>
                  </div>
                </ng-template>
              </p-step-panel>

              <!-- ═══ Step 2: Payment ═══ -->
              <p-step-panel [value]="2">
                <ng-template #content let-activateCallback="activateCallback">
                  <div class="step">
                    <div class="step-head">
                      <h2>Summary & payment</h2>
                      <p>Review details before you confirm</p>
                    </div>

                    <!-- Summary -->
                    <div class="sum">
                      <div class="sum-route">
                        <div class="sum-point">
                          <span class="sum-city">{{ transport()?.departureCityName }}</span>
                          <span class="sum-time">{{ formatTime(transport()?.departureTime ?? '') }}</span>
                        </div>
                        <div class="sum-track">
                          <span class="sum-dot"></span>
                          <span class="sum-line"></span>
                          <span class="sum-emoji">{{ getTypeEmoji(transport()?.type ?? 'BUS') }}</span>
                          <span class="sum-line"></span>
                          <span class="sum-dot"></span>
                        </div>
                        <div class="sum-point sum-end">
                          <span class="sum-city">{{ transport()?.arrivalCityName }}</span>
                          <span class="sum-time">{{ formatTime(transport()?.arrivalTime ?? '') }}</span>
                        </div>
                      </div>

                      <div class="sum-divider"></div>

                      <div class="sum-grid">
                        <div class="sum-item"><span class="sum-k"><i class="pi pi-calendar"></i> Date</span><span class="sum-v">{{ formatTravelDate(store.dates().travelDate) }}</span></div>
                        <div class="sum-item"><span class="sum-k"><i class="pi pi-user"></i> Passenger</span><span class="sum-v">{{ passengerForm.get('firstName')?.value }} {{ passengerForm.get('lastName')?.value }}</span></div>
                        <div class="sum-item"><span class="sum-k"><i class="pi pi-users"></i> Seats</span><span class="sum-v">{{ passengerForm.get('seats')?.value }}</span></div>
                        <div class="sum-item"><span class="sum-k"><i class="pi pi-phone"></i> Phone</span><span class="sum-v">+216 {{ passengerForm.get('phone')?.value }}</span></div>
                      </div>

                      <div class="sum-divider"></div>

                      <div class="sum-pricing">
                        <div class="sum-pl"><span>Unit price</span><span>{{ transport()?.price }} TND</span></div>
                        <div class="sum-pl"><span>Seats</span><span>&times; {{ passengerForm.get('seats')?.value }}</span></div>
                        <div class="sum-pl sum-total">
                          <span>Total</span>
                          <span class="sum-total-val">{{ calculateTotal() }} TND</span>
                        </div>
                      </div>
                    </div>

                    <!-- Payment Methods -->
                    <div class="pay">
                      <h3 class="pay-title">Payment method</h3>
                      <div class="pay-grid">
                        <label class="pay-opt" [class.pay-active]="paymentMethod() === 'CASH'"
                               (click)="paymentMethod.set('CASH'); paymentMethodValue = 'CASH'">
                          <span class="pay-radio" [class.pay-checked]="paymentMethod() === 'CASH'"></span>
                          <i class="pi pi-wallet pay-icon"></i>
                          <div class="pay-txt">
                            <span class="pay-name">Cash</span>
                            <span class="pay-desc">Pay the driver directly</span>
                          </div>
                        </label>
                        <label class="pay-opt" [class.pay-active]="paymentMethod() === 'KONNECT'"
                               (click)="paymentMethod.set('KONNECT'); paymentMethodValue = 'KONNECT'">
                          <span class="pay-radio" [class.pay-checked]="paymentMethod() === 'KONNECT'"></span>
                          <i class="pi pi-credit-card pay-icon"></i>
                          <div class="pay-txt">
                            <span class="pay-name">Konnect</span>
                            <span class="pay-desc">Secure online payment</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div class="step-nav">
                      <button pButton label="Back" icon="pi pi-arrow-left"
                              class="p-button-text" (click)="activateCallback(1)"></button>
                      <button pButton [label]="'Confirm · ' + calculateTotal() + ' TND'"
                              icon="pi pi-lock" class="p-button-raised"
                              (click)="confirmBooking(activateCallback)"
                              [loading]="loading()" [disabled]="loading()"></button>
                    </div>
                  </div>
                </ng-template>
              </p-step-panel>

              <!-- ═══ Step 3: Confirmation ═══ -->
              <p-step-panel [value]="3">
                <ng-template #content>
                  <div class="step conf">
                    <div class="conf-icon">
                      <div class="conf-circle"><i class="pi pi-check"></i></div>
                    </div>
                    <h2 class="conf-title">Booking confirmed</h2>
                    <div class="conf-welcome-msg">
                      <span>👋</span>
                      <span>Thank you <strong>{{ authService.currentUser()?.firstName || passengerForm.get('firstName')?.value }}</strong>, your ticket is confirmed.</span>
                    </div>

                    @if (reservation(); as r) {
                      <div class="conf-card">
                        <div class="conf-ref">
                          <span class="conf-ref-label">Reference</span>
                          <span class="conf-ref-val">{{ r.reservationRef }}</span>
                        </div>
                        <div class="conf-divider"></div>
                        <div class="conf-rows">
                          <div class="conf-row"><span>Amount</span><strong>{{ r.totalPrice }} TND</strong></div>
                          <div class="conf-row"><span>Status</span><p-tag [value]="r.status" severity="success"></p-tag></div>
                          <div class="conf-row"><span>Payment</span><p-tag [value]="r.paymentMethod" severity="info"></p-tag></div>
                        </div>
                        @if (r.qrCodeToken) {
                          <div class="conf-divider"></div>
                          <div class="conf-qr">
                            <p>Show this QR code at boarding</p>
                            <div class="conf-qr-box">
                              <i class="pi pi-qrcode"></i>
                              <small>{{ r.qrCodeToken }}</small>
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <div class="conf-btns">
                      <button pButton label="My bookings" icon="pi pi-list"
                              class="p-button-raised"
                              (click)="router.navigate(['/mes-reservations'], { queryParams: { tab: 'transport' } })"></button>
                      <button pButton label="New search" icon="pi pi-search"
                              class="p-button-text" (click)="router.navigate(['/transport'])"></button>
                    </div>
                  </div>
                </ng-template>
              </p-step-panel>

            </p-step-panels>
          </p-stepper>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bp { min-height: 100vh; padding: 1rem 1rem 4rem; }
    .bp-wrap { max-width: 740px; margin: 0 auto; }

    /* ═══ Trip Inline Summary ═══ */
    .trip-inline {
      display: flex; align-items: center; gap: 0.85rem;
      background: rgba(241,37,69,0.04);
      border: 1px solid rgba(241,37,69,0.1);
      border-radius: 14px; padding: 0.9rem 1.25rem;
      margin-bottom: 1.75rem;
    }
    .trip-emoji { font-size: 1.6rem; flex-shrink: 0; }
    .trip-detail { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .trip-route { font-weight: 700; font-size: 0.95rem; color: var(--text-color); }
    .trip-meta { font-size: 0.78rem; color: var(--text-muted, #a8b3c7); margin-top: 1px; }
    .trip-price {
      font-family: 'Outfit', sans-serif; font-size: 1.35rem;
      font-weight: 800; color: #f12545; white-space: nowrap; flex-shrink: 0;
    }
    .trip-price small { font-size: 0.7rem; font-weight: 500; opacity: 0.6; }

    /* ═══ Stepper Wrap ═══ */
    .stepper-wrap {
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
      border-radius: 20px; padding: 2rem 2.25rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }

    :host ::ng-deep {
      .p-stepper .p-step-number { width: 2.2rem; height: 2.2rem; font-weight: 700; font-size: 0.85rem; }
      .p-step-panels { padding: 0; }
      .p-inputtext { width: 100%; }
    }

    /* ═══ Step ═══ */
    .step { padding: 1.5rem 0 0; }
    .step-head { text-align: center; margin-bottom: 2rem; }
    .step-head h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem; font-weight: 700; margin: 0 0 0.3rem; color: var(--text-color);
    }
    .step-head p { font-size: 0.88rem; color: var(--text-muted, #a8b3c7); margin: 0; }

    /* ═══ Form ═══ */
    .f { display: flex; flex-direction: column; gap: 1.4rem; }
    .f-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
    .f-group { display: flex; flex-direction: column; gap: 0.35rem; }

    .f-label {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.4px; color: var(--text-muted, #a8b3c7);
      display: flex; align-items: center; gap: 0.35rem;
    }
    .f-label i { font-size: 0.8rem; color: #f12545; }

    .f-input-wrap {
      border: 1.5px solid var(--glass-border, rgba(255,255,255,0.1));
      border-radius: 12px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: rgba(255,255,255,0.02);
    }
    .f-input-wrap:focus-within {
      border-color: #f12545;
      box-shadow: 0 0 0 3px rgba(241,37,69,0.1);
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
      border: 1.5px solid var(--glass-border, rgba(255,255,255,0.1));
      border-radius: 12px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: rgba(255,255,255,0.02);
    }
    .f-phone:focus-within { border-color: #f12545; box-shadow: 0 0 0 3px rgba(241,37,69,0.1); }
    .f-phone.f-error { border-color: #f87171; }
    .f-prefix {
      display: flex; align-items: center; padding: 0 0.85rem;
      font-weight: 700; font-size: 0.88rem; color: #f12545;
      background: rgba(241,37,69,0.05);
      border-right: 1px solid var(--glass-border);
    }

    .f-err-msg { font-size: 0.72rem; color: #f87171; font-weight: 500; padding-left: 2px; }

    /* Seats read-only */
    .f-seats {
      display: flex; align-items: center; gap: 0.85rem;
      background: rgba(241,37,69,0.05);
      border: 1.5px solid rgba(241,37,69,0.12);
      border-radius: 12px; padding: 0.75rem 1.1rem;
    }
    .f-seats-badge {
      width: 38px; height: 38px; border-radius: 10px;
      background: #f12545; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; font-weight: 800; flex-shrink: 0;
    }
    .f-seats-txt { font-size: 0.88rem; color: var(--text-muted); font-weight: 500; }

    /* ═══ Step Nav ═══ */
    .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2.5rem; }

    /* ═══ Summary ═══ */
    .sum {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--glass-border);
      border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;
    }
    .sum-route { display: flex; align-items: center; justify-content: space-between; }
    .sum-point { display: flex; flex-direction: column; gap: 2px; }
    .sum-end { text-align: right; }
    .sum-city { font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700; color: var(--text-color); }
    .sum-time { font-size: 0.8rem; color: var(--text-muted); }
    .sum-track { flex: 1; display: flex; align-items: center; gap: 0; margin: 0 1rem; }
    .sum-dot { width: 8px; height: 8px; border-radius: 50%; background: #f12545; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(241,37,69,0.12); }
    .sum-line { flex: 1; height: 2px; background: rgba(241,37,69,0.12); }
    .sum-emoji { font-size: 1rem; margin: 0 0.3rem; }

    .sum-divider { height: 1px; background: var(--glass-border); margin: 1.1rem 0; }

    .sum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .sum-item { display: flex; flex-direction: column; gap: 2px; }
    .sum-k { font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
    .sum-k i { font-size: 0.75rem; color: #f12545; }
    .sum-v { font-size: 0.92rem; font-weight: 600; color: var(--text-color); }

    .sum-pricing { display: flex; flex-direction: column; gap: 0.4rem; }
    .sum-pl { display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--text-muted); }
    .sum-total { font-weight: 700; color: var(--text-color); padding-top: 0.6rem; border-top: 1px dashed var(--glass-border); font-size: 1rem; }
    .sum-total-val { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 800; color: #f12545; }

    /* ═══ Payment ═══ */
    .pay { margin-bottom: 0.5rem; }
    .pay-title { font-size: 0.92rem; font-weight: 700; color: var(--text-color); margin: 0 0 0.85rem; }
    .pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .pay-opt {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem 1.1rem; border-radius: 14px; cursor: pointer;
      background: rgba(255,255,255,0.02);
      border: 1.5px solid var(--glass-border);
      transition: all 0.25s;
    }
    .pay-opt:hover { border-color: rgba(241,37,69,0.25); }
    .pay-active { border-color: #f12545 !important; background: rgba(241,37,69,0.05) !important; }

    .pay-radio {
      width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
      border: 2px solid var(--glass-border); transition: all 0.2s;
      position: relative;
    }
    .pay-checked { border-color: #f12545; }
    .pay-checked::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 10px; height: 10px; border-radius: 50%;
      background: #f12545;
    }

    .pay-icon { font-size: 1.2rem; color: #f12545; }
    .pay-txt { display: flex; flex-direction: column; }
    .pay-name { font-weight: 700; font-size: 0.88rem; color: var(--text-color); }
    .pay-desc { font-size: 0.72rem; color: var(--text-muted); }

    /* ═══ Confirmation ═══ */
    .conf { text-align: center; padding-top: 2rem !important; }
    .conf-icon { margin-bottom: 1.25rem; }
    .conf-circle {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #f12545, #ff6b6b);
      box-shadow: 0 8px 30px rgba(241,37,69,0.3);
      animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .conf-circle i { font-size: 2rem; color: #fff; }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }

    .conf-title { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; margin: 0 0 0.75rem; color: var(--text-color); }
    .conf-welcome-msg {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: rgba(241,37,69,0.07); border: 1px solid rgba(241,37,69,0.15);
      border-radius: 50px; padding: 0.5rem 1.1rem; margin-bottom: 1.75rem;
      font-size: 0.9rem; color: rgba(255,255,255,0.75);
    }
    .conf-welcome-msg strong { color: #fff; }

    .conf-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--glass-border);
      border-radius: 16px; padding: 1.5rem;
      text-align: left; max-width: 420px; margin: 0 auto 2rem;
    }
    .conf-ref { text-align: center; }
    .conf-ref-label { display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
    .conf-ref-val { display: block; font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 800; color: #f12545; letter-spacing: 1px; margin-top: 0.2rem; }
    .conf-divider { height: 1px; background: var(--glass-border); margin: 1rem 0; }
    .conf-rows { display: flex; flex-direction: column; gap: 0.6rem; }
    .conf-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; color: var(--text-muted); }
    .conf-row strong { color: var(--text-color); }

    .conf-qr { text-align: center; }
    .conf-qr p { font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.75rem; }
    .conf-qr-box {
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 12px;
    }
    .conf-qr-box i { font-size: 3.5rem; color: var(--text-muted); opacity: 0.3; }

    .conf-btns { display: flex; justify-content: center; gap: 0.75rem; }

    /* ═══ Responsive ═══ */
    @media (max-width: 640px) {
      .stepper-wrap { padding: 1.25rem; border-radius: 16px; }
      .f-row { grid-template-columns: 1fr; }
      .pay-grid { grid-template-columns: 1fr; }
      .step-nav { flex-direction: column-reverse; gap: 0.75rem; }
      .step-nav button { width: 100%; }
      .trip-inline { flex-wrap: wrap; }
    }
  `]
})
export class TransportBookingPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private alerts = inject(AppAlertsService);
  authService = inject(AuthService);
  private dataSource = inject(DATA_SOURCE_TOKEN);

  router = inject(Router);
  store = inject(TripContextStore);

  transport = signal<Transport | null>(null);
  reservation = signal<TransportReservation | null>(null);

  // PrimeNG v18 Stepper uses a plain value (1-based) for two-way binding
  activeStepValue = 1;

  loading = signal(false);
  showQrDialog = false;
  paymentMethod = signal<'CASH' | 'KONNECT'>('CASH');
  paymentMethodValue = 'CASH';

  passengerForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    seats: [1, [Validators.required, Validators.min(1)]],
  });

  ngOnInit() {
    const user = this.authService.currentUser();
    if (user) {
      this.passengerForm.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        phone: user.phone?.replace(/\+216\s*/, '').replace(/\D/g, '') ?? '',
      });
    }

    this.passengerForm.patchValue({ seats: this.store.pax().adults || 1 });

    const selected = this.store.selectedTransport();
    if (selected) {
      this.transport.set(selected);
      this.applySeatCapacityValidators(selected);
    } else {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.dataSource.getTransportById(parseInt(id)).subscribe({
          next: t => {
            this.transport.set(t);
            this.applySeatCapacityValidators(t);
          },
          error: () => {
            void this.alerts.error('Trip not found', 'We could not load this trip. Returning to search.');
            this.router.navigate(['/transport']);
          },
        });
      }
    }
  }

  goToStep2(activateCallback: (step: number) => void) {
    if (this.passengerForm.valid) {
      activateCallback(2);
    } else {
      this.passengerForm.markAllAsTouched();
      void this.alerts.warning('Check passenger details', 'Please correct the highlighted fields before continuing.');
    }
  }

  confirmBooking(activateCallback: (step: number) => void) {
    const user = this.authService.currentUser();
    if (!user) {
      void this.alerts.warning('Sign in required', 'Please sign in to complete your booking.');
      this.router.navigate(['/signin']);
      return;
    }

    const t = this.transport();
    if (!t) return;

    const seats = this.passengerForm.get('seats')?.value ?? 1;
    const maxSeats = this.maxBookableSeats(t);
    if (seats > maxSeats) {
      void this.alerts.warning(
        'Not enough seats',
        `This trip only has ${maxSeats} seat(s) available. Reduce the number of seats and try again.`
      );
      return;
    }

    this.loading.set(true);
    const idempotencyKey = crypto.randomUUID();

    this.dataSource.createTransportReservation({
      transportId: t.id,
      userId: (user as any).id ?? (user as any).userId,
      passengerFirstName: this.passengerForm.get('firstName')?.value ?? '',
      passengerLastName: this.passengerForm.get('lastName')?.value ?? '',
      passengerEmail: this.passengerForm.get('email')?.value ?? '',
      passengerPhone: '+216 ' + (this.passengerForm.get('phone')?.value ?? ''),
      numberOfSeats: this.passengerForm.get('seats')?.value ?? 1,
      paymentMethod: this.paymentMethod(),
      idempotencyKey,
    }).subscribe({
      next: res => {
        this.loading.set(false);
        this.reservation.set(res);
        activateCallback(3);
      },
      error: err => {
        this.loading.set(false);
        void this.alerts.error(
          'Booking failed',
          err.error?.message ?? 'We could not complete the reservation. Please try again.'
        );
      },
    });
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

  calculateTotal(): number {
    const seats = this.passengerForm.get('seats')?.value ?? 1;
    return Math.round((seats * (this.transport()?.price ?? 0)) * 100) / 100;
  }

  goBack() { this.router.navigate(['/transport/results'], { queryParams: this.route.snapshot.queryParams }); }

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

  getTypeLabel(type: string): string {
    return TRANSPORT_TYPE_META[type as TransportType]?.label ?? type;
  }

  getTypeEmoji(type: string): string {
    const map: Record<string, string> = { BUS: '\uD83D\uDE8C', VAN: '\uD83D\uDE90', TAXI: '\uD83D\uDE95', CAR: '\uD83D\uDE97', PLANE: '\u2708\uFE0F', TRAIN: '\uD83D\uDE86', FERRY: '\u26F4\uFE0F' };
    return map[type] ?? '';
  }
}
