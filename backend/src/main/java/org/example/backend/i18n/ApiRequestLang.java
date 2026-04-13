package org.example.backend.i18n;

/**
 * Holds the normalized API language for the current HTTP request (set by {@link LangCaptureFilter}).
 *
 * <p>Populated for all {@code /api/**} routes except {@code /api/translate} (which reads {@code lang}
 * from the request body). Always call {@link #get()} in the service layer, never in the repository
 * layer.
 *
 * <p>Always clear after the request; do not use from {@code @Async} without explicit propagation.
 */
public final class ApiRequestLang {

    private static final ThreadLocal<String> LANG = new ThreadLocal<>();
    /** When true, {@link org.example.backend.service.CatalogTranslationService} returns DB fallbacks only (back office). */
    private static final ThreadLocal<Boolean> CATALOG_RESOLUTION_DISABLED = new ThreadLocal<>();

    private ApiRequestLang() {
    }

    public static void setFromRaw(String rawQueryLang) {
        LANG.set(LanguageUtil.normalize(rawQueryLang));
    }

    /**
     * Back-office routes should show and edit source strings from entities, not rows from {@code translations}.
     */
    public static void setCatalogResolutionDisabled(boolean disabled) {
        if (disabled) {
            CATALOG_RESOLUTION_DISABLED.set(Boolean.TRUE);
        } else {
            CATALOG_RESOLUTION_DISABLED.remove();
        }
    }

    public static boolean isCatalogResolutionDisabled() {
        return Boolean.TRUE.equals(CATALOG_RESOLUTION_DISABLED.get());
    }

    public static String get() {
        String s = LANG.get();
        return s != null ? s : "fr";
    }

    public static void clear() {
        LANG.remove();
        CATALOG_RESOLUTION_DISABLED.remove();
    }
}
