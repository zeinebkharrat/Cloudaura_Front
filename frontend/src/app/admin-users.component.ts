import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from './admin-user.service';
import { AuthService } from './core/auth.service';
import { AdminUser, AdminUserInsights, CityOption } from './core/auth.types';
import { extractApiErrorMessage } from './api-error.util';
import Swal from 'sweetalert2';
import type { SweetAlertOptions } from 'sweetalert2';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent {
  private readonly adminUserService = inject(AdminUserService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<AdminUser[]>([]);
  readonly usersPage = signal(0);
  readonly usersPageSize = signal(10);
  readonly usersTotalPages = computed(() => {
    const size = this.usersPageSize();
    if (size <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.users().length / size));
  });
  readonly paginatedUsers = computed(() => {
    const page = this.usersPage();
    const size = this.usersPageSize();
    const start = page * size;
    return this.users().slice(start, start + size);
  });
  readonly cities = signal<CityOption[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  readonly searchForm = this.fb.nonNullable.group({
    q: [''],
  });

  private isTunisiaNationality(value: string | null | undefined): boolean {
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized === 'tunisia' || normalized === 'tunisian' || normalized === 'tunisie';
  }

  async openUserDetailsPopup(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    try {
      const insights = await firstValueFrom(this.adminUserService.getUserInsights(user.id));
      const overviewHtml = this.buildOverviewHtml(insights);
      const preferencesHtml = this.buildPreferencesHtml(insights);
      const logsHtml = this.buildCommunityLogsHtml(insights);
      const reservationsHtml = this.buildReservationsHtml(insights);

      await this.popup({
        title: `${this.escapeHtml(user.username)} profile details`,
        width: 'min(1080px, 96vw)',
        showConfirmButton: true,
        confirmButtonText: 'Close',
        html: `
          <div class="details-shell details-shell--full details-shell--tabs">
            <div class="details-toolbar" role="tablist" aria-label="User details sections">
              <button type="button" class="details-toggle is-active" data-target="overview">Overview</button>
              <button type="button" class="details-toggle" data-target="preferences">Preferences</button>
              <button type="button" class="details-toggle" data-target="logs">Logs</button>
              <button type="button" class="details-toggle" data-target="reservations">Reservations</button>
            </div>

            <section class="details-tab-panel is-active" data-panel="overview">${overviewHtml}</section>
            <section class="details-tab-panel" data-panel="preferences">${preferencesHtml}</section>
            <section class="details-tab-panel" data-panel="logs">${logsHtml}</section>
            <section class="details-tab-panel" data-panel="reservations">${reservationsHtml}</section>
          </div>
        `,
        didOpen: () => this.initDetailsTabs(),
      });
    } catch (error) {
      const message = extractApiErrorMessage(error as HttpErrorResponse, 'Could not load user details.');
      void this.popup({ icon: 'error', title: 'Failed', text: message });
    }
  }

  private buildOverviewHtml(insights: AdminUserInsights): string {
    const profileBlock = this.buildUserProfileBlock(insights.user);
    return `
      <section class="details-insights">
        ${profileBlock}
        <div class="details-section-header">
          <h4>Quick metrics</h4>
          <p>Fast snapshot of community and travel behavior.</p>
        </div>
        <div class="insights-grid insights-grid--overview">
          <article class="insight-card insight-card--community"><h4>Posts</h4><p>${insights.community.postsCount}</p></article>
          <article class="insight-card insight-card--community"><h4>Comments</h4><p>${insights.community.commentsCount}</p></article>
          <article class="insight-card insight-card--community"><h4>Likes</h4><p>${insights.community.likesGivenCount}</p></article>
          <article class="insight-card insight-card--reservation"><h4>Stay</h4><p>${insights.reservations.accommodationsCount}</p></article>
          <article class="insight-card insight-card--reservation"><h4>Activities</h4><p>${insights.reservations.activityCount}</p></article>
          <article class="insight-card insight-card--reservation"><h4>Events</h4><p>${insights.reservations.eventCount}</p></article>
          <article class="insight-card insight-card--reservation"><h4>Transport</h4><p>${insights.reservations.transportCount}</p></article>
        </div>
      </section>
    `;
  }

  private buildCommunityLogsHtml(insights: AdminUserInsights): string {
    const communityRows = [
      ...insights.community.recentPosts.map((item) => this.toTimelineRow('Post', item.title, item.subtitle, item.createdAt)),
      ...insights.community.recentComments.map((item) => this.toTimelineRow('Comment', item.title, item.subtitle, item.createdAt)),
      ...insights.community.recentLikes.map((item) => this.toTimelineRow('Like', item.title, item.subtitle, item.createdAt)),
    ];

    return `
      <section class="details-insights">
        <div class="details-section-header">
          <h4>Community logs</h4>
          <p>Posts, comments, and likes in one timeline.</p>
        </div>
        <div class="timeline timeline--inline">
          ${communityRows.length ? communityRows.join('') : '<p class="muted">No community action found yet.</p>'}
        </div>
      </section>
    `;
  }

  private buildReservationsHtml(insights: AdminUserInsights): string {
    const reservationRows = [
      ...insights.reservations.recentActivityReservations.map((item) => this.toReservationRow('Activity', item)),
      ...insights.reservations.recentEventReservations.map((item) => this.toReservationRow('Event', item)),
    ];

    return `
      <section class="details-insights">
        <div class="details-section-header">
          <h4>Reservation logs</h4>
          <p>Event and activity reservations with status and price.</p>
        </div>
        <div class="timeline timeline--inline">
          ${reservationRows.length ? reservationRows.join('') : '<p class="muted">No reservation history for this user.</p>'}
        </div>
      </section>
    `;
  }

  private initDetailsTabs(): void {
    const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>('.details-toggle[data-target]'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.details-tab-panel[data-panel]'));
    if (!toggles.length || !panels.length) {
      return;
    }

    const activate = (target: string) => {
      toggles.forEach((btn) => btn.classList.toggle('is-active', btn.dataset['target'] === target));
      panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset['panel'] === target));
    };

    toggles.forEach((btn) => {
      btn.addEventListener('click', () => activate(btn.dataset['target'] || 'overview'));
    });

    activate('overview');
  }

  private buildUserProfileBlock(user: AdminUser): string {
    const safeFirstName = this.escapeHtml(user.firstName || 'Unknown');
    const safeLastName = this.escapeHtml(user.lastName || 'User');
    const safeUsername = this.escapeHtml(user.username || 'unknown');
    const safeEmail = this.escapeHtml(user.email || 'Email unavailable');
    const safeNationality = this.escapeHtml(user.nationality || 'Unknown nationality');
    const safeCity = this.escapeHtml(user.cityName || 'No city');
    const safeRoles = this.escapeHtml((user.roles || []).join(', ') || 'No role');
    const initials = (user.firstName?.[0] ?? user.username?.[0] ?? 'U').toUpperCase();
    const avatar = user.profileImageUrl
      ? `<img src="${this.escapeHtml(user.profileImageUrl)}" alt="avatar" class="details-avatar" />`
      : `<div class="details-avatar details-avatar--placeholder">${initials}</div>`;

    return `
      <div class="details-profile">
        ${avatar}
        <div class="details-profile-copy">
          <h3>${safeFirstName} ${safeLastName}</h3>
          <p>@${safeUsername} · ${safeEmail}</p>
          <div class="details-tags">
            <span class="status ${user.banned ? 'banned' : 'active'}">${user.banned ? 'Banned' : 'Active'}</span>
            <span class="role-pill">${safeRoles}</span>
            <span class="role-pill">${safeNationality}</span>
            <span class="role-pill">${safeCity}</span>
          </div>
        </div>
      </div>
    `;
  }

  private buildPreferencesHtml(insights: AdminUserInsights): string {
    const prefs = insights.preferences;
    const chips = [
      ['Interests', prefs.interests || 'Not set'],
      ['Region', prefs.preferredRegion || 'Not set'],
      ['Travel with', prefs.travelWith || 'Not set'],
      ['Budget level', prefs.budgetLevel || 'Not set'],
      ['Budget range', prefs.budgetMin != null && prefs.budgetMax != null ? `${prefs.budgetMin} - ${prefs.budgetMax}` : 'Not set'],
      ['Accommodation', prefs.accommodationType || 'Not set'],
      ['Transport', prefs.transportPreference || 'Not set'],
      ['Cuisine', prefs.preferredCuisine || 'Not set'],
    ];

    return `
      <div class="details-preferences">
        <div class="details-section-header">
          <h4>Saved preferences</h4>
          <p>Model-aligned values shown with clear labels for support and moderation teams.</p>
        </div>
        <div class="pref-chips">
          ${chips
            .map(
              ([label, value]) => `
              <article class="pref-chip">
                <span>${this.escapeHtml(label)}</span>
                <strong>${this.escapeHtml(value)}</strong>
              </article>
            `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  private toTimelineRow(type: string, title: string, subtitle: string, createdAt: string | null): string {
    return `
      <article class="timeline-item">
        <span class="timeline-type">${this.escapeHtml(type)}</span>
        <div class="timeline-body">
          <h5>${this.escapeHtml(title || type)}</h5>
          <p>${this.escapeHtml(subtitle || '')}</p>
          <small>${this.formatDate(createdAt)}</small>
        </div>
      </article>
    `;
  }

  private toReservationRow(type: string, item: { title: string; status: string; totalPrice: number | null; reservationDate: string | null; reservationDateTime: string | null }): string {
    const when = item.reservationDateTime || item.reservationDate;
    const price = item.totalPrice != null ? `${item.totalPrice.toFixed(2)} TND` : 'N/A';
    return `
      <article class="timeline-item">
        <span class="timeline-type">${this.escapeHtml(type)}</span>
        <div class="timeline-body">
          <h5>${this.escapeHtml(item.title || type)}</h5>
          <p>Status: ${this.escapeHtml(item.status || 'UNKNOWN')} · Price: ${this.escapeHtml(price)}</p>
          <small>${this.formatDate(when)}</small>
        </div>
      </article>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  displayOrFallback(value: string | null | undefined, fallback: string): string {
    const normalized = value?.trim();
    return normalized ? normalized : fallback;
  }

  private formatDate(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return 'Date unavailable';
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }
    return date.toLocaleString();
  }

  private isValidPhone(value: string): boolean {
    return /^\+?[0-9\s-]{8,20}$/.test(value);
  }

  constructor() {
    this.loadCities();

    this.searchForm.controls.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadUsers());

    this.loadUsers();
  }

  private popup(options: SweetAlertOptions) {
    const darkMode =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark');
    const popupThemeClass = darkMode ? 'bo-popup bo-popup-dark' : 'bo-popup bo-popup-light';
    return Swal.fire({
      customClass: {
        popup: popupThemeClass,
        title: 'bo-title',
        htmlContainer: 'bo-content',
        confirmButton: 'bo-btn bo-btn-confirm',
        cancelButton: 'bo-btn bo-btn-cancel',
        denyButton: 'bo-btn bo-btn-deny',
      },
      buttonsStyling: false,
      background: darkMode ? '#0f1720' : '#f8fbff',
      color: darkMode ? '#e8edf3' : '#10243f',
      backdrop: darkMode ? 'rgba(7, 12, 18, 0.75)' : 'rgba(145, 159, 180, 0.38)',
      ...options,
    });
  }

  private loadCities() {
    this.adminUserService.listCities().subscribe({
      next: (cities) => this.cities.set(cities),
      error: () => this.cities.set([]),
    });
  }

  loadUsers() {
    this.isLoading.set(true);
    this.actionError.set(null);

    this.adminUserService.listUsers(this.searchForm.controls.q.value).subscribe({
      next: (users) => {
        const currentUserId = this.authService.currentUser()?.id;
        this.users.set(currentUserId ? users.filter((user) => user.id !== currentUserId) : users);
        this.usersPage.set(0);
      },
      error: () => this.actionError.set('Could not load users.'),
      complete: () => this.isLoading.set(false),
    });
  }

  onUsersPageSizeChange(size: string): void {
    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    this.usersPageSize.set(parsed);
    this.usersPage.set(0);
  }

  previousUsersPage(): void {
    if (this.usersPage() <= 0 || this.isLoading()) {
      return;
    }
    this.usersPage.update((current) => current - 1);
  }

  nextUsersPage(): void {
    if (this.usersPage() >= this.usersTotalPages() - 1 || this.isLoading()) {
      return;
    }
    this.usersPage.update((current) => current + 1);
  }

  async openEditPopup(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    const cityOptions = this.cities()
      .map((city) => {
        const cityId = city.id ?? city.cityId;
        const selected = user.cityId != null && cityId != null && Number(user.cityId) === Number(cityId);
        return `<option value="${cityId ?? ''}" ${selected ? 'selected' : ''}>${city.name} (${city.region})</option>`;
      })
      .join('');
    let uploadedImageUrl: string | null = user.profileImageUrl ?? null;

    const result = await this.popup({
      title: `Edit ${user.username}`,
      width: 760,
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      html: `
        <div class="sw-grid">
          <div class="sw-avatar-top">
            <div class="sw-chip">User profile</div>
            <div class="sw-avatar-frame">
              <img id="sw-avatar-preview" class="sw-avatar-preview" src="${user.profileImageUrl ?? ''}" alt="avatar" />
              <div id="sw-avatar-placeholder" class="sw-avatar-placeholder ${user.profileImageUrl ? 'hidden' : ''}">${user.username.charAt(0).toUpperCase()}</div>
            </div>
            <label class="sw-upload-btn" for="sw-avatar-file">Choose a photo</label>
            <input id="sw-avatar-file" class="sw-avatar-file" type="file" accept="image/*" />
            <p class="sw-upload-hint">PNG or JPG recommended; clear face-forward photo works best.</p>
          </div>
          <label class="sw-field">First name<input id="sw-firstName" class="sw-input" placeholder="First name" value="${user.firstName}" /></label>
          <label class="sw-field">Last name<input id="sw-lastName" class="sw-input" placeholder="Last name" value="${user.lastName}" /></label>
          <label class="sw-field">Email<input id="sw-email" class="sw-input" placeholder="Email" value="${user.email}" /></label>
          <label class="sw-field">Phone<input id="sw-phone" class="sw-input" placeholder="Phone" value="${user.phone ?? ''}" /></label>
          <label class="sw-field">Status<select id="sw-status" class="sw-input">
            <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="INACTIVE" ${user.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
          </select></label>
          <label class="sw-field">Nationality<input id="sw-nationality" class="sw-input" placeholder="Nationality" value="${user.nationality ?? ''}" /></label>
          <label class="sw-field">City<select id="sw-city" class="sw-input">
            <option value="">Choose a city (if Tunisian)</option>
            ${cityOptions}
          </select></label>
        </div>
      `,
      didOpen: () => {
        const nationalityEl = document.getElementById('sw-nationality') as HTMLInputElement | null;
        const cityEl = document.getElementById('sw-city') as HTMLSelectElement | null;
        const avatarPreviewEl = document.getElementById('sw-avatar-preview') as HTMLImageElement | null;
        const avatarPlaceholderEl = document.getElementById('sw-avatar-placeholder') as HTMLDivElement | null;
        const avatarFileEl = document.getElementById('sw-avatar-file') as HTMLInputElement | null;
        const updateCityVisibility = () => {
          if (!nationalityEl || !cityEl) {
            return;
          }
          const tunisian = this.isTunisiaNationality(nationalityEl.value);
          cityEl.disabled = !tunisian;
          if (!tunisian) {
            cityEl.value = '';
          }
        };
        nationalityEl?.addEventListener('input', updateCityVisibility);
        updateCityVisibility();

        avatarFileEl?.addEventListener('change', () => {
          const file = avatarFileEl.files?.[0];
          if (!file) {
            return;
          }
          this.adminUserService.uploadProfileImage(file).subscribe({
            next: (response) => {
              uploadedImageUrl = response.url;
              if (avatarPreviewEl) {
                avatarPreviewEl.src = response.url;
              }
              avatarPlaceholderEl?.classList.add('hidden');
            },
            error: (error: HttpErrorResponse) => {
              Swal.showValidationMessage(extractApiErrorMessage(error, 'Image upload failed.'));
            },
          });
        });
      },
      preConfirm: () => {
        const firstName = (document.getElementById('sw-firstName') as HTMLInputElement | null)?.value?.trim() ?? '';
        const lastName = (document.getElementById('sw-lastName') as HTMLInputElement | null)?.value?.trim() ?? '';
        const email = (document.getElementById('sw-email') as HTMLInputElement | null)?.value?.trim() ?? '';
        const phone = (document.getElementById('sw-phone') as HTMLInputElement | null)?.value?.trim() ?? '';
        const status = (document.getElementById('sw-status') as HTMLSelectElement | null)?.value?.trim() ?? 'ACTIVE';
        const nationality = (document.getElementById('sw-nationality') as HTMLInputElement | null)?.value?.trim() ?? '';
        const cityIdRaw = (document.getElementById('sw-city') as HTMLSelectElement | null)?.value ?? '';
        const cityId = cityIdRaw ? Number(cityIdRaw) : null;

        if (!firstName || !lastName || !email) {
          Swal.showValidationMessage('First name, last name, and email are required.');
          return null;
        }
        if (phone && !this.isValidPhone(phone)) {
          Swal.showValidationMessage('Invalid phone number (8–20 digits; spaces or hyphens allowed).');
          return null;
        }
        if (this.isTunisiaNationality(nationality) && !cityId) {
          Swal.showValidationMessage('Select a city if nationality is Tunisia.');
          return null;
        }

        return {
          firstName,
          lastName,
          email,
          phone: phone || null,
          nationality: nationality || null,
          cityId: this.isTunisiaNationality(nationality) ? cityId : null,
          profileImageUrl: uploadedImageUrl,
          status,
        };
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.updateUser(user.id, result.value).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        void this.popup({ icon: 'success', title: 'User updated', timer: 1300, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Failed', text: extractApiErrorMessage(error, 'Update failed.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async openArtisanPopup(user: AdminUser) {
    if (this.isSaving() || !user.artisanRequestPending) {
      return;
    }

    const result = await this.popup({
      title: `Artisan request from ${user.username}`,
      text: 'Accept or reject this request?',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Accept',
      denyButtonText: 'Reject',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed && !result.isDenied) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.reviewArtisan(user.id, result.isConfirmed).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        void this.popup({
          icon: 'success',
          title: result.isConfirmed ? 'Request accepted' : 'Request rejected',
          timer: 1200,
          showConfirmButton: false,
        });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Failed', text: extractApiErrorMessage(error, 'Action failed.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async deleteUser(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    const result = await this.popup({
      icon: 'warning',
      title: `Delete ${user.username}?`,
      text: 'This action is permanent.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    });
    if (!result.isConfirmed) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.set(this.users().filter((item) => item.id !== user.id));
        void this.popup({ icon: 'success', title: 'User deleted', timer: 1200, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Failed', text: extractApiErrorMessage(error, 'Could not delete.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async openBanPopup(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    if (user.banned) {
      return;
    }

    const result = await this.popup({
      title: `Ban ${user.username}`,
      showCancelButton: true,
      confirmButtonText: 'Ban',
      cancelButtonText: 'Cancel',
      html: `
        <div class="ban-dialog">
          <div class="ban-head">
            <strong>Sensitive action</strong>
            <span>This account will be blocked immediately and the action will be recorded in audit logs.</span>
          </div>
          <div class="ban-grid">
            <label class="sw-field">Ban reason
              <textarea id="sw-ban-reason" class="sw-textarea" placeholder="Explain the reason for this ban"></textarea>
            </label>
            <label class="sw-switch"><input type="checkbox" id="sw-ban-permanent" checked /> Permanent ban</label>
            <label class="sw-field">Expiry (if temporary)
              <input id="sw-ban-expires" class="sw-input" type="datetime-local" />
            </label>
          </div>
        </div>
      `,
      didOpen: () => {
        const permanentEl = document.getElementById('sw-ban-permanent') as HTMLInputElement | null;
        const expiresEl = document.getElementById('sw-ban-expires') as HTMLInputElement | null;
        const toggle = () => {
          if (expiresEl && permanentEl) {
            expiresEl.disabled = permanentEl.checked;
            if (permanentEl.checked) {
              expiresEl.value = '';
            }
          }
        };
        permanentEl?.addEventListener('change', toggle);
        toggle();
      },
      preConfirm: () => {
        const reason = (document.getElementById('sw-ban-reason') as HTMLTextAreaElement | null)?.value?.trim() ?? '';
        const permanent = !!(document.getElementById('sw-ban-permanent') as HTMLInputElement | null)?.checked;
        const expiresRaw = (document.getElementById('sw-ban-expires') as HTMLInputElement | null)?.value ?? '';
        if (!reason) {
          Swal.showValidationMessage('Add a reason for this ban.');
          return null;
        }
        if (!permanent && !expiresRaw) {
          Swal.showValidationMessage('Choisissez une date d expiration pour un ban temporaire.');
          return null;
        }
        return {
          reason,
          permanent,
          expiresAt: permanent ? null : new Date(expiresRaw).toISOString(),
        };
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.banUser(user.id, result.value).subscribe({
        next: (updatedUser) => {
          this.syncUpdatedUser(updatedUser);
          void this.popup({ icon: 'success', title: 'User banned', timer: 1200, showConfirmButton: false });
        },
        error: (error: HttpErrorResponse) => {
          void this.popup({ icon: 'error', title: 'Failed', text: extractApiErrorMessage(error, 'Could not ban user.') });
        },
        complete: () => this.isSaving.set(false),
      });
  }

  async openUnbanPopup(user: AdminUser) {
    if (this.isSaving() || !user.banned) {
      return;
    }

    const res = await this.popup({
      title: `Unban ${user.username}?`,
      html: `
        <div class="ban-dialog">
          <div class="ban-head">
            <strong>Confirm unban</strong>
            <span>The account will be able to sign in again after you confirm.</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Unban',
      cancelButtonText: 'Cancel',
    });
    if (!res.isConfirmed) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.unbanUser(user.id).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        void this.popup({ icon: 'success', title: 'User unbanned', timer: 1200, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Failed', text: extractApiErrorMessage(error, 'Could not unban user.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  private syncUpdatedUser(updated: AdminUser) {
    this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }
}
