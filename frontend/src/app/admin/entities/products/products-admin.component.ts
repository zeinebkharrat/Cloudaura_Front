import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../../../auth.service';
import { API_BASE_URL } from '../../../core/api-url';

@Component({
  selector: 'app-products-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products-admin.component.html',
  styleUrl: './products-admin.component.css',
})
export class ProductsAdminComponent implements OnInit, OnDestroy {
  private readonly apiUrl = `${API_BASE_URL}/api/products`;
  private readonly maxImageSizeBytes = 15 * 1024 * 1024;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Liste complète (API). */
  products: any[] = [];
  loading = false;
  uploading = false;
  error = '';

  q = '';
  sort = 'productId,desc';
  page = 0;
  size = 10;

  showProductModal = false;
  showDetailsModal = false;
  modalError = '';
  detailsProduct: any | null = null;

  editingProductId: number | null = null;
  productForm = {
    name: '',
    description: '',
    imageUrl: '',
    price: '' as string | number,
    stock: '' as string | number,
    category: '' as string,
    status: 'PUBLISHED' as string,
    variants: [] as {
      variantId: number;
      size: string;
      color: string;
      stock: number;
      priceOverride: number | string;
    }[],
    images: [] as { id?: number; url?: string; imageUrl?: string }[],
  };
  /** Nouveaux fichiers locaux (aperçus blob) — uploadés à l’enregistrement. */
  pendingFiles: File[] = [];
  pendingPreviewUrls: string[] = [];

