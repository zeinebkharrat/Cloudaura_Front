import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="confirmation-card glass-container">
        <div class="success-icon">✅</div>
        <h1>Congratulations!</h1>
        <p>Your booking has been confirmed successfully.</p>
        
        <div class="reservation-box">
          <div class="id">Confirmation number: <span>#{{ reservationId() }}</span></div>
          <div class="type">Type: {{ type() === 'transport' ? 'Transport' : 'Accommodation' }}</div>
        </div>

        <div class="qr-placeholder">
          <div class="qr-code"></div>
          <p>Scan this code when you arrive</p>
        </div>

        <div class="actions">
          <button class="btn-primary" routerLink="/">Back to home</button>
          <button class="btn-ghost" onclick="window.print()">Print receipt</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 5rem 2rem; display: flex; justify-content: center; text-align: center; }
    .confirmation-card { max-width: 500px; padding: 3rem; }
    .success-icon { font-size: 4rem; margin-bottom: 1.5rem; }
    h1 { font-size: 2.2rem; color: white; margin-bottom: 0.5rem; }
    p { color: rgba(255,255,255,0.7); margin-bottom: 2rem; }
    
    .reservation-box { background: rgba(0, 212, 255, 0.1); border: 1px solid var(--primary-color); border-radius: 8px; padding: 1rem; margin-bottom: 2rem; }
    .id span { font-family: monospace; font-weight: 700; color: var(--primary-color); }
    
    .qr-placeholder { margin-bottom: 2.5rem; }
    .qr-code { width: 150px; height: 150px; background: white; margin: 0 auto 1rem; border: 10px solid white; border-radius: 8px; 
      background-image: repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0/ 20px 20px;
    }
    
    .actions { display: flex; flex-direction: column; gap: 1rem; }
    .btn-primary { width: 100%; padding: 12px; background: var(--primary-color); color: #000; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; }
    .btn-ghost { background: none; border: none; color: white; cursor: pointer; text-decoration: underline; }
  `]
})
export class BookingConfirmationComponent implements OnInit {
  route = inject(ActivatedRoute);
  store = inject(TripContextStore);
  
  reservationId = signal('');
  type = signal('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.reservationId.set(params['id'] || 'ERR-404');
      this.type.set(params['type'] || 'unknown');
    });
  }
}
