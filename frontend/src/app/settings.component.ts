import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';
import { AuthService } from './core/auth.service';
import { DATA_SOURCE_TOKEN } from './core/adapters/data-source.adapter';
import { MyOrderSummary, ShopService } from './core/shop.service';
import { ExploreService } from './explore/explore.service';
import { ActivityReservationListItem } from './explore/explore.models';
import { PostService } from './Community/post.service';
import { LikeService } from './Community/like.service';
import { CommentService } from './Community/comment.service';
import { Comment, LikeEntity, Post } from './Community/community.types';
import {
  ChangePasswordPayload,
  CityOption,
  ProfileUpdatePayload,
  UserDeviceSession,
  UserProfile,
} from './core/auth.types';
import { extractApiErrorMessage } from './api-error.util';
import { AccommodationReservation, TransportReservation } from './core/models/travel.models';

type SettingsSection = 'profile' | 'security' | 'devices' | 'logs' | 'history';
type ActionKind = 'post' | 'like' | 'comment';
type HistoryTypeFilter = 'all' | 'transport' | 'stay' | 'activity' | 'event' | 'artisan';
type HistoryStatusFilter = 'all' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED';

interface ActionItem {
  kind: ActionKind;
  label: string;
  meta: string;
  timestamp: string | null;
  postId: number | null;
}

interface EventReservationHistoryItem {
  reservationId: number;
  eventId: number | null;
  eventName: string;
  status: string;
  createdAt: string | null;
  eventDate: string | null;
}

interface UnifiedHistoryItem {
  type: HistoryTypeFilter;
  title: string;
  subtitle: string;
  status: string;
  date: string | null;
  route: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  private readonly shop = inject(ShopService);
  private readonly explore = inject(ExploreService);
  private readonly postService = inject(PostService);
  private readonly likeService = inject(LikeService);
  private readonly commentService = inject(CommentService);
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('avatarPicker') private avatarPickerRef?: ElementRef<HTMLInputElement>;
  @ViewChild('coverPicker') private coverPickerRef?: ElementRef<HTMLInputElement>;

  readonly section = signal<SettingsSection>('profile');
  readonly loading = signal(true);
  readonly loadingError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  readonly avatarUploadBusy = signal(false);
  readonly coverUploadBusy = signal(false);
  readonly profileSaveBusy = signal(false);
  readonly passwordBusy = signal(false);
  readonly sessionBusy = signal(false);

  readonly editingProfile = signal(false);
  readonly profilePhotoMenuOpen = signal(false);
  readonly profilePhotoViewerOpen = signal(false);
  readonly coverImageUrl = signal('/assets/banner.png');

  readonly cities = signal<CityOption[]>([]);
  readonly nationalities = signal<string[]>([]);
  readonly deviceSessions = signal<UserDeviceSession[]>([]);

  readonly historyTypeFilter = signal<HistoryTypeFilter>('all');
  readonly historyStatusFilter = signal<HistoryStatusFilter>('all');
  readonly historySearch = signal('');

