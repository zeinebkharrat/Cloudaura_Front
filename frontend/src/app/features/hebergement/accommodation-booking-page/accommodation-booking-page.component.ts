import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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
          <div class="step" [class.active]="step() >= 1" [class.completed]="step() > 1">1. Infos</div>
          <div class="step" [class.active]="step() >= 2" [class.completed]="step() > 2">2. Paiement</div>
          <div class="step" [class.active]="step() >= 3" [class.completed]="step() > 3">3. Confirmation</div>
        </div>

        @if (step() === 1) {
          <div class="step-content">
            <h2>Détails du voyageur</h2>
            <form [formGroup]="guestForm" (ngSubmit)="nextStep()">
              <div class="form-row">
                <div class="form-field">
                  <label>Prénom</label>
                  <input type="text" formControlName="firstName" placeholder="Jean">
                </div>
                <div class="form-field">
                  <label>Nom</label>
                  <input type="text" formControlName="lastName" placeholder="Dupont">
                </div>
              </div>
              <div class="form-field">
                <label>Email</label>
                <input type="email" formControlName="email" placeholder="jean.dupont@email.com">
              </div>
              <div class="form-field">
                <label>Demandes spéciales (Optionnel)</label>
                <textarea formControlName="notes" placeholder="Arrivée tardive, allergie..."></textarea>
              </div>
              <div class="actions">
                <button type="button" class="btn-ghost" routerLink="..">Annuler</button>
                <button type="submit" class="btn-primary" [disabled]="guestForm.invalid">Continuer</button>
              </div>
            </form>
          </div>
        }

        @if (step() === 2) {
          <div class="step-content">
            <h2>Résumé & Paiement</h2>
            <div class="summary">
              <div class="summary-item">
                <span>Hôtel</span>
                <strong>{{ store.selectedAccommodation()?.name }}</strong>
              </div>
              <div class="summary-item">
                <span>Séjour</span>
                <strong>{{ store.dates().checkIn }} au {{ store.dates().checkOut }}</strong>
              </div>
              <div class="summary-item">
                <span>Prix Total</span>
                <strong class="total">{{ calculateTotal() }} TND</strong>
              </div>
            </div>
            
            <div class="payment-mock">
              <p>Simulateur de paiement sécurisé activé.</p>
              <div class="card-mock">**** **** **** 4242</div>
            </div>

            <div class="actions">
              <button type="button" class="btn-ghost" (click)="step.set(1)">Retour</button>
              <button type="button" class="btn-primary" (click)="confirmBooking()" [disabled]="loading()">
                {{ loading() ? 'Confirmation...' : 'Payer & Confirmer' }}
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 4rem 2rem; display: flex; justify-content: center; }
    .booking-card { max-width: 700px; width: 100%; padding: 2.5rem; }
    
    .stepper { display: flex; justify-content: space-between; margin-bottom: 3rem; }
    .step { font-weight: 600; color: rgba(255,255,255,0.3); position: relative; padding-bottom: 8px; }
    .step.active { color: var(--primary-color); border-bottom: 2px solid var(--primary-color); }
    .step.completed { color: #fff; }

    h2 { margin-bottom: 2rem; color: white; }
    
    .form-row { display: flex; gap: 1rem; }
    .form-field { margin-bottom: 1.5rem; flex: 1; }
    .form-field label { display: block; margin-bottom: 0.5rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
    input, textarea {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
      color: white;
      font-size: 1rem;
    }
    textarea { height: 100px; resize: none; }

    .summary { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; }
    .summary-item { display: flex; justify-content: space-between; margin-bottom: 1rem; }
    .total { color: var(--primary-color); font-size: 1.4rem; }

    .payment-mock { text-align: center; padding: 2rem; border: 1px dashed rgba(255,255,255,0.2); border-radius: 12px; margin-bottom: 2rem; }
    .card-mock { font-family: monospace; font-size: 1.2rem; margin-top: 1rem; letter-spacing: 2px; }

    .actions { display: flex; justify-content: space-between; margin-top: 2rem; }
    .btn-ghost { background: none; border: none; color: white; cursor: pointer; }
    .btn-primary { padding: 12px 30px; border-radius: 8px; border: none; background: var(--primary-color); color: #000; font-weight: 700; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class AccommodationBookingPageComponent {
  fb = inject(FormBuilder);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  router = inject(Router);

  step = signal(1);
  loading = signal(false);

  guestForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    notes: ['']
  });

  calculateTotal() {
    const nights = this.store.calculateNights();
    const price = this.store.selectedAccommodation()?.pricePerNight || 0;
    return nights * price;
  }

  nextStep() {
    if (this.guestForm.valid) {
      this.step.set(2);
    }
  }

  confirmBooking() {
    this.loading.set(true);
    const reservationData = {
      totalPrice: this.calculateTotal(),
      accommodationId: this.store.selectedAccommodation()?.id,
      pax: this.store.pax()
    };

    this.dataSource.createReservation(reservationData).subscribe(res => {
      this.loading.set(false);
      this.router.navigate(['/transport']);
    });
  }
}
