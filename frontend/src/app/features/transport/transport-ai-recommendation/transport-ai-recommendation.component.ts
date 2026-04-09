import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import {
  City,
  EngineRecommendationRequest,
  EngineRecommendationResponse,
  EngineTransportOption,
} from '../../../core/models/travel.models';

// ── Transport visual metadata ────────────────────────────────────────────────
const TRANSPORT_META: Record<string, { icon: string; color: string; bg: string }> = {
  'Taxi':                    { icon: '/icones/taxi.png',  color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  'Louage (Taxi Collectif)': { icon: '/icones/taxi.png',  color: '#60a5fa', bg: 'rgba(96,165,250,0.10)'  },
  'Bus SNTRI':               { icon: '/icones/bus.png',   color: '#34d399', bg: 'rgba(52,211,153,0.10)'  },
  'Avion (Tunisair Express)':{ icon: '/icones/plane.png', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
  'Location de Voiture':     { icon: '/icones/car.png',   color: '#fb923c', bg: 'rgba(251,146,60,0.10)'  },
  'Train SNCFT':             { icon: '/icones/bus.png',   color: '#38bdf8', bg: 'rgba(56,189,248,0.10)'  },
};

/** English labels for engine `type` strings (icon lookup still uses the raw API key). */
const TRANSPORT_TYPE_LABEL_EN: Record<string, string> = {
  Taxi: 'Taxi',
  'Louage (Taxi Collectif)': 'Shared taxi (louage)',
  'Bus SNTRI': 'SNTRI bus',
  'Avion (Tunisair Express)': 'Flight (Tunisair Express)',
  'Location de Voiture': 'Car rental',
  'Train SNCFT': 'SNCFT train',
};

@Component({
  selector: 'app-transport-ai-recommendation',
  standalone: false,
  template: `
<div class="ai-page">
  <div class="ai-container">

    <!-- ══ HEADER ══════════════════════════════════════════════════ -->
    <div class="ai-header">
      <span class="ai-badge"><i class="pi pi-microchip"></i> AI ENGINE</span>
      <h1 class="ai-title">Transport Intelligence Engine</h1>
      <p class="ai-subtitle">
        Real-time analysis from the database · Dynamic pricing, duration, and availability
      </p>
    </div>

    <!-- ══ SEARCH FORM ══════════════════════════════════════════════ -->
    @if (!showResults()) {
    <div class="search-card" [class.loading-card]="loading()">
      <form [formGroup]="form" (ngSubmit)="submit()">

        <!-- Row 1: cities -->
        <div class="form-grid-2">
          <div class="fg">
            <label class="fg-label">From city</label>
            <select formControlName="fromCityId" class="fg-select">
              <option value="">— Select —</option>
              @for (c of cities(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
            @if (form.get('fromCityId')?.invalid && form.get('fromCityId')?.touched) {
              <span class="fg-err">From city is required</span>
            }
          </div>
          <div class="fg">
            <label class="fg-label">To city</label>
            <select formControlName="toCityId" class="fg-select">
              <option value="">— Select —</option>
              @for (c of cities(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
            @if (form.get('toCityId')?.invalid && form.get('toCityId')?.touched) {
              <span class="fg-err">To city is required</span>
            }
          </div>
        </div>

        <!-- Row 2: date + passengers -->
        <div class="form-grid-2">
          <div class="fg">
            <label class="fg-label">Travel date</label>
            <input type="date" formControlName="date" class="fg-input" [min]="today" />
          </div>
          <div class="fg">
            <label class="fg-label">Number of passengers</label>
            <input type="number" formControlName="passengers" class="fg-input"
                   min="1" max="20" placeholder="1" />
          </div>
        </div>

        <!-- Preference -->
        <div class="pref-section">
          <label class="pref-title">Your priority</label>
          <div class="pref-grid">
            @for (opt of preferences; track opt.value) {
              <label class="pref-opt" [class.selected]="form.get('preference')?.value === opt.value">
                <input type="radio" formControlName="preference" [value]="opt.value" />
                <span class="pref-icon">
                  @if (opt.iconSrc) {
                    <img [src]="opt.iconSrc" alt="" class="pref-icon-img" />
                  } @else if (opt.iconClass) {
                    <i [class]="opt.iconClass + ' pref-pi'" aria-hidden="true"></i>
                  }
                </span>
                <span class="pref-label">{{ opt.label }}</span>
                <span class="pref-desc">{{ opt.desc }}</span>
              </label>
            }
          </div>
        </div>

        @if (error()) {
          <div class="form-error">{{ error() }}</div>
        }

        <button type="submit" class="btn-search" [disabled]="loading()">
          @if (loading()) { <span class="spin"></span> Analysing… }
          @else { <i class="pi pi-microchip"></i> Run AI analysis }
        </button>
      </form>
    </div>
    }

    <!-- ══ LOADING PANEL ════════════════════════════════════════════ -->
    @if (loading()) {
    <div class="loading-panel">
      <div class="wave-bars">
        @for (i of [1,2,3,4,5]; track i) { <div class="bar" [style.--i]="i"></div> }
      </div>
      <h3 class="loading-title">AI engine at work</h3>
      <div class="loading-steps">
        @for (step of loadingSteps; track step) {
          <div class="ls-item"><span class="ls-dot"></span>{{ step }}</div>
        }
      </div>
    </div>
    }

    <!-- ══ RESULTS ═══════════════════════════════════════════════════ -->
    @if (showResults() && rec()) {
    <div class="results-wrap">

      <!-- Route summary bar -->
      <div class="route-bar">
        <span class="rb-city">{{ rec()!.fromCity }}</span>
        <span class="rb-arrow">
          <img src="/icones/plane.png" alt="→" style="width:1.4rem;height:1.4rem;object-fit:contain;opacity:.7;" />
        </span>
        <span class="rb-city">{{ rec()!.toCity }}</span>
        <div class="rb-pills">
          <span class="rb-pill">{{ rec()!.distanceKm }} km</span>
          <span class="rb-pill">{{ rec()!.passengers }} passager{{ rec()!.passengers > 1 ? 's' : '' }}</span>
          <button class="rb-reset" (click)="reset()">Edit</button>
        </div>
      </div>

      <!-- Best option card -->
      @if (best()) {
      <div class="best-card" [style.border-color]="getMeta(best()!.type).color">
        <div class="best-ribbon"><i class="pi pi-trophy ribbon-trophy" aria-hidden="true"></i> Best option</div>
        <div class="bc-header">
          <div class="bc-icon" [style.background]="getMeta(best()!.type).bg">
            <img [src]="getMeta(best()!.type).icon"
                 [alt]="typeLabelEn(best()!.type)" class="transport-icon-img" />
          </div>
          <div class="bc-info">
            <h2>{{ typeLabelEn(best()!.type) }}</h2>
            <p class="bc-desc">{{ best()!.description }}</p>
          </div>
          <div class="bc-score-badge" [style.background]="getMeta(best()!.type).color">
            {{ best()!.aiScore }}<small>/100</small>
          </div>
        </div>

        <div class="bc-price" [style.color]="getMeta(best()!.type).color">
          {{ best()!.priceFormatted }}
          <span class="bc-ppp">i.e. {{ best()!.pricePerPerson | number:'1.2-2' }} TND / person</span>
        </div>

        <div class="bc-stats">
          <div class="bcs">
            <span class="bcs-label">Departure</span>
            <span class="bcs-val">{{ best()!.departureTime }}</span>
          </div>
          <div class="bcs">
            <span class="bcs-label">Arrival</span>
            <span class="bcs-val" [style.color]="getMeta(best()!.type).color">
              {{ best()!.arrivalTime }}
            </span>
          </div>
          <div class="bcs">
            <span class="bcs-label">Duration</span>
            <span class="bcs-val">{{ best()!.duration }}</span>
          </div>
          <div class="bcs">
            <span class="bcs-label">Seats left</span>
            <span class="bcs-val" [class.seats-low]="best()!.seatsLeft <= 5">
              {{ best()!.seatsLeft }}
            </span>
          </div>
        </div>

        <div class="bc-features">
          @for (f of (best()!.features ?? []); track f) {
            <span class="bc-feat">✓ {{ f }}</span>
          }
        </div>

        <button class="btn-choose" [style.background]="getMeta(best()!.type).color"
                (click)="selectOption(best()!)">
          Choose this option →
        </button>
      </div>
      }

      <!-- Reason card -->
      @if (rec()?.recommendationReason) {
      <div class="reason-card">
        <div class="reason-icon"><i class="pi pi-info-circle"></i></div>
        <p>{{ rec()!.recommendationReason }}</p>
      </div>
      }

      <!-- Combination tip -->
      @if (rec()?.combinationSuggestion) {
      <div class="tip-card">
        <i class="pi pi-lightbulb"></i>
        <p>{{ rec()!.combinationSuggestion }}</p>
      </div>
      }

      <!-- Alternatives -->
      @if (alts().length > 0) {
      <h3 class="alts-title">Available alternatives</h3>
      <div class="alts-grid">
        @for (opt of alts(); track opt.rawType) {
        <div class="alt-card"
             [style.border-color]="getMeta(opt.type).color + '55'">
          <div class="alt-head">
            <span class="alt-icon">
              <img [src]="getMeta(opt.type).icon" [alt]="typeLabelEn(opt.type)" class="transport-icon-img-sm" />
            </span>
            <div>
              <div class="alt-type" [style.color]="getMeta(opt.type).color">{{ typeLabelEn(opt.type) }}</div>
              <div class="alt-score">AI score: {{ opt.aiScore }}/100</div>
            </div>
          </div>
          <div class="alt-price" [style.color]="getMeta(opt.type).color">{{ opt.priceFormatted }}</div>
          <div class="alt-meta">
            <span><i class="pi pi-clock alt-meta-pi" aria-hidden="true"></i> {{ opt.duration }}</span>
            <span><i class="pi pi-arrow-right-arrow-left alt-meta-pi" aria-hidden="true"></i> {{ opt.departureTime }} → {{ opt.arrivalTime }}</span>
            <span [class.low]="opt.seatsLeft <= 5">{{ opt.seatsLeft }} seats</span>
          </div>
          <button class="alt-btn" (click)="selectOption(opt)">Choose →</button>
        </div>
        }
      </div>
      }

      <!-- Full comparison table -->
      <h3 class="table-title">Full comparison</h3>
      <div class="compare-table-wrap">
        <div class="ct-head">
          <span>Mode</span><span>Total price</span><span>Per person</span>
          <span>Departure</span><span>Arrival</span><span>Duration</span>
          <span>Seats</span><span>AI score</span>
        </div>
        @for (opt of allOptions(); track opt.rawType) {
        <div class="ct-row"
             [class.ct-best]="opt === best()"
             [class.ct-unavail]="!opt.available">
          <span class="ct-mode">
            <img [src]="getMeta(opt.type).icon" [alt]="typeLabelEn(opt.type)" class="transport-icon-img-xs" />
            {{ typeLabelEn(opt.type) }}
          </span>
          <span class="ct-price" [style.color]="opt.available ? getMeta(opt.type).color : 'rgba(255,255,255,0.3)'">
            {{ opt.priceFormatted }}
          </span>
          <span>{{ opt.pricePerPerson | number:'1.2-2' }} TND</span>
          <span>{{ opt.departureTime }}</span>
          <span>{{ opt.arrivalTime }}</span>
          <span>{{ opt.duration }}</span>
          <span>
            @if (opt.available) { {{ opt.seatsLeft }} }
            @else { <span class="ct-unavail-txt">{{ opt.availabilityInfo || 'Unavailable' }}</span> }
          </span>
          <span class="ct-score" [style.color]="opt.available ? getMeta(opt.type).color : 'rgba(255,255,255,0.2)'">
            {{ opt.available ? opt.aiScore + '/100' : '—' }}
          </span>
        </div>
        }
      </div>

    </div><!-- /results-wrap -->
    }

  </div><!-- /ai-container -->
</div><!-- /ai-page -->
  `,
  styles: [`
:host { display: block; }
.ai-page { min-height: 100vh; padding: 2rem 1rem 4rem; }
.ai-container { max-width: 900px; margin: 0 auto; }

/* ── Header ─────────────────────────────────────────────────────── */
.ai-header { text-align: center; margin-bottom: 2.5rem; }
.ai-badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: linear-gradient(135deg, rgba(241,37,69,.15), rgba(241,37,69,.05));
  border: 1px solid rgba(241,37,69,.3); color: #f12545;
  padding: 0.35rem 1rem; border-radius: 50px; font-size: 0.75rem;
  font-weight: 700; letter-spacing: 1px; margin-bottom: 1rem;
}
.ai-title { font-size: 2rem; font-weight: 800; color: #fff; margin: 0 0 0.5rem; }
.ai-subtitle { color: rgba(255,255,255,0.45); font-size: 0.9rem; max-width: 560px; margin: 0 auto; }

/* ── Search card ────────────────────────────────────────────────── */
.search-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; padding: 2rem;
}
.loading-card { opacity: 0.5; pointer-events: none; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
.fg { display: flex; flex-direction: column; gap: 0.4rem; }
.fg-label { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
.fg-input, .fg-select {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 0.7rem 1rem; color: #fff;
  font-size: 0.9rem; outline: none; transition: border-color 0.2s;
}
.fg-input:focus, .fg-select:focus { border-color: rgba(241,37,69,0.5); }
.fg-select option { background: #1a1d2e; color: #fff; }
.fg-err { font-size: 0.75rem; color: #f12545; }
.form-error {
  background: rgba(241,37,69,0.1); border: 1px solid rgba(241,37,69,0.3);
  border-radius: 10px; padding: 0.75rem 1rem; color: #f87171;
  font-size: 0.85rem; margin-bottom: 1rem;
}

/* ── Preference ────────────────────────────────────────────────── */
.pref-section { margin-bottom: 1.5rem; }
.pref-title { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.75rem; }
.pref-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
.pref-opt {
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 0.8rem 0.5rem; cursor: pointer;
  transition: all 0.2s; text-align: center;
}
.pref-opt input { display: none; }
.pref-opt.selected { border-color: rgba(241,37,69,0.5); background: rgba(241,37,69,0.08); }
.pref-icon { display: flex; align-items: center; justify-content: center; min-height: 2rem; }
.pref-icon-img { width: 28px; height: 28px; object-fit: contain; }
.pref-pi { font-size: 1.2rem; color: rgba(232, 213, 255, 0.95); }
.pref-label { font-size: 0.8rem; font-weight: 700; color: #fff; }
.pref-desc { font-size: 0.68rem; color: rgba(255,255,255,0.4); }

/* ── Search button ─────────────────────────────────────────────── */
.btn-search {
  width: 100%; padding: 0.9rem; border: none; border-radius: 12px;
  background: linear-gradient(135deg, #f12545, #c41230);
  color: #fff; font-size: 0.95rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: all 0.2s; letter-spacing: 0.5px;
}
.btn-search:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(241,37,69,0.35); }
.btn-search:disabled { opacity: 0.6; cursor: not-allowed; }
.spin {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Loading panel ─────────────────────────────────────────────── */
.loading-panel {
  text-align: center; padding: 3rem 2rem;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px; margin-top: 1.5rem;
}
.wave-bars { display: flex; justify-content: center; align-items: flex-end; gap: 5px; height: 50px; margin-bottom: 1.5rem; }
.bar {
  width: 6px; border-radius: 3px; background: linear-gradient(to top, #f12545, #ff8c94);
  animation: wave 1.2s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.12s);
}
.bar:nth-child(1){height:20px} .bar:nth-child(2){height:35px} .bar:nth-child(3){height:50px}
.bar:nth-child(4){height:35px} .bar:nth-child(5){height:20px}
@keyframes wave { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }
.loading-title { font-size: 1.2rem; font-weight: 700; color: #fff; margin: 0 0 1rem; }
.loading-steps { display: flex; flex-direction: column; gap: 0.5rem; text-align: left; max-width: 320px; margin: 0 auto; }
.ls-item { display: flex; align-items: center; gap: 0.6rem; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
.ls-dot { width: 6px; height: 6px; border-radius: 50%; background: #f12545; flex-shrink: 0; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }

/* ── Route bar ─────────────────────────────────────────────────── */
.route-bar {
  display: flex; align-items: center; gap: 0.75rem;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 0.9rem 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap;
}
.rb-city { font-size: 1rem; font-weight: 700; color: #fff; }
.rb-arrow { display: flex; align-items: center; }
.rb-pills { display: flex; gap: 0.5rem; margin-left: auto; flex-wrap: wrap; align-items: center; }
.rb-pill {
  background: rgba(241,37,69,0.12); border: 1px solid rgba(241,37,69,0.2);
  color: #f12545; padding: 0.2rem 0.7rem; border-radius: 50px; font-size: 0.78rem; font-weight: 600;
}
.rb-reset {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.6); padding: 0.25rem 0.8rem; border-radius: 50px;
  font-size: 0.78rem; cursor: pointer; transition: all 0.2s;
}
.rb-reset:hover { border-color: rgba(241,37,69,0.4); color: #f12545; }

/* ── Best option card ──────────────────────────────────────────── */
.best-card {
  position: relative; border: 1.5px solid;
  background: rgba(255,255,255,0.03); border-radius: 20px; padding: 1.75rem;
  margin-bottom: 1.25rem; overflow: hidden;
}
.best-ribbon {
  position: absolute; top: 0; right: 0;
  display: flex; align-items: center; gap: 0.35rem;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.5px;
  padding: 0.35rem 1rem; border-bottom-left-radius: 12px;
}
.ribbon-trophy { font-size: 0.85rem; }
.bc-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.bc-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.transport-icon-img { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.bc-info { flex: 1; }
.bc-info h2 { font-size: 1.3rem; font-weight: 800; color: #fff; margin: 0 0 0.2rem; }
.bc-desc { font-size: 0.82rem; color: rgba(255,255,255,0.45); margin: 0; }
.bc-score-badge {
  font-size: 1.4rem; font-weight: 900; color: #fff;
  padding: 0.4rem 0.9rem; border-radius: 12px;
}
.bc-score-badge small { font-size: 0.65rem; font-weight: 400; opacity: 0.8; margin-left: 1px; }
.bc-price { font-size: 2rem; font-weight: 900; margin-bottom: 1rem; }
.bc-ppp { font-size: 0.8rem; font-weight: 400; color: rgba(255,255,255,0.4); margin-left: 0.5rem; }
.bc-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
.bcs { background: rgba(255,255,255,0.04); border-radius: 10px; padding: 0.7rem; text-align: center; }
.bcs-label { display: block; font-size: 0.68rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 0.25rem; }
.bcs-val { font-size: 1rem; font-weight: 700; color: #fff; }
.seats-low { color: #f87171 !important; }
.bc-features { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.bc-feat {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50px; padding: 0.25rem 0.7rem; font-size: 0.75rem; color: rgba(255,255,255,0.6);
}
.btn-choose {
  width: 100%; padding: 0.8rem; border: none; border-radius: 12px;
  color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer;
  transition: all 0.2s; letter-spacing: 0.3px;
}
.btn-choose:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

/* ── Reason / Tip cards ────────────────────────────────────────── */
.reason-card {
  display: flex; align-items: flex-start; gap: 0.75rem;
  background: rgba(96,165,250,0.06); border: 1px solid rgba(96,165,250,0.2);
  border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1rem; color: rgba(255,255,255,0.7); font-size: 0.88rem;
}
.reason-icon { color: #60a5fa; font-size: 1.1rem; flex-shrink: 0; margin-top: 2px; }
.tip-card {
  display: flex; align-items: flex-start; gap: 0.75rem;
  background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.2);
  border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; color: rgba(255,255,255,0.7); font-size: 0.88rem;
}
.tip-card i { color: #fbbf24; font-size: 1.1rem; flex-shrink: 0; margin-top: 2px; }

/* ── Alternatives ──────────────────────────────────────────────── */
.alts-title, .table-title {
  font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.7);
  margin: 1.5rem 0 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;
}
.alts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.alt-card {
  background: rgba(255,255,255,0.03); border: 1px solid; border-radius: 16px; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.alt-head { display: flex; align-items: center; gap: 0.6rem; }
.alt-icon { display: flex; align-items: center; }
.transport-icon-img-sm { width: 26px; height: 26px; object-fit: contain; }
.alt-type { font-size: 0.88rem; font-weight: 700; }
.alt-score { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
.alt-price { font-size: 1.2rem; font-weight: 800; }
.alt-meta { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.75rem; color: rgba(255,255,255,0.45); }
.alt-meta span { display: flex; align-items: center; gap: 0.35rem; }
.alt-meta-pi { font-size: 0.78rem; opacity: 0.8; flex-shrink: 0; }
.alt-meta .low { color: #f87171; }
.alt-btn {
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7); border-radius: 8px; padding: 0.45rem 0.75rem;
  font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: center;
}
.alt-btn:hover { border-color: rgba(241,37,69,0.4); color: #f12545; }

/* ── Comparison table ──────────────────────────────────────────── */
.compare-table-wrap {
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; overflow: hidden;
}
.ct-head, .ct-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr;
  gap: 0; padding: 0.7rem 1rem; font-size: 0.78rem;
}
.ct-head {
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4);
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
}
.ct-row { border-top: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); align-items: center; }
.ct-row.ct-best { background: rgba(241,37,69,0.06); }
.ct-row.ct-unavail { opacity: 0.4; }
.ct-mode { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; color: #fff; }
.transport-icon-img-xs { width: 18px; height: 18px; object-fit: contain; flex-shrink: 0; }
.ct-price { font-weight: 700; }
.ct-score { font-weight: 700; }
.ct-unavail-txt { font-size: 0.68rem; color: rgba(255,100,100,0.7); }

@media (max-width: 640px) {
  .form-grid-2 { grid-template-columns: 1fr; }
  .pref-grid { grid-template-columns: repeat(2, 1fr); }
  .bc-stats { grid-template-columns: repeat(2, 1fr); }
  .ct-head, .ct-row { grid-template-columns: 2fr 1fr 1fr; font-size: 0.7rem; }
  .ct-head span:nth-child(n+4), .ct-row span:nth-child(n+4) { display: none; }
}
  `]
})
export class TransportAiRecommendationComponent implements OnInit {
  private ds     = inject(DATA_SOURCE_TOKEN);
  private fb     = inject(FormBuilder);
  private router = inject(Router);

  cities  = signal<City[]>([]);
  loading = signal(false);
  showResults = signal(false);
  rec     = signal<EngineRecommendationResponse | null>(null);
  error   = signal<string | null>(null);
  today   = new Date().toISOString().split('T')[0];

  readonly preferences: Array<{
    value: string;
    label: string;
    desc: string;
    iconSrc?: string;
    iconClass?: string;
  }> = [
    { value: 'budget', iconSrc: 'icones/money-bag.png', label: 'Budget', desc: 'Lowest price' },
    { value: 'fast', iconClass: 'pi pi-bolt', label: 'Fast', desc: 'Shortest travel time' },
    { value: 'comfort', iconClass: 'pi pi-star', label: 'Comfort', desc: 'Maximum comfort' },
    { value: 'balanced', iconClass: 'pi pi-sliders-h', label: 'Balanced', desc: 'Price / time / comfort' },
  ];

  readonly loadingSteps = [
    'Reading transport data from the database…',
    'Computing realistic distances and durations…',
    'Checking seat availability…',
    'Applying pricing rules…',
    'Validating and auto-correcting…',
    'AI scoring and ranking options…',
  ];

  form = this.fb.group({
    fromCityId: [null as number | null, Validators.required],
    toCityId:   [null as number | null, Validators.required],
    date:       [this.today, Validators.required],
    passengers: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    preference: ['balanced', Validators.required],
  });

  allOptions = computed<EngineTransportOption[]>(() => this.rec()?.allOptions ?? []);
  best       = computed<EngineTransportOption | null>(() => this.rec()?.bestOption ?? null);
  alts       = computed<EngineTransportOption[]>(() => this.rec()?.alternatives ?? []);

  ngOnInit() {
    this.ds.getCities().subscribe(data => this.cities.set(data));
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.value;
    if (v.fromCityId === v.toCityId) {
      this.error.set('From city and to city must be different.');
      return;
    }
    this.error.set(null);

    const request: EngineRecommendationRequest = {
      fromCityId: Number(v.fromCityId),
      toCityId:   Number(v.toCityId),
      date:       v.date ?? this.today,
      passengers: Number(v.passengers) || 1,
      preference: v.preference ?? 'balanced',
    };

    this.loading.set(true);
    this.showResults.set(false);

    this.ds.getEngineRecommendations(request).subscribe({
      next: (res) => {
        this.rec.set(res);
        this.loading.set(false);
        this.showResults.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Analysis failed. Please try again.');
      },
    });
  }

  reset() {
    this.showResults.set(false);
    this.rec.set(null);
    this.error.set(null);
  }

  selectOption(opt: EngineTransportOption) {
    const v = this.form.value;
    if (opt.transportId) {
      this.router.navigate(['/transport/booking'], {
        queryParams: { transportId: opt.transportId, passengers: v.passengers ?? 1 },
      });
    } else {
      this.router.navigate(['/transport'], {
        queryParams: {
          from: v.fromCityId,
          to:   v.toCityId,
          date: v.date,
          passengers: v.passengers ?? 1,
          transportType: opt.rawType,
        },
      });
    }
  }

  getMeta(type: string): { icon: string; color: string; bg: string } {
    return TRANSPORT_META[type] ?? { icon: '/icones/taxi.png', color: '#8c9bb0', bg: 'rgba(140,155,176,0.08)' };
  }

  typeLabelEn(type: string): string {
    return TRANSPORT_TYPE_LABEL_EN[type] ?? type;
  }

  getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Very good';
    if (score >= 60) return 'Good';
    if (score >= 45) return 'Fair';
    return 'Basic';
  }
}
