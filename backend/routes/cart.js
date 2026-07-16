const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

const SELECT_CART_BY_SESSION = `
  SELECT
    p.id            AS product_id,
    p.name,
    p.price,
    p.image_url,
    p.image_class,
    c.quantity
  FROM cart_items c
  JOIN products p ON p.id = c.product_id
  WHERE c.session_id = ?
  ORDER BY c.created_at ASC
`;

const SELECT_CART_BY_USER = `
  SELECT
    p.id            AS product_id,
    p.name,
    p.price,
    p.image_url,
    p.image_class,
    c.quantity
  FROM cart_items c
  JOIN products p ON p.id = c.product_id
  WHERE c.user_id = ?
  ORDER BY c.created_at ASC
`;

// Logged-in users are scoped by user_id; guests fall back to the session cookie.
function cartOwnerClause(req) {
  if (req.user) return { sql: SELECT_CART_BY_USER, param: req.user.id };
  return { sql: SELECT_CART_BY_SESSION, param: req.sessionId };
}

async function respondWithCart(req, res) {
  const { sql, param } = cartOwnerClause(req);
  const [items] = await pool.query(sql, [param]);
  const subtotal   = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const item_count = items.reduce((sum, i) => sum + i.quantity, 0);
  res.json({ success: true, data: items, item_count, subtotal: subtotal.toFixed(2) });
}

/**
 * GET /api/cart
 */
router.get('/', async (req, res) => {
  try {
    await respondWithCart(req, res);
  } catch (err) {
    console.error('GET /cart error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch cart' });
  }
});

/**
 * POST /api/cart  { product_id, quantity }
 * Adds a product, or increments quantity if it's already in the cart.
 */
router.post('/', async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id is required' });
    }

    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (req.user) {
      await pool.query(
        `INSERT INTO cart_items (session_id, user_id, product_id, quantity)
         VALUES (NULL, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [req.user.id, product_id, qty]
      );
    } else {
      await pool.query(
        `INSERT INTO cart_items (session_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [req.sessionId, product_id, qty]
      );
    }

    await respondWithCart(req, res);
  } catch (err) {
    console.error('POST /cart error:', err);
    res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
});

/**
 * PATCH /api/cart/:productId  { quantity }
 * Sets the quantity for a cart line directly (used by the qty +/- buttons).
 */
router.patch('/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer' });
    }

    const [result] = req.user
      ? await pool.query(
          'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
          [qty, req.user.id, req.params.productId]
        )
      : await pool.query(
          'UPDATE cart_items SET quantity = ? WHERE session_id = ? AND product_id = ?',
          [qty, req.sessionId, req.params.productId]
        );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Item not in cart' });
    }

    await respondWithCart(req, res);
  } catch (err) {
    console.error('PATCH /cart/:productId error:', err);
    res.status(500).json({ success: false, message: 'Failed to update cart item' });
  }
});

/**
 * DELETE /api/cart/:productId
 */
router.delete('/:productId', async (req, res) => {
  try {
    if (req.user) {
      await pool.query(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [req.user.id, req.params.productId]
      );
    } else {
      await pool.query(
        'DELETE FROM cart_items WHERE session_id = ? AND product_id = ?',
        [req.sessionId, req.params.productId]
      );
    }
    await respondWithCart(req, res);
  } catch (err) {
    console.error('DELETE /cart/:productId error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove cart item' });
  }
});

module.exports = router;