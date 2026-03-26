import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth.service';
import { API_BASE_URL } from '../../../core/api-url';

@Component({
  selector: 'app-products-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products-admin.component.html',
  styleUrl: './products-admin.component.css',
})
export class ProductsAdminComponent implements OnInit {
  private readonly apiUrl = `${API_BASE_URL}/api/products`;
  private readonly maxImageSizeBytes = 15 * 1024 * 1024;
  readonly loading = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<any[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly form = signal({
    name: '',
    imageUrl: '',
    price: '' as string | number,
    stock: '' as string | number
  });

  constructor(private http: HttpClient, private auth: AuthService) {}
  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (d) => { this.items.set(d ?? []); this.loading.set(false); },
      error: () => { this.error.set('Erreur de chargement des produits.'); this.loading.set(false); },
    });
  }

  edit(item: any): void {
    this.selectedId.set(Number(item.productId));
    this.selectedFile.set(null);
    this.form.set({
      name: item.name ?? '',
      imageUrl: item.imageUrl ?? '',
      price: item.price ?? '',
      stock: item.stock ?? ''
    });
  }

  save(): void {
    if (this.selectedFile()) {
      const formData = new FormData();
      formData.append('file', this.selectedFile() as Blob);
      this.uploading.set(true);
      this.http.post<{ imageUrl: string }>(`${this.apiUrl}/upload-image`, formData).subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.persistProduct(response.imageUrl);
        },
        error: () => {
          this.uploading.set(false);
          this.error.set('Upload image impossible.');
        },
      });
      return;
    }
    this.persistProduct(this.form().imageUrl);
  }

  remove(item: any): void {
    const id = Number(item.productId);
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => { if (this.selectedId() === id) this.reset(); this.loadAll(); },
      error: () => this.error.set('Suppression impossible.'),
    });
  }

  reset(): void {
    this.selectedId.set(null);
    this.selectedFile.set(null);
    this.form.set({ name: '', imageUrl: '', price: '', stock: '' });
    this.error.set(null);
  }

  setField(key: string, value: unknown): void {
    this.form.update((prev) => ({ ...prev, [key]: value }));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (file && file.size > this.maxImageSizeBytes) {
      this.selectedFile.set(null);
      this.error.set('Image trop grande (max 15MB).');
      input.value = '';
      return;
    }
    this.selectedFile.set(file);
    if (file) {
      this.error.set(null);
    }
  }

  resolveImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  private persistProduct(imageUrl: string): void {
    const payload = {
      name: this.form().name,
      imageUrl,
      price: this.form().price === '' ? null : Number(this.form().price),
      stock: this.form().stock === '' ? null : Number(this.form().stock),
    };
    const id = this.selectedId();
    if (id !== null) {
      this.http.put(`${this.apiUrl}/${id}`, payload).subscribe({
        next: () => { this.reset(); this.loadAll(); },
        error: () => this.error.set('Erreur de mise a jour.'),
      });
      return;
    }

    const currentUsername = this.auth.currentUser()?.username ?? '';
    if (!currentUsername) {
      this.error.set('Connectez-vous pour creer un produit (compte requis pour l\'auteur).');
      return;
    }
    this.http.post(this.apiUrl, payload, { headers: { 'X-Username': currentUsername } }).subscribe({
      next: () => { this.reset(); this.loadAll(); },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400) {
          this.error.set('Creation refusee : utilisateur inconnu en base. Redemarrez le backend apres mise a jour, ou connectez-vous avec admin/user.');
        } else {
          this.error.set('Erreur de creation.');
        }
      },
    });
  }
}
