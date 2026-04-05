-- Fix MySQL ENUM → VARCHAR for status columns in orders and order_items tables.
-- Run this once against your `Yallatn` database, then restart the Spring Boot backend.

USE Yallatn;

-- Fix orders.status
ALTER TABLE orders
    MODIFY COLUMN status VARCHAR(20);

-- Fix order_items.status
ALTER TABLE order_items
    MODIFY COLUMN status VARCHAR(20);
