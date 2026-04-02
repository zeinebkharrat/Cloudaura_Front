import { Routes } from '@angular/router';

export const TRANSPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./transport-search-page/transport-search-page.component')
      .then(m => m.TransportSearchPageComponent),
  },
  {
    path: 'results',
    loadComponent: () => import('./transport-results-page/transport-results-page.component')
      .then(m => m.TransportResultsPageComponent),
  },
  {
    path: 'ai-recommendation',
    loadComponent: () => import('./transport-ai-recommendation/transport-ai-recommendation.component')
      .then(m => m.TransportAiRecommendationComponent),
  },
  /* Litéraux et segments fixes avant :id pour éviter que « results » soit pris pour un id. */
  {
    path: ':id/book',
    loadComponent: () => import('./transport-booking-page/transport-booking-page.component')
      .then(m => m.TransportBookingPageComponent),
  },
];
