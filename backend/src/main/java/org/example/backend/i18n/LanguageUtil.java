package org.example.backend.i18n;

/**
 * Normalizes UI / API language codes to supported catalog languages.
 */
public final class LanguageUtil {

    private LanguageUtil() {
    }

    public static String normalize(String lang) {
        if (lang == null || lang.isBlank()) {
            return "fr";
        }
        String t = lang.trim().toLowerCase();
        if (t.startsWith("ar")) {
            return "ar";
        }
        if (t.startsWith("en")) {
            return "en";
        }
        return "fr";
    }
}
