package org.example.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for ExchangeRate-API and refresh behaviour.
 * Set {@code EXCHANGERATE_API_KEY} in the environment; do not commit real keys.
 */
@ConfigurationProperties(prefix = "app.currency")
public class CurrencyProperties {

    /**
     * ExchangeRate-API v6 access key.
     */
    private String exchangeApiKey = "";

    /**
     * API root including version segment, without trailing slash, e.g. {@code https://v6.exchangerate-api.com/v6}.
     */
    private String exchangeBaseUrl = "https://v6.exchangerate-api.com/v6";

    /** ISO base currency stored in the database and used for pricing (never converted server-side for persistence). */
    private String baseCurrency = "TND";

    /** How often to refresh remote rates (milliseconds). */
    private long refreshIntervalMs = 3_600_000L;

    private int connectTimeoutMs = 8_000;
    private int readTimeoutMs = 15_000;

    public String getExchangeApiKey() {
        return exchangeApiKey;
    }

    public void setExchangeApiKey(String exchangeApiKey) {
        this.exchangeApiKey = exchangeApiKey;
    }

    public String getExchangeBaseUrl() {
        return exchangeBaseUrl;
    }

    public void setExchangeBaseUrl(String exchangeBaseUrl) {
        this.exchangeBaseUrl = exchangeBaseUrl;
    }

    public String getBaseCurrency() {
        return baseCurrency;
    }

    public void setBaseCurrency(String baseCurrency) {
        this.baseCurrency = baseCurrency;
    }

    public long getRefreshIntervalMs() {
        return refreshIntervalMs;
    }

    public void setRefreshIntervalMs(long refreshIntervalMs) {
        this.refreshIntervalMs = refreshIntervalMs;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
}
