import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from './admin-user.service';
import { AdminUser, CityOption } from './auth.types';
import { extractApiErrorMessage } from './api-error.util';
import Swal from 'sweetalert2';

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

  readonly users = signal<AdminUser[]>([]);
  readonly cities = signal<CityOption[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  readonly searchForm = this.fb.nonNullable.group({
    q: [''],
  });

  constructor() {
    this.loadCities();
    this.loadUsers();
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

    const result = await Swal.fire({
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
        </div>
      `,
      didOpen: () => {
        const nationalityEl = document.getElementById('sw-nationality') as HTMLInputElement | null;
        const cityEl = document.getElementById('sw-city') as HTMLSelectElement | null;
        const updateCityVisibility = () => {
          if (!nationalityEl || !cityEl) {
            return;
          }
          const tunisian = nationalityEl.value.trim().toLowerCase() === 'tunisian';
          cityEl.disabled = !tunisian;
          if (!tunisian) {
            cityEl.value = '';
          }
        };
        nationalityEl?.addEventListener('input', updateCityVisibility);
        updateCityVisibility();
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
        if (nationality.toLowerCase() === 'tunisian' && !cityId) {
          Swal.showValidationMessage('Selectionnez une ville pour un utilisateur tunisian.');
          return null;
        }

        return {
          firstName,
          lastName,
          email,
          phone: phone || null,
          nationality: nationality || null,
          cityId,
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
        void Swal.fire({ icon: 'success', title: 'Utilisateur modifie', timer: 1300, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void Swal.fire({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Mise a jour impossible.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async openRolesPopup(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    const hasRole = (role: string) => user.roles.includes(role) ? 'checked' : '';

    const result = await Swal.fire({
      title: `Roles de ${user.username}`,
      html: `
        <label class="sw-check"><input type="checkbox" id="sw-role-user" ${hasRole('ROLE_USER')} /> ROLE_USER</label>
        <label class="sw-check"><input type="checkbox" id="sw-role-admin" ${hasRole('ROLE_ADMIN')} /> ROLE_ADMIN</label>
        <label class="sw-check"><input type="checkbox" id="sw-role-artisant" ${hasRole('ROLE_ARTISANT')} /> ROLE_ARTISANT</label>
      `,
      showCancelButton: true,
      confirmButtonText: 'Enregistrer',
      preConfirm: () => {
        const roles: string[] = [];
        if ((document.getElementById('sw-role-user') as HTMLInputElement | null)?.checked) roles.push('ROLE_USER');
        if ((document.getElementById('sw-role-admin') as HTMLInputElement | null)?.checked) roles.push('ROLE_ADMIN');
        if ((document.getElementById('sw-role-artisant') as HTMLInputElement | null)?.checked) roles.push('ROLE_ARTISANT');
        if (roles.length === 0) {
          Swal.showValidationMessage('Au moins un role est obligatoire.');
          return null;
        }
        return roles;
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.isSaving.set(true);
    this.adminUserService.updateRoles(user.id, result.value).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        void Swal.fire({ icon: 'success', title: 'Roles mis a jour', timer: 1200, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void Swal.fire({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Mise a jour des roles impossible.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async openArtisanPopup(user: AdminUser) {
    if (this.isSaving() || !user.artisanRequestPending) {
      return;
    }

    const result = await Swal.fire({
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
        void Swal.fire({
          icon: 'success',
          title: result.isConfirmed ? 'Demande acceptee' : 'Demande refusee',
          timer: 1200,
          showConfirmButton: false,
        });
      },
      error: (error: HttpErrorResponse) => {
        void Swal.fire({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Action impossible.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async deleteUser(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    const result = await Swal.fire({
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
        void Swal.fire({ icon: 'success', title: 'Utilisateur supprime', timer: 1200, showConfirmButton: false });
      },
      error: (error: HttpErrorResponse) => {
        void Swal.fire({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Suppression impossible.') });
      },
      complete: () => this.isSaving.set(false),
    });
  }

  async openBanPopup(user: AdminUser) {
    if (this.isSaving()) {
      return;
    }

    if (user.banned) {
      const res = await Swal.fire({
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
          void Swal.fire({ icon: 'success', title: 'Utilisateur debanni', timer: 1200, showConfirmButton: false });
        },
        error: (error: HttpErrorResponse) => {
          void Swal.fire({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Action de deban impossible.') });
        },
        complete: () => this.isSaving.set(false),
      });
      return;
    }

    const result = await Swal.fire({
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
          void Swal.fire({ icon: 'success', title: 'Utilisateur banni', timer: 1200, showConfirmButton: false });
        },
        error: (error: HttpErrorResponse) => {
          void Swal.fire({ icon: 'error', title: 'Echec', text: extractApiErrorMessage(error, 'Action de ban impossible.') });
        },
        complete: () => this.isSaving.set(false),
      });
  }

  private syncUpdatedUser(updated: AdminUser) {
    this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }
}
