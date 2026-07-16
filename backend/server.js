require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const { ensureSession }  = require('./middleware/session');
const { attachUser, requireAuth } = require('./middleware/authMiddleware');
const productsRoutes    = require('./routes/products');
const cartRoutes         = require('./routes/cart');
const wishlistRoutes     = require('./routes/wishlist');
const authRoutes         = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// Electron's loadFile() serves pages over file://, which sends either no
// Origin header or "null". Allow that alongside whatever's in CORS_ORIGINS.
const allowedOrigins = (process.env.CORS_ORIGINS || 'null,http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(ensureSession);
app.use(attachUser);

app.use('/api/auth',     authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart',     requireAuth, cartRoutes);
app.use('/api/wishlist', wishlistRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'ok' }));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`JESI-COSMETIC API listening on http://localhost:${PORT}`);
});