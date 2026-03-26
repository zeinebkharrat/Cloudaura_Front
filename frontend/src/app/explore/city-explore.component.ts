import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExploreService } from './explore.service';
import { PublicCityDetailsResponse } from './explore.models';

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
    const cityName = this.details()?.city.name ?? 'cette destination';
    const media = this.currentMedia();
    if (!media) {
      return `Découvrez ${cityName} et ses lieux iconiques.`;
    }

    if (media.mediaType === 'PANORAMA') {
      return `Vue panoramique immersive de ${cityName}.`;
    }
    if (media.mediaType === 'VIDEO') {
      return `Instant vivant de ${cityName}, entre culture et atmosphère locale.`;
    }
    return `Carte postale touristique de ${cityName}.`;
  });

  private sliderTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly exploreService: ExploreService,
    private readonly location: Location
  ) {}

  ngOnInit(): void {
    const cityId = Number(this.route.snapshot.paramMap.get('cityId'));
    if (!cityId) {
      this.error.set('Ville invalide');
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
        this.error.set(err?.error?.message ?? 'Impossible de charger cette ville');
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
    this.location.back();
  }

  scrollToSection(sectionId: 'restaurants' | 'activities'): void {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}