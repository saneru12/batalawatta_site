# Admin Panel (Added)

## Backend (API)

1) Go to backend folder:
   ```bash
   cd backend
   ```

2) Install dependencies:
   ```bash
   npm install
   ```

3) Configure `.env`
   - Keep your `MONGO_URI`
   - Add / change:
     - `JWT_SECRET`
     - `ADMIN_EMAIL`
     - `ADMIN_PASSWORD`  (or `ADMIN_PASSWORD_HASH`)

4) Run backend:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`

> Optional: seed demo plants
```bash
npm run seed
```

## Admin Frontend

Open:
- `frontend/admin.html`

(You can open directly in browser, or host the `frontend/` folder with any static server.)

## What you can control

- Plants: Add / Edit / Delete, price, category, availability, image URL
- Landscaping Packages: Add / Edit / Delete, show/hide on website, includes list
- Landscaping Requests: View customer requests, update status, add admin note (visible to customer)
- Orders: View, update delivery status, schedule dispatch, assign delivery boy / vehicle, add customer-visible tracking notes
- Inquiries: View, update status, delete
- Reviews: Approve/Hide, delete

## Security note

This is a simple single-admin setup using environment variables.
For production hosting, protect the admin URL and always use HTTPS.
