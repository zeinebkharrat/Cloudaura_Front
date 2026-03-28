import { Component, OnInit, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { TransportCardComponent } from '../../../shared/components/transport-card/transport-card.component';
import { Transport, City } from '../../../core/models/travel.models';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TransportCardComponent, FormsModule],
  template: `
    <div class="page-container">
      <header class="results-header glass-container">
        <button class="btn-back" (click)="router.navigate(['/transport'])">← Nouvelle recherche</button>
        <h2>{{ departureCityName() }} → {{ arrivalCityName() }}</h2>
        <p>{{ queryParams.date }} • {{ queryParams.passengers }} Passager(s)</p>
      </header>

      <div class="content-layout">
        <aside class="filters glass-container">
          <div class="filter-group">
            <label>Filtrer par type</label>
            <select [(ngModel)]="selectedType" (change)="applyLocalFilter()" class="glass-input">
              <option value="">Tous les types</option>
              <option value="BUS">Bus</option>
              <option value="TAXI">Taxi</option>
              <option value="VAN">Van / Louage</option>
              <option value="CAR">Voiture particulière</option>
              <option value="PLANE">Avion</option>
            </select>
          </div>
        </aside>

        <main class="results-list">
          @if (loading()) {
              <div class="loader-container">
                <div class="spinner"></div>
                <p>Recherche des meilleurs trajets...</p>
              </div>
          } @else {
            @for (item of filteredResults(); track item.id) {
              <app-transport-card [transport]="item" (select)="onSelect(item)"/>
            } @empty {
              <div class="no-results glass-container text-center">
                <p>Désolé, aucun trajet n'est disponible.</p>
                <button class="btn-primary" (click)="router.navigate(['/transport'])">Modifier la recherche</button>
              </div>
            }
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    .results-header { padding: 2.5rem; margin-bottom: 2rem; text-align: center; border-radius: 20px; }
    .btn-back { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--primary-color); cursor: pointer; padding: 8px 15px; border-radius: 8px; position: absolute; left: 2rem; }
    
    h2 { margin: 0; font-size: 2.2rem; background: linear-gradient(135deg, #fff, #4cc9f0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: rgba(255,255,255,0.6); margin-top: 0.5rem; font-size: 1.1rem; }

    .content-layout { display: grid; grid-template-columns: 280px 1fr; gap: 2rem; }
    .results-list { display: flex; flex-direction: column; gap: 1.2rem; }
    
    .filters { padding: 1.5rem; height: fit-content; border-radius: 20px; }
    .filter-group label { display: block; margin-bottom: 10px; font-weight: 500; font-size: 0.9rem; }
    .glass-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 8px; outline: none; }
    .glass-input option { background: #1a1a2e; }

    .loader-container { display: flex; flex-direction: column; align-items: center; padding: 5rem; }
    .spinner { width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.1); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .text-center { text-align: center; padding: 4rem; }
    .btn-primary { padding: 12px 24px; border-radius: 12px; background: var(--primary-color); border: none; font-weight: 600; cursor: pointer; }
    
    @media (max-width: 900px) { .content-layout { grid-template-columns: 1fr; } .btn-back { position: static; margin-bottom: 1rem; } }
  `]
})
export class TransportResultsPageComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);

  loading = signal(true);
  results = signal<Transport[]>([]);
  filteredResults = signal<Transport[]>([]);
  cities = signal<City[]>([]);
  queryParams: any = {};
  selectedType = '';

  departureCityName = computed(() => {
    const id = parseInt(this.queryParams.from);
    return this.cities().find(c => c.id === id)?.name || 'Départ';
  });

  arrivalCityName = computed(() => {
    const id = parseInt(this.queryParams.to);
    return this.cities().find(c => c.id === id)?.name || 'Arrivée';
  });

  ngOnInit() {
    this.dataSource.getCities().subscribe(data => this.cities.set(data));
    this.route.queryParams.subscribe(params => {
      this.queryParams = params;
      this.loadResults();
    });
  }

  loadResults() {
    this.loading.set(true);
    this.dataSource.getTransports({
      from: this.queryParams.from,
      to: this.queryParams.to,
      date: this.queryParams.date
    }).subscribe({
      next: (data) => {
        this.results.set(data);
        this.applyLocalFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  applyLocalFilter() {
    const type = this.selectedType;
    if (!type) {
      this.filteredResults.set(this.results());
    } else {
      this.filteredResults.set(this.results().filter(r => r.type === type));
    }
  }

  onSelect(transport: Transport) {
    this.store.selectedTransport.set(transport);
    this.router.navigate(['/transport', transport.id, 'book']);
  }
}
