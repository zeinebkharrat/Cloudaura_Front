package org.example.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * OpenSky Network REST (states / flights). Optional bearer token raises quotas; anonymous is supported for
 * {@code /states/all} with tighter limits — see OpenSky terms of use.
 */
@Data
@ConfigurationProperties(prefix = "opensky")
public class OpenSkyProperties {

    /** API root including {@code /api} path segment. */
    private String baseUrl = "https://opensky-network.org/api";

    /** OAuth2 bearer token (optional). Prefer env {@code OPENSKY_BEARER_TOKEN}. */
    private String bearerToken = "";

    private int connectTimeoutMs = 8_000;
    private int readTimeoutMs = 15_000;

    /** Short cache for state vectors (seconds). */
    private int stateCacheSeconds = 12;

    /** Cache resolved ICAO24 from schedule context (seconds). */
    private int resolveCacheSeconds = 45;

    /** Max track requests per client key (IP) per rolling minute. */
    private int trackRateLimitPerMinute = 24;

    public boolean hasBearerToken() {
        return bearerToken != null && !bearerToken.isBlank();
    }
}
