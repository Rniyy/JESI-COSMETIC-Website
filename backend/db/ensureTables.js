const pool = require('./pool');

/**
 * Creates tables added after the original schema, if they don't exist yet,
 * so a fresh deploy never needs a manual SQL step for them.
 */
module.exports = async function ensureTables() {
  await pool.query(`
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
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      order_id      INT NOT NULL,
      user_id       INT NOT NULL,
      provider      VARCHAR(20)  NOT NULL DEFAULT 'payway',
      tran_id       VARCHAR(20)  NOT NULL,
      amount        DECIMAL(10,2) NOT NULL,
      currency      VARCHAR(3)   NOT NULL DEFAULT 'USD',
      status        ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
      payment_type  VARCHAR(30)  NULL,
      bank_ref      VARCHAR(60)  NULL,
      apv           VARCHAR(20)  NULL,
      note          VARCHAR(255) NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at       TIMESTAMP NULL,
      UNIQUE KEY uniq_tran (tran_id),
      INDEX idx_order (order_id)
    ) ENGINE=InnoDB
  `);
};