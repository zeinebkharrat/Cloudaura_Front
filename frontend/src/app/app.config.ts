import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TranslateLoader, TranslateService, provideTranslateService } from '@ngx-translate/core';
import { TRANSLATE_HTTP_LOADER_CONFIG, TranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';
import { langHttpInterceptor } from './core/interceptors/lang-http.interceptor';
import { DATA_SOURCE_TOKEN } from './core/adapters/data-source.adapter';
import { RestApiDataSource } from './core/adapters/rest-api-data-source.service';
import { LanguageService } from './core/services/language.service';
import { appI18nInitializer } from './core/i18n/app-i18n.initializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([langHttpInterceptor, authInterceptor])),
    { provide: DATA_SOURCE_TOKEN, useClass: RestApiDataSource },
    MessageService,
    ConfirmationService,
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useValue: {
        prefix: '/assets/i18n/',
        suffix: '.json',
      },
    },
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useClass: TranslateHttpLoader,
      },
      fallbackLang: 'en',
      extend: true,
    }),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: appI18nInitializer,
      deps: [TranslateService, LanguageService],
    },
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
  ],
};
