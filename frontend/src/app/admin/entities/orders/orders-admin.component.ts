import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './orders-admin.component.html',
  styleUrl: './orders-admin.component.css',
})
export class OrdersAdminComponent implements OnInit, OnDestroy {
  private readonly ordersUrl = `${API_BASE_URL}/api/orders`;
  private readonly orderItemsUrl = `${API_BASE_URL}/api/order-items`;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statusOptions = [
    { value: 'PENDING', label: 'En attente' },
    { value: 'PROCESSING', label: 'En traitement' },
    { value: 'SHIPPED', label: 'Expédiée' },
    { value: 'DELIVERED', label: 'Livrée' },
    { value: 'CANCELLED', label: 'Annulée' },
  ] as const;

  orders: AdminOrderRow[] = [];
  orderItems: AdminOrderItemRow[] = [];
  loading = true;
  error = '';
  statusActionError = '';
  statusSaving = false;

  q = '';
  sort = 'orderId,desc';
  page = 0;
  size = 10;

  showDetailsModal = false;
  detailsOrder: AdminOrderRow | null = null;
  detailsStatusDraft = '';

  showStatusModal = false;
  statusModalOrder: AdminOrderRow | null = null;
  statusDraft = '';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  get filteredSorted(): AdminOrderRow[] {
    let list = [...this.orders];
    const qq = this.q.trim().toLowerCase();
    if (qq) {
      list = list.filter((o) => {
        const un = (o.user?.username ?? '').toLowerCase();
        const idStr = String(o.orderId);
        return un.includes(qq) || idStr.includes(qq);
      });
    }
    const [key, dir] = this.sort.split(',');
    const mult = dir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      if (key === 'username') {
        const au = (a.user?.username ?? '').toLowerCase();
        const bu = (b.user?.username ?? '').toLowerCase();
        return mult * au.localeCompare(bu, 'fr', { sensitivity: 'base' });
      }
      if (key === 'totalAmount') {
        const at = Number(a.totalAmount ?? 0);
        const bt = Number(b.totalAmount ?? 0);
        return mult * (at - bt);
      }
      if (key === 'status') {
        const as = (a.status ?? '').toLowerCase();
        const bs = (b.status ?? '').toLowerCase();
        return mult * as.localeCompare(bs, 'fr');
      }
      const aid = Number(a.orderId ?? 0);
      const bid = Number(b.orderId ?? 0);
      return mult * (aid - bid);
    });
    return list;
  }

  get totalElements(): number {
    return this.filteredSorted.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalElements / this.size));
  }

  get pagedOrders(): AdminOrderRow[] {
    const start = this.page * this.size;
    return this.filteredSorted.slice(start, start + this.size);
  }

  linesForOrder(orderId: number): AdminOrderItemRow[] {
    return this.orderItems.filter((it) => Number(it.order?.orderId) === orderId);
  }

  lineCountForOrder(orderId: number): number {
    return this.linesForOrder(orderId).length;
  }

  get modalLines(): AdminOrderItemRow[] {
    if (!this.detailsOrder) {
      return [];
    }
    return this.linesForOrder(this.detailsOrder.orderId);
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.http.get<AdminOrderRow[]>(this.ordersUrl).subscribe({
      next: (o) => {
        this.orders = o ?? [];
        this.http.get<AdminOrderItemRow[]>(this.orderItemsUrl).subscribe({
          next: (items) => {
            this.orderItems = items ?? [];
            this.loading = false;
            this.clampPage();
          },
          error: (err) => {
            console.error('Order items load failed', err);
            this.orderItems = [];
            this.error =
              'Commandes chargées, mais impossible de charger les lignes (/api/order-items). Réessayez ou vérifiez le backend.';
            this.loading = false;
          },
        });
      },
      error: () => {
        this.error = 'Impossible de charger les commandes (/api/orders).';
        this.loading = false;
      },
    });
  }

  onSearchInputChange(): void {
    this.page = 0;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.clampPage(), 300);
  }

  sortChanged(): void {
    this.page = 0;
    this.clampPage();
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
    } else if (!next && this.page > 0) {
      this.page--;
    }
  }

  private clampPage(): void {
    const maxPage = Math.max(0, this.totalPages - 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  openDetails(order: AdminOrderRow): void {
    this.detailsOrder = order;
    this.detailsStatusDraft = this.normalizeStatusKey(order.status);
    this.statusActionError = '';
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsOrder = null;
    this.detailsStatusDraft = '';
    this.statusActionError = '';
  }

  onDetailsBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeDetailsModal();
    }
  }

  openStatusModal(order: AdminOrderRow, event?: Event): void {
    event?.stopPropagation();
    this.statusModalOrder = order;
    this.statusDraft = this.normalizeStatusKey(order.status);
    this.statusActionError = '';
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.statusModalOrder = null;
    this.statusDraft = '';
    this.statusActionError = '';
  }

  onStatusBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeStatusModal();
    }
  }

  saveDetailStatus(): void {
    if (!this.detailsOrder) {
      return;
    }
    this.saveOrderStatus(this.detailsOrder.orderId, this.detailsStatusDraft, { closeStatusModalAfter: false });
  }

  saveStatusFromModal(): void {
    if (!this.statusModalOrder) {
      return;
    }
    this.saveOrderStatus(this.statusModalOrder.orderId, this.statusDraft, { closeStatusModalAfter: true });
  }

  private saveOrderStatus(
    orderId: number,
    newStatus: string,
    opts: { closeStatusModalAfter: boolean }
  ): void {
    this.statusActionError = '';
    this.statusSaving = true;
    this.http.put<AdminOrderRow>(`${this.ordersUrl}/${orderId}`, { status: newStatus }).subscribe({
      next: async (updated) => {
        this.statusSaving = false;
        this.statusActionError = '';
        const st = updated?.status ?? newStatus;
        this.patchOrderStatus(orderId, st);
        if (opts.closeStatusModalAfter) {
          this.closeStatusModal();
        }
        await Swal.fire({
          icon: 'success',
          title: 'Statut mis à jour',
          timer: 1300,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
          customClass: { container: 'swal-on-top' },
        });
      },
      error: () => {
        this.statusSaving = false;
        this.statusActionError = 'Impossible de mettre à jour le statut.';
      },
    });
  }

  private patchOrderStatus(orderId: number, status: string): void {
    this.orders = this.orders.map((o) => (o.orderId === orderId ? { ...o, status } : o));
    if (this.detailsOrder?.orderId === orderId) {
      this.detailsOrder = { ...this.detailsOrder, status };
      this.detailsStatusDraft = this.normalizeStatusKey(status);
    }
    if (this.statusModalOrder?.orderId === orderId) {
      this.statusModalOrder = { ...this.statusModalOrder, status };
    }
    this.orderItems = this.orderItems.map((it) => {
      const oid = it.order?.orderId;
      if (oid !== orderId) {
        return it;
      }
      return {
        ...it,
        order: it.order ? { ...it.order, status } : it.order,
      };
    });
  }

  async deleteOrder(order: AdminOrderRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    const confirmation = await Swal.fire({
      title: 'Supprimer cette commande ?',
      html: `La commande <strong>#${order.orderId}</strong> et ses lignes seront supprimées définitivement.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
      customClass: { container: 'swal-on-top' },
    });
    if (!confirmation.isConfirmed) {
      return;
    }

    this.error = '';
    this.http.delete(`${this.ordersUrl}/${order.orderId}`).subscribe({
      next: async () => {
        if (this.detailsOrder?.orderId === order.orderId) {
          this.closeDetailsModal();
        }
        if (this.statusModalOrder?.orderId === order.orderId) {
          this.closeStatusModal();
        }
        this.orders = this.orders.filter((o) => o.orderId !== order.orderId);
        this.orderItems = this.orderItems.filter((it) => Number(it.order?.orderId) !== order.orderId);
        this.clampPage();
        await Swal.fire({
          icon: 'success',
          title: 'Commande supprimée',
          timer: 1200,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
          customClass: { container: 'swal-on-top' },
        });
      },
      error: () => {
        this.error = 'Suppression impossible (droits ou erreur serveur).';
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

  orderStatusLabel(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    const opt = this.statusOptions.find((o) => o.value === s);
    if (opt) {
      return opt.label;
    }
    return status ?? '—';
  }

  private normalizeStatusKey(status: string | null | undefined): string {
    const u = (status ?? 'PENDING').toUpperCase();
    return this.statusOptions.some((o) => o.value === u) ? u : 'PENDING';
  }
}
