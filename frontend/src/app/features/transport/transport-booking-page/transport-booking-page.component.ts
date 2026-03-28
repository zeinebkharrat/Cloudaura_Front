import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="booking-card glass-container">
        <div class="stepper">
          <div class="step" [class.active]="step() >= 1" [class.completed]="step() > 1">1. Billets</div>
          <div class="step" [class.active]="step() >= 2" [class.completed]="step() > 2">2. Paiement</div>
          <div class="step" [class.active]="step() >= 3" [class.completed]="step() > 3">3. Confirmation</div>
        </div>

        @if (step() === 1) {
          <div class="step-content">
            <h2>Détails des passagers</h2>
            <form [formGroup]="passengerForm" (ngSubmit)="nextStep()">
              <div class="form-field">
                <label>Nom du passager principal</label>
                <input type="text" formControlName="fullName" placeholder="Nom Complet">
              </div>
              <div class="form-field">
                <label>Numéro de téléphone (Tunisie)</label>
                <input type="tel" formControlName="phone" placeholder="+216 -- --- ---">
              </div>
              <div class="form-field">
                <label>Préférences de siège</label>
                <select formControlName="pref">
                  <option value="WINDOW">Fenêtre</option>
                  <option value="AISLE">Couloir</option>
                  <option value="ANY">Peu importe</option>
                </select>
              </div>
              <div class="actions">
                <button type="button" class="btn-ghost" routerLink="/transport/results">Retour</button>
                <button type="submit" class="btn-primary" [disabled]="passengerForm.invalid">Continuer</button>
              </div>
            </form>
          </div>
        }

        @if (step() === 2) {
          <div class="step-content">
            <h2>Récapitulatif & Paiement</h2>
            <div class="summary">
              <div class="summary-item">
                <span>Trajet</span>
                <strong>{{ store.selectedTransport()?.departureCityName }} → {{ store.selectedTransport()?.arrivalCityName }}</strong>
              </div>
              <div class="summary-item">
                <span>Date</span>
                <strong>{{ store.dates().travelDate }}</strong>
              </div>
              <div class="summary-item">
                <span>Passagers</span>
                <strong>{{ store.pax().adults }} Adulte(s)</strong>
              </div>
              <div class="summary-item">
                <span>Prix Total</span>
                <strong class="total">{{ calculateTotal() }} TND</strong>
              </div>
            </div>

            <button type="button" class="btn-primary" (click)="confirmBooking()" [disabled]="loading()">
              {{ loading() ? 'Confirmation...' : 'Payer & Terminer' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 4rem 2rem; display: flex; justify-content: center; }
    .booking-card { max-width: 600px; width: 100%; padding: 2.5rem; }
    
    .stepper { display: flex; justify-content: space-between; margin-bottom: 3rem; }
    .step { font-weight: 600; color: rgba(255,255,255,0.3); border-bottom: 2px solid transparent; padding-bottom: 8px; }
    .step.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
    .step.completed { color: #fff; }

    .summary { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; }
    .summary-item { display: flex; justify-content: space-between; margin-bottom: 0.8rem; }
    .total { color: var(--primary-color); font-size: 1.4rem; }

    .form-field { margin-bottom: 1.5rem; }
    .form-field label { display: block; margin-bottom: 0.5rem; color: rgba(255,255,255,0.7); }
    input, select { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: white; }

    .actions { display: flex; justify-content: space-between; margin-top: 2rem; }
    .btn-primary { width: 100%; padding: 12px; background: var(--primary-color); color: #000; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; }
    .btn-ghost { background: none; border: none; color: white; cursor: pointer; }
  `]
})
export class TransportBookingPageComponent {
  fb = inject(FormBuilder);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  router = inject(Router);

  step = signal(1);
  loading = signal(false);

  passengerForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{8,12}$')]],
    pref: ['ANY']
  });

  calculateTotal() {
    const passengers = this.store.pax().adults;
    const price = this.store.selectedTransport()?.price || 0;
    return passengers * price;
  }

  nextStep() {
    if (this.passengerForm.valid) this.step.set(2);
  }

  confirmBooking() {
    this.loading.set(true);
    const reservationData = {
      totalPrice: this.calculateTotal(),
      transportId: this.store.selectedTransport()?.id,
      pax: this.store.pax()
    };

    this.dataSource.createReservation(reservationData).subscribe(res => {
      this.loading.set(false);
      this.router.navigate(['/confirmation'], { queryParams: { id: res.id, type: 'transport' } });
    });
  }
}
