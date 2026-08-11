const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const crypto  = require('crypto');
const path    = require('path');
const pool    = require('../db/pool');

const FLAT_SHIPPING_FEE   = 5.00;
const FREE_SHIPPING_ABOVE = 50.00;

// ── Review media upload config ──
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_BYTES = 5  * 1024 * 1024;  // 5MB per image
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;  // 30MB per video
const MAX_FILES = 5;

const reviewMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'reviews')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const uploadReviewMedia = multer({
  storage: reviewMediaStorage,
  limits: { fileSize: MAX_VIDEO_BYTES, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (![...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(file.mimetype)) {
      return cb(new Error('Only JPEG/PNG/WEBP/GIF images or MP4/WEBM/MOV videos are allowed'));
    }
    cb(null, true);
  },
});

/**
 * review_count is stored as text so seeded values like "1.2k" round-trip
 * untouched — but that means we can't just do `review_count + 1` in SQL.
 * This parses whatever's there into a plain number so we can increment it.
 */
function parseReviewCount(value) {
  if (!value) return 0;
  const str = String(value).trim().toLowerCase();
  if (str.endsWith('k')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }
  const num = parseInt(str.replace(/,/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

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
      `SELECT oi.order_id, oi.product_id, oi.product_name, oi.product_price, oi.quantity,
              p.image_url, p.image_class
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (?)`,
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
 * POST /api/checkout/orders/:id/pay   { pin, confirm_pin? }
 * Mock payment — there's no real payment gateway wired up, so this
 * simulates a successful payment. Requires the user's 4-digit payment PIN:
 *  - First time ever: pin + confirm_pin must match, and it gets saved as
 *    their PIN going forward.
 *  - Every time after: pin is checked against the saved hash.
 */
router.post('/orders/:id/pay', async (req, res) => {
  try {
    const { pin, confirm_pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
    }

    const [[user]] = await pool.query('SELECT payment_pin_hash FROM users WHERE id = ?', [req.user.id]);

    if (!user.payment_pin_hash) {
      // First time paying — set this as their PIN going forward.
      if (pin !== confirm_pin) {
        return res.status(400).json({ success: false, message: 'PINs do not match' });
      }
      const pinHash = await bcrypt.hash(pin, 12);
      await pool.query('UPDATE users SET payment_pin_hash = ? WHERE id = ?', [pinHash, req.user.id]);
    } else {
      const match = await bcrypt.compare(pin, user.payment_pin_hash);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Incorrect PIN' });
      }
    }

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
 * Only allowed while "to_review". One star rating per order (not per item),
 * but every distinct product in the order gets its review_count bumped by 1.
 */
router.post('/orders/:id/review', uploadReviewMedia.array('media', MAX_FILES), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const rating  = parseInt(req.body.rating, 10);
    const comment = (req.body.comment || '').trim().slice(0, 1000); // sane length cap
    if (!rating || rating < 1 || rating > 5) {
      conn.release();
      return res.status(400).json({ success: false, message: 'rating must be between 1 and 5' });
    }

    // Reject any image that snuck past the shared file-size ceiling but
    // exceeds the smaller per-image limit (videos get the full 30MB).
    const fs = require('fs');
    for (const file of req.files || []) {
      const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        conn.release();
        return res.status(400).json({ success: false, message: `Image "${file.originalname}" is over the 5MB limit` });
      }
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE orders SET status = 'completed', rating = ? WHERE id = ? AND user_id = ? AND status = 'to_review'`,
      [rating, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      conn.release();
      (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
      return res.status(400).json({ success: false, message: 'This order is not ready to be reviewed' });
    }

    // One written review row per distinct product in this order (not per unit ordered),
    // plus bump review_count and recompute the product's average star rating.
    const [items] = await conn.query(
      'SELECT DISTINCT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL',
      [req.params.id]
    );
    for (const item of items) {
      const [[product]] = await conn.query('SELECT review_count FROM products WHERE id = ?', [item.product_id]);
      if (!product) continue; // product was deleted since this order was placed

      const [reviewResult] = await conn.query(
        'INSERT INTO reviews (product_id, user_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [item.product_id, req.user.id, req.params.id, rating, comment || null]
      );

      // Attach the same uploaded media to this product's review row
      for (const file of req.files || []) {
        const mediaType = ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? 'image' : 'video';
        await conn.query(
          'INSERT INTO review_media (review_id, media_type, url) VALUES (?, ?, ?)',
          [reviewResult.insertId, mediaType, `/uploads/reviews/${file.filename}`]
        );
      }

      const newCount = parseReviewCount(product.review_count) + 1;
      const [[avgRow]] = await conn.query(
        'SELECT AVG(rating) AS avg_rating FROM reviews WHERE product_id = ?',
        [item.product_id]
      );
      await conn.query(
        'UPDATE products SET review_count = ?, rating = ? WHERE id = ?',
        [String(newCount), Number(avgRow.avg_rating).toFixed(1), item.product_id]
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('POST /checkout/orders/:id/review error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  } finally {
    conn.release();
  }
});

module.exports = router;