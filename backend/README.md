# JESI-COSMETIC Backend

Node.js + Express + MySQL API that matches what `script.js` already expects
at `http://localhost:3000/api`. No login/accounts — cart and wishlist are
scoped to an anonymous session cookie (`jesi_sid`), since that's what the
frontend was built against.

## 1. Install dependencies

```bash
cd backend
npm install
```

## 2. Set up MySQL

Create the database and tables:

```bash
mysql -u root -p < db/schema.sql
```

Copy `.env.example` to `.env` and fill in your MySQL credentials:

```bash
cp .env.example .env
```

## 3. Seed products

Loads the 53 products already found in `shop.html`, `devices.html`, and
`sets.html` (same names, prices, images, ratings, badges) into the
`products` table:

```bash
npm run seed
```

## 4. Run the API

```bash
npm start
```

Server starts on `http://localhost:3000`. Then launch the Electron app as
usual (`npm start` in the frontend folder) — `script.js` will talk to the
API automatically.

## API endpoints

| Method | Endpoint                  | Body                        | Notes                                  |
|--------|----------------------------|------------------------------|-----------------------------------------|
| GET    | `/api/products`            | —                            | `?q=`, `?category=`, `?limit=` |
| GET    | `/api/products/:id`        | —                            | Single product                          |
| GET    | `/api/cart`                | —                            | Returns items, `item_count`, `subtotal` |
| POST   | `/api/cart`                | `{product_id, quantity}`     | Adds or increments                      |
| PATCH  | `/api/cart/:productId`     | `{quantity}`                 | Sets quantity                           |
| DELETE | `/api/cart/:productId`     | —                            | Removes line                            |
| GET    | `/api/wishlist`            | —                            | Returns items, `count`                  |
| POST   | `/api/wishlist`            | `{product_id}`                | —                                        |
| DELETE | `/api/wishlist/:productId` | —                            | —                                        |

## Notes / things you'll likely want next

- **Product images**: `image_url` values (e.g. `Booster.jpg`) are seeded
  as-is from the HTML — put the actual image files somewhere the frontend
  can reach them (a static `/images` route on this server, or keep them
  alongside the HTML as they are now).
- **Checkout**: the cart panel's "Checkout" button is still `href="#"` in
  the frontend — there's no order/payment flow here yet. Happy to add an
  `/api/orders` endpoint (and Stripe integration) if/when you want that.
- **CORS**: Electron's `loadFile()` serves pages over `file://`, which
  sends no `Origin` header (or `null`). The server already allows that;
  if you later serve the frontend over `http://` instead, add that origin
  to `CORS_ORIGINS` in `.env`.
- **Search matching**: `script.js` looks up `product_id` by exact-ish name
  match (`/api/products?q=<name>`) before every add-to-cart/wishlist call.
  Since seeded names match the HTML exactly, this works, but if you rename
  a product in the HTML later, re-run the seed or update it in the DB too.
