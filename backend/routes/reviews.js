const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

const SORTS = {
  new:  'r.created_at DESC, r.id DESC',
  old:  'r.created_at ASC, r.id ASC',
  high: 'r.rating DESC, r.created_at DESC',
  low:  'r.rating ASC, r.created_at DESC',
};

/**
 * GET /api/reviews
 * Public list of every customer review.
 * Query: page (1), limit (10, max 30), rating (1-5), product_id, sort (new|old|high|low)
 * Reviewer last names and emails are never exposed — first name only.
 * Returns { summary: {count, average, distribution:{1..5}}, products: [...], data: [...], hasMore }
 * The summary respects the product filter but not the rating filter, so the
 * star bars stay meaningful while a rating is selected.
 */
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const rating = parseInt(req.query.rating, 10);
    const productId = parseInt(req.query.product_id, 10);
    const orderBy = SORTS[req.query.sort] || SORTS.new;

    const prodWhere  = Number.isInteger(productId) ? 'WHERE r.product_id = ?' : '';
    const prodParams = Number.isInteger(productId) ? [productId] : [];

    // Star summary (product filter only)
    const [distRows] = await pool.query(
      `SELECT r.rating, COUNT(*) AS n FROM reviews r ${prodWhere} GROUP BY r.rating`,
      prodParams
    );
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0, sum = 0;
    for (const row of distRows) {
      if (distribution[row.rating] === undefined) continue;
      distribution[row.rating] = Number(row.n);
      count += Number(row.n);
      sum   += Number(row.rating) * Number(row.n);
    }
    const average = count ? Math.round((sum / count) * 10) / 10 : 0;

    // Page of reviews (product + rating filters)
    const conds = [];
    const params = [];
    if (Number.isInteger(productId)) { conds.push('r.product_id = ?'); params.push(productId); }
    if (rating >= 1 && rating <= 5)  { conds.push('r.rating = ?');     params.push(rating); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.product_id,
              p.name AS product_name, p.image_url AS product_image,
              SUBSTRING_INDEX(u.name, ' ', 1) AS reviewer_first_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN products p ON p.id = r.product_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit + 1, (page - 1) * limit]
    );

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);

    let mediaByReview = {};
    if (pageRows.length) {
      const [media] = await pool.query(
        'SELECT review_id, media_type, url FROM review_media WHERE review_id IN (?) ORDER BY id ASC',
        [pageRows.map(r => r.id)]
      );
      for (const m of media) {
        (mediaByReview[m.review_id] = mediaByReview[m.review_id] || []).push({ media_type: m.media_type, url: m.url });
      }
    }

    // Products that have reviews (for the filter dropdown)
    const [products] = await pool.query(
      `SELECT p.id, p.name, COUNT(*) AS review_count
       FROM reviews r JOIN products p ON p.id = r.product_id
       GROUP BY p.id, p.name ORDER BY p.name ASC`
    );

    res.json({
      success: true,
      summary: { count, average, distribution },
      products,
      page,
      hasMore,
      data: pageRows.map(r => ({ ...r, media: mediaByReview[r.id] || [] })),
    });
  } catch (err) {
    console.error('GET /reviews error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

module.exports = router;
