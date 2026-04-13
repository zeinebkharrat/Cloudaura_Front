CREATE TABLE IF NOT EXISTS translation_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(800) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cache_key (cache_key),
    KEY idx_translation_cache_key (cache_key)
);
