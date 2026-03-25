import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { City, Restaurant, RestaurantRequest } from '../admin-api.models';
import { CityAdminService } from '../services/city-admin.service';
import { RestaurantAdminService } from '../services/restaurant-admin.service';

@Component({
  selector: 'app-admin-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-restaurants.component.html',
  styleUrl: './admin-restaurants.component.css',
})
export class AdminRestaurantsComponent implements OnInit {
  restaurants: Restaurant[] = [];
  cities: City[] = [];
  q = '';
  sort = 'restaurantId,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  error = '';
  showModal = false;

  editingId: number | null = null;
  form: { cityId: number | null; name: string; cuisineType: string; rating: number | null } = {
    cityId: null,
    name: '',
    cuisineType: '',
    rating: null,
  };

  constructor(
    private readonly restaurantService: RestaurantAdminService,
    private readonly cityService: CityAdminService
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadRestaurants();
  }

  loadCities(): void {
    this.cityService.listCities('', 0, 200, 'name,asc').subscribe({
      next: (res) => {
        this.cities = res.content;
      },
      error: () => {
        this.error = 'Impossible de charger la liste des villes';
      },
    });
  }

  loadRestaurants(): void {
    this.restaurantService.list(this.q, this.page, this.size, this.sort).subscribe({
      next: (res) => {
        this.restaurants = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur lors du chargement des restaurants';
      },
    });
  }

  search(): void {
    this.page = 0;
    this.loadRestaurants();
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadRestaurants();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadRestaurants();
    }
  }

  edit(item: Restaurant): void {
    this.editingId = item.restaurantId;
    this.form = {
      cityId: item.cityId,
      name: item.name,
      cuisineType: item.cuisineType ?? '',
      rating: item.rating,
    };
    this.showModal = true;
  }

  openCreateModal(): void {
    this.resetForm();
    this.error = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.editingId = null;
    this.form = {
      cityId: null,
      name: '',
      cuisineType: '',
      rating: null,
    };
  }

  save(): void {
    if (this.form.cityId == null || !this.form.name.trim()) {
      this.error = 'Ville et nom du restaurant sont obligatoires';
      return;
    }

    const payload: RestaurantRequest = {
      cityId: this.form.cityId,
      name: this.form.name.trim(),
      cuisineType: this.form.cuisineType.trim() || null,
      rating: this.form.rating,
    };

    const request$ = this.editingId == null
      ? this.restaurantService.create(payload)
      : this.restaurantService.update(this.editingId, payload);

    request$.subscribe({
      next: () => {
        this.closeModal();
        this.loadRestaurants();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur lors de la sauvegarde';
      },
    });
  }

  async delete(item: Restaurant): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Supprimer ce restaurant ?',
      text: `${item.name} sera supprimé définitivement.`,
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

    this.restaurantService.delete(item.restaurantId).subscribe({
      next: async () => {
        this.loadRestaurants();
        await Swal.fire({
          icon: 'success',
          title: 'Restaurant supprimé',
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
}