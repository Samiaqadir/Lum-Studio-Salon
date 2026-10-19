# Luma Studio — Hair, with feeling

A luxury, mobile-first salon website with real-time appointment booking, 3D WebGL chair customizer, interactive consultation quiz, guest reviews carousel, FAQ accordion, calendar exports, and a protected staff admin dashboard with live search and CSV export. Built on Node.js with zero runtime dependencies.

## Key Features

- **Interactive 3D WebGL Salon Stage**: 360° tactile 3D styling chair customizer with realistic upholstery, materials, smooth inertial rotation, and soft tone selectors (Cream, Blush, Sage).
- **Hair Persona & Service Matcher Quiz**: 30-second interactive consultation tool matching clients to their ideal service and artist, with 1-click booking handoff.
- **Atmosphere Lighting Switcher**: Switch smoothly between *Daylight Studio* (fresh, sunlit morning) and *Evening Glow* (warm, candlelit twilight ambiance with amber glow and champagne accents).
- **Interactive Before & After Transformation Slider**: Side-by-side hair transformation comparison with tactile drag handle and keyboard navigation.
- **Real-Time Booking Engine**:
  - Live availability computation across qualified stylists (or "First available").
  - 5-minute atomic slot holds to eliminate double-booking.
  - Server-enforced consultation rule before first-time balayage.
  - One-click **Add to Google Calendar** and **Download .ics** calendar events on booking confirmation.
- **Client Reviews & Community Love**: Verified 5-star testimonials carousel with rating metrics (4.9 / 5.0 on 280+ reviews).
- **Frequently Asked Questions (FAQ)**: Semantic `<details>` accordion addressing consultations, cancellations, arrival prep, and Williamsburg transit.
- **Staff Admin Dashboard (`/admin`)**:
  - Protected with `SALON_ADMIN_KEY`.
  - Real-time guest search by name, email, phone, or service.
  - Status filter pills (`All`, `Confirmed`, `Checked-in`, `Completed`, `Cancelled`, `No-show`).
  - One-click **Export to CSV** for records, spreadsheets, and guest books.
  - Clickable phone and email shortcuts for staff.
- **SEO & Google Rich Results**: Schema.org `HairSalon` JSON-LD structured data with geo-coordinates, opening hours, price range, and service catalogue.
- **Dual Deployment Ready**: Runs as a persistent Node.js server or as serverless functions on **Vercel** (`api/index.js` + `vercel.json`).

---

## Run locally

```powershell
$env:SALON_ADMIN_KEY = "your-private-key-here"
npm start
```

Open `http://localhost:3000` for the salon website and `http://localhost:3000/admin` for the staff dashboard.

Run the test suite:
```powershell
npm test
```

---

## Deploy to Vercel

This repository includes native Vercel serverless support:
- `api/index.js`: Serverless handler for `/api/*` endpoints.
- `vercel.json`: Automated routing for static assets in `public/` and serverless API execution.

### Option 1: Vercel CLI
```bash
npx vercel
```
Set the environment variable `SALON_ADMIN_KEY` when prompted or in your Vercel Project Settings.

### Option 2: GitHub Integration (Recommended)
1. Push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Enhance salon website with 3D customizer, quiz, reviews, and Vercel serverless support"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import `Samiaqadir/Lum-Studio-Salon`.
4. Under **Environment Variables**, add:
   - `SALON_ADMIN_KEY` = your chosen private admin key
5. Click **Deploy**. Vercel will build and deploy the project with a live production URL!

---

## API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/salon` | Salon contact info, address, and opening hours |
| GET | `/api/services` | Service catalogue with prices and durations |
| GET | `/api/stylists` | Stylist profiles and service specialties |
| GET | `/api/availability?date=YYYY-MM-DD&serviceId=…&stylistId=…` | Live slot availability |
| POST | `/api/holds` | Reserve a slot for 5 minutes |
| POST | `/api/bookings` | Confirm held slot with client details |
| GET | `/api/admin/bookings` | Retrieve all bookings (`Authorization: Bearer <KEY>`) |
| PATCH | `/api/admin/bookings/:id/status` | Update booking status (`confirmed`, `checked-in`, `completed`, `cancelled`, `no-show`) |
