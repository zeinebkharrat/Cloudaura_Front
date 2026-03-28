import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { City } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <div class="search-box glass-container">
        <h1>Où allez-vous ensuite ? 🚌</h1>
        <p>Réservez votre transport interurbain en quelques clics.</p>

        <form [formGroup]="searchForm" (ngSubmit)="onSearch()">
          <div class="form-grid">
            <div class="form-field">
              <label>Départ</label>
              <select formControlName="from">
                <option value="" disabled>Ville de départ</option>
                <option *ngFor="let city of cities()" [value]="city.id">{{ city.name }}</option>
              </select>
            </div>

            <div class="form-field">
              <label>Destination</label>
              <select formControlName="to">
                <option value="" disabled>Ville d'arrivée</option>
                <option *ngFor="let city of cities()" [value]="city.id">{{ city.name }}</option>
              </select>
            </div>

            <div class="form-field">
              <label>Date du voyage</label>
              <input type="date" formControlName="date">
            </div>

            <div class="form-field">
              <label>Passagers</label>
              <input type="number" formControlName="passengers" min="1" max="8">
            </div>
          </div>

          <button type="submit" class="btn-primary large" [disabled]="searchForm.invalid">
            Rechercher des trajets
          </button>
        </form>
      </div>
      
      <div class="shortcuts">
        <h3>Trajets populaires</h3>
        <div class="chips">
          <span class="chip" (click)="setQuickSearch('Tunis', 'Sousse')">Tunis → Sousse</span>
          <span class="chip" (click)="setQuickSearch('Tunis', 'Djerba')">Tunis → Djerba</span>
          <span class="chip" (click)="setQuickSearch('Sousse', 'Hammamet')">Sousse → Hammamet</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 4rem 2rem; max-width: 900px; margin: 0 auto; }
    .search-box { padding: 3rem; text-align: center; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #fff; }
    p { color: rgba(255,255,255,0.6); margin-bottom: 2.5rem; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; text-align: left; }
    .form-field label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.9rem; color: var(--primary-color); }
    select, input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
      color: white;
      font-size: 1rem;
    }
    select option { background: #1a1a1a; }

    .btn-primary.large { width: 100%; padding: 15px; font-size: 1.1rem; border-radius: 12px; margin-top: 1rem; }

    .shortcuts { margin-top: 3rem; text-align: center; }
    .shortcuts h3 { color: rgba(255,255,255,0.4); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; }
    .chips { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
    .chip { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 8px 20px; border-radius: 20px; color: white; cursor: pointer; transition: all 0.2s; }
    .chip:hover { background: var(--primary-color); color: #000; }

    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class TransportSearchPageComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);

  cities = signal<City[]>([]);

  searchForm = this.fb.group({
    from: ['', Validators.required],
    to: ['', Validators.required],
    date: ['', Validators.required],
    passengers: [this.store.pax().adults, [Validators.required, Validators.min(1)]]
  });

  ngOnInit() {
    this.dataSource.getCities().subscribe(data => {
      this.cities.set(data);
      const currentCity = data.find(c => c.id === this.store.selectedCityId());
      if (currentCity) {
        this.searchForm.patchValue({ from: currentCity.name });
      }
    });

    if (this.store.dates().travelDate) {
      this.searchForm.patchValue({ date: this.store.dates().travelDate });
    }
  }

  setQuickSearch(from: string, to: string) {
    this.searchForm.patchValue({ from, to });
  }

  onSearch() {
    if (this.searchForm.valid) {
      const criteria = this.searchForm.value;
      this.store.setDates({ travelDate: criteria.date as string });
      this.store.setPax({ adults: Number(criteria.passengers), children: this.store.pax().children });
      
      this.router.navigate(['/transport/results'], { queryParams: criteria });
    }
  }
}
