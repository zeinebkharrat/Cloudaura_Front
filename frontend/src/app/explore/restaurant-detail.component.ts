import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import * as L from 'leaflet';
import { ExploreService } from './explore.service';
import { PublicReview, ReviewSummary, Restaurant } from './explore.models';
import { AuthService } from '../core/auth.service';
import Swal from 'sweetalert2';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './restaurant-detail.component.html',
  styleUrl: './restaurant-detail.component.css',
})
export class RestaurantDetailComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly exploreService = inject(ExploreService);
  private readonly authService = inject(AuthService);
  private readonly location = inject(Location);
  private readonly translate = inject(TranslateService);

  restaurant?: Restaurant;
  loading = true;
  error = '';
  heroImage = 'assets/sidi_bou.png';
  reviewSummary: ReviewSummary = { averageStars: 0, totalReviews: 0 };
  reviews: PublicReview[] = [];
  reviewPage = 0;
  readonly reviewSize = 6;
  reviewSubmitting = false;
  reviewForm = {
    stars: 5,
    commentText: '',
  };
  editingReviewId: number | null = null;
  readonly commentEmojis = ['??', '??', '??', '??', '??', '??', '??', '??', '??', '??'];

  private map?: L.Map;
  private cityMarker?: L.CircleMarker;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    const id = Number(this.route.snapshot.paramMap.get('restaurantId'));
    if (!id) {
      this.loading = false;
      this.error = this.translate.instant('EXPLORE_RESTAURANT.ERR_NOT_FOUND');
      return;
    }

    this.exploreService.getRestaurantDetails(id).subscribe({
      next: (res) => {
        this.restaurant = res;
        if (res.imageUrl) {
          this.heroImage = res.imageUrl;
        }
        this.loadReviewSummary();
        this.loadReviews();
        this.loadCityHeroImage(res.cityId);
        this.loading = false;
        setTimeout(() => this.tryInitMap(), 80);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error =
          err?.error?.message || this.translate.instant('EXPLORE_RESTAURANT.ERR_LOAD');
      },
    });
  }

  private loadCityHeroImage(cityId: number): void {
    if (this.restaurant?.imageUrl) {
      return;
    }

    this.exploreService.getCityDetails(cityId).subscribe({
      next: (details) => {
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

  ratingValue(): number {
    return this.reviewSummary.averageStars || 0;
  }

  starStates(value: number): Array<'full' | 'empty'> {
    return Array.from({ length: 5 }, (_, index) => (value >= index + 1 ? 'full' : 'empty'));
  }

  setReviewStars(stars: number): void {
    this.reviewForm.stars = stars;
  }

  appendEmoji(emoji: string): void {
    this.reviewForm.commentText = `${this.reviewForm.commentText}${emoji}`;
  }

  startEditReview(review: PublicReview): void {
    this.editingReviewId = review.reviewId;
    this.reviewForm = {
      stars: review.stars,
      commentText: review.commentText,
    };
  }

  cancelEditReview(): void {
    this.editingReviewId = null;
    this.reviewForm = { stars: 5, commentText: '' };
  }

  isOwnReview(review: PublicReview): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return currentUserId != null && currentUserId === review.userId;
  }

  reviewAuthorEmail(review: PublicReview): string {
    return review.userEmail?.trim() || review.username;
  }

  reviewAuthorInitial(review: PublicReview): string {
    const source = this.reviewAuthorEmail(review).trim();
    return source ? source.charAt(0).toUpperCase() : '?';
  }

  deleteOwnReview(): void {
    if (!this.restaurant) {
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: 'Delete your comment?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
    }).then((result) => {
      if (!result.isConfirmed || !this.restaurant) {
        return;
      }

      this.reviewSubmitting = true;
      this.exploreService.deleteRestaurantReviewMine(this.restaurant.restaurantId).subscribe({
        next: () => {
          this.reviewSubmitting = false;
          this.cancelEditReview();
          this.loadReviewSummary();
          this.loadReviews();
        },
        error: (err: HttpErrorResponse) => {
          this.reviewSubmitting = false;
          if (err?.status === 401) {
            Swal.fire({
              icon: 'warning',
              title: 'Sign in required',
              text: 'Please sign in to manage your comment.',
              confirmButtonColor: '#e63946',
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || 'Unable to delete comment.',
            confirmButtonColor: '#e63946',
          });
        },
      });
    });
  }

  submitReview(): void {
    if (!this.restaurant || !this.reviewForm.commentText.trim()) {
      return;
    }

    this.reviewSubmitting = true;
    this.exploreService.createOrUpdateRestaurantReview(this.restaurant.restaurantId, {
      stars: this.reviewForm.stars,
      commentText: this.reviewForm.commentText.trim(),
    }).subscribe({
      next: () => {
        this.reviewSubmitting = false;
        this.cancelEditReview();
        this.loadReviewSummary();
        this.loadReviews();
      },
      error: (err: HttpErrorResponse) => {
        this.reviewSubmitting = false;
        if (err?.status === 401) {
          Swal.fire({
            icon: 'warning',
            title: this.translate.instant('EXPLORE_RESTAURANT.SWAL_SIGNIN_POST_TITLE'),
            text: this.translate.instant('EXPLORE_RESTAURANT.SWAL_SIGNIN_POST_TEXT'),
            confirmButtonColor: '#e63946',
          });
          return;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'Unable to publish comment.',
          confirmButtonColor: '#e63946',
        });
      },
    });
  }

  private loadReviewSummary(): void {
    if (!this.restaurant) {
      return;
    }

    this.exploreService.getRestaurantReviewSummary(this.restaurant.restaurantId).subscribe({
      next: (summary) => {
        this.reviewSummary = summary;
      },
      error: () => {
        this.reviewSummary = { averageStars: 0, totalReviews: 0 };
      },
    });
  }

  private loadReviews(): void {
    if (!this.restaurant) {
      return;
    }

    this.exploreService.listRestaurantReviews(this.restaurant.restaurantId, this.reviewPage, this.reviewSize).subscribe({
      next: (payload) => {
        this.reviewSummary = payload.summary;
        this.reviews = payload.reviews.content;
      },
      error: () => {
        this.reviews = [];
      },
    });
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


