import {
  Component, Input, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, signal, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { Client, IMessage } from '@stomp/stompjs';
import { TrackingUpdate } from '../../../core/models/travel.models';

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tracking-wrapper">
      <div #trackingMap class="tracking-map-container"></div>
      <div class="tracking-info-bar">
        <div class="tracking-status" [class.arrived]="status() === 'ARRIVED'">
          <i [class]="status() === 'ARRIVED' ? 'pi pi-check-circle' : 'pi pi-spin pi-spinner'"></i>
          <span>{{ status() === 'ARRIVED' ? 'Arrive a destination' : 'En transit...' }}</span>
        </div>
        <div class="tracking-progress">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progress()"></div>
          </div>
          <span class="progress-label">{{ progress() }}%</span>
        </div>
        @if (eta()) {
          <div class="tracking-eta">
            <i class="pi pi-clock"></i>
            <span>ETA: {{ eta() }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tracking-wrapper {
      border-radius: 12px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .tracking-map-container { width: 100%; height: 400px; z-index: 1; }
    .tracking-info-bar {
      display: flex; align-items: center; gap: 16px;
      padding: 12px 16px;
      background: rgba(15, 23, 42, 0.92); color: #e2e8f0;
      font-size: 0.85rem; flex-wrap: wrap;
    }
    .tracking-status {
      display: flex; align-items: center; gap: 6px; font-weight: 600;
    }
    .tracking-status i { color: #f12545; }
    .tracking-status.arrived i { color: #22c55e; }
    .tracking-progress { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 120px; }
    .progress-bar {
      flex: 1; height: 6px; border-radius: 3px;
      background: rgba(255,255,255,0.1); overflow: hidden;
    }
    .progress-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #f12545, #ff6b6b);
      transition: width 0.5s ease;
    }
    .progress-label { font-size: 0.8rem; color: #94a3b8; min-width: 36px; }
    .tracking-eta {
      display: flex; align-items: center; gap: 6px;
      color: #94a3b8; font-size: 0.82rem;
    }
    .tracking-eta i { color: #f12545; font-size: 0.85rem; }
  `]
})
export class TrackingMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('trackingMap') mapEl!: ElementRef<HTMLDivElement>;

  @Input() reservationId!: number;
  @Input() fromLat?: number;
  @Input() fromLng?: number;
  @Input() toLat?: number;
  @Input() toLng?: number;
  @Input() fromName = '';
  @Input() toName = '';

  status = signal<'IN_TRANSIT' | 'ARRIVED'>('IN_TRANSIT');
  progress = signal(0);
  eta = signal('');

  private http = inject(HttpClient);
  private map?: L.Map;
  private routeLayer?: L.LayerGroup;
  private vehicleMarker?: L.Marker;
  private stompClient?: Client;
  private totalSteps = 100;
  private durationMinutes = 0;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initMap();
    this.loadRoute();
    this.startTracking();
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [35.5, 10.0],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(this.map);

    this.routeLayer = L.layerGroup().addTo(this.map);
  }

  private loadRoute(): void {
    if (this.fromLat != null && this.fromLng != null && this.toLat != null && this.toLng != null) {
      const from: L.LatLngTuple = [this.fromLat, this.fromLng];
      const to: L.LatLngTuple = [this.toLat, this.toLng];

      L.polyline([from, to], {
        color: 'rgba(241, 37, 69, 0.3)', weight: 4, dashArray: '8 6'
      }).addTo(this.routeLayer!);

      L.marker(from, { icon: this.dotIcon('#22c55e') })
        .bindPopup(`<b>${this.fromName}</b><br/>Depart`).addTo(this.routeLayer!);
      L.marker(to, { icon: this.dotIcon('#f12545') })
        .bindPopup(`<b>${this.toName}</b><br/>Arrivee`).addTo(this.routeLayer!);

      this.vehicleMarker = L.marker(from, { icon: this.vehicleIcon() }).addTo(this.routeLayer!);
      this.map?.fitBounds([from, to], { padding: [50, 50] });
    }
  }

  private startTracking(): void {
    this.http.post<any>(`/api/tracking/${this.reservationId}/start`, {}).subscribe({
      next: () => this.connectWebSocket(),
      error: () => this.connectWebSocket()
    });
  }

  private connectWebSocket(): void {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const brokerURL = `${proto}//${window.location.host}/ws-native`;

    this.stompClient = new Client({
      brokerURL,
      reconnectDelay: 5000,
      onConnect: () => {
        this.stompClient!.subscribe(`/topic/tracking/${this.reservationId}`, (msg: IMessage) => {
          const update = JSON.parse(msg.body) as TrackingUpdate;
          this.handleUpdate(update);
        });
      },
    });
    this.stompClient.activate();
  }

  private handleUpdate(update: TrackingUpdate): void {
    if (update.status) {
      this.status.set(update.status);
    }
    if (update.progress != null) {
      this.progress.set(update.progress);
    }
    if (update.totalSteps != null) {
      this.totalSteps = update.totalSteps;
    }

    if (update.lat != null && update.lng != null && this.vehicleMarker) {
      const newPos = L.latLng(update.lat, update.lng);
      this.vehicleMarker.setLatLng(newPos);
      this.map?.panTo(newPos, { animate: true, duration: 0.5 });
    }

    if (update.status === 'ARRIVED') {
      this.eta.set('Arrive !');
    } else if (update.step != null && update.totalSteps != null) {
      const remainingSteps = update.totalSteps - update.step;
      const etaSeconds = remainingSteps * 2;
      const etaMin = Math.ceil(etaSeconds / 60);
      this.eta.set(etaMin > 0 ? `~${etaMin} min (simulation)` : '');
    }
  }

  private stopTracking(): void {
    this.http.post(`/api/tracking/${this.reservationId}/stop`, {}).subscribe();
    this.stompClient?.deactivate();
  }

  private dotIcon(color: string): L.DivIcon {
    return L.divIcon({
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10], className: ''
    });
  }

  private vehicleIcon(): L.DivIcon {
    return L.divIcon({
      html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f12545,#ff6b6b);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(241,37,69,.5);border:3px solid #fff;">
               <span style="font-size:14px;">&#128663;</span>
             </div>`,
      iconSize: [34, 34], iconAnchor: [17, 17], className: ''
    });
  }
}
