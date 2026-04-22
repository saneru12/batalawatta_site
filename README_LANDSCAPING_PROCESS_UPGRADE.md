# Landscaping Process Upgrade - Batalawatta Plant Nursery

This update improves the Landscaping page to match a more real-world, architect-led workflow.

## What changed

### Frontend
- Public visitors can now browse landscaping packages without being forced to log in.
- Added a new architect-led Landscaping Process section.
- Added richer package cards with:
  - description
  - ideal area
  - consultation mode
  - aftercare
  - visible included items
- Added a full package details modal.
- Added a package comparison table.
- Upgraded the request form to collect a stronger project brief:
  - property type
  - garden size
  - budget range
  - preferred consultation
  - preferred date
  - project goals
  - notes

### Backend
- Expanded `LandscapingPackage` with optional real-world fields:
  - `idealArea`
  - `consultationMode`
  - `aftercare`
  - `architectLed`
  - `deliverables`
  - `exclusions`
- Expanded `LandscapingRequest` with optional project brief fields:
  - `propertyType`
  - `budgetRange`
  - `consultationPreference`
  - `projectGoals`
- Updated seed packages with richer landscaping scope information.

### Admin / Account
- Admin can now manage the new landscaping package fields.
- Admin request detail view shows the richer project brief.
- Customer account view now shows extra landscaping request details.

## Main files changed
- `frontend/landscaping.html`
- `frontend/assets/js/landscaping.js`
- `frontend/assets/js/admin.js`
- `frontend/assets/js/account.js`
- `backend/models/LandscapingPackage.js`
- `backend/models/LandscapingRequest.js`
- `backend/routes/landscaping.js`
- `backend/server.js`

## Notes
- Existing landscaping packages continue to work because new fields are optional.
- Final quotations are still expected to be confirmed after consultation / site review.
