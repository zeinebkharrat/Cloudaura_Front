import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    imageUrl: '',
    price: '' as string | number,
    stock: '' as string | number,
  };
  selectedFile: File | null = null;
  imagePreviewObjectUrl: string | null = null;

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
    this.revokePreviewUrl();
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
        this.error = 'Erreur de chargement des produits.';
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
    this.revokePreviewUrl();
    this.selectedFile = null;
    this.productForm = {
      name: item.name ?? '',
      imageUrl: item.imageUrl ?? '',
      price: item.price ?? '',
      stock: item.stock ?? '',
    };
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.resetProductForm();
  }

  private resetProductForm(): void {
    this.editingProductId = null;
    this.revokePreviewUrl();
    this.selectedFile = null;
    this.productForm = { name: '', imageUrl: '', price: '', stock: '' };
    this.modalError = '';
  }

  openDetails(item: any): void {
    this.detailsProduct = item;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsProduct = null;
  }

  onModalBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeProductModal();
    }
  }

  onDetailsBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeDetailsModal();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    this.revokePreviewUrl();
    this.selectedFile = null;
    if (!file) {
      return;
    }
    if (file.size > this.maxImageSizeBytes) {
      this.modalError = 'Image trop grande (max 15 Mo).';
      input.value = '';
      return;
    }
    this.modalError = '';
    this.selectedFile = file;
    this.imagePreviewObjectUrl = URL.createObjectURL(file);
  }

  clearFileSelection(inputId = 'productImageInput'): void {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (el) {
      el.value = '';
    }
    this.revokePreviewUrl();
    this.selectedFile = null;
  }

  private revokePreviewUrl(): void {
    if (this.imagePreviewObjectUrl) {
      URL.revokeObjectURL(this.imagePreviewObjectUrl);
      this.imagePreviewObjectUrl = null;
    }
  }

  save(): void {
    this.modalError = '';
    const name = String(this.productForm.name ?? '').trim();
    if (!name) {
      this.modalError = 'Le nom du produit est obligatoire.';
      return;
    }

    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile as Blob);
      this.uploading = true;
      this.http.post<{ imageUrl: string }>(`${this.apiUrl}/upload-image`, formData).subscribe({
        next: (response) => {
          this.uploading = false;
          this.persistProduct(response.imageUrl);
        },
        error: () => {
          this.uploading = false;
          this.modalError = 'Upload image impossible.';
        },
      });
      return;
    }
    this.persistProduct(this.productForm.imageUrl);
  }

  async remove(item: any): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Supprimer ce produit ?',
      text: `${item.name ?? 'Ce produit'} sera supprimé définitivement.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
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
          title: 'Produit supprimé',
          timer: 1300,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
          customClass: { container: 'swal-on-top' },
        });
      },
      error: () => {
        this.error = 'Suppression impossible.';
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
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
    }).format(Number(p));
  }

  modalPreviewSrc(): string {
    if (this.imagePreviewObjectUrl) {
      return this.imagePreviewObjectUrl;
    }
    return this.resolveImageUrl(this.productForm.imageUrl);
  }

  private persistProduct(imageUrl: string): void {
    const payload = {
      name: this.productForm.name,
      imageUrl,
      price: this.productForm.price === '' ? null : Number(this.productForm.price),
      stock: this.productForm.stock === '' ? null : Number(this.productForm.stock),
    };
    const id = this.editingProductId;
    if (id !== null) {
      this.http.put(`${this.apiUrl}/${id}`, payload).subscribe({
        next: async () => {
          this.closeProductModal();
          this.loadAll();
          await Swal.fire({
            icon: 'success',
            title: 'Produit mis à jour',
            timer: 1400,
            showConfirmButton: false,
            background: '#181d24',
            color: '#e2e8f0',
            customClass: { container: 'swal-on-top' },
          });
        },
        error: () => {
          this.modalError = 'Erreur de mise à jour.';
        },
      });
      return;
    }

    if (!this.auth.isAuthenticated()) {
      this.modalError = 'Connectez-vous pour créer un produit.';
      return;
    }
    this.http.post(this.apiUrl, payload).subscribe({
      next: async () => {
        this.closeProductModal();
        this.loadAll();
        await Swal.fire({
          icon: 'success',
          title: 'Produit ajouté',
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
            'Création refusée : utilisateur inconnu en base. Redémarrez le backend ou reconnectez-vous.';
        } else {
          this.modalError = 'Erreur de création.';
        }
      },
    });
  }
}
