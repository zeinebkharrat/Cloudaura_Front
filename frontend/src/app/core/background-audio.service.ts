import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const AUDIO_SRC = 'assets/audio/colors-berlin-live-naseer-shamma-oud.mp3';
const LS_MUTED = 'bg_audio_muted';
const SS_TIME = 'bg_audio_t';
const SS_SRC = 'bg_audio_src';

/**
 * Single background music instance for the SPA: survives route changes, restores
 * playback position via sessionStorage, persists mute in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundAudioService {
  private readonly platformId = inject(PLATFORM_ID);
  private audio: HTMLAudioElement | null = null;
  private started = false;
  private lastPersist = 0;

  readonly muted = signal(true);

  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.audio) {
      return;
    }

    const savedMuted = localStorage.getItem(LS_MUTED);
    const muted = savedMuted == null ? true : savedMuted === '1';
    this.muted.set(muted);

    const el = new Audio(AUDIO_SRC);
    el.loop = true;
    el.preload = 'auto';
    el.muted = muted;
    el.volume = 0.8;

    const prevSrc = sessionStorage.getItem(SS_SRC);
    const prevT = sessionStorage.getItem(SS_TIME);
    if (prevSrc === AUDIO_SRC && prevT != null) {
      const t = parseFloat(prevT);
      if (!Number.isNaN(t) && t > 0.25) {
        const apply = () => {
          try {
            const d = el.duration;
            if (Number.isFinite(d) && d > 0) {
              el.currentTime = Math.min(t, Math.max(0, d - 0.25));
            } else {
              el.currentTime = t;
            }
          } catch {
            /* ignore */
          }
        };
        el.addEventListener('loadedmetadata', apply, { once: true });
      }
    }

    el.addEventListener('timeupdate', () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastPersist < 900) {
        return;
      }
      this.lastPersist = now;
      if (el.duration && !Number.isNaN(el.currentTime)) {
        sessionStorage.setItem(SS_TIME, String(el.currentTime));
        sessionStorage.setItem(SS_SRC, AUDIO_SRC);
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (!Number.isNaN(el.currentTime)) {
          sessionStorage.setItem(SS_TIME, String(el.currentTime));
          sessionStorage.setItem(SS_SRC, AUDIO_SRC);
        }
      });
    }

    this.audio = el;
    this.startPlayback();
  }

  private startPlayback(): void {
    const el = this.audio;
    if (!el || this.started) {
      return;
    }
    this.started = true;
    void el.play().catch(() => undefined);
  }

  toggleMute(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.init();
    const el = this.audio;
    if (!el) {
      return;
    }
    const next = !this.muted();
    this.muted.set(next);
    el.muted = next;
    localStorage.setItem(LS_MUTED, next ? '1' : '0');
    if (!el.paused) {
      return;
    }
    void el.play().catch(() => undefined);
  }
}
