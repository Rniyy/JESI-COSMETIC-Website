/**
 * Seeds the `products` table from products.seed.json — the exact 53
 * products already rendered in shop.html / devices.html / sets.html,
 * scraped so names/prices/images match the frontend exactly.
 *
 * Usage: npm run seed
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

const DESCRIPTIONS = {
  serums:       'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',
  moisturizers: 'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',
  devices:      'A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',
  cleansers:    'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',
  pads:         'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',
  sets:         'A curated Medicube bundle designed to work together for a complete routine — better value, better results.',
};

async function seed() {
  const file = path.join(__dirname, 'products.seed.json');
  const products = JSON.parse(fs.readFileSync(file, 'utf-8'));

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE cart_items');
    await conn.query('TRUNCATE TABLE wishlist_items');
    await conn.query('TRUNCATE TABLE products');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const sql = `
      INSERT INTO products
        (name, category, price, old_price, image_url, image_class, rating, review_count, badge, description)
      VALUES ?
    `;

    const rows = products.map(p => [
      p.name,
      p.category,
      p.price,
      p.old_price || null,
      p.image_url || null,
      p.image_class || null,
      p.rating || null,
      p.reviews || null,
      p.badge || null,
      DESCRIPTIONS[p.category] || 'A Medicube favorite, formulated for visible results with regular use.',
    ]);

    await conn.query(sql, [rows]);
    console.log(`Seeded ${rows.length} products.`);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
