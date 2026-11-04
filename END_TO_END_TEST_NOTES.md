# Luma Hair Studio — End-to-End QA Test Notes
**Tester:** Samia | AI Website Testing Assistant  
**Role Scope:** AI Website Testing Assistant  
**Target Environment:** `http://localhost:3000` (Node.js Vanilla Runtime)  
**Date:** November 4, 2026  
**Status:** **PASSED / ACCEPTED**  

---

## 1. Executive Summary & Acceptance Check Outcome

* **End-of-Day Acceptance Check:** A tester can run cases, review failures, attach screenshot evidence, filter defects by severity/status, and produce a one-page QA summary export.
* **Test Scope:** 10 core regression test scenarios covering navigation, forms, required fields, links, responsive layout, and basic accessibility.
* **Execution Pass Rate:** **10/10 Passed (100%)**
* **Active Defects:** 1 Low severity backlog item (`DEF-006`); 4 resolved defects (`DEF-001` through `DEF-004`); 1 architectural Phase 2 item (`DEF-005`).
* **Recommendation:** **PROCEED TO MVP STAGING / PROTOTYPE DEMO**.

---

## 2. End-to-End User Journey Walkthrough

### Step 1: Starting the Test Run & Initial Dashboard State
1. Tester navigates to `http://localhost:3000/qa-runner.html`.
2. Concise Metric Dashboard loads with:
   * **Total Test Scope:** `10`
   * **Passed:** `0`
   * **Failed:** `0`
   * **Not Run:** `10` (10 pending execution)
   * **Execution Progress:** `0% Completed (0/10)`
3. Tester observes clean baseline with zero false positives.

### Step 2: Automated Browser Suite Execution
1. Tester clicks **"Run All 10 Live Tests"** on the Live Integration Runner tab.
2. The asynchronous test harness dispatches 10 live HTTP assertions against `http://localhost:3000`:
   * `LIVE-01`: Root HTML, security headers (`nosniff`, `Content-Type: text/html; charset=utf-8`).
   * `LIVE-02`: Public salon metadata API (`GET /api/salon`).
   * `LIVE-03`: Categorized service catalog with Balayage consultation flag (`GET /api/services`).
   * `LIVE-04`: Stylist roster (`GET /api/stylists`).
   * `LIVE-05`: Dynamic availability computation (`GET /api/availability`).
   * `LIVE-06`: 5-minute exclusive hold lock & HTTP 409 Conflict rejection (`POST /api/holds`).
   * `LIVE-07`: Booking form validation guard & policy enforcement (`POST /api/bookings`).
   * `LIVE-08`: Balayage consultation safety gate.
   * `LIVE-09`: Protected staff endpoint authentication security (`GET /api/admin/bookings` -> 401).
   * `LIVE-10`: Social content planner editorial posts API (`GET /api/posts`).
3. Results stream into view in **< 120ms total**. All 10 live checks output `PASS`.
4. The dashboard automatically syncs:
   * **Total Test Scope:** `10`
   * **Passed:** `10`
   * **Failed:** `0`
   * **Not Run:** `0`
   * **Pass Rate:** `100% pass rate (10/10)`
   * **Progress Bar:** `100% Completed (10/10)`
5. Tester clicks **"Save Results to File"**; results are persisted to `test_results.json` via `POST /api/qa/results`.

### Step 3: Guided Manual QA Checklist & Interactive Toggling
1. Tester switches to the **"Guided Manual QA Checklist"** tab.
2. 10 comprehensive scenario cards are displayed with preconditions, execution steps, expected outcomes, and editable tester notes.
3. Tester tests filtering options:
   * **Filter by Status:** Selects `Passed`, `Failed`, `Blocked`, or `Not Run`. Cards filter instantly.
   * **Filter by Category:** Selects `Forms`, `Navigation`, `Links`, `Responsive Layout`, or `Basic Accessibility`.
   * **Search Input:** Types `balayage` or `focus ring`; list filters in real time.
4. Tester tests status toggling: clicking `✓ Pass`, `✕ Fail`, `⚠ Blocked`, or `○ Not Run` immediately updates card styling, status pill, and recalculates the top dashboard tally in real time.
5. Tester tests **"Reset Run"** button: instantly resets all 10 cases to `not_run` with 0% progress, proving repeatable test cycles.

### Step 4: Defect Review, Evidence Attachment & Triage
1. Tester switches to the **"Defect Logger & Schema"** tab.
2. Tester reviews the **Known Issues Register**:
   * Uses **Filter by Severity:** (`All`, `Critical`, `High`, `Medium`, `Low`).
   * Uses **Filter by Status:** (`All`, `Active / Open`, `Resolved / Closed`).
   * Real-time search filters by defect ID, title, or component URL.
