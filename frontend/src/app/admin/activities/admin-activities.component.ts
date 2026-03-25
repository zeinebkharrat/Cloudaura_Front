import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { Activity, ActivityRequest, City } from '../admin-api.models';
import { ActivityAdminService } from '../services/activity-admin.service';
import { CityAdminService } from '../services/city-admin.service';

@Component({
  selector: 'app-admin-activities',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-activities.component.html',
  styleUrl: './admin-activities.component.css',
})
export class AdminActivitiesComponent implements OnInit {
  activities: Activity[] = [];
  cities: City[] = [];
  q = '';
  sort = 'activityId,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  error = '';
  showModal = false;

  editingId: number | null = null;
  form: { cityId: number | null; name: string; type: string; price: number | null } = {
    cityId: null,
    name: '',
    type: '',
    price: null,
  };

  constructor(
    private readonly activityService: ActivityAdminService,
    private readonly cityService: CityAdminService
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadActivities();
  }

  loadCities(): void {
    this.cityService.listCities('', 0, 200, 'name,asc').subscribe({
      next: (res) => {
        this.cities = res.content;
      },
      error: () => {
        this.error = 'Impossible de charger les villes';
      },
    });
  }

  loadActivities(): void {
    this.activityService.list(this.q, this.page, this.size, this.sort).subscribe({
      next: (res) => {
        this.activities = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur lors du chargement des activités';
      },
    });
  }

  search(): void {
    this.page = 0;
    this.loadActivities();
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadActivities();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadActivities();
    }
  }

  edit(item: Activity): void {
    this.editingId = item.activityId;
    this.form = {
      cityId: item.cityId,
      name: item.name,
      type: item.type ?? '',
      price: item.price,
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
      type: '',
      price: null,
    };
  }

  save(): void {
    if (this.form.cityId == null || !this.form.name.trim()) {
      this.error = 'Ville et nom de l’activité sont obligatoires';
      return;
    }

    const payload: ActivityRequest = {
      cityId: this.form.cityId,
      name: this.form.name.trim(),
      type: this.form.type.trim() || null,
      price: this.form.price,
    };

    const request$ = this.editingId == null
      ? this.activityService.create(payload)
      : this.activityService.update(this.editingId, payload);

    request$.subscribe({
      next: () => {
        this.closeModal();
        this.loadActivities();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur lors de la sauvegarde';
      },
    });
  }

  async delete(item: Activity): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Supprimer cette activité ?',
      text: `${item.name} sera supprimée définitivement.`,
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

    this.activityService.delete(item.activityId).subscribe({
      next: async () => {
        this.loadActivities();
        await Swal.fire({
          icon: 'success',
          title: 'Activité supprimée',
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