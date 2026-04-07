-- Run on database Yallatn (transport_reservations)
ALTER TABLE transport_reservations
  ADD COLUMN reminder_one_hour_sent TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_transport_res_reminder
  ON transport_reservations (status, travel_date, reminder_one_hour_sent);

-- If payment_method is still MySQL ENUM without STRIPE, run migration_transport_payment_columns_varchar.sql
-- (or let SchemaRepairRunner convert ENUM → VARCHAR on startup).

-- Manual test row (15 min ahead; matches TransportDepartureReminderScheduler testing window now+14m..now+16m):
-- INSERT INTO transport_reservations
-- (user_id, transport_id, travel_date, number_of_seats, status,
--  payment_method, reminder_one_hour_sent, total_price, created_at)
-- VALUES
-- (1, 69, DATE_ADD(NOW(), INTERVAL 15 MINUTE),
--  1, 'CONFIRMED', 'CASH', 0, 22.5, NOW());
