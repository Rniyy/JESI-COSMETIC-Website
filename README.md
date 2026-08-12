# JESI-COSMETIC

A full-stack e-commerce web application for a K-beauty (Medicube) skincare storefront — vanilla HTML/CSS/JS frontend, a Node.js/Express REST API, and MySQL. Includes real authentication, cart/wishlist, checkout with order lifecycle tracking, stock management, an admin dashboard with sales analytics, written product reviews with photo/video attachments, and back-in-stock notifications. Also wrapped with Electron for an optional desktop build.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no framework) |
| Backend | Node.js, Express 4 |
| Database | MySQL (via Docker), `mysql2` driver |
| Auth | JWT (`jsonwebtoken`) in an httpOnly cookie + `bcryptjs` password hashing |
| File uploads | `multer` (review photos/videos) |
| Guest sessions | `uuid` + `cookie-parser` |
| Charts | Chart.js, bundled locally as `chart.umd.js` (not CDN-dependent) |
| Desktop wrapper | Electron 42 (optional — `Frontend/main.js`) |

---

## Project Structure

This repo has two top-level folders — **note the capital `F` in `Frontend`**:

```
JESI-COSMETIC-Website/
├── .gitignore
│
├── backend/
│   ├── server.js                  # Express app entry point
│   ├── .env                       # Not committed — see Setup
│   ├── package.json
│   ├── db/
│   │   ├── pool.js                # MySQL connection pool
│   │   ├── schema.sql             # Base schema
│   │   ├── schema_auth_additions.sql
│   │   ├── schema_stock_addition.sql
│   │   ├── schema_order_lifecycle.sql
│   │   ├── schema_payment_pin.sql
│   │   ├── schema_reviews.sql
│   │   ├── schema_review_media.sql
│   │   ├── schema_notifications.sql
│   │   ├── seed.js                # Seeds products from products.seed.json
│   │   └── products.seed.json
│   ├── middleware/
│   │   ├── session.js             # Guest session cookie (jesi_sid)
│   │   └── authMiddleware.js      # JWT auth (jesi_token) + requireAuth/requireAdmin
│   ├── routes/
│   │   ├── products.js
│   │   ├── cart.js
│   │   ├── wishlist.js
│   │   ├── auth.js
│   │   ├── checkout.js
│   │   ├── addresses.js
│   │   ├── admin.js
│   │   └── notifications.js
│   ├── utils/
│   │   └── mergeGuestData.js      # Merges guest cart/wishlist into account on login
│   └── uploads/reviews/           # Uploaded review photos/videos (gitignored)
│
└── Frontend/
    ├── main.js                    # Electron entry point
    ├── package.json               # Electron devDependency + `npm start` script
    ├── index.html                 # Home page
    ├── shop.html                  # Full catalog, dynamically rendered from the DB
    ├── devices.html               # Devices category (DB-filtered)
    ├── sets.html                  # Sets category (DB-filtered)
    ├── about.html                 # Static informational page
    ├── admin.html                 # Admin dashboard
    ├── script.js                  # Shared shop logic: auth, cart, checkout, wishlist,
    │                               #   notifications, quick view, search, filters
    ├── adminDashboard.js          # Admin dashboard logic
    ├── style.css                  # Base site styles
    ├── auth.css                   # Auth panel, cart/wishlist/checkout/orders/notif UI
    ├── admin.css                  # Admin dashboard styles
    ├── chart.umd.js               # Chart.js, bundled locally
    └── *.jpg / *.png               # Product images (loose files, referenced by
                                    #   products.image_url in the database)
```

`about.html` is a simpler static page — it doesn't include the cart/wishlist/auth/notification panels that the other four pages share.

---

## Setup

### 1. Prerequisites
- Node.js
- Docker (for MySQL)

### 2. Install backend dependencies
```bash
cd backend
npm install
```
Installs: `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, `cookie-parser`, `dotenv`, `uuid`.

### 3. (Optional) Install the Electron wrapper
```bash
cd Frontend
npm install
```

### 4. Start MySQL in Docker
```bash
docker run --name jesi-mysql -e MYSQL_ROOT_PASSWORD=yourpassword -p 3307:3306 -d mysql:8
```

### 5. Configure environment
Create `backend/.env` (gitignored — never commit this file):
```
PORT=3000
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=jesi_cosmetic
CORS_ORIGINS=null,http://localhost:3000
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

