import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);

  readonly cart = signal<ShopCart | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly checkoutLoading = signal(false);
  readonly orderDone = signal<CheckoutOrder | null>(null);
  /** Ligne en cours de mise à jour quantité (cartItemId). */
  readonly qtyUpdatingId = signal<number | null>(null);

  readonly paymentMethod = signal<'CARD' | 'COD'>('CARD');

  /** Remise automatique 5 % si le sous-total dépasse 200 TND (aligné sur le backend) */
  hasDiscount(): boolean {
    if (!this.cart()) return false;
    return Number(this.cart()!.total) > 200;
  }

  /** Calculate discount amount */
  discountAmount(): number {
    if (!this.hasDiscount()) return 0;
    return Math.round(this.cart()!.total * 0.05 * 100) / 100; // Round to 2 decimal places
  }

  /** Calculate final total with discount and delivery */
  finalTotal(): number {
    if (!this.cart()) return 0;
    const subtotal = this.cart()!.total;
    const discount = this.discountAmount();
    const delivery = 7;
    return Math.round((subtotal - discount + delivery) * 100) / 100;
  }

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
        this.error.set('Could not load the cart.');
        this.loading.set(false);
      },
    });
  }

  remove(line: ShopCartLine): void {
    this.shop.removeCartItem(line.cartItemId).subscribe({
      next: (c) => {
        this.cart.set(c);
      },
      error: () => this.error.set('Could not remove the item.'),
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
      this.error.set('Maximum stock reached for this product.');
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
        this.error.set('Could not update quantity.');
      },
    });
  }

  clearReceipt(): void {
    this.orderDone.set(null);
    this.router.navigate(['/mes-commandes']);
  }

  downloadReceiptPdf(): void {
    const order = this.orderDone();
    if (!order?.orderId) return;
    this.shop.downloadMyOrderReceiptPdf(order.orderId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-receipt-${order.orderId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Could not download receipt PDF.'),
    });
  }

  checkout(): void {
    this.checkoutLoading.set(true);
    this.error.set(null);
    this.shop.checkout(this.paymentMethod()).subscribe({
      next: (o) => {
        this.cart.set({ cartId: null, items: [], total: 0 });
        this.shop.refreshCartCount();
        
        if (o.paymentUrl) {
          window.location.href = o.paymentUrl;
        } else {
          this.orderDone.set(o);
          this.checkoutLoading.set(false);
        }
      },
      error: (e) => {
        this.checkoutLoading.set(false);
        const msg = e?.error?.message ?? e?.message ?? 'Checkout failed (stock or empty cart).';
        this.error.set(typeof msg === 'string' ? msg : 'Checkout failed.');
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

  paymentMethodLabel(method: string | null | undefined): string {
    const m = (method ?? '').toUpperCase();
    if (m === 'CARD') return 'Card payment';
    if (m === 'COD') return 'Cash on delivery';
    return method ?? '—';
  }
}
