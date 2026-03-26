import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ExploreService } from './explore.service';
import { PublicCityDetailsResponse } from './explore.models';

const HOME_MAP_RETURN_CONTEXT_KEY = 'homeMapReturnContext';

@Component({
  selector: 'app-city-explore',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './city-explore.component.html',
  styleUrl: './city-explore.component.css',
})
export class CityExploreComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal('');
  details = signal<PublicCityDetailsResponse | null>(null);
  currentImageIndex = signal(0);

  media = computed(() => this.details()?.media ?? []);
  currentMedia = computed(() => {
    const gallery = this.media();
    if (!gallery.length) {
      return null;
    }
    return gallery[this.currentImageIndex() % gallery.length];
  });

  heroImage = computed(() => this.currentMedia()?.url ?? 'assets/sidi_bou.png');
  hasMultipleImages = computed(() => this.media().length > 1);
  currentCaption = computed(() => {
    const cityName = this.details()?.city.name ?? 'this destination';
    const media = this.currentMedia();
    if (!media) {
      return `Discover ${cityName} and its iconic spots.`;
    }

    if (media.mediaType === 'PANORAMA') {
      return `Immersive panoramic view of ${cityName}.`;
    }
    if (media.mediaType === 'VIDEO') {
      return `A vivid moment in ${cityName}, blending culture and local atmosphere.`;
    }
    return `Postcard-perfect scene from ${cityName}.`;
  });

  private sliderTimer: ReturnType<typeof setInterval> | null = null;
  private returnRegionId: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly exploreService: ExploreService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.returnRegionId = this.route.snapshot.queryParamMap.get('region');

    const cityId = Number(this.route.snapshot.paramMap.get('cityId'));
    if (!cityId) {
      this.error.set('Invalid city');
      this.loading.set(false);
      return;
    }

    this.exploreService.getCityDetails(cityId).subscribe({
      next: (details) => {
        this.details.set(details);
        this.currentImageIndex.set(0);
        this.startAutoSlide();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Unable to load this city');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  onHeroClick(event: MouseEvent): void {
    if (!this.hasMultipleImages()) {
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const isRight = clickX > bounds.width / 2;

    if (isRight) {
      this.nextImage();
      return;
    }

    this.previousImage();
  }

  nextImage(): void {
    const total = this.media().length;
    if (!total) {
      return;
    }
    this.currentImageIndex.set((this.currentImageIndex() + 1) % total);
    this.restartAutoSlide();
  }

  previousImage(): void {
    const total = this.media().length;
    if (!total) {
      return;
    }
    this.currentImageIndex.set((this.currentImageIndex() - 1 + total) % total);
    this.restartAutoSlide();
  }

  private startAutoSlide(): void {
    this.stopAutoSlide();
    if (!this.hasMultipleImages()) {
      return;
    }

    this.sliderTimer = setInterval(() => {
      const total = this.media().length;
      if (total <= 1) {
        return;
      }
      this.currentImageIndex.set((this.currentImageIndex() + 1) % total);
    }, 4200);
  }

  private stopAutoSlide(): void {
    if (this.sliderTimer) {
      clearInterval(this.sliderTimer);
      this.sliderTimer = null;
    }
  }

  private restartAutoSlide(): void {
    this.startAutoSlide();
  }

  goBack(): void {
    const routeCityId = Number(this.route.snapshot.paramMap.get('cityId'));
    const city = this.details()?.city;
    const cityName = city?.name ?? null;
    const cityId = city?.cityId ?? (Number.isNaN(routeCityId) ? null : routeCityId);
    const cityLat = city?.latitude ?? null;
    const cityLng = city?.longitude ?? null;
    const returnRegion = this.returnRegionId ?? cityName ?? undefined;

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        HOME_MAP_RETURN_CONTEXT_KEY,
        JSON.stringify({
          zoomOut: 1,
          returnRegion,
          returnCity: cityName ?? undefined,
          returnCityId: cityId ?? undefined,
          returnLat: cityLat ?? undefined,
          returnLng: cityLng ?? undefined,
        })
      );
    }

    this.router.navigate(['/'], {
      fragment: 'map-section',
      queryParams: {
        zoomOut: 1,
        returnRegion,
        returnCity: cityName ?? undefined,
        returnCityId: cityId ?? undefined,
        returnLat: cityLat ?? undefined,
        returnLng: cityLng ?? undefined,
      },
    });
  }

  goToMapZoomOut(): void {
    this.goBack();
  }

  scrollToSection(sectionId: 'restaurants' | 'activities'): void {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}