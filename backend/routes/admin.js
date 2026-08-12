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
 *       rating, review_count, badge, description, stock_quantity
 * (in_stock is derived automatically from stock_quantity, not sent by the client)
 */
router.post('/products', async (req, res) => {
  try {
    const {
      name, category, brand, price, old_price,
      image_url, image_class, rating, review_count,
      badge, description, stock_quantity,
    } = req.body;

    if (!name || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'name, category and price are required' });
    }

    const qty = Math.max(0, parseInt(stock_quantity, 10) || 0);

    const [result] = await pool.query(
      `INSERT INTO products
        (name, category, brand, price, old_price, image_url, image_class, rating, review_count, badge, description, stock_quantity, in_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, category, brand || 'Medicube', price, old_price || null,
        image_url || null, image_class || null, rating || null, review_count || null,
        badge || null, description || null, qty, qty > 0 ? 1 : 0,
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
      badge, description, stock_quantity,
    } = req.body;

    const qty = Math.max(0, parseInt(stock_quantity, 10) || 0);

    // Check stock BEFORE updating, so we can detect a 0 -> available transition
    const [[before]] = await pool.query('SELECT stock_quantity, name FROM products WHERE id = ?', [req.params.id]);

    const [result] = await pool.query(
      `UPDATE products SET
        name = ?, category = ?, brand = ?, price = ?, old_price = ?,
        image_url = ?, image_class = ?, rating = ?, review_count = ?,
        badge = ?, description = ?, stock_quantity = ?, in_stock = ?
       WHERE id = ?`,
      [
        name, category, brand || 'Medicube', price, old_price || null,
        image_url || null, image_class || null, rating || null, review_count || null,
        badge || null, description || null, qty, qty > 0 ? 1 : 0,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Product just came back in stock — notify everyone (logged-in users only,
    // since guest wishlists have no account to attach a notification to) who
    // wishlisted it.
    if (before && Number(before.stock_quantity) <= 0 && qty > 0) {
      const [wishlisters] = await pool.query(
        'SELECT DISTINCT user_id FROM wishlist_items WHERE product_id = ? AND user_id IS NOT NULL',
        [req.params.id]
      );
      for (const w of wishlisters) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, product_id, message) VALUES (?, 'back_in_stock', ?, ?)`,
          [w.user_id, req.params.id, `"${name}" is back in stock!`]
        );
      }
      if (wishlisters.length > 0) {
        console.log(`[BACK IN STOCK] Notified ${wishlisters.length} wishlister(s) about "${name}"`);
      }
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
/**
 * GET /api/admin/orders
 * Query params (all optional, combine with AND):
 *   q          - matches customer name, customer email, OR any product name in the order
 *   date_from  - orders placed on/after this date (YYYY-MM-DD)
 *   date_to    - orders placed on/before this date (YYYY-MM-DD)
 *   status     - exact status match
 */
