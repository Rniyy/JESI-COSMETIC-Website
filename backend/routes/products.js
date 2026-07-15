const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

/**
 * GET /api/products
 * Query params:
 *   q         - search text (matches product name)
 *   category  - filter by category (serums, moisturizers, devices, cleansers, pads, sets)
 *   limit     - max results (default 100)
 */
router.get('/', async (req, res) => {
  try {
    const { q, category, limit } = req.query;
    const cap = Math.min(parseInt(limit, 10) || 100, 200);

    let sql = 'SELECT * FROM products WHERE in_stock = 1';
    const params = [];

    if (q) {
      sql += ' AND name LIKE ?';
      params.push(`%${q}%`);
    }
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(cap);

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('GET /products/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

module.exports = router;
