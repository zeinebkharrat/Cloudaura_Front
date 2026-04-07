-- Fix MySQL ENUM → VARCHAR for transport reservation payment columns.
-- Error 1265 "Data truncated for column 'payment_method'" happens when the column is
-- ENUM('CASH','KONNECT') and the app persists STRIPE.
--
-- Option A: run this once on database Yallatn, then restart the backend.
-- Option B: rely on SchemaRepairRunner (same ALTER on startup if column is still ENUM).

USE Yallatn;

ALTER TABLE transport_reservations
  MODIFY COLUMN payment_method VARCHAR(20);

ALTER TABLE transport_reservations
  MODIFY COLUMN payment_status VARCHAR(20);
