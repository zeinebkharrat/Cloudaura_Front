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
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../core/notification.service';

@Component({
  selector: 'app-artisan-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
  
  readonly expandedOrderId = signal<number | null>(null);
  readonly detail = signal<CheckoutOrder | null>(null);
  readonly detailLoading = signal(false);

  readonly statusOptions = [
    { value: 'PENDING', label: 'En attente' },
    { value: 'CONFIRMED', label: 'Confirmé' },
    { value: 'SHIPPED', label: 'Expédié' },
    { value: 'DELIVERED', label: 'Livré' },
    { value: 'CANCELLED', label: 'Annulé' },
  ] as const;

  readonly updatingItems = signal<Set<number>>(new Set());

  orderStatusLabel(status: string | undefined | null): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      CONFIRMED: 'Confirmée',
      SHIPPED: 'Expédiée',
      DELIVERED: 'Livrée',
      CANCELLED: 'Annulée',
    };
    if (status == null) return '—';
    return map[status] ?? status;
  }

  ngOnInit(): void {
    if (!this.auth.isArtisan() && !this.auth.isAdmin()) {
        this.error.set('Accès non autorisé.');
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
        this.error.set('Impossible de charger vos commandes.');
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
        this.notifier.show('✓ Statut mis à jour avec succès.', 'success');
      },
      error: () => {
        this.updatingItems.update(s => { s.delete(orderItemId); return new Set(s); });
        this.notifier.show('✕ Erreur lors de la mise à jour du statut.', 'error');
      }
    });
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null) return '—';
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(p);
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });
  }

  rowExpanded(row: MyOrderSummary): boolean {
    return this.expandedOrderId() === row.orderId;
  }
}