### 6. Load the database schema, in this exact order
```bash
docker exec -i jesi-mysql mysql -u root -p<password>                < db/schema.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_auth_additions.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_stock_addition.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_order_lifecycle.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_payment_pin.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_reviews.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_review_media.sql
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic  < db/schema_notifications.sql
```
*(Windows PowerShell: replace `... < file.sql` with `Get-Content file.sql | docker exec -i ...`.)*

### 7. Seed products (optional — fresh database only)
```bash
node db/seed.js
```
⚠️ Truncates `products`, `cart_items`, and `wishlist_items` — don't run against a database with real data.

### 8. Run the backend
```bash
npm start
```
Should print `JESI-COSMETIC API listening on http://localhost:3000`.

### 9. Open the frontend
Open any of `Frontend/shop.html`, `index.html`, `devices.html`, `sets.html`, or `about.html` in a browser — via the literal hostname **`localhost`** (not `127.0.0.1`), since login cookies are scoped to that exact hostname.

Or, optionally, run it as a desktop app:
```bash
cd Frontend
npm start
```

### 10. Create your first admin
Registration always creates a regular `user`. Promote one manually:
```bash
docker exec -i jesi-mysql mysql -u root -p<password> jesi_cosmetic -e "UPDATE users SET role='admin' WHERE email='your@email.com';"
```

---

## Features

### Shopping
- Product cards render dynamically from the database on `shop.html`/`devices.html`/`sets.html` — admin edits reflect immediately
- Out-of-stock products show a dark overlay and disabled "Add to cart"
- Quick View modal with full product detail + reviews
- Wishlist works for guests (session-based) and logged-in users
- Cart **requires login** — enforced both client- and server-side

### Accounts
- Register / login / logout, bcrypt-hashed passwords, JWT session
- Guest cart & wishlist merge into the account automatically on login
- Edit profile and change password (current password required)
- Password reset (reset link currently logs to the server console — no email service wired up)
- Saved shipping addresses, reused at checkout or replaced with a new one

### Checkout & Orders
- Checkout runs as a single database transaction: snapshot cart → decrement stock atomically → save address → create order → clear cart
- Stock decremented via guarded `UPDATE ... WHERE stock_quantity >= ?`, preventing overselling the last unit under concurrent checkouts
- Order lifecycle: **To Pay → To Receive → To Review → Recent Order** (+ Cancelled)
  - To Pay: confirmed via a 4-digit payment PIN, set once and reused for every future order
  - To Receive: admin advances status as the order ships
  - To Review: customer submits a star rating, optional comment, and up to 5 photo/video attachments
  - Recent Order: shows the rating given + an "Order this again?" button
  - Cancelling a To Pay order restocks every item automatically

### Reviews
- Ratings tied to specific products (not just the order)
- Photo/video attachments (images ≤5MB, videos ≤30MB, saved to `backend/uploads/reviews/`)
- A product's `rating` is a real computed average from actual reviews
- Displayed in Quick View with reviewer first name, stars, comment, date, and media thumbnails

### Notifications
- Wishlisting an out-of-stock item, then an admin restocking it, triggers an in-app notification
- Bell icon in the navbar with an unread-count badge

### Admin Dashboard (`admin.html`)
Role-gated (`role: 'admin'`), enforced by frontend redirect and a backend middleware that re-checks the role from the database on every request (not a cached value from the login token).
- **Products** — full CRUD, stock quantity drives the out-of-stock display automatically
- **Orders** — search/filter by customer, product, date range, or status; view detail; advance status
- **Users** — promote/demote admin role, delete accounts (can't demote/delete yourself)
- **Analytics** — revenue trend chart, sales-by-category and orders-by-status donuts, year-over-year comparisons, top-selling products

---

## API Overview

| Base path | Purpose |
|---|---|
| `/api/auth` | register, login, logout, /me, password reset, profile/password edit |
| `/api/products` | public product listing, single product, reviews |
| `/api/cart` | cart CRUD (requires login) |
| `/api/wishlist` | wishlist CRUD (guest or logged-in) |
| `/api/checkout` | place order, pay, cancel, review, order history |
| `/api/addresses` | saved shipping addresses |
| `/api/notifications` | in-app notifications |
| `/api/admin` | products/orders/users CRUD + analytics (admin-only) |

---

## Known Limitations

- **No real payment gateway** — "Pay Now" is a mocked confirmation gated behind a 4-digit PIN, not an actual payment processor.
- **No real email service** — password reset links and back-in-stock notices log to the server console rather than sending real emails.
- **`about.html`** is a static page that doesn't share the cart/wishlist/auth/notification panels the other pages use.
- **Electron desktop build** is optional and separate from normal browser usage; some managed/school computers may block its binary via Application Control policies — this doesn't affect the website itself.
