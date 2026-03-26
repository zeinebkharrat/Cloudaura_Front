import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Data, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './core/api-url';
import { AuthService } from './core/auth.service';
import { ShopService } from './core/shop.service';

/** Rich content block for feature pages (front-only). */
export interface FeatureBlock {
  title: string;
  items: string[];
  icon?: string;
}

/** Accent theme for decorative styling. */
export type FeatureAccent =
  | 'coral'
  | 'blue'
  | 'gold'
  | 'violet'
  | 'sand'
  | 'emerald'
  | 'rose';

/** Produit affiché sur la vitrine Artisanat (API /api/products). */
export interface CatalogProduct {
  productId: number;
  name: string;
  imageUrl?: string | null;
  price?: number | null;
  stock?: number | null;
  user?: { username?: string | null };
}

@Component({
  selector: 'app-feature-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './feature-page.component.html',
  styleUrl: './feature-page.component.css',
})
export class FeaturePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);

  kicker = '';
  title = '';
  description = '';
  accent: FeatureAccent = 'coral';
  highlights: string[] = [];
  blocks: FeatureBlock[] = [];

  /** Si `'products'`, charge et affiche le catalogue sous les blocs informatifs. */
  catalog: 'none' | 'products' = 'none';
  catalogProducts: CatalogProduct[] = [];
  catalogLoading = false;
  catalogError: string | null = null;
  readonly addingProductId = signal<number | null>(null);
  readonly cartToast = signal<string | null>(null);

  ngOnInit(): void {
        this.applyData(this.route.snapshot.data);

    this.route.data.subscribe((d) => this.applyData(d));
  }

  private applyData(d: Data): void {
    this.kicker = String(d['kicker'] ?? 'Module');
    this.title = String(d['title'] ?? '');
    this.description = String(d['description'] ?? '');
    const a = d['accent'];
    if (
      typeof a === 'string' &&
      ['coral', 'blue', 'gold', 'violet', 'sand', 'emerald', 'rose'].includes(a)
    ) {
      this.accent = a as FeatureAccent;
    } else {
      this.accent = 'coral';
    }
    const h = d['highlights'];
    this.highlights = Array.isArray(h) ? (h as string[]) : [];
    const b = d['blocks'];
    this.blocks = Array.isArray(b) ? (b as FeatureBlock[]) : [];

    const cat = d['catalog'];
    this.catalog = cat === 'products' ? 'products' : 'none';
    if (this.catalog === 'products') {
      this.loadCatalogProducts();
    } else {
      this.catalogProducts = [];
      this.catalogError = null;
    }
  }

  private loadCatalogProducts(): void {
    this.catalogLoading = true;
    this.catalogError = null;
    const primary = `${API_BASE_URL}/api/products` as string;
    const fallback = `${API_FALLBACK_ORIGIN}/api/products`;
    const tryFallback = API_BASE_URL === '';
    this.http.get<CatalogProduct[]>(primary).subscribe({
      next: (list) => {
        this.catalogProducts = list ?? [];
        this.catalogLoading = false;
      },
      error: () => {
        if (tryFallback) {
          this.http.get<CatalogProduct[]>(fallback).subscribe({
            next: (list) => {
              this.catalogProducts = list ?? [];
              this.catalogLoading = false;
            },
            error: () => {
              this.catalogError =
                'Impossible de charger le catalogue. Lancez le backend (port 8081) et utilisez « ng serve » avec le proxy.';
              this.catalogLoading = false;
            },
          });
        } else {
          this.catalogError =
            'Impossible de charger le catalogue. Vérifiez que le backend tourne sur le port 8081.';
          this.catalogLoading = false;
        }
      },
    });
  }

  productImageSrc(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null || Number.isNaN(Number(p))) return '—';
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
    }).format(Number(p));
  }

  addToCart(p: CatalogProduct): void {
    this.cartToast.set(null);
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    const stock = p.stock ?? 0;
    if (stock <= 0) {
      this.cartToast.set('Ce produit n’est pas disponible (stock).');
      return;
    }
    this.addingProductId.set(p.productId);
    this.shop.addToCart(p.productId, 1).subscribe({
      next: () => {
        this.addingProductId.set(null);
        this.shop.refreshCartCount();
        this.cartToast.set('Ajouté au panier.');
        setTimeout(() => this.cartToast.set(null), 2500);
      },
      error: () => {
        this.addingProductId.set(null);
        this.cartToast.set('Impossible d’ajouter au panier (stock ou connexion).');
      },
    });
  }
}
