package org.example.backend.dto.currency;

public enum CurrencyRateSource {
    /** Fresh data from ExchangeRate-API. */
    LIVE,
    /** Previously fetched rates kept after a failed refresh. */
    CACHED,
    /** Static emergency rates (TND → EUR / USD) when no live data exists. */
    EMERGENCY_FALLBACK
}
