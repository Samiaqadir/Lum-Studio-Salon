# Luma Studio

A mobile-first salon website with a working appointment booking flow and a password-protected staff dashboard. Built on Node.js 20+ with no external runtime dependencies.

## Run locally

```powershell
$env:SALON_ADMIN_KEY = "use-a-long-private-key"
npm start
```

Open `http://localhost:3000` for the salon website and `/admin` for the staff dashboard. Bookings are stored in `data/store.json`, created on the first run. Set `PORT` to choose a different port.

Run the automated backend tests with `npm test`.

## What's included

- Responsive salon homepage with a four-photo hero collage and four-image studio gallery, a searchable-by-browser HTML service menu, staff profiles, a studio approach, location, and hours.
- Booking flow for service, qualified stylist (or first available), date, computed live availability, client details, and acceptance of the cancellation policy.
- Complimentary colour consultations and server-enforced consultation completion before first-time balayage bookings.
- Five-minute slot holds and serialized, overlap-checked booking writes to prevent double-booking on a single running server.
- Persistent appointments and per-booking policy acceptance timestamps.
- Staff dashboard, available at `/admin` and linked in the footer, secured by `SALON_ADMIN_KEY`, with appointment list and status updates.
- Input validation, bounded request bodies, safe static file paths, and useful API errors.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/salon` | Salon contact information and opening hours |
| GET | `/api/services` | Service catalogue, duration, and price |
| GET | `/api/stylists` | Stylist profiles |
| GET | `/api/availability?date=YYYY-MM-DD&serviceId=…&stylistId=…` | Compute available local appointment starts |
| POST | `/api/holds` | Temporarily reserve a valid slot |
| POST | `/api/bookings` | Confirm a held slot with client details and policy acceptance |
| GET | `/api/admin/bookings` | List bookings (`Authorization: Bearer <SALON_ADMIN_KEY>`) |
| PATCH | `/api/admin/bookings/:id/status` | Update appointment status (admin key required) |

## Production integrations

This starter deliberately does not collect or process card details, send real email/SMS messages, or claim to send confirmation messages. Connect a payment provider and messaging service before enabling deposits, card-on-file rules, or automated reminders. Configure the salon's own name, service catalogue, staff, location, hours, cancellation policy, and timezone before launch.

The JSON store and in-process write queue suit a local demo or a single Node.js instance. A multi-instance deployment needs a transactional database and a cross-process exclusion/locking strategy for slot holds and overlapping appointments. Use HTTPS, a unique secret for `SALON_ADMIN_KEY`, and a secure deployment environment for any production use.
