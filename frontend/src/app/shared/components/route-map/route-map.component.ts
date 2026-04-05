import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  SimpleChanges, ElementRef, ViewChild, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { RouteResult } from '../../../core/models/travel.models';

@Component({
  selector: 'app-route-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="route-map-wrapper">
      <div #mapContainer class="map-container"></div>
      @if (loading()) {
        <div class="map-overlay">
          <i class="pi pi-spin pi-spinner" style="font-size:1.5rem"></i>
          <span>Calcul de l'itinéraire...</span>
        </div>
      }
      @if (routeData()) {
        <div class="route-info-bar">
          <div class="info-item">
            <i class="pi pi-map-marker"></i>
            <span>{{ routeData()!.distanceKm }} km</span>
          </div>
          <div class="info-item">
            <i class="pi pi-clock"></i>
            <span>{{ formatDuration(routeData()!.durationMinutes) }}</span>
          </div>
          <div class="info-item mode-badge">
            <i [class]="getModeIcon(routeData()!.mode)"></i>
            <span>{{ getModeLabel(routeData()!.mode) }}</span>
          </div>
          @if (routeData()!.segments && routeData()!.segments.length > 1) {
            <div class="info-item segments-count">
              {{ routeData()!.segments.length }} segments
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .route-map-wrapper {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .map-container {
      width: 100%;
      height: 350px;
      z-index: 1;
    }
    .map-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      color: #e2e8f0;
      z-index: 10;
      font-size: 0.9rem;
    }
    .route-info-bar {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 10px 16px;
      background: rgba(15, 23, 42, 0.92);
      color: #e2e8f0;
      font-size: 0.85rem;
      flex-wrap: wrap;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .info-item i { color: #f12545; font-size: 0.9rem; }
    .mode-badge {
      background: rgba(241, 37, 69, 0.15);
      padding: 3px 10px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .segments-count {
      color: #94a3b8;
      font-size: 0.78rem;
    }
  `]
})
export class RouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') mapEl!: ElementRef<HTMLDivElement>;

  @Input() fromCityId?: number;
  @Input() toCityId?: number;
  @Input() fromLat?: number;
  @Input() fromLng?: number;
  @Input() toLat?: number;
  @Input() toLng?: number;
  @Input() fromName = '';
  @Input() toName = '';
  @Input() mode: string = 'DRIVING';
  @Input() height = '350px';
  @Input() externalRoute?: RouteResult;

  loading = signal(false);
  routeData = signal<RouteResult | null>(null);

  private http = inject(HttpClient);
  private map?: L.Map;
  private routeLayer?: L.LayerGroup;

  ngAfterViewInit(): void {
    this.mapEl.nativeElement.style.height = this.height;
    this.initMap();
    this.loadRoute();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    const relevantChanged = changes['fromCityId'] || changes['toCityId'] ||
      changes['fromLat'] || changes['toLat'] || changes['mode'] || changes['externalRoute'];
    if (relevantChanged) {
      this.loadRoute();
    }
  }

  ngOnDestroy(): void {
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
    if (this.externalRoute) {
      this.drawRoute(this.externalRoute);
      return;
    }

    if (this.fromCityId && this.toCityId) {
      this.loading.set(true);
      this.http.get<{ data: RouteResult }>('/api/routes/calculate', {
        params: {
          fromCityId: this.fromCityId.toString(),
          toCityId: this.toCityId.toString(),
          mode: this.mode
        }
      }).subscribe({
        next: res => {
          this.loading.set(false);
          if (res.data) this.drawRoute(res.data);
        },
        error: () => {
          this.loading.set(false);
          this.drawStraightLine();
        }
      });
      return;
    }

    if (this.fromLat != null && this.fromLng != null && this.toLat != null && this.toLng != null) {
      this.drawStraightLine();
    }
  }

  private drawRoute(route: RouteResult): void {
    this.routeData.set(route);
    if (!this.map || !this.routeLayer) return;
    this.routeLayer.clearLayers();

    if (route.polylineGeoJson) {
      const geo = route.polylineGeoJson;
      if (route.mode === 'FLIGHT') {
        this.drawFlightRoute(route);
      } else {
        const geoLayer = L.geoJSON(geo, {
          style: { color: '#f12545', weight: 4, opacity: 0.85 }
        }).addTo(this.routeLayer);
        this.addMarkers(route);
        this.map.fitBounds(geoLayer.getBounds().pad(0.15));
      }
    }
  }

  private drawFlightRoute(route: RouteResult): void {
    if (!this.map || !this.routeLayer) return;
    const segments = route.segments || [];

    for (const seg of segments) {
      if (!seg.fromLat || !seg.fromLng || !seg.toLat || !seg.toLng) continue;
      const from: L.LatLngTuple = [seg.fromLat, seg.fromLng];
      const to: L.LatLngTuple = [seg.toLat, seg.toLng];

      if (seg.mode === 'FLIGHT') {
        const arcPoints = this.generateArc(from, to, 50);
        L.polyline(arcPoints, {
          color: '#0077b6', weight: 3, dashArray: '10 8', opacity: 0.9
        }).addTo(this.routeLayer);

        L.marker(from, { icon: this.airportIcon() })
          .bindPopup(seg.from).addTo(this.routeLayer);
        L.marker(to, { icon: this.airportIcon() })
          .bindPopup(seg.to).addTo(this.routeLayer);
      } else {
        L.polyline([from, to], {
          color: '#f59e0b', weight: 3, dashArray: '6 4', opacity: 0.7
        }).addTo(this.routeLayer);
      }
    }

    const allLats = segments.filter(s => s.fromLat).flatMap(s => [s.fromLat!, s.toLat!]);
    const allLngs = segments.filter(s => s.fromLng).flatMap(s => [s.fromLng!, s.toLng!]);
    if (allLats.length > 0) {
      this.map.fitBounds([
        [Math.min(...allLats), Math.min(...allLngs)],
        [Math.max(...allLats), Math.max(...allLngs)]
      ], { padding: [40, 40] });
    }
  }

  private addMarkers(route: RouteResult): void {
    if (!this.routeLayer) return;
    const segs = route.segments || [];
    if (segs.length === 0) return;

    const first = segs[0];
    const last = segs[segs.length - 1];

    if (first.fromLat && first.fromLng) {
      L.marker([first.fromLat, first.fromLng], { icon: this.departureIcon() })
        .bindPopup(`<b>${this.fromName || first.from}</b><br/>Départ`)
        .addTo(this.routeLayer);
    }
    if (last.toLat && last.toLng) {
      L.marker([last.toLat, last.toLng], { icon: this.arrivalIcon() })
        .bindPopup(`<b>${this.toName || last.to}</b><br/>Arrivée`)
        .addTo(this.routeLayer);
    }
  }

  private drawStraightLine(): void {
    if (!this.map || !this.routeLayer) return;
    if (this.fromLat == null || this.fromLng == null || this.toLat == null || this.toLng == null) return;
    this.routeLayer.clearLayers();

    const from: L.LatLngTuple = [this.fromLat, this.fromLng];
    const to: L.LatLngTuple = [this.toLat, this.toLng];

    L.polyline([from, to], { color: '#f12545', weight: 3, dashArray: '8 6' }).addTo(this.routeLayer);
    L.marker(from, { icon: this.departureIcon() }).bindPopup(this.fromName || 'Départ').addTo(this.routeLayer);
    L.marker(to, { icon: this.arrivalIcon() }).bindPopup(this.toName || 'Arrivée').addTo(this.routeLayer);
    this.map.fitBounds([from, to], { padding: [40, 40] });
  }

  private generateArc(from: L.LatLngTuple, to: L.LatLngTuple, steps: number): L.LatLngTuple[] {
    const points: L.LatLngTuple[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = from[0] + t * (to[0] - from[0]);
      const lng = from[1] + t * (to[1] - from[1]);
      const altitude = Math.sin(Math.PI * t) * 1.5;
      points.push([lat + altitude, lng]);
    }
    return points;
  }

  private departureIcon(): L.DivIcon {
    return L.divIcon({
      html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
      iconSize: [20, 20], iconAnchor: [10, 10], className: ''
    });
  }

  private arrivalIcon(): L.DivIcon {
    return L.divIcon({
      html: '<div style="background:#f12545;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
      iconSize: [20, 20], iconAnchor: [10, 10], className: ''
    });
  }

  private airportIcon(): L.DivIcon {
    return L.divIcon({
      html: '<div style="background:#0077b6;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
      iconSize: [20, 20], iconAnchor: [10, 10], className: ''
    });
  }

  formatDuration(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m} min`;
  }

  getModeIcon(mode: string): string {
    switch (mode) {
      case 'FLIGHT': return 'pi pi-send';
      case 'TRANSIT': return 'pi pi-car';
      default: return 'pi pi-map';
    }
  }

  getModeLabel(mode: string): string {
    switch (mode) {
      case 'FLIGHT': return 'Vol';
      case 'TRANSIT': return 'Transport en commun';
      default: return 'Route';
    }
  }
}
