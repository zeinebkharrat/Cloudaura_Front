package org.example.backend.repository;

import java.util.Optional;
import org.example.backend.model.TranslationCache;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TranslationCacheRepository extends JpaRepository<TranslationCache, Long> {

    Optional<TranslationCache> findByCacheKey(String cacheKey);
}
