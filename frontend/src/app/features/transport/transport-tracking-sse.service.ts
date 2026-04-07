import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth.service';

export type TransportJourneyStage =
  | 'DEPARTURE_STARTED'
  | 'MID_JOURNEY'
  | 'NEAR_DESTINATION_5KM'
  | 'ARRIVED';

interface JourneyPayload {
  stage?: string;
  distanceKm?: number;
}

@Injectable()
export class TransportTrackingSseService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly messages = inject(MessageService);

  private abort: AbortController | null = null;
  private watchId: number | null = null;
  private buffer = '';

  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * Opens an SSE stream with Bearer auth and posts GPS fixes to the backend.
   * Shows PrimeNG toasts when journey stages are received.
   */
  startJourneyTracking(reservationId: number): void {
    this.stop();
    const token = this.auth.token();
    if (!token) {
      return;
    }

    this.abort = new AbortController();
    const url = `${window.location.origin}/api/transport/tracking/stream/${reservationId}`;

    void fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: this.abort.signal,
    })
      .then(async (res) => {
        const reader = res.body?.getReader();
        if (!reader) {
          return;
        }
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          this.buffer += decoder.decode(value, { stream: true });
          this.consumeSseFrames();
        }
      })
      .catch(() => {
        /* stream closed or auth failure */
      });

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          void this.postPosition(reservationId, pos.coords.latitude, pos.coords.longitude, token);
        },
        () => {
          /* user denied or unavailable */
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
      );
    }
  }

  stop(): void {
    this.abort?.abort();
    this.abort = null;
    this.buffer = '';
    if (this.watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private consumeSseFrames(): void {
    const parts = this.buffer.split('\n\n');
    this.buffer = parts.pop() ?? '';
    for (const block of parts) {
      const lines = block.split('\n');
      let eventName = 'message';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr += line.slice(5).trim();
        }
      }
      if (!dataStr) {
        continue;
      }
      if (eventName === 'journey') {
        try {
          const data = JSON.parse(dataStr) as JourneyPayload;
          const stage = data.stage as TransportJourneyStage | undefined;
          if (stage) {
            this.zone.run(() => this.toastForStage(stage, data.distanceKm));
          }
        } catch {
          /* ignore malformed */
        }
      }
    }
  }

  private toastForStage(stage: TransportJourneyStage, distanceKm?: number): void {
    const d = distanceKm != null ? ` (${distanceKm} km)` : '';
    switch (stage) {
      case 'DEPARTURE_STARTED':
        this.messages.add({ severity: 'info', summary: 'Départ', detail: `Trajet commencé${d}.` });
        break;
      case 'MID_JOURNEY':
        this.messages.add({ severity: 'info', summary: 'En route', detail: `Milieu de parcours${d}.` });
        break;
      case 'NEAR_DESTINATION_5KM':
        this.messages.add({
          severity: 'warn',
          summary: 'Presque arrivé',
          detail: `Moins de 5 km de la destination${d}.`,
        });
        break;
      case 'ARRIVED':
        this.messages.add({ severity: 'success', summary: 'Arrivée', detail: 'Vous êtes arrivé à destination.' });
        break;
      default:
        break;
    }
  }

  private async postPosition(
    reservationId: number,
    lat: number,
    lng: number,
    token: string
  ): Promise<void> {
    try {
      await fetch(`${window.location.origin}/api/transport/tracking/${reservationId}/position`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lng }),
      });
    } catch {
      /* network */
    }
  }
}
