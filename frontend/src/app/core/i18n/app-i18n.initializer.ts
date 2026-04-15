import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../services/language.service';

export function appI18nInitializer(translate: TranslateService, language: LanguageService) {
  return () => {
    const code = language.resolveInitialLanguageCode();
    language.currentLang.set(code);
    language.applyDocumentDirection(code);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('translate', 'no');
    }
    translate.setDefaultLang('fr');
    return firstValueFrom(translate.use(code)).then(() => {
      language.notifyLanguageReady(code);
    });
  };
}
