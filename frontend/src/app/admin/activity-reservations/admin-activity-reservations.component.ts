import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityReservationListItem, ReservationStatus } from '../admin-api.models';
import { ActivityReservationAdminService } from '../services/activity-reservation-admin.service';

@Component({
  selector: 'app-admin-activity-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-activity-reservations.component.html',
  styleUrl: './admin-activity-reservations.component.css',
})
export class AdminActivityReservationsComponent implements OnInit {
  reservations: ActivityReservationListItem[] = [];
  q = '';
  status: ReservationStatus | '' = '';
  reservationDate = '';
  sort = 'reservationDate,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  loading = false;
  error = '';

  constructor(private readonly reservationService: ActivityReservationAdminService) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.error = '';

    this.reservationService
      .list({
        q: this.q,
        status: this.status,
        reservationDate: this.reservationDate || null,
        page: this.page,
        size: this.size,
        sort: this.sort,
      })
      .subscribe({
        next: (res) => {
          this.reservations = res.content;
          this.totalPages = res.totalPages;
          this.totalElements = res.totalElements;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'Erreur lors du chargement des réservations';
          this.loading = false;
        },
      });
  }

  onFiltersChanged(): void {
    this.page = 0;
    this.loadReservations();
  }

  clearFilters(): void {
    this.q = '';
    this.status = '';
    this.reservationDate = '';
    this.page = 0;
    this.loadReservations();
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadReservations();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadReservations();
    }
  }
}
