package org.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
public class ActivityReceiptLinkService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String PREFIX = "activity-receipt:";

    @Value("${jwt.secret:change-me}")
    private String signingSecret;

    @Value("${app.public.base-url:${APP_PUBLIC_BASE_URL:}}")
    private String explicitPublicBaseUrl;

    @Value("${app.backend.base-url:http://localhost:9091}")
    private String backendBaseUrl;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String publicBaseUrl;

    public String buildPublicPdfUrl(Integer reservationId) {
        String sig = signReservation(reservationId);
        return resolvePublicBaseUrl()
            + "/api/public/activity-receipts/"
            + reservationId
            + "/pdf?sig="
            + sig;
    }

    public String buildPublicReceiptUrl(Integer reservationId) {
        String sig = signReservation(reservationId);
        return resolvePublicBaseUrl()
            + "/api/public/activity-receipts/"
            + reservationId
            + "?sig="
            + sig;
    }

    public boolean isValidSignature(Integer reservationId, String signature) {
        if (reservationId == null || signature == null || signature.isBlank()) {
            return false;
        }
        String expected = signReservation(reservationId);
        return constantTimeEquals(expected, signature);
    }

    private String signReservation(Integer reservationId) {
        String payload = PREFIX + reservationId;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec key = new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
            mac.init(key);
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to sign activity receipt link", ex);
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = actual.getBytes(StandardCharsets.UTF_8);
        if (a.length != b.length) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i];
        }
        return result == 0;
    }

    private String normalizeBaseUrl(String baseUrl) {
        String base = baseUrl == null ? "http://localhost:4200" : baseUrl.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private String resolvePublicBaseUrl() {
        String configured;
        if (explicitPublicBaseUrl != null && !explicitPublicBaseUrl.isBlank()) {
            configured = explicitPublicBaseUrl.trim();
        } else if (backendBaseUrl != null && !backendBaseUrl.isBlank()) {
            configured = backendBaseUrl.trim();
        } else {
            configured = publicBaseUrl;
        }
        return normalizeBaseUrl(configured);
    }
}
