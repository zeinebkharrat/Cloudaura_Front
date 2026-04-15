import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ShopService, ShopCart, ShopCartLine, CheckoutOrder, CheckoutBuyer } from '../core/shop.service';
import { DualCurrencyPipe } from '../core/pipes/dual-currency.pipe';
import { createCurrencyDisplaySyncEffect } from '../core/utils/currency-display-sync';
import { CurrencyService } from '../core/services/currency.service';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DualCurrencyPipe, TranslateModule],
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.css',
})
export class CartPageComponent implements OnInit {
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();

  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly currency = inject(CurrencyService);

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
        this.error.set(this.translate.instant('CART_PAGE.MSG_LOAD_FAIL'));
        this.loading.set(false);
      },
    });
  }

  remove(line: ShopCartLine): void {
    this.shop.removeCartItem(line.cartItemId).subscribe({
      next: (c) => {
        this.cart.set(c);
      },
      error: () => this.error.set(this.translate.instant('CART_PAGE.MSG_REMOVE_FAIL')),
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
      this.error.set(this.translate.instant('CART_PAGE.MSG_MAX_STOCK'));
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
        this.error.set(this.translate.instant('CART_PAGE.MSG_UPDATE_QTY_FAIL'));
      },
    });
  }

  clearReceipt(): void {
    this.orderDone.set(null);
    this.router.navigate(['/mes-commandes']);
  }

  checkout(): void {
    this.checkoutLoading.set(true);
    this.error.set(null);
    this.shop.checkout(this.paymentMethod(), this.currency.selectedCode()).subscribe({
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
        const msg =
          e?.error?.message ?? e?.message ?? this.translate.instant('CART_PAGE.MSG_CHECKOUT_FAIL');
        this.error.set(
          typeof msg === 'string' ? msg : this.translate.instant('CART_PAGE.MSG_CHECKOUT_FAIL_GENERIC')
        );
      },
    });
  }

  imageSrc(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  orderStatusLabel(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'PENDING') return this.translate.instant('CART_PAGE.STATUS_PENDING');
    if (s === 'CONFIRMED' || s === 'CONFIRMÉE') return this.translate.instant('CART_PAGE.STATUS_CONFIRMED');
    if (s === 'SHIPPED') return this.translate.instant('CART_PAGE.STATUS_SHIPPED');
    if (s === 'DELIVERED') return this.translate.instant('CART_PAGE.STATUS_DELIVERED');
    if (s === 'CANCELLED') return this.translate.instant('CART_PAGE.STATUS_CANCELLED');
    return status ?? this.translate.instant('COMMON.DASH');
  }

  formatOrderedAt(iso: string | null | undefined): string {
    if (!iso) return this.translate.instant('COMMON.DASH');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : lang;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(d);
  }

  buyerDisplayName(b: CheckoutBuyer | null | undefined): string {
    if (!b) return this.translate.instant('COMMON.DASH');
    const fn = (b.firstName ?? '').trim();
    const ln = (b.lastName ?? '').trim();
    const full = `${fn} ${ln}`.trim();
    if (full) return full;
    return b.username ?? this.translate.instant('COMMON.DASH');
  }
}
