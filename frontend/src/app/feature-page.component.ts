import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Data, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './core/api-url';
import { AuthService } from './auth.service';
import { ShopService } from './core/shop.service';
import { NotificationService } from './core/notification.service';

// PrimeNG
import { DialogModule } from 'primeng/dialog';
import { GalleriaModule } from 'primeng/galleria';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

export interface FeatureBlock {
  title: string;
  items: string[];
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
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly notifier = inject(NotificationService);

  kicker = '';
  title = '';
  description = '';
  accent: FeatureAccent = 'coral';
  highlights: string[] = [];
  blocks: FeatureBlock[] = [];

  catalog: 'none' | 'products' = 'none';
  catalogProducts: CatalogProduct[] = [];
  catalogLoading = false;
  catalogError: string | null = null;

  searchQuery = signal('');
  selectedCategory = signal<string | null>(null);
  selectedCityId = signal<number | null>(null);
  cities = signal<any[]>([]);

  readonly catalogImageFailed = signal<Set<number>>(new Set());

  readonly filteredCatalogProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    return this.catalogProducts.filter(p => {
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
    const user = this.auth.currentUser();
    return this.auth.hasRole('ROLE_ARTISAN') || (user?.artisanRequestPending === true);
  });

  readonly showProductForm = signal(false);
  readonly artisanProducts = signal<CatalogProduct[]>([]);
  readonly artisanProductsLoading = signal(false);
  readonly artisanProductsError = signal<string | null>(null);

  readonly newProduct = signal<Partial<CatalogProduct>>({
    name: '',
    description: '',
    category: '',
    price: null,
    stock: null,
    imageUrl: '',
    status: 'PENDING'
  });
  readonly editingProductId = signal<number | null>(null);
  readonly addingProductId = signal<number | null>(null);
  readonly submittingProduct = signal<boolean>(false);

  readonly selectedVariantId = signal<Record<number, number>>({});

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

  openProductDetails(p: CatalogProduct): void {
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

  /** If Textile with a single in-stock variant, select it to simplify add-to-cart. */
  private maybePreselectVariant(p: CatalogProduct): void {
    if (p.category !== 'TEXTILE' || !p.variants?.length) return;
    const inStock = p.variants.filter((v) => v.stock > 0);
    if (inStock.length === 1) {
      this.onVariantChange(p.productId, this.variantIdOf(inStock[0]));
    }
  }

  closeProductDetails(): void {
    this.showProductDetails.set(false);
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
    const data = this.route.snapshot.data;
    this.applyData(data);
    this.route.data.subscribe((d) => this.applyData(d));
    if (this.isArtisan()) {
      this.loadArtisanProducts();
    }
  }

  private applyData(d: Data): void {
    this.kicker = String(d['kicker'] ?? 'Module');
    this.title = String(d['title'] ?? '');
    this.description = String(d['description'] ?? '');
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
      this.catalogProducts = [];
      this.catalogError = null;
    }
  }

  loadCities(): void {
    this.http.get<any>('/api/public/cities/all').subscribe({
      next: res => this.cities.set(res.content || res),
      error: () => { }
    });
  }

  loadProducts(): void {
    this.catalogLoading = true;
    const cityId = this.selectedCityId();
    let primary = `${API_BASE_URL}/api/products`;
    if (cityId) primary += `?cityId=${cityId}`;

    this.http.get<CatalogProduct[]>(primary).subscribe({
      next: (list) => {
        this.catalogProducts = list ?? [];
        this.catalogLoading = false;
        this.catalogImageFailed.set(new Set());
      },
      error: () => {
        this.catalogError = 'Impossible de charger le catalogue. Vérifiez que le backend est actif.';
        this.catalogLoading = false;
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
    if (p == null || Number.isNaN(Number(p))) return '—';
    return new Intl.NumberFormat('fr-TN', {
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
      this.notifier.show('⚠ Veuillez sélectionner une taille/couleur.', 'info');
      return;
    }
    this.addingProductId.set(p.productId);
    this.shop.addToCart(p.productId, 1, varId).subscribe({
      next: () => {
        this.addingProductId.set(null);
        this.shop.refreshCartCount();
        this.notifier.show(`✓ "${p.name}" ajouté au panier !`, 'success');
      },
      error: () => {
        this.addingProductId.set(null);
        this.notifier.show('✕ Impossible d\'ajouter au panier.', 'error');
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
    this.http.get<CatalogProduct[]>(`${API_BASE_URL}/api/products/my-products`).subscribe({
      next: (list) => {
        this.artisanProducts.set(list ?? []);
        this.artisanProductsLoading.set(false);
      },
      error: () => {
        this.artisanProductsError.set('Impossible de charger vos produits.');
        this.artisanProductsLoading.set(false);
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
    p.variants.push({ variantId: 0, size: '', color: '', stock: 0, priceOverride: 0 });
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
    }
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
          this.notifier.show('Erreur lors du transfert des images.', 'error');
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
        const msg = err?.error?.error ?? 'Erreur lors de l\'enregistrement.';
        this.notifier.show(`✕ ${msg}`, 'error');
      }
    });
  }

  private afterProductSaved(prod: CatalogProduct, isEdit: boolean): void {
    if (isEdit) {
      this.artisanProducts.update(list => list.map(p => p.productId === prod.productId ? prod : p));
      this.notifier.show('✓ Produit mis à jour !', 'success');
    } else {
      this.artisanProducts.update(list => [prod, ...list]);
      this.notifier.show('✓ Produit ajouté !', 'success');
    }
    this.submittingProduct.set(false);
    this.closeProductForm();
  }

  deleteProduct(productId: number, event?: Event): void {
    event?.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    this.http.delete(`${API_BASE_URL}/api/products/${productId}`).subscribe({
      next: () => {
        this.artisanProducts.update(products => products.filter(p => p.productId !== productId));
        this.notifier.show('✓ Produit supprimé.', 'success');
      },
      error: () => {
        this.notifier.show('✕ Erreur lors de la suppression.', 'error');
      },
    });
  }

  getStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'PUBLISHED': return 'En ligne';
      case 'REJECTED': return 'Refusé';
      case 'DRAFT': return 'Brouillon';
      default: return 'En attente';
    }
  }

  getStatusSeverity(status: string | undefined): string {
    switch (status) {
      case 'PUBLISHED': return 'success';
      case 'REJECTED': return 'danger';
      case 'DRAFT': return 'warning';
      default: return 'info';
    }
  }
}
