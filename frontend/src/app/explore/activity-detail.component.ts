import { CommonModule, Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import {
  ActivityReservationResponse,
  Activity,
  CreateActivityReservationRequest,
} from './explore.models';
import { ExploreService } from './explore.service';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.css',
})
export class ActivityDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly exploreService = inject(ExploreService);
  private readonly location = inject(Location);

  activity?: Activity;
  loading = true;
  error = '';
  heroImage = 'assets/sidi_bou.png';

  form: CreateActivityReservationRequest = {
    reservationDate: new Date().toISOString().slice(0, 10),
    numberOfPeople: 1,
  };

  submitting = false;
  created?: ActivityReservationResponse;

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('activityId'));
    if (!id) {
      this.loading = false;
      this.error = 'Activité introuvable.';
      return;
    }

    this.exploreService.getActivityDetails(id).subscribe({
      next: (res) => {
        this.activity = res;
        this.loadCityHeroImage(res.cityId);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Impossible de charger cette activité.';
      },
    });
  }

  private loadCityHeroImage(cityId: number): void {
    this.exploreService.getCityDetails(cityId).subscribe({
      next: (details) => {
        const firstImage = details.media.find((m) => m.mediaType === 'IMAGE')?.url ?? details.media[0]?.url;
        if (firstImage) {
          this.heroImage = firstImage;
        }
      },
      error: () => {
        this.heroImage = 'assets/sidi_bou.png';
      },
    });
  }

  submitReservation(): void {
    if (!this.activity || this.form.numberOfPeople < 1) {
      return;
    }

    this.submitting = true;
    this.exploreService
      .reserveActivity(this.activity.activityId, this.form)
      .subscribe({
        next: (res) => {
          this.created = res;
          this.submitting = false;
          Swal.fire({
            icon: 'success',
            title: 'Réservation envoyée',
            text: `Référence #${res.reservationId}`,
            confirmButtonColor: '#e63946',
          });
        },
        error: (err) => {
          this.submitting = false;
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: err?.error?.message || 'La réservation a échoué.',
            confirmButtonColor: '#e63946',
          });
        },
      });
  }

  goBack(): void {
    this.location.back();
  }
}
