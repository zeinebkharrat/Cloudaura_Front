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
