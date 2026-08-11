-- JESI-COSMETIC — in-app notifications (starting with "back in stock" alerts)
-- Run: mysql -u root -p jesi_cosmetic < db/schema_notifications.sql

USE jesi_cosmetic;

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
