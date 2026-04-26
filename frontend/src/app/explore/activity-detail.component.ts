import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import * as L from 'leaflet';
import Swal from 'sweetalert2';
import { extractApiErrorMessage } from '../api-error.util';
import {
  ActivityAvailabilityDay,
  Activity,
  ActivityMedia,
  PublicReview,
  ReviewSummary,
  CreateActivityReservationRequest,
} from './explore.models';
import { ExploreService } from './explore.service';
import { LoginRequiredPromptService } from '../core/login-required-prompt.service';
import { AuthService } from '../core/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { DualCurrencyPipe } from '../core/pipes/dual-currency.pipe';

interface CalendarDayCell {
  dateIso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  available: boolean;
  selectable: boolean;
  remainingParticipants: number | null;
}

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, DualCurrencyPipe],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.css',
})
export class ActivityDetailComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly exploreService = inject(ExploreService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly location = inject(Location);
  private readonly loginPrompt = inject(LoginRequiredPromptService);

  activity?: Activity;
  activityMedia: ActivityMedia[] = [];
  currentMediaIndex = 0;
  loading = true;
  error = '';
  heroImage = 'assets/sidi_bou.png';
  heroAnimating = false;
  heroAnimationDirection: 'next' | 'prev' = 'next';

  private map?: L.Map;
  private activityMarker?: L.CircleMarker;
  private viewReady = false;
  private sliderTimer: ReturnType<typeof setInterval> | null = null;
  private animationResetTimer: ReturnType<typeof setTimeout> | null = null;
  private availabilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  loadingAvailability = false;
  availabilityDays: ActivityAvailabilityDay[] = [];
  availabilityByDate = new Map<string, ActivityAvailabilityDay>();
  calendarDays: CalendarDayCell[] = [];
  calendarMonth = this.startOfMonth(new Date());
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdayIndices = [0, 1, 2, 3, 4, 5, 6];
  showOnlyAvailable = false;

  form: CreateActivityReservationRequest = {
    reservationDate: new Date().toISOString().slice(0, 10),
    numberOfPeople: 1,
  };

  submitting = false;
  showBookingModal = false;
  reviewSummary: ReviewSummary = { averageStars: 0, totalReviews: 0 };
  reviews: PublicReview[] = [];
  reviewSubmitting = false;
  reviewForm = {
    stars: 5,
    commentText: '',
  };
  editingReviewId: number | null = null;
  readonly maxReviewCommentLength = 1500;
  emojiPickerOpen = false;
  emojiSearchQuery = '';
  activeEmojiCategory = 'smileys';
  readonly emojiCategories: Array<{ id: string; icon: string; emojis: string[] }> = [
    {
      id: 'smileys',
      icon: '😀',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤗', '😎', '🥳', '😌', '😢', '😭', '😡', '😱', '😷', '🤒', '🤢'],
    },
    {
      id: 'gestures',
      icon: '👍',
      emojis: ['👍', '👎', '👌', '✌️', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🙏', '💪', '👋', '🤝', '☝️', '👆', '👇', '👉', '👈'],
    },
    {
      id: 'travel',
      icon: '✈️',
      emojis: ['✈️', '🧳', '🗺️', '🧭', '🏝️', '🏖️', '🏜️', '🏕️', '🏛️', '🕌', '🗼', '🎡', '🚗', '🚕', '🚌', '🚆', '🚇', '⛵', '🚤', '🛳️'],
    },
    {
      id: 'food',
      icon: '🍽️',
      emojis: ['🍽️', '☕', '🍵', '🥤', '🍕', '🍔', '🌮', '🥙', '🍟', '🍜', '🍝', '🍣', '🥗', '🥘', '🍲', '🍛', '🍰', '🍩', '🍎', '🍉'],
    },
    {
      id: 'symbols',
      icon: '❤️',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '✅', '❌', '⚠️', '⭐', '🔥', '✨', '💬', '📍', '📸'],
    },
  ];

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
        this.loadReviewSummary();
        this.loadReviews();
        this.loadAvailability();
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
    if (this.animationResetTimer) {
      clearTimeout(this.animationResetTimer);
      this.animationResetTimer = null;
    }
    if (this.availabilityDebounceTimer) {
      clearTimeout(this.availabilityDebounceTimer);
      this.availabilityDebounceTimer = null;
    }
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

  selectMedia(index: number, direction: 'next' | 'prev' = 'next'): void {
    if (index < 0 || index >= this.activityMedia.length) {
      return;
    }
    this.heroAnimationDirection = direction;
    this.triggerHeroSlideAnimation();
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
    this.selectMedia(nextIndex, 'prev');
  }

  nextMedia(): void {
    const total = this.activityMedia.length;
    if (total <= 1) {
      return;
    }

    const nextIndex = (this.currentMediaIndex + 1) % total;
    this.selectMedia(nextIndex, 'next');
  }

  submitReservation(): void {
    this.blurActiveElement();

    if (!this.activity || this.form.numberOfPeople < 1) {
      return;
    }

    const selectedAvailability = this.availabilityByDate.get(this.form.reservationDate);
    if (selectedAvailability && selectedAvailability.remainingParticipants != null) {
      if (this.form.numberOfPeople > selectedAvailability.remainingParticipants) {
        this.blurActiveElement();
        Swal.fire({
          icon: 'warning',
          title: 'Places insuffisantes',
          text: `Il reste ${selectedAvailability.remainingParticipants} place(s) pour cette date.`,
          confirmButtonColor: '#e63946',
        });
        return;
      }
    }

    this.submitting = true;
    this.http
      .post<{ sessionId: string; sessionUrl: string }>(
        `/api/public/activities/${this.activity.activityId}/reservations/checkout`,
        this.form
      )
      .subscribe({
        next: (res: { sessionId: string; sessionUrl: string }) => {
          this.submitting = false;
          this.showBookingModal = false;
          if (res?.sessionUrl) {
            this.blurActiveElement();
            window.location.href = res.sessionUrl;
            return;
          }

          this.blurActiveElement();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Unable to start payment session.',
            confirmButtonColor: '#e63946',
          });
        },
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          this.blurActiveElement();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: extractApiErrorMessage(err, 'Booking failed.'),
            confirmButtonColor: '#e63946',
          });
        },
      });
  }

  openBookingModal(): void {
    if (!this.authService.isAuthenticated()) {
      this.loginPrompt.show({
        title: 'Sign in to reserve this activity',
        message: 'Please sign in or create an account to complete your activity reservation.',
        returnUrl: this.router.url,
      });
      return;
    }

    this.showBookingModal = true;
    this.loadAvailability();
  }

  closeBookingModal(): void {
    if (this.submitting) {
      return;
    }
    this.showBookingModal = false;
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
    if (this.reviewForm.commentText.length >= this.maxReviewCommentLength) {
      return;
    }
    this.reviewForm.commentText = `${this.reviewForm.commentText}${emoji}`;
  }

  get visibleReviewEmojis(): string[] {
    const category = this.emojiCategories.find((entry) => entry.id === this.activeEmojiCategory) ?? this.emojiCategories[0];
    const source = category?.emojis ?? [];
    const query = this.emojiSearchQuery.trim();
    if (!query) {
      return source;
    }
    return source.filter((emoji) => emoji.includes(query));
  }

  toggleEmojiPicker(): void {
    this.emojiPickerOpen = !this.emojiPickerOpen;
    if (!this.emojiPickerOpen) {
      this.emojiSearchQuery = '';
    }
  }

  selectEmojiCategory(categoryId: string): void {
    this.activeEmojiCategory = categoryId;
    this.emojiSearchQuery = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.emojiPickerOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (!target.closest('.emoji-picker-wrap')) {
      this.emojiPickerOpen = false;
    }
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
    if (!this.activity) {
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
      if (!result.isConfirmed || !this.activity) {
        return;
      }

      this.reviewSubmitting = true;
      this.exploreService.deleteActivityReviewMine(this.activity.activityId).subscribe({
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
    if (!this.activity || !this.reviewForm.commentText.trim()) {
      return;
    }

    this.reviewSubmitting = true;
    this.exploreService.createOrUpdateActivityReview(this.activity.activityId, {
      stars: this.reviewForm.stars,
      commentText: this.reviewForm.commentText.trim(),
    }).subscribe({
      next: () => {
        this.reviewSubmitting = false;
        this.cancelEditReview();
        this.loadReviewSummary();
        this.loadReviews();
      },
      error: (err) => {
        this.reviewSubmitting = false;
        if (err?.status === 401) {
          Swal.fire({
            icon: 'warning',
            title: 'Sign in required',
            text: 'Please sign in to post a comment.',
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

  private loadReviewSummary(): void {
    if (!this.activity) {
      return;
    }
    this.exploreService.getActivityReviewSummary(this.activity.activityId).subscribe({
      next: (summary) => {
        this.reviewSummary = summary;
      },
      error: () => {
        this.reviewSummary = { averageStars: 0, totalReviews: 0 };
      },
    });
  }

  private loadReviews(): void {
    if (!this.activity) {
      return;
    }
    this.exploreService.listActivityReviews(this.activity.activityId, 0, 6).subscribe({
      next: (payload) => {
        this.reviewSummary = payload.summary;
        this.reviews = payload.reviews.content;
      },
      error: () => {
        this.reviews = [];
      },
    });
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

  private triggerHeroSlideAnimation(): void {
    this.heroAnimating = false;
    requestAnimationFrame(() => {
      this.heroAnimating = true;
      if (this.animationResetTimer) {
        clearTimeout(this.animationResetTimer);
      }
      this.animationResetTimer = setTimeout(() => {
        this.heroAnimating = false;
      }, 430);
    });
  }

  onParticipantsChanged(): void {
    if (this.form.numberOfPeople < 1) {
      this.form.numberOfPeople = 1;
    }

    if (this.availabilityDebounceTimer) {
      clearTimeout(this.availabilityDebounceTimer);
    }
    this.availabilityDebounceTimer = setTimeout(() => this.loadAvailability(), 220);
  }

  previousMonth(): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
    this.loadAvailability();
  }

  nextMonth(): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    this.loadAvailability();
  }

  selectDate(cell: CalendarDayCell): void {
    if (!cell.selectable) {
      return;
    }
    this.form.reservationDate = cell.dateIso;
  }

  isSelectedDate(dateIso: string): boolean {
    return this.form.reservationDate === dateIso;
  }

  monthLabel(): string {
    return this.calendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  totalPrice(): number {
    const unitPrice = this.activity?.price ?? 0;
    return unitPrice * Math.max(1, this.form.numberOfPeople || 1);
  }

  selectedRemainingPlaces(): string {
    const availability = this.availabilityByDate.get(this.form.reservationDate);
    if (!availability) {
      return '—';
    }
    if (availability.remainingParticipants == null) {
      return 'Unlimited';
    }
    return String(availability.remainingParticipants);
  }

  private loadAvailability(): void {
    if (!this.activity) {
      return;
    }

    const from = this.toIsoDate(this.calendarMonth);
    const days = 62;
    const participants = Math.max(1, this.form.numberOfPeople || 1);

    this.loadingAvailability = true;
    this.exploreService.getActivityAvailability(this.activity.activityId, from, days, participants).subscribe({
      next: (daysAvailability) => {
        this.availabilityDays = daysAvailability;
        this.availabilityByDate = new Map(daysAvailability.map((day) => [day.date, day]));
        this.buildCalendar();
        this.loadingAvailability = false;
      },
      error: () => {
        this.availabilityDays = [];
        this.availabilityByDate = new Map();
        this.buildCalendar();
        this.loadingAvailability = false;
      },
    });
  }

  buildCalendar(): void {
    const start = this.startOfMonth(this.calendarMonth);
    const end = this.endOfMonth(this.calendarMonth);
    const firstWeekday = start.getDay();
    const totalDays = end.getDate();

    const cells: CalendarDayCell[] = [];
    for (let index = 0; index < firstWeekday; index++) {
      const date = new Date(start.getFullYear(), start.getMonth(), 1 - (firstWeekday - index));
      cells.push(this.makeCell(date, false));
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), day);
      cells.push(this.makeCell(date, true));
    }

    while (cells.length % 7 !== 0) {
      const day = cells.length - (firstWeekday + totalDays) + 1;
      const date = new Date(start.getFullYear(), start.getMonth() + 1, day);
      cells.push(this.makeCell(date, false));
    }

    this.calendarDays = cells;

    const currentSelection = this.availabilityByDate.get(this.form.reservationDate);
    if (!currentSelection?.available) {
      const firstAvailable = cells.find((cell) => cell.inCurrentMonth && cell.selectable);
      if (firstAvailable) {
        this.form.reservationDate = firstAvailable.dateIso;
      }
    }
  }

  private makeCell(date: Date, inCurrentMonth: boolean): CalendarDayCell {
    const dateIso = this.toIsoDate(date);
    const availability = this.availabilityByDate.get(dateIso);
    const todayIso = this.toIsoDate(new Date());
    const isPast = dateIso < todayIso;
    const available = availability ? availability.available : !isPast;
    const selectable = inCurrentMonth && available;

    return {
      dateIso,
      dayNumber: date.getDate(),
      inCurrentMonth,
      available,
      selectable,
      remainingParticipants: availability?.remainingParticipants ?? null,
    };
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private blurActiveElement(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }

  releaseFocus(): void {
    this.blurActiveElement();
  }
}
