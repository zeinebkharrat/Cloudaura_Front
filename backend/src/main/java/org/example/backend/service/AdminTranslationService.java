package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.i18n.LanguageUtil;
import org.example.backend.repository.CatalogTranslationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminTranslationService {

    private final CatalogTranslationRepository catalogTranslationRepository;

    @Value("${app.translation.enabled:true}")
    private boolean translationEnabled;

    @Transactional
    public void overrideTranslation(String translationKey, String lang, String value) {
        if (!translationEnabled) {
            return;
        }
        String k = translationKey != null ? translationKey.trim() : "";
        String l = LanguageUtil.normalize(lang);
        String v = value != null ? value : "";
        catalogTranslationRepository.upsertTranslation(k, l, v);
    }
}
