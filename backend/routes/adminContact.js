const express = require('express');
const pool    = require('../db/pool');

const router = express.Router(); // mounted behind requireAdmin at /api/admin/contact-messages

// GET /api/admin/contact-messages?status=new|read|all
router.get('/', async (req, res) => {
  try {
    const status = ['new', 'read'].includes(req.query.status) ? req.query.status : null;
    const [rows] = await pool.query(
      `SELECT id, user_id, name, email, subject, message, status, created_at
       FROM contact_messages ${status ? 'WHERE status = ?' : ''}
       ORDER BY created_at DESC, id DESC LIMIT 300`,
      status ? [status] : []
    );
    const [[{ unread }]] = await pool.query("SELECT COUNT(*) AS unread FROM contact_messages WHERE status = 'new'");
    res.json({ success: true, data: rows, unread: Number(unread) });
  } catch (err) {
    console.error('GET /admin/contact-messages error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// PATCH /api/admin/contact-messages/:id   { status: 'new' | 'read' }
router.patch('/:id', async (req, res) => {
  try {
    const status = req.body && req.body.status;
    if (!['new', 'read'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'new' or 'read'" });
    }
    const [result] = await pool.query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /admin/contact-messages/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update message' });
  }
});

// DELETE /api/admin/contact-messages/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/contact-messages/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

module.exports = router;
