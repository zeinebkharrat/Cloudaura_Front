import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './api-url';
import { AuthService } from './auth.service';

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

export interface CheckoutOrder {
  orderId: number;
  status: string;
  totalAmount: number | null;
  lines: Array<{
    orderItemId: number;
    productId: number;
    name: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly cartCount = signal(0);

  private shopBase(): string {
    return `${API_BASE_URL}/api/shop`;
  }

  private usernameHeaders(): HttpHeaders {
    const u = this.auth.currentUser()?.username ?? '';
    return new HttpHeaders(u ? { 'X-Username': u } : {});
  }

  getCart(): Observable<ShopCart> {
    return this.http.get<ShopCart>(`${this.shopBase()}/cart`, { headers: this.usernameHeaders() }).pipe(
      tap((c) => this.setCountFromCart(c))
    );
  }

  addToCart(productId: number, quantity: number): Observable<ShopCart> {
    return this.http
      .post<ShopCart>(`${this.shopBase()}/cart/items`, { productId, quantity }, { headers: this.usernameHeaders() })
      .pipe(tap((c) => this.setCountFromCart(c)));
  }

  removeCartItem(cartItemId: number): Observable<ShopCart> {
    return this.http
      .delete<ShopCart>(`${this.shopBase()}/cart/items/${cartItemId}`, { headers: this.usernameHeaders() })
      .pipe(tap((c) => this.setCountFromCart(c)));
  }

  /** Met à jour la quantité (0 = retirer la ligne, comme DELETE). */
  updateCartItemQuantity(cartItemId: number, quantity: number): Observable<ShopCart> {
    return this.http
      .put<ShopCart>(
        `${this.shopBase()}/cart/items/${cartItemId}`,
        { quantity },
        { headers: this.usernameHeaders() }
      )
      .pipe(tap((c) => this.setCountFromCart(c)));
  }

  checkout(): Observable<CheckoutOrder> {
    return this.http
      .post<CheckoutOrder>(`${this.shopBase()}/checkout`, {}, { headers: this.usernameHeaders() })
      .pipe(tap(() => this.cartCount.set(0)));
  }

  refreshCartCount(): void {
    const h = this.usernameHeaders();
    const url = `${this.shopBase()}/cart`;
    this.http.get<ShopCart>(url, { headers: h }).subscribe({
      next: (c) => this.setCountFromCart(c),
      error: () => {
        if (API_BASE_URL === '') {
          this.http.get<ShopCart>(`${API_FALLBACK_ORIGIN}/api/shop/cart`, { headers: h }).subscribe({
            next: (c) => this.setCountFromCart(c),
            error: () => this.cartCount.set(0),
          });
        } else {
          this.cartCount.set(0);
        }
      },
    });
  }

  private setCountFromCart(c: ShopCart): void {
    const n = (c.items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0);
    this.cartCount.set(n);
  }
}
