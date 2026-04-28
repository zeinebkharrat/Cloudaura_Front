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
import { TranslateModule } from '@ngx-translate/core';

/** Optional partial-pano fields (degrees) — use when the JPEG is not a full 360×180 equirectangular. */
export interface VirtualTourPartialPano {
  haov: number;
  vaov: number;
  vOffset?: number;
}

export interface VirtualTourScene {
  id: string;
  panorama: string;
  partial?: VirtualTourPartialPano;
}

export const TUNISIA_VIRTUAL_TOUR_SCENES: VirtualTourScene[] = [
  {
    id: 'local',
    panorama: `/360/medina_360.jpg`,
  },
  {
    id: 'highlights',
    panorama: `/360/photo-360.jpg`,
  },
  {
    id: 'extra',
    panorama: `/360/0.jpg`,
  },
];

@Component({
  selector: 'app-virtual-tour',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './virtual-tour.component.html',
  styleUrl: './virtual-tour.component.css',
})
export class VirtualTourComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewerHost', { static: false }) viewerHost!: ElementRef<HTMLElement>;

  readonly scenes = TUNISIA_VIRTUAL_TOUR_SCENES;

  /** i18n key suffix 1..3 for rotating tagline under the title. */
  taglineKey(): string {
    return `VIRTUAL_TOUR.TAGLINE_${this.taglineIndex() + 1}`;
  }

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
      this.taglineIndex.update((i) => (i + 1) % 3);
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
