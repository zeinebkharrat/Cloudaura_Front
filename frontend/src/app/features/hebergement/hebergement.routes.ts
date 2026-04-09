import { Routes } from '@angular/router';

export const HEBERGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./accommodation-list-page/accommodation-list-page.component').then(m => m.AccommodationListPageComponent)
  },
  {
    path: 'payment/return',
    loadComponent: () =>
      import('./accommodation-payment-return/accommodation-payment-return.component').then(
        (m) => m.AccommodationPaymentReturnComponent
      ),
  },
  /* Plus spécifique en premier (évite tout conflit avec :id). */
  {
    path: ':id/book',
    loadComponent: () => import('./accommodation-booking-page/accommodation-booking-page.component').then(m => m.AccommodationBookingPageComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./accommodation-details-page/accommodation-details-page.component').then(m => m.AccommodationDetailsPageComponent)
  }
];
