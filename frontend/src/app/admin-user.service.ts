import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { AdminUser, AdminUserInsights, AdminUserUpdatePayload, CityOption } from './core/auth.types';

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

  getUserInsights(userId: number) {
    return this.http.get<AdminUserInsights>(`/api/admin/users/${userId}/insights`);
  }

  updateUser(userId: number, payload: AdminUserUpdatePayload) {
    return this.http.put<AdminUser>(`/api/admin/users/${userId}`, payload);
  }

  listCities() {
    return this.http.get<
      | Array<CityOption & { cityId?: number; id?: number }>
      | { data?: Array<CityOption & { cityId?: number; id?: number }> }
    >('/api/cities').pipe(
      map((raw) => {
        const cities = Array.isArray(raw) ? raw : raw?.data;
        if (!Array.isArray(cities)) {
          return [] as CityOption[];
        }
        const normalized: CityOption[] = [];
        for (const city of cities) {
          const resolvedId = city.id ?? city.cityId;
          if (resolvedId == null) {
            continue;
          }
          normalized.push({
            id: Number(resolvedId),
            cityId: city.cityId ?? Number(resolvedId),
            name: city.name,
            region: city.region,
          });
        }
        return normalized;
      })
    );
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

  banUser(userId: number, payload: { reason: string; permanent: boolean; expiresAt: string | null }) {
    return this.http.patch<AdminUser>(`/api/admin/users/${userId}/ban`, payload);
  }

  unbanUser(userId: number) {
    return this.http.delete<AdminUser>(`/api/admin/users/${userId}/ban`);
  }

  uploadProfileImage(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ url: string }>('/api/public/uploads/profile-image', body);
  }
}