3. Reviewing `DEF-001` (High): Input preservation during form validation. Clickable thumbnail preview for `screenshots/booking_validation_errors.png` is displayed and opens full screenshot on tap.
4. Reviewing `DEF-002` (High): 500 error display. Thumbnail for `screenshots/booking_failure_error.png` displayed.
5. Reviewing `DEF-006` (Low): Admin login validation. User-provided evidence screenshot `screenshots/admin_login_validation.png` is linked, showing native HTML5 tooltip.
6. Tester tests **Evidence Attachment**:
   * Drops/selects a local screenshot file via the file upload dropzone. `FileReader` loads thumbnail preview instantly with file size in KB.
   * Tests typing a manual repository path into the manual evidence field. Preview updates dynamically.
   * Clicks **"Remove Attachment"**; attachment state clears cleanly.
   * Clicks **"Log & Save Defect"**; saves defect payload to `known-issues.json` via `POST /api/qa/defects` with toast confirmation.

### Step 5: Exporting the QA Summary
1. Tester tests export options:
   * **Export One-Page HTML Summary:** Clicks button -> Generates and downloads `qa-summary-report.html` (standalone executive report containing styling, scorecards, matrix table, defect register, and sign-off).
   * **Export CSV:** Clicks button -> Downloads `luma_salon_qa_results.csv` with structured test case and defect records.
   * **Export Markdown:** Clicks button -> Copies markdown report to clipboard and downloads `QA_SUMMARY_REPORT.md`.

---

## 3. Defect Log & Triage Summary

| Defect ID | Severity | Page / Component | Defect Summary | Status | Evidence Attachment |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **DEF-001** | High | Booking Modal (Step 2) | Client Name & Phone wiped on email validation error | **Resolved / Closed** | `screenshots/booking_validation_errors.png` |
| **DEF-002** | High | Booking Modal (Step 2) | Unstyled red 500 server error text without retry | **Resolved / Closed** | `screenshots/booking_failure_error.png` |
| **DEF-003** | Critical | Booking Modal Submit | Rapid double-click (<150ms) created race condition | **Resolved / Closed** | `test/booking_flow.test.js Subtest 6` |
| **DEF-004** | Medium | Booking Modal Submit | Missing animated spinner during slow network hold | **Resolved / Closed** | `public/styles.css .button-spinner` |
| **DEF-005** | Medium | Backend Architecture | Distributed locks needed for multi-instance clusters | **Phase 2 Backlog** | `API_CONTRACT.md & SCOPE.md` |
| **DEF-006** | Low | Staff Login (`admin.html`) | Empty key submission relies solely on browser tooltip | **Active / Open** | `screenshots/admin_login_validation.png` |

---

## 4. Retest & Verification Records

1. **DEF-001 Retest:**
   * Entered Name `"Maya Lin"`, Phone `"(718) 555-0199"`, invalid Email `"not-an-email"`.
   * Clicked "Confirm my visit".
   * **Result:** Form stopped submission. Red outline and `aria-invalid="true"` appeared on email field. Name and Phone were **strictly retained** in the form inputs. **PASS**.
2. **DEF-002 Retest:**
   * Simulated HTTP 500 response using test header.
   * **Result:** Styled `.booking-failure-card` rendered with warning icon, message that the 5-minute hold was still active, and a working "Try again" button. **PASS**.
3. **DEF-003 & DEF-004 Retest:**
   * Throttled connection to Slow 3G; rapid double-click on submit button.
   * **Result:** Synchronous `isSubmittingBooking = true` flag dropped second click immediately. Button transitioned to animated spinning ring (`.button-spinner`) and `aria-busy="true"`. Exactly 1 appointment was booked. **PASS**.

---

## 5. Artifacts & Deliverables Created
* `public/qa-runner.html` — Interactive QA runner with concise dashboard, evidence upload, severity/status filters, and one-page HTML/CSV/Markdown exports.
* `QA_SUMMARY_EXPORT.html` & `public/qa-summary-report.html` — Standalone executive one-page summary report with embedded metrics and evidence gallery.
* `known-issues.json` — Structured defect register with 6 tracked issues.
* `test_results.json` & `TEST_RESULTS.md` — Machine and human readable test outputs.
* `screenshots/admin_login_validation.png` — Real screenshot evidence of staff login form validation.
* `END_TO_END_TEST_NOTES.md` — This end-to-end user journey and triage log.
