const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

/* ═══════════════════════════════════════════════════════════
   PRODUCTS  (admin sees everything, including out-of-stock)
═══════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/products
 */
router.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /admin/products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

/**
 * POST /api/admin/products
 * Body: name, category, brand, price, old_price, image_url, image_class,
 *       rating, review_count, badge, description, in_stock
 */
router.post('/products', async (req, res) => {
  try {
    const {
      name, category, brand, price, old_price,
      image_url, image_class, rating, review_count,
      badge, description, in_stock,
    } = req.body;

    if (!name || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'name, category and price are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO products
        (name, category, brand, price, old_price, image_url, image_class, rating, review_count, badge, description, in_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, category, brand || 'Medicube', price, old_price || null,
        image_url || null, image_class || null, rating || null, review_count || null,
        badge || null, description || null, in_stock === undefined ? 1 : in_stock,
      ]
    );

    const [[created]] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('POST /admin/products error:', err);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
});

/**
 * PUT /api/admin/products/:id
 * Same body shape as POST — full replace of the editable fields.
 */
router.put('/products/:id', async (req, res) => {
  try {
    const {
      name, category, brand, price, old_price,
      image_url, image_class, rating, review_count,
      badge, description, in_stock,
    } = req.body;

    const [result] = await pool.query(
      `UPDATE products SET
        name = ?, category = ?, brand = ?, price = ?, old_price = ?,
        image_url = ?, image_class = ?, rating = ?, review_count = ?,
        badge = ?, description = ?, in_stock = ?
       WHERE id = ?`,
      [
        name, category, brand || 'Medicube', price, old_price || null,
        image_url || null, image_class || null, rating || null, review_count || null,
        badge || null, description || null, in_stock === undefined ? 1 : in_stock,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const [[updated]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /admin/products/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Cascades to cart_items/wishlist_items via ON DELETE CASCADE in the schema.
 */
router.delete('/products/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/products/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
});

/* ═══════════════════════════════════════════════════════════
   USERS
═══════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/users
 */
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

/**
 * PATCH /api/admin/users/:id/role   { role: 'admin' | 'user' }
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: "role must be 'user' or 'admin'" });
    }

    // Prevent an admin from locking themselves out by accident
    if (Number(req.params.id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'You cannot remove your own admin access' });
    }

    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /admin/users/:id/role error:', err);
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/users/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

/* ═══════════════════════════════════════════════════════════
   ORDERS  (admin sees every customer's orders, not their own)
═══════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/orders
 */
router.get('/orders', async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.subtotal, o.shipping_fee, o.total, o.placed_at,
              u.name AS customer_name, u.email AS customer_email,
              COUNT(oi.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id
       ORDER BY o.placed_at DESC`
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('GET /admin/orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/admin/orders/:id
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const [[order]] = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
              a.full_name, a.phone, a.line1, a.line2, a.city, a.state_province, a.postal_code, a.country
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const [items] = await pool.query(
      'SELECT product_id, product_name, product_price, quantity FROM order_items WHERE order_id = ?',
      [req.params.id]
    );

    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    console.error('GET /admin/orders/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

/**
 * PATCH /api/admin/orders/:id/status   { status }
 */
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /admin/orders/:id/status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

module.exports = router;