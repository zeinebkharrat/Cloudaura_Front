ALTER TABLE reservations
    ADD COLUMN guest_count INT NOT NULL DEFAULT 1;
