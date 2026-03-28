import { Component, OnInit, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AccommodationCardComponent } from '../../../shared/components/accommodation-card/accommodation-card.component';
import { Accommodation, City } from '../../../core/models/travel.models';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, AccommodationCardComponent, FormsModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <header class="list-header glass-container">
        <h1>Hébergements à {{ currentCity()?.name || 'Tunisie' }}</h1>
        <p>{{ currentCity()?.description || 'Découvrez les meilleurs endroits où séjourner en Tunisie.' }}</p>
      </header>

      <div class="content-layout">
        <aside class="filters glass-container">
          <h3>Filtres de recherche</h3>
          
          <form [formGroup]="filterForm">
            <!-- Type d'hébergement -->
            <div class="filter-group">
              <label>Type d'établissement</label>
              <select formControlName="type" class="glass-input">
                <option value="">Tous les types</option>
                <option value="HOTEL">Hôtel</option>
                <option value="GUESTHOUSE">Maison d'hôtes</option>
                <option value="MAISON_HOTE">Gîte Rural</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>

            <!-- Prix Max -->
            <div class="filter-group">
              <label>Prix max / nuit : {{ filterForm.value.maxPrice }} DT</label>
              <input type="range" formControlName="maxPrice" min="0" max="2000" step="50" class="range-slider">
            </div>

            <!-- Note Min -->
            <div class="filter-group">
              <label>Note minimum : {{ filterForm.value.minRating }} ★</label>
              <input type="range" formControlName="minRating" min="0" max="5" step="0.5" class="range-slider">
            </div>
          </form>

          <div class="filter-summary">
            <div class="pax-info">
              <i class="icon-user"></i>
              {{ store.pax().adults }} Adulte(s), {{ store.pax().children }} Enfant(s)
            </div>
          </div>
          
          <button class="btn-secondary" routerLink="/">Changer de destination</button>
        </aside>

        <main class="results-grid">
          @if (loading()) {
            <div class="loader-container">
              <div class="spinner"></div>
              <p>Recherche des meilleurs tarifs...</p>
            </div>
          } @else {
            @for (acc of accommodations(); track acc.id) {
              <app-accommodation-card
                [accommodation]="acc"
                (select)="onSelect(acc)"/>
            } @empty {
              <div class="no-results glass-container text-center">
                <h3>Aucun résultat</h3>
                <p>Essayez de modifier vos filtres ou de changer de ville.</p>
                <button class="btn-primary" (click)="resetFilters()">Réinitialiser les filtres</button>
              </div>
            }
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 2rem; max-width: 1300px; margin: 0 auto; }
    .glass-input {
      width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
      color: white; padding: 0.8rem; border-radius: 8px; margin-top: 0.5rem; outline: none;
    }
    .glass-input option { background: #1a1a2e; color: white; }
    .range-slider { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 5px; outline: none; margin-top: 1rem; }
    .filter-summary { margin: 1.5rem 0; font-size: 0.9rem; color: rgba(255,255,255,0.7); }
    .pax-info { display: flex; align-items: center; gap: 0.5rem; }
    .text-center { text-align: center; padding: 3rem; }
    /* ... (others from previous) */
    .list-header { margin-bottom: 2rem; padding: 2.5rem; text-align: center; border-radius: 20px; }
    .list-header h1 { font-size: 2.8rem; margin: 0; background: linear-gradient(135deg, #fff, #4cc9f0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .content-layout { display: grid; grid-template-columns: 320px 1fr; gap: 2rem; }
    .results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; }
    .filters { height: fit-content; position: sticky; top: 100px; padding: 2rem; border-radius: 20px; }
    .filter-group { margin-bottom: 2rem; }
    .filter-group label { display: block; font-size: 0.9rem; margin-bottom: 0.5rem; font-weight: 500; }
    .btn-secondary { width: 100%; margin-top: 1rem; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; cursor: pointer; }
    .btn-primary { padding: 12px 24px; border-radius: 12px; background: var(--primary-color); border: none; color: white; font-weight: 600; cursor: pointer; margin-top: 1rem; }
    @media (max-width: 1024px) { .content-layout { grid-template-columns: 1fr; } .filters { position: static; } }
  `]
})
export class AccommodationListPageComponent implements OnInit {
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  router = inject(Router);

  loading = signal(true);
  cities = signal<City[]>([]);
  accommodations = signal<Accommodation[]>([]);

  filterForm = new FormGroup({
    type: new FormControl(''),
    maxPrice: new FormControl(2000),
    minRating: new FormControl(0)
  });

  currentCity = computed(() => {
    const id = this.store.selectedCityId();
    return this.cities().find(c => c.id === id);
  });

  ngOnInit() {
    this.loadCities();
    this.loadInitialData();
    
    // Auto-update on filter change
    this.filterForm.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => this.applyFilters());
  }

  loadCities() {
    this.dataSource.getCities().subscribe(data => this.cities.set(data));
  }

  loadInitialData() {
    this.applyFilters();
  }

  applyFilters() {
    this.loading.set(true);
    const cityId = this.store.selectedCityId();
    const filters = this.filterForm.value;

    this.dataSource.getAccommodations(cityId).subscribe({
      next: (data) => {
        // Simple front-end filtering for Price and Type if Backend not yet updated,
        // but here we intend to use Backend filtering via Params
        let filtered = data.filter(a => {
           const matchType = !filters.type || a.type === filters.type;
           const matchPrice = a.pricePerNight <= (filters.maxPrice || 2000);
           const matchRating = a.rating >= (filters.minRating || 0);
           return matchType && matchPrice && matchRating;
        });
        
        this.accommodations.set(filtered);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  resetFilters() {
    this.filterForm.reset({ type: '', maxPrice: 2000, minRating: 0 });
  }

  onSelect(acc: Accommodation) {
    this.store.selectedAccommodation.set(acc);
    this.router.navigate(['/hebergement', acc.id]);
  }
}
