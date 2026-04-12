import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';
import { AppAlertsService } from '../../core/services/app-alerts.service';
import { API_BASE_URL } from '../../core/api-url';

type AttendanceStatus = 'PRESENT' | 'ABSENT';

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
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './admin-tickets.component.html',
  styleUrl: './admin-tickets.component.css',
})
export class AdminTicketsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(AppAlertsService);
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
        this.loading = false;
        await this.alerts.error('Error', 'Failed to load tickets list.');
      },
    });
  }

  applyClientFilters(): void {
    const status = this.statusFilter;
    this.filteredTickets = this.tickets.filter((ticket) => {
      return status === 'ALL' || ticket.attendanceStatus === status;
    });
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

  statusLabel(status: AttendanceStatus): string {
    if (status === 'PRESENT') {
      return 'Present';
    }
    return 'Absent';
  }

  private normalizeTicketRow(row: any): TicketRow {
    const startDateValue = row?.startDate ?? row?.eventStartDate ?? null;
    const scanned = Boolean(row?.isScanned ?? row?.scanned ?? false);

    let attendanceStatus: AttendanceStatus;
    const rawStatus = String(row?.attendanceStatus ?? '').toUpperCase();
    if (rawStatus === 'PRESENT' || rawStatus === 'ABSENT') {
      attendanceStatus = rawStatus;
    } else {
      attendanceStatus = scanned ? 'PRESENT' : 'ABSENT';
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
    return 'badge-absent';
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
      await this.alerts.error('Camera Error', 'Unable to access camera for QR scanning.');
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
      await this.alerts.warning('Missing Token', 'Please enter a QR token first.');
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
        this.scanResult = res;
        this.manualToken = token;

        if (res.alreadyScanned) {
          await this.alerts.warning('Already Used', 'This ticket was already validated.');
        } else {
          await this.alerts.success('Validated', 'Ticket validated successfully.');
        }

        this.loadTickets();
        this.scanBusy = false;
      },
      error: async (err) => {
        const bodyMessage = err?.error?.message;
        this.scanResult = {
          found: false,
          message: bodyMessage || 'No ticket found for this QR code.',
        };
        await this.alerts.error('Scan Failed', this.scanResult.message);
        this.scanBusy = false;
      },
    });
  }
}
