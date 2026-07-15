-- JESI-COSMETIC database schema
-- Run once: mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS jesi_cosmetic
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE jesi_cosmetic;

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
