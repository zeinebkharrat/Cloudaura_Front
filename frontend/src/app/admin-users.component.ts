import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from './admin-user.service';
import { AuthService } from './auth.service';
import { AdminUser, CityOption } from './auth.types';
import { extractApiErrorMessage } from './api-error.util';
import Swal from 'sweetalert2';
import type { SweetAlertOptions } from 'sweetalert2';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent {
  private readonly adminUserService = inject(AdminUserService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<AdminUser[]>([]);
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

  constructor() {
    this.loadCities();

    this.searchForm.controls.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadUsers());

    this.loadUsers();
  }

  private popup(options: SweetAlertOptions) {
    const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
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
      },
      error: () => this.actionError.set('Impossible de charger les utilisateurs.'),
      complete: () => this.isLoading.set(false),
    });
  }

  async openEditPopup(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    const cityOptions = this.cities()
      .map((city) => `<option value="${city.id}" ${user.cityId === city.id ? 'selected' : ''}>${city.name} (${city.region})</option>`)
      .join('');
    let uploadedImageUrl: string | null = user.profileImageUrl ?? null;

    const result = await this.popup({
      title: `Modifier ${user.username}`,
      width: 760,
      showCancelButton: true,
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      html: `
        <div class="sw-grid">
          <div class="sw-avatar-top">
            <div class="sw-chip">Profil utilisateur</div>
            <div class="sw-avatar-frame">
              <img id="sw-avatar-preview" class="sw-avatar-preview" src="${user.profileImageUrl ?? ''}" alt="avatar" />
              <div id="sw-avatar-placeholder" class="sw-avatar-placeholder ${user.profileImageUrl ? 'hidden' : ''}">${user.username.charAt(0).toUpperCase()}</div>
            </div>
            <label class="sw-upload-btn" for="sw-avatar-file">Choisir une photo</label>
            <input id="sw-avatar-file" class="sw-avatar-file" type="file" accept="image/*" />
            <p class="sw-upload-hint">PNG/JPG conseille, image nette de profil.</p>
          </div>
          <label class="sw-field">Prenom<input id="sw-firstName" class="sw-input" placeholder="Prenom" value="${user.firstName}" /></label>
          <label class="sw-field">Nom<input id="sw-lastName" class="sw-input" placeholder="Nom" value="${user.lastName}" /></label>
          <label class="sw-field">Email<input id="sw-email" class="sw-input" placeholder="Email" value="${user.email}" /></label>
          <label class="sw-field">Telephone<input id="sw-phone" class="sw-input" placeholder="Telephone" value="${user.phone ?? ''}" /></label>
          <label class="sw-field">Statut<select id="sw-status" class="sw-input">
            <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="INACTIVE" ${user.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
          </select></label>
          <label class="sw-field">Nationalite<input id="sw-nationality" class="sw-input" placeholder="Nationality" value="${user.nationality ?? ''}" /></label>
          <label class="sw-field">Ville<select id="sw-city" class="sw-input">
            <option value="">Choisir une ville (si tunisian)</option>
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
              Swal.showValidationMessage(extractApiErrorMessage(error, 'Upload image impossible.'));
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
          Swal.showValidationMessage('Prenom, nom et email sont obligatoires.');
          return null;
        }
        if (this.isTunisiaNationality(nationality) && !cityId) {
          Swal.showValidationMessage('Selectionnez une ville si la nationalite est Tunisia.');
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
        void this.popup({ icon: 'success', title: 'Utilisateur modifie', timer: 1300, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Mise a jour impossible.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async openArtisanPopup(user: AdminUser) {
    if (this.isSaving() || !user.artisanRequestPending) {
      return;
    }

    const result = await this.popup({
      title: `Demande artisan de ${user.username}`,
      text: 'Accepter ou refuser cette demande ?',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Accepter',
      denyButtonText: 'Refuser',
      cancelButtonText: 'Annuler',
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
          title: result.isConfirmed ? 'Demande acceptee' : 'Demande refusee',
          timer: 1200,
          showConfirmButton: false,
        });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Action impossible.') });
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
      title: `Supprimer ${user.username} ?`,
      text: 'Cette action est definitive.',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#d33',
    });
    if (!result.isConfirmed) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.set(this.users().filter((item) => item.id !== user.id));
        void this.popup({ icon: 'success', title: 'Utilisateur supprime', timer: 1200, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Suppression impossible.') });
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
      title: `Bannir ${user.username}`,
      showCancelButton: true,
      confirmButtonText: 'Bannir',
      cancelButtonText: 'Annuler',
      html: `
        <div class="ban-dialog">
          <div class="ban-head">
            <strong>Action sensible</strong>
            <span>Ce compte sera bloque immediatement et la trace sera enregistree dans les logs d'audit.</span>
          </div>
          <div class="ban-grid">
            <label class="sw-field">Raison du ban
              <textarea id="sw-ban-reason" class="sw-textarea" placeholder="Expliquez la raison du ban"></textarea>
            </label>
            <label class="sw-switch"><input type="checkbox" id="sw-ban-permanent" checked /> Ban permanent</label>
            <label class="sw-field">Expiration (si temporaire)
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
          Swal.showValidationMessage('Ajoutez une raison pour ce ban.');
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
          void this.popup({ icon: 'success', title: 'Utilisateur banni', timer: 1200, showConfirmButton: false });
        },
        error: (error: HttpErrorResponse) => {
          void this.popup({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Action de ban impossible.') });
        },
        complete: () => this.isSaving.set(false),
      });
  }

  async openUnbanPopup(user: AdminUser) {
    if (this.isSaving() || !user.banned) {
      return;
    }

    const res = await this.popup({
      title: `Debannir ${user.username} ?`,
      html: `
        <div class="ban-dialog">
          <div class="ban-head">
            <strong>Confirmation de deban</strong>
            <span>Le compte pourra se reconnecter immediatement apres confirmation.</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Debannir',
      cancelButtonText: 'Annuler',
    });
    if (!res.isConfirmed) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.unbanUser(user.id).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        void this.popup({ icon: 'success', title: 'Utilisateur debanni', timer: 1200, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void this.popup({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Action de deban impossible.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  private syncUpdatedUser(updated: AdminUser) {
    this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }
}
