package org.example.backend.dto;

/**
 * @param enabled                         true when both secret (server) and site key are configured.
 * @param siteKey                         public site key.
 * @param secretConfiguredButMissingSiteKey true when secret is set but site key is blank (misconfiguration).
 * @param version                         {@code v2} (checkbox) or {@code v3} (score / execute) — must match the key type in Google Admin.
 */
public record CaptchaConfigResponse(
        boolean enabled,
        String siteKey,
        boolean secretConfiguredButMissingSiteKey,
        String version
) {
}
