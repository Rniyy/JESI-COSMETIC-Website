const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

/**
 * GET /api/notifications
 * Most recent first. Includes product name/image for display when available.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.type, n.product_id, n.message, n.is_read, n.created_at,
              p.image_url, p.image_class
       FROM notifications n
       LEFT JOIN products p ON p.id = n.product_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unreadCount = rows.filter(r => !r.is_read).length;
    res.json({ success: true, data: rows, unread_count: unreadCount });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /notifications/:id/read error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /notifications/read-all error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
});

module.exports = router;
