import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Subscription, timer } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AircraftTrackResponse, FlightDto } from '../../features/flights/flight.models';
import { FlightService } from '../../features/flights/flight.service';

/**
 * Route preview + OpenSky-backed live position (polled). Stops when the flight is landed / cancelled.
 */
@Component({
  selector: 'app-international-flight-live-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="live-map-wrap">
      <div #mapHost class="live-map-host"></div>
      @if (hint) {
        <div class="live-map-hint" aria-live="polite">{{ hint }}</div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(244, 63, 94, 0.18);
      background: linear-gradient(160deg, #0c1224 0%, #0f172a 55%, #111827 100%);
      min-height: 280px;
    }
    .live-map-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 280px;
    }
    .live-map-host {
      width: 100%;
      height: 320px;
      z-index: 1;
    }
    @media (max-width: 768px) {
      .live-map-host {
        height: 240px;
      }
    }
    .live-map-hint {
      position: absolute;
      left: 0.75rem;
      right: 0.75rem;
      bottom: 0.65rem;
      z-index: 5;
      padding: 0.45rem 0.65rem;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #e2e8f8;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(148, 163, 184, 0.22);
      pointer-events: none;
    }
    :host ::ng-deep .live-route-line {
      animation: dashmove 1.1s linear infinite;
    }
    @keyframes dashmove {
      to {
        stroke-dashoffset: -42;
      }
    }
    :host ::ng-deep .live-ac-marker {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.45));
    }
  `,
})
export class InternationalFlightLiveMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;

  @Input() flight: FlightDto | null = null;
  @Input() depIata = '';
  @Input() arrIata = '';
  @Input() travelDate: Date | null = null;

  hint: string | null = null;

  private readonly flights = inject(FlightService);
  private map?: L.Map;
  private layer?: L.LayerGroup;
  private marker?: L.Marker;
  private routeLine?: L.Polyline;
  private sub: Subscription | null = null;
  private resolvedIcao24: string | null = null;
  private trail: L.LatLngTuple[] = [];
  private trailLine?: L.Polyline;
  private lastTrackFlightStatus: string | null = null;

  ngAfterViewInit(): void {
    this.initMap();
    this.refreshAll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && (changes['flight'] || changes['depIata'] || changes['arrIata'] || changes['travelDate'])) {
      this.refreshAll();
    }
  }

  ngOnDestroy(): void {
    this.stopPoll();
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapHost.nativeElement, {
      zoomControl: true,
      attributionControl: true,
      center: [34.5, 10.5],
      zoom: 5,
    });
    const grayPixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      errorTileUrl: grayPixel,
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
  }

  private refreshAll(): void {
    this.stopPoll();
    this.resolvedIcao24 = null;
    this.trail = [];
    this.trailLine = undefined;
    this.lastTrackFlightStatus = null;
    this.hint = null;
    if (!this.map || !this.layer) {
      return;
    }
    this.layer.clearLayers();
    this.marker = undefined;
    this.routeLine = undefined;

    const f = this.flight;
    if (!f) {
      this.hint = 'Select a flight to see route and live position.';
      return;
    }

    const lat1 = f.departureLatitude;
    const lng1 = f.departureLongitude;
    const lat2 = f.arrivalLatitude;
    const lng2 = f.arrivalLongitude;
    if (
      lat1 != null &&
      lng1 != null &&
      lat2 != null &&
      lng2 != null &&
      !Number.isNaN(lat1) &&
      !Number.isNaN(lng1) &&
      !Number.isNaN(lat2) &&
      !Number.isNaN(lng2)
    ) {
      const from: L.LatLngTuple = [lat1, lng1];
      const to: L.LatLngTuple = [lat2, lng2];
      const arc = this.arcPoints(from, to, 40);
      this.routeLine = L.polyline(arc, {
        color: '#fb7185',
        weight: 2,
        opacity: 0.85,
        dashArray: '10 12',
        className: 'live-route-line',
      }).addTo(this.layer);
      L.circleMarker(from, {
        radius: 6,
        color: '#fb7185',
        fillColor: '#fb7185',
        fillOpacity: 0.95,
      })
        .bindTooltip(f.departureIata || 'DEP', { permanent: false })
        .addTo(this.layer);
      L.circleMarker(to, {
        radius: 6,
        color: '#4ade80',
        fillColor: '#22c55e',
        fillOpacity: 0.95,
      })
        .bindTooltip(f.arrivalIata || 'ARR', { permanent: false })
        .addTo(this.layer);
      this.map.fitBounds(L.latLngBounds([from, to]).pad(0.22));
    } else {
      this.hint = 'No airport coordinates for this route.';
    }

    if (this.shouldStopPolling(f)) {
      this.hint = 'Flight ended — live tracking stopped.';
      return;
    }

    const flightCode = (f.flightNumber || '').trim();
    if (!flightCode) {
      this.hint = 'No flight number — cannot request live track.';
      return;
    }

    const dateStr = this.formatYmd(this.travelDate);
    const dep = (f.departureIata || this.depIata || '').trim().toUpperCase();
    const arr = (f.arrivalIata || this.arrIata || '').trim().toUpperCase();

    this.sub = timer(0, 12_000)
      .pipe(
        switchMap(() => {
          const obs =
            this.resolvedIcao24 != null
              ? this.flights.trackByIcao24(this.resolvedIcao24)
              : this.flights.trackByFlight(flightCode, dateStr, dep || null, arr || null);
          return obs.pipe(
            catchError(() => of(null)),
            tap((res) => {
              const d = res?.data;
              if (d?.icao24 && d.icao24.trim().length > 0) {
                this.resolvedIcao24 = d.icao24.trim().toLowerCase();
              }
            }),
          );
        }),
      )
      .subscribe((res) => {
        const fCur = this.flight;
        if (res?.data?.flightStatus) {
          this.lastTrackFlightStatus = res.data.flightStatus;
        }
        if (!fCur || this.shouldStopPolling(fCur)) {
          this.stopPoll();
          this.hint = 'Flight ended — live tracking stopped.';
          return;
        }
        if (!res?.success || !res.data) {
          this.hint = 'Live position unavailable (network or coverage).';
          return;
        }
        this.applyTrack(res.data);
      });
  }

  private applyTrack(d: AircraftTrackResponse): void {
    if (!this.map || !this.layer) {
      return;
    }
    if (!d.available || d.latitude == null || d.longitude == null) {
      const r = d.unavailableReason || 'NO_POSITION';
      if (r === 'ON_GROUND' || r === 'NO_POSITION') {
        this.hint = 'Aircraft on ground or position not broadcast.';
      } else if (r === 'NO_STATE' || r === 'NO_ICAO24') {
        this.hint = 'No ADS-B match for this flight (coverage or identification).';
      } else {
        this.hint = 'Position temporarily unavailable.';
      }
      return;
    }
    const ll: L.LatLngTuple = [d.latitude, d.longitude];
    this.trail.push(ll);
    if (this.trail.length > 18) {
      this.trail.splice(0, this.trail.length - 18);
    }
    if (this.trail.length > 1) {
      if (!this.trailLine) {
        this.trailLine = L.polyline(this.trail, {
          color: 'rgba(251, 113, 133, 0.45)',
          weight: 3,
        }).addTo(this.layer);
      } else {
        this.trailLine.setLatLngs(this.trail);
      }
    }
    const h = d.headingTrueDeg != null && Number.isFinite(d.headingTrueDeg) ? d.headingTrueDeg : 0;
    const icon = L.divIcon({
      className: '',
      html: `<div class="live-ac-marker" style="transform:rotate(${h}deg)">✈</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    if (this.marker) {
      this.marker.setLatLng(ll);
      this.marker.setIcon(icon);
    } else {
      this.marker = L.marker(ll, { icon }).addTo(this.layer);
    }
    this.hint =
      (d.callsign ? `${d.callsign.trim()} · ` : '') +
      (d.groundSpeedMps != null ? `${Math.round(d.groundSpeedMps * 3.6)} km/h` : '') +
      (d.baroAltitudeMeters != null ? ` · ${Math.round(d.baroAltitudeMeters)} m` : '');
  }

  private shouldStopPolling(f: FlightDto): boolean {
    const s =
      `${f.status || ''} ${f.statusCategory || ''} ${this.lastTrackFlightStatus || ''}`.toLowerCase();
    return (
      s.includes('landed') ||
      s.includes('cancel') ||
      s.includes('divert') ||
      s.includes('complete')
    );
  }

  private stopPoll(): void {
    this.sub?.unsubscribe();
    this.sub = null;
  }

  private formatYmd(d: Date | null): string {
    if (!d || Number.isNaN(d.getTime())) {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private arcPoints(from: L.LatLngTuple, to: L.LatLngTuple, steps: number): L.LatLngTuple[] {
    const out: L.LatLngTuple[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = from[0] + (to[0] - from[0]) * t;
      const lng = from[1] + (to[1] - from[1]) * t;
      const lift = Math.sin(Math.PI * t) * 2.2;
      out.push([lat + lift * 0.12, lng]);
    }
    return out;
  }
}
