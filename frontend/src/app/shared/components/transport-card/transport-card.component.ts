import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { Transport, TransportType, TRANSPORT_TYPE_META } from '../../../core/models/travel.models';

@Component({
  selector: 'app-transport-card',
  standalone: true,
  imports: [CommonModule, TagModule, ButtonModule, RippleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" pRipple (click)="select.emit()">
      <div class="card-header">
        <p-tag [value]="getTypeLabel()" [severity]="getTypeSeverity()"></p-tag>
        @if (transport.availableSeats !== undefined && transport.availableSeats < 5) {
          <span class="low-seats"><i class="pi pi-exclamation-triangle"></i> {{ transport.availableSeats }} places</span>
        }
      </div>

      <div class="card-schedule">
        <div class="time-col">
          <span class="time">{{ formatTime(transport.departureTime) }}</span>
          <span class="city">{{ transport.departureCityName }}</span>
        </div>
        <div class="arrow">
          <div class="dot"></div>
          <div class="line">
            @if (transport.durationMinutes) {
              <span class="dur">{{ formatDuration(transport.durationMinutes) }}</span>
            }
          </div>
          <div class="dot"></div>
        </div>
        <div class="time-col right">
          <span class="time">{{ formatTime(transport.arrivalTime) }}</span>
          <span class="city">{{ transport.arrivalCityName }}</span>
        </div>
      </div>

      <div class="card-footer">
        <span class="seats"><i class="pi pi-users"></i> {{ transport.availableSeats ?? transport.capacity }} dispo.</span>
        <div class="price-area">
          <span class="price">{{ transport.price }} <small>TND</small></span>
          <button pButton icon="pi pi-arrow-right" class="p-button-sm p-button-rounded"></button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: var(--surface-card); border: 1px solid var(--surface-border);
      border-radius: 16px; padding: 1.25rem; cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card:hover {
      border-color: var(--primary-color);
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(29,158,117,0.12);
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .low-seats { font-size: 0.73rem; color: var(--orange-400); display: flex; align-items: center; gap: 3px; }

    .card-schedule { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .time-col { display: flex; flex-direction: column; }
    .time-col.right { text-align: right; }
    .time { font-size: 1.2rem; font-weight: 800; color: var(--text-color); }
    .city { font-size: 0.75rem; color: var(--text-color); opacity: 0.5; }
    .arrow { flex: 1; display: flex; align-items: center; gap: 4px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary-color); flex-shrink: 0; }
    .line { flex: 1; height: 2px; background: var(--surface-border); position: relative; }
    .dur {
      position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
      font-size: 0.65rem; color: var(--text-color); opacity: 0.4; white-space: nowrap;
    }

    .card-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 0.75rem; border-top: 1px solid var(--surface-border);
    }
    .seats { font-size: 0.8rem; color: var(--text-color); opacity: 0.5; display: flex; align-items: center; gap: 0.3rem; }
    .price-area { display: flex; align-items: center; gap: 0.75rem; }
    .price { font-size: 1.3rem; font-weight: 800; color: var(--primary-color); }
    .price small { font-size: 0.65rem; font-weight: 500; opacity: 0.6; }
  `]
})
export class TransportCardComponent {
  @Input() transport!: Transport;
  @Output() select = new EventEmitter<void>();

  getTypeLabel(): string {
    return TRANSPORT_TYPE_META[this.transport.type]?.label ?? this.transport.type;
  }

  getTypeSeverity(): 'success' | 'info' | 'warning' | 'danger' | undefined {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      BUS: 'success', VAN: 'info', TAXI: 'warning', PLANE: 'danger', CAR: 'info'
    };
    return map[this.transport.type];
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
  }
}
