import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppAlertsService } from '../../core/services/app-alerts.service';
import { API_BASE_URL } from '../../core/api-url';
import { LanguageService } from '../../core/services/language.service';

type AttendanceStatus = 'UPCOMING' | 'PRESENT' | 'ABSENT';

interface TicketRow {
  reservationItemId: number;
  reservationId: number | null;
  ticketName: string | null;
  userName: string | null;
  userEmail: string | null;
  eventName: string | null;
  startDate: string | null;
  qrCodeToken: string | null;
  isScanned: boolean;
  scannedAt: string | null;
  attendanceStatus: AttendanceStatus;
}

interface TicketsResponse {
  count: number;
  items: any[];
}

interface ScanResponse {
  found: boolean;
  alreadyScanned?: boolean;
  message: string;
  ticket?: TicketRow;
}

@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TranslateModule],
  templateUrl: './admin-tickets.component.html',
  styleUrl: './admin-tickets.component.css',
})
export class AdminTicketsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(AppAlertsService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${API_BASE_URL}/api/events/admin/tickets`;

  loading = false;
  tickets: TicketRow[] = [];
  filteredTickets: TicketRow[] = [];

  searchQuery = '';
  filterDate = '';
  statusFilter: 'ALL' | AttendanceStatus = 'ALL';

  scannerOpen = false;
  scannerSupported = false;
  scannerMode: 'barcode-detector' | 'jsqr' = 'jsqr';
  cameraBusy = false;
  scanBusy = false;
  manualToken = '';
  scanResult: ScanResponse | null = null;

  private mediaStream: MediaStream | null = null;
  private scanFrameId: number | null = null;
  private detector: any = null;
  private scanCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.language.langChangedDebounced$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTickets());
  }

  ngOnInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  loadTickets(): void {
    this.loading = true;

    let params = new HttpParams();
    if (this.searchQuery.trim()) {
      params = params.set('search', this.searchQuery.trim());
    }
    if (this.filterDate) {
      params = params.set('date', this.filterDate);
    }

    this.http.get<TicketsResponse>(this.apiUrl, { params }).subscribe({
      next: (res) => {
        const rawItems = Array.isArray(res?.items) ? res.items : [];
        this.tickets = rawItems.map((row) => this.normalizeTicketRow(row));
        this.applyClientFilters();
        this.loading = false;
      },
      error: async () => {
        this.tickets = [];
        this.filteredTickets = [];
        this.loading = false;
        await this.alerts.error(
          this.translate.instant('ADMIN_TICKETS.ERR_LOAD_TITLE'),
          this.translate.instant('ADMIN_TICKETS.ERR_LOAD_BODY'),
        );
      },
    });
  }

  applyClientFilters(): void {
    const status = this.statusFilter;
    this.filteredTickets = this.tickets.filter((ticket) => {
      return status === 'ALL' || ticket.attendanceStatus === status;
    });
    this.cdr.markForCheck();
  }

  onFiltersChanged(): void {
    this.loadTickets();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterDate = '';
    this.statusFilter = 'ALL';
    this.loadTickets();
  }

  private normalizeTicketRow(row: any): TicketRow {
    const startDateValue = row?.startDate ?? row?.eventStartDate ?? null;
    const scanned = Boolean(row?.isScanned ?? row?.scanned ?? false);

    let attendanceStatus: AttendanceStatus;
    const rawStatus = String(row?.attendanceStatus ?? '').toUpperCase();
    if (rawStatus === 'PRESENT' || rawStatus === 'ABSENT' || rawStatus === 'UPCOMING') {
      attendanceStatus = rawStatus;
    } else {
      attendanceStatus = scanned ? 'PRESENT' : 'UPCOMING';
    }

    return {
      reservationItemId: Number(row?.reservationItemId ?? 0),
      reservationId: row?.reservationId ?? row?.eventReservationId ?? null,
      ticketName: row?.ticketName ?? row?.ticketTypeName ?? row?.ticket_nomevent ?? null,
      userName: row?.userName ?? row?.username ?? null,
      userEmail: row?.userEmail ?? row?.email ?? null,
      eventName: row?.eventName ?? row?.eventTitle ?? null,
      startDate: startDateValue,
      qrCodeToken: row?.qrCodeToken ?? null,
      isScanned: scanned,
      scannedAt: row?.scannedAt ?? null,
      attendanceStatus,
    };
  }

  statusClass(status: AttendanceStatus): string {
    if (status === 'PRESENT') {
      return 'badge-present';
    }
    if (status === 'ABSENT') {
      return 'badge-absent';
    }
    return 'badge-upcoming';
  }

  async openScanner(): Promise<void> {
    this.scannerOpen = true;
    this.scanResult = null;
    this.manualToken = '';

    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    const hasBarcodeDetector = typeof BarcodeDetectorCtor === 'function';
    this.scannerMode = hasBarcodeDetector ? 'barcode-detector' : 'jsqr';
    this.scannerSupported = true;

    try {
      if (hasBarcodeDetector) {
        this.detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      }
      this.cameraBusy = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.mediaStream = stream;

      const video = document.getElementById('ticket-scan-video') as HTMLVideoElement | null;
      if (!video) {
        this.cameraBusy = false;
        return;
      }

      video.srcObject = stream;
      await video.play();
      this.cameraBusy = false;
      this.beginDetectLoop(video);
    } catch {
      this.cameraBusy = false;
      await this.alerts.error(
        this.translate.instant('ADMIN_TICKETS.ERR_CAMERA_TITLE'),
        this.translate.instant('ADMIN_TICKETS.ERR_CAMERA_BODY'),
      );
    }
  }

  closeScanner(): void {
    this.scannerOpen = false;
    this.stopScanner();
  }

  private stopScanner(): void {
    if (this.scanFrameId != null) {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    const video = document.getElementById('ticket-scan-video') as HTMLVideoElement | null;
    if (video) {
      video.srcObject = null;
    }
  }

  private beginDetectLoop(video: HTMLVideoElement): void {
    const scan = async () => {
      if (!this.scannerOpen || this.scanBusy) {
        this.scanFrameId = requestAnimationFrame(scan);
        return;
      }

      try {
        if (this.scannerMode === 'barcode-detector' && this.detector) {
          const barcodes = await this.detector.detect(video);
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            const qrText = String(barcodes[0]?.rawValue ?? '').trim();
            if (qrText) {
              await this.validateToken(qrText);
            }
          }
        } else if (this.scannerMode === 'jsqr') {
          const qrText = this.scanWithJsQr(video);
          if (qrText) {
            await this.validateToken(qrText);
          }
        }
      } catch {
        // Keep loop running.
      }

      this.scanFrameId = requestAnimationFrame(scan);
    };

    this.scanFrameId = requestAnimationFrame(scan);
  }

  private scanWithJsQr(video: HTMLVideoElement): string | null {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }

    if (!this.scanCanvas) {
      this.scanCanvas = document.createElement('canvas');
    }
    this.scanCanvas.width = width;
    this.scanCanvas.height = height;

    const context = this.scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return result?.data?.trim() || null;
  }

  async validateManualToken(): Promise<void> {
    if (!this.manualToken.trim()) {
      await this.alerts.warning(
        this.translate.instant('ADMIN_TICKETS.WARN_TOKEN_TITLE'),
        this.translate.instant('ADMIN_TICKETS.WARN_TOKEN_BODY'),
      );
      return;
    }
    await this.validateToken(this.manualToken.trim());
  }

  private async validateToken(token: string): Promise<void> {
    if (this.scanBusy) {
      return;
    }

    this.scanBusy = true;

    this.http.post<ScanResponse>(`${this.apiUrl}/scan`, { token }).subscribe({
      next: async (res) => {
        const rawMsg = typeof res?.message === 'string' ? res.message : '';
        this.manualToken = token;
        this.scanResult = {
          found: Boolean(res.found),
          alreadyScanned: res.alreadyScanned === true,
          message: rawMsg,
          ticket: res.ticket ? this.normalizeTicketRow(res.ticket) : undefined,
        };

        if (res.alreadyScanned) {
          await this.alerts.warning(
            this.translate.instant('ADMIN_TICKETS.WARN_USED_TITLE'),
            this.translate.instant('ADMIN_TICKETS.WARN_USED_BODY'),
          );
        } else {
          await this.alerts.success(
            this.translate.instant('ADMIN_TICKETS.OK_VALIDATED_TITLE'),
            this.translate.instant('ADMIN_TICKETS.OK_VALIDATED_BODY'),
          );
        }

        this.loadTickets();
        this.scanBusy = false;
      },
      error: async (err) => {
        const fallback = this.translate.instant('ADMIN_TICKETS.ERR_SCAN_DEFAULT');
        const body = err?.error;

        if (body && typeof body === 'object' && typeof body.message === 'string') {
          this.manualToken = token;
          const rawMsg = body.message;
          this.scanResult = {
            found: body.found === true,
            alreadyScanned: body.alreadyScanned === true,
            message: rawMsg,
            ticket: body.ticket ? this.normalizeTicketRow(body.ticket) : undefined,
          };

          if (body.alreadyScanned === true) {
            await this.alerts.warning(
              this.translate.instant('ADMIN_TICKETS.WARN_USED_TITLE'),
              this.translate.instant('ADMIN_TICKETS.WARN_USED_BODY'),
            );
          } else {
            await this.alerts.error(this.translate.instant('ADMIN_TICKETS.ERR_SCAN_TITLE'), rawMsg);
          }
          this.loadTickets();
          this.scanBusy = false;
          return;
        }

        const rawMsg =
          typeof body === 'string' && body.trim()
            ? body.trim()
            : fallback;
        this.scanResult = {
          found: false,
          message: rawMsg,
        };
        await this.alerts.error(this.translate.instant('ADMIN_TICKETS.ERR_SCAN_TITLE'), rawMsg);
        this.scanBusy = false;
      },
    });
  }
}
