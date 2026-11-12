   require('dotenv').config();
   const mysql = require('mysql2/promise');
   (async () => {
     const email = process.argv[2];
     const conn = await mysql.createConnection({
       host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
       user: process.env.DB_USER, password: process.env.DB_PASSWORD,
       database: process.env.DB_NAME,
     });
     const [r] = await conn.query("UPDATE users SET role='admin' WHERE email=?", [email]);
     console.log(r.affectedRows ? `${email} is now admin` : 'No user with that email');
     await conn.end();
   })();