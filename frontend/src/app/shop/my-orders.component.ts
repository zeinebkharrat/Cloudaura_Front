import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DualCurrencyPipe } from '../core/pipes/dual-currency.pipe';
import { createCurrencyDisplaySyncEffect } from '../core/utils/currency-display-sync';
import {
  CheckoutBuyer,
  CheckoutOrder,
  MyOrderSummary,
  ShopService,
} from '../core/shop.service';
import { AuthService } from '../core/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, DualCurrencyPipe, TranslateModule],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.css',
})
export class MyOrdersComponent implements OnInit {
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();

  private readonly shop = inject(ShopService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

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
        this.error.set(this.translate.instant('MY_ORDERS.MSG_LIST_FAIL'));
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
        this.detailError.set(this.translate.instant('MY_ORDERS.MSG_DETAIL_FAIL'));
      },
    });
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

  rowExpanded(row: MyOrderSummary): boolean {
    return this.expandedOrderId() === row.orderId;
  }
}
