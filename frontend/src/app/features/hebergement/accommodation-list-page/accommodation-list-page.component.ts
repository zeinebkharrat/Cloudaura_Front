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
    <div class="page-wrap">

      <!-- Hero Header -->
      <div class="hero-header">
        <div class="hero-content">
          <span class="hero-label">STAYS</span>
          <h1>
            @if (currentCity(); as city) {
              Stay in <span class="city-highlight">{{ city.name }}</span>
            } @else {
              Discover places to stay in <span class="city-highlight">Tunisia</span>
            }
          </h1>
          <p class="hero-sub">
            {{ currentCity()?.description || 'Hand-picked hotels, guest houses and rural stays for your trip.' }}
          </p>
          
        </div>
      </div>

      <!-- Main Layout -->
      <div class="main-layout">

        <!-- Sidebar Filters -->
        <aside class="filter-panel">
          <div class="filter-header">
            <h3>Filters</h3>
            <button class="btn-clear" (click)="resetFilters()">Clear</button>
          </div>

          <form [formGroup]="filterForm">
            
            <!-- City Selector -->
            <div class="filter-block">
              <label class="filter-label"><img src="/icones/city.png" alt="" class="filter-label-icon" /> City</label>
              <select formControlName="cityId" class="filter-select" (change)="onCityChange()">
                <option [value]="0">All cities</option>
                <option *ngFor="let city of cities()" [value]="city.id">{{ city.name }}</option>
              </select>
            </div>

            <!-- Type -->
            <div class="filter-block">
              <label class="filter-label"><img src="/icones/hotel.png" alt="Type" class="filter-label-icon" /> Type</label>
              <div class="type-chips">
                <button class="chip" [class.active]="filterForm.value.type === ''" 
                        (click)="setType('')">All</button>
                <button class="chip" [class.active]="filterForm.value.type === 'HOTEL'"
                        (click)="setType('HOTEL')"><img src="/icones/hotel.png" alt="Hotel" class="chip-icon" /> Hotel</button>
                <button class="chip" [class.active]="filterForm.value.type === 'MAISON_HOTE'"
                        (click)="setType('MAISON_HOTE')"><img src="/icones/home.png" alt="Guest house" class="chip-icon" /> Guest house</button>
                <button class="chip" [class.active]="filterForm.value.type === 'GUESTHOUSE'"
                        (click)="setType('GUESTHOUSE')"><img src="/icones/home.png" alt="Rural stay" class="chip-icon" /> Rural stay</button>
              </div>
            </div>

            <!-- Price Range -->
            <div class="filter-block">
              <label class="filter-label">
                <img src="/icones/money-bag.png" alt="Budget" class="filter-label-icon" /> Max budget
                <span class="price-display">{{ filterForm.value.maxPrice }} TND</span>
              </label>
              <input type="range" formControlName="maxPrice" min="50" max="800" step="10" class="range-input">
              <div class="range-labels">
                <span>50 TND</span>
                <span>800 TND</span>
              </div>
            </div>

            <!-- Star Rating -->
            <div class="filter-block">
              <label class="filter-label"><i class="pi pi-star-fill filter-label-pi" aria-hidden="true"></i> Minimum rating</label>
              <div class="star-picker">
                @for (star of [1,2,3,4,5]; track star) {
                  <button class="star-btn" 
                          [class.lit]="(filterForm.value.minRating || 0) >= star"
                          (click)="setRating(star)">
                    ★
                  </button>
                }
                @if (filterForm.value.minRating && filterForm.value.minRating > 0) {
                  <button class="star-clear" (click)="setRating(0)">✕</button>
                }
              </div>
            </div>
          </form>

        </aside>

        <!-- Results Grid -->
        <main class="results-area">
          
          <!-- Results Header -->
          <div class="results-header">
            <div class="results-count">
              @if (loading()) {
                <span class="pulse-dot"></span> Searching...
              } @else {
                <strong>{{ accommodations().length }}</strong> listing(s) found
              }
            </div>
          </div>

          @if (loading()) {
            <div class="loading-grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="skeleton-card">
                  <div class="skeleton-img shimmer"></div>
                  <div class="skeleton-body">
                    <div class="skeleton-line wide shimmer"></div>
                    <div class="skeleton-line medium shimmer"></div>
                    <div class="skeleton-line short shimmer"></div>
                  </div>
                </div>
              }
            </div>
          } @else {
            @if (accommodations().length > 0) {
              <div class="hotel-grid">
                @for (acc of accommodations(); track acc.id) {
                  <app-accommodation-card
                    [accommodation]="acc"
                    (select)="onSelect(acc)"/>
                }
              </div>
            } @else {
              <!-- Empty State -->
              <div class="empty-state">
                <div class="empty-icon" aria-hidden="true"><i class="pi pi-search"></i></div>
                <h3>No listings found</h3>
                <p>Try widening your filters or picking another city.</p>
                <div class="empty-actions">
                  <button class="btn-reset" (click)="resetFilters()">
                    <i class="pi pi-refresh"></i> Reset filters
                  </button>
                  <button class="btn-home" routerLink="/">
                    <img src="/icones/home.png" alt="Home" style="width:1rem;height:1rem;object-fit:contain;vertical-align:middle;margin-right:0.25rem;" /> Pick a city
                  </button>
                </div>
              </div>
            }
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    .page-wrap { background: #0d0f18; min-height: 100vh; }

    /* Hero */
    .hero-header {
      background: linear-gradient(135deg, #0d0f18 0%, #1a0a1e 40%, #0d1520 100%);
      border-bottom: 1px solid rgba(255,255,255,0.04);
      padding: 2rem 2rem 2rem;
    }
    .hero-content { max-width: 1300px; margin: 0 auto; }
    .hero-label {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 2px;
      color: #f12545;
      margin-bottom: 10px;
      background: rgba(241,37,69,0.1);
      padding: 5px 12px;
      border-radius: 4px;
    }
    h1 {
      font-size: 2.6rem;
      font-weight: 800;
      color: #fff;
      margin: 0 0 10px 0;
      line-height: 1.2;
    }
    .city-highlight {
      background: linear-gradient(135deg, #f12545, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-sub {
      font-size: 1.05rem;
      color: rgba(255,255,255,0.5);
      margin-bottom: 1.5rem;
      max-width: 600px;
    }
    /* Main Layout */
    .main-layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 2rem;
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Filters */
    .filter-panel {
      background: #161922;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 20px;
      padding: 1.5rem;
      height: fit-content;
      position: sticky;
      top: 90px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    }
    .filter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .filter-header h3 { margin: 0; color: #fff; font-size: 1.1rem; }
    .btn-clear {
      background: none; border: none;
      color: #f12545; font-size: 0.82rem;
      cursor: pointer; font-weight: 600;
    }
    .btn-clear:hover { text-decoration: underline; }

    .filter-block { margin-bottom: 1.8rem; }
    .filter-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.55);
      font-weight: 600;
      margin-bottom: 10px;
      gap: 0.4rem;
    }
    .filter-label-icon { width: 1rem; height: 1rem; object-fit: contain; flex-shrink: 0; }
    .filter-label-pi { font-size: 0.95rem; color: #f1c40f; flex-shrink: 0; }
    .price-display {
      background: rgba(241,37,69,0.15);
      color: #f12545;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.82rem;
    }
    .filter-select {
      width: 100%;
      background: #0d0f18;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 12px;
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      appearance: none;
      cursor: pointer;
    }
    .filter-select:focus { border-color: #f12545; }
    .filter-select option { background: #161922; }

    /* Type Chips */
    .type-chips { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .chip {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.6);
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.25s;
      text-align: center;
      white-space: nowrap;
      display: flex; align-items: center; gap: 0.3rem; justify-content: center;
    }
    .chip-icon { width: 0.95rem; height: 0.95rem; object-fit: contain; flex-shrink: 0; }
    .chip:hover { border-color: rgba(255,255,255,0.2); color: #fff; background: rgba(255,255,255,0.06); }
    .chip.active {
      background: rgba(241,37,69,0.12);
      border-color: rgba(241,37,69,0.35);
      color: #f12545;
      font-weight: 600;
    }

    /* Range Slider */
    .range-input {
      width: 100%;
      height: 5px;
      border-radius: 5px;
      background: linear-gradient(to right, rgba(241,37,69,0.3), rgba(255,255,255,0.08));
      outline: none;
      appearance: none;
      cursor: pointer;
      margin: 4px 0;
    }
    .range-input::-webkit-slider-thumb {
      appearance: none;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: #f12545;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(241,37,69,0.45);
      border: 3px solid #161922;
      transition: transform 0.15s;
    }
    .range-input::-webkit-slider-thumb:hover { transform: scale(1.15); }
    .range-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.3);
      margin-top: 6px;
    }

    /* Star Picker */
    .star-picker { display: flex; gap: 4px; align-items: center; }
    .star-btn {
      background: none; border: none;
      font-size: 1.6rem;
      color: rgba(255,255,255,0.15);
      cursor: pointer;
      transition: all 0.15s;
      padding: 2px;
    }
    .star-btn:hover { transform: scale(1.2); }
    .star-btn.lit {
      color: #f1c40f;
      text-shadow: 0 0 8px rgba(241,196,15,0.4);
    }
    .star-clear {
      background: none; border: none;
      color: #f12545; font-size: 0.9rem;
      cursor: pointer; margin-left: 6px;
      opacity: 0.6;
    }
    .star-clear:hover { opacity: 1; }

    /* Results */
    .results-area { min-height: 400px; }
    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .results-count {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      color: rgba(255,255,255,0.6);
    }
    .results-count strong { color: #fff; }
    .pulse-dot {
      width: 8px; height: 8px;
      background: #f12545;
      border-radius: 50%;
      animation: pulse 1.2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.5); }
    }

    /* Hotel Grid */
    .hotel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 1.5rem;
    }

    /* Skeleton Loading */
    .loading-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 1.5rem;
    }
    .skeleton-card {
      background: #161922;
      border: 1px solid rgba(255,255,255,0.04);
      border-radius: 18px;
      overflow: hidden;
    }
    .skeleton-img { height: 180px; }
    .skeleton-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 10px; }
    .skeleton-line { height: 14px; border-radius: 6px; }
    .skeleton-line.wide { width: 80%; }
    .skeleton-line.medium { width: 60%; }
    .skeleton-line.short { width: 40%; }
    .shimmer {
      background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: #161922;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 20px;
    }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; color: rgba(255,255,255,0.25); display: flex; justify-content: center; }
    .empty-state h3 { color: #fff; font-size: 1.4rem; margin-bottom: 0.75rem; }
    .empty-state p { color: rgba(255,255,255,0.5); max-width: 400px; margin: 0 auto 2rem; }
    .empty-actions { display: flex; gap: 12px; justify-content: center; }
    .btn-reset, .btn-home {
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-reset {
      background: rgba(241,37,69,0.15);
      color: #f12545;
      border: 1px solid rgba(241,37,69,0.3);
    }
    .btn-reset:hover { background: rgba(241,37,69,0.25); }
    .btn-home {
      background: #f12545;
      color: #fff;
    }
    .btn-home:hover { background: #ff3355; }

    /* Responsive */
    @media (max-width: 900px) {
      .main-layout { grid-template-columns: 1fr; }
      .filter-panel { position: static; }
      h1 { font-size: 1.8rem; }
      .hotel-grid, .loading-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AccommodationListPageComponent implements OnInit {
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  router = inject(Router);

  loading = signal(true);
  cities = signal<City[]>([]);
  accommodations = signal<Accommodation[]>([]);
  activeCityId = signal<number>(0);

  filterForm = new FormGroup({
    cityId: new FormControl(0),
    type: new FormControl(''),
    maxPrice: new FormControl(800),
    minRating: new FormControl(0)
  });

  currentCity = computed(() => {
    const id = this.activeCityId() || this.store.selectedCityId();
    return this.cities().find(c => c.id === Number(id));
  });

  ngOnInit() {
    this.loadCities();

    const storeCity = this.store.selectedCityId();
    if (storeCity) {
      this.filterForm.patchValue({ cityId: storeCity });
      this.activeCityId.set(storeCity);
    }

    this.loadData();

    this.filterForm.get('cityId')!.valueChanges.subscribe(v => {
      this.activeCityId.set(Number(v) || 0);
    });

    this.filterForm.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => this.loadData());
  }

  loadCities() {
    this.dataSource.getCities().subscribe(data => this.cities.set(data));
  }

  onCityChange() {
    const cityId = Number(this.filterForm.value.cityId);
    if (cityId > 0) {
      this.store.setSelectedCity(cityId);
    }
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    const f = this.filterForm.value;
    const cityId = Number(f.cityId) || this.store.selectedCityId();

    this.dataSource.getAccommodations(cityId || null, {
      type: f.type || undefined,
      maxPrice: f.maxPrice ?? undefined,
      minRating: (f.minRating && f.minRating > 0) ? f.minRating : undefined
    }).subscribe({
      next: (data) => {
        this.accommodations.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.accommodations.set([]);
        this.loading.set(false);
      }
    });
  }

  resetFilters() {
    this.filterForm.reset({ cityId: 0, type: '', maxPrice: 800, minRating: 0 });
  }

  setType(type: string) {
    this.filterForm.patchValue({ type });
  }

  setRating(rating: number) {
    this.filterForm.patchValue({ minRating: rating });
  }

  onSelect(acc: Accommodation) {
    this.store.selectedAccommodation.set(acc);
    this.router.navigate(['/hebergement', acc.id]);
  }
}
