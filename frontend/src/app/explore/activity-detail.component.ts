import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import Swal from 'sweetalert2';
import {
  ActivityReservationResponse,
  Activity,
  ActivityMedia,
  CreateActivityReservationRequest,
} from './explore.models';
import { ExploreService } from './explore.service';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.css',
})
export class ActivityDetailComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly exploreService = inject(ExploreService);
  private readonly location = inject(Location);

  activity?: Activity;
  activityMedia: ActivityMedia[] = [];
  currentMediaIndex = 0;
  loading = true;
  error = '';
  heroImage = 'assets/sidi_bou.png';

  private map?: L.Map;
  private activityMarker?: L.CircleMarker;
  private viewReady = false;
  private sliderTimer: ReturnType<typeof setInterval> | null = null;

  form: CreateActivityReservationRequest = {
    reservationDate: new Date().toISOString().slice(0, 10),
    numberOfPeople: 1,
  };

  submitting = false;
  created?: ActivityReservationResponse;

  ngAfterViewInit(): void {
    this.viewReady = true;
    const id = Number(this.route.snapshot.paramMap.get('activityId'));
    if (!id) {
      this.loading = false;
      this.error = 'Activity not found.';
      return;
    }

    this.exploreService.getActivityDetails(id).subscribe({
      next: (res) => {
        this.activity = res;
        this.loadActivityMedia(res.activityId);
        this.loading = false;
        setTimeout(() => this.tryInitMap(), 80);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Unable to load this activity.';
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
    if (this.map) {
      this.map.remove();
    }
  }

  private loadActivityMedia(activityId: number): void {
    this.exploreService.getActivityMedia(activityId).subscribe({
      next: (items) => {
        this.activityMedia = items;
        this.currentMediaIndex = 0;
        const firstImage = items.find((m) => m.mediaType === 'IMAGE')?.url ?? items[0]?.url;
        if (firstImage) {
          this.heroImage = firstImage;
          this.startAutoSlide();
          return;
        }

        if (this.activity?.cityId) {
          this.loadCityHeroImage(this.activity.cityId);
        }
      },
      error: () => {
        this.activityMedia = [];
        this.stopAutoSlide();
        if (this.activity?.cityId) {
          this.loadCityHeroImage(this.activity.cityId);
        }
      },
    });
  }

  private loadCityHeroImage(cityId: number): void {
    this.exploreService.getCityDetails(cityId).subscribe({
      next: (details) => {
        if (this.activityMedia.length > 0) {
          return;
        }
        const firstImage = details.media.find((m) => m.mediaType === 'IMAGE')?.url ?? details.media[0]?.url;
        if (firstImage) {
          this.heroImage = firstImage;
        }
      },
      error: () => {
        this.heroImage = 'assets/sidi_bou.png';
      },
    });
  }

  private initMap(): void {
    if (!this.viewReady) {
      return;
    }

    const lat = Number(this.activity?.latitude);
    const lng = Number(this.activity?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const container = document.getElementById('activityMap');
    if (!container) {
      return;
    }

    if (!this.map) {
      this.map = L.map(container).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.map);
    } else {
      this.map.setView([lat, lng], 13);
    }

    setTimeout(() => this.map?.invalidateSize(), 80);

    if (this.activityMarker) {
      this.activityMarker.remove();
    }

    if (!this.map) {
      return;
    }

    const activityName = this.activity?.name ?? 'Activity';

    this.activityMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#e63946',
      fillColor: '#e63946',
      fillOpacity: 0.9,
    }).addTo(this.map).bindPopup(activityName).openPopup();
  }

  private tryInitMap(): void {
    this.initMap();
    if (!this.map) {
      setTimeout(() => this.initMap(), 220);
      setTimeout(() => this.initMap(), 480);
    }
  }

  selectMedia(index: number): void {
    if (index < 0 || index >= this.activityMedia.length) {
      return;
    }
    this.currentMediaIndex = index;
    this.heroImage = this.activityMedia[index].url;
    this.restartAutoSlide();
  }

  previousMedia(): void {
    const total = this.activityMedia.length;
    if (total <= 1) {
      return;
    }

    const nextIndex = (this.currentMediaIndex - 1 + total) % total;
    this.selectMedia(nextIndex);
  }

  nextMedia(): void {
    const total = this.activityMedia.length;
    if (total <= 1) {
      return;
    }

    const nextIndex = (this.currentMediaIndex + 1) % total;
    this.selectMedia(nextIndex);
  }

  submitReservation(): void {
    if (!this.activity || this.form.numberOfPeople < 1) {
      return;
    }

    this.submitting = true;
    this.exploreService
      .reserveActivity(this.activity.activityId, this.form)
      .subscribe({
        next: (res) => {
          this.created = res;
          this.submitting = false;
          Swal.fire({
            icon: 'success',
            title: 'Booking sent',
            text: `Reference #${res.reservationId}`,
            confirmButtonColor: '#e63946',
          });
        },
        error: (err) => {
          this.submitting = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || 'Booking failed.',
            confirmButtonColor: '#e63946',
          });
        },
      });
  }

  goBack(): void {
    this.location.back();
  }

  openDirectionsFromCurrentPosition(): void {
    if (this.activity?.latitude == null || this.activity?.longitude == null) {
      return;
    }

    const targetLat = this.activity.latitude;
    const targetLng = this.activity.longitude;

    const openMaps = (fromLat: number, fromLng: number) => {
      const url = `https://www.google.com/maps/dir/${fromLat},${fromLng}/${targetLat},${targetLng}`;
      window.open(url, '_blank');
    };

    if (!navigator.geolocation) {
      const fallback = `https://www.google.com/maps/search/?api=1&query=${targetLat},${targetLng}`;
      window.open(fallback, '_blank');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => openMaps(position.coords.latitude, position.coords.longitude),
      () => {
        const fallback = `https://www.google.com/maps/search/?api=1&query=${targetLat},${targetLng}`;
        window.open(fallback, '_blank');
      }
    );
  }

  private startAutoSlide(): void {
    this.stopAutoSlide();
    if (this.activityMedia.length <= 1) {
      return;
    }

    this.sliderTimer = setInterval(() => {
      this.nextMedia();
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
}
