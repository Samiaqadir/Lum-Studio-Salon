# Luma Studio — Defect Register & Resolution Log

**Document ID:** `DEF-LUMA-2026-REGISTER`  
**Execution Date:** October 28, 2026  
**Audience:** QA Lead, Engineering Team, Product Owner  
**Owner:** Samia Qadir (Integration & QA Lead)  
**Total Tracked Defects:** 7  
**Defects Resolved / Closed:** 7 (100% Resolved & Verified)  
**Open Defects:** 0  

---

## 1. Defect Classification Scheme

In accordance with QA standards, all defects are triaged and prioritized under four distinct severity tiers:

* **Critical (Core flow / security blocked):** Severe defect blocking the fundamental user journey (e.g., booking an appointment, race condition leading to double-booking, or leaking sensitive client PII in an unsecured mock).
* **High (Major function broken):** Major functional defect where an expected feature fails to operate, validation clears client input, or authorization prevents saving drafts, requiring user re-entry or causing workflow failure.
* **Medium (Workaround exists):** Feature functions, but user experience, accessibility, or visual feedback is compromised (e.g., missing loading spinners, lack of aria busy states).
* **Low (Cosmetic):** Minor visual, typography, or label ambiguity that does not hinder core functional execution (e.g., missing planning wireframe disclaimers).

---

## 2. Defect Summary Matrix

| Defect ID | Severity Tier | Classification | Component | Summary | Status | Resolution Verified |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: |
| **DEF-001** | **High** | Major function broken | `public/app.js` (`submitBooking`) | Form entries cleared on submission validation failure | **CLOSED** | Verified in TC-BOOK-03 |
| **DEF-002** | **High** | Major function broken | `public/app.js` / `public/styles.css` | Unformatted backend error display and lack of recovery guidance | **CLOSED** | Verified in TC-BOOK-05 |
| **DEF-003** | **Critical** | Core flow / security blocked | `public/app.js` (`submitBooking`) | Vulnerability to double booking from accidental rapid repeated clicks | **CLOSED** | Verified in TC-BOOK-06 |
| **DEF-004** | **Medium** | Workaround exists | `public/app.js` / `public/styles.css` | Missing loading indicator during booking hold and checkout submission | **CLOSED** | Verified in TC-BOOK-01 |
| **DEF-005** | **Low** | Cosmetic | `public/planner.html` / `SCOPE.md` | Misleading mock platform buttons without explicit "planning only" disclaimer | **CLOSED** | Verified in Wireframe Review |
| **DEF-006** | **High** | Major function broken | `public/planner.html` (`savePost`) | Social Planner composer dispatched draft saves to `/api/admin/posts` without credentials, failing with 401 | **CLOSED** | Verified in Planner Post Suite |
| **DEF-007** | **Critical** | Core flow / security blocked | Architecture / `server.js` | Unsecured mock risks exposing real customer PII in development databases | **CLOSED** | Verified in `API_CONTRACT.md` |

---

## 3. Detailed Defect Reports & Remediation Logs

### DEF-001: Form Entries Cleared on Submission Validation Failure
* **Defect ID:** `DEF-001`
* **Severity:** **High (Major function broken)**
* **Component:** `public/app.js` (`submitBooking`)
* **Environment:** Node.js 20+, Chrome / Safari / Edge (Desktop & Mobile)
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** Slot held on booking modal Step 2.
* **Steps to Reproduce:**
  1. Fill in Name ("Maya Lin") and Phone ("(718) 555-0199").
  2. Enter an invalid email address (e.g. `invalid-email`).
  3. Click "Confirm my visit".
