package org.example.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code amadeus.*} keys from {@code application.properties} or environment variables.
 * <p>
 * Create keys at <a href="https://developers.amadeus.com/">Amadeus for Developers</a> → My Apps → create an app →
 * copy API Key (client_id) and API Secret (client_secret). Test base URL is always {@code https://test.api.amadeus.com}.
 * </p>
 */
@Data
@ConfigurationProperties(prefix = "amadeus")
public class AmadeusProperties {

    /** When false, search returns a clear error without calling Amadeus (safe default in repo). */
    private boolean enabled = false;

    /** Self-Service API Key (acts as OAuth2 {@code client_id}). */
    private String apiKey = "";

    /** Self-Service API Secret (acts as OAuth2 {@code client_secret}). */
    private String apiSecret = "";

    /**
     * REST host without trailing slash.
     * Test: {@code https://test.api.amadeus.com} — Production: {@code https://api.amadeus.com} (after Amadeus enables production keys).
     */
    private String baseUrl = "https://test.api.amadeus.com";
}
