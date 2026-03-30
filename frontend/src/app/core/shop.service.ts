import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './api-url';

export interface ShopCartLine {
  cartItemId: number;
  productId: number;
  name: string;
  imageUrl?: string | null;
  unitPrice: number | null;
  quantity: number;
  lineTotal: number | null;
  /** Stock produit (plafond quantité). */
  stock?: number | null;
}

export interface ShopCart {
  cartId: number | null;
  items: ShopCartLine[];
  total: number;
}

export interface CheckoutBuyer {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface CheckoutOrder {
  orderId: number;
  status: string;
  totalAmount: number | null;
  /** ISO-8601 renvoyé par le backend */
  orderedAt?: string | null;
  buyer?: CheckoutBuyer | null;
  lines: Array<{
    orderItemId: number;
    productId: number;
    name: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
  }>;
}

/** Ligne liste « mes commandes » (sans détail articles). */
export interface MyOrderSummary {
  orderId: number;
  status: string;
  totalAmount: number | null;
  orderedAt?: string | null;
  itemCount: number;
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly http = inject(HttpClient);

  readonly cartCount = signal(0);

  private shopBase(): string {
    return `${API_BASE_URL}/api/shop`;
  }

  getCart(): Observable<ShopCart> {
    return this.http.get<ShopCart>(`${this.shopBase()}/cart`).pipe(tap((c) => this.setCountFromCart(c)));
  }

  addToCart(productId: number, quantity: number): Observable<ShopCart> {
    return this.http
      .post<ShopCart>(`${this.shopBase()}/cart/items`, { productId, quantity })
      .pipe(tap((c) => this.setCountFromCart(c)));
  }

  removeCartItem(cartItemId: number): Observable<ShopCart> {
    return this.http
      .delete<ShopCart>(`${this.shopBase()}/cart/items/${cartItemId}`)
      .pipe(tap((c) => this.setCountFromCart(c)));
  }

  /** Met à jour la quantité (0 = retirer la ligne, comme DELETE). */
  updateCartItemQuantity(cartItemId: number, quantity: number): Observable<ShopCart> {
    return this.http
      .put<ShopCart>(`${this.shopBase()}/cart/items/${cartItemId}`, { quantity })
      .pipe(tap((c) => this.setCountFromCart(c)));
  }

  checkout(): Observable<CheckoutOrder> {
    return this.http.post<CheckoutOrder>(`${this.shopBase()}/checkout`, {}).pipe(tap(() => this.cartCount.set(0)));
  }

  getMyOrders(): Observable<MyOrderSummary[]> {
    return this.http.get<MyOrderSummary[]>(`${this.shopBase()}/orders`);
  }

  getMyOrderDetail(orderId: number): Observable<CheckoutOrder> {
    return this.http.get<CheckoutOrder>(`${this.shopBase()}/orders/${orderId}`);
  }

  getArtisanOrders(): Observable<MyOrderSummary[]> {
    return this.http.get<MyOrderSummary[]>(`${this.shopBase()}/artisan-orders`);
  }

  refreshCartCount(): void {
    const url = `${this.shopBase()}/cart`;
    this.http.get<ShopCart>(url).subscribe({
      next: (c) => this.setCountFromCart(c),
      error: (err: HttpErrorResponse) => {
        // 401/403: not logged in or invalid token — do not spam wrong-port fallback
        if (err.status === 401 || err.status === 403) {
          this.cartCount.set(0);
          return;
        }
        // status 0 ≈ connection refused / CORS / proxy down — try direct backend once
        if (API_BASE_URL === '' && err.status === 0) {
          this.http.get<ShopCart>(`${API_FALLBACK_ORIGIN}/api/shop/cart`).subscribe({
            next: (c) => this.setCountFromCart(c),
            error: () => this.cartCount.set(0),
          });
          return;
        }
        this.cartCount.set(0);
      },
    });
  }

  private setCountFromCart(c: ShopCart): void {
    const n = (c.items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0);
    this.cartCount.set(n);
  }
}