* **Expected Result:** Form should highlight email field with error message; previously entered Name and Phone must remain strictly preserved in inputs.
* **Actual Result (Before Fix):** Form cleared user entries back to initial empty state, forcing client to retype entire contact profile.
* **Root Cause:** Input event listeners were not updating `clientState` object prior to submission, and validation re-render reset input values.
* **Remediation:** Added `clientState.name = name; clientState.email = email; clientState.phone = phone;` at the very beginning of `submitBooking()` before checking validation, keeping user input preserved in the DOM inputs.
* **Evidence:** Tested in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) (Subtest 3) and captured in [`screenshots/booking_validation_errors.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_validation_errors.png).

---

### DEF-002: Unformatted Backend Error Display and Lack of Recovery Guidance
* **Defect ID:** `DEF-002`
* **Severity:** **High (Major function broken)**
* **Component:** `public/app.js` / `public/styles.css`
* **Environment:** Node.js 20+, Web Standards Browser
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** Server encounters a temporary network timeout or simulated 500 error.
* **Steps to Reproduce:**
  1. Attempt booking while server simulates a 500 Internal Server Error (via `x-simulate-error: 500`).
  2. Observe error presentation in dialog.
* **Expected Result:** The user should see an unmistakable, styled alert card explaining the issue, reassuring them that their chair hold is preserved, and giving actionable recovery steps ("Try again" or call salon).
* **Actual Result (Before Fix):** Plain unstyled red text (`.form-error:empty`) rendered at bottom of modal without icon, structure, or retry actionability.
* **Root Cause:** Missing error card styling and failure component in `styles.css`.
* **Remediation:** Designed `.booking-failure-card` with high-visibility icon, distinct error title, detailed server message, and reassuring hint. Added automatic re-enabling of submit button with "Try again".
* **Evidence:** Tested in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) (Subtest 5) and captured in [`screenshots/booking_failure_error.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_failure_error.png).

---

### DEF-003: Vulnerability to Double Booking from Accidental Rapid Repeated Clicks
* **Defect ID:** `DEF-003`
* **Severity:** **Critical (Core flow / security blocked)**
* **Component:** `public/app.js` (`submitBooking` and `chooseSlot`)
* **Environment:** Node.js 20+, Chrome / Safari / Edge
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** Time slot selected; client form completed.
* **Steps to Reproduce:**
  1. User rapidly double-clicks or triple-clicks "Confirm my visit" within 150ms.
  2. Network latency permits multiple POST requests to `/api/bookings` before button disable event executes.
* **Expected Result:** Only the first click should dispatch an HTTP request; subsequent clicks must be completely ignored.
* **Actual Result (Before Fix):** Fast double clicks triggered two parallel HTTP requests with the same hold ID, causing a race condition and potential 409 conflict or double reservation.
* **Root Cause:** Absence of synchronous in-flight boolean guard (`isSubmittingBooking`) at the entry of the event handler.
* **Remediation:**
  1. Introduced global `isSubmittingBooking` lock: immediately returns `if (isSubmittingBooking) return;`.
  2. Added `isHoldingSlot` lock in `chooseSlot` and disabled sibling slot buttons (`.slot-locked`).
  3. Added `button.disabled = true; button.setAttribute("aria-busy", "true"); button.classList.add("is-loading");`.
* **Evidence:** Tested in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) (Subtest 6) with `Promise.all` simultaneous submissions. Exactly one appointment was created; second request returned 409 Conflict.

---

### DEF-004: Missing Loading Indicator During Booking Submission
* **Defect ID:** `DEF-004`
* **Severity:** **Medium (Workaround exists)**
* **Component:** `public/app.js` / `public/styles.css`
* **Environment:** Node.js 20+, Mobile & Desktop Viewports
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** Client clicks "Confirm my visit".
* **Steps to Reproduce:**
  1. Click "Confirm my visit" on high latency connection.
  2. Observe submit button appearance.
* **Expected Result:** Button should render an active spinning indicator with accessible busy state (`aria-busy="true"`).
* **Actual Result (Before Fix):** Button only changed text to plain "Saving your chair…" with no animated spinner or visual feedback.
* **Root Cause:** CSS `.button-spinner` keyframe animation was not defined.
* **Remediation:** Added `@keyframes button-spin` and `.button-spinner` styles with crisp border animation; updated button markup to `<span class="button-spinner" aria-hidden="true"></span> Saving your chair…`.
* **Evidence:** Verified in browser rendering and [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js).

---

### DEF-005: Misleading Mock Platform Buttons Without Explicit "Planning Only" Disclaimer
* **Defect ID:** `DEF-005`
* **Severity:** **Low (Cosmetic)**
* **Component:** `public/planner.html` / `public/admin.html`
* **Environment:** Node.js 20+, Cross-Browser
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** User opens Social Content Planner.
* **Steps to Reproduce:**
  1. Navigate to Social Planner tab.
  2. Review platform selector buttons (Instagram, Facebook, Pinterest, TikTok).
* **Expected Result:** UI must explicitly inform users that this is an internal planning wireframe and does NOT publish to live social networks.
* **Actual Result (Before Fix):** Platform buttons looked like active OAuth integrations without explanatory microcopy.
* **Root Cause:** Underspecified disclaimer badge in initial prototype draft.
* **Remediation:**
  1. Added prominent amber warning banner at top of viewport: *"⚠️ Wireframe Prototype: Internal Social Content Planner & Post Composer — For editorial schedule and caption layout only. Actual publishing requires approved API access, permissions, and scope."*
  2. Added sub-heading in Composer: *"Mock platform target (Internal planning only; no live API integration)"*.
  3. Documented approved OAuth scopes for Instagram, Facebook, Pinterest, and TikTok in `SCOPE.md` and `API_CONTRACT.md`.
* **Evidence:** Verified in [`WIREFRAMES.md`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/WIREFRAMES.md) and screenshot [`screenshots/social_planner_calendar.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/social_planner_calendar.png).

---

### DEF-006: Social Planner Composer Endpoint Authorization Mismatch on Saving Draft
* **Defect ID:** `DEF-006`
* **Severity:** **High (Major function broken)**
* **Component:** `public/planner.html` (`savePost`)
* **Environment:** Node.js 20+, Chrome / Firefox / Safari (Planner Wireframe)
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** User opens Social Planner (`/planner.html`) and clicks "New Post Wireframe" or selects a date to create/edit a draft.
* **Steps to Reproduce:**
  1. Navigate to `/planner.html` without prior login to staff admin portal.
  2. Click "New Post Wireframe" or click a date cell `＋`.
  3. Enter caption, select platform, date, and click "Save as Draft" or "Schedule Post".
* **Expected Result:** Draft wireframe should save successfully to `/api/posts`, display confirmation toast, close composer, and render on calendar.
* **Actual Result (Before Fix):** Frontend dispatched requests to `/api/admin/posts`. The server returned HTTP 401 Unauthorized, prompting error toast "Error saving post: Could not save post."
* **Root Cause:** `savePost` in `planner.html` targeted `/api/admin/posts` (which requires admin Bearer token) instead of the public wireframe endpoints `/api/posts` and `/api/posts/:id` implemented in `server.js`.
* **Remediation:** Updated `savePost` in `public/planner.html` to target `/api/posts` and `/api/posts/:id`, while attaching `Authorization: Bearer <token>` dynamically if present in session. Added "Delete Draft" button to allow removing unwanted drafts.
* **Evidence:** Verified by executing node integration script and automated test suite (`npm test`).

---

### DEF-007: Storing Real Customer Data in Unsecured Mock Environments
* **Defect ID:** `DEF-007`
* **Severity:** **Critical (Core flow / security blocked)**
* **Component:** `server.js` / `public/app.js` / Documentation
* **Environment:** Development & Staging Environments
* **Owner:** Samia Qadir (Integration & QA Lead)
* **Preconditions:** Developer runs mock server locally or in demonstration mode.
* **Steps to Reproduce:**
  1. Submit a booking through demonstration mode.
  2. Inspect storage persistence and client confirmation messages.
* **Expected Result:** The application and documentation must strictly prohibit storing real customer PII (credit cards, real phone/email) in unsecured local mocks; confirmation must alert users that the environment is a local prototype store; local store files must have restricted permissions.
* **Actual Result (Before Fix):** No explicit mock data privacy contract existed; local storage lacked strict file permission constraints; missing guidance on synthetic test data usage.
* **Root Cause:** Missing data privacy policy and mock security contract for offline/demonstration testing.
* **Remediation:**
  1. Enforced POSIX file permissions `0o600` on `data/store.json` writes.
  2. Displayed prominent "Demo Mode · Local Prototype Store" badge and disclaimer on booking confirmation.
  3. Formulated official Data Privacy & Unsecured Mock Security Policy in [`API_CONTRACT.md`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/API_CONTRACT.md).
  4. Restricted automated test data to reserved synthetic domains (`@example.com` and `(718) 555-01XX`).
* **Evidence:** Documented in [`API_CONTRACT.md`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/API_CONTRACT.md) and verified in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js).
