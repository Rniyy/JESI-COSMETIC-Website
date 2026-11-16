# JESI-COSMETIC

A full-stack online shop for Medicube K-beauty skincare — built from scratch
with a Node.js / Express API, a MySQL database and a responsive vanilla
JavaScript storefront.

**Live demo:** https://jesi-cosmetic-website.onrender.com

> The demo runs on a free hosting plan, so the first visit after a quiet period
> can take up to a minute to load.

---

## Features

### For customers
- Browse 50+ products by category (serums, moisturizers, devices, cleansers,
  pads & masks, sets) with live search
- Product quick view with photo gallery, reviews and related products
- Accounts: register, log in, edit profile, change password, reset password by email
- Cart and wishlist (guest items are kept when you log in)
- Saved shipping addresses and a checkout flow with coupon codes
- Order tracking by stage: To Pay → To Receive → To Review → Completed / Cancelled
- Product reviews with star rating, photos and video
- In-app notifications
- Fully responsive on phone, tablet and desktop

### For admins
- Dashboard with revenue, orders and units-sold analytics and charts
- Product management: add, edit, delete, photo galleries, stock levels and low-stock alerts
- Order management: search, filter by date and status, update status
- Coupon management and user management (roles)
- CSV export for products and orders

---

## Tech stack

| Area | Technology |
|------|------------|
| Frontend | HTML, CSS, vanilla JavaScript, Chart.js |
| Backend | Node.js, Express |
| Database | MySQL |
| Auth | JWT in httpOnly cookies, bcrypt-hashed passwords |
| Email | Nodemailer (SMTP) |
| Media storage | Cloudinary (local disk in development) |
| Desktop (optional) | Electron |

---

## Project structure

```
backend/
├── server.js        Express app (API + serves the website)
├── public/          Website: pages, styles, scripts, images
├── routes/          API routes (auth, products, cart, checkout, admin, …)
├── middleware/      Authentication and roles
├── db/              Database schema and seed data
├── utils/           Helpers (email)
└── data/            Checkout location data
```

---

## Getting started

Requirements: Node.js and MySQL.

```bash
cd backend
npm install
cp env.example .env     # add your own database and secret values
npm run seed            # load the sample products
npm start               # http://localhost:3000
```

Create the database tables first by running the SQL files in `backend/db/`.
See `env.example` for the settings the app expects.

---

## Roadmap

- Real payment gateway (KHQR / ABA PayWay, or Stripe)
- Order confirmation emails
- Search sorting and price filters
- Automated tests

---

## Disclaimer

This is a portfolio / learning project and is not affiliated with Medicube or
APR Corp.