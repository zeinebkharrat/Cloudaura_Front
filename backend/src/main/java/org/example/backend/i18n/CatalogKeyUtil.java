package org.example.backend.i18n;

/**
 * Detects catalog translation keys passed as {@link org.springframework.web.server.ResponseStatusException}
 * reasons or stored on domain exceptions (never user-facing prose).
 */
public final class CatalogKeyUtil {

    private CatalogKeyUtil() {}

    /**
     * @return true if {@code s} looks like a dotted catalog key under approved roots (no spaces).
     */
    public static boolean looksLikeCatalogKey(String s) {
        if (s == null) {
            return false;
        }
        String k = s.trim();
        if (k.isEmpty() || k.length() > 256) {
            return false;
        }
        if (Character.isWhitespace(k.charAt(0)) || Character.isWhitespace(k.charAt(k.length() - 1))) {
            return false;
        }
        for (int i = 0; i < k.length(); i++) {
            char c = k.charAt(i);
            if (!(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '.' || c == '_')) {
                return false;
            }
        }
        if (!k.contains(".")) {
            return false;
        }
        return k.startsWith("api.")
                || k.startsWith("reservation.")
                || k.startsWith("payment.")
                || k.startsWith("activity.")
                || k.startsWith("product.")
                || k.startsWith("accommodation.")
                || k.startsWith("restaurant.")
                || k.startsWith("event.")
                || k.startsWith("shop.")
                || k.startsWith("city.")
                || k.startsWith("hotel.")
                || k.startsWith("room.")
                || k.startsWith("transport.")
                || k.startsWith("roadmap.")
                || k.startsWith("quiz.")
                || k.startsWith("crossword.")
                || k.startsWith("puzzle.")
                || k.startsWith("catalog.")
                || k.startsWith("games.")
                || k.startsWith("gamification.");
    }

    /**
     * True when either the persisted field or the catalog-resolved value still looks like a
     * placeholder key (data quality issue).
     */
    public static boolean isBadI18nPlaceholder(String rawEntity, String resolved) {
        String raw = rawEntity == null ? "" : rawEntity.trim();
        String res = resolved == null ? "" : resolved.trim();
        return looksLikeCatalogKey(raw) || looksLikeCatalogKey(res);
    }
}