  /** Détail produit : index image affichée dans la galerie. */
  detailImageIndex = 0;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.revokeAllPendingPreviews();
  }

  get filteredSorted(): any[] {
    let list = [...this.products];
    const qq = this.q.trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (p) =>
          (p.name ?? '').toLowerCase().includes(qq) ||
          (p.user?.username ?? '').toLowerCase().includes(qq)
      );
    }
    const [key, dir] = this.sort.split(',');
    const mult = dir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      if (key === 'name') {
        const an = String(a.name ?? '').toLowerCase();
        const bn = String(b.name ?? '').toLowerCase();
        return mult * an.localeCompare(bn, 'fr', { sensitivity: 'base' });
      }
      if (key === 'price') {
        const ap = Number(a.price ?? 0);
        const bp = Number(b.price ?? 0);
        return mult * (ap - bp);
      }
      const aid = Number(a.productId ?? 0);
      const bid = Number(b.productId ?? 0);
      return mult * (aid - bid);
    });
    return list;
  }

  get totalElements(): number {
    return this.filteredSorted.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalElements / this.size));
  }

  get pagedProducts(): any[] {
    const start = this.page * this.size;
    return this.filteredSorted.slice(start, start + this.size);
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (d) => {
        this.products = d ?? [];
        this.loading = false;
        this.clampPage();
      },
      error: () => {
        this.error = 'Could not load products.';
        this.loading = false;
      },
    });
  }

  onSearchInputChange(): void {
    this.page = 0;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.clampPage(), 300);
  }

  sortChanged(): void {
    this.page = 0;
    this.clampPage();
  }

  changeProductPage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
    } else if (!next && this.page > 0) {
      this.page--;
    }
  }

  private clampPage(): void {
    const maxPage = Math.max(0, this.totalPages - 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  openCreateModal(): void {
    this.error = '';
    this.modalError = '';
    this.resetProductForm();
    this.showProductModal = true;
  }

  editProduct(item: any): void {
    this.error = '';
    this.modalError = '';
    this.editingProductId = Number(item.productId);
    this.revokeAllPendingPreviews();
    this.pendingFiles = [];
    const vars = Array.isArray(item.variants) ? item.variants : [];
    const imgs = Array.isArray(item.images) ? item.images : [];
    this.productForm = {
      name: item.name ?? '',
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
      price: item.price ?? '',
      stock: item.stock ?? '',
      category: item.category ?? '',
      status: item.status ?? 'PUBLISHED',
      variants: vars.map((v: any) => ({
        variantId: Number(v.variantId ?? v.id ?? 0),
        size: v.size ?? '',
        color: v.color ?? '',
        stock: Number(v.stock ?? 0),
        priceOverride: v.priceOverride ?? 0,
      })),
      images: imgs.map((img: any) => ({
        id: img.id ?? 0,
        url: img.url || img.imageUrl,
        imageUrl: img.imageUrl || img.url,
      })),
    };
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.resetProductForm();
  }

  private resetProductForm(): void {
    this.editingProductId = null;
    this.revokeAllPendingPreviews();
    this.pendingFiles = [];
    this.productForm = {
      name: '',
      description: '',
      imageUrl: '',
      price: '',
      stock: '',
      category: '',
      status: 'PUBLISHED',
      variants: [],
      images: [],
    };
    this.modalError = '';
  }

  addVariantRow(): void {
    this.productForm.variants.push({
      variantId: 0,
      size: '',
      color: '',
      stock: 0,
      priceOverride: 0,
    });
  }

  removeVariantRow(index: number): void {
    this.productForm.variants.splice(index, 1);
  }

  openDetails(item: any): void {
    this.detailsProduct = item;
    this.detailImageIndex = 0;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsProduct = null;
  }

  onModalOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fp-modal-overlay')) {
      this.closeProductModal();
    }
  }

  onDetailsOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fp-modal-overlay')) {
      this.closeDetailsModal();
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    if (!list?.length) {
      return;
    }
    this.modalError = '';
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (file.size > this.maxImageSizeBytes) {
        this.modalError = 'One or more images exceed 15 MB.';
        continue;
      }
      this.pendingFiles.push(file);
      this.pendingPreviewUrls.push(URL.createObjectURL(file));
    }
    input.value = '';
  }

  removePendingImage(index: number): void {
    const u = this.pendingPreviewUrls[index];
    if (u) {
      URL.revokeObjectURL(u);
    }
    this.pendingPreviewUrls.splice(index, 1);
    this.pendingFiles.splice(index, 1);
  }

  removeExistingImage(index: number): void {
    this.productForm.images.splice(index, 1);
    this.syncPrimaryImageUrlFromImages();
  }

  private syncPrimaryImageUrlFromImages(): void {
    const first = this.productForm.images[0];
    this.productForm.imageUrl = first ? String(first.imageUrl || first.url || '') : '';
  }

  clearFileSelection(inputId = 'productImageInput'): void {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (el) {
      el.value = '';
    }
    this.revokeAllPendingPreviews();
  }

  private revokeAllPendingPreviews(): void {
    for (const u of this.pendingPreviewUrls) {
      URL.revokeObjectURL(u);
    }
    this.pendingPreviewUrls = [];
    this.pendingFiles = [];
  }

  /** URLs déjà enregistrées + fichiers en attente (aperçu). */
  existingImageUrls(): string[] {
    return this.productForm.images
      .map((img) => this.resolveImageUrl(img.imageUrl || img.url))
      .filter((u) => !!u);
  }

  save(): void {
    this.modalError = '';
    const name = String(this.productForm.name ?? '').trim();
    if (!name) {
      this.modalError = 'Product name is required.';
      return;
    }
    if (!String(this.productForm.category ?? '').trim()) {
      this.modalError = 'Category is required.';
      return;
    }

    const existingRaw = this.productForm.images
      .map((img) => String(img.imageUrl || img.url || '').trim())
      .filter((u) => u.length > 0);

    const fallbackUrls =
      existingRaw.length > 0
        ? existingRaw
        : this.productForm.imageUrl
          ? [String(this.productForm.imageUrl).trim()]
          : [];

    if (this.pendingFiles.length > 0) {
      this.uploading = true;
      const uploads = this.pendingFiles.map((file) => {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/upload-image`, formData);
      });
      forkJoin(uploads).subscribe({
        next: (results) => {
          this.uploading = false;
          const newUrls = results.map((r) => r.imageUrl);
          const allUrls = [...existingRaw, ...newUrls];
          const primary = allUrls[0] || '';
          this.revokeAllPendingPreviews();
          this.persistProduct(primary, this.urlsToImagesPayload(allUrls));
        },
        error: () => {
          this.uploading = false;
          this.modalError = 'Image upload failed.';
        },
      });
      return;
    }

    const primary = fallbackUrls[0] || '';
    this.persistProduct(primary, this.urlsToImagesPayload(fallbackUrls));
  }

  private urlsToImagesPayload(
    urls: string[]
  ): { id: number; url: string; imageUrl: string }[] {
    return urls
      .filter((u) => u && String(u).trim())
      .map((u) => ({ id: 0, url: u, imageUrl: u }));
  }

  async remove(item: any): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this product?',
      text: `${item.name ?? 'This product'} will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
      customClass: { container: 'swal-on-top' },
    });
    if (!confirmation.isConfirmed) {
      return;
    }

    const id = Number(item.productId);
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: async () => {
        if (this.editingProductId === id && this.showProductModal) {
          this.closeProductModal();
        }
        if (this.detailsProduct?.productId === id && this.showDetailsModal) {
          this.closeDetailsModal();
        }
        this.loadAll();
        await Swal.fire({
          icon: 'success',
          title: 'Product deleted',
          timer: 1300,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
          customClass: { container: 'swal-on-top' },
        });
      },
      error: () => {
        this.error = 'Could not delete.';
      },
    });
  }

  resolveImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  formatPrice(p: unknown): string {
    if (p === '' || p == null || Number.isNaN(Number(p))) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
    }).format(Number(p));
  }

  /** Galerie détail admin (même logique que le catalogue). */
  detailGalleryUrls(): string[] {
    const p = this.detailsProduct;
    if (!p) {
      return [];
    }
    if (Array.isArray(p.images) && p.images.length > 0) {
      return p.images.map((img: any) => this.resolveImageUrl(img.url || img.imageUrl));
    }
    if (p.imageUrl) {
      return [this.resolveImageUrl(p.imageUrl)];
    }
    return [];
  }

  detailMainImageUrl(): string {
    const urls = this.detailGalleryUrls();
    return urls[this.detailImageIndex] ?? '';
  }

  detailGalleryLength(): number {
    return this.detailGalleryUrls().length;
  }

  detailImagePrev(): void {
    const n = this.detailGalleryLength();
    if (n <= 1) return;
    this.detailImageIndex = (this.detailImageIndex - 1 + n) % n;
  }

  detailImageNext(): void {
    const n = this.detailGalleryLength();
    if (n <= 1) return;
    this.detailImageIndex = (this.detailImageIndex + 1) % n;
  }

  selectDetailImage(i: number): void {
    const n = this.detailGalleryLength();
    if (i >= 0 && i < n) {
      this.detailImageIndex = i;
    }
  }

  private persistProduct(
    primaryImageUrl: string,
    imagesPayload: { id: number; url: string; imageUrl: string }[]
  ): void {
    const payload: Record<string, unknown> = {
      name: this.productForm.name,
      description: this.productForm.description?.trim() || null,
      imageUrl: primaryImageUrl || null,
      images: imagesPayload,
      price: this.productForm.price === '' ? null : Number(this.productForm.price),
      stock: this.productForm.stock === '' ? null : Number(this.productForm.stock),
      category: this.productForm.category === '' ? null : this.productForm.category,
      status: this.productForm.status,
    };
    if (this.productForm.category === 'TEXTILE') {
      payload['variants'] = this.productForm.variants.map((v) => ({
        variantId: v.variantId || 0,
        size: v.size,
        color: v.color,
        stock: Number(v.stock),
        priceOverride:
          v.priceOverride === '' || v.priceOverride == null ? 0 : Number(v.priceOverride),
      }));
    } else {
      payload['variants'] = [];
    }
    const id = this.editingProductId;
    if (id !== null) {
      this.http.put(`${this.apiUrl}/${id}`, payload).subscribe({
        next: async () => {
          this.closeProductModal();
          this.loadAll();
          await Swal.fire({
            icon: 'success',
            title: 'Product updated',
            timer: 1400,
            showConfirmButton: false,
            background: '#181d24',
            color: '#e2e8f0',
            customClass: { container: 'swal-on-top' },
          });
        },
        error: () => {
          this.modalError = 'Update failed.';
        },
      });
      return;
    }

    if (!this.auth.isAuthenticated()) {
      this.modalError = 'Sign in to create a product.';
      return;
    }
    this.http.post(this.apiUrl, payload).subscribe({
      next: async () => {
        this.closeProductModal();
        this.loadAll();
        await Swal.fire({
          icon: 'success',
          title: 'Product added',
          timer: 1400,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
          customClass: { container: 'swal-on-top' },
        });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400) {
          this.modalError =
            'Could not create: user not found. Restart the backend or sign in again.';
        } else {
          this.modalError = 'Could not create product.';
        }
      },
    });
  }
}
