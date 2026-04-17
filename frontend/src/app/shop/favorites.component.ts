import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { API_BASE_URL } from '../core/api-url';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { CatalogProduct } from '../feature-page.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="favorites-page">
      <div class="favorites-header">
        <div class="favorites-header__icon">❤️</div>
        <h1>{{ 'FAVORITES_PAGE.TITLE' | translate }}</h1>
        <p>{{ 'FAVORITES_PAGE.SUBTITLE' | translate }}</p>
      </div>

      <div *ngIf="loading()" class="fav-state">
        <i class="pi pi-spin pi-spinner"></i> {{ 'FAVORITES_PAGE.LOADING' | translate }}
      </div>
      <div *ngIf="error()" class="fav-state fav-state--error">
        <i class="pi pi-exclamation-triangle"></i> {{ error() }}
        <button (click)="load()">{{ 'FAVORITES_PAGE.RETRY' | translate }}</button>
      </div>
      <div *ngIf="!loading() && !error() && favorites().length === 0" class="fav-empty">
        <div class="fav-empty__icon">🫶</div>
        <h3>{{ 'FAVORITES_PAGE.EMPTY_TITLE' | translate }}</h3>
        <p>{{ 'FAVORITES_PAGE.EMPTY_DESC' | translate }}</p>
        <a routerLink="/artisanat" class="btn-browse">{{ 'FAVORITES_PAGE.BROWSE' | translate }}</a>
      </div>

      <div *ngIf="!loading() && favorites().length > 0" class="fav-toast-wrap">
        <div *ngIf="toast()" class="fav-toast" [class.fav-toast--error]="toastType() === 'error'" [class.fav-toast--info]="toastType() === 'info'">{{ toast() }}</div>
      </div>

      <div *ngIf="!loading() && favorites().length > 0" class="fav-grid">
        <div *ngFor="let p of favorites(); let i = index" class="fav-card" [style.animation-delay.ms]="i * 50">
          <button class="fav-card__remove" (click)="removeFavorite(p)" [attr.title]="'FAVORITES_PAGE.REMOVE_TITLE' | translate">
            <i class="pi pi-heart-fill"></i>
          </button>
          <div class="fav-card__media" [routerLink]="['/artisanat']">
            <img *ngIf="p.imageUrl" [src]="normalizeUrl(p.imageUrl)" [alt]="p.name"
              onerror="this.style.display='none'" class="fav-card__img" />
            <div *ngIf="!p.imageUrl" class="fav-card__placeholder">✦</div>
          </div>
          <div class="fav-card__body">
            <span class="fav-card__category" *ngIf="p.category">{{ p.category }}</span>
            <h3 class="fav-card__name">{{ p.name }}</h3>
            <p class="fav-card__desc" *ngIf="p.description">{{ p.description }}</p>
            <p class="fav-card__vendor" *ngIf="p.user?.username">
              <i class="pi pi-user"></i> {{ p.user?.username }}
              <span *ngIf="p.user?.cityName"> · {{ p.user?.cityName }}</span>
            </p>
            <div class="fav-card__footer">
              <span class="fav-card__price">{{ formatPrice(p.price) }}</span>
              <button class="fav-card__cart" (click)="addToCart(p)"
                [disabled]="addingId() === p.productId || (p.stock != null && p.stock <= 0)">
                <i class="pi pi-shopping-cart"></i>
                {{ (p.stock != null && p.stock <= 0) ? ('FAVORITES_PAGE.OUT_OF_STOCK' | translate) : ('FAVORITES_PAGE.ADD' | translate) }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .favorites-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 96px 6% 80px;
    }
    .favorites-header {
      text-align: center;
      margin-bottom: 56px;
    }
    .favorites-header__icon { font-size: 3.5rem; margin-bottom: 16px; }
    .favorites-header h1 {
      font-size: clamp(2rem, 4vw, 2.8rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      background: var(--title-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0 0 14px;
    }
    .favorites-header p { color: var(--text-muted); font-size: 1.05rem; }

    .fav-state {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .fav-state--error { color: #e8002d; }

    .fav-empty {
      text-align: center;
      padding: 80px 20px;
    }
    .fav-empty__icon { font-size: 4rem; margin-bottom: 20px; }
    .fav-empty h3 { font-size: 1.5rem; font-weight: 700; margin: 0 0 10px; }
    .fav-empty p { color: var(--text-muted); margin-bottom: 28px; }
    .btn-browse {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 13px 28px;
      border-radius: 14px;
      background: linear-gradient(135deg, #e8002d, #c00025);
      color: #fff;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 8px 20px rgba(232,0,45,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-browse:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(232,0,45,0.4); }

    .fav-toast-wrap { margin-bottom: 16px; }
    .fav-toast {
      padding: 14px 20px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.75));
      color: #fff;
      font-weight: 600;
      font-size: 0.93rem;
      max-width: 500px;
      margin: 0 auto;
      text-align: center;
    }
    .fav-toast--error { background: linear-gradient(135deg, rgba(232,0,45,0.85), rgba(185,0,30,0.75)); }
    .fav-toast--info { background: linear-gradient(135deg, rgba(0,119,182,0.85), rgba(0,90,140,0.75)); }

    .fav-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 28px;
    }
    .fav-card {
      position: relative;
      border-radius: 22px;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.03);
      overflow: hidden;
      transition: transform 0.35s cubic-bezier(0.2,0.8,0.2,1), border-color 0.3s, box-shadow 0.3s;
      animation: fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
      display: flex;
      flex-direction: column;
    }
    .fav-card:hover {
      transform: translateY(-10px);
      border-color: rgba(232,0,45,0.3);
      box-shadow: 0 24px 48px rgba(0,0,0,0.3);
    }
    .fav-card__remove {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: rgba(232,0,45,0.9);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.9rem;
      transition: transform 0.2s, background 0.2s;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }
    .fav-card__remove:hover { transform: scale(1.15); background: #c00025; }
    .fav-card__media {
      height: 210px;
      overflow: hidden;
      cursor: pointer;
      background: var(--surface-2);
    }
    .fav-card__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }
    .fav-card:hover .fav-card__img { transform: scale(1.06); }
    .fav-card__placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      opacity: 0.3;
    }
    .fav-card__body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
    .fav-card__category {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }
    .fav-card__name { font-size: 1.05rem; font-weight: 700; margin: 0; }
    .fav-card__desc {
      font-size: 0.83rem;
      color: var(--text-muted);
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .fav-card__vendor { font-size: 0.8rem; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 5px; }
    .fav-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--border-soft);
    }
    .fav-card__price { font-size: 1.15rem; font-weight: 800; color: #e8002d; }
    .fav-card__cart {
      padding: 9px 16px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #e8002d, #c00025);
      color: #fff;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 10px rgba(232,0,45,0.25);
      transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
    }
    .fav-card__cart:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 7px 18px rgba(232,0,45,0.4); }
    .fav-card__cart:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(22px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class FavoritesComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly translate = inject(TranslateService);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);

  readonly favorites = signal<CatalogProduct[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly addingId = signal<number | null>(null);
  readonly toast = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error' | 'info'>('success');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CatalogProduct[]>(`${API_BASE_URL}/api/favorites`).subscribe({
      next: (list) => {
        this.favorites.set(list ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('FAVORITES_PAGE.ERR_LOAD'));
        this.loading.set(false);
      }
    });
  }

  removeFavorite(p: CatalogProduct): void {
    this.http.post<any>(`${API_BASE_URL}/api/favorites/toggle/${p.productId}`, {}).subscribe({
      next: (res) => {
        if (!res.isFavorite) {
          this.favorites.update(list => list.filter(f => f.productId !== p.productId));
          this.showToast(this.translate.instant('FAVORITES_PAGE.TOAST_REMOVED', { name: p.name }), 'success');
        }
      },
      error: () => this.showToast(this.translate.instant('FAVORITES_PAGE.TOAST_UPDATE_ERR'), 'error')
    });
  }

  addToCart(p: CatalogProduct): void {
    if (p.category === 'TEXTILE' && p.variants && p.variants.length > 1) {
      this.router.navigate(['/artisanat']);
      this.showToast(this.translate.instant('FAVORITES_PAGE.TOAST_VARIANTS'), 'info');
      return;
    }
    let variantId: number | undefined;
    if (p.category === 'TEXTILE' && p.variants?.length === 1) {
      const v0 = p.variants[0];
      const raw = v0.variantId ?? (v0 as { id?: number }).id;
      variantId = raw != null ? Number(raw) : undefined;
    }
    this.addingId.set(p.productId);
    this.shop.addToCart(p.productId, 1, variantId ?? null).subscribe({
      next: () => {
        this.addingId.set(null);
        this.shop.refreshCartCount();
        this.showToast(this.translate.instant('FAVORITES_PAGE.TOAST_ADDED', { name: p.name }), 'success');
      },
      error: () => {
        this.addingId.set(null);
        this.showToast(this.translate.instant('FAVORITES_PAGE.TOAST_CART_ERR'), 'error');
      }
    });
  }

  normalizeUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null) return '—';
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(p);
  }

  private showToast(msg: string, type: 'success' | 'error' | 'info'): void {
    this.toast.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toast.set(null), 3000);
  }
}
