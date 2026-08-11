-- JESI-COSMETIC — photo/video attachments on reviews
-- Run: mysql -u root -p jesi_cosmetic < db/schema_review_media.sql

USE jesi_cosmetic;

CREATE TABLE IF NOT EXISTS review_media (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  review_id     INT NOT NULL,
  media_type    ENUM('image', 'video') NOT NULL,
  url           VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_review (review_id)
) ENGINE=InnoDB;
