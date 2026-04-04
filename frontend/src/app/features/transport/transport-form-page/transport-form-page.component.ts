import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { City } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  selector: 'app-transport-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      
      <div class="search-widget">
        <!-- Top Navigation Tabs -->
        <div class="tabs-container">
          <div class="nav-tabs">
            <button class="tab-btn" [class.active]="transportType === 'BUS'" (click)="setType('BUS')"><img src="/icones/bus.png" alt="Bus" class="tab-icon" /> Bus</button>
            <button class="tab-btn" [class.active]="transportType === 'TAXI'" (click)="setType('TAXI')"><img src="/icones/taxi.png" alt="Taxi" class="tab-icon" /> Taxi/Louage</button>
            <button class="tab-btn" [class.active]="transportType === 'VAN'" (click)="setType('VAN')"><img src="/icones/taxi.png" alt="Van" class="tab-icon" /> Van privé</button>
            <button class="tab-btn" [class.active]="transportType === 'CAR'" (click)="setType('CAR')"><img src="/icones/car.png" alt="Voiture" class="tab-icon" /> Voiture</button>
            <button class="tab-btn" [class.active]="transportType === 'PLANE'" (click)="setType('PLANE')"><img src="/icones/plane.png" alt="Avion" class="tab-icon" /> Avion</button>
            <button class="tab-btn" [class.active]="transportType === 'TRAIN'" (click)="setType('TRAIN')"><i class="pi pi-compass tab-pi" aria-hidden="true"></i> Train</button>
            <button class="tab-btn" [class.active]="transportType === 'FERRY'" (click)="setType('FERRY')"><i class="pi pi-send tab-pi" aria-hidden="true"></i> Bateau</button>
          </div>
        </div>

        <!-- Form Area -->
        <div class="form-area">
          <form [formGroup]="searchForm" (ngSubmit)="onSearch()">
            
            <div class="inline-form-row">
              
              <!-- Location Group: From -> Swap -> To -->
              <div class="location-group">
                <div class="field-item departure-field">
                  <span class="field-label">Départ</span>
                  <select formControlName="from">
                    <option value="" disabled>Ville de départ</option>
                    <option *ngFor="let city of cities()" [value]="city.id">{{ city.name }}</option>
                  </select>
                </div>
                
                <button type="button" class="swap-btn" (click)="swapCities()" title="Inverser les villes">
                  ⇄
                </button>

                <div class="field-item arrival-field">
                  <span class="field-label">Destination</span>
                  <select formControlName="to">
                    <option value="" disabled>Ville d'arrivée</option>
                    <option *ngFor="let city of cities()" [value]="city.id">{{ city.name }}</option>
                  </select>
                </div>
              </div>

              <!-- Date Group -->
              <div class="field-item date-field">
                <span class="field-label">Date du voyage</span>
                <input type="date" formControlName="date">
              </div>

              <!-- Passengers Group -->
              <div class="field-item pax-field">
                <span class="field-label">Passagers</span>
                <select formControlName="passengers">
                  <option *ngFor="let i of [1,2,3,4,5,6,7,8]" [value]="i">{{ i }} passager(s)</option>
                </select>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="btn-search" [disabled]="searchForm.invalid">
                Search
              </button>

            </div>

          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      padding-top: 5rem;
    }
    .search-widget {
      width: 100%;
      max-width: 1100px;
      background: #11141e;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.05);
    }

    /* Tabs Styling */
    .tabs-container {
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 0 1rem;
      overflow-x: auto; /* Scrollable on small screens */
    }
    .nav-tabs {
      display: flex;
      gap: 0.5rem;
      padding: 1rem 0 0 0;
      min-width: max-content;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: #8c9bb0;
      padding: 12px 20px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 10px 10px 0 0;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
    }
    .tab-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.05);
    }
    .tab-btn.active {
      color: #fff;
      background: #1a1d29;
    }
    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 3px;
      background: #f12545;
      border-radius: 3px 3px 0 0;
    }
    .tab-icon { width: 1.1rem; height: 1.1rem; object-fit: contain; vertical-align: middle; flex-shrink: 0; }
    .tab-pi { font-size: 1.05rem; opacity: 0.92; flex-shrink: 0; }

    /* Form Area Styling */
    .form-area {
      padding: 2rem;
      background: #1a1d29;
    }
    .inline-form-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    /* Location Group (From -> Swap -> To) */
    .location-group {
      display: flex;
      align-items: center;
      background: #232736;
      border: 1px solid #32384c;
      border-radius: 12px;
      flex: 2;
      position: relative;
      transition: border-color 0.2s;
    }
    .location-group:focus-within {
      border-color: rgba(241, 37, 69, 0.5);
    }

    .field-item {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 8px 16px;
      position: relative;
    }
    .departure-field { border-right: 1px solid #32384c; }
    .arrival-field { }

    .date-field, .pax-field {
      background: #232736;
      border: 1px solid #32384c;
      border-radius: 12px;
      flex: 1;
      transition: border-color 0.2s;
    }
    .date-field:focus-within, .pax-field:focus-within {
      border-color: rgba(241, 37, 69, 0.5);
    }

    .field-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #8c9bb0;
      font-weight: 600;
      margin-bottom: 2px;
    }

    /* Inputs */
    select, input {
      background: transparent;
      border: none;
      color: #fff;
      font-size: 1.05rem;
      font-weight: 500;
      padding: 4px 0;
      outline: none;
      width: 100%;
      cursor: pointer;
      appearance: none;
    }
    select option { background: #1a1d29; color: #fff; }
    
    input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
      opacity: 0.6;
      cursor: pointer;
    }

    /* Swap Button */
    .swap-btn {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #32384c;
      border: 2px solid #1a1d29;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      cursor: pointer;
      z-index: 10;
      transition: all 0.2s;
    }
    .swap-btn:hover {
      background: #f12545;
      transform: translate(-50%, -50%) rotate(180deg);
    }

    /* Search Button */
    .btn-search {
      flex: 0 0 auto;
      background: #f12545;
      color: white;
      border: none;
      padding: 0 30px;
      height: 56px;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(241, 37, 69, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-search:hover:not([disabled]) {
      background: #ff3355;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(241, 37, 69, 0.4);
    }
    .btn-search[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    /* Responsive Design */
    @media (max-width: 900px) {
      .inline-form-row {
        flex-direction: column;
        align-items: stretch;
      }
      .location-group {
        flex-direction: column;
      }
      .departure-field { border-right: none; border-bottom: 1px solid #32384c; }
      .swap-btn {
         transform: translate(-50%, -50%) rotate(90deg);
      }
      .swap-btn:hover {
         transform: translate(-50%, -50%) rotate(270deg);
      }
      .date-field, .pax-field {
        width: 100%;
      }
      .btn-search {
        margin-top: 10px;
        width: 100%;
      }
    }
  `]
})
export class TransportFormPageComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  route = inject(ActivatedRoute);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);

  cities = signal<City[]>([]);
  transportType = 'BUS';

  searchForm = this.fb.group({
    from: ['', Validators.required],
    to: ['', Validators.required],
    date: ['', Validators.required],
    passengers: [this.store.pax().adults, [Validators.required, Validators.min(1)]]
  });

  ngOnInit() {
    this.dataSource.getCities().subscribe((data: City[]) => {
      this.cities.set(data);
      const currentCity = data.find((c: City) => c.id === this.store.selectedCityId());
      if (currentCity) {
        this.searchForm.patchValue({ from: currentCity.id.toString() });
      }
    });

    if (this.store.dates().travelDate) {
      this.searchForm.patchValue({ date: this.store.dates().travelDate });
    }

    this.route.queryParams.subscribe(params => {
      if (params['type']) {
        this.transportType = params['type'];
      }
    });
  }

  setType(type: string) {
    this.transportType = type;
  }

  swapCities() {
    const currentFrom = this.searchForm.get('from')?.value;
    const currentTo = this.searchForm.get('to')?.value;
    
    // Only swap if both are selected safely
    this.searchForm.patchValue({
      from: currentTo,
      to: currentFrom
    });
  }

  onSearch() {
    if (this.searchForm.valid) {
      const criteria = this.searchForm.value;
      this.store.setDates({ travelDate: criteria.date as string });
      this.store.setPax({ adults: Number(criteria.passengers), children: this.store.pax().children });
      
      const queryParams = { ...criteria, transportType: this.transportType };
      this.router.navigate(['/transport/results'], { queryParams });
    }
  }
}
