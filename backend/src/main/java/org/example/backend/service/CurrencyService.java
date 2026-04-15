package org.example.backend.service;

import org.example.backend.config.CurrencyProperties;
import org.example.backend.dto.currency.CurrencyConvertResponse;
import org.example.backend.dto.currency.CurrencyRateSource;
import org.example.backend.dto.currency.CurrencyRatesResponse;
import org.example.backend.dto.currency.ExchangeRateApiLatestResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * In-memory TND-based FX from ExchangeRate-API. Rates refresh on a schedule; {@link #convert}
 * never calls the network.
 */
@Service
public class CurrencyService {

    private static final Logger log = LoggerFactory.getLogger(CurrencyService.class);

    /**
     * Last-resort static rates (TND → quote) when the API is unavailable and no cache exists.
     * Replace or tune via configuration in production if you prefer stricter behaviour (e.g. fail closed).
     */
    private static final Map<String, Double> EMERGENCY_FALLBACK = Map.of(
            "TND", 1.0,
            "EUR", 0.29,
            "USD", 0.31
    );

    private final RestTemplate exchangeRateRestTemplate;
    private final CurrencyProperties properties;

    private final ConcurrentHashMap<String, Double> ratesByCode = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> lastUpdated = new AtomicReference<>();
    private final AtomicReference<CurrencyRateSource> lastSource = new AtomicReference<>(CurrencyRateSource.EMERGENCY_FALLBACK);

    public CurrencyService(
            @Qualifier("exchangeRateRestTemplate") RestTemplate exchangeRateRestTemplate,
            CurrencyProperties properties
    ) {
        this.exchangeRateRestTemplate = exchangeRateRestTemplate;
        this.properties = properties;
    }

    @PostConstruct
    void loadInitialRates() {
        refreshFromRemote();
    }

    /**
     * Converts an amount expressed in {@link CurrencyProperties#getBaseCurrency()} to {@code toCurrency}.
     *
     * @param toCurrency ISO 4217 code (e.g. EUR); null-safe, case-insensitive
     * @param amount     amount in base currency; must not be null
     * @return conversion details; never null
     * @throws IllegalArgumentException for unknown currencies or negative amounts
     */
    public CurrencyConvertResponse convert(String toCurrency, BigDecimal amount) {
        Objects.requireNonNull(amount, "amount");
        if (amount.signum() < 0) {
            throw new IllegalArgumentException("amount must be non-negative");
        }
        String base = normalize(properties.getBaseCurrency());
        String to = normalize(toCurrency);
        if (to.isEmpty()) {
            throw new IllegalArgumentException("toCurrency is required");
        }
        if (to.equals(base)) {
            return new CurrencyConvertResponse(
                    base,
                    to,
                    amount,
                    amount,
                    BigDecimal.ONE,
                    currentSource(),
                    lastUpdated.get()
            );
        }
        BigDecimal rate = resolveRate(to);
        BigDecimal converted = amount.multiply(rate).setScale(2, RoundingMode.HALF_UP);
        return new CurrencyConvertResponse(
                base,
                to,
                amount,
                converted,
                rate,
                currentSource(),
                lastUpdated.get()
        );
    }

    /**
     * Public snapshot for clients that want to format many prices locally.
     */
    public CurrencyRatesResponse getRatesSnapshot() {
        String base = normalize(properties.getBaseCurrency());
        Map<String, Double> copy = ratesByCode.isEmpty()
                ? Map.copyOf(EMERGENCY_FALLBACK)
                : ratesByCode.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
        return new CurrencyRatesResponse(base, Collections.unmodifiableMap(copy), currentSource(), lastUpdated.get());
    }

    @Scheduled(fixedRateString = "${app.currency.refresh-interval-ms:3600000}")
    public void scheduledRefresh() {
        refreshFromRemote();
    }

    /**
     * Initial and manual refresh; safe to call from multiple threads — only one remote call runs at a time.
     */
    public synchronized void refreshFromRemote() {
        String apiKey = properties.getExchangeApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("ExchangeRate-API key is not configured (set EXCHANGERATE_API_KEY). Using cached or emergency fallback rates.");
            applyFallbackIfEmpty("missing API key");
            return;
        }
        String base = normalize(properties.getBaseCurrency());
        String url = trimTrailingSlash(properties.getExchangeBaseUrl())
                + "/" + apiKey.trim()
                + "/latest/" + base;
        try {
            ResponseEntity<ExchangeRateApiLatestResponse> response =
                    exchangeRateRestTemplate.getForEntity(url, ExchangeRateApiLatestResponse.class);
            ExchangeRateApiLatestResponse body = response.getBody();
            if (body == null || !"success".equalsIgnoreCase(body.getResult())) {
                String err = body != null ? body.getErrorType() : "empty body";
                log.warn("ExchangeRate-API returned non-success: {}", err);
                applyFallbackIfEmpty("API non-success: " + err);
                return;
            }
            Map<String, Double> incoming = body.getConversionRates();
            if (incoming == null || incoming.isEmpty()) {
                log.warn("ExchangeRate-API returned no conversion_rates");
                applyFallbackIfEmpty("empty conversion_rates");
                return;
            }
            ratesByCode.clear();
            incoming.forEach((code, value) -> {
                if (code != null && value != null && value > 0) {
                    ratesByCode.put(code.toUpperCase(Locale.ROOT), value);
                }
            });
            ratesByCode.put(base, 1.0);
            lastUpdated.set(Instant.now());
            lastSource.set(CurrencyRateSource.LIVE);
            log.info("Loaded {} FX quotes from ExchangeRate-API (base {}).", ratesByCode.size(), base);
        } catch (RestClientException ex) {
            log.warn("ExchangeRate-API request failed: {}", ex.getMessage());
            applyFallbackIfEmpty("HTTP error");
        } catch (RuntimeException ex) {
            log.warn("Unexpected error refreshing FX: {}", ex.getMessage());
            applyFallbackIfEmpty("unexpected error");
        }
    }

    private void applyFallbackIfEmpty(String reason) {
        if (!ratesByCode.isEmpty()) {
            lastSource.set(CurrencyRateSource.CACHED);
            log.info("Keeping {} cached FX rates after: {}", ratesByCode.size(), reason);
            return;
        }
        ratesByCode.clear();
        EMERGENCY_FALLBACK.forEach(ratesByCode::put);
        lastUpdated.set(Instant.now());
        lastSource.set(CurrencyRateSource.EMERGENCY_FALLBACK);
        log.warn("Activated emergency static FX rates after: {}", reason);
    }

    private CurrencyRateSource currentSource() {
        CurrencyRateSource s = lastSource.get();
        return s != null ? s : CurrencyRateSource.EMERGENCY_FALLBACK;
    }

    private BigDecimal resolveRate(String toCurrencyUpper) {
        Double raw = ratesByCode.get(toCurrencyUpper);
        if (raw == null || raw <= 0) {
            raw = EMERGENCY_FALLBACK.get(toCurrencyUpper);
        }
        if (raw == null || raw <= 0) {
            throw new IllegalArgumentException("Unknown or unsupported currency: " + toCurrencyUpper);
        }
        return BigDecimal.valueOf(raw);
    }

    private static String normalize(String code) {
        if (code == null) {
            return "";
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimTrailingSlash(String url) {
        if (url == null) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
