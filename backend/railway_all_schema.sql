-- ===== schema.sql =====
-- JESI-COSMETIC database schema
-- Run once: mysql -u root -p < db/schema.sql



-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  category      VARCHAR(64)  NOT NULL,      -- serums | moisturizers | devices | cleansers | pads | sets
  brand         VARCHAR(64)  NOT NULL DEFAULT 'Medicube',
  price         DECIMAL(10,2) NOT NULL,
  old_price     DECIMAL(10,2) NULL,
  image_url     VARCHAR(255) NULL,
  image_class   VARCHAR(16)  NULL,          -- pi1..pi6, matches the CSS swatch classes on the frontend
  rating        DECIMAL(2,1) NULL,
  review_count  VARCHAR(16)  NULL,          -- kept as text so "1.2k" style values round-trip untouched
  badge         VARCHAR(32)  NULL,          -- Best | New | Sale | NULL
  description   TEXT NULL,
  in_stock      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  FULLTEXT INDEX idx_name_search (name)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- CART ITEMS (guest cart, scoped by session cookie — no login in this frontend)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    VARCHAR(36) NOT NULL,
  product_id    INT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_session_product (session_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_session (session_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- WISHLIST ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    VARCHAR(36) NOT NULL,
  product_id    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_session_product (session_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_session (session_id)
) ENGINE=InnoDB;

-- ===== schema_auth_additions.sql =====
-- JESI-COSMETIC — schema additions for Auth, Accounts, Orders & Admin
-- Run after your existing schema.sql: mysql -u root -p jesi_cosmetic < db/schema_auth_additions.sql


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

-- ===== schema_reviews.sql =====
-- JESI-COSMETIC — written product reviews
-- Run: mysql -u root -p jesi_cosmetic < db/schema_reviews.sql


CREATE TABLE IF NOT EXISTS reviews (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NULL,
  user_id       INT NOT NULL,
  order_id      INT NOT NULL,
  rating        TINYINT NOT NULL,
  comment       TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- ===== schema_review_media.sql =====
-- JESI-COSMETIC — photo/video attachments on reviews
-- Run: mysql -u root -p jesi_cosmetic < db/schema_review_media.sql


CREATE TABLE IF NOT EXISTS review_media (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  review_id     INT NOT NULL,
  media_type    ENUM('image', 'video') NOT NULL,
  url           VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_review (review_id)
) ENGINE=InnoDB;

-- ===== schema_coupons.sql =====
-- JESI-COSMETIC — coupon/promo codes
-- Run: mysql -u root -p jesi_cosmetic < db/schema_coupons.sql


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

-- ===== schema_notifications.sql =====
-- JESI-COSMETIC — in-app notifications (starting with "back in stock" alerts)
-- Run: mysql -u root -p jesi_cosmetic < db/schema_notifications.sql


CREATE TABLE IF NOT EXISTS notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  type          VARCHAR(32) NOT NULL DEFAULT 'back_in_stock',
  product_id    INT NULL,
  message       VARCHAR(255) NOT NULL,
  is_read       TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ===== schema_product_images.sql =====
-- JESI-COSMETIC — multi-image product gallery
-- Run: mysql -u root -p jesi_cosmetic < db/schema_product_images.sql


CREATE TABLE IF NOT EXISTS product_images (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  image_url     VARCHAR(255) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- ===== schema_order_lifecycle.sql =====
-- JESI-COSMETIC — order lifecycle redesign (corrected order of operations)
-- Run after your existing schema files:
-- mysql -u root -p jesi_cosmetic < db/schema_order_lifecycle.sql


-- Step 1: widen the enum to include BOTH old and new values first, so the
-- remapping UPDATEs below (which write the new values) aren't rejected
-- while old rows still hold old values.
ALTER TABLE orders
  MODIFY COLUMN status ENUM('pending','processing','shipped','delivered','cancelled',
                             'to_pay','to_receive','to_review','completed')
  NOT NULL DEFAULT 'to_pay';

-- Step 2: remap every existing row onto the new lifecycle.
UPDATE orders SET status = 'to_receive' WHERE status IN ('pending', 'processing');
UPDATE orders SET status = 'to_review'  WHERE status = 'shipped';
UPDATE orders SET status = 'completed'  WHERE status = 'delivered';
-- 'cancelled' already matches the new set, left as-is.

-- Step 3: now that every row uses a new-lifecycle value, narrow the enum
-- down to just the final 5 options.
ALTER TABLE orders
  MODIFY COLUMN status ENUM('to_pay', 'to_receive', 'to_review', 'completed', 'cancelled')
  NOT NULL DEFAULT 'to_pay';

ALTER TABLE orders
  ADD COLUMN rating TINYINT NULL AFTER status;

-- ===== schema_payment_pin.sql =====
-- JESI-COSMETIC — 4-digit payment PIN, set once per user and reused every payment
-- Run: mysql -u root -p jesi_cosmetic < db/schema_payment_pin.sql


ALTER TABLE users
  ADD COLUMN payment_pin_hash VARCHAR(255) NULL AFTER password_hash;

-- ===== schema_stock_addition.sql =====
-- JESI-COSMETIC — add real stock quantity tracking
-- Run after your existing schema files:
-- mysql -u root -p jesi_cosmetic < db/schema_stock_addition.sql


ALTER TABLE products
  ADD COLUMN stock_quantity INT NOT NULL DEFAULT 50 AFTER in_stock;

-- Keep in_stock consistent with the new quantity column for any existing rows
-- (in_stock stays as a fast filter column; stock_quantity is now the source of truth)
UPDATE products SET in_stock = IF(stock_quantity > 0, 1, 0);

