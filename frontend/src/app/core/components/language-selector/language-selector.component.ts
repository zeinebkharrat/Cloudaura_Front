import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService, AppLang } from '../../services/language.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.css',
})
export class LanguageSelectorComponent {
  private readonly language = inject(LanguageService);

  readonly current = this.language.currentLang;

  readonly options: { code: AppLang; label: string }[] = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
    { code: 'ar', label: 'ع' },
  ];

  select(code: AppLang): void {
    if (code === this.current()) {
      return;
    }
    this.language.setLanguage(code);
  }
}
