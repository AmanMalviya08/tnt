# API Additions — Phase 1 Backend (June 2026)

## Feature 1: Tour Live Status (11 Journey Stages)

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tour-status/meta/stages` | Public | List all 11 journey stages with labels/icons |
| POST | `/api/tour-status/update` | Admin | Update status (`tourId`, `statusCode`, `lat`, `lng`, `note` in body) |
| POST | `/api/tour-status/update/:tourId` | Admin | Same as above with tourId in URL |
| GET | `/api/tour-status/:tourId` | User | Current status + full history |
| GET | `/api/tour-status/:tourId/my-status` | User | Status (requires booking on tour) |
| GET | `/api/tour-status/:tourId/live` | Public | SSE stream for real-time updates |
| GET | `/api/admin/tours/:tourId/status-board` | Admin | Admin status board with history |

### Status Codes

`JOURNEY_STARTED`, `TRAVELLING_BY_BUS`, `TRAVELLING_BY_TRAIN`, `WALKING_ON_FOOT`, `REACHED_TEMPLE`, `TEMPLE_VISIT_IN_PROGRESS`, `BREAK_REST_STOP`, `AT_HOTEL`, `VISIT_AT_ATTRACTION`, `RETURNING_JOURNEY`, `TOUR_COMPLETE`

### Real-time

- **Socket.io:** join room `join-tour-status` with `tourId`, listen for `tour-status-update`
- **SSE:** `GET /api/tour-status/:tourId/live` — events: `connected`, `snapshot`, `status-update`

### Push Notifications

On each status update, all users with Confirmed/Pending bookings on that tour receive FCM push.

---

## Feature 2: Dark Mode / User Preferences

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/api/user/preferences` | User | — |
| PATCH | `/api/user/preferences` | User | `{ "theme": "light" \| "dark" \| "system", "language": "en" \| "hi" \| "mr" \| "gu" }` |

---

## Feature 11: Trip Countdown / Departure DateTime

### New Fields

- **Booking:** `departureDateTime`, `departureTimezone` (default `Asia/Kolkata`)
- **Tour:** `departureDateTime`, `departureTimezone`, `currentJourneyStatus`, `currentJourneyStatusAt`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bookings/upcoming` | User | Upcoming bookings sorted by `departureDateTime` |
| GET | `/api/bookings/history` | User | Now includes `departureDateTime` in each item |

### Example Response (`/api/bookings/upcoming`)

```json
{
  "success": true,
  "data": [
    {
      "bookingId": "BK-XXXX",
      "departureDateTime": "2026-07-15T06:00:00.000Z",
      "departureTimezone": "Asia/Kolkata",
      "tourName": "Shirdi Yatra"
    }
  ],
  "pagination": { "totalItems": 1, "currentPage": 1 }
}
```

---

## Models Added

- `TourStatusLog` — `src/models/tourStatusLogModel.js`

## Files Added

- `src/constants/tourStatusConstants.js`
- `src/services/tourStatusService.js`
- `src/controller/tourStatusController.js`
- `src/routes/tourStatusRoutes.js`
- `src/controller/userPreferencesController.js`
- `src/routes/userPreferencesRoutes.js`

---

## Phase 2: Scratch Coupons (Feature 9)

### Auto-generation

One scratch coupon is created per confirmed booking (on payment confirm or test-payment).

### User Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/coupons/mine` | User | List user's scratch coupons |
| POST | `/api/coupons/:id/scratch` | User | Reveal reward |
| POST | `/api/coupons/:id/redeem` | User | Mark digital reward redeemed |

### Admin Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/coupons` | Admin | List coupons (`rewardType`, `isRedeemed` query filters) |
| PATCH | `/api/admin/coupons/:id/redeem` | Admin | Mark physical gift as fulfilled |

### Model

`ScratchCoupon` — `src/models/scratchCouponModel.js`

Reward types: `PHYSICAL_GIFT`, `DISCOUNT_PERCENT`, `CASHBACK`

---

## Phase 2: Trip Photo Gallery UGC (Feature 12)

Separate from CMS gallery at `/api/gallery` (marketing media).

### User Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/trip-photos/upload` | User | Multipart `image` + `tourId`, optional `caption` |
| GET | `/api/trip-photos/tour/:tourId` | Public | Approved photos for tour |
| GET | `/api/trip-photos/tour/:tourId/mine` | User | User's photos (incl. pending) |
| POST | `/api/trip-photos/photo/:photoId/like` | User | Toggle like |
| DELETE | `/api/trip-photos/photo/:photoId` | User | Delete own photo |
| GET | `/api/trip-photos/photo/:photoId/share-link` | Public | Deep link for sharing |

Max **10 photos per user per tour**. Uploads require confirmed booking on tour.

### Admin Moderation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/gallery/pending` | Admin | Pending UGC photos |
| PATCH | `/api/admin/gallery/:id/approve` | Admin | Approve photo |
| DELETE | `/api/admin/gallery/:id` | Admin | Reject and delete |
| PATCH | `/api/admin/gallery/bulk-approve` | Admin | Body: `{ "ids": ["..."] }` |

### Model

`TripPhoto` — `src/models/tripPhotoModel.js`
