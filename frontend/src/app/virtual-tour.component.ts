import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

/** Optional partial-pano fields (degrees) — use when the JPEG is not a full 360×180 equirectangular. */
export interface VirtualTourPartialPano {
  haov: number;
  vaov: number;
  vOffset?: number;
}

export interface VirtualTourScene {
  id: string;
  label: string;
  panorama: string;
  partial?: VirtualTourPartialPano;
}

/**
 * Tunisia panoramas from Wikimedia Commons (CC licenses). Thumbnails keep loads reasonable;
 * replace with local files under /public/ for production if you prefer.
 */
const WIKI_THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb';

export const TUNISIA_VIRTUAL_TOUR_SCENES: VirtualTourScene[] = [
  {
    id: 'local',
    label: 'Local View',
    /** Tabarka — cylindrical pano; EXIF FOV 103° × 50° (Hugin). CC BY-SA 4.0 — Habib Mhenni. */
    panorama: `${WIKI_THUMB}/7/71/Vue_de_Tabarka%2C_25_d%C3%A9cembre_2014.jpg/2048px-Vue_de_Tabarka%2C_25_d%C3%A9cembre_2014.jpg`,
    partial: { haov: 103, vaov: 50 },
  },
  {
    id: 'highlights',
    label: 'Highlights View',
    /** Tozeur oasis strip panorama. CC BY 2.0 — McKay Savage. Approx. partial FOV for viewer. */
    panorama: `${WIKI_THUMB}/e/e6/Tunisia_10-12_-_165_-_Tozeur_-_Panorama_%286609494779%29.jpg/2048px-Tunisia_10-12_-_165_-_Tozeur_-_Panorama_%286609494779%29.jpg`,
    partial: { haov: 128, vaov: 44 },
  },
];

@Component({
  selector: 'app-virtual-tour',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-tour.component.html',
  styleUrl: './virtual-tour.component.css',
})
export class VirtualTourComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewerHost', { static: false }) viewerHost!: ElementRef<HTMLElement>;

  /** Taglines under the main section title (matches landing mockup messaging). */
  readonly taglines = [
    'Explore Tunisia in 360°',
    'Step Into Tunisia',
    'Discover Tunisia Virtually',
  ] as const;

  readonly scenes = TUNISIA_VIRTUAL_TOUR_SCENES;

  taglineIndex = signal(0);
  selectedSceneId = signal<string>(this.scenes[0].id);
  taglineFading = signal(false);

  private viewer?: PannellumViewerInstance;
  private taglineInterval?: ReturnType<typeof setInterval>;
  private fadeTimeout?: ReturnType<typeof setTimeout>;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.taglineInterval = setInterval(() => this.advanceTagline(), 5000);
    queueMicrotask(() => this.mountViewer(this.scenes[0]));
  }

  ngOnDestroy(): void {
    if (this.taglineInterval) clearInterval(this.taglineInterval);
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);
    this.destroyViewer();
  }

  selectScene(scene: VirtualTourScene): void {
    if (this.selectedSceneId() === scene.id) return;
    this.selectedSceneId.set(scene.id);
    this.mountViewer(scene);
  }

  private advanceTagline(): void {
    this.taglineFading.set(true);
    this.fadeTimeout = setTimeout(() => {
      this.taglineIndex.update((i) => (i + 1) % this.taglines.length);
      this.taglineFading.set(false);
    }, 220);
  }

  private destroyViewer(): void {
    try {
      this.viewer?.destroy();
    } catch {
      /* ignore */
    }
    this.viewer = undefined;
  }

  private mountViewer(scene: VirtualTourScene): void {
    if (!isPlatformBrowser(this.platformId) || !this.viewerHost?.nativeElement) return;

    this.destroyViewer();
    const el = this.viewerHost.nativeElement;
    el.innerHTML = '';

    const config: Record<string, unknown> = {
      type: 'equirectangular',
      panorama: scene.panorama,
      autoLoad: true,
      compass: true,
      showControls: true,
      showFullscreenCtrl: true,
      hfov: 88,
      minHfov: 40,
      maxHfov: 110,
    };

    if (scene.partial) {
      config['haov'] = scene.partial.haov;
      config['vaov'] = scene.partial.vaov;
      if (scene.partial.vOffset != null) {
        config['vOffset'] = scene.partial.vOffset;
      }
    }

    this.viewer = pannellum.viewer(el, config);
  }
}
