# Delivery Process Upgrade

Added a customer-visible, real-world nursery delivery flow for Batalawatta Plant Nursery.

## What was added

### Customer side
- New `frontend/delivery.html` page with:
  - delivery process steps
  - zone-based delivery charges
  - policy / lead-time information
- Checkout upgraded with:
  - delivery zone selection
  - preferred delivery date
  - preferred time slot
  - recipient details
  - landmark and delivery instructions
  - automatic delivery fee calculation
  - total including delivery
  - WhatsApp confirmation message with delivery details
- Account page upgraded with:
  - delivery progress tracker
  - status history timeline
  - dispatch / delivery boy info
  - visible nursery update note
- Cart page shows delivery preview before checkout.
- Delivery link added to the website navigation.

### Backend
- New delivery configuration file: `backend/config/delivery.js`
- Order model extended with:
  - subtotal
  - payment method
  - admin visible update note
  - delivery object
  - status timeline
- New public API:
  - `GET /api/orders/delivery-config`
- Checkout API now stores delivery details and calculates delivery fee.
- Admin order updates now support:
  - `scheduled`
  - `out_for_delivery`
  - delivery boy name/phone
  - vehicle number
  - customer-visible tracking note

### Admin side
- Order filter supports the new delivery statuses.
- Order detail panel shows delivery zone, receiver, notes, dispatch info, and status history.
- Order update modal supports scheduling and dispatch details.

## Main statuses
- pending
- confirmed
- preparing
- scheduled
- out_for_delivery
- delivered
- cancelled

## Run

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
Serve the `frontend/` folder with any static server, or open the HTML files directly if your browser allows it.

Recommended pages to test:
- `frontend/delivery.html`
- `frontend/cart.html`
- `frontend/checkout.html`
- `frontend/account.html`
- `frontend/admin.html`
