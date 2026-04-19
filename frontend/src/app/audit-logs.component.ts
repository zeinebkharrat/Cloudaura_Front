import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntry } from './core/auth.types';
import { extractApiErrorMessage } from './api-error.util';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.css',
})
export class AuditLogsComponent {
  private readonly auditLogService = inject(AuditLogService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly logs = signal<AuditLogEntry[]>([]);
  readonly isLoading = signal(false);
  readonly isExporting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(0);
  readonly pageSize = signal(20);
  readonly quickRange = signal<'none' | '24h' | '7d' | '30d'>('none');
  readonly parsedLogs = computed(() => this.logs().map((log) => ({ ...log, detailsView: this.parseDetails(log.details) })));

  readonly filterForm = this.fb.nonNullable.group({
    q: [''],
    action: [''],
    from: [''],
    to: [''],
  });

  readonly actions: readonly string[] = [
    'BAN_USER',
    'UNBAN_USER',
    'EMAIL_CHANGE_SELF',
    'EMAIL_CHANGE_ADMIN',
    'PASSWORD_CHANGE',
    'PASSWORD_RESET',
  ];

  constructor() {
    this.filterForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadLogs(0));

    this.loadLogs(0);
  }

  loadLogs(page: number = this.page()): void {
    this.isLoading.set(true);
    this.actionError.set(null);

    this.auditLogService
      .listLogs({
        q: this.filterForm.controls.q.value,
        action: this.filterForm.controls.action.value,
        from: this.filterForm.controls.from.value,
        to: this.filterForm.controls.to.value,
        page,
        size: this.pageSize(),
      })
      .subscribe({
        next: (response) => {
          this.logs.set(response.content);
          this.totalElements.set(response.totalElements);
          this.totalPages.set(response.totalPages);
          this.page.set(response.number);
        },
        error: () => this.actionError.set('Impossible de charger les logs d audit.'),
        complete: () => this.isLoading.set(false),
      });
  }

  clearFilters(): void {
    this.filterForm.setValue({
      q: '',
      action: '',
      from: '',
      to: '',
    });
    this.quickRange.set('none');
    this.loadLogs(0);
  }

  setQuickRange(range: '24h' | '7d' | '30d'): void {
    const now = new Date();
    const from = new Date(now);
    if (range === '24h') {
      from.setHours(now.getHours() - 24);
    } else if (range === '7d') {
      from.setDate(now.getDate() - 7);
    } else {
      from.setDate(now.getDate() - 30);
    }

    const toInputValue = this.toInputDateTimeLocal(now);
    const fromInputValue = this.toInputDateTimeLocal(from);

    this.quickRange.set(range);
    this.filterForm.patchValue({ from: fromInputValue, to: toInputValue });
    this.loadLogs(0);
  }

  onPageSizeChange(size: string): void {
    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    this.pageSize.set(parsed);
    this.loadLogs(0);
  }

  actionLabel(action: string): string {
    return action
      .toLowerCase()
      .split('_')
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  displayPageCount(): number {
    const pages = this.totalPages();
    return pages === 0 ? 1 : pages;
  }

  displayOrDash(value: string | null | undefined): string {
    const normalized = value?.trim();
    return normalized ? normalized : '-';
  }

  formatLogDate(value: string | Date | null | undefined): string {
    if (!value) {
      return '-';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private parseDetails(details: string | null | undefined): { summary: string; pairs: Array<{ key: string; value: string }> } {
    if (!details || !details.trim()) {
      return { summary: 'No additional details.', pairs: [] };
    }

    const normalized = details.trim();
    try {
      const parsed = JSON.parse(normalized) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>).slice(0, 8);
        const pairs = entries.map(([key, value]) => ({
          key: this.prettifyKey(key),
          value: this.stringifyDetailValue(value),
        }));
        const summary = pairs.map((item) => `${item.key}: ${item.value}`).join(' • ');
        return { summary, pairs };
      }
    } catch {
      // Keep plain-text fallback for non-JSON details.
    }

    const compact = normalized.replace(/\s+/g, ' ');
    return {
      summary: compact.length > 220 ? `${compact.slice(0, 220)}...` : compact,
      pairs: [],
    };
  }

  private stringifyDetailValue(value: unknown): string {
    if (value == null) {
      return 'N/A';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }

  private prettifyKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private toInputDateTimeLocal(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  previousPage(): void {
    if (this.page() <= 0 || this.isLoading()) {
      return;
    }
    this.loadLogs(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() >= this.totalPages() - 1 || this.isLoading()) {
      return;
    }
    this.loadLogs(this.page() + 1);
  }

  exportCsv(): void {
    this.download('csv');
  }

  exportXlsx(): void {
    this.download('xlsx');
  }

  private download(type: 'csv' | 'xlsx'): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);
    this.actionError.set(null);

    const request = type === 'csv'
      ? this.auditLogService.exportCsv(this.currentFilters())
      : this.auditLogService.exportXlsx(this.currentFilters());

    request.subscribe({
      next: (blob) => this.saveBlob(blob, `audit-logs.${type}`),
      error: (error: HttpErrorResponse) => {
        this.actionError.set(extractApiErrorMessage(error, 'Export impossible.'));
      },
      complete: () => this.isExporting.set(false),
    });
  }

  private currentFilters() {
    return {
      q: this.filterForm.controls.q.value,
      action: this.filterForm.controls.action.value,
      from: this.filterForm.controls.from.value,
      to: this.filterForm.controls.to.value,
    };
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
