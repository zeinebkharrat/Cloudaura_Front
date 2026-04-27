-- Backfill missing city_id in events using city names found in venue.
-- Run this on your DB, then review remaining NULL rows manually.

-- 1) Exact match: venue is exactly a city name (ignoring spaces/case).
UPDATE events e
JOIN cities c
  ON LOWER(TRIM(e.venue)) = LOWER(TRIM(c.name))
SET e.city_id = c.city_id
WHERE e.city_id IS NULL
  AND e.venue IS NOT NULL
  AND TRIM(e.venue) <> '';

-- 2) Fuzzy contains: venue contains city name (example: "... Tunis").
UPDATE events e
JOIN cities c
  ON LOWER(e.venue) LIKE CONCAT('%', LOWER(c.name), '%')
SET e.city_id = c.city_id
WHERE e.city_id IS NULL
  AND e.venue IS NOT NULL
  AND TRIM(e.venue) <> '';

-- 3) Optional manual mapping for known landmarks (adjust if needed).
-- ESPRIT is usually in Ariana.
UPDATE events e
JOIN cities c ON LOWER(c.name) = 'ariana'
SET e.city_id = c.city_id
WHERE e.city_id IS NULL
  AND LOWER(e.venue) LIKE '%esprit%';

-- 4) Inspect unresolved rows.
SELECT event_id, title, venue, city_id
FROM events
WHERE city_id IS NULL
ORDER BY event_id;
