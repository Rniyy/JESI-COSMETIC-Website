-- JESI-COSMETIC — multi-image product gallery
-- Run: mysql -u root -p jesi_cosmetic < db/schema_product_images.sql

USE jesi_cosmetic;

CREATE TABLE IF NOT EXISTS product_images (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  image_url     VARCHAR(255) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB;
