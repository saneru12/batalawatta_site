# Delivery Ops Upgrade - Batalawatta Plant Nursery

This upgrade adds a real-world delivery workflow for nursery-owned vehicle deliveries.

## What was added

### 1) Delivery Zones & Charges management
Admin can now manage delivery settings from **Admin > Delivery Ops**:
- Add/edit delivery zones
- Add/edit areas covered by each zone
- Set delivery fee per zone
- Set lead time label and default lead days
- Mark same-day eligible zones
- Manage delivery time slots
- Configure base delivery rules like same-day cutoff and stop limits

### 2) Delivery boy management
Admin can now:
- Add multiple delivery boys
- Create separate login credentials for each rider
- Set vehicle type/number
- Set active zones for each rider
- Set preferred time slots
- Set daily and per-slot stop capacity
- Deactivate riders when needed

### 3) Dispatch board
Admin can now:
- See unassigned / scheduled / out-for-delivery orders
- View rider workload for a selected date
- Get rider recommendations based on:
  - zone coverage
  - workload balance
  - slot capacity
  - route clustering by zone
- Assign a rider to an order
- Set route sequence for a rider

### 4) Delivery staff portal
New page: **frontend/delivery-staff.html**

Each delivery boy can:
- Log in with their own username/password
- See assigned orders
- See customer phone, address, landmark, and route details
- Log delivery activities:
  - Accept route
  - Plants loaded
  - Left nursery
  - Arrived nearby
  - Delivered successfully
  - Report issue
- Upload proof photo / PDF
- Record receiver name
- Record COD cash collection

### 5) Order tracking upgrade
Customer/account order history now shows:
- assigned delivery boy name / phone / vehicle
- updated delivery activity history
- proof link when uploaded
- COD handover progress

## New backend pieces
- `backend/models/DeliverySettings.js`
- `backend/models/DeliveryBoy.js`
- `backend/middleware/deliveryStaffAuth.js`
- `backend/routes/delivery.js`
- `backend/config/deliverySettings.js`

## Main files updated
- `backend/models/Order.js`
- `backend/routes/orders.js`
- `backend/server.js`
- `frontend/admin.html`
- `frontend/assets/js/admin.js`
- `frontend/assets/css/admin.css`
- `frontend/delivery.html`
- `frontend/assets/js/delivery-page.js`
- `frontend/assets/js/account.js`

## Recommended first-time setup
1. Start backend and frontend as usual.
2. Log into admin panel.
3. Open **Delivery Ops**.
4. Review and save your delivery zones, time slots, and rules.
5. Add delivery boys with usernames and passwords.
6. Open **Dispatch Board** and assign riders to orders.
7. Share `delivery-staff.html` login credentials with each delivery boy.

## Notes
- Delivery proof files are uploaded to `backend/uploads/delivery-proofs/`.
- Rider authentication uses a dedicated JWT flow separate from admin/customer login.
- COD collection on successful delivery automatically updates payment status to verified.
