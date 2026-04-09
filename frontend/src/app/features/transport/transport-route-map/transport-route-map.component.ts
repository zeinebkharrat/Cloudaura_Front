import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import * as L from 'leaflet';
import { City } from '../../../core/models/travel.models';

interface OsrmGeometry {
  type: string;
  coordinates: [number, number][];
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry?: OsrmGeometry;
}

interface OsrmResponse {
  routes?: OsrmRoute[];
  code?: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDrivingDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '';
  }
  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60))} min`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

@Component({
  selector: 'app-transport-route-map',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trm-wrap">
      <div #mapEl class="trm-map"></div>
      @if (distanceKm != null && durationLabel) {
        <div class="trm-meta">
          <span>{{ distanceKm | number : '1.1-1' }} km</span>
          <span class="trm-dot">·</span>
          <span>{{ durationLabel }}</span>
        </div>
      }
      <p class="trm-osm">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        — itinéraire <a href="https://project-osrm.org/" target="_blank" rel="noopener noreferrer">OSRM</a>
      </p>
      @if (loadError) {
        <p class="trm-err">Carte ou itinéraire indisponible (réseau ou serveur).</p>
      }
    </div>
  `,
  styles: [
    `
      .trm-wrap {
        margin-top: 1rem;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #111827;
      }
      .trm-map {
        width: 100%;
        height: 220px;
        z-index: 0;
      }
      .trm-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 1rem 0.25rem;
        font-size: 0.88rem;
        color: var(--text-muted, #a8b3c7);
        font-weight: 600;
      }
      .trm-dot {
        opacity: 0.4;
      }
      .trm-osm {
        margin: 0;
        padding: 0 1rem 0.65rem;
        font-size: 0.68rem;
        color: var(--text-muted, #6b7280);
        line-height: 1.4;
      }
      .trm-osm a {
        color: #38bdf8;
        text-decoration: none;
      }
      .trm-osm a:hover {
        text-decoration: underline;
      }
      .trm-err {
        margin: 0;
        padding: 0.5rem 1rem 0.85rem;
        font-size: 0.8rem;
        color: #f87171;
      }
    `,
  ],
})
export class TransportRouteMapComponent implements OnChanges, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  @Input() fromCity: City | null = null;
  @Input() toCity: City | null = null;

  @Output() routeSummary = new EventEmitter<{ distanceKm: number; durationSeconds: number }>();

  distanceKm: number | null = null;
  durationLabel = '';
  loadError = false;

  private map: L.Map | null = null;
  private routeGroup: L.LayerGroup | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fromCity'] || changes['toCity']) {
      void this.refreshRoute();
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.routeGroup = null;
  }

  private async refreshRoute(): Promise<void> {
    this.loadError = false;
    const from = this.coordsOf(this.fromCity);
    const to = this.coordsOf(this.toCity);
    if (!from || !to) {
      this.destroyMap();
      this.distanceKm = null;
      this.durationLabel = '';
      this.cdr.markForCheck();
      return;
    }

    this.zone.runOutsideAngular(() => {
      if (!this.map) {
        this.map = L.map(this.mapEl.nativeElement, {
          zoomControl: true,
        }).setView([from.lat, from.lng], 7);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '',
        }).addTo(this.map);
      } else {
        this.map.setView([from.lat, from.lng], this.map.getZoom());
      }
      this.clearRouteOverlay();
    });

    const params = new HttpParams()
      .set('fromLat', String(from.lat))
      .set('fromLon', String(from.lng))
      .set('toLat', String(to.lat))
      .set('toLon', String(to.lng));

    this.http.get<OsrmResponse>('/api/routing/driving', { params }).subscribe({
      next: (body) => {
        this.zone.run(() => {
          const route = body.routes?.[0];
          let km: number;
          let sec: number;
          let latLngs: L.LatLng[];

          if (route && route.geometry?.coordinates?.length) {
            km = route.distance / 1000;
            sec = route.duration;
            latLngs = route.geometry.coordinates.map((c) => L.latLng(c[1], c[0]));
          } else {
            km = haversineKm(from.lat, from.lng, to.lat, to.lng);
            sec = (km / 65) * 3600;
            latLngs = [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)];
          }

          this.distanceKm = Math.round(km * 100) / 100;
          this.durationLabel = formatDrivingDuration(sec);
          this.routeSummary.emit({ distanceKm: this.distanceKm, durationSeconds: Math.round(sec) });

          this.zone.runOutsideAngular(() => {
            if (!this.map) {
              return;
            }
            this.clearRouteOverlay();
            this.routeGroup = L.layerGroup().addTo(this.map);
            L.polyline(latLngs, { color: '#f12545', weight: 4, opacity: 0.9 }).addTo(this.routeGroup);
            L.circleMarker([from.lat, from.lng], { radius: 6, color: '#fff', fillColor: '#f12545', fillOpacity: 1 })
              .addTo(this.routeGroup);
            L.circleMarker([to.lat, to.lng], { radius: 6, color: '#fff', fillColor: '#297E95', fillOpacity: 1 })
              .addTo(this.routeGroup);
            this.map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24], maxZoom: 12 });
            setTimeout(() => this.map?.invalidateSize(), 0);
          });

          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
          const sec = (km / 65) * 3600;
          this.distanceKm = Math.round(km * 100) / 100;
          this.durationLabel = formatDrivingDuration(sec) + ' (estimé)';
          this.routeSummary.emit({ distanceKm: this.distanceKm, durationSeconds: Math.round(sec) });
          this.loadError = true;

          this.zone.runOutsideAngular(() => {
            if (!this.map) {
              return;
            }
            this.clearRouteOverlay();
            const latLngs = [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)];
            this.routeGroup = L.layerGroup().addTo(this.map);
            L.polyline(latLngs, { color: '#94a3b8', weight: 3, dashArray: '8 6', opacity: 0.85 }).addTo(
              this.routeGroup
            );
            this.map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24], maxZoom: 12 });
            setTimeout(() => this.map?.invalidateSize(), 0);
          });

          this.cdr.markForCheck();
        });
      },
    });
  }

  private clearRouteOverlay(): void {
    if (this.routeGroup && this.map) {
      this.map.removeLayer(this.routeGroup);
    }
    this.routeGroup = null;
  }

  private coordsOf(c: City | null): { lat: number; lng: number } | null {
    if (!c) {
      return null;
    }
    const lat = c.latitude ?? c.coords?.lat;
    const lng = c.longitude ?? c.coords?.lng;
    if (lat == null || lng == null) {
      return null;
    }
    return { lat, lng };
  }
}
