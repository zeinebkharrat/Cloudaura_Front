import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Accommodation } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    @if (loading()) {
      <div class="loader-page">
        <div class="spinner-large"></div>
        <p>Chargement de l'hébergement...</p>
      </div>
    }

    @if (accommodation(); as acc) {
      <div class="page-wrap">

        <!-- Hero Image Banner -->
        <div class="hero-banner" [style.background-image]="'url(' + getHotelImage(acc) + ')'">
          <div class="hero-overlay">
            <div class="hero-top">
              <button class="btn-back" (click)="router.navigate(['/hebergement'])">
                ← Retour aux hébergements
              </button>
              <div class="hero-badges">
                <span class="badge-type">{{ formatType(acc.type) }}</span>
              </div>
            </div>
            <div class="hero-bottom">
              <div>
                <h1>{{ acc.name }}</h1>
                <div class="location-row">
                  <span class="loc-icon">📍</span>
                  <span>{{ acc.cityName }}, Tunisie</span>
                </div>
              </div>
              <div class="rating-big">
                <div class="stars">{{ getStars(acc.rating) }}</div>
                <div class="score">{{ acc.rating }}/5</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content + Booking Panel -->
        <div class="content-grid">

          <!-- Left: Details -->
          <div class="details-section">

            <!-- Quick Highlights -->
            <div class="card highlights-card">
              <h3>🏨 Points forts</h3>
              <div class="highlights-grid">
                <div class="highlight"><span>🌡️</span><span>Climatisation</span></div>
                <div class="highlight"><span>🍳</span><span>Petit-déjeuner inclus</span></div>
                <div class="highlight"><span>🅿️</span><span>Parking gratuit</span></div>
                <div class="highlight"><span>🛎️</span><span>Service 24h/24</span></div>
                <div class="highlight"><span>📶</span><span>Wi-Fi inclus</span></div>
                <div class="highlight"><span>♿</span><span>Accès PMR</span></div>
                @if (acc.rating >= 4) {
                  <div class="highlight"><span>🏊</span><span>Piscine</span></div>
                  <div class="highlight"><span>💆</span><span>Spa & Bien-être</span></div>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="card">
              <h3>À propos de cet établissement</h3>
              <p class="desc-text">
                Bienvenue au <strong>{{ acc.name }}</strong>, niché au cœur de <strong>{{ acc.cityName }}</strong>.
                Cet établissement d'exception vous offre une expérience inoubliable mêlant confort moderne
                et charme tunisien authentique. Profitez de services haut de gamme et d'une situation idéale
                pour explorer tous les trésors de la région.
              </p>
              <p class="desc-text">
                Avec une note de <strong>{{ acc.rating }}/5</strong>, nos hôtes confirment la qualité
                exceptionnelle de l'accueil, la propreté irréprochable des chambres et la richesse
                des équipements proposés.
              </p>
            </div>

            <!-- Rooms Available -->
            <div class="card">
              <h3>🛏️ Chambres disponibles</h3>
              <div class="rooms-list">
                <div class="room-item" (click)="selectRoom('SINGLE')">
                  <div class="room-icon">🛏️</div>
                  <div class="room-info">
                    <strong>Chambre Simple</strong>
                    <span>1 personne · Vue jardin</span>
                  </div>
                  <div class="room-price">{{ acc.pricePerNight | number:'1.0-0' }} TND / nuit</div>
                </div>
                <div class="room-item" (click)="selectRoom('DOUBLE')">
                  <div class="room-icon">🛌</div>
                  <div class="room-info">
                    <strong>Chambre Double</strong>
                    <span>2 personnes · Vue mer disponible</span>
                  </div>
                  <div class="room-price">{{ acc.pricePerNight | number:'1.0-0' }} TND / nuit</div>
                </div>
                @if (acc.rating >= 4) {
                  <div class="room-item suite" (click)="selectRoom('SUITE')">
                    <div class="room-icon">🌟</div>
                    <div class="room-info">
                      <strong>Suite de Luxe</strong>
                      <span>4 personnes · Terrasse · Vue panoramique</span>
                    </div>
                    <div class="room-price">{{ (acc.pricePerNight * 2) | number:'1.0-0' }} TND / nuit</div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Right: Booking Widget -->
          <div class="booking-widget">
            <div class="widget-card">
              <div class="widget-price">
                <span class="price-big">{{ acc.pricePerNight | number:'1.0-0' }}</span>
                <span class="price-unit">TND / nuit</span>
              </div>
              <div class="rating-small">{{ getStars(acc.rating) }} {{ acc.rating }}/5</div>

              <hr class="divider">

              <!-- Date Pickers -->
              <form [formGroup]="dateForm" class="date-form">
                <div class="date-row">
                  <div class="date-field">
                    <label>📅 Arrivée</label>
                    <input type="date" formControlName="checkIn" [min]="today">
                  </div>
                  <div class="date-field">
                    <label>📅 Départ</label>
                    <input type="date" formControlName="checkOut" [min]="tomorrow">
                  </div>
                </div>

                <div class="pax-field">
                  <label>👥 Voyageurs</label>
                  <select formControlName="guests">
                    <option *ngFor="let i of [1,2,3,4,5,6]" [value]="i">{{ i }} personne(s)</option>
                  </select>
                </div>
              </form>

              <!-- Price Breakdown -->
              @if (nightCount() > 0) {
                <div class="price-breakdown">
                  <div class="breakdown-row">
                    <span>{{ acc.pricePerNight | number:'1.0-0' }} TND × {{ nightCount() }} nuit(s)</span>
                    <span>{{ totalPrice() | number:'1.0-0' }} TND</span>
                  </div>
                  <div class="breakdown-row">
                    <span>Taxes & frais</span>
                    <span>{{ taxAmount() | number:'1.0-0' }} TND</span>
                  </div>
                  <hr class="divider">
                  <div class="breakdown-row total-row">
                    <strong>Total</strong>
                    <strong class="total-price">{{ grandTotal() | number:'1.0-0' }} TND</strong>
                  </div>
                </div>
              }

              <button class="btn-book" (click)="onBook()"
                      [disabled]="dateForm.invalid || nightCount() <= 0">
                Réserver maintenant
              </button>

              <p class="no-charge">✅ Annulation gratuite · Pas de frais cachés</p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Loader */
    .loader-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 1rem; color: rgba(255,255,255,0.6); }
    .spinner-large { width: 50px; height: 50px; border: 4px solid rgba(241,37,69,0.2); border-top-color: #f12545; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Hero */
    .hero-banner { min-height: 420px; background-size: cover; background-position: center; position: relative; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.75)); display: flex; flex-direction: column; justify-content: space-between; padding: 2rem; }
    .hero-top, .hero-bottom { display: flex; justify-content: space-between; align-items: flex-start; }
    .hero-bottom { align-items: flex-end; }
    .btn-back { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 20px; border-radius: 30px; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; }
    .btn-back:hover { background: rgba(255,255,255,0.25); }
    .badge-type { background: #f12545; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.5px; }
    h1 { font-size: 2.8rem; font-weight: 800; color: #fff; margin: 0 0 0.5rem 0; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
    .location-row { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.85); font-size: 1.05rem; }
    .rating-big { text-align: right; }
    .stars { font-size: 1.5rem; }
    .score { color: #f1c40f; font-size: 1.2rem; font-weight: 700; }

    /* Layout */
    .page-wrap { background: #0d0f18; min-height: 100vh; }
    .content-grid { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; padding: 2rem; max-width: 1300px; margin: 0 auto; }

    /* Cards */
    .card { background: #161922; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 2rem; margin-bottom: 1.5rem; }
    .card h3 { font-size: 1.2rem; color: #fff; margin: 0 0 1.5rem 0; font-weight: 700; }

    /* Highlights */
    .highlights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .highlight { display: flex; flex-direction: column; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 1rem; font-size: 0.85rem; color: rgba(255,255,255,0.8); text-align: center; }
    .highlight span:first-child { font-size: 1.5rem; }

    /* Description */
    .desc-text { color: rgba(255,255,255,0.65); line-height: 1.8; margin-bottom: 1rem; }

    /* Rooms */
    .rooms-list { display: flex; flex-direction: column; gap: 1rem; }
    .room-item { display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1rem 1.5rem; cursor: pointer; transition: all 0.2s; }
    .room-item:hover { border-color: rgba(241,37,69,0.4); background: rgba(241,37,69,0.05); }
    .room-item.suite { border-color: rgba(255,202,40,0.3); }
    .room-item.suite:hover { border-color: rgba(255,202,40,0.6); background: rgba(255,202,40,0.05); }
    .room-icon { font-size: 2rem; }
    .room-info { flex: 1; }
    .room-info strong { display: block; color: #fff; margin-bottom: 2px; }
    .room-info span { font-size: 0.85rem; color: rgba(255,255,255,0.5); }
    .room-price { font-weight: 700; color: #f12545; white-space: nowrap; }

    /* Booking Widget */
    .booking-widget { position: sticky; top: 100px; height: fit-content; }
    .widget-card { background: #161922; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
    .widget-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .price-big { font-size: 2.2rem; font-weight: 800; color: #fff; }
    .price-unit { color: rgba(255,255,255,0.5); }
    .rating-small { font-size: 0.9rem; color: rgba(255,255,255,0.6); margin-bottom: 1.5rem; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 1.5rem 0; }

    /* Date Form */
    .date-form { margin-bottom: 1rem; }
    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .date-field, .pax-field { display: flex; flex-direction: column; gap: 6px; }
    .date-field label, .pax-field label { font-size: 0.8rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
    input[type="date"], select {
      background: #0d0f18; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      padding: 10px 12px; color: #fff; font-size: 0.95rem; outline: none; width: 100%;
      cursor: pointer; appearance: none; transition: border-color 0.2s;
    }
    input[type="date"]:focus, select:focus { border-color: #f12545; }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; }
    select option { background: #161922; }

    /* Price Breakdown */
    .price-breakdown { background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
    .breakdown-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.9rem; color: rgba(255,255,255,0.65); }
    .total-row { margin-top: 4px; }
    .total-price { color: #f12545; font-size: 1.3rem; }

    /* CTA */
    .btn-book { width: 100%; padding: 16px; background: #f12545; color: #fff; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(241,37,69,0.3); }
    .btn-book:hover:not([disabled]) { background: #ff3355; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(241,37,69,0.4); }
    .btn-book[disabled] { opacity: 0.4; cursor: not-allowed; }
    .no-charge { text-align: center; font-size: 0.82rem; color: rgba(255,255,255,0.4); margin-top: 1rem; margin-bottom: 0; }

    /* Responsive */
    @media (max-width: 1000px) {
      .content-grid { grid-template-columns: 1fr; }
      .booking-widget { position: static; }
      .highlights-grid { grid-template-columns: repeat(2, 1fr); }
      h1 { font-size: 2rem; }
    }
  `]
})
export class AccommodationDetailsPageComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  fb = inject(FormBuilder);

  accommodation = signal<Accommodation | null>(null);
  loading = signal(true);

  today = new Date().toISOString().split('T')[0];
  tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  dateForm = this.fb.group({
    checkIn: [this.store.dates().checkIn || this.today, Validators.required],
    checkOut: [this.store.dates().checkOut || this.tomorrow, Validators.required],
    guests: [this.store.pax().adults || 2, Validators.required]
  });

  nightCount = computed(() => {
    const ci = this.dateForm.get('checkIn')?.value;
    const co = this.dateForm.get('checkOut')?.value;
    if (!ci || !co) return 0;
    const diff = new Date(co).getTime() - new Date(ci).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  });

  totalPrice = computed(() =>
    (this.accommodation()?.pricePerNight || 0) * this.nightCount()
  );
  taxAmount = computed(() => Math.round(this.totalPrice() * 0.1));
  grandTotal = computed(() => this.totalPrice() + this.taxAmount());

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.dataSource.getAccommodationDetails(id).subscribe({
        next: (data) => {
          this.accommodation.set(data);
          this.store.selectedAccommodation.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    }
  }

  selectRoom(type: string) {
    // Pre-fill and scroll to booking widget
    document.querySelector('.booking-widget')?.scrollIntoView({ behavior: 'smooth' });
  }

  onBook() {
    const ci = this.dateForm.value.checkIn!;
    const co = this.dateForm.value.checkOut!;
    const guests = this.dateForm.value.guests!;

    this.store.setDates({ checkIn: ci, checkOut: co });
    this.store.setPax({ adults: Number(guests), children: 0 });

    const accId = this.accommodation()?.id;
    this.router.navigate(['/hebergement', accId, 'book']);
  }

  formatType(type: string): string {
    const map: Record<string, string> = {
      'HOTEL': '🏨 Hôtel',
      'MAISON_HOTE': '🏡 Maison d\'hôtes',
      'GUESTHOUSE': '🛖 Gîte rural',
      'AUTRE': '🏠 Hébergement'
    };
    return map[type] || type;
  }

  getStars(rating: number): string {
    const full = Math.floor(rating);
    return '★'.repeat(full) + (rating % 1 >= 0.5 ? '½' : '');
  }

  getHotelImage(acc: Accommodation): string {
    // Generate a deterministic Unsplash image based on city and type
    const keywords = ['hotel', acc.cityName || 'tunisia', 'luxury'];
    const seed = acc.id || 1;
    return `https://source.unsplash.com/1200x600/?${keywords.join(',')}&sig=${seed}`;
  }
}
