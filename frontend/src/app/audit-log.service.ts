import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuditLogPage } from './core/auth.types';

export interface AuditLogFilters {
  q?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);

  listLogs(filters: AuditLogFilters) {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 0))
      .set('size', String(filters.size ?? 20));

    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.action?.trim()) {
      params = params.set('action', filters.action.trim());
    }
    if (filters.from?.trim()) {
      params = params.set('from', new Date(filters.from).toISOString());
    }
    if (filters.to?.trim()) {
      params = params.set('to', new Date(filters.to).toISOString());
    }

    return this.http.get<AuditLogPage>('/api/admin/audit-logs', { params });
  }

  exportCsv(filters: AuditLogFilters) {
    return this.http.get('/api/admin/audit-logs/export/csv', {
      params: this.toExportParams(filters),
      responseType: 'blob',
    });
  }

  exportXlsx(filters: AuditLogFilters) {
    return this.http.get('/api/admin/audit-logs/export/xlsx', {
      params: this.toExportParams(filters),
      responseType: 'blob',
    });
  }

  private toExportParams(filters: AuditLogFilters): HttpParams {
    let params = new HttpParams();
    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.action?.trim()) {
      params = params.set('action', filters.action.trim());
    }
    if (filters.from?.trim()) {
      params = params.set('from', new Date(filters.from).toISOString());
    }
    if (filters.to?.trim()) {
      params = params.set('to', new Date(filters.to).toISOString());
    }
    return params;
  }
}
