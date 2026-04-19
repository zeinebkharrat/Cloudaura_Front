package org.example.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "duffel")
public class DuffelProperties {

    private String apiKey = "";
    private String baseUrl = "https://api.duffel.com";
    private String version = "v2";
    private int defaultLimit = 20;
    private int connectTimeoutMs = 8_000;
    private int readTimeoutMs = 15_000;

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
