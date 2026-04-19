import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CheckoutBuyer,
  CheckoutOrder,
  MyOrderSummary,
  ShopService,
} from '../core/shop.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.css',
})
export class MyOrdersComponent implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly orders = signal<MyOrderSummary[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<CheckoutOrder | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly expandedOrderId = signal<number | null>(null);
  readonly paymentInfo = signal<string | null>(null);
  private autoOpenLatestOrder = false;

  ngOnInit(): void {
    this.handlePaymentReturn();
    this.loadList();
  }

  private handlePaymentReturn(): void {
    const qp = this.route.snapshot.queryParamMap;
    const sessionId = qp.get('session_id');
    const canceled = qp.get('canceled');
    const success = qp.get('success');

    if (canceled === 'true') {
      this.paymentInfo.set('Payment canceled. Your order remains pending.');
      this.autoOpenLatestOrder = true;
      this.clearCheckoutQueryParams();
      return;
    }
    if (!sessionId) {
      if (success === 'true') {
        this.paymentInfo.set('Payment return received. Waiting for confirmation.');
        this.autoOpenLatestOrder = true;
        this.clearCheckoutQueryParams();
      }
      return;
    }

    this.paymentInfo.set('Verifying your card payment...');
    this.shop.confirmShopStripeSession(sessionId).subscribe({
      next: () => {
        this.paymentInfo.set('Payment confirmed. Your order is now processing.');
        this.autoOpenLatestOrder = true;
        this.clearCheckoutQueryParams();
        this.loadList();
      },
      error: () => {
        this.paymentInfo.set('Payment not confirmed. Your order remains pending.');
        this.autoOpenLatestOrder = true;
        this.clearCheckoutQueryParams();
        this.loadList();
      },
    });
  }

  private clearCheckoutQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        session_id: null,
        success: null,
        canceled: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  loadList(): void {
    this.loading.set(true);
    this.error.set(null);
    
    const obs = this.auth.isArtisan() 
      ? this.shop.getArtisanOrders() 
      : this.shop.getMyOrders();

    obs.subscribe({
      next: (rows) => {
        this.orders.set(rows);
        if (this.autoOpenLatestOrder && rows && rows.length > 0) {
          this.autoOpenLatestOrder = false;
          this.toggleDetail(rows[0]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load data.');
        this.loading.set(false);
      },
    });
  }

  toggleDetail(row: MyOrderSummary): void {
    const id = row.orderId;
    if (this.expandedOrderId() === id) {
      this.expandedOrderId.set(null);
      this.detail.set(null);
      this.detailError.set(null);
      return;
    }
    this.expandedOrderId.set(id);
    this.detail.set(null);
    this.detailError.set(null);
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
        this.detailError.set('Details unavailable or access denied.');
      },
    });
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null || Number.isNaN(Number(p))) return '—';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'TND', minimumFractionDigits: 2 }).format(
      Number(p)
    );
  }

  orderStatusLabel(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'PENDING') return 'Pending';
    if (s === 'PROCESSING') return 'Processing';
    if (s === 'SHIPPED') return 'Shipped';
    if (s === 'DELIVERED') return 'Delivered';
    if (s === 'CANCELLED') return 'Cancelled';
    return status ?? '—';
  }

  formatOrderedAt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(d);
  }

  buyerDisplayName(b: CheckoutBuyer | null | undefined): string {
    if (!b) return '—';
    const fn = (b.firstName ?? '').trim();
    const ln = (b.lastName ?? '').trim();
    const full = `${fn} ${ln}`.trim();
    if (full) return full;
    return b.username ?? '—';
  }

  rowExpanded(row: MyOrderSummary): boolean {
    return this.expandedOrderId() === row.orderId;
  }

  paymentMethodLabel(method: string | null | undefined): string {
    const m = (method ?? '').toUpperCase();
    if (m === 'CARD') return 'Card payment';
    if (m === 'COD') return 'Cash on delivery';
    return method ?? '—';
  }

  downloadReceiptPdf(): void {
    const d = this.detail();
    if (!d?.orderId) return;
    this.shop.downloadMyOrderReceiptPdf(d.orderId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-receipt-${d.orderId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.detailError.set('Could not download receipt PDF.'),
    });
  }
}
