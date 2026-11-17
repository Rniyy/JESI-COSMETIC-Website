-- JESI-COSMETIC — messages sent from the "Contact us" form
-- (The server also creates this table automatically on startup if it is missing.)

CREATE TABLE IF NOT EXISTS contact_messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(190) NOT NULL,
  subject     VARCHAR(120) NOT NULL,
  message     TEXT NOT NULL,
  status      ENUM('new', 'read') NOT NULL DEFAULT 'new',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB;
