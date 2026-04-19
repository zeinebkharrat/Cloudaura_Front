-- Remove translation rows that should not be catalog-backed (addresses, cuisine codes, activity type/address lines).
DELETE FROM translations
WHERE translation_key LIKE 'restaurant.%.address'
   OR translation_key LIKE 'restaurant.%.cuisineType'
   OR translation_key LIKE 'activity.%.type'
   OR translation_key LIKE 'activity.%.address';
