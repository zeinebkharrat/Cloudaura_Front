import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CheckoutBuyer,
  CheckoutOrder,
  MyOrderSummary,
  ShopService,
} from '../core/shop.service';
import { AuthService } from '../core/auth.service';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../core/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { DualCurrencyPipe } from '../core/pipes/dual-currency.pipe';

@Component({
  selector: 'app-artisan-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, DualCurrencyPipe],
  templateUrl: './artisan-orders.component.html',
  styleUrl: './artisan-orders.component.css',
})
export class ArtisanOrdersComponent implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly auth = inject(AuthService);
  private readonly notifier = inject(NotificationService);

  readonly orders = signal<MyOrderSummary[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Dashboard strip: order count, line items, revenue. */
  readonly summary = computed(() => {
    const list = this.orders();
    if (!list?.length) return null;
    let revenue = 0;
    let items = 0;
    for (const o of list) {
      revenue += o.totalAmount ?? 0;
      items += o.itemCount ?? 0;
    }
    return { orders: list.length, revenue, items };
  });

  readonly expandedOrderId = signal<number | null>(null);
  readonly detail = signal<CheckoutOrder | null>(null);
  readonly detailLoading = signal(false);
  /** Must match backend {@link OrderStatus}: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED */
  readonly statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'PROCESSING', label: 'Processing' },    
    { value: 'SHIPPED', label: 'Shipped' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ] as const;
  readonly statusOptionValues = this.statusOptions.map((option) => option.value);

  readonly updatingItems = signal<Set<number>>(new Set());

  ngOnInit(): void {
    if (!this.auth.isArtisan() && !this.auth.isAdmin()) {
        this.error.set('Access denied.');
        this.loading.set(false);
        return;
    }
    this.loadList();
  }

  loadList(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shop.getArtisanOrders().subscribe({
      next: (rows) => {
        this.orders.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your orders.');
        this.loading.set(false);
      },
    });
  }

  toggleDetail(row: MyOrderSummary): void {
    const id = row.orderId;
    if (this.expandedOrderId() === id) {
      this.expandedOrderId.set(null);
      this.detail.set(null);
      return;
    }
    this.expandedOrderId.set(id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.shop.getMyOrderDetail(id).subscribe({
      next: (o) => {
        if (this.expandedOrderId() === id) {
          this.detail.set(o);
        }
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
      },
    });
  }

  updateStatus(orderItemId: number, newStatus: string): void {
    this.updatingItems.update(s => { s.add(orderItemId); return new Set(s); });
    this.shop.updateOrderItemStatus(orderItemId, newStatus).subscribe({
      next: () => {
        this.updatingItems.update(s => { s.delete(orderItemId); return new Set(s); });
        this.notifier.show('Status updated.', 'success');
        this.loadList();
        const openId = this.expandedOrderId();
        if (openId != null) {
          this.detailLoading.set(true);
          this.shop.getMyOrderDetail(openId).subscribe({
            next: (o) => {
              if (this.expandedOrderId() === openId) {
                this.detail.set(o);
              }
              this.detailLoading.set(false);
            },
            error: () => this.detailLoading.set(false),
          });
        }
      },
      error: () => {
        this.updatingItems.update(s => { s.delete(orderItemId); return new Set(s); });
        this.notifier.show('Could not update status.', 'error');
      }
    });
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TND' }).format(p);
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
  }

  rowExpanded(row: MyOrderSummary): boolean {
    return this.expandedOrderId() === row.orderId;
  }

  lineInitial(name: string | undefined): string {
    const t = (name ?? '').trim();
    if (!t) return '?';
    return t.charAt(0).toUpperCase();
  }
}
