import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { FlightDto } from './flight.models';
import { flightBadge } from './flight-status.util';

/**
 * Leaflet map: great-circle style preview between departure and arrival using backend-supplied coordinates.
 */
@Component({
  selector: 'app-flight-route-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-shell">
      <div #mapContainer class="map-container"></div>
      @if (!hasCoords && flight) {
        <div class="map-overlay">No coordinates for this route — expand the static IATA table on the server.</div>
      }
      @if (!flight) {
        <div class="map-overlay muted">Select a flight and tap “Show on map”.</div>
      }
      @if (flight && hasCoords) {
        <div class="map-meta" aria-live="polite">
          <div class="map-meta-row">
            <span class="map-meta-airline">{{ flight.airline }}</span>
            <span class="map-meta-fn">{{ flight.flightNumber }}</span>
            <span
              class="map-meta-status"
              [ngClass]="{
                'map-meta-status--ok': statusSeverity() === 'success',
                'map-meta-status--warn': statusSeverity() === 'warn',
                'map-meta-status--bad': statusSeverity() === 'danger',
                'map-meta-status--muted': statusSeverity() === 'secondary',
              }"
              >{{ statusLabel() }}</span
            >
          </div>
          <div class="map-meta-route">
            {{ flight.departureIata || '—' }} → {{ flight.arrivalIata || '—' }}
            @if (rawStatus()) {
              <span class="map-meta-raw">({{ rawStatus() }})</span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .map-shell {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.15);
      }
      .map-container {
        width: 100%;
        height: 320px;
        z-index: 1;
      }
      .map-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 1rem;
        background: rgba(15, 23, 42, 0.75);
        color: #e2e8f0;
        font-size: 0.9rem;
        z-index: 5;
        pointer-events: none;
      }
      .map-overlay.muted {
        color: #94a3b8;
      }
      .map-meta {
        position: absolute;
        left: 0.65rem;
        right: 0.65rem;
        bottom: 0.65rem;
        z-index: 6;
        padding: 0.55rem 0.75rem;
        border-radius: 12px;
        background: color-mix(in srgb, var(--surface-1, #1e293b) 88%, transparent);
        border: 1px solid var(--glass-border, rgba(148, 163, 184, 0.22));
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
        pointer-events: none;
      }
      .map-meta-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 0.65rem;
      }
      .map-meta-airline {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
      }
      .map-meta-fn {
        font-family: 'Outfit', system-ui, sans-serif;
        font-size: 0.95rem;
        font-weight: 800;
        color: var(--text-color, #f8fafc);
        letter-spacing: -0.02em;
      }
      .map-meta-status {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        margin-left: auto;
      }
      .map-meta-status--ok {
        background: color-mix(in srgb, #22c55e 18%, transparent);
        color: #86efac;
      }
      .map-meta-status--warn {
        background: color-mix(in srgb, #f59e0b 20%, transparent);
        color: #fcd34d;
      }
      .map-meta-status--bad {
        background: color-mix(in srgb, #ef4444 20%, transparent);
        color: #fecaca;
      }
      .map-meta-status--muted {
        background: color-mix(in srgb, var(--text-muted) 22%, transparent);
        color: var(--text-color, #e2e8f0);
      }
      .map-meta-route {
        margin-top: 0.35rem;
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
      }
      .map-meta-raw {
        text-transform: capitalize;
        opacity: 0.9;
      }
    `,
  ],
})
export class FlightRouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') mapEl!: ElementRef<HTMLDivElement>;
  @Input() flight: FlightDto | null = null;

  hasCoords = false;
  private map?: L.Map;
  private layer?: L.LayerGroup;

  ngAfterViewInit(): void {
    this.initMap();
    this.draw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['flight'] && this.map) {
      this.draw();
    }
  }

  statusLabel(): string {
    const f = this.flight;
    if (!f) return '';
    return flightBadge(f).label;
  }

  statusSeverity(): 'success' | 'warn' | 'danger' | 'secondary' {
    const f = this.flight;
    if (!f) return 'secondary';
    return flightBadge(f).severity;
  }

  rawStatus(): string {
    const f = this.flight;
    if (!f?.status) return '';
    const raw = f.status.trim();
    if (!raw) return '';
    const label = this.statusLabel().toLowerCase();
    if (raw.toLowerCase() === label) return '';
    return raw.replace(/_/g, ' ');
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [20, 10],
      zoom: 3,
      zoomControl: true,
      attributionControl: true,
    });
    const grayPixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
      errorTileUrl: grayPixel,
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
  }

  private draw(): void {
    if (!this.map || !this.layer) return;
    this.layer.clearLayers();
    const f = this.flight;
    if (!f) {
      this.hasCoords = false;
      return;
    }
    const lat1 = f.departureLatitude;
    const lng1 = f.departureLongitude;
    const lat2 = f.arrivalLatitude;
    const lng2 = f.arrivalLongitude;
    if (
      lat1 == null ||
      lng1 == null ||
      lat2 == null ||
      lng2 == null ||
      Number.isNaN(lat1) ||
      Number.isNaN(lng1) ||
      Number.isNaN(lat2) ||
      Number.isNaN(lng2)
    ) {
      this.hasCoords = false;
      return;
    }
    this.hasCoords = true;

    const from: L.LatLngTuple = [lat1, lng1];
    const to: L.LatLngTuple = [lat2, lng2];
    const arc = this.arcPoints(from, to, 48);

    L.polyline(arc, { color: '#0ea5e9', weight: 3, opacity: 0.9 }).addTo(this.layer);
    L.circleMarker(from, { radius: 7, color: '#f12545', fillColor: '#f12545', fillOpacity: 0.95 })
      .bindPopup(f.departureIata || 'DEP')
      .addTo(this.layer);
    L.circleMarker(to, { radius: 7, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.95 })
      .bindPopup(f.arrivalIata || 'ARR')
      .addTo(this.layer);

    const bounds = L.latLngBounds([from, to]);
    this.map.fitBounds(bounds.pad(0.2));
  }

  /** Simple geodesic interpolation for a curved look (not full great-circle math). */
  private arcPoints(from: L.LatLngTuple, to: L.LatLngTuple, steps: number): L.LatLngTuple[] {
    const out: L.LatLngTuple[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = from[0] + (to[0] - from[0]) * t;
      const lng = from[1] + (to[1] - from[1]) * t;
      const lift = Math.sin(Math.PI * t) * 2.5;
      out.push([lat + lift * 0.15, lng]);
    }
    return out;
  }
}
