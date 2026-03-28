import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopService, ShopCart, ShopCartLine, CheckoutOrder, CheckoutBuyer } from '../core/shop.service';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.css',
})
export class CartPageComponent implements OnInit {
  private readonly shop = inject(ShopService);

  readonly cart = signal<ShopCart | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly checkoutLoading = signal(false);
  readonly orderDone = signal<CheckoutOrder | null>(null);
  /** Ligne en cours de mise à jour quantité (cartItemId). */
  readonly qtyUpdatingId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shop.getCart().subscribe({
      next: (c) => {
        this.cart.set(c);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le panier.');
        this.loading.set(false);
      },
    });
  }

  remove(line: ShopCartLine): void {
    this.shop.removeCartItem(line.cartItemId).subscribe({
      next: (c) => {
        this.cart.set(c);
      },
      error: () => this.error.set('Suppression impossible.'),
    });
  }

  maxStock(line: ShopCartLine): number {
    const s = line.stock;
    if (s == null || Number.isNaN(Number(s))) {
      return 999_999;
    }
    return Math.max(0, Number(s));
  }

  changeQty(line: ShopCartLine, delta: number): void {
    const next = line.quantity + delta;
    const max = this.maxStock(line);
    if (delta > 0 && next > max) {
      this.error.set('Stock maximum atteint pour ce produit.');
      return;
    }
    if (next < 0) {
      return;
    }
    this.error.set(null);
    this.qtyUpdatingId.set(line.cartItemId);
    this.shop.updateCartItemQuantity(line.cartItemId, next).subscribe({
      next: (c) => {
        this.cart.set(c);
        this.qtyUpdatingId.set(null);
      },
      error: () => {
        this.qtyUpdatingId.set(null);
        this.error.set('Impossible de modifier la quantité.');
      },
    });
  }

  clearReceipt(): void {
    this.orderDone.set(null);
  }

  checkout(): void {
    this.checkoutLoading.set(true);
    this.error.set(null);
    this.shop.checkout().subscribe({
      next: (o) => {
        this.orderDone.set(o);
        this.cart.set({ cartId: null, items: [], total: 0 });
        this.checkoutLoading.set(false);
        this.shop.refreshCartCount();
      },
      error: (e) => {
        this.checkoutLoading.set(false);
        const msg = e?.error?.message ?? e?.message ?? 'Commande impossible (stock ou panier vide).';
        this.error.set(typeof msg === 'string' ? msg : 'Commande impossible.');
      },
    });
  }

  imageSrc(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
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
}
