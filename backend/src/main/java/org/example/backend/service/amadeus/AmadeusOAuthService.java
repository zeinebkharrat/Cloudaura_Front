package org.example.backend.service.amadeus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.config.AmadeusProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Clock;
import java.util.concurrent.atomic.AtomicReference;

/**
 * OAuth2 client_credentials against Amadeus {@code /v1/security/oauth2/token}.
 * <p>
 * Caches the bearer token until shortly before {@code expires_in} to avoid hammering the token endpoint.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AmadeusOAuthService {

    private final AmadeusProperties amadeusProperties;
    private final WebClient amadeusWebClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.systemUTC();

    /** Current access_token, or null if none cached. */
    private final AtomicReference<String> accessToken = new AtomicReference<>();
    /** Epoch millis after which the token must be refreshed (already includes safety margin). */
    private final AtomicReference<Long> tokenExpiryEpochMs = new AtomicReference<>(0L);

    /**
     * Returns a valid Bearer token, refreshing from Amadeus when missing or near expiry.
     */
    public String getAccessToken() {
        if (!amadeusProperties.isEnabled()) {
            throw new IllegalStateException("amadeus.disabled");
        }
        if (amadeusProperties.getApiKey() == null || amadeusProperties.getApiKey().isBlank()
                || amadeusProperties.getApiSecret() == null || amadeusProperties.getApiSecret().isBlank()) {
            throw new IllegalStateException("amadeus.missing_credentials");
        }

        long now = clock.instant().toEpochMilli();
        Long exp = tokenExpiryEpochMs.get();
        String cached = accessToken.get();
        if (cached != null && exp != null && now < exp) {
            return cached;
        }

        synchronized (this) {
            now = clock.instant().toEpochMilli();
            exp = tokenExpiryEpochMs.get();
            cached = accessToken.get();
            if (cached != null && exp != null && now < exp) {
                return cached;
            }

            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "client_credentials");
            form.add("client_id", amadeusProperties.getApiKey().trim());
            form.add("client_secret", amadeusProperties.getApiSecret().trim());

            try {
                String body = amadeusWebClient.post()
                        .uri("/v1/security/oauth2/token")
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                        .body(BodyInserters.fromFormData(form))
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                JsonNode root = objectMapper.readTree(body);
                String token = root.path("access_token").asText(null);
                int expiresIn = root.path("expires_in").asInt(1799);
                if (token == null || token.isBlank()) {
                    throw new IllegalStateException("amadeus.token_empty");
                }
                accessToken.set(token);
                long marginSeconds = 60;
                long ttlMs = Math.max(30_000L, (expiresIn - marginSeconds) * 1000L);
                tokenExpiryEpochMs.set(clock.instant().toEpochMilli() + ttlMs);
                log.info("Amadeus OAuth token acquired, ttl approx {} ms", ttlMs);
                return token;
            } catch (WebClientResponseException e) {
                log.error("Amadeus OAuth failed: status={} body={}", e.getStatusCode().value(), e.getResponseBodyAsString());
                throw new IllegalStateException("amadeus.oauth_http_" + e.getStatusCode().value(), e);
            } catch (Exception e) {
                log.error("Amadeus OAuth error", e);
                throw new IllegalStateException("amadeus.oauth_error", e);
            }
        }
    }

    /** Clears cache (e.g. after 401 on a resource call). */
    public void invalidate() {
        accessToken.set(null);
        tokenExpiryEpochMs.set(0L);
    }
}
