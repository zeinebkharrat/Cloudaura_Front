CREATE TABLE IF NOT EXISTS user_digital_passport (
    passport_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    passport_number VARCHAR(32) NOT NULL UNIQUE,
    travel_style_badge VARCHAR(120) NULL,
    bio_note TEXT NULL,
    join_date DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT fk_user_digital_passport_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passport_city_stamp (
    stamp_id INT PRIMARY KEY AUTO_INCREMENT,
    passport_id INT NOT NULL,
    city_id INT NOT NULL,
    visit_count INT NOT NULL DEFAULT 1,
    first_visited_at DATETIME NULL,
    last_visited_at DATETIME NULL,
    emblem_key VARCHAR(120) NULL,
    memory_note TEXT NULL,
    photo_url TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    CONSTRAINT uk_passport_city UNIQUE (passport_id, city_id),
    CONSTRAINT fk_passport_stamp_passport
        FOREIGN KEY (passport_id) REFERENCES user_digital_passport(passport_id) ON DELETE CASCADE,
    CONSTRAINT fk_passport_stamp_city
        FOREIGN KEY (city_id) REFERENCES cities(city_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passport_achievement (
    achievement_id INT PRIMARY KEY AUTO_INCREMENT,
    passport_id INT NOT NULL,
    achievement_code VARCHAR(80) NOT NULL,
    title VARCHAR(140) NOT NULL,
    description TEXT NULL,
    badge_tone VARCHAR(40) NULL,
    unlocked_at DATETIME NULL,
    CONSTRAINT uk_passport_achievement_code UNIQUE (passport_id, achievement_code),
    CONSTRAINT fk_passport_achievement_passport
        FOREIGN KEY (passport_id) REFERENCES user_digital_passport(passport_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passport_photo (
    photo_id INT PRIMARY KEY AUTO_INCREMENT,
    passport_id INT NOT NULL,
    city_id INT NULL,
    photo_url TEXT NOT NULL,
    caption TEXT NULL,
    uploaded_at DATETIME NULL,
    CONSTRAINT fk_passport_photo_passport
        FOREIGN KEY (passport_id) REFERENCES user_digital_passport(passport_id) ON DELETE CASCADE,
    CONSTRAINT fk_passport_photo_city
        FOREIGN KEY (city_id) REFERENCES cities(city_id) ON DELETE SET NULL
);

CREATE INDEX idx_passport_city_stamp_passport ON passport_city_stamp(passport_id);
CREATE INDEX idx_passport_achievement_passport ON passport_achievement(passport_id);
CREATE INDEX idx_passport_photo_passport ON passport_photo(passport_id);
