CREATE TABLE IF NOT EXISTS accommodation_reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    accommodation_id INT NOT NULL,
    user_id INT NOT NULL,
    stars INT NOT NULL,
    comment_text TEXT NOT NULL,
    original_comment_text TEXT NULL,
    sanitized_comment_text TEXT NULL,
    abuse_categories TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_accommodation_reviews_accommodation
        FOREIGN KEY (accommodation_id)
        REFERENCES accommodations (accommodation_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_accommodation_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT uk_accommodation_review_user UNIQUE (accommodation_id, user_id)
);

CREATE INDEX idx_accommodation_reviews_accommodation
    ON accommodation_reviews (accommodation_id);
