# Payment Flow Upgrade - Batalawatta Plant Nursery

## What was added

- Slip / screenshot upload at checkout for manual payment methods.
- Admin-configurable payment methods:
  - Cash on Delivery
  - Direct Bank Transfer
  - LANKAQR / Mobile Banking QR
  - Skrill
  - Crypto wallets with per-wallet QR upload
- Admin-configurable WhatsApp number used by checkout confirmation.
- Payment proof saved with each order.
- Payment status review in Admin > Orders.
- Payment settings management in Admin > Settings.
- Static upload hosting from `backend/uploads`.

## Real-world flow used

### Cash on Delivery
- Customer books delivery and places the order.
- Nursery confirms the route by phone / WhatsApp.
- Cash is collected on handover.

### Bank Transfer / LANKAQR / Skrill / Crypto
- Customer pays the exact order total before placing the order.
- Customer uploads a slip / screenshot (and TX hash for crypto).
- Order is stored as `proof_uploaded`.
- Admin reviews the proof and changes payment status to `verified` or `rejected`.
- Order moves to dispatch only after verification.

## Important note about WhatsApp

This build uses a **free and stable WhatsApp flow**:
- After order placement, the site opens a prefilled WhatsApp message to the admin number.
- The message includes order details and a public link to the uploaded slip.

This is the most reliable free approach for a normal website.
Sending images directly into WhatsApp chats automatically usually requires a paid / managed API or an unofficial automation setup.

## Setup

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Update `backend/.env` with your MongoDB URI and admin credentials.
3. Start backend:
   ```bash
   npm start
   ```
4. Open `frontend/admin.html` and login.
5. Go to **Settings** and fill:
   - WhatsApp number
   - Bank details
   - QR images
   - Skrill account
   - Crypto wallet addresses + QR images
6. Save the settings.
7. Test checkout from the frontend.

## Upload locations

- Order slips: `backend/uploads/payment-slips`
- Payment QR images: `backend/uploads/payment-settings`

## Files changed

- `backend/server.js`
- `backend/models/Order.js`
- `backend/models/PaymentSettings.js`
- `backend/config/payment.js`
- `backend/routes/orders.js`
- `backend/routes/settings.js`
- `backend/utils/uploads.js`
- `frontend/checkout.html`
- `frontend/assets/js/checkout.js`
- `frontend/assets/js/admin.js`
- `frontend/assets/js/account.js`
- `frontend/assets/js/app.js`
- `frontend/assets/css/style-enhanced.css`
- `frontend/assets/css/admin.css`
- `frontend/admin.html`
