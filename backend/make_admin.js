// Promote a registered user to admin.
// Usage (from the backend folder, with DB_* values in .env):
//   node make_admin.js you@example.com
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node make_admin.js <email>');
    process.exit(1);
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [r] = await conn.query("UPDATE users SET role='admin' WHERE email = ?", [email]);
    console.log(r.affectedRows ? `${email} is now an admin` : 'No user found with that email');
  } finally {
    await conn.end();
  }
})();