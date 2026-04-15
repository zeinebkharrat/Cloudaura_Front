package org.example.backend.dto.currency;

import java.time.Instant;
import java.util.Map;

/**
 * Snapshot of in-memory rates (TND base) for UI formatting without per-row HTTP calls.
 */
public record CurrencyRatesResponse(
        String baseCurrency,
        Map<String, Double> rates,
        CurrencyRateSource source,
        Instant updatedAt
) {
}
