import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '../services/currency.service';

/**
 * Impure so templates stay in sync when the global display currency or FX snapshot changes (OnPush-safe).
 */
@Pipe({
  name: 'dualCurrency',
  standalone: true,
  pure: false,
})
export class DualCurrencyPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);

  transform(amountTnd: number | null | undefined): string {
    if (amountTnd == null || Number.isNaN(amountTnd)) {
      return '—';
    }
    return this.currency.formatDual(amountTnd);
  }
}
