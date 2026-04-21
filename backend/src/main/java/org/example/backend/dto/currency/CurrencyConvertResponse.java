package org.example.backend.dto.currency;

import java.math.BigDecimal;
import java.time.Instant;

public record CurrencyConvertResponse(
        String baseCurrency,
        String toCurrency,
        BigDecimal amountBase,
        BigDecimal amountConverted,
        BigDecimal rate,
        CurrencyRateSource rateSource,
        Instant ratesUpdatedAt
) {
}
