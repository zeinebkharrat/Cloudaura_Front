import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyService } from '../../services/currency.service';
import type { DisplayCurrency } from '../../currency.types';

@Component({
  selector: 'app-currency-selector',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './currency-selector.component.html',
  styleUrl: './currency-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencySelectorComponent {
  readonly currency = inject(CurrencyService);

  readonly options: { code: DisplayCurrency; label: string }[] = [
    { code: 'TND', label: 'TND — د.ت' },
    { code: 'EUR', label: 'EUR — €' },
    { code: 'USD', label: 'USD — $' },
  ];

  onChange(code: DisplayCurrency): void {
    this.currency.setDisplayCurrency(code);
  }
}
