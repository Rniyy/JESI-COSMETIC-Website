const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

/**
 * GET /api/addresses
 * List the logged-in user's saved addresses, default first.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /addresses error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
});

/**
 * POST /api/addresses
 * Save a new address. Also used internally by checkout when someone
 * enters a fresh address instead of picking a saved one.
 */
router.post('/', async (req, res) => {
  try {
    const { label, full_name, phone, line1, line2, city, state_province, postal_code, country, is_default } = req.body;

    if (!full_name || !line1 || !city) {
      return res.status(400).json({ success: false, message: 'full_name, line1 and city are required' });
    }

    if (is_default) {
      await pool.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    const [result] = await pool.query(
      `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, state_province, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, label || 'Home', full_name, phone || null, line1,
        line2 || null, city, state_province || null, postal_code || null,
        country || 'Cambodia', is_default ? 1 : 0,
      ]
    );

    const [[created]] = await pool.query('SELECT * FROM addresses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('POST /addresses error:', err);
    res.status(500).json({ success: false, message: 'Failed to save address' });
  }
});

/**
 * DELETE /api/addresses/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /addresses/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
});

module.exports = router;
