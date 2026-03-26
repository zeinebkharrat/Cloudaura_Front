import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { API_BASE_URL } from '../../../core/api-url';

/** Réponse GET /api/orders (entité existante). */
export interface AdminOrderRow {
  orderId: number;
  totalAmount: number | null;
  status: string;
  user?: { userId?: number; username?: string } | null;
}

/** Réponse GET /api/order-items (entité existante). */
export interface AdminOrderItemRow {
  orderItemId: number;
  quantity: number | null;
  order?: { orderId?: number; totalAmount?: number | null; status?: string; user?: { username?: string } } | null;
  product?: { productId?: number; name?: string; price?: number | null } | null;
}

@Component({
  selector: 'app-orders-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders-admin.component.html',
  styleUrl: './orders-admin.component.css',
})
export class OrdersAdminComponent implements OnInit {
  private readonly ordersUrl = `${API_BASE_URL}/api/orders`;
  private readonly orderItemsUrl = `${API_BASE_URL}/api/order-items`;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orders = signal<AdminOrderRow[]>([]);
  readonly orderItems = signal<AdminOrderItemRow[]>([]);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<AdminOrderRow[]>(this.ordersUrl).subscribe({
      next: (o) => {
        this.orders.set(o ?? []);
        this.http.get<AdminOrderItemRow[]>(this.orderItemsUrl).subscribe({
          next: (items) => {
            this.orderItems.set(items ?? []);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('Impossible de charger les lignes de commande (/api/order-items).');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Impossible de charger les commandes (/api/orders).');
        this.loading.set(false);
      },
    });
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null || Number.isNaN(Number(p))) return '—';
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
    }).format(Number(p));
  }

  lineTotal(item: AdminOrderItemRow): string {
    const q = item.quantity ?? 0;
    const unit = item.product?.price ?? 0;
    return this.formatPrice(Number(q) * Number(unit));
  }
}
