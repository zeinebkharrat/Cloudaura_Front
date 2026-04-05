-- ============================================================
-- YallaTN+ — Script de Reset & Re-seeding complet
-- Exécuter dans l'ordre exact pour vider les données obsolètes
-- et laisser DataInitializer recréer tout au redémarrage.
-- ============================================================

-- 1. Désactiver les contraintes FK temporairement (MySQL)
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Vider les tables dépendantes d'abord (enfants → parents)
TRUNCATE TABLE transport_reservations;
TRUNCATE TABLE reservations;
TRUNCATE TABLE rooms;
TRUNCATE TABLE accommodations;
TRUNCATE TABLE transports;
TRUNCATE TABLE drivers;
TRUNCATE TABLE vehicles;
TRUNCATE TABLE cities;

-- 3. Réactiver les contraintes FK
SET FOREIGN_KEY_CHECKS = 1;

-- 4. Redémarrer le backend Spring Boot → DataInitializer s'exécute automatiquement
--    et insère les 24 gouvernorats + 120 hôtels + véhicules + chauffeurs + transports demo.

-- ============================================================
-- VARIANTE PostgreSQL (si vous utilisez Postgres)
-- ============================================================
-- TRUNCATE TABLE transport_reservations, reservations, rooms, accommodations,
--               transports, drivers, vehicles, cities RESTART IDENTITY CASCADE;
-- ============================================================
