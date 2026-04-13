CREATE TABLE IF NOT EXISTS stories (
    story_id INT AUTO_INCREMENT PRIMARY KEY,
    author_id INT NOT NULL,
    caption TEXT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    views_count INT NOT NULL DEFAULT 0,
    likes_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    archived_at DATETIME NULL,
    CONSTRAINT fk_stories_author FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_story_author_created (author_id, created_at),
    INDEX idx_story_status_expires (status, expires_at)
);

CREATE TABLE IF NOT EXISTS story_media (
    media_id INT AUTO_INCREMENT PRIMARY KEY,
    story_id INT NOT NULL,
    file_url VARCHAR(1024) NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    uploaded_at DATETIME NOT NULL,
    CONSTRAINT fk_story_media_story FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
    INDEX idx_story_media_story_order (story_id, order_index)
);

CREATE TABLE IF NOT EXISTS story_views (
    view_id INT AUTO_INCREMENT PRIMARY KEY,
    story_id INT NOT NULL,
    viewer_id INT NOT NULL,
    viewed_at DATETIME NOT NULL,
    CONSTRAINT fk_story_views_story FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
    CONSTRAINT fk_story_views_viewer FOREIGN KEY (viewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_story_view (story_id, viewer_id),
    INDEX idx_story_views_story_date (story_id, viewed_at)
);

CREATE TABLE IF NOT EXISTS story_likes (
    like_id INT AUTO_INCREMENT PRIMARY KEY,
    story_id INT NOT NULL,
    liker_id INT NOT NULL,
    liked_at DATETIME NOT NULL,
    CONSTRAINT fk_story_likes_story FOREIGN KEY (story_id) REFERENCES stories(story_id) ON DELETE CASCADE,
    CONSTRAINT fk_story_likes_user FOREIGN KEY (liker_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_story_like (story_id, liker_id),
    INDEX idx_story_likes_story_date (story_id, liked_at)
);
