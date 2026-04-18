import { ChangeDetectorRef, effect, inject, untracked } from '@angular/core';
import { CurrencyService } from '../services/currency.service';

/**
 * Re-runs change detection when the user changes display currency or FX rates refresh.
 * Use in OnPush (or any) component templates that use {@link DualCurrencyPipe} or {@link CurrencyService#formatDual}.
 */
export function createCurrencyDisplaySyncEffect(): ReturnType<typeof effect> {
  const currency = inject(CurrencyService);
  const cdr = inject(ChangeDetectorRef);
  return effect(() => {
    currency.displayRevision();
    untracked(() => cdr.markForCheck());
  });
}
