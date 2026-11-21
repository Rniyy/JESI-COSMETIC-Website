-- JESI-COSMETIC — online payments (ABA PayWay)
-- (The server also creates this table automatically on startup if it is missing.)

CREATE TABLE IF NOT EXISTS payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  user_id       INT NOT NULL,
  provider      VARCHAR(20)  NOT NULL DEFAULT 'payway',
  tran_id       VARCHAR(20)  NOT NULL,           -- our unique id sent to PayWay (max 20 chars)
  amount        DECIMAL(10,2) NOT NULL,          -- taken from the order total in the database
  currency      VARCHAR(3)   NOT NULL DEFAULT 'USD',
  status        ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  payment_type  VARCHAR(30)  NULL,
  bank_ref      VARCHAR(60)  NULL,
  apv           VARCHAR(20)  NULL,
  note          VARCHAR(255) NULL,               -- e.g. "paid but order was no longer payable — check/refund"
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at       TIMESTAMP NULL,
  UNIQUE KEY uniq_tran (tran_id),
  INDEX idx_order (order_id)
) ENGINE=InnoDB;
