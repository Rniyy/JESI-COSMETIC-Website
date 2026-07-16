const jwt = require('jsonwebtoken');

const TOKEN_COOKIE = 'jesi_token';
const JWT_SECRET    = process.env.JWT_SECRET;
const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set in .env — auth tokens are insecure until you set one.');
}

/**
 * Runs on every request (after ensureSession). Does NOT block unauthenticated
 * requests — it just populates req.user if a valid login cookie is present,
 * so routes can check `if (req.user)` themselves.
 */
function attachUser(req, res, next) {
  const token = req.cookies[TOKEN_COOKIE];
  req.user = null;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.id, email: payload.email, role: payload.role };
    } catch (err) {
      // Invalid/expired token — treat as logged out, clear the bad cookie.
      res.clearCookie(TOKEN_COOKIE);
    }
  }

  next();
}

/** Blocks the request unless a valid user is logged in. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Please log in to continue' });
  }
  next();
}

/** Blocks the request unless a valid ADMIN user is logged in. */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Please log in to continue' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

function issueToken(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'none',
    secure:   true, // works over plain http as long as both sides use the literal hostname "localhost"
    maxAge:   TOKEN_MAX_AGE_MS,
  });
}

function clearToken(res) {
  res.clearCookie(TOKEN_COOKIE, { sameSite: 'none', secure: true });
}

module.exports = { attachUser, requireAuth, requireAdmin, issueToken, clearToken, TOKEN_COOKIE };
