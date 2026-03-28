import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CheckoutBuyer,
  CheckoutOrder,
  MyOrderSummary,
  ShopService,
} from '../core/shop.service';
import { AuthService } from '../auth.service';

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

  readonly orders = signal<MyOrderSummary[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<CheckoutOrder | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly expandedOrderId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadList();
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
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les données.');
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
        this.detailError.set('Détail indisponible ou accès refusé.');
      },
    });
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null || Number.isNaN(Number(p))) return '—';
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 2 }).format(
      Number(p)
    );
  }

  orderStatusLabel(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'PENDING') return 'En attente de traitement';
    if (s === 'CONFIRMED' || s === 'CONFIRMÉE') return 'Confirmée';
    if (s === 'SHIPPED') return 'Expédiée';
    if (s === 'DELIVERED') return 'Livrée';
    if (s === 'CANCELLED') return 'Annulée';
    return status ?? '—';
  }

  formatOrderedAt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('fr-FR', {
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
}
