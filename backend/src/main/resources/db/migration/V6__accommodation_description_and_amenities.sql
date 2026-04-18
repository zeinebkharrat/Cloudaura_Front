ALTER TABLE accommodations
    ADD COLUMN description TEXT NULL;

CREATE TABLE IF NOT EXISTS accommodation_amenities (
    accommodation_id INT NOT NULL,
    sort_order INT NOT NULL,
    amenity VARCHAR(120) NOT NULL,
    PRIMARY KEY (accommodation_id, sort_order),
    CONSTRAINT fk_accommodation_amenities_accommodation
        FOREIGN KEY (accommodation_id)
        REFERENCES accommodations (accommodation_id)
        ON DELETE CASCADE
);

-- Seed description text so existing properties immediately expose DB-backed About content.
UPDATE accommodations a
LEFT JOIN cities c ON c.city_id = a.city_id
SET a.description = CONCAT(
    a.name,
    ' offers a comfortable stay in ',
    COALESCE(c.name, 'Tunisia'),
    ' with convenient access to local attractions and transport.'
)
WHERE a.description IS NULL OR TRIM(a.description) = '';

-- Seed baseline amenities so existing properties immediately expose DB-backed Highlights.
INSERT INTO accommodation_amenities (accommodation_id, sort_order, amenity)
SELECT a.accommodation_id, base.sort_order, base.amenity
FROM accommodations a
JOIN (
    SELECT 0 AS sort_order, 'Free WiFi' AS amenity
    UNION ALL SELECT 1, 'Air conditioning'
    UNION ALL SELECT 2, '24/7 front desk'
    UNION ALL SELECT 3, 'Daily housekeeping'
    UNION ALL SELECT 4, 'Breakfast available'
    UNION ALL SELECT 5, 'On-site parking'
) AS base
LEFT JOIN accommodation_amenities existing
    ON existing.accommodation_id = a.accommodation_id
   AND existing.sort_order = base.sort_order
WHERE existing.accommodation_id IS NULL;
