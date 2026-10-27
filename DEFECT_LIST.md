# Luma Studio — Defect Register & Resolution Log

**Document ID:** `DEF-LUMA-2026-REGISTER`  
**Execution Date:** October 27, 2026  
**Audience:** QA Lead, Engineering Team, Product Owner  
**Total Tracked Defects:** 5  
**Defects Resolved:** 5 (100% Resolved)  
**Open Defects:** 0  

---

## 1. Defect Summary Table

| Defect ID | Severity | Component | Summary | Status | Resolution Verified |
| :--- | :---: | :--- | :--- | :---: | :---: |
| **DEF-001** | **High** | Booking Validation | Form entries cleared on submission validation failure | **CLOSED** | Verified in TC-BOOK-03 |
| **DEF-002** | **High** | Error Handling | Unformatted backend error display and lack of recovery guidance | **CLOSED** | Verified in TC-BOOK-05 |
| **DEF-003** | **Critical** | Concurrency / Booking | Vulnerability to double booking from accidental rapid repeated clicks | **CLOSED** | Verified in TC-BOOK-06 |
| **DEF-004** | **Medium** | Accessibility & UX | Missing loading indicator during booking hold and checkout submission | **CLOSED** | Verified in TC-BOOK-01 |
| **DEF-005** | **Low** | Social Planner | Misleading mock platform buttons without explicit "planning only" disclaimer | **CLOSED** | Verified in Wireframe Review |

---

## 2. Detailed Defect Reports & Remediation Logs

### DEF-001: Form Entries Cleared on Submission Validation Failure
- **Severity:** High
- **Component:** `public/app.js` (`submitBooking`)
- **Reported By:** QA Engine
- **Preconditions:** Slot held on booking modal step 2.
- **Steps to Reproduce:**
  1. Fill in Name ("Maya Lin") and Phone ("(718) 555-0199").
  2. Enter an invalid email address (e.g. `invalid-email`).
  3. Click "Confirm my visit".
- **Expected Behavior:** Form should highlight email field with error message; previously entered Name and Phone should remain preserved in inputs.
- **Actual Behavior (Before Fix):** Form cleared user entries back to initial empty state, forcing client to retype entire contact profile.
- **Root Cause:** Input event listeners were not updating `clientState` object prior to submission, and validation re-render reset input values.
- **Remediation:** Added `clientState.name = name; clientState.email = email; clientState.phone = phone;` at the very beginning of `submitBooking()` before checking validation, keeping user input preserved in the DOM inputs.
- **Verification:** Tested in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) (Subtest 3); verified inputs remain intact.

---

### DEF-002: Unformatted Backend Error Display and Lack of Recovery Guidance
- **Severity:** High
- **Component:** `public/app.js` / `public/styles.css`
- **Reported By:** QA Engine
- **Preconditions:** Server encounters a temporary network timeout or simulated 500 error.
- **Steps to Reproduce:**
  1. Attempt booking while server is experiencing a 500 Internal Server Error.
  2. Observe error presentation in dialog.
- **Expected Behavior:** The user should see an unmistakable, styled alert card explaining the issue, reassuring them that their chair hold is preserved, and giving actionable recovery steps ("Try again" or call salon).
- **Actual Behavior (Before Fix):** Plain unstyled red text (`.form-error:empty`) rendered at bottom of modal without icon, structure, or retry actionability.
- **Root Cause:** Missing error card styling and failure component in `styles.css`.
- **Remediation:** Designed `.booking-failure-card` with high-visibility icon, distinct error title, detailed server message, and reassuring hint. Added automatic re-enabling of submit button with "Try again".
- **Verification:** Tested in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) (Subtest 5) and captured in [`screenshots/booking_failure_error.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_failure_error.png).

---

### DEF-003: Vulnerability to Double Booking from Accidental Rapid Repeated Clicks
- **Severity:** Critical
- **Component:** `public/app.js` (`submitBooking` and `chooseSlot`)
- **Reported By:** QA Engine
- **Preconditions:** Time slot selected; client form completed.
- **Steps to Reproduce:**
  1. User rapidly double-clicks or triple-clicks "Confirm my visit" within 150ms.
  2. Network latency permits multiple POST requests to `/api/bookings` before button disable event executes.
- **Expected Behavior:** Only the first click should dispatch an HTTP request; subsequent clicks must be completely ignored.
- **Actual Behavior (Before Fix):** Fast double clicks triggered two parallel HTTP requests with the same hold ID, causing a race condition and potential 409 conflict.
- **Root Cause:** Absence of synchronous in-flight boolean guard (`isSubmittingBooking`) at the entry of the event handler.
- **Remediation:**
  1. Introduced global `isSubmittingBooking` lock: immediately returns `if (isSubmittingBooking) return;`.
  2. Added `isHoldingSlot` lock in `chooseSlot` and disabled sibling slot buttons (`.slot-locked`).
  3. Added `button.disabled = true; button.setAttribute("aria-busy", "true"); button.classList.add("is-loading");`.
- **Verification:** Tested in [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) (Subtest 6) with `Promise.all` simultaneous submissions. First call succeeded with 201; second was cleanly rejected with 409. Exactly one appointment created.

---

### DEF-004: Missing Loading Indicator During Booking Submission
- **Severity:** Medium
- **Component:** `public/app.js` / `public/styles.css`
- **Reported By:** UX Audit
- **Preconditions:** Client clicks "Confirm my visit".
- **Steps to Reproduce:**
  1. Click "Confirm my visit" on high latency connection.
  2. Observe submit button appearance.
- **Expected Behavior:** Button should render an active spinning indicator with accessible busy state (`aria-busy="true"`).
- **Actual Behavior (Before Fix):** Button only changed text to plain "Saving your chair…" with no animated spinner or visual feedback.
- **Root Cause:** CSS `.button-spinner` keyframe animation was not defined.
- **Remediation:** Added `@keyframes button-spin` and `.button-spinner` styles with crisp border animation; updated button markup to `<span class="button-spinner" aria-hidden="true"></span> Saving your chair…`.
- **Verification:** Verified visual spinner renders smoothly during in-flight network requests.

---

### DEF-005: Misleading Mock Platform Buttons Without Explicit "Planning Only" Disclaimer
- **Severity:** Low
- **Component:** `public/planner.html` / `public/admin.html`
- **Reported By:** Requirements Audit
- **Preconditions:** User opens Social Planner.
- **Steps to Reproduce:**
  1. Navigate to Social Planner tab.
  2. Review platform selector buttons (Instagram, Facebook, Pinterest, TikTok).
- **Expected Behavior:** UI must explicitly inform users that this is an internal planning wireframe and does NOT publish to live social networks.
- **Actual Behavior (Before Fix):** Platform buttons looked like active OAuth integrations without explanatory microcopy.
- **Root Cause:** Underspecified disclaimer badge in initial prototype draft.
- **Remediation:**
  1. Added prominent amber warning banner at top of viewport: *"⚠️ Wireframe Prototype: Internal Social Content Planner & Post Composer — For editorial schedule and caption layout only. Do not imply real platform publishing."*
  2. Added sub-heading in Composer: *"Mock platform target (Internal planning only; no live API integration)"*.
  3. Formatted status badges as `Draft` and `Scheduled` without "Published" state.
- **Verification:** Verified in [`WIREFRAMES.md`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/WIREFRAMES.md) and screenshot [`screenshots/social_planner_calendar.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/social_planner_calendar.png).
