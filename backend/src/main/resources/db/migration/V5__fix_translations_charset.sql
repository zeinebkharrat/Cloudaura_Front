-- Setting session and default charset for the database
SET NAMES utf8mb4;
ALTER DATABASE Yallatn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Correcting the charset and enabling DYNAMIC row format to support longer indexes with utf8mb4
ALTER TABLE translations ROW_FORMAT=DYNAMIC;
ALTER TABLE translations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE translation_cache ROW_FORMAT=DYNAMIC;
ALTER TABLE translation_cache CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;




