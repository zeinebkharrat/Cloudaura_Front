import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { ExploreService } from './explore.service';
import { Restaurant } from './explore.models';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-detail.component.html',
  styleUrl: './restaurant-detail.component.css',
})
export class RestaurantDetailComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly exploreService = inject(ExploreService);
  private readonly location = inject(Location);

  restaurant?: Restaurant;
  loading = true;
  error = '';

  private map?: L.Map;
  private cityMarker?: L.CircleMarker;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    const id = Number(this.route.snapshot.paramMap.get('restaurantId'));
    if (!id) {
      this.loading = false;
      this.error = 'Restaurant introuvable.';
      return;
    }

    this.exploreService.getRestaurantDetails(id).subscribe({
      next: (res) => {
        this.restaurant = res;
        this.loading = false;
        setTimeout(() => this.tryInitMap(), 80);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Impossible de charger ce restaurant.';
      },
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    if (!this.viewReady) {
      return;
    }

    const lat = Number(this.restaurant?.latitude);
    const lng = Number(this.restaurant?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const container = document.getElementById('restaurantMap');
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

    if (this.cityMarker) {
      this.cityMarker.remove();
    }

    if (!this.map) {
      return;
    }

    const restaurantName = this.restaurant?.name ?? 'Restaurant';

    this.cityMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#e63946',
      fillColor: '#e63946',
      fillOpacity: 0.9,
    }).addTo(this.map).bindPopup(restaurantName).openPopup();
  }

  private tryInitMap(): void {
    this.initMap();
    if (!this.map) {
      setTimeout(() => this.initMap(), 220);
      setTimeout(() => this.initMap(), 480);
    }
  }

  goBack(): void {
    this.location.back();
  }

  openDirectionsFromCurrentPosition(): void {
    if (!this.restaurant?.latitude || !this.restaurant?.longitude) {
      return;
    }

    const targetLat = this.restaurant.latitude;
    const targetLng = this.restaurant.longitude;

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
}
