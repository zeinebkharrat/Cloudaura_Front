package org.example.backend.util;

/**
 * Normalizes {@code stripe.api.key} from config (trim, BOM) and detects real Stripe secret keys used for Checkout.
 */
public final class StripeSecretKeys {

    private StripeSecretKeys() {}

    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String t = raw.strip();
        while (t.startsWith("\uFEFF")) {
            t = t.substring(1).strip();
        }
        return t;
    }

    /**
     * {@code true} when Checkout Session should be created (not local transport payment simulation).
     */
    public static boolean isStripeSecretConfigured(String normalized) {
        if (normalized == null || normalized.isEmpty()) {
            return false;
        }
        if ("disabled".equalsIgnoreCase(normalized)) {
            return false;
        }
        return normalized.startsWith("sk_test_") || normalized.startsWith("sk_live_");
    }
}
