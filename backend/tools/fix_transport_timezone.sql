-- Transport reservation timezone diagnostics and fix
-- Run this script on the target MySQL database.

-- 1) Inspect MySQL timezone state
SELECT @@global.time_zone AS global_tz,
       @@session.time_zone AS session_tz,
       NOW() AS server_now,
       UTC_TIMESTAMP() AS utc_now,
       TIMEDIFF(NOW(), UTC_TIMESTAMP()) AS server_minus_utc;

-- 2) Optional for current session: force Tunis offset
SET time_zone = '+01:00';

SELECT @@session.time_zone AS session_tz_after_set,
       NOW() AS server_now_after_set,
       UTC_TIMESTAMP() AS utc_now_after_set,
       TIMEDIFF(NOW(), UTC_TIMESTAMP()) AS server_minus_utc_after_set;

-- 3) Inspect travel_date column type
SHOW COLUMNS FROM transport_reservations LIKE 'travel_date';

SELECT TABLE_SCHEMA,
       TABLE_NAME,
       COLUMN_NAME,
       DATA_TYPE,
       COLUMN_TYPE,
       IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'transport_reservations'
  AND COLUMN_NAME = 'travel_date';

-- 4) Convert to DATETIME only when current type is TIMESTAMP
SET @needs_alter := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transport_reservations'
      AND COLUMN_NAME = 'travel_date'
      AND DATA_TYPE = 'timestamp'
);

SET @sql := IF(
    @needs_alter > 0,
    'ALTER TABLE transport_reservations MODIFY travel_date DATETIME NULL',
    'SELECT ''No ALTER needed: travel_date is already DATETIME or another non-TIMESTAMP type'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Final check
SHOW COLUMNS FROM transport_reservations LIKE 'travel_date';
