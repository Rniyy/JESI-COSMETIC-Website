const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

const SELECT_WISHLIST = `
  SELECT
    p.id            AS product_id,
    p.name,
    p.price,
    p.old_price,
    p.image_url,
    p.image_class
  FROM wishlist_items w
  JOIN products p ON p.id = w.product_id
  WHERE w.session_id = ?
  ORDER BY w.created_at DESC
`;

async function respondWithWishlist(req, res) {
  const [items] = await pool.query(SELECT_WISHLIST, [req.sessionId]);
  res.json({ success: true, data: items, count: items.length });
}

/**
 * GET /api/wishlist
 */
router.get('/', async (req, res) => {
  try {
    await respondWithWishlist(req, res);
  } catch (err) {
    console.error('GET /wishlist error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist' });
  }
});

/**
 * POST /api/wishlist  { product_id }
 */
router.post('/', async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id is required' });
    }

    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await pool.query(
      `INSERT IGNORE INTO wishlist_items (session_id, product_id) VALUES (?, ?)`,
      [req.sessionId, product_id]
    );

    await respondWithWishlist(req, res);
  } catch (err) {
    console.error('POST /wishlist error:', err);
    res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
  }
});

/**
 * DELETE /api/wishlist/:productId
 */
router.delete('/:productId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlist_items WHERE session_id = ? AND product_id = ?',
      [req.sessionId, req.params.productId]
    );
    await respondWithWishlist(req, res);
  } catch (err) {
    console.error('DELETE /wishlist/:productId error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove wishlist item' });
  }
});

module.exports = router;