router.get('/orders', async (req, res) => {
  try {
    const { q, date_from, date_to, status } = req.query;

    let sql = `
      SELECT o.id, o.status, o.subtotal, o.shipping_fee, o.total, o.placed_at,
             u.name AS customer_name, u.email AS customer_email,
             COUNT(oi.id) AS item_count
      FROM orders o
      JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ` AND (
        u.name LIKE ? OR u.email LIKE ?
        OR EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.product_name LIKE ?)
      )`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (date_from) {
      sql += ' AND DATE(o.placed_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND DATE(o.placed_at) <= ?';
      params.push(date_to);
    }
    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    sql += ' GROUP BY o.id ORDER BY o.placed_at DESC';

    const [orders] = await pool.query(sql, params);
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('GET /admin/orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/admin/orders/export
 * Downloads orders as a CSV file. Accepts the same q/date_from/date_to/status
 * filters as GET /admin/orders, so exporting a filtered view works naturally.
 * Registered BEFORE /orders/:id so "export" is never mistaken for an order id.
 */
router.get('/orders/export', async (req, res) => {
  try {
    const { q, date_from, date_to, status } = req.query;

    let sql = `
      SELECT o.id, o.status, o.subtotal, o.shipping_fee, o.total, o.placed_at,
             u.name AS customer_name, u.email AS customer_email,
             COUNT(oi.id) AS item_count
      FROM orders o
      JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ` AND (
        u.name LIKE ? OR u.email LIKE ?
        OR EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.product_name LIKE ?)
      )`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (date_from) { sql += ' AND DATE(o.placed_at) >= ?'; params.push(date_from); }
    if (date_to)   { sql += ' AND DATE(o.placed_at) <= ?'; params.push(date_to); }
    if (status)    { sql += ' AND o.status = ?'; params.push(status); }

    sql += ' GROUP BY o.id ORDER BY o.placed_at DESC';

    const [rows] = await pool.query(sql, params);
    const headers = ['id', 'customer_name', 'customer_email', 'status',
                      'item_count', 'subtotal', 'shipping_fee', 'total', 'placed_at'];
    const csv = toCSV(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /admin/orders/export error:', err);
    res.status(500).json({ success: false, message: 'Failed to export orders' });
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
    // Admin drives the middle of the lifecycle (shipping progress + cancellation).
    // to_pay and completed are customer-driven transitions (pay button, submitting a review).
    const validStatuses = ['to_pay', 'to_receive', 'to_review', 'completed', 'cancelled'];
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

/* ═══════════════════════════════════════════════════════════
   ANALYTICS
   "Sold" = orders that were actually paid for (to_receive, to_review,
   or completed) — to_pay orders haven't been paid yet, and cancelled
   orders were never fulfilled, so neither counts toward sales.
═══════════════════════════════════════════════════════════ */
const SOLD_STATUSES = "('to_receive', 'to_review', 'completed')";

/**
 * GET /api/admin/analytics/years
 * Every year that has at least one order — used to populate the year picker.
 */
router.get('/analytics/years', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT YEAR(placed_at) AS year FROM orders ORDER BY year DESC`
    );
    const years = rows.map(r => r.year);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) years.unshift(currentYear); // always offer the current year
    res.json({ success: true, data: years });
  } catch (err) {
    console.error('GET /admin/analytics/years error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch years' });
  }
});

/**
 * GET /api/admin/analytics/summary?year=2026
 * Totals for the given year, plus the same totals for the year before it
 * (so the frontend can show a "+12% vs last year" style comparison).
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    async function totalsFor(y) {
      const [[row]] = await pool.query(
        `SELECT COALESCE(SUM(oi.product_price * oi.quantity), 0) AS revenue,
                COALESCE(SUM(oi.quantity), 0) AS items_sold,
                COUNT(DISTINCT o.id) AS order_count
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE YEAR(o.placed_at) = ? AND o.status IN ${SOLD_STATUSES}`,
        [y]
      );
      return row;
    }

    const [current, previous] = await Promise.all([totalsFor(year), totalsFor(year - 1)]);
    res.json({ success: true, data: { year, current, previous } });
  } catch (err) {
    console.error('GET /admin/analytics/summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/admin/analytics/monthly?year=2026
 * Revenue + units sold + order count for each of the 12 months (zero-filled
 * for months with no sales, since GROUP BY silently skips those).
 */
router.get('/analytics/monthly', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT MONTH(o.placed_at) AS month,
              COALESCE(SUM(oi.product_price * oi.quantity), 0) AS revenue,
              COALESCE(SUM(oi.quantity), 0) AS items_sold,
              COUNT(DISTINCT o.id) AS order_count
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE YEAR(o.placed_at) = ? AND o.status IN ${SOLD_STATUSES}
       GROUP BY MONTH(o.placed_at)`,
      [year]
    );

    const byMonth = {};
    rows.forEach(r => { byMonth[r.month] = r; });

    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push(byMonth[m] || { month: m, revenue: 0, items_sold: 0, order_count: 0 });
    }

    res.json({ success: true, data: months });
  } catch (err) {
    console.error('GET /admin/analytics/monthly error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly analytics' });
  }
});

/**
 * GET /api/admin/analytics/top-products?year=2026&limit=5
 */
router.get('/analytics/top-products', async (req, res) => {
  try {
    const year  = parseInt(req.query.year, 10) || new Date().getFullYear();
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

    const [rows] = await pool.query(
      `SELECT oi.product_id, oi.product_name AS name,
              SUM(oi.quantity) AS units_sold,
              SUM(oi.product_price * oi.quantity) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE YEAR(o.placed_at) = ? AND o.status IN ${SOLD_STATUSES}
       GROUP BY oi.product_id, oi.product_name
       ORDER BY units_sold DESC
       LIMIT ?`,
      [year, limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /admin/analytics/top-products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch top products' });
  }
});

/**
 * GET /api/admin/analytics/by-category?year=2026
 * Revenue split by product category — for a donut chart.
 */
router.get('/analytics/by-category', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const [rows] = await pool.query(
      `SELECT COALESCE(p.category, 'Other') AS category,
              SUM(oi.product_price * oi.quantity) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE YEAR(o.placed_at) = ? AND o.status IN ${SOLD_STATUSES}
       GROUP BY COALESCE(p.category, 'Other')
       ORDER BY revenue DESC`,
      [year]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /admin/analytics/by-category error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch category breakdown' });
  }
});

/**
 * GET /api/admin/analytics/by-status?year=2026
 * Order count per lifecycle status — for a donut chart. Unlike the sales
 * totals above, this intentionally includes every status (to_pay,
 * cancelled, etc.) since it's showing lifecycle distribution, not revenue.
 */
router.get('/analytics/by-status', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM orders
       WHERE YEAR(placed_at) = ?
       GROUP BY status`,
      [year]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /admin/analytics/by-status error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch status breakdown' });
  }
});

/* ═══════════════════════════════════════════════════════════
   CSV EXPORTS
═══════════════════════════════════════════════════════════ */

/** Turns one value into a safely-quoted CSV field. */
function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  return /[",\n]/.test(str) ? `"${str}"` : str;
}

function toCSV(headers, rows) {
  const lines = [headers.map(csvField).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvField(row[h])).join(','));
  }
  return lines.join('\r\n');
}

/**
 * GET /api/admin/products/export
 * Downloads every product as a CSV file.
 */
router.get('/products/export', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id');
    const headers = ['id', 'name', 'category', 'brand', 'price', 'old_price',
                      'stock_quantity', 'in_stock', 'rating', 'review_count', 'badge'];
    const csv = toCSV(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /admin/products/export error:', err);
    res.status(500).json({ success: false, message: 'Failed to export products' });
  }
});

module.exports = router;