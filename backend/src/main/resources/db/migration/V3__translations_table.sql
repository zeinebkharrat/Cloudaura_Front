CREATE TABLE IF NOT EXISTS translations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    translation_key VARCHAR(500) NOT NULL,
    lang VARCHAR(8) NOT NULL,
    value TEXT NOT NULL,
    UNIQUE KEY uk_key_lang (translation_key, lang)
);
