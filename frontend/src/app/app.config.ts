import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { provideAnimations } from '@angular/platform-browser/animations';
import { DATA_SOURCE_TOKEN } from './core/adapters/data-source.adapter';
import { RestApiDataSource } from './core/adapters/rest-api-data-source.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideAnimations(),
    { provide: DATA_SOURCE_TOKEN, useClass: RestApiDataSource },
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
  ],
};
