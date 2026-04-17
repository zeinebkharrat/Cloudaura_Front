package org.example.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code aviationstack.*} from application.properties / environment.
 * Set {@code AVIATIONSTACK_ACCESS_KEY} for production; never hard-code keys in source.
 */
@Data
@ConfigurationProperties(prefix = "aviationstack")
public class AviationStackProperties {

    /** API access key (Aviationstack dashboard). */
    private String accessKey = "";

    /** Base URL without trailing slash, e.g. https://api.aviationstack.com/v1 */
    private String baseUrl = "https://api.aviationstack.com/v1";

    private int defaultLimit = 15;

    private int connectTimeoutMs = 8_000;

    private int readTimeoutMs = 15_000;

    public boolean hasAccessKey() {
        return accessKey != null && !accessKey.isBlank();
    }
}
