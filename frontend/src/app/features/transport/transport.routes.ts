import { Routes } from '@angular/router';
import { TransportSearchPageComponent } from './transport-search-page/transport-search-page.component';
import { TransportResultsPageComponent } from './transport-results-page/transport-results-page.component';
import { TransportFormPageComponent } from './transport-form-page/transport-form-page.component';
import { TransportBookingPageComponent } from './transport-booking-page/transport-booking-page.component';
import { TransportAiRecommendationComponent } from './transport-ai-recommendation/transport-ai-recommendation.component';
import { TransportPaymentReturnComponent } from './transport-payment-return/transport-payment-return.component';
import { TransportPaymentCancelComponent } from './transport-payment-cancel/transport-payment-cancel.component';

export const TRANSPORT_ROUTES: Routes = [
  {
    path: '',
    component: TransportSearchPageComponent,
  },
  {
    path: 'flights',
    loadComponent: () =>
      import('../flights/flights-page.component').then((m) => m.FlightsPageComponent),
  },
  {
    path: 'results',
    component: TransportResultsPageComponent,
  },
  {
    path: 'form',
    component: TransportFormPageComponent,
  },
  {
    path: 'ai-recommendation',
    component: TransportAiRecommendationComponent,
  },
  {
    path: 'payment-return',
    redirectTo: 'payment/return',
    pathMatch: 'full',
  },
  {
    path: 'payment',
    children: [
      { path: 'return', component: TransportPaymentReturnComponent },
      { path: 'cancel', component: TransportPaymentCancelComponent },
    ],
  },
  {
    path: ':id/book',
    component: TransportBookingPageComponent,
  },
];
