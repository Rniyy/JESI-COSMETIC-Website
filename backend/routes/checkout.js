const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

const FLAT_SHIPPING_FEE   = 5.00;
const FREE_SHIPPING_ABOVE = 50.00;

/**
 * POST /api/checkout
 * Body: EITHER { address_id: 5 } to reuse a saved address,
 *       OR     { address: { full_name, phone, line1, line2, city, state_province, postal_code, country } }
 *              to enter a new one — which gets saved to the address book automatically.
 *
 * Turns the logged-in user's current cart into a real order:
 *  1. Snapshot the cart (name/price at time of purchase, so later price
 *     changes never rewrite history)
 *  2. Resolve the shipping address (reuse saved, or save a new one)
 *  3. Create the order + order_items
 *  4. Empty the cart
 * All as one DB transaction — if anything fails partway, nothing is committed.
 */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { address, address_id } = req.body;

    // Validate up front, before opening the transaction.
    let existingAddress = null;
    if (address_id) {
      const [[found]] = await pool.query(
        'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
        [address_id, req.user.id]
      );
      if (!found) {
        conn.release();
        return res.status(400).json({ success: false, message: 'Selected address not found' });
      }
      existingAddress = found;
    } else if (!address || !address.full_name || !address.line1 || !address.city) {
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

    // 1.5. Decrement stock atomically. The WHERE clause doubles as the
    // check — if another order already took the last units between the
    // cart snapshot above and this exact instant, affectedRows is 0 and we
    // roll back the ENTIRE order rather than partially fulfilling it.
    for (const item of cartItems) {
      const [stockResult] = await conn.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - ?,
             in_stock = IF(stock_quantity - ? <= 0, 0, 1)
         WHERE id = ? AND stock_quantity >= ?`,
        [item.quantity, item.quantity, item.product_id, item.quantity]
      );
      if (stockResult.affectedRows === 0) {
        await conn.rollback();
        conn.release();
        return res.status(409).json({
          success: false,
          message: `Not enough stock for "${item.name}" — someone else may have just bought the last one. Please update your cart and try again.`,
        });
      }
    }

    // 2. Resolve the shipping address — reuse the saved one, or save the new one just entered.
    let addressIdForOrder;
    if (existingAddress) {
      addressIdForOrder = existingAddress.id;
    } else {
      const [addrResult] = await conn.query(
        `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, state_province, postal_code, country)
         VALUES (?, 'Saved at checkout', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, address.full_name, address.phone || null, address.line1,
          address.line2 || null, address.city, address.state_province || null,
          address.postal_code || null, address.country || 'Cambodia',
        ]
      );
      addressIdForOrder = addrResult.insertId;
    }

    // 3. Create the order
    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, address_id, status, subtotal, shipping_fee, total)
       VALUES (?, ?, 'to_pay', ?, ?, ?)`,
      [req.user.id, addressIdForOrder, subtotal.toFixed(2), shippingFee.toFixed(2), total.toFixed(2)]
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
 * List the logged-in user's own order history, with line items attached
 * (needed for the tabbed order view and the "Order again" action).
 */
router.get('/orders', async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT id, status, rating, subtotal, shipping_fee, total, placed_at
       FROM orders WHERE user_id = ? ORDER BY placed_at DESC`,
      [req.user.id]
    );

    if (orders.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      `SELECT order_id, product_id, product_name, product_price, quantity
       FROM order_items WHERE order_id IN (?)`,
      [orderIds]
    );

    const itemsByOrder = {};
    for (const item of items) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const data = orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));
    res.json({ success: true, data });
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

/**
 * POST /api/checkout/orders/:id/pay
 * Mock payment — there's no real payment gateway wired up, so this just
 * simulates a successful payment and moves the order to "to_receive".
 */
router.post('/orders/:id/pay', async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE orders SET status = 'to_receive' WHERE id = ? AND user_id = ? AND status = 'to_pay'`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'This order cannot be paid right now' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('POST /checkout/orders/:id/pay error:', err);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
  }
});

/**
 * POST /api/checkout/orders/:id/cancel
 * Only allowed while still "to_pay". Restocks every item in the order
 * inside a transaction, so cancelling doesn't leave stock permanently short.
 */
router.post('/orders/:id/cancel', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      `SELECT id FROM orders WHERE id = ? AND user_id = ? AND status = 'to_pay' FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!order) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, message: 'This order can no longer be cancelled' });
    }

    const [items] = await conn.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [req.params.id]
    );
    for (const item of items) {
      if (item.product_id) {
        await conn.query(
          `UPDATE products SET stock_quantity = stock_quantity + ?, in_stock = 1 WHERE id = ?`,
          [item.quantity, item.product_id]
        );
      }
    }

    await conn.query(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('POST /checkout/orders/:id/cancel error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/checkout/orders/:id/review   { rating: 1-5 }
 * Only allowed while "to_review". One star rating per order (not per item).
 */
router.post('/orders/:id/review', async (req, res) => {
  try {
    const rating = parseInt(req.body.rating, 10);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'rating must be between 1 and 5' });
    }

    const [result] = await pool.query(
      `UPDATE orders SET status = 'completed', rating = ? WHERE id = ? AND user_id = ? AND status = 'to_review'`,
      [rating, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'This order is not ready to be reviewed' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('POST /checkout/orders/:id/review error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

module.exports = router;