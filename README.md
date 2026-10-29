# Luma Hair Studio — Salon Website & QA Suite

A responsive, high-aesthetic salon web application and appointment booking system with an integrated staff administrative dashboard, automated QA test runner, and social planner specification. Built with modern Vanilla HTML, CSS, JavaScript, and Node.js 20+ with zero external runtime dependencies.

---

## 🚀 Quick Start (Verified from Clean Clone)

### Prerequisites
* **Node.js**: Version 20.0.0 or later (`node -v`)
* **npm**: Version 9.0.0 or later (`npm -v`)

### 1. Start the Application

**Windows (PowerShell):**
```powershell
$env:SALON_ADMIN_KEY = "luma-secure-admin-pass"
npm start
```

**macOS / Linux:**
```bash
SALON_ADMIN_KEY="luma-secure-admin-pass" npm start
```

Open your browser to:
* **Salon Website:** [http://localhost:3000](http://localhost:3000)
* **Staff Portal:** [http://localhost:3000/admin](http://localhost:3000/admin) (Log in with the `SALON_ADMIN_KEY` defined above)

Appointments and holds are persisted to `data/store.json`, automatically seeded on first launch.

### 2. Run Test Suites
```bash
# Core Node.js native test runner (12/12 integration tests)
npm test

# Full 29-scenario comprehensive QA runner (6 suites)
node scratch/run_full_qa.js
```

---

## 📐 Project Structure & Documentation

* **[LUMA_SALON_MVP_DEMO_QA_REPORT.md](./LUMA_SALON_MVP_DEMO_QA_REPORT.md)**: Executive MVP Demo & Comprehensive QA Report covering Tasks 1–4, real vs. mocked architecture, 39/39 regression tests, defect resolution log, Social Planner prototype, and risk analysis.
* **[API_CONTRACT.md](./API_CONTRACT.md)**: Formal API & Mock Contract specification covering all endpoints (`/api/holds`, `/api/bookings`, `/api/posts`), error codes, payload schemas, input preservation guarantees, and the Mock Data Privacy & Security Policy.
* **[DEFECT_LIST.md](./DEFECT_LIST.md)**: Standardized Defect Triage Register classifying all defects (Critical, High, Medium, Low) with steps, expected/actual results, environment, evidence, and remediation logs (DEF-001 through DEF-007).
* **[QA_CHECKLIST.md](./QA_CHECKLIST.md)**: Comprehensive Quality Assurance Checklist with individual test IDs and expected results across 8 categories (Page Loading, Navigation, Required Fields, Mobile Layout, Keyboard Access, Error States, Broken Links, and Social Content Planner).
* **[QA_TEST_SHEET.md](./QA_TEST_SHEET.md)**: Scenario execution matrix documenting verified test runs, inputs, expected/actual outcomes, and defect traceability.
* **[SCOPE.md](./SCOPE.md)**: Salon Scope & Social Planner Specifications.
* **`screenshots/`**: Visual evidence captured across standard desktop and mobile resolutions.

```text
├── SCOPE.md                  # Task 1 & Task 4: Salon Scope & Social Planner Specifications
├── QA_CHECKLIST.md           # Task 3: Comprehensive QA Checklist with IDs & Expected Results
├── README.md                 # Project instructions, architecture, and verification
├── server.js                 # Zero-dependency HTTP server, static file router & JSON API
├── package.json              # Project scripts and node engine constraints
├── data/
│   ├── default-store.json    # Initial seed data (salon info, services, stylists)
│   └── store.json            # Persistent appointment & hold storage
├── public/
│   ├── index.html            # Main salon single-page website
│   ├── styles.css            # Responsive styles, design tokens & animations
│   ├── app.js                # Interactive client SPA logic & booking modal controller
│   ├── admin.html            # Staff dashboard interface
│   ├── admin.css             # Administrative styles
│   └── admin.js              # Admin dashboard data fetching and status updates
├── screenshots/
│   ├── desktop_preview_1280.png # 1280px wide desktop preview
│   └── mobile_preview_375.png  # 375px mobile viewport preview
├── test/
│   └── server.test.js        # Automated backend integration tests
└── scratch/
    ├── run_full_qa.js        # 25-scenario automated QA test suite
    └── test_screenshot.js    # Chrome headless multi-width screenshot generator
```

---

## ✨ Features & Architecture Highlights

### 1. Responsive Salon Experience (Desktop & Mobile)
* **Top Utility Bar:** Direct telephone link, Brooklyn address, opening hours, and social media links.
* **Accessible Header & Navigation:** Skip-to-content accessibility link (`.skip-link`), custom wordmark branding, smooth anchor links (`#home`, `#services`, `#team`, `#studio`, `#visit`), and a mobile hamburger drawer with keyboard trap management.
* **Hero Banner:** Atmospheric visual styling, rotating dynamic value propositions ("like you.", "effortless.", "radiant.", "alive."), social proof review badges (4.9/5 from 180+ reviews), and dual call-to-action buttons.
* **Curated Service Menu:** Upfront pricing, clear durations, categorized cards (Haircuts, Colour & Lightening, Treatments), and direct 1-click pre-selection for the booking modal.
* **Team & Staff Roster:** Stylist bio cards, specialty tags (Senior Colorist, Texture Specialist), and direct book-with-stylist links.
* **Studio Gallery & Philosophy:** Natural light atelier photography and client testimonials.
* **Mobile Floating Booking Bar:** Sticky bottom action bar on mobile screens ensuring frictionless 1-tap booking access.

### 2. High-Integrity Appointment Engine
* **5-Minute Slot Holds (`POST /api/holds`):** When a user selects an available time slot, an exclusive 5-minute hold is acquired. Conflicting holds return an instant HTTP 409 Conflict to eliminate double-booking race conditions.
* **Balayage Prerequisite Safety Rule:** The booking engine verifies that clients booking a "Dimensional Balayage & Gloss" have completed a preliminary colour consultation, protecting hair health and scheduling accuracy.
* **Serialized Write Queue:** File writes to `data/store.json` are queued sequentially to prevent concurrency hazards.

### 3. Staff Dashboard (`/admin`)
* Accessible at `/admin` and secured via HTTP Bearer token (`SALON_ADMIN_KEY`).
* Inspect all booked appointments, view client contact details, filter by date/stylist, and transition appointment states (`confirmed` → `checked-in` → `completed` → `cancelled`).

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required? |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/salon` | Returns salon contact info, hours, and address | No |
| `GET` | `/api/services` | Returns categorized service catalogue with pricing and durations | No |
| `GET` | `/api/stylists` | Returns list of staff profiles and specialties | No |
| `GET` | `/api/availability` | Computes available start slots for date, service, and stylist | No |
| `POST` | `/api/holds` | Acquires a temporary 5-minute exclusive hold on a slot | No |
| `POST` | `/api/bookings` | Finalizes hold with client details and policy acceptance | No |
| `GET` | `/api/admin/bookings` | Lists all salon appointments | Yes (`Bearer <KEY>`) |
| `PATCH` | `/api/admin/bookings/:id/status` | Updates appointment status (`checked-in`, `completed`, etc.) | Yes (`Bearer <KEY>`) |
| `POST` | `/api/admin/services` | Creates a new service in the salon catalogue | Yes (`Bearer <KEY>`) |

---

## 📋 Social Planner Scope (Task 4)
* **Calendar View:** Monthly and weekly grid layout showing scheduled salon content with visual status chips.
* **Post Composer:** Caption editor with live character counters (Instagram, Facebook, Pinterest), hashtag libraries, and media preview.
* **Platform Selector:** Multi-network targeting for Instagram Feed/Stories, Facebook, Pinterest, and Google Business Profile.
* **Status Engine:** Transition posts between `Draft` and `Scheduled`.
* **API Boundary Notice:** Direct third-party automated publishing (Meta Graph API / TikTok API) is explicitly scheduled for Phase 2 future work pending platform app authorization.
