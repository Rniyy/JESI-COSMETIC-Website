-- JESI-COSMETIC — 4-digit payment PIN, set once per user and reused every payment
-- Run: mysql -u root -p jesi_cosmetic < db/schema_payment_pin.sql

USE jesi_cosmetic;

ALTER TABLE users
  ADD COLUMN payment_pin_hash VARCHAR(255) NULL AFTER password_hash;
