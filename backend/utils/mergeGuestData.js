/**
 * When a guest (identified by session_id) logs in, fold their cart/wishlist
 * rows into the user's own rows, then delete the now-orphaned guest rows.
 *
 * If the user already has the same product in their cart, quantities add
 * together. If they'd already wishlisted the same product, the guest's
 * duplicate is just dropped (INSERT IGNORE).
 */
async function mergeGuestCartAndWishlist(pool, sessionId, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // --- Cart: merge quantities for products the user already has ---
    const [guestCartRows] = await conn.query(
      'SELECT product_id, quantity FROM cart_items WHERE session_id = ?',
      [sessionId]
    );
    for (const row of guestCartRows) {
      await conn.query(
        `INSERT INTO cart_items (session_id, user_id, product_id, quantity)
         VALUES (NULL, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [userId, row.product_id, row.quantity]
      );
    }
    await conn.query('DELETE FROM cart_items WHERE session_id = ?', [sessionId]);

    // --- Wishlist: just carry over anything not already saved ---
    const [guestWishRows] = await conn.query(
      'SELECT product_id FROM wishlist_items WHERE session_id = ?',
      [sessionId]
    );
    for (const row of guestWishRows) {
      await conn.query(
        `INSERT IGNORE INTO wishlist_items (session_id, user_id, product_id)
         VALUES (NULL, ?, ?)`,
        [userId, row.product_id]
      );
    }
    await conn.query('DELETE FROM wishlist_items WHERE session_id = ?', [sessionId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { mergeGuestCartAndWishlist };
