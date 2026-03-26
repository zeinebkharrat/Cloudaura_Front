import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from './admin-user.service';
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
    return Swal.fire({
      customClass: {
        popup: 'bo-popup',
        title: 'bo-title',
        htmlContainer: 'bo-content',
        confirmButton: 'bo-btn bo-btn-confirm',
        cancelButton: 'bo-btn bo-btn-cancel',
        denyButton: 'bo-btn bo-btn-deny',
      },
      buttonsStyling: false,
      background: '#0f1720',
      backdrop: 'rgba(7, 12, 18, 0.75)',
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
        this.users.set(users);
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

    const result = await this.popup({
      title: `Modifier ${user.username}`,
      width: 760,
      showCancelButton: true,
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      html: `
        <div class="sw-grid">
          <input id="sw-firstName" class="sw-input" placeholder="Prenom" value="${user.firstName}" />
          <input id="sw-lastName" class="sw-input" placeholder="Nom" value="${user.lastName}" />
          <input id="sw-email" class="sw-input" placeholder="Email" value="${user.email}" />
          <input id="sw-phone" class="sw-input" placeholder="Telephone" value="${user.phone ?? ''}" />
          <select id="sw-status" class="sw-input">
            <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="INACTIVE" ${user.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
          </select>
          <input id="sw-nationality" class="sw-input" placeholder="Nationality" value="${user.nationality ?? ''}" />
          <select id="sw-city" class="sw-input">
            <option value="">Choisir une ville (si tunisian)</option>
            ${cityOptions}
          </select>
          <div class="sw-avatar-block">
            <img id="sw-avatar-preview" class="sw-avatar-preview" src="${user.profileImageUrl ?? ''}" alt="avatar" />
            <input id="sw-avatar-file" class="sw-input" type="file" accept="image/*" />
            <input id="sw-avatar-url" class="sw-input" placeholder="Image URL" value="${user.profileImageUrl ?? ''}" />
          </div>
        </div>
      `,
      didOpen: () => {
        const nationalityEl = document.getElementById('sw-nationality') as HTMLInputElement | null;
        const cityEl = document.getElementById('sw-city') as HTMLSelectElement | null;
        const avatarUrlEl = document.getElementById('sw-avatar-url') as HTMLInputElement | null;
        const avatarPreviewEl = document.getElementById('sw-avatar-preview') as HTMLImageElement | null;
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
              if (avatarUrlEl) {
                avatarUrlEl.value = response.url;
              }
              if (avatarPreviewEl) {
                avatarPreviewEl.src = response.url;
              }
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
        const profileImageUrl = (document.getElementById('sw-avatar-url') as HTMLInputElement | null)?.value?.trim() ?? '';
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
          profileImageUrl: profileImageUrl || null,
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
        <textarea id="sw-ban-reason" class="sw-input" placeholder="Raison"></textarea>
        <label class="sw-check"><input type="checkbox" id="sw-ban-permanent" checked /> Ban permanent</label>
        <input id="sw-ban-expires" class="sw-input" type="datetime-local" />
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
          Swal.showValidationMessage('La raison est obligatoire.');
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
