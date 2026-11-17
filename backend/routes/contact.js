const express = require('express');
const pool    = require('../db/pool');
const { sendContactNotification } = require('../utils/mailer');

const router = express.Router();

const SUBJECTS = ['Order question', 'Product advice', 'Shipping & delivery', 'Returns & refunds', 'Partnership', 'Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Simple in-memory limiter: max 5 messages per IP per hour (resets on restart)
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

/**
 * POST /api/contact   { name, email, subject, message, website }
 * Public. "website" is a hidden honeypot field — real people leave it empty.
 */
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};

    // Bots fill the hidden field: pretend it worked, store nothing
    if (typeof b.website === 'string' && b.website.trim() !== '') {
      return res.status(201).json({ success: true, message: 'Thanks! Your message has been sent.' });
    }

    const name    = typeof b.name    === 'string' ? b.name.trim()    : '';
    const email   = typeof b.email   === 'string' ? b.email.trim()   : '';
    const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
    const message = typeof b.message === 'string' ? b.message.trim() : '';

    if (name.length < 2 || name.length > 100)      return res.status(400).json({ success: false, message: 'Please enter your name' });
    if (!EMAIL_RE.test(email) || email.length > 190) return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    if (!SUBJECTS.includes(subject))                return res.status(400).json({ success: false, message: 'Please choose a subject' });
    if (message.length < 10)                        return res.status(400).json({ success: false, message: 'Your message is too short (at least 10 characters)' });
    if (message.length > 2000)                      return res.status(400).json({ success: false, message: 'Your message is too long (max 2000 characters)' });

    if (tooMany(req.ip)) {
      return res.status(429).json({ success: false, message: 'Too many messages — please try again later' });
    }

    await pool.query(
      'INSERT INTO contact_messages (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)',
      [req.user && req.user.id ? req.user.id : null, name, email, subject, message]
    );

    // Tell the shop owner by email — don't make the customer wait for it
    sendContactNotification({ name, email, subject, message })
      .catch(err => console.error('[contact] notification failed:', err.message));

    res.status(201).json({ success: true, message: 'Thanks! Your message has been sent. We usually reply within 1–2 days.' });
  } catch (err) {
    console.error('POST /contact error:', err);
    res.status(500).json({ success: false, message: 'Could not send your message — please try again' });
  }
});

router.get('/subjects', (req, res) => res.json({ success: true, data: SUBJECTS }));

module.exports = router;
