-- JESI-COSMETIC — schema additions for Auth, Accounts, Orders & Admin
-- Run after your existing schema.sql: mysql -u root -p jesi_cosmetic < db/schema_auth_additions.sql

USE jesi_cosmetic;

-- ─────────────────────────────────────────────
-- USERS  (Phase 1)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100)  NOT NULL,
  email          VARCHAR(255)  NOT NULL,
  password_hash  VARCHAR(255)  NOT NULL,
  role           ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_email (email)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- PASSWORD RESET TOKENS  (Phase 2)
-- We store a hash of the token, never the raw token, same principle as a password.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  used_at       TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- ADDRESSES  (Phase 3)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  label          VARCHAR(50)  NULL,       -- "Home", "Work", etc.
  full_name      VARCHAR(255) NOT NULL,
  phone          VARCHAR(32)  NULL,
  line1          VARCHAR(255) NOT NULL,
  line2          VARCHAR(255) NULL,
  city           VARCHAR(100) NOT NULL,
  state_province VARCHAR(100) NULL,
  postal_code    VARCHAR(32)  NULL,
  country        VARCHAR(100) NOT NULL DEFAULT 'Cambodia',
  is_default     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- ORDERS + ORDER ITEMS  (Phase 4)
-- order_items snapshots product_name/price at purchase time, so order
-- history stays accurate even if a product's price changes or it's deleted later.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  address_id    INT NULL,
  status        ENUM('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  subtotal      DECIMAL(10,2) NOT NULL,
  shipping_fee  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL,
  placed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  order_id       INT NOT NULL,
  product_id     INT NULL,               -- kept NULLable so history survives product deletion
  product_name   VARCHAR(255) NOT NULL,  -- snapshot
  product_price  DECIMAL(10,2) NOT NULL, -- snapshot
  quantity       INT NOT NULL DEFAULT 1,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order (order_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- EXTEND CART & WISHLIST to support logged-in users
-- session_id stays for guests; user_id is used once someone logs in.
-- A row will have EITHER a session_id OR a user_id set — the app decides
-- which to query by, based on whether req.user exists.
-- ─────────────────────────────────────────────
ALTER TABLE cart_items
  ADD COLUMN user_id INT NULL AFTER session_id,
  ADD CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD UNIQUE KEY uniq_user_product (user_id, product_id),
  MODIFY COLUMN session_id VARCHAR(36) NULL;

ALTER TABLE wishlist_items
  ADD COLUMN user_id INT NULL AFTER session_id,
  ADD CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD UNIQUE KEY uniq_user_product_wl (user_id, product_id),
  MODIFY COLUMN session_id VARCHAR(36) NULL;
