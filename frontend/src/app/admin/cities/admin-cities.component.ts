import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { concatMap, from, map, Observable, of, switchMap, toArray } from 'rxjs';
import Swal from 'sweetalert2';
import { City, CityMedia, CityRequest, MediaType } from '../admin-api.models';
import { CityAdminService } from '../services/city-admin.service';

@Component({
  selector: 'app-admin-cities',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-cities.component.html',
  styleUrl: './admin-cities.component.css',
})
export class AdminCitiesComponent implements OnInit {
  cities: City[] = [];
  q = '';
  sort = 'cityId,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;

  loading = false;
  error = '';
  showCityModal = false;

  editingCityId: number | null = null;
  cityForm: CityRequest = {
    name: '',
    region: null,
    description: null,
    latitude: null,
    longitude: null,
  };

  mediaCity: City | null = null;
  mediaItems: CityMedia[] = [];
  mediaQ = '';
  mediaSort = 'mediaId,desc';
  mediaPage = 0;
  mediaSize = 6;
  mediaTotalPages = 0;
  mediaType: MediaType = 'IMAGE';
  uploadFiles: File[] = [];
  mediaPreviewUrls: string[] = [];

  constructor(private readonly cityService: CityAdminService) {}

  ngOnInit(): void {
    this.loadCities();
  }

  loadCities(): void {
    this.loading = true;
    this.error = '';
    this.cityService.listCities(this.q, this.page, this.size, this.sort).subscribe({
      next: (res) => {
        this.cities = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Erreur lors du chargement des villes';
      },
    });
  }

  searchCities(): void {
    this.page = 0;
    this.loadCities();
  }

  changeCityPage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadCities();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadCities();
    }
  }

  sortChanged(): void {
    this.page = 0;
    this.loadCities();
  }

  editCity(city: City): void {
    this.editingCityId = city.cityId;
    this.cityForm = {
      name: city.name,
      region: city.region,
      description: city.description,
      latitude: city.latitude,
      longitude: city.longitude,
    };
    this.mediaCity = city;
    this.mediaPage = 0;
    this.mediaQ = '';
    this.loadMedia();
    this.showCityModal = true;
  }

  resetCityForm(): void {
    this.editingCityId = null;
    this.cityForm = {
      name: '',
      region: null,
      description: null,
      latitude: null,
      longitude: null,
    };
    this.mediaCity = null;
    this.mediaItems = [];
    this.mediaPage = 0;
    this.mediaTotalPages = 0;
    this.mediaQ = '';
    this.clearSelectedFiles();
  }

  openCreateModal(): void {
    this.error = '';
    this.resetCityForm();
    this.mediaType = 'IMAGE';
    this.showCityModal = true;
  }

  closeCityModal(): void {
    this.showCityModal = false;
    this.resetCityForm();
  }

  saveCity(): void {
    const isEdit = this.editingCityId != null;
    const payload: CityRequest = {
      name: this.cityForm.name.trim(),
      region: this.nullIfBlank(this.cityForm.region),
      description: this.nullIfBlank(this.cityForm.description),
      latitude: this.cityForm.latitude,
      longitude: this.cityForm.longitude,
    };

    if (!payload.name) {
      this.error = 'Le nom de la ville est obligatoire';
      return;
    }

    const request$ = !isEdit
      ? this.cityService.createCity(payload).pipe(
          switchMap((city) => this.uploadSelectedMedia(city.cityId).pipe(map(() => city)))
        )
      : this.cityService.updateCity(this.editingCityId!, payload).pipe(
          switchMap((city) => this.uploadSelectedMedia(city.cityId).pipe(map(() => city)))
        );

    request$.subscribe({
      next: async () => {
        this.closeCityModal();
        this.loadCities();
        await Swal.fire({
          icon: 'success',
          title: isEdit ? 'Ville mise à jour' : 'Ville ajoutée',
          timer: 1400,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
        });
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur lors de l’enregistrement';
      },
    });
  }

  async deleteCity(city: City): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Supprimer cette ville ?',
      text: `${city.name} sera supprimée définitivement.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.cityService.deleteCity(city.cityId).subscribe({
      next: async () => {
        if (this.mediaCity?.cityId === city.cityId && this.showCityModal) {
          this.closeCityModal();
        }
        this.loadCities();
        await Swal.fire({
          icon: 'success',
          title: 'Ville supprimée',
          timer: 1300,
          showConfirmButton: false,
          background: '#181d24',
          color: '#e2e8f0',
        });
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Suppression impossible';
      },
    });
  }

  loadMedia(): void {
    if (!this.mediaCity) {
      return;
    }
    this.cityService.listCityMedia(this.mediaCity.cityId, this.mediaQ, this.mediaPage, this.mediaSize, this.mediaSort).subscribe({
      next: (res) => {
        this.mediaItems = res.content;
        this.mediaTotalPages = res.totalPages;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur lors du chargement des médias';
      },
    });
  }

  searchMedia(): void {
    this.mediaPage = 0;
    this.loadMedia();
  }

  changeMediaPage(next: boolean): void {
    if (next && this.mediaPage + 1 < this.mediaTotalPages) {
      this.mediaPage++;
      this.loadMedia();
    } else if (!next && this.mediaPage > 0) {
      this.mediaPage--;
      this.loadMedia();
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.clearSelectedFiles();

    const files = Array.from(input.files ?? []);
    const accepted = files.filter((file) => file.type.startsWith('image/'));
    if (accepted.length !== files.length) {
      this.error = 'Seules les images sont autorisées';
    }

    this.uploadFiles = accepted;
    this.mediaPreviewUrls = accepted.map((file) => URL.createObjectURL(file));
  }

  uploadMedia(): void {
    if (!this.mediaCity || this.uploadFiles.length === 0) {
      this.error = 'Sélectionne d’abord une ville et un fichier';
      return;
    }

    this.uploadSelectedMedia(this.mediaCity.cityId).subscribe({
      next: () => {
        this.clearSelectedFiles();
        this.loadMedia();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Upload image impossible';
      },
    });
  }

  async deleteMedia(media: CityMedia): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Supprimer ce média ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#e63946',
      background: '#181d24',
      color: '#e2e8f0',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.cityService.deleteCityMedia(media.mediaId).subscribe({
      next: () => this.loadMedia(),
      error: (err) => {
        this.error = err?.error?.message ?? 'Suppression média impossible';
      },
    });
  }

  private nullIfBlank(value: string | null): string | null {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private uploadSelectedMedia(cityId: number): Observable<unknown> {
    if (this.uploadFiles.length === 0) {
      return of(null);
    }

    return from(this.uploadFiles).pipe(
      concatMap((file) => this.cityService.uploadCityMedia(cityId, this.mediaType, file)),
      toArray()
    );
  }

  private clearSelectedFiles(): void {
    for (const preview of this.mediaPreviewUrls) {
      URL.revokeObjectURL(preview);
    }
    this.mediaPreviewUrls = [];
    this.uploadFiles = [];
  }
}