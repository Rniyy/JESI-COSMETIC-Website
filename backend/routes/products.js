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

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND name LIKE ?';
      params.push(`%${q}%`);
    }
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY in_stock DESC, name ASC LIMIT ?';
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

/**
 * GET /api/products/:id/reviews
 * Public — shows reviewer first name, star rating, comment, and date.
 * Full name/email are never exposed here.
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              SUBSTRING_INDEX(u.name, ' ', 1) AS reviewer_first_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const reviewIds = rows.map(r => r.id);
    const [media] = await pool.query(
      'SELECT review_id, media_type, url FROM review_media WHERE review_id IN (?)',
      [reviewIds]
    );
    const mediaByReview = {};
    for (const m of media) {
      if (!mediaByReview[m.review_id]) mediaByReview[m.review_id] = [];
      mediaByReview[m.review_id].push({ media_type: m.media_type, url: m.url });
    }

    const data = rows.map(r => ({ ...r, media: mediaByReview[r.id] || [] }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /products/:id/reviews error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

module.exports = router;