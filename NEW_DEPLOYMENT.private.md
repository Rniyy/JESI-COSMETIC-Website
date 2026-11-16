# PRIVATE — deployment notes (do not publish)

Keep this file **out of GitHub**: add `DEPLOYMENT.private.md` to `.gitignore`.
Never write real passwords or secrets in it. Keep real values in Render and
Railway, or in your password manager.

## Architecture
- Backend + website: one Render Web Service (Root Directory `backend`)
- The backend serves the website from `backend/public/` (single copy — edit there only)
- Database: Railway MySQL (use the **public** host and port from Railway, not `*.railway.internal`)
- The old static `-1` frontend service is not needed

## Render environment variables
| Variable | Value |
|----------|-------|
| `DB_HOST` | Railway public host |
| `DB_PORT` | Railway public port |
| `DB_USER` | Railway user |
| `DB_PASSWORD` | (in Railway / password manager) |
| `DB_NAME` | `railway` |
| `DB_SSL` | `false` |
| `JWT_SECRET` | 96 random hex characters |
| `CORS_ORIGINS` | `null,https://jesi-cosmetic-website.onrender.com` |
| `FRONTEND_URL` | `https://jesi-cosmetic-website.onrender.com` |
| `CLOUDINARY_CLOUD_NAME` | from Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | from Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | from Cloudinary dashboard (secret — never commit) |
| `NODE_ENV` | `production` |
| `PORT` | **do not set** (Render sets it) |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Database setup (hosted)
1. Put the Railway public details in a local `backend/.env`
2. `node run_schema.js` → should list 13 tables
3. `npm run seed` (once — it clears products, cart and wishlist first)

Schema order if run by hand: `schema.sql`, `schema_auth_additions.sql`,
`schema_reviews.sql`, `schema_review_media.sql`, `schema_coupons.sql`,
`schema_notifications.sql`, `schema_product_images.sql`,
`schema_order_lifecycle.sql`, `schema_payment_pin.sql`, `schema_stock_addition.sql`

## First admin
Register on the site, then: `node make_admin.js your@email.com`, log out and in again.

## Deploy checklist
1. Commit and push (including `backend/public/` and its images)
2. Wait for Render to show **Live**
3. `/api/health` → `{"success":true,"message":"ok"}`
4. `/api/products?limit=1` → product data

## Troubleshooting
| Symptom | Fix |
|---------|-----|
| "Failed to fetch products" | Database unreachable or tables missing — check `DB_*` and Render logs |
| "Origin … not allowed by CORS" | Add that exact origin to `CORS_ORIGINS`, redeploy |
| Logged in, then asked to log in again | Open the site on the backend address, not another site |
| `/api/auth/me` → `"data":null` | Not logged in on that address |
| "Not found" on a page | File not in `backend/public/` or not pushed |
| Broken product images | Missing file, or upper/lower case in the name doesn't match |
| Can't open admin dashboard | Account isn't admin — run `make_admin.js` |

## Reminders
- Never commit `.env`; rotate any secret that was shared or committed
- Uploaded photos/videos go to Cloudinary when the 3 `CLOUDINARY_*` vars are set; without them they fall back to Render's disk and are wiped on redeploy
- Photos uploaded before the switch were on Render's disk and are already gone — re-upload them
- Free Render plan sleeps after ~15 min idle
