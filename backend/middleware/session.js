const { v4: uuidv4 } = require('uuid');

const COOKIE_NAME = 'jesi_sid';
const MAX_AGE_MS  = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Every visitor gets an anonymous session id stored in an httpOnly cookie.
 * Cart and wishlist rows are scoped to this id — there's no login flow
 * in the frontend, so this is the only concept of "user" the API needs.
 *
 * sameSite: 'none' + secure: true is required because the frontend dev
 * server and this API run on different origins (different ports, and
 * possibly different hostnames like 127.0.0.1 vs localhost). Browsers
 * will not send a SameSite=Lax cookie on a cross-site fetch() call, so
 * every request was getting treated as a brand new visitor.
 *
 * NOTE: `secure: true` normally requires HTTPS — but Chrome, Firefox and
 * Edge all treat http://localhost as a "secure context" exception, so this
 * works over plain http as long as BOTH the frontend and this API are
 * accessed via the literal hostname "localhost" (not "127.0.0.1", not your
 * machine's LAN IP — those are NOT covered by the localhost exception and
 * will silently drop the cookie).
 */
function ensureSession(req, res, next) {
  let sessionId = req.cookies[COOKIE_NAME];

  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'none',
      secure:   true,
      maxAge:   MAX_AGE_MS,
    });
  }

  req.sessionId = sessionId;
  next();
}

module.exports = { ensureSession, COOKIE_NAME };