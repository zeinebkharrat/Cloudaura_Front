import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from './admin-user.service';
import { AdminUser } from './auth.types';
import { extractApiErrorMessage } from './api-error.util';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent {
  private readonly adminUserService = inject(AdminUserService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<AdminUser[]>([]);
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  readonly roleOptions = ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_ARTISANT'];

  readonly searchForm = this.fb.nonNullable.group({
    q: [''],
  });

  readonly detailsForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    status: ['ACTIVE', [Validators.required]],
  });

  readonly roleForm = this.fb.nonNullable.group({
    ROLE_USER: [false],
    ROLE_ADMIN: [false],
    ROLE_ARTISANT: [false],
  });

  readonly selectedUserRoles = computed(() => new Set(this.selectedUser()?.roles ?? []));

  constructor() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading.set(true);
    this.actionError.set(null);

    this.adminUserService.listUsers(this.searchForm.controls.q.value).subscribe({
      next: (users) => {
        this.users.set(users);
        if (this.selectedUser()) {
          const selectedId = this.selectedUser()!.id;
          const updated = users.find((item) => item.id === selectedId) ?? null;
          this.selectUser(updated);
        }
      },
      error: () => this.actionError.set('Impossible de charger les utilisateurs.'),
      complete: () => this.isLoading.set(false),
    });
  }

  selectUser(user: AdminUser | null) {
    this.selectedUser.set(user);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    if (!user) {
      this.detailsForm.reset();
      this.roleForm.reset({ ROLE_USER: false, ROLE_ADMIN: false, ROLE_ARTISANT: false });
      return;
    }

    this.detailsForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
      status: user.status,
    });

    this.roleForm.patchValue({
      ROLE_USER: user.roles.includes('ROLE_USER'),
      ROLE_ADMIN: user.roles.includes('ROLE_ADMIN'),
      ROLE_ARTISANT: user.roles.includes('ROLE_ARTISANT'),
    });
  }

  saveDetails() {
    const user = this.selectedUser();
    if (!user || this.detailsForm.invalid || this.isSaving()) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const payload = this.detailsForm.getRawValue();
    this.adminUserService
      .updateUser(user.id, {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone || null,
        status: payload.status,
      })
      .subscribe({
        next: (updatedUser) => {
          this.syncUpdatedUser(updatedUser);
          this.actionSuccess.set('Profil utilisateur mis à jour.');
        },
        error: (error: HttpErrorResponse) => {
          this.actionError.set(extractApiErrorMessage(error, 'Mise à jour impossible.'));
        },
        complete: () => this.isSaving.set(false),
      });
  }

  saveRoles() {
    const user = this.selectedUser();
    if (!user || this.isSaving()) {
      return;
    }

    const payload = this.roleForm.getRawValue();
    const roles = this.roleOptions.filter((role) => payload[role as keyof typeof payload]);

    if (roles.length === 0) {
      this.actionError.set('Un utilisateur doit avoir au moins un rôle.');
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.adminUserService.updateRoles(user.id, roles).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        this.actionSuccess.set('Rôles mis à jour avec succès.');
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Mise à jour des rôles impossible.'));
      },
      complete: () => this.isSaving.set(false),
    });
  }

  reviewArtisan(approved: boolean) {
    const user = this.selectedUser();
    if (!user || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.adminUserService.reviewArtisan(user.id, approved).subscribe({
      next: (updatedUser) => {
        this.syncUpdatedUser(updatedUser);
        this.actionSuccess.set(approved ? 'Demande artisan approuvée.' : 'Demande artisan refusée.');
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Action impossible sur la demande artisan.'));
      },
      complete: () => this.isSaving.set(false),
    });
  }

  deleteSelectedUser() {
    const user = this.selectedUser();
    if (!user || this.isSaving()) {
      return;
    }

    const confirmed = confirm(`Supprimer définitivement ${user.username} ?`);
    if (!confirmed) {
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.adminUserService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.set(this.users().filter((item) => item.id !== user.id));
        this.selectUser(null);
        this.actionSuccess.set('Utilisateur supprimé.');
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Suppression impossible.'));
      },
      complete: () => this.isSaving.set(false),
    });
  }

  private syncUpdatedUser(updated: AdminUser) {
    this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    this.selectUser(updated);
  }
}
