// Usage (from your backend folder, after putting Railway public values in .env):
//   node run_schema.js
// Runs railway_all_schema.sql against the database in your .env
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'railway_all_schema.sql'), 'utf8');
  console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME} ...`);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    const [rows] = await conn.query('SHOW TABLES');
    console.log(`Done. ${rows.length} tables:`);
    rows.forEach(r => console.log(' -', Object.values(r)[0]));
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
