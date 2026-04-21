-- Normalize legacy cuisine strings to enum constant names expected by Hibernate.
-- This migration is idempotent and safe to run multiple times.

UPDATE restaurants
SET cuisine_type = 'TUNISIAN'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('tunisian', 'tunisienne');

UPDATE restaurants
SET cuisine_type = 'MEDITERRANEAN'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('mediterranean', 'mediterraneenne');

UPDATE restaurants
SET cuisine_type = 'SEAFOOD'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('seafood', 'fruits de mer');

UPDATE restaurants
SET cuisine_type = 'STREET_FOOD'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('street food', 'street-food', 'street_food');

UPDATE restaurants
SET cuisine_type = 'TRADITIONAL'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('traditional', 'traditionnelle');

UPDATE restaurants
SET cuisine_type = 'HEALTHY'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('healthy', 'sain');

UPDATE restaurants
SET cuisine_type = 'MIXED'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('mixed', 'mixte');

UPDATE restaurants
SET cuisine_type = 'ITALIAN'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('italian', 'italienne');

UPDATE restaurants
SET cuisine_type = 'FRENCH'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('french', 'francaise', 'française');

UPDATE restaurants
SET cuisine_type = 'ASIAN'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('asian', 'asiatique');

UPDATE restaurants
SET cuisine_type = 'FAST_FOOD'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('fast food', 'fast-food', 'fast_food', 'rapide');

UPDATE restaurants
SET cuisine_type = 'CAFE'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('cafe', 'café');

UPDATE restaurants
SET cuisine_type = 'VEGETARIAN'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('vegetarian', 'vegetarienne', 'végétarienne');

UPDATE restaurants
SET cuisine_type = 'INTERNATIONAL'
WHERE cuisine_type IS NOT NULL
  AND LOWER(TRIM(cuisine_type)) IN ('international', 'internationale');

-- Keep startup resilient for any unknown legacy values by mapping them to INTERNATIONAL.
UPDATE restaurants
SET cuisine_type = 'INTERNATIONAL'
WHERE cuisine_type IS NOT NULL
  AND cuisine_type NOT IN (
    'TUNISIAN', 'MEDITERRANEAN', 'SEAFOOD', 'STREET_FOOD',
    'TRADITIONAL', 'HEALTHY', 'MIXED', 'ITALIAN', 'FRENCH',
    'ASIAN', 'FAST_FOOD', 'CAFE', 'VEGETARIAN', 'INTERNATIONAL'
  );
