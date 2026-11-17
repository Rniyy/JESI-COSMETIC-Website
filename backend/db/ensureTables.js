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
};
