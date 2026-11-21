const express = require('express');
const crypto  = require('crypto');
const pool    = require('../db/pool');
const payway  = require('../utils/payway');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router(); // mounted at /api/payments (auth is applied per route)

function publicBaseUrl(req) {
  return (process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

/** Unique id for PayWay (max 20 chars, letters/digits only) */
function newTranId(orderId) {
  return `J${orderId}${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.slice(0, 20);
}

/**
 * Mark a payment paid and move its order from "To Pay" to "To Receive" — atomically,
 * and safely if called twice (callback + return page can both arrive).
 */
async function markPaid(payment, result) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query('SELECT id, status, order_id FROM payments WHERE id = ? FOR UPDATE', [payment.id]);
    if (!row || row.status === 'paid') { await conn.commit(); return; }

    const [upd] = await conn.query(
      `UPDATE orders SET status = 'to_receive' WHERE id = ? AND status = 'to_pay'`,
      [row.order_id]
    );
    const note = upd.affectedRows === 0
      ? 'Paid, but the order was no longer awaiting payment (cancelled or already paid) — check and refund if needed'
      : null;
    if (note) console.warn(`[payments] order ${row.order_id}, payment ${row.id}: ${note}`);

    await conn.query(
      `UPDATE payments SET status = 'paid', paid_at = NOW(), apv = ?, note = ? WHERE id = ?`,
      [result.apv || null, note, row.id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Ask PayWay what happened to this payment and update our records.
 * Returns 'paid' | 'failed' | 'cancelled' | 'pending'.
 * This (not the callback, not the browser) is the only thing that can mark an order paid.
 */
async function settle(payment) {
  let r;
  try {
    r = await payway.checkTransaction(payment.tran_id);
  } catch (err) {
    console.error(`[payments] check-transaction failed for ${payment.tran_id}:`, err.message);
    return 'pending';
  }
  if (!r.found) return 'pending'; // customer hasn't submitted a payment yet

  if (r.statusCode === 0) {
    const sameAmount   = Math.abs(r.amount - Number(payment.amount)) < 0.009;
    const sameCurrency = !r.currency || r.currency === payment.currency;
    if (!sameAmount || !sameCurrency) {
      console.error(`[payments] ${payment.tran_id}: PayWay says ${r.amount} ${r.currency}, expected ${payment.amount} ${payment.currency} — NOT marking paid`);
      await pool.query(`UPDATE payments SET note = 'Amount/currency mismatch reported by PayWay' WHERE id = ?`, [payment.id]);
      return 'pending';
    }
    await markPaid(payment, r);
    return 'paid';
  }
  if (r.statusCode === 3) { await pool.query(`UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'`, [payment.id]); return 'failed'; }
  if (r.statusCode === 7) { await pool.query(`UPDATE payments SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, [payment.id]); return 'cancelled'; }
  return 'pending';
}

/** GET /api/payments/config — tells the website which checkout to use */
router.get('/config', (req, res) => {
  res.json({ success: true, data: { provider: payway.isEnabled() ? 'payway' : 'demo' } });
});

/**
 * POST /api/payments/payway/orders/:id/start
 * Creates a payment record and returns the form fields the browser must POST to PayWay.
 * The amount always comes from the order in OUR database — never from the browser.
 */
router.post('/payway/orders/:id/start', requireAuth, async (req, res) => {
  try {
    if (!payway.isEnabled()) {
      return res.status(503).json({ success: false, message: 'Online payment is not set up yet' });
    }
    const [[order]] = await pool.query(
      'SELECT id, total, status FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'to_pay') {
      return res.status(400).json({ success: false, message: 'This order cannot be paid right now' });
    }

    const total = Number(order.total);
    if (total <= 0) {
      // Fully covered by a coupon: nothing to charge, PayWay rejects zero amounts
      await pool.query(`UPDATE orders SET status = 'to_receive' WHERE id = ? AND user_id = ? AND status = 'to_pay'`, [order.id, req.user.id]);
      return res.json({ success: true, data: { free: true } });
    }

    const [[user]]  = await pool.query('SELECT name, email FROM users WHERE id = ?', [req.user.id]);
    const [items]   = await pool.query(
      'SELECT product_name AS name, quantity, product_price AS price FROM order_items WHERE order_id = ?',
      [order.id]
    );

    const tranId = newTranId(order.id);
    await pool.query(
      `INSERT INTO payments (order_id, user_id, provider, tran_id, amount, currency, status)
       VALUES (?, ?, 'payway', ?, ?, ?, 'pending')`,
      [order.id, req.user.id, tranId, total.toFixed(2), payway.cfg().currency]
    );

    const base = publicBaseUrl(req);
    const [first, ...rest] = String((user && user.name) || '').trim().split(/\s+/);
    const purchase = payway.buildPurchase({
      tranId,
      amount: total,
      items,
      firstname: first || '',
      lastname: rest.join(' '),
      email: user && user.email,
      callbackUrl: `${base}/api/payments/payway/callback`,
      cancelUrl:   `${base}/payment-result.html?order=${order.id}&cancelled=1`,
      successUrl:  `${base}/payment-result.html?order=${order.id}`,
    });

    res.json({ success: true, data: purchase });
  } catch (err) {
    console.error('POST /payments/payway/orders/:id/start error:', err);
    res.status(500).json({ success: false, message: 'Could not start the payment' });
  }
});

/**
 * POST /api/payments/payway/callback   (called by PayWay, no login)
 * PayWay tells us a payment finished. We check its signature, but safety does not depend
 * on it: we only mark an order paid after asking PayWay's own API (see settle()).
 */
const lastCallbackCheck = new Map(); // tran_id -> time, to stop spam hammering PayWay's API
router.post('/payway/callback', async (req, res) => {
  try {
    if (!payway.isEnabled()) return res.status(503).json({ success: false, message: 'Not configured' });

    const tranId = req.body && typeof req.body.tran_id === 'string' ? req.body.tran_id : '';
    if (!tranId) return res.status(400).json({ success: false, message: 'Missing tran_id' });

    if (!payway.callbackSignatureValid(req.body, req.get('X-PayWay-HMAC-SHA512'))) {
      console.warn(`[payments] callback for ${tranId}: signature did not match — verifying with PayWay's API instead`);
    }

    const now = Date.now();
    if (now - (lastCallbackCheck.get(tranId) || 0) < 5000) return res.json({ success: true });
    lastCallbackCheck.set(tranId, now);
    if (lastCallbackCheck.size > 2000) lastCallbackCheck.clear();

    const [[payment]] = await pool.query('SELECT * FROM payments WHERE tran_id = ?', [tranId]);
    if (!payment) return res.status(404).json({ success: false, message: 'Unknown transaction' });

    await settle(payment);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /payments/payway/callback error:', err);
    res.status(500).json({ success: false, message: 'Callback failed' });
  }
});

/**
 * GET /api/payments/payway/verify/:orderId
 * The "thank you" page calls this. It asks PayWay directly, so it works even when
 * the callback can't reach us (e.g. running on localhost).
 * Returns { status: 'paid' | 'pending' | 'failed' | 'cancelled' | 'none', orderStatus }
 */
router.get('/payway/verify/:orderId', requireAuth, async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT id, status FROM orders WHERE id = ? AND user_id = ?', [req.params.orderId, req.user.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (payway.isEnabled()) {
      const [pending] = await pool.query(
        `SELECT * FROM payments WHERE order_id = ? AND user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 5`,
        [order.id, req.user.id]
      );
      for (const p of pending) { if (await settle(p) === 'paid') break; }
    }

    const [[latest]] = await pool.query(
      `SELECT status FROM payments WHERE order_id = ? AND user_id = ?
       ORDER BY (status = 'paid') DESC, id DESC LIMIT 1`,
      [order.id, req.user.id]
    );
    const [[fresh]] = await pool.query('SELECT status FROM orders WHERE id = ?', [order.id]);
    res.json({ success: true, data: { status: latest ? latest.status : 'none', orderStatus: fresh.status } });
  } catch (err) {
    console.error('GET /payments/payway/verify/:orderId error:', err);
    res.status(500).json({ success: false, message: 'Could not check the payment' });
  }
});

module.exports = router;
