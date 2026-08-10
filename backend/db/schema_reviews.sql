-- JESI-COSMETIC — written product reviews
-- Run: mysql -u root -p jesi_cosmetic < db/schema_reviews.sql

USE jesi_cosmetic;

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
