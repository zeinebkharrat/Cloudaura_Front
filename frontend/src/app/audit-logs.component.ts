import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
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
