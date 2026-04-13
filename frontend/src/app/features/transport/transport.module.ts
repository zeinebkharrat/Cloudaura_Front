import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { StepperModule } from 'primeng/stepper';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { RadioButtonModule } from 'primeng/radiobutton';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TRANSPORT_ROUTES } from './transport.routes';
import { TransportSearchPageComponent } from './transport-search-page/transport-search-page.component';
import { TransportResultsPageComponent } from './transport-results-page/transport-results-page.component';
import { TransportFormPageComponent } from './transport-form-page/transport-form-page.component';
import { TransportBookingPageComponent } from './transport-booking-page/transport-booking-page.component';
import { TransportAiRecommendationComponent } from './transport-ai-recommendation/transport-ai-recommendation.component';
import { TransportPaymentReturnComponent } from './transport-payment-return/transport-payment-return.component';
import { TransportPaymentCancelComponent } from './transport-payment-cancel/transport-payment-cancel.component';
import { TransportRouteMapComponent } from './transport-route-map/transport-route-map.component';
import { TunisiaCityMatchService } from './tunisia-city-match.service';
import { TransportTrackingSseService } from './transport-tracking-sse.service';
import { DualCurrencyPipe } from '../../core/pipes/dual-currency.pipe';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    TranslateModule,
    DualCurrencyPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(TRANSPORT_ROUTES),
    DropdownModule,
    CalendarModule,
    InputNumberModule,
    ButtonModule,
    RippleModule,
    TooltipModule,
    StepperModule,
    InputTextModule,
    InputMaskModule,
    RadioButtonModule,
    DividerModule,
    TagModule,
    SkeletonModule,
    ToastModule,
  ],
  declarations: [
    TransportSearchPageComponent,
    TransportResultsPageComponent,
    TransportFormPageComponent,
    TransportBookingPageComponent,
    TransportAiRecommendationComponent,
    TransportPaymentReturnComponent,
    TransportPaymentCancelComponent,
    TransportRouteMapComponent,
  ],
  providers: [
    TunisiaCityMatchService,
    TransportTrackingSseService,
    MessageService,
  ],
})
export class TransportModule {}
