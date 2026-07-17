const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

const FLAT_SHIPPING_FEE   = 5.00;
const FREE_SHIPPING_ABOVE = 50.00;

/**
 * POST /api/checkout
 * Body: { address: { full_name, phone, line1, line2, city, state_province, postal_code, country } }
 *
 * Turns the logged-in user's current cart into a real order:
 *  1. Snapshot the cart (name/price at time of purchase, so later price
 *     changes never rewrite history)
 *  2. Save the shipping address
 *  3. Create the order + order_items
 *  4. Empty the cart
 * All as one DB transaction — if anything fails partway, nothing is committed.
 */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { address } = req.body;
    if (!address || !address.full_name || !address.line1 || !address.city) {
      conn.release();
      return res.status(400).json({ success: false, message: 'A shipping address (name, address line, city) is required' });
    }

    await conn.beginTransaction();

    // 1. Snapshot the cart
    const [cartItems] = await conn.query(
      `SELECT p.id AS product_id, p.name, p.price, c.quantity
       FROM cart_items c JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    if (cartItems.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    const subtotal     = cartItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
    const shippingFee  = subtotal >= FREE_SHIPPING_ABOVE ? 0 : FLAT_SHIPPING_FEE;
    const total        = subtotal + shippingFee;

    // 2. Save the address
    const [addrResult] = await conn.query(
      `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, state_province, postal_code, country)
       VALUES (?, 'Checkout', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, address.full_name, address.phone || null, address.line1,
        address.line2 || null, address.city, address.state_province || null,
        address.postal_code || null, address.country || 'Cambodia',
      ]
    );

    // 3. Create the order
    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, address_id, status, subtotal, shipping_fee, total)
       VALUES (?, ?, 'pending', ?, ?, ?)`,
      [req.user.id, addrResult.insertId, subtotal.toFixed(2), shippingFee.toFixed(2), total.toFixed(2)]
    );
    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.name, item.price, item.quantity]
      );
    }

    // 4. Empty the cart
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    await conn.commit();

    res.status(201).json({
      success: true,
      data: { id: orderId, subtotal: subtotal.toFixed(2), shipping_fee: shippingFee.toFixed(2), total: total.toFixed(2) },
    });
  } catch (err) {
    await conn.rollback();
    console.error('POST /checkout error:', err);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/checkout/orders
 * List the logged-in user's own order history.
 */
router.get('/orders', async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.subtotal, o.shipping_fee, o.total, o.placed_at,
              COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.placed_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('GET /checkout/orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/checkout/orders/:id
 * Detail view of a single order — only if it belongs to the requester.
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const [[order]] = await pool.query(
      `SELECT o.*, a.full_name, a.phone, a.line1, a.line2, a.city, a.state_province, a.postal_code, a.country
       FROM orders o LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.id = ? AND o.user_id = ?`,
      [req.params.id, req.user.id]
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
    console.error('GET /checkout/orders/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

module.exports = router;