  readonly allPosts = signal<Post[]>([]);
  readonly myPosts = signal<Post[]>([]);
  readonly myLikes = signal<LikeEntity[]>([]);
  readonly myComments = signal<Comment[]>([]);
  readonly orders = signal<MyOrderSummary[]>([]);
  readonly transportReservations = signal<TransportReservation[]>([]);
  readonly accommodationReservations = signal<AccommodationReservation[]>([]);
  readonly transportCount = signal(0);
  readonly accommodationCount = signal(0);
  readonly activityReservations = signal<ActivityReservationListItem[]>([]);
  readonly eventReservations = signal<EventReservationHistoryItem[]>([]);

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(/^$|^(\+216)?[0-9]{8}$/)]],
    nationality: [''],
    cityId: [null as number | null],
    profileImageUrl: [''],
  });

  readonly currentUser = this.auth.currentUser;
  readonly initials = computed(() => {
    const user = this.currentUser();
    const first = (user?.firstName ?? '').trim().charAt(0);
    const last = (user?.lastName ?? '').trim().charAt(0);
    const fallback = (user?.username ?? 'U').charAt(0);
    return `${first}${last}`.trim() || fallback.toUpperCase();
  });

  readonly unifiedHistory = computed<UnifiedHistoryItem[]>(() => {
    const transport = this.transportReservations().map((item) => ({
      type: 'transport' as const,
      title: `${item.departureCityName ?? 'Departure'} to ${item.arrivalCityName ?? 'Arrival'}`,
      subtitle: `${item.transportType ?? 'Trip'} - ${item.numberOfSeats} seat(s)`,
      status: item.status ?? 'PENDING',
      date: item.createdAt ?? item.travelDate ?? null,
      route: '/mes-reservations',
    }));

    const stays = this.accommodationReservations().map((item) => ({
      type: 'stay' as const,
      title: item.accommodationName ?? 'Accommodation booking',
      subtitle: `${item.roomType ?? 'Room'}${item.accommodationCity ? ' - ' + item.accommodationCity : ''}`,
      status: item.status ?? 'PENDING',
      date: item.checkInDate ?? null,
      route: '/mes-reservations',
    }));

    const activities = this.activityReservations().map((item) => ({
      type: 'activity' as const,
      title: item.activityName,
      subtitle: `${item.cityName} - ${item.numberOfPeople} participant(s)`,
      status: item.status,
      date: item.reservationDate,
      route: '/mes-reservations',
    }));

    const events = this.eventReservations().map((item) => ({
      type: 'event' as const,
      title: item.eventName,
      subtitle: `Event booking #${item.reservationId}`,
      status: item.status,
      date: item.eventDate ?? item.createdAt,
      route: '/evenements',
    }));

    const artisan = this.orders().map((item) => ({
      type: 'artisan' as const,
      title: `Order #${item.orderId}`,
      subtitle: `${item.itemCount} item(s)`,
      status: item.status ?? 'PENDING',
      date: item.orderedAt ?? null,
      route: this.auth.isArtisan() ? '/mes-ordres' : '/mes-commandes',
    }));

    return [...transport, ...stays, ...activities, ...events, ...artisan].sort((a, b) => this.toTs(b.date) - this.toTs(a.date));
  });

  readonly filteredHistory = computed(() => {
    const type = this.historyTypeFilter();
    const status = this.historyStatusFilter();
    const query = this.historySearch().trim().toLowerCase();

    return this.unifiedHistory().filter((entry) => {
      if (type !== 'all' && entry.type !== type) {
        return false;
      }

      if (status !== 'all' && entry.status.toUpperCase() !== status) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${entry.title} ${entry.subtitle} ${entry.status}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly activityFeed = computed<ActionItem[]>(() => {
    const postById = new Map<number, Post>();
    for (const post of this.allPosts()) {
      if (post.postId != null) {
        postById.set(post.postId, post);
      }
    }

    const posts = this.myPosts().map((post) => ({
      kind: 'post' as const,
      label: 'You created a post',
      meta: this.clip(post.content ?? 'Post published in your community timeline.', 72),
      timestamp: post.createdAt ?? null,
      postId: post.postId ?? null,
    }));

    const likes = this.myLikes().map((like) => ({
      kind: 'like' as const,
      label: `You liked post of ${this.postAuthorName(postById.get(like.post?.postId ?? -1))}`,
      meta: 'Reaction added in community.',
      timestamp: like.createdAt ?? null,
      postId: like.post?.postId ?? null,
    }));

    const comments = this.myComments().map((comment) => ({
      kind: 'comment' as const,
      label: `You commented on post of ${this.postAuthorName(postById.get(comment.post?.postId ?? -1))}`,
      meta: this.clip(comment.content ?? 'Comment added in community.', 72),
      timestamp: comment.createdAt ?? null,
      postId: comment.post?.postId ?? null,
    }));

    return [...posts, ...likes, ...comments]
      .sort((a, b) => this.toTs(b.timestamp) - this.toTs(a.timestamp))
      .slice(0, 14);
  });

  readonly totalBookings = computed(() => this.transportCount() + this.accommodationCount() + this.activityReservations().length);
  readonly activeSessionsCount = computed(() => this.deviceSessions().filter((session) => session.active).length);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyDeepLinkParams(params);
    });

    this.auth.getNationalities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.nationalities.set(list),
      error: () => this.nationalities.set([]),
    });

    this.auth.getCities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (cities) => this.cities.set(cities),
      error: () => this.cities.set([]),
    });

    const current = this.currentUser();
    if (!current?.id) {
      this.auth.fetchMe().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (user) => this.initializeProfileState(user),
        error: () => {
          this.loading.set(false);
          this.loadingError.set('Could not load your profile data right now.');
        },
      });
      return;
    }

    this.initializeProfileState(current);
  }

  @HostListener('document:click')
  closePhotoMenuFromOutside(): void {
    if (this.profilePhotoMenuOpen()) {
      this.profilePhotoMenuOpen.set(false);
    }
  }

  selectSection(section: SettingsSection): void {
    this.section.set(section);
    if (section === 'devices') {
      this.refreshDeviceSessions();
    }
  }

  toggleEditProfile(): void {
    if (this.editingProfile()) {
      this.editingProfile.set(false);
      this.patchProfileForm(this.currentUser());
      return;
    }
    this.editingProfile.set(true);
  }

  toggleProfilePhotoMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.profilePhotoMenuOpen.update((open) => !open);
  }

  openProfilePhotoViewer(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profilePhotoViewerOpen.set(true);
    this.profilePhotoMenuOpen.set(false);
  }

  closeProfilePhotoViewer(): void {
    this.profilePhotoViewerOpen.set(false);
  }

  triggerAvatarPicker(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profilePhotoMenuOpen.set(false);
    this.avatarPickerRef?.nativeElement.click();
  }

  triggerCoverPicker(event?: MouseEvent): void {
    event?.stopPropagation();
    this.coverPickerRef?.nativeElement.click();
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.avatarUploadBusy()) {
      return;
    }

    this.avatarUploadBusy.set(true);
    this.actionError.set(null);

    this.auth.uploadProfileImage(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.profileForm.patchValue({ profileImageUrl: response.url });
        this.actionSuccess.set('Profile photo updated.');
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Image upload failed.'));
      },
      complete: () => {
        this.avatarUploadBusy.set(false);
        input.value = '';
      },
    });
  }

  onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.coverUploadBusy()) {
      return;
    }

    this.coverUploadBusy.set(true);
    this.actionError.set(null);

    this.auth.uploadProfileImage(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.coverImageUrl.set(response.url);
        const userId = this.currentUser()?.id;
        if (userId != null) {
          localStorage.setItem(this.coverStorageKey(userId), response.url);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Cover upload failed.'));
      },
      complete: () => {
        this.coverUploadBusy.set(false);
        input.value = '';
      },
    });
  }

  resetCoverPhoto(): void {
    this.coverImageUrl.set('/assets/banner.png');
    const userId = this.currentUser()?.id;
    if (userId != null) {
      localStorage.removeItem(this.coverStorageKey(userId));
    }
  }

  coverBackground(): string {
    return `linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.28)), url('${this.coverImageUrl()}')`;
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.profileSaveBusy()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const raw = this.profileForm.getRawValue();
    const payload: ProfileUpdatePayload = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      phone: this.normalizePhone(raw.phone),
      nationality: raw.nationality?.trim() || null,
      cityId: raw.cityId ?? null,
      profileImageUrl: raw.profileImageUrl?.trim() || null,
    };

    this.profileSaveBusy.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.auth.updateProfile(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.patchProfileForm(user);
        this.editingProfile.set(false);
        this.actionSuccess.set('Profile updated successfully.');
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Update failed.'));
      },
      complete: () => this.profileSaveBusy.set(false),
    });
  }

  async openChangePasswordPopup(): Promise<void> {
    if (this.passwordBusy()) {
      return;
    }

    const result = await Swal.fire({
      title: 'Change password',
      background: 'var(--surface-1)',
      color: 'var(--text-color)',
      customClass: {
        popup: 'profile-swal-popup',
        title: 'profile-swal-title',
        confirmButton: 'profile-swal-confirm',
        cancelButton: 'profile-swal-cancel',
      },
      buttonsStyling: false,
      showCancelButton: true,
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      html: `
        <div class="profile-swal-shell">
          <div class="profile-swal-hero">
            <span class="profile-swal-badge">Security</span>
            <h3>Refresh your password</h3>
            <p class="profile-swal-note">Use at least 8 characters with letters, numbers and symbols.</p>
          </div>
          <div class="profile-swal-form">
            <div class="profile-swal-input-wrap">
              <input id="sw-current-password" class="swal2-input profile-swal-input" type="password" placeholder="Current password" />
            </div>
            <div class="profile-swal-input-wrap">
              <input id="sw-new-password" class="swal2-input profile-swal-input" type="password" placeholder="New password" />
              <div class="profile-swal-strength">
                <span id="sw-password-strength-text" class="profile-swal-strength-text">Strength: weak</span>
                <div class="profile-swal-strength-track">
                  <span id="sw-password-strength-bar" class="profile-swal-strength-bar"></span>
                </div>
              </div>
              <ul class="profile-swal-rules">
                <li id="sw-rule-length" class="profile-swal-rule">8+ characters</li>
                <li id="sw-rule-case" class="profile-swal-rule">Uppercase and lowercase letters</li>
                <li id="sw-rule-number" class="profile-swal-rule">At least one number</li>
                <li id="sw-rule-symbol" class="profile-swal-rule">At least one symbol</li>
              </ul>
            </div>
            <div class="profile-swal-input-wrap">
              <input id="sw-confirm-password" class="swal2-input profile-swal-input" type="password" placeholder="Confirm new password" />
              <p id="sw-password-match" class="profile-swal-match"></p>
            </div>
          </div>
        </div>
      `,
      didOpen: () => {
        const newPasswordInput = document.getElementById('sw-new-password') as HTMLInputElement | null;
        const confirmPasswordInput = document.getElementById('sw-confirm-password') as HTMLInputElement | null;
        const strengthText = document.getElementById('sw-password-strength-text') as HTMLElement | null;
        const strengthBar = document.getElementById('sw-password-strength-bar') as HTMLElement | null;
        const matchText = document.getElementById('sw-password-match') as HTMLElement | null;
        const lengthRule = document.getElementById('sw-rule-length') as HTMLElement | null;
        const caseRule = document.getElementById('sw-rule-case') as HTMLElement | null;
        const numberRule = document.getElementById('sw-rule-number') as HTMLElement | null;
        const symbolRule = document.getElementById('sw-rule-symbol') as HTMLElement | null;

        const estimatePasswordStrength = (password: string): { label: string; scoreClass: string } => {
          const checks = [
            password.length >= 8,
            /[A-Z]/.test(password),
            /[a-z]/.test(password),
            /[0-9]/.test(password),
            /[^A-Za-z0-9]/.test(password),
          ];
          const score = checks.filter(Boolean).length;

          if (score <= 2) {
            return { label: 'weak', scoreClass: 'is-weak' };
          }
          if (score <= 4) {
            return { label: 'good', scoreClass: 'is-medium' };
          }
          return { label: 'strong', scoreClass: 'is-strong' };
        };

        const setRuleState = (el: HTMLElement | null, satisfied: boolean) => {
          if (!el) {
            return;
          }
          el.className = `profile-swal-rule ${satisfied ? 'is-done' : ''}`;
        };

        const updatePasswordHints = () => {
          const newPassword = newPasswordInput?.value?.trim() ?? '';
          const confirmPassword = confirmPasswordInput?.value?.trim() ?? '';

          const hasLength = newPassword.length >= 8;
          const hasUpper = /[A-Z]/.test(newPassword);
          const hasLower = /[a-z]/.test(newPassword);
          const hasNumber = /[0-9]/.test(newPassword);
          const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);

          setRuleState(lengthRule, hasLength);
          setRuleState(caseRule, hasUpper && hasLower);
          setRuleState(numberRule, hasNumber);
          setRuleState(symbolRule, hasSymbol);

          const strength = estimatePasswordStrength(newPassword);
          if (strengthText) {
            strengthText.textContent = `Strength: ${strength.label}`;
          }
          if (strengthBar) {
            strengthBar.className = `profile-swal-strength-bar ${strength.scoreClass}`;
          }

          if (!matchText) {
            return;
          }
          if (!confirmPassword) {
            matchText.textContent = '';
            matchText.className = 'profile-swal-match';
            return;
          }

          const matches = newPassword.length > 0 && newPassword === confirmPassword;
          matchText.textContent = matches ? 'Passwords match' : 'Passwords do not match';
          matchText.className = `profile-swal-match ${matches ? 'is-match' : 'is-mismatch'}`;
        };

        newPasswordInput?.addEventListener('input', updatePasswordHints);
        confirmPasswordInput?.addEventListener('input', updatePasswordHints);
        updatePasswordHints();
      },
      preConfirm: () => {
        const currentPassword = (document.getElementById('sw-current-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const newPassword = (document.getElementById('sw-new-password') as HTMLInputElement | null)?.value?.trim() ?? '';
        const confirmPassword = (document.getElementById('sw-confirm-password') as HTMLInputElement | null)?.value?.trim() ?? '';

        if (!currentPassword || !newPassword || !confirmPassword) {
          Swal.showValidationMessage('Please fill in all fields.');
          return null;
        }
        if (newPassword.length < 8) {
          Swal.showValidationMessage('The new password must be at least 8 characters.');
          return null;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage('Password confirmation does not match.');
          return null;
        }

        const payload: ChangePasswordPayload = { currentPassword, newPassword };
        return payload;
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.passwordBusy.set(true);
    this.actionError.set(null);

    this.auth.changePassword(result.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async () => {
        await Swal.fire({
          icon: 'success',
          title: 'Password updated',
          text: 'Your password has been updated successfully.',
          background: 'var(--surface-1)',
          color: 'var(--text-color)',
          customClass: {
            popup: 'profile-swal-popup',
            confirmButton: 'profile-swal-confirm',
          },
          buttonsStyling: false,
          confirmButtonText: 'OK',
        });
      },
      error: async (error: HttpErrorResponse) => {
        const message = extractApiErrorMessage(error, 'Could not change password.');
        this.actionError.set(message);
        await Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: message,
          background: 'var(--surface-1)',
          color: 'var(--text-color)',
          customClass: {
            popup: 'profile-swal-popup',
            confirmButton: 'profile-swal-confirm',
          },
          buttonsStyling: false,
          confirmButtonText: 'Close',
        });
      },
      complete: () => this.passwordBusy.set(false),
    });
  }

  refreshDeviceSessions(): void {
    this.sessionBusy.set(true);
    this.auth.getDeviceSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sessions) => this.deviceSessions.set(this.normalizeDeviceSessions(sessions)),
      error: () => this.deviceSessions.set(this.normalizeDeviceSessions([])),
      complete: () => this.sessionBusy.set(false),
    });
  }

  revokeSession(sessionId: string): void {
    this.auth.revokeDeviceSession(sessionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.refreshDeviceSessions(),
      error: () => {
        this.actionError.set('Could not close this session right now.');
      },
    });
  }

  revokeOtherSessions(): void {
    this.auth.revokeOtherDeviceSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.actionSuccess.set(`${res.revokedCount} session(s) closed.`);
        this.refreshDeviceSessions();
      },
      error: () => {
        this.actionError.set('Could not close other sessions right now.');
      },
    });
  }

  setHistoryType(value: HistoryTypeFilter): void {
    this.historyTypeFilter.set(value);
  }

  setHistoryStatus(value: HistoryStatusFilter): void {
    this.historyStatusFilter.set(value);
  }

  setHistorySearch(value: string): void {
    this.historySearch.set(value);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Unknown date';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  }

  statusLabel(status: string | null | undefined): string {
    const upper = (status ?? '').toUpperCase();
    if (upper === 'CONFIRMED' || upper === 'CONFIRMEE') {
      return 'Confirmed';
    }
    if (upper === 'PENDING') {
      return 'Pending';
    }
    if (upper === 'SHIPPED') {
      return 'Shipped';
    }
    if (upper === 'DELIVERED') {
      return 'Delivered';
    }
    if (upper === 'CANCELLED') {
      return 'Cancelled';
    }
    return status ?? 'Unknown';
  }

  actionBadge(kind: ActionKind): string {
    if (kind === 'post') {
      return 'Post';
    }
    if (kind === 'like') {
      return 'Like';
    }
    return 'Comment';
  }

  historyTypeLabel(value: HistoryTypeFilter): string {
    if (value === 'transport') {
      return 'Transport';
    }
    if (value === 'stay') {
      return 'Stay';
    }
    if (value === 'activity') {
      return 'Activity';
    }
    if (value === 'event') {
      return 'Event';
    }
    if (value === 'artisan') {
      return 'Artisan';
    }
    return 'All';
  }

  whereForSession(session: UserDeviceSession): string {
    const location = session.ipAddress?.trim();
    if (location) {
      return location;
    }
    return session.current ? 'Current browser session' : 'Unavailable';
  }

  private initializeProfileState(user: UserProfile): void {
    this.patchProfileForm(user);
    const savedCover = localStorage.getItem(this.coverStorageKey(user.id));
    if (savedCover) {
      this.coverImageUrl.set(savedCover);
    }
    this.loadDashboardData();
  }

  private patchProfileForm(user: UserProfile | null): void {
    if (!user) {
      return;
    }
    this.profileForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
      nationality: user.nationality ?? '',
      cityId: user.cityId ?? null,
      profileImageUrl: user.profileImageUrl ?? '',
    });
  }

  private loadDashboardData(): void {
    const user = this.currentUser();
    const userId = user?.id;

    if (!userId) {
      this.loading.set(false);
      this.loadingError.set('No active account found. Please sign in again.');
      return;
    }

    this.loading.set(true);
    this.loadingError.set(null);

    const orderRequest$ = this.auth.isArtisan()
      ? this.shop.getArtisanOrders().pipe(catchError(() => of([] as MyOrderSummary[])))
      : this.shop.getMyOrders().pipe(catchError(() => of([] as MyOrderSummary[])));

    forkJoin({
      profile: this.auth.getProfile().pipe(catchError(() => of(user))),
      posts: this.postService.getAllPosts().pipe(catchError(() => of([] as Post[]))),
      likes: this.likeService.getAllLikes().pipe(catchError(() => of([] as LikeEntity[]))),
      comments: this.commentService.getAllComments().pipe(catchError(() => of([] as Comment[]))),
      orders: orderRequest$,
      transportReservations: this.dataSource
        .getMyTransportReservations(userId)
        .pipe(catchError(() => of([] as TransportReservation[]))),
      accommodationReservations: this.dataSource
        .getMyAccommodationReservations(userId)
        .pipe(catchError(() => of([] as AccommodationReservation[]))),
      activityReservationsPage: this.explore
        .myActivityReservations(0, 24, 'reservationDate,desc')
        .pipe(catchError(() => of({ content: [] as ActivityReservationListItem[] }))),
      eventReservations: this.loadEventReservations(),
      deviceSessions: this.auth.getDeviceSessions().pipe(catchError(() => of([] as UserDeviceSession[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.patchProfileForm(payload.profile);
          this.allPosts.set(payload.posts);
          this.myPosts.set(payload.posts.filter((post) => post.author?.userId === userId));
          this.myLikes.set(payload.likes.filter((like) => like.user?.userId === userId));
          this.myComments.set(payload.comments.filter((comment) => comment.author?.userId === userId));
          this.orders.set(payload.orders);

          this.transportReservations.set(payload.transportReservations);
          this.accommodationReservations.set(payload.accommodationReservations);
          this.transportCount.set(payload.transportReservations.length);
          this.accommodationCount.set(payload.accommodationReservations.length);

          this.activityReservations.set(payload.activityReservationsPage.content ?? []);
          this.eventReservations.set(payload.eventReservations);
          this.deviceSessions.set(this.normalizeDeviceSessions(payload.deviceSessions));

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingError.set('Some settings data could not be loaded. Please refresh this page.');
        },
      });
  }

  private loadEventReservations() {
    return this.http.get<unknown>('/api/events/reservations/me').pipe(
      map((raw) => this.normalizeEventReservations(raw)),
      catchError(() => of([] as EventReservationHistoryItem[])),
    );
  }

  private normalizeEventReservations(raw: unknown): EventReservationHistoryItem[] {
    const src = raw as Record<string, unknown> | unknown[] | null;
    const list = Array.isArray(src)
      ? src
      : (src?.['content'] as unknown[]) ??
        (src?.['data'] as unknown[]) ??
        (src?.['items'] as unknown[]) ??
        [];

    if (!Array.isArray(list)) {
      return [];
    }

    const normalized: EventReservationHistoryItem[] = [];
    for (const item of list) {
      const row = item as Record<string, unknown>;
      const reservationId = Number(row['eventReservationId'] ?? row['reservationId'] ?? row['id']);
      if (Number.isNaN(reservationId)) {
        continue;
      }

      const eventIdRaw = row['eventId'] ?? row['event_id'];
      const eventId = eventIdRaw == null ? null : Number(eventIdRaw);
      normalized.push({
        reservationId,
        eventId: Number.isNaN(eventId) ? null : eventId,
        eventName: String(row['eventName'] ?? row['eventTitle'] ?? row['title'] ?? 'Event'),
        status: String(row['status'] ?? 'CONFIRMED'),
        createdAt: (row['createdAt'] as string | null | undefined) ?? null,
        eventDate: (row['eventDate'] as string | null | undefined) ?? null,
      });
    }

    return normalized;
  }

  private normalizePhone(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private postAuthorName(post: Post | undefined): string {
    if (!post?.author) {
      return 'someone';
    }

    const first = (post.author.firstName ?? '').trim();
    const last = (post.author.lastName ?? '').trim();
    const fullName = `${first} ${last}`.trim();
    if (fullName) {
      return fullName;
    }
    return post.author.username ?? 'someone';
  }

  private normalizeDeviceSessions(sessions: UserDeviceSession[]): UserDeviceSession[] {
    const normalized = Array.isArray(sessions) ? [...sessions] : [];
    if (normalized.some((session) => session.current)) {
      return normalized;
    }

    const nowIso = new Date().toISOString();
    normalized.unshift({
      sessionId: `current-browser-${Date.now()}`,
      deviceName: this.detectCurrentDeviceName(),
      ipAddress: null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      issuedAt: nowIso,
      lastSeenAt: nowIso,
      expiresAt: null,
      current: true,
      active: true,
    });

    return normalized;
  }

  private detectCurrentDeviceName(): string {
    if (typeof navigator === 'undefined') {
      return 'Current browser';
    }
    const platform = navigator.platform?.trim();
    if (platform) {
      return `Current browser (${platform})`;
    }
    return 'Current browser';
  }

  private coverStorageKey(userId: number): string {
    return `profile-cover-${userId}`;
  }

  private applyDeepLinkParams(params: ParamMap): void {
    const section = params.get('section');
    if (section === 'profile' || section === 'security' || section === 'devices' || section === 'logs' || section === 'history') {
      this.section.set(section);
    }

    const type = this.parseHistoryType(params.get('type'));
    if (type) {
      this.historyTypeFilter.set(type);
    }
  }

  private parseHistoryType(value: string | null): HistoryTypeFilter | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'all' ||
      normalized === 'transport' ||
      normalized === 'stay' ||
      normalized === 'activity' ||
      normalized === 'event' ||
      normalized === 'artisan'
    ) {
      return normalized;
    }
    return null;
  }

  private clip(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength - 1)}…`;
  }

  private toTs(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
}
