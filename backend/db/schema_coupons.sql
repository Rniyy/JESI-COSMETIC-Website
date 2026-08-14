-- JESI-COSMETIC — coupon/promo codes
-- Run: mysql -u root -p jesi_cosmetic < db/schema_coupons.sql

USE jesi_cosmetic;

CREATE TABLE IF NOT EXISTS coupons (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(32) NOT NULL,
  discount_type     ENUM('percent', 'fixed') NOT NULL,
  discount_value    DECIMAL(10,2) NOT NULL,
  min_order_amount  DECIMAL(10,2) NULL,
  max_uses          INT NULL,
  times_used        INT NOT NULL DEFAULT 0,
  expires_at        DATE NULL,
  active            TINYINT(1) NOT NULL DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_code (code)
) ENGINE=InnoDB;

ALTER TABLE orders
  ADD COLUMN coupon_code VARCHAR(32) NULL AFTER shipping_fee,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER coupon_code;
