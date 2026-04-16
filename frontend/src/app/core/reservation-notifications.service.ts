import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Client, IFrame, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';

export interface ReservationNotificationItem {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  route: string | null;
  reservationType: string | null;
  reservationId: number | null;
  read: boolean;
  createdAt: string | null;
}

interface ReservationNotificationsResponse {
  items?: unknown;
  unreadCount?: unknown;
}

@Injectable({ providedIn: 'root' })
export class ReservationNotificationsService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private stompClient: Client | null = null;

  readonly items = signal<ReservationNotificationItem[]>([]);
  readonly busy = signal(false);

  connect(): void {
    if (this.stompClient?.active) {
      return;
    }
    const token = this.auth.token();
    if (!token) {
      return;
    }

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.load();
        this.stompClient?.subscribe('/user/queue/notifications', (msg: IMessage) => {
          const parsed = this.parseNotification(msg.body);
          if (!parsed) {
            return;
          }
          this.items.update((current) => {
            const existingIndex = current.findIndex((n) => n.notificationId === parsed.notificationId);
            if (existingIndex >= 0) {
              const next = [...current];
              next[existingIndex] = parsed;
              return next;
            }
            return [parsed, ...current];
          });
        });
      },
      onStompError: (frame: IFrame) => {
        console.error('Reservation notifications STOMP error', frame);
      },
    });

    this.stompClient.activate();
  }

  disconnect(): void {
    if (!this.stompClient) {
      return;
    }
    this.stompClient.deactivate();
    this.stompClient = null;
  }

  load(): void {
    this.busy.set(true);
    this.http.get<ReservationNotificationsResponse>('/api/notifications/me').subscribe({
      next: (res) => {
        this.items.set(this.normalizeArray(res?.items));
        this.busy.set(false);
      },
      error: () => {
        this.items.set([]);
        this.busy.set(false);
      },
    });
  }

  markAsRead(notificationId: number): void {
    this.http.patch('/api/notifications/' + notificationId + '/read', {}).subscribe({
      next: () => {
        this.items.update((rows) => rows.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n)));
      },
      error: () => {
        // keep UI state unchanged when API fails
      },
    });
  }

  markAllAsRead(): void {
    const previous = this.items();
    this.items.update((rows) => rows.map((n) => ({ ...n, read: true })));
    this.http.post('/api/notifications/read-all', {}).subscribe({
      next: () => {
        // state already updated optimistically
      },
      error: () => {
        this.items.set(previous);
      },
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private parseNotification(raw: string): ReservationNotificationItem | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeOne(parsed);
    } catch {
      return null;
    }
  }

  private normalizeArray(raw: unknown): ReservationNotificationItem[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const items: ReservationNotificationItem[] = [];
    for (const row of raw) {
      const normalized = this.normalizeOne(row);
      if (normalized) {
        items.push(normalized);
      }
    }
    return items;
  }

  private normalizeOne(raw: unknown): ReservationNotificationItem | null {
    const row = raw as Record<string, unknown> | null;
    if (!row) {
      return null;
    }
    const id = Number(row['notificationId']);
    if (!Number.isFinite(id)) {
      return null;
    }

    const reservationIdRaw = row['reservationId'];
    const reservationId = reservationIdRaw == null ? null : Number(reservationIdRaw);

    return {
      notificationId: id,
      type: String(row['type'] ?? 'RESERVATION'),
      title: String(row['title'] ?? 'Notification'),
      message: String(row['message'] ?? ''),
      route: row['route'] == null ? null : String(row['route']),
      reservationType: row['reservationType'] == null ? null : String(row['reservationType']),
      reservationId: Number.isFinite(reservationId) ? reservationId : null,
      read: Boolean(row['read'] ?? row['isRead']),
      createdAt: row['createdAt'] == null ? null : String(row['createdAt']),
    };
  }
}
