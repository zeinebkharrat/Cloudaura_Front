import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './feature-page.component.html',
  styleUrl: './feature-page.component.css',
})
export class FeaturePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private eventService = inject(EventService);

  kicker = '';
  title = '';
  description = '';
  accent: FeatureAccent = 'coral';
  highlights: string[] = [];
  blocks: FeatureBlock[] = [];
  events: TravelEvent[] = [];
  isLoadingEvents = false;
  selectedEvent: TravelEvent | null = null;
  readonly eventJoinLoading = signal(false);
  readonly eventJoinError = signal<string | null>(null);

  /** Si `'products'`, charge et affiche le catalogue sous les blocs informatifs. */
  catalog: 'none' | 'products' = 'none';
  catalogProducts: CatalogProduct[] = [];
  catalogLoading = false;
  catalogError: string | null = null;
  readonly addingProductId = signal<number | null>(null);
  readonly cartToast = signal<string | null>(null);
  /** IDs produit dont l’image a échoué au chargement (affiche le placeholder). */
  readonly catalogImageFailed = signal<Set<number>>(new Set());

  // Artisan-specific properties
  readonly isArtisan = computed(() => {
    const user = this.auth.currentUser();
    const hasRole = this.auth.hasRole('ROLE_ARTISAN');
    const hasPendingRequest = user?.artisanRequestPending === true;
    return hasRole || hasPendingRequest;
  });
  readonly showProductForm = signal(false);
  readonly artisanProducts = signal<CatalogProduct[]>([]);
  readonly artisanProductsLoading = signal(false);
  readonly artisanProductsError = signal<string | null>(null);
  readonly newProduct = signal<Partial<CatalogProduct>>({
    name: '',
    price: null,
    stock: null,
    imageUrl: ''
  });
  readonly editingProductId = signal<number | null>(null);
  readonly submittingProduct = signal<boolean>(false);
  
  // Image upload state
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly isUploadingImage = signal(false);
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  ngOnInit(): void {
    this.applyData(this.route.snapshot.data);

    this.route.data.subscribe((d) => this.applyData(d));

    // Load artisan products if user is artisan
    if (this.isArtisan()) {
      this.loadArtisanProducts();
    }
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

    if (this.title === 'Events') {
      this.loadEvents();
    } else {
      this.events = [];
      this.isLoadingEvents = false;
      this.selectedEvent = null;
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
        this.catalogImageFailed.set(new Set());
      },
      error: () => {
        if (tryFallback) {
          this.http.get<CatalogProduct[]>(fallback).subscribe({
            next: (list) => {
              this.catalogProducts = list ?? [];
              this.catalogLoading = false;
              this.catalogImageFailed.set(new Set());
            },
            error: () => {
              this.catalogError =
                'Could not load the catalog. Start the backend (default port 9091) and run `ng serve` with the Angular proxy.';
              this.catalogLoading = false;
            },
          });
        } else {
          this.catalogError =
            'Could not load the catalog. Check that the backend is running (e.g. port 9091) and that the Angular proxy is configured.';
          this.catalogLoading = false;
        }
      },
    });
  }

  /**
   * URL affichable pour &lt;img src&gt; : chemins locaux en absolu par rapport au site (proxy /uploads).
   */
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

  addToCart(p: CatalogProduct): void {
    this.cartToast.set(null);
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/signin'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const stock = p.stock ?? 0;
    if (stock <= 0) {
      this.cartToast.set('This product is unavailable (out of stock).');
      return;
    }
    this.addingProductId.set(p.productId);
    this.shop.addToCart(p.productId, 1).subscribe({
      next: () => {
        this.addingProductId.set(null);
        this.shop.refreshCartCount();
        this.cartToast.set('Added to cart.');
        setTimeout(() => this.cartToast.set(null), 2500);
      },
      error: () => {
        this.addingProductId.set(null);
        this.cartToast.set('Could not add to cart (stock or connection issue).');
      },
    });
  }

  // Artisan-specific methods
  private loadArtisanProducts(): void {
    this.artisanProductsLoading.set(true);
    this.artisanProductsError.set(null);
    const primary = `${API_BASE_URL}/api/products/my-products` as string;
    const fallback = `${API_FALLBACK_ORIGIN}/api/products/my-products`;
    const tryFallback = API_BASE_URL === '';
    
    this.http.get<CatalogProduct[]>(primary).subscribe({
      next: (list) => {
        this.artisanProducts.set(list ?? []);
        this.artisanProductsLoading.set(false);
      },
      error: () => {
        if (tryFallback) {
          this.http.get<CatalogProduct[]>(fallback).subscribe({
            next: (list) => {
              this.artisanProducts.set(list ?? []);
              this.artisanProductsLoading.set(false);
            },
            error: () => {
              this.artisanProductsError.set('Could not load your products.');
              this.artisanProductsLoading.set(false);
            },
          });
        } else {
          this.artisanProductsError.set('Could not load your products.');
          this.artisanProductsLoading.set(false);
        }
      },
    });
  }

  openProductForm(): void {
    this.editingProductId.set(null);
    this.showProductForm.set(true);
    this.newProduct.set({
      name: '',
      price: null,
      stock: null,
      imageUrl: ''
    });
  }

  editProduct(p: CatalogProduct): void {
    this.editingProductId.set(p.productId);
    this.showProductForm.set(true);
    this.newProduct.set({
      name: p.name,
      price: p.price,
      stock: p.stock,
      imageUrl: p.imageUrl
    });
    this.previewUrl.set(this.catalogImageUrl(p.imageUrl));
  }

  closeProductForm(): void {
    this.showProductForm.set(false);
    this.clearFileSelection();
  }

  onFileSelected(event: globalThis.Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > this.maxFileSize) {
        this.cartToast.set('File too large (max 10 MB).');
        return;
      }
      this.selectedFile.set(file);
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  clearFileSelection(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
  }

  submitProduct(): void {
    const product = this.newProduct();
    if (!product.name?.trim()) {
      return;
    }

    if (this.selectedFile()) {
      this.isUploadingImage.set(true);
      const formData = new FormData();
      formData.append('file', this.selectedFile()!);
      
      this.http.post<{ imageUrl: string }>(`${API_BASE_URL}/api/products/upload-image`, formData).subscribe({
        next: (res) => {
          this.isUploadingImage.set(false);
          this.persistProduct({ ...product, imageUrl: res.imageUrl });
        },
        error: () => {
          this.isUploadingImage.set(false);
          this.cartToast.set('Error uploading the image.');
        }
      });
    } else {
      this.persistProduct(product);
    }
  }

  private persistProduct(product: Partial<CatalogProduct>): void {
    this.submittingProduct.set(true);
    const editId = this.editingProductId();
    
    if (editId) {
      // MODE EDITION
      const primary = `${API_BASE_URL}/api/products/${editId}` as string;
      const fallback = `${API_FALLBACK_ORIGIN}/api/products/${editId}`;
      const tryFallback = API_BASE_URL === '';

      this.http.put<CatalogProduct>(primary, product).subscribe({
        next: (updated) => this.afterProductSaved(updated, true),
        error: () => {
          if (tryFallback) {
            this.http.put<CatalogProduct>(fallback, product).subscribe({
              next: (updated) => this.afterProductSaved(updated, true),
              error: () => this.handleSaveError()
            });
          } else {
            this.handleSaveError();
          }
        }
      });
    } else {
      // MODE AJOUT
      const primary = `${API_BASE_URL}/api/products` as string;
      const fallback = `${API_FALLBACK_ORIGIN}/api/products`;
      const tryFallback = API_BASE_URL === '';

      this.http.post<CatalogProduct>(primary, product).subscribe({
        next: (newProd) => this.afterProductSaved(newProd, false),
        error: () => {
          if (tryFallback) {
            this.http.post<CatalogProduct>(fallback, product).subscribe({
              next: (newProd) => this.afterProductSaved(newProd, false),
              error: () => this.handleSaveError()
            });
          } else {
            this.handleSaveError();
          }
        },
      });
    }
  }

  private afterProductSaved(prod: CatalogProduct, isEdit: boolean): void {
    if (isEdit) {
      this.artisanProducts.update(list => list.map(p => p.productId === prod.productId ? prod : p));
      this.cartToast.set('Product updated!');
    } else {
      this.artisanProducts.update(list => [prod, ...list]);
      this.cartToast.set('Product added!');
    }
    this.submittingProduct.set(false);
    this.closeProductForm();
    setTimeout(() => this.cartToast.set(null), 3000);
  }

  private handleSaveError(): void {
    this.submittingProduct.set(false);
    this.cartToast.set('Error adding the product.');
    setTimeout(() => this.cartToast.set(null), 3000);
  }

  deleteProduct(productId: number): void {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    const primary = `${API_BASE_URL}/api/products/${productId}` as string;
    const fallback = `${API_FALLBACK_ORIGIN}/api/products/${productId}`;
    const tryFallback = API_BASE_URL === '';

    this.http.delete(primary).subscribe({
      next: () => {
        this.artisanProducts.update(products => products.filter((p: CatalogProduct) => p.productId !== productId));
        this.cartToast.set('Product removed successfully!');
        setTimeout(() => this.cartToast.set(null), 3000);
      },
      error: () => {
        if (tryFallback) {
          this.http.delete(fallback).subscribe({
            next: () => {
              this.artisanProducts.update(products => products.filter((p: CatalogProduct) => p.productId !== productId));
              this.cartToast.set('Product removed successfully!');
              setTimeout(() => this.cartToast.set(null), 3000);
            },
            error: () => {
              this.cartToast.set('Error removing the product.');
              setTimeout(() => this.cartToast.set(null), 3000);
            },
          });
        } else {
          this.cartToast.set('Error removing the product.');
          setTimeout(() => this.cartToast.set(null), 3000);
        }
      },
    });
  }

  private loadEvents(): void {
    this.isLoadingEvents = true;
    this.eventService.getEvents().subscribe({
      next: (events) => {
        this.events = events;
        this.isLoadingEvents = false;
      },
      error: (err) => {
        console.error('Error loading events:', err);
        this.isLoadingEvents = false;
      }
    });
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

  onJoinEvent(event: TravelEvent): void {
    this.eventJoinError.set(null);

    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/signin'], { queryParams: { returnUrl: this.router.url } });
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
        })
        .subscribe({
          next: (res) => {
            this.eventJoinLoading.set(false);
            if (res?.sessionUrl) {
              window.location.href = res.sessionUrl;
              return;
            }
            this.eventJoinError.set('Payment did not return a Stripe checkout link. Check the backend Stripe key.');
          },
          error: (err: HttpErrorResponse) => {
            this.eventJoinLoading.set(false);
            this.eventJoinError.set(extractApiErrorMessage(err, 'Could not start payment.'));
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
        alert(`You're registered! Reservation #${res.event_reservation_id} created.`);
        this.closeEventDetails();
      },
      error: (err: HttpErrorResponse) => {
        this.eventJoinLoading.set(false);
        this.eventJoinError.set(extractApiErrorMessage(err, 'Could not complete registration.'));
      },
    });
  }
}
