import { Routes } from '@angular/router';

export const HEBERGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./accommodation-list-page/accommodation-list-page.component').then(m => m.AccommodationListPageComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./accommodation-details-page/accommodation-details-page.component').then(m => m.AccommodationDetailsPageComponent)
  },
  {
    path: ':id/book',
    loadComponent: () => import('./accommodation-booking-page/accommodation-booking-page.component').then(m => m.AccommodationBookingPageComponent)
  }
];
