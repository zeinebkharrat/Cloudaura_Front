package org.example.backend.repository;

import org.example.backend.model.CatalogTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CatalogTranslationRepository extends JpaRepository<CatalogTranslation, Long> {

    Optional<CatalogTranslation> findByTranslationKeyAndLang(String translationKey, String lang);

    boolean existsByTranslationKeyAndLang(String translationKey, String lang);

    long countByLang(String lang);

    /**
     * MySQL idempotent upsert for {@code translations} (never deletes rows).
     */
    @Modifying
    @Query(
            value =
                    "INSERT INTO translations (translation_key, lang, translation_text, value) VALUES (:k, :l, :v, :v) "
                            + "ON DUPLICATE KEY UPDATE translation_text = VALUES(translation_text), value = VALUES(value)",
            nativeQuery = true)
    void upsertTranslation(@Param("k") String translationKey, @Param("l") String lang, @Param("v") String value);
}
