ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS total_views INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS repost_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS post_score DOUBLE NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS monthly_score DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lifetime_score DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reset_date DATETIME NULL;

CREATE TABLE IF NOT EXISTS post_views (
    view_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    month_key VARCHAR(7) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_post_views_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_post_views_post FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY uk_post_views_user_post_month (user_id, post_id, month_key),
    INDEX idx_post_views_post_month (post_id, month_key)
);
