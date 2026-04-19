import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './api-url';

export interface ShopCartLine {
  cartItemId: number;
  productId: number;
  variantId?: number | null;
  name: string;
  size?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
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
  totalAmount: number;
  /** ISO-8601 renvoyé par le backend */
  orderedAt?: string | null;
  buyer?: CheckoutBuyer | null;
  paymentUrl?: string | null;
  paymentMethod?: string | null;
  lines: Array<{
    orderItemId: number;
    productId: number;
    variantId?: number | null;
    name: string;
    size?: string | null;
    color?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    status: string;
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

  addToCart(productId: number, quantity: number, variantId?: number | null): Observable<ShopCart> {
    return this.http
      .post<ShopCart>(`${this.shopBase()}/cart/items`, { productId, quantity, variantId })
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

  checkout(paymentMethod?: string, presentmentCurrency?: string): Observable<CheckoutOrder> {
    const params: Record<string, string> = {};
    if (paymentMethod) params['paymentMethod'] = paymentMethod;
    if (presentmentCurrency) params['presentmentCurrency'] = presentmentCurrency;
    return this.http.post<CheckoutOrder>(`${this.shopBase()}/checkout`, {}, { params }).pipe(tap(() => this.cartCount.set(0)));
  }

  confirmShopStripeSession(sessionId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/payment/shop/confirm-session`, null, {
      params: { session_id: sessionId },
    });
  }

  getMyOrders(): Observable<MyOrderSummary[]> {
    return this.http.get<MyOrderSummary[]>(`${this.shopBase()}/orders`);
  }

  getMyOrderDetail(orderId: number): Observable<CheckoutOrder> {
    return this.http.get<CheckoutOrder>(`${this.shopBase()}/orders/${orderId}`);
  }

  downloadMyOrderReceiptPdf(orderId: number): Observable<Blob> {
    return this.http.get(`${this.shopBase()}/orders/${orderId}/receipt.pdf`, { responseType: 'blob' });
  }

  getArtisanOrders(): Observable<MyOrderSummary[]> {
    return this.http.get<MyOrderSummary[]>(`${this.shopBase()}/artisan-orders`);
  }

  updateOrderItemStatus(orderItemId: number, status: string): Observable<void> {
    return this.http.put<void>(`${this.shopBase()}/order-items/${orderItemId}/status`, null, {
      params: { status }
    });
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
