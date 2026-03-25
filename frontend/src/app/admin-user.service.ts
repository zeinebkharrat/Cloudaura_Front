import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AdminUser, AdminUserUpdatePayload } from './auth.types';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly http = inject(HttpClient);

  listUsers(query?: string) {
    const trimmed = query?.trim();
    if (!trimmed) {
      return this.http.get<AdminUser[]>('/api/admin/users');
    }
    return this.http.get<AdminUser[]>('/api/admin/users', {
      params: { q: trimmed },
    });
  }

  getUser(userId: number) {
    return this.http.get<AdminUser>(`/api/admin/users/${userId}`);
  }

  updateUser(userId: number, payload: AdminUserUpdatePayload) {
    return this.http.put<AdminUser>(`/api/admin/users/${userId}`, payload);
  }

  updateRoles(userId: number, roles: string[]) {
    return this.http.patch<AdminUser>(`/api/admin/users/${userId}/roles`, { roles });
  }

  reviewArtisan(userId: number, approved: boolean) {
    return this.http.patch<AdminUser>(`/api/admin/users/${userId}/artisan-review`, { approved });
  }

  deleteUser(userId: number) {
    return this.http.delete<void>(`/api/admin/users/${userId}`);
  }
}
