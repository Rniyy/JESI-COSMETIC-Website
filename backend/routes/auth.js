const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const pool     = require('../db/pool');
const { issueToken, clearToken, requireAuth } = require('../middleware/authMiddleware');
const { mergeGuestCartAndWishlist } = require('../utils/mergeGuestData');

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes

/**
 * POST /api/auth/register  { name, email, password }
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'user']
    );

    const user = { id: result.insertId, name, email, role: 'user' };

    // Fold whatever the person already had in their guest cart/wishlist into the new account
    await mergeGuestCartAndWishlist(pool, req.sessionId, user.id);

    issueToken(res, user);
    res.status(201).json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    res.status(500).json({ success: false, message: 'Failed to register' });
  }
});

/**
 * POST /api/auth/login  { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const [[user]] = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Fold guest cart/wishlist (from before login) into this account
    await mergeGuestCartAndWishlist(pool, req.sessionId, user.id);

    issueToken(res, user);
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ success: false, message: 'Failed to log in' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Lets the frontend check "am I logged in, and as who" on page load.
 */
router.get('/me', async (req, res) => {
  if (!req.user) {
    return res.json({ success: true, data: null });
  }
  try {
    const [[user]] = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, data: user || null });
  } catch (err) {
    console.error('GET /auth/me error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch current user' });
  }
});

/**
 * POST /api/auth/forgot-password  { email }
 * Always responds success (don't leak which emails exist). Since there's no
 * email service wired up yet, the reset link is logged to the server console
 * instead — swap this for a real send once you add Nodemailer/Resend/etc.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const [[user]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    if (user) {
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, tokenHash, expiresAt]
      );

      const resetLink = `http://localhost:3000/reset-password.html?token=${rawToken}`;
      console.log('\n[PASSWORD RESET] No email service configured yet — link for testing:');
      console.log(resetLink + '\n');
    }

    // Same response whether or not the email exists, on purpose.
    res.json({ success: true, message: 'If that email is registered, a reset link has been generated (check the server console for now).' });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/reset-password  { token, newPassword }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'token and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [[resetRow]] = await pool.query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens
       WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!resetRow || resetRow.used_at || new Date(resetRow.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, resetRow.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [resetRow.id]);

    res.json({ success: true, message: 'Password updated — you can now log in with your new password.' });
  } catch (err) {
    console.error('POST /auth/reset-password error:', err);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

/**
 * PATCH /api/auth/me  { name, email }
 * Updates the logged-in user's own name/email.
 */
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const [[existing]] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, req.user.id]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Another account already uses that email' });
    }

    await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
    res.json({ success: true, data: { id: req.user.id, name, email, role: req.user.role } });
  } catch (err) {
    console.error('PATCH /auth/me error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

/**
 * PATCH /api/auth/password  { currentPassword, newPassword }
 * Requires the current password as confirmation before changing it.
 */
router.patch('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    console.error('PATCH /auth/password error:', err);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

module.exports = router;