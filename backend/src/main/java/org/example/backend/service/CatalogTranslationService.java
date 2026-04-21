package org.example.backend.service;

import org.example.backend.i18n.ApiRequestLang;
import org.example.backend.i18n.LanguageUtil;
import org.example.backend.model.CatalogTranslation;
import org.example.backend.repository.CatalogTranslationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Key-based business translations stored in the {@code translations} table.
 * Separate from {@link TranslationService} (MyMemory runtime text proxy).
 */
@Service
@RequiredArgsConstructor
public class CatalogTranslationService {

    private final CatalogTranslationRepository repository;

    @Value("${app.translation.enabled:true}")
    private boolean translationEnabled;

    @Transactional(readOnly = true)
    public Optional<String> find(String translationKey, String lang) {
        if (!translationEnabled) {
            return Optional.empty();
        }
        if (ApiRequestLang.isCatalogResolutionDisabled()) {
            return Optional.empty();
        }
        if (translationKey == null || translationKey.isBlank()) {
            return Optional.empty();
        }
        String l = LanguageUtil.normalize(lang);
        return repository.findByTranslationKeyAndLang(translationKey.trim(), l)
                .map(CatalogTranslation::getValue);
    }

    /**
     * Resolves a catalog entry for {@code lang}, then French, then returns {@code fallback}.
     */
    @Transactional(readOnly = true)
    public String resolve(String translationKey, String lang, String fallback) {
        if (!translationEnabled) {
            return fallback != null ? fallback : "";
        }
        if (ApiRequestLang.isCatalogResolutionDisabled()) {
            return fallback != null ? fallback : "";
        }
        if (translationKey == null || translationKey.isBlank()) {
            return fallback != null ? fallback : "";
        }
        String key = translationKey.trim();
        String l = LanguageUtil.normalize(lang);
        Optional<String> hit = repository.findByTranslationKeyAndLang(key, l).map(CatalogTranslation::getValue);
        if (hit.isPresent() && !hit.get().isBlank()) {
            return hit.get();
        }
        if (!"fr".equals(l)) {
            hit = repository.findByTranslationKeyAndLang(key, "fr").map(CatalogTranslation::getValue);
            if (hit.isPresent() && !hit.get().isBlank()) {
                return hit.get();
            }
        }
        return fallback != null ? fallback : key;
    }

    /**
     * Resolves using the current request language from {@link ApiRequestLang} (set by {@link org.example.backend.config.LangCaptureFilter}).
     */
    @Transactional(readOnly = true)
    public String resolveForRequest(String translationKey, String fallback) {
        return resolve(translationKey, ApiRequestLang.get(), fallback);
    }

    /**
     * Same as {@link #resolveForRequest(String, String)} with the key itself as the last-resort
     * fallback (when nothing is stored and no caller fallback is desired).
     */
    @Transactional(readOnly = true)
    public String resolveForRequest(String translationKey) {
        return resolveForRequest(translationKey, translationKey);
    }

    /**
     * Resolves {@code entityType}.{id}.{field} for the current request language, then French, then
     * {@code fallback}. If nothing is stored and resolution falls back to the constructed key,
     * returns {@code fallback} so callers can keep the original DB field.
     */
    @Transactional(readOnly = true)
    public String resolveEntityField(long id, String entityType, String field, String fallback) {
        String key = entityType + "." + id + "." + field;
        String result = resolveForRequest(key, fallback);
        return result.equals(key) ? fallback : result;
    }
}
