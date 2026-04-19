import { Component, OnInit, inject, signal, computed, HostListener, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from './core/services/language.service';
import { CurrencyService } from './core/services/currency.service';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Data, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { extractApiErrorMessage } from './api-error.util';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './core/api-url';
import { AuthService } from './core/auth.service';
import { ShopService } from './core/shop.service';
import { EventService } from './event.service';
import { Event as TravelEvent } from './models/event';
import { NotificationService } from './core/notification.service';
import { LoginRequiredPromptService } from './core/login-required-prompt.service';
import { DialogModule } from 'primeng/dialog';
import { GalleriaModule } from 'primeng/galleria';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import Swal from 'sweetalert2';

export interface FeatureBlock {
  /** Legacy: plain title when not using i18n */
  title?: string;
  /** i18n key for title (e.g. FEATURE.ARTISANAT_BLOCKS.B1.TITLE) */
  titleKey?: string;
  items?: string[];
  /** i18n keys for bullet items */
  itemKeys?: string[];
  icon?: string;
}

export type FeatureAccent = 'coral' | 'blue' | 'gold' | 'violet' | 'sand' | 'emerald' | 'rose';

export interface CatalogProduct {
  productId: number;
  name: string;
  description?: string | null;
  category?: string | null;
  status?: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED';
  imageUrl?: string | null;
  images?: { id: number; url: string; imageUrl?: string }[];
  variants?: { variantId?: number; id?: number; size: string; color: string; stock: number; priceOverride?: number }[];
  price?: number | null;
  stock?: number | null;
  user?: { username?: string | null; cityName?: string | null };
  isFavorite?: boolean;
}

@Component({
  selector: 'app-feature-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    TranslateModule,
    DialogModule,
    GalleriaModule,
    ButtonModule,
    CarouselModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './feature-page.component.html',
  styleUrl: './feature-page.component.css',
})
export class FeaturePageComponent implements OnInit {
  private readonly aiGeneratedImageStorageKey = 'eventManagement.aiGeneratedImages';
  private route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private http = inject(HttpClient);
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly eventService = inject(EventService);
  private readonly notifier = inject(NotificationService);
  private readonly loginPrompt = inject(LoginRequiredPromptService);
  private readonly currency = inject(CurrencyService);

  kicker = '';
  title = '';
  description = '';
  /** Route `data.i18n` id (e.g. DESTINATIONS) → keys under FEATURE.{id}.* */
  private featureI18nId: string | null = null;
  accent: FeatureAccent = 'coral';
  highlights: string[] = [];
  blocks: FeatureBlock[] = [];
  events: TravelEvent[] = [];
  eventFilterCity = 'ALL';
  eventFilterType = 'ALL';
  eventMaxPriceCap = 500;
  eventMaxPrice = 500;
  eventCityDropdownOpen = false;
  eventCitySearch = '';
  isEventFeed = false;
  isLoadingEvents = false;
  eventsLoadError: string | null = null;
  selectedEvent: TravelEvent | null = null;
  readonly eventJoinLoading = signal(false);
  readonly eventJoinError = signal<string | null>(null);

  catalog: 'none' | 'products' = 'none';
  catalogProducts = signal<CatalogProduct[]>([]);
  catalogLoading = signal(false);
  catalogError = signal<string | null>(null);

  searchQuery = signal('');
  selectedCategory = signal<string | null>(null);
  selectedCityId = signal<number | null>(null);
  cities = signal<any[]>([]);

  readonly catalogImageFailed = signal<Set<number>>(new Set());

  readonly filteredCatalogProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    return this.catalogProducts().filter(p => {
      const matchQuery = !query
        || p.name.toLowerCase().includes(query)
        || (p.description?.toLowerCase().includes(query) ?? false)
        || (p.user?.username?.toLowerCase().includes(query) ?? false);
      const matchCat = !cat || cat === 'null' || p.category === cat;
      return matchQuery && matchCat;
    });
  });

  readonly filteredArtisanProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    return this.artisanProducts().filter(p => {
      const matchQuery = !query
        || p.name.toLowerCase().includes(query)
        || (p.description?.toLowerCase().includes(query) ?? false);
      const matchCat = !cat || cat === 'null' || p.category === cat;
      return matchQuery && matchCat;
    });
  });

  readonly isArtisan = computed(() => {
    return this.auth.hasRole('ROLE_ARTISAN');
  });

  readonly showProductForm = signal(false);
  readonly artisanProducts = signal<CatalogProduct[]>([]);
  readonly artisanProductsLoading = signal(false);
  readonly artisanProductsError = signal<string | null>(null);
  readonly autoDescriptionLoading = signal(false);
  readonly autoDescriptionError = signal<string | null>(null);

  readonly newProduct = signal<Partial<CatalogProduct>>({
    name: '',
    description: '',
    category: '',
    price: null,
    stock: null,
    imageUrl: '',
    status: 'PENDING',
    variants: [],
    images: [],
  });
  readonly editingProductId = signal<number | null>(null);
  readonly addingProductId = signal<number | null>(null);
  readonly submittingProduct = signal<boolean>(false);

  readonly selectedVariantId = signal<Record<number, number>>({});

  /** Detail modal: pick color first, then size (TEXTILE). */
  readonly detailSelectedColor = signal<string | null>(null);
  readonly detailSelectedSize = signal<string | null>(null);

  /** Stable label for variant color (empty → em dash). */
  private colorLabel(v: { color?: string | null }): string {
    return (v.color ?? '').trim() || '—';
  }

  /** Unique in-stock colors for variant pickers (TEXTILE). */
  distinctColorsInStock(p: CatalogProduct): string[] {
    if (!p.variants?.length) return [];
    const set = new Set<string>();
    for (const v of p.variants) {
      if ((v.stock ?? 0) > 0) {
        set.add(this.colorLabel(v));
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'en'));
  }

  /** Sizes available for the selected color. */
  sizesForSelectedColor(p: CatalogProduct): string[] {
    const color = this.detailSelectedColor();
    if (!p.variants?.length || color == null) return [];
    const target = (color ?? '').trim() || '—';
    const set = new Set<string>();
    for (const v of p.variants) {
      if ((v.stock ?? 0) > 0 && this.colorLabel(v) === target) {
        set.add((v.size ?? '').trim() || '—');
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'en'));
  }

  /** Read-only lists for artisan detail modal. */
  distinctSizesInStock(p: CatalogProduct): string[] {
    if (!p.variants?.length) return [];
    const set = new Set<string>();
    for (const v of p.variants) {
      if ((v.stock ?? 0) > 0) {
        set.add((v.size ?? '').trim() || '—');
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'en'));
  }

  onDetailColorSelect(p: CatalogProduct, color: string | null): void {
    this.detailSelectedColor.set(color);
    this.detailSelectedSize.set(null);
    this.selectedVariantId.update((m) => {
      const c = { ...m };
      delete c[p.productId];
      return c;
    });
    if (color == null) return;
    const sizes = this.sizesForSelectedColor(p);
    if (sizes.length === 1) {
      this.detailSelectedSize.set(sizes[0]);
      this.applyVariantFromColorSize(p, color, sizes[0]);
    }
  }

  onDetailSizeSelect(p: CatalogProduct, size: string | null): void {
    this.detailSelectedSize.set(size);
    const color = this.detailSelectedColor();
    if (!color || !size) {
      this.selectedVariantId.update((m) => {
        const c = { ...m };
        delete c[p.productId];
        return c;
      });
      return;
    }
    this.applyVariantFromColorSize(p, color, size);
  }

  private applyVariantFromColorSize(p: CatalogProduct, color: string, size: string): void {
    const colorTarget = (color ?? '').trim() || '—';
    const sz = (size ?? '').trim() || '—';
    const match = p.variants!.find(
      (v) =>
        (v.stock ?? 0) > 0 &&
        this.colorLabel(v) === colorTarget &&
        ((v.size ?? '').trim() || '—') === sz
    );
    if (match) {
      this.onVariantChange(p.productId, this.variantIdOf(match));
    }
  }

  onVariantChange(productId: number, variantId: number): void {
    const vid = Number(variantId);
    if (Number.isNaN(vid)) return;
    this.selectedVariantId.update((v) => ({ ...v, [productId]: vid }));
  }

  /** API envoie `variantId` ; anciennes réponses pouvaient utiliser `id`. */
  variantIdOf(v: { variantId?: number; id?: number }): number {
    const n = v.variantId ?? v.id;
    return Number(n);
  }

  // Product Details Modal
  readonly showProductDetails = signal(false);
  readonly selectedItem = signal<CatalogProduct | null>(null);
  detailImageIndex = 0;

  openProductDetails(p: CatalogProduct): void {
    this.detailSelectedColor.set(null);
    this.detailSelectedSize.set(null);
    this.detailImageIndex = 0;
    this.selectedItem.set(p);
    this.showProductDetails.set(true);
    this.maybePreselectVariant(p);
  }

  /** PrimeNG dialog visibility — keep signal + cleanup in sync when the dialog closes. */
  onDetailVisibleChange(visible: boolean): void {
    if (visible) {
      this.showProductDetails.set(true);
    } else {
      this.closeProductDetails();
    }
  }

  /** If Textile with a single in-stock variant, select it; else auto-fill color/size when unique. */
  private maybePreselectVariant(p: CatalogProduct): void {
    if (p.category !== 'TEXTILE' || !p.variants?.length) return;
    const inStock = p.variants.filter((v) => (v.stock ?? 0) > 0);
    if (inStock.length === 1) {
      const v0 = inStock[0];
      this.detailSelectedColor.set(this.colorLabel(v0));
      this.detailSelectedSize.set((v0.size ?? '').trim() || '—');
      this.onVariantChange(p.productId, this.variantIdOf(v0));
      return;
    }
    const colors = this.distinctColorsInStock(p);
    if (colors.length === 1) {
      this.detailSelectedColor.set(colors[0]);
      const sizes = this.sizesForSelectedColor(p);
      if (sizes.length === 1) {
        this.detailSelectedSize.set(sizes[0]);
        this.applyVariantFromColorSize(p, colors[0], sizes[0]);
      }
    }
  }

  closeProductDetails(): void {
    this.showProductDetails.set(false);
    this.detailImageIndex = 0;
    this.detailSelectedColor.set(null);
    this.detailSelectedSize.set(null);
    const item = this.selectedItem();
    if (item) {
      this.selectedVariantId.update(v => {
        const copy = { ...v };
        delete copy[item.productId];
        return copy;
      });
    }
    this.selectedItem.set(null);
  }

  detailImagePrev(p: CatalogProduct): void {
    const n = this.getGalleryImages(p).length;
    if (n <= 1) return;
    this.detailImageIndex = (this.detailImageIndex - 1 + n) % n;
  }

  detailImageNext(p: CatalogProduct): void {
    const n = this.getGalleryImages(p).length;
    if (n <= 1) return;
    this.detailImageIndex = (this.detailImageIndex + 1) % n;
  }

  onCityChange(id: any): void {
    const val = id === 'null' || id === null ? null : Number(id);
    this.selectedCityId.set(val);
    this.loadProducts();
  }

  // Image upload
  readonly selectedFiles = signal<File[]>([]);
  readonly previewUrls = signal<string[]>([]);
  readonly isUploadingImage = signal(false);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.featureI18nId) {
        this.applyI18nHeadings();
      }
    });
    this.applyData(this.route.snapshot.data);
    this.route.data.subscribe((d) => this.applyData(d));
    if (this.isArtisan()) {
      this.loadArtisanProducts();
    }
  }

  private applyI18nHeadings(): void {
    const id = this.featureI18nId;
    if (!id) {
      return;
    }
    const base = `FEATURE.${id}`;
    this.kicker = String(this.translate.instant(`${base}.KICKER`));
    this.title = String(this.translate.instant(`${base}.TITLE`));
    this.description = String(this.translate.instant(`${base}.DESC`));
  }

  private applyData(d: Data): void {
    const i18nId = d['i18n'];
    if (typeof i18nId === 'string' && i18nId.length > 0) {
      this.featureI18nId = i18nId;
      this.applyI18nHeadings();
    } else {
      this.featureI18nId = null;
      this.kicker = String(d['kicker'] ?? 'Module');
      this.title = String(d['title'] ?? '');
      this.description = String(d['description'] ?? '');
    }
    const a = d['accent'];
    if (typeof a === 'string' && ['coral', 'blue', 'gold', 'violet', 'sand', 'emerald', 'rose'].includes(a)) {
      this.accent = a as FeatureAccent;
    } else {
      this.accent = 'coral';
    }
    const b = d['blocks'];
    this.blocks = Array.isArray(b) ? (b as FeatureBlock[]) : [];
    const cat = d['catalog'];
    this.catalog = cat === 'products' ? 'products' : 'none';
    if (this.catalog === 'products') {
      this.loadProducts();
      this.loadCities();
    } else {
      this.catalogProducts.set([]);
      this.catalogError.set(null);
    }

    const shouldLoadEvents = d['eventFeed'] === true || this.title === 'Events';
    this.isEventFeed = shouldLoadEvents;
    if (shouldLoadEvents) {
      this.loadCities();
      this.loadEvents();
    } else {
      this.events = [];
      this.isLoadingEvents = false;
      this.eventsLoadError = null;
      this.selectedEvent = null;
    }
  }

  loadCities(): void {
    this.http.get<any>('/api/public/cities/all').subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.data ?? res?.content ?? [];
        this.cities.set(list);
      },
      error: () => {
        this.cities.set([]);
      },
    });
  }

  loadProducts(): void {
    this.catalogLoading.set(true);
    this.catalogError.set(null);
    const cityId = this.selectedCityId();
    const lang = this.language.currentLang();
    const langParam = `lang=${encodeURIComponent(lang)}`;
    let primary = `${API_BASE_URL}/api/products?${langParam}`;
    if (cityId) primary += `&cityId=${cityId}`;
    const fallback = `${API_FALLBACK_ORIGIN}/api/products?${langParam}${cityId ? `&cityId=${cityId}` : ''}`;
    const tryFallback = API_BASE_URL === '';

    this.http.get<CatalogProduct[]>(primary).subscribe({
      next: (list) => {
        this.catalogProducts.set(list ?? []);
        this.catalogLoading.set(false);
        this.catalogImageFailed.set(new Set());
      },
      error: () => {
        if (tryFallback) {
          this.http.get<CatalogProduct[]>(fallback).subscribe({
            next: (list) => {
              this.catalogProducts.set(list ?? []);
              this.catalogLoading.set(false);
              this.catalogImageFailed.set(new Set());
            },
            error: () => {
              this.catalogError.set('Could not load the catalog. Start the backend (default port 9091) and run `ng serve` with the Angular proxy.');
              this.catalogLoading.set(false);
            },
          });
        } else {
          this.catalogError.set('Could not load the catalog. Check that the backend is running (e.g. port 9091) and that the Angular proxy is configured.');
          this.catalogLoading.set(false);
        }
      },
    });
  }

  catalogImageUrl(url: string | null | undefined): string {
    if (url == null) return '';
    let t = String(url).trim();
    if (!t) return '';
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    if (t.startsWith('//')) return `https:${t}`;
    t = t.replace(/\\/g, '/');
    if (t.startsWith('/')) return t;
    if (t.startsWith('uploads/')) return `/${t}`;
    return `/${t}`;
  }

  onCatalogImageError(productId: number): void {
    this.catalogImageFailed.update((prev) => new Set(prev).add(productId));
  }

  showCatalogImage(p: CatalogProduct): boolean {
    return !!(p.imageUrl && !this.catalogImageFailed().has(p.productId));
  }

  formatPrice(p: number | null | undefined): string {
    if (p == null || Number.isNaN(Number(p))) {
      return this.translate.instant('FEATURE_CATALOG.PRICE_DASH');
    }
    const lang = this.language.currentLang();
    const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
    }).format(Number(p));
  }

  /** Build the gallery array for p-galleria from a product */
  getGalleryImages(p: CatalogProduct): { url: string }[] {
    if (p.images && p.images.length > 0) {
      return p.images.map(img => ({ url: img.url || img.imageUrl || '' }));
    }
    return [{ url: p.imageUrl || '' }];
  }

  readonly needsVariantChoice = (p: CatalogProduct): boolean =>
    p.category === 'TEXTILE' && !!(p.variants && p.variants.length > 0);

  /** Carte catalogue : ouvrir la fiche si une variante Textile est requise. */
  onCatalogCardBuy(p: CatalogProduct, event: Event): void {
    event.stopPropagation();
    if (this.needsVariantChoice(p)) {
      this.openProductDetails(p);
      return;
    }
    this.addToCart(p);
  }

  addToCart(p: CatalogProduct): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/signin'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const varId = this.selectedVariantId()[p.productId];
    if (this.needsVariantChoice(p) && !varId) {
      this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_SELECT_VARIANTS'), 'info');
      return;
    }
    if (!this.needsVariantChoice(p)) {
      const stock = p.stock ?? 0;
      if (stock <= 0) {
        this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_UNAVAILABLE'), 'error');
        return;
      }
    }
    this.addingProductId.set(p.productId);
    this.shop.addToCart(p.productId, 1, varId).subscribe({
      next: () => {
        this.addingProductId.set(null);
        this.shop.refreshCartCount();
        this.notifier.show(
          this.translate.instant('FEATURE_CATALOG.NOTIF_ADDED_CART', { name: p.name }),
          'success'
        );
      },
      error: () => {
        this.addingProductId.set(null);
        this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_CART_FAIL'), 'error');
      },
    });
  }

  toggleFavorite(p: CatalogProduct, event?: Event): void {
    event?.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/signin'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.http.post<any>(`${API_BASE_URL}/api/favorites/toggle/${p.productId}`, {}).subscribe({
      next: (res) => { p.isFavorite = res.isFavorite; },
      error: () => { }
    });
  }

  private loadArtisanProducts(): void {
    this.artisanProductsLoading.set(true);
    this.artisanProductsError.set(null);
    const langQ = `lang=${encodeURIComponent(this.language.currentLang())}`;
    this.http.get<CatalogProduct[]>(`${API_BASE_URL}/api/products/my-products?${langQ}`).subscribe({
      next: (list) => {
        this.artisanProducts.set(list ?? []);
        this.artisanProductsLoading.set(false);
      },
      error: () => {
        const fallback = `${API_FALLBACK_ORIGIN}/api/products/my-products?${langQ}`;
        const tryFallback = API_BASE_URL === '';
        if (tryFallback) {
          this.http.get<CatalogProduct[]>(fallback).subscribe({
            next: (list) => {
              this.artisanProducts.set(list ?? []);
              this.artisanProductsLoading.set(false);
            },
            error: () => {
              this.artisanProductsError.set('FEATURE_CATALOG.ERR_ARTISAN_PRODUCTS');
              this.artisanProductsLoading.set(false);
            },
          });
        } else {
          this.artisanProductsError.set('FEATURE_CATALOG.ERR_ARTISAN_PRODUCTS');
          this.artisanProductsLoading.set(false);
        }
      },
    });
  }

  openProductForm(): void {
    this.editingProductId.set(null);
    this.showProductForm.set(true);
    this.newProduct.set({
      productId: 0, name: '', description: '', category: '',
      price: null, stock: null, imageUrl: '', status: 'PENDING',
      variants: [], images: []
    });
    this.clearFilesSelection();
  }

  editProduct(p: CatalogProduct, event?: Event): void {
    event?.stopPropagation();
    this.editingProductId.set(p.productId);
    this.showProductForm.set(true);
    this.newProduct.set({
      productId: p.productId, name: p.name, description: p.description,
      category: p.category, price: p.price, stock: p.stock,
      imageUrl: p.imageUrl, status: p.status,
      variants: p.variants ? [...p.variants] : [],
      images: p.images ? [...p.images] : []
    });
    this.previewUrls.set(p.imageUrl ? [this.catalogImageUrl(p.imageUrl)] : []);
  }

  closeProductForm(): void {
    this.showProductForm.set(false);
    this.clearFilesSelection();
  }

  addVariant(): void {
    const p = this.newProduct();
    if (!p.variants) p.variants = [];
    p.variants.push({ variantId: 0, size: '', color: '', stock: 0 });
    this.newProduct.set({ ...p });
  }

  removeVariant(index: number): void {
    const p = this.newProduct();
    if (p.variants) {
      p.variants.splice(index, 1);
      this.newProduct.set({ ...p });
    }
  }

  onFilesSelected(event: any): void {
    const files = Array.from(event.target.files as FileList);
    if (files.length) {
      this.selectedFiles.set(files);
      const urls: string[] = [];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          urls.push(e.target.result);
          this.previewUrls.set([...urls]);
        };
        reader.readAsDataURL(file);
      });

      if (!this.newProduct().description?.trim()) {
        this.autoFillDescriptionFromFile(files[0]);
      }
    }
  }

  private autoFillDescriptionFromFile(file: File): void {
    if (!file || this.autoDescriptionLoading()) {
      return;
    }

    this.autoDescriptionError.set(null);
    this.autoDescriptionLoading.set(true);

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ description?: string; error?: string }>(`${API_BASE_URL}/api/products/describe-image`, formData).subscribe({
      next: (response) => {
        this.autoDescriptionLoading.set(false);
        const description = response?.description?.trim();
        if (description && !this.newProduct().description?.trim()) {
          this.newProduct.set({ ...this.newProduct(), description });
        }
        if (response?.error) {
          this.autoDescriptionError.set(response.error);
        }
      },
      error: (err: any) => {
        this.autoDescriptionLoading.set(false);
        this.autoDescriptionError.set(err?.error?.error || 'Could not auto-fill description from the photo.');
      },
    });
  }

  clearFilesSelection(): void {
    this.selectedFiles.set([]);
    this.previewUrls.set([]);
  }

  submitProduct(): void {
    const p = this.newProduct();
    if (!p.name?.trim()) return;
    this.submittingProduct.set(true);

    const files = this.selectedFiles();
    if (files.length > 0) {
      this.isUploadingImage.set(true);
      const uploads = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ imageUrl: string }>(`${API_BASE_URL}/api/products/upload-image`, formData);
      });
      forkJoin(uploads).subscribe({
        next: (results) => {
          if (results.length > 0) {
            p.imageUrl = results[0].imageUrl;
            // Send as imageUrl — backend ProductImage field is "imageUrl"
            p.images = results.map(r => ({ id: 0, url: r.imageUrl, imageUrl: r.imageUrl }));
          }
          this.persistProduct(p);
        },
        error: () => {
          this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_UPLOAD_ERR'), 'error');
          this.isUploadingImage.set(false);
          this.submittingProduct.set(false);
        }
      });
    } else {
      this.persistProduct(p);
    }
  }

  private persistProduct(product: Partial<CatalogProduct>): void {
    const editId = this.editingProductId();
    const url = editId
      ? `${API_BASE_URL}/api/products/${editId}`
      : `${API_BASE_URL}/api/products`;
    const req = editId
      ? this.http.put<CatalogProduct>(url, product)
      : this.http.post<CatalogProduct>(url, product);

    req.subscribe({
      next: (saved) => {
        this.isUploadingImage.set(false);
        this.afterProductSaved(saved, !!editId);
      },
      error: (err) => {
        this.isUploadingImage.set(false);
        this.submittingProduct.set(false);
        const msg =
          err?.error?.error ?? this.translate.instant('FEATURE_CATALOG.NOTIF_SAVE_FAIL');
        this.notifier.show(`✕ ${msg}`, 'error');
      }
    });
  }

  private afterProductSaved(prod: CatalogProduct, isEdit: boolean): void {
    if (isEdit) {
      this.artisanProducts.update(list => list.map(p => p.productId === prod.productId ? prod : p));
      this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_PRODUCT_UPDATED'), 'success');
    } else {
      this.artisanProducts.update(list => [prod, ...list]);
      this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_PRODUCT_ADDED'), 'success');
    }
    this.submittingProduct.set(false);
    this.closeProductForm();
  }

  deleteProduct(productId: number, event?: Event): void {
    event?.stopPropagation();
    if (!confirm(this.translate.instant('FEATURE_CATALOG.CONFIRM_DELETE_PRODUCT'))) {
      return;
    }

    const primary = `${API_BASE_URL}/api/products/${productId}`;
    const fallback = `${API_FALLBACK_ORIGIN}/api/products/${productId}`;
    const tryFallback = API_BASE_URL === '';

    const onDeleted = () => {
      this.artisanProducts.update((products) => products.filter((p) => p.productId !== productId));
      this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_PRODUCT_DELETED'), 'success');
    };

    this.http.delete(primary).subscribe({
      next: onDeleted,
      error: () => {
        if (tryFallback) {
          this.http.delete(fallback).subscribe({
            next: onDeleted,
            error: () =>
              this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_DELETE_FAIL'), 'error'),
          });
        } else {
          this.notifier.show(this.translate.instant('FEATURE_CATALOG.NOTIF_DELETE_FAIL'), 'error');
        }
      },
    });
  }

  private loadEvents(): void {
    this.isLoadingEvents = true;
    this.eventsLoadError = null;
    this.eventService.getEvents().subscribe({
      next: (events) => {
        this.events = events.map((event) => ({
          ...event,
          status: this.normalizeEventStatus(event.status),
          imageUrl: this.normalizeEventImageUrl(event.imageUrl),
        })).filter((event) => this.shouldDisplayInFrontOffice(event.status));
        this.resetEventFilters();
        this.isLoadingEvents = false;
      },
      error: (err) => {
        console.error('Error loading events:', err);
        this.eventsLoadError = 'Could not load events right now.';
        this.isLoadingEvents = false;
      }
    });
  }

  private normalizeEventStatus(status: unknown): string {
    const normalized = String(status ?? '').trim();
    if (!normalized) {
      return 'UPCOMING';
    }
    const upper = normalized.toUpperCase();
    const compact = upper.replace(/[^A-Z]/g, '');

    if (compact === 'UPCOMING' || compact === 'ONGOING' || compact === 'COMPLETED') {
      return compact;
    }

    // Accept common typos coming from legacy/admin inputs.
    if (compact === 'COMPELETED' || compact === 'COMPELETD' || compact === 'COMPLETED' || compact === 'COMPLETEDD') {
      return 'COMPLETED';
    }

    return upper;
  }

  private shouldDisplayInFrontOffice(status: unknown): boolean {
    const normalized = this.normalizeEventStatus(status);
    return normalized === 'UPCOMING' || normalized === 'ONGOING';
  }

  toEventCityLabel(event: TravelEvent): string {
    const fromCity = event.city?.name?.trim();
    if (fromCity) {
      return fromCity;
    }
    const venue = String(event.venue ?? '').trim();
    if (!venue) {
      return 'Unknown';
    }
    const firstChunk = venue.split(',')[0]?.trim();
    return firstChunk || venue;
  }

  get eventCityOptions(): string[] {
    const allCities = this.cities().map((c) => String(c?.name ?? '').trim()).filter((v) => !!v);
    if (allCities.length > 0) {
      return [...new Set(allCities)].sort((a, b) => a.localeCompare(b));
    }
    return [...new Set(this.events.map((event) => this.toEventCityLabel(event)).filter((v) => !!v))]
      .sort((a, b) => a.localeCompare(b));
  }

  get eventTypeOptions(): string[] {
    return [...new Set(this.events.map((event) => String(event.eventType ?? '').trim()).filter((v) => !!v))]
      .sort((a, b) => a.localeCompare(b));
  }

  get filteredEventCityOptions(): string[] {
    const query = this.eventCitySearch.trim().toLowerCase();
    if (!query) {
      return this.eventCityOptions;
    }
    return this.eventCityOptions.filter((city) => city.toLowerCase().includes(query));
  }

  get selectedEventCityLabel(): string {
    return this.eventFilterCity === 'ALL' ? 'All cities' : this.eventFilterCity;
  }

  toggleEventCityDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.eventCityDropdownOpen = !this.eventCityDropdownOpen;
  }

  selectEventCity(city: string): void {
    this.eventFilterCity = city;
    this.eventCityDropdownOpen = false;
    this.eventCitySearch = '';
  }

  onEventCityPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  @HostListener('document:click')
  closeEventCityDropdown(): void {
    this.eventCityDropdownOpen = false;
  }

  get filteredEvents(): TravelEvent[] {
    return this.events.filter((event) => {
      const cityOk = this.eventFilterCity === 'ALL' || this.toEventCityLabel(event) === this.eventFilterCity;
      const typeOk = this.eventFilterType === 'ALL' || String(event.eventType ?? '').trim() === this.eventFilterType;
      const price = this.eventPriceAmount(event);
      const budgetOk = price <= this.eventMaxPrice;
      return cityOk && typeOk && budgetOk;
    });
  }

  get activeEventFilterCount(): number {
    let count = 0;
    if (this.eventFilterCity !== 'ALL') {
      count += 1;
    }
    if (this.eventFilterType !== 'ALL') {
      count += 1;
    }
    if (this.eventMaxPrice < this.eventMaxPriceCap) {
      count += 1;
    }
    return count;
  }

  get activeEventFilterTokens(): string[] {
    const tokens: string[] = [];
    if (this.eventFilterCity !== 'ALL') {
      tokens.push(`City: ${this.eventFilterCity}`);
    }
    if (this.eventFilterType !== 'ALL') {
      tokens.push(`Type: ${this.eventFilterType}`);
    }
    if (this.eventMaxPrice < this.eventMaxPriceCap) {
      tokens.push(`Budget <= ${Math.round(this.eventMaxPrice)} TND`);
    }
    return tokens;
  }

  eventDisplayDatePart(event: TravelEvent): string {
    const raw = String(event.startDate ?? '').trim();
    if (!raw) {
      return 'Date TBA';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    const dateLabel = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Tunis'
    });

    return dateLabel;
  }

  eventDisplayTimePart(event: TravelEvent): string {
    const raw = String(event.startDate ?? '').trim();
    if (!raw) {
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    if (!this.hasExplicitTime(raw)) {
      return 'Time TBA';
    }

    const timeLabel = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Tunis'
    });

    return timeLabel;
  }

  eventDisplayDateTimeLine(event: TravelEvent): string {
    const datePart = this.eventDisplayDatePart(event);
    const timePart = this.eventDisplayTimePart(event);
    if (!timePart) {
      return datePart;
    }
    return `${datePart} • ${timePart}`;
  }

  eventDetailDateTimeLabel(event: TravelEvent | null): string {
    const raw = String(event?.startDate ?? '').trim();
    if (!raw) {
      return 'Date TBA';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    const dateLabel = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Tunis'
    });

    if (!this.hasExplicitTime(raw)) {
      return `${dateLabel} • Time TBA`;
    }

    const timeLabel = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Tunis'
    });

    return `${dateLabel} • ${timeLabel}`;
  }

  isAiGeneratedPoster(event: TravelEvent | null): boolean {
    const normalized = this.normalizePosterImageUrl(event?.imageUrl);
    if (!normalized) {
      return false;
    }

    if (/-poster(?:\.|$)/i.test(normalized)) {
      return true;
    }

    return this.getStoredAiGeneratedImages().has(normalized);
  }

  eventPosterDateRange(event: TravelEvent | null): string {
    const start = this.formatPosterDisplayDate(event?.startDate);
    const end = this.formatPosterDisplayDate(event?.endDate);
    if (!start && !end) {
      return 'Date TBA';
    }
    if (!end || start === end) {
      return start || end;
    }
    return `${start} - ${end}`;
  }

  eventPosterTimeRange(event: TravelEvent | null): string {
    const start = this.formatPosterDisplayTime(event?.startDate);
    const end = this.formatPosterDisplayTime(event?.endDate);
    if (!start && !end) {
      return '';
    }
    if (!end || start === end) {
      return start || end;
    }
    return `${start} - ${end}`;
  }

  private formatPosterDisplayDate(value: string | undefined): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatPosterDisplayTime(value: string | undefined): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }
    if (!this.hasExplicitTime(raw)) {
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Tunis'
    });
  }

  private hasExplicitTime(raw: string): boolean {
    return /T\d{2}:\d{2}/.test(raw);
  }

  private getStoredAiGeneratedImages(): Set<string> {
    try {
      const raw = localStorage.getItem(this.aiGeneratedImageStorageKey);
      if (!raw) {
        return new Set<string>();
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return new Set<string>();
      }

      const normalized = parsed
        .map((value) => this.normalizePosterImageUrl(value))
        .filter((value): value is string => !!value);
      return new Set<string>(normalized);
    } catch {
      return new Set<string>();
    }
  }

  private normalizePosterImageUrl(url: unknown): string {
    return String(url ?? '').trim();
  }

  eventStatusClass(status: unknown): string {
    const normalized = this.normalizeEventStatus(status);
    if (normalized === 'ONGOING') {
      return 'event-status-badge--ongoing';
    }
    return 'event-status-badge--upcoming';
  }

  resetEventFilters(): void {
    const maxDetected = this.events.reduce((max, event) => Math.max(max, this.eventPriceAmount(event)), 0);
    const normalizedCap = Math.max(500, Math.ceil(maxDetected / 50) * 50);
    this.eventMaxPriceCap = normalizedCap;
    this.eventMaxPrice = normalizedCap;
    this.eventFilterCity = 'ALL';
    this.eventFilterType = 'ALL';
    this.eventCitySearch = '';
    this.eventCityDropdownOpen = false;
  }

  private normalizeEventImageUrl(url: string | undefined): string | undefined {
    if (!url) {
      return undefined;
    }
    const value = String(url).trim();
    if (!value) {
      return undefined;
    }
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
      return value;
    }
    if (value.startsWith('uploads/')) {
      return `/${value}`;
    }
    return `/${value}`;
  }

  selectEvent(event: TravelEvent): void {
    this.selectedEvent = event;
    document.body.classList.add('modal-open');
  }

  closeEventDetails(): void {
    this.selectedEvent = null;
    this.eventJoinError.set(null);
    this.eventJoinLoading.set(false);
    document.body.classList.remove('modal-open');
  }

  /** Normalized ticket price; Stripe checkout only runs when this is &gt; 0. */
  eventPriceAmount(event: TravelEvent): number {
    const raw = event.price as unknown;
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return raw;
    }
    const n = Number.parseFloat(String(raw ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  isPaidEvent(event: TravelEvent | null): boolean {
    return event != null && this.eventPriceAmount(event) > 0;
  }

  joinActionLabel(event: TravelEvent | null): string {
    if (!event) {
      return 'Join Event';
    }
    return this.isPaidEvent(event) ? 'Pay & join' : 'Join free';
  }

  joinLoadingLabel(event: TravelEvent | null): string {
    if (!event) {
      return 'Please wait…';
    }
    return this.isPaidEvent(event) ? 'Opening payment…' : 'Registering…';
  }

  private toJoinUserMessage(err: HttpErrorResponse, fallback: string): string {
    const raw = extractApiErrorMessage(err, fallback);
    const lowered = raw.toLowerCase();
    if (
      lowered.includes('stripe is not configured') ||
      lowered.includes('stripe.api.key') ||
      lowered.includes('stripe_secret_key') ||
      lowered.includes('stripe error')
    ) {
      return 'Online payment is temporarily unavailable. Please try again later.';
    }
    return raw;
  }

  onJoinEvent(event: TravelEvent): void {
    this.eventJoinError.set(null);

    if (!this.auth.isAuthenticated()) {
      this.loginPrompt.show({
        title: 'Sign in to reserve this event',
        message: 'Create an account or sign in to continue with your event reservation.',
        returnUrl: this.router.url,
      });
      return;
    }

    const eventId = event.eventId;
    if (eventId == null) {
      this.eventJoinError.set('This event cannot be booked (missing identifier).');
      return;
    }

    const amount = this.eventPriceAmount(event);

    if (amount > 0) {
      this.eventJoinLoading.set(true);
      this.eventService
        .createCheckoutSession({
          event_id: eventId,
          amount,
          eventName: event.title,
          presentmentCurrency: this.currency.selectedCode(),
        })
        .subscribe({
          next: (res) => {
            this.eventJoinLoading.set(false);
            if (res?.sessionUrl) {
              window.location.href = res.sessionUrl;
              return;
            }
            this.eventJoinError.set('Payment is temporarily unavailable. Please try again later.');
          },
          error: (err: HttpErrorResponse) => {
            this.eventJoinLoading.set(false);
            this.eventJoinError.set(this.toJoinUserMessage(err, 'Could not start payment.'));
          },
        });
      return;
    }

    const reservationData = {
      event_id: eventId,
      total_amount: 0,
      status: 'CONFIRMED',
    };

    this.eventJoinLoading.set(true);
    this.eventService.createReservation(reservationData).subscribe({
      next: (res) => {
        this.eventJoinLoading.set(false);
        const emailSent = res?.emailSent !== false;
        Swal.fire({
          icon: 'success',
          title: "You're registered!",
          text: emailSent
            ? 'Thanks for joining this event. A confirmation email has been sent.'
            : 'Thanks for joining this event. Registration is confirmed, but the email could not be sent now.',
          confirmButtonText: 'Great'
        });
        this.closeEventDetails();
      },
      error: (err: HttpErrorResponse) => {
        this.eventJoinLoading.set(false);
        const apiMessage = extractApiErrorMessage(err, 'Could not complete registration.');
        const providerError = typeof err?.error?.emailError === 'string' ? err.error.emailError.trim() : '';
        this.eventJoinError.set(providerError ? `${apiMessage} (${providerError})` : apiMessage);
      },
    });
  }

  /** ngx-translate key under FEATURE_CATALOG.STATUS_* */
  statusLabelKey(status: string | undefined): string {
    const u = (status ?? 'PENDING').toUpperCase();
    if (u === 'PUBLISHED' || u === 'REJECTED' || u === 'DRAFT' || u === 'PENDING') {
      return `FEATURE_CATALOG.STATUS_${u}`;
    }
    return 'FEATURE_CATALOG.STATUS_PENDING';
  }

  getStatusLabel(status: string | undefined): string {
    return this.translate.instant(this.statusLabelKey(status));
  }

  detailDialogHeader(): string {
    const item = this.selectedItem();
    if (item?.name) {
      return item.name;
    }
    return this.translate.instant('FEATURE_CATALOG.PRODUCT_DETAILS');
  }

  getStatusSeverity(status: string | undefined): string {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'DRAFT':
        return 'warn';
      default:
        return 'info';
    }
  }
}
