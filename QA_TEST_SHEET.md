# Luma Studio — Quality Assurance (QA) Test Execution Sheet

**Document ID:** `QA-LUMA-2026-EXECUTION-SHEET`  
**Execution Date:** October 27, 2026  
**Audience:** QA Lead, Engineering Pair, Stakeholders  
**Overall Status:** **100% PASS (6/6 Core Scenarios Verified; 12/12 Automated Integration Tests Passed)**  
**Test Suite Reference:** [`test/booking_flow.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/booking_flow.test.js) & [`test/server.test.js`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/test/server.test.js)

---

## 1. Test Scenario Execution Matrix

| Scenario ID | Test Scenario | Test Inputs & Preconditions | Execution Steps | Expected Result | Actual Result | Status | Defect ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **TC-BOOK-01** | **Valid Booking (Happy Path)** | • Service: "Signature cut" ($85)<br>• Stylist: Maya Chen<br>• Date: Tomorrow (weekday)<br>• Time: 11:00 AM<br>• Name: "Samia Qadir"<br>• Email: `samia.qadir@example.com`<br>• Phone: `(718) 555-0199`<br>• Policy: Accepted (`true`) | 1. Open booking dialog.<br>2. Select service, stylist, date.<br>3. Pick available time slot.<br>4. Fill contact form.<br>5. Check cancellation policy.<br>6. Click "Confirm my visit". | • Submit button disables immediately.<br>• Shows animated loading spinner: *"Saving your chair…"* (`aria-busy="true"`).<br>• Confirmation rendered **only after** backend returns 201.<br>• Displays appointment reference `#LUM-...`. | As expected. Loading state was visible; button was locked; booking succeeded with HTTP 201; confirmation view was rendered with appointment ref `#LUM-...`. | **PASS** | None |
| **TC-BOOK-02** | **Missing Service Selection** | • Service: Unselected (`""`)<br>• Date: Today or tomorrow<br>• Stylist: "First available" | 1. Open booking dialog without selecting a service from dropdown.<br>2. Observe slot availability container.<br>3. Attempt to click slot area or advance. | • Dropdown displays placeholder *"Choose a service"*.• Slot list renders helper text: *"Please select a service first to see available appointment slots."*<br>• Clicking slots area focuses service input with `.has-error` and displays inline error `#error-booking-service`.<br>• No slot hold or booking request is generated. | As expected. Slot container prompted user to choose a service first; clicking on slot list focused the service dropdown and displayed inline validation alert; zero network calls. | **PASS** | None |
| **TC-BOOK-03** | **Missing / Invalid Contact Details** | • Valid hold token created<br>• Subtest 3a: Name = `"A"` (too short)<br>• Subtest 3b: Email = `"not-an-email"`<br>• Subtest 3c: Phone = `"123"` (under 7 digits)<br>• Subtest 3d: Policy = `false` (unchecked) | 1. Hold a valid time slot.<br>2. In client form, enter invalid inputs sequentially.<br>3. Click "Confirm my visit". | • Form blocks network submission.<br>• Red field-level outlines applied with `aria-invalid="true"`.<br>• Dedicated inline messages rendered (`#error-client-name`, `#error-client-email`, `#error-client-phone`, `#error-client-policy`).<br>• Focus brought to first invalid input.<br>• Valid inputs are strictly preserved without clearing. | As expected. All 4 validation gates triggered inline error alerts; submission was blocked; user entries were preserved; backend returned 400 when tested via API. | **PASS** | DEF-001 *(Resolved)* |
| **TC-BOOK-04** | **Reject Past Dates** | • Date: Yesterday's date (`YYYY-MM-DD < todayKey`) | 1. Open booking dialog.<br>2. Select a service.<br>3. Change date picker to yesterday's date.<br>4. Observe slot computation and error elements. | • Date input enforces `min` attribute.<br>• Change event detects past date; displays `#error-booking-date`: *"Past dates cannot be selected. Please choose today or a future date."*<br>• Slot list shows: *"Past dates are not available. Please choose an upcoming date."*<br>• Backend returns empty slots `[]` and rejects past holds with 409 Conflict. | As expected. Past date selection was blocked in the UI with inline error message; slot list showed past date notice; server returned empty array `[]` and rejected past hold. | **PASS** | None |
| **TC-BOOK-05** | **Backend Error Resilience** | • Valid hold token active<br>• Server simulation: 500 Internal Server Error (via `x-simulate-error: 500` or test trigger) | 1. Enter valid client details.<br>2. Trigger booking submission while backend simulates 500 gateway timeout.<br>3. Observe UI response, button state, and error message. | • Confirmation screen is **NOT** rendered.<br>• Submit button re-enables and resets text to *"Try again"*.<br>• Prominent error alert card rendered (`.booking-failure-card`) with warning icon and clear explanation: *"Atelier Reservation Gateway Error (500)..."*<br>• Entered client data remains intact.<br>• User can click *"Try again"* after error clears to successfully book. | As expected. Confirmation was withheld; button re-enabled with "Try again"; failure alert card displayed explicit message; user form was not cleared; retry succeeded with 201. | **PASS** | DEF-002 *(Resolved)* |
| **TC-BOOK-06** | **Accidental Repeated Clicks (Concurrency)** | • Valid hold token active<br>• Rapid triple-click on "Confirm my visit" button (< 200ms gap) | 1. Enter valid client details.<br>2. Rapidly double- or triple-click the submit button.<br>3. Also test simultaneous `fetch` requests with same hold token. | • Client-side `isSubmittingBooking` lock immediately intercepts and drops click 2 and click 3.<br>• Submit button is disabled immediately upon first click.<br>• Exactly 1 HTTP POST request is dispatched.<br>• If two requests reach backend simultaneously, exactly one returns 201; second returns 409 Conflict.<br>• Exactly one appointment created in `data/store.json`. | As expected. Client lock prevented duplicate submissions; backend rejected duplicate hold token with 409 Conflict; exactly 1 booking record created without duplicates. | **PASS** | DEF-003 *(Resolved)* |

---

## 2. Automated Test Suite Verification

Both test suites were executed directly against the local node environment:

```powershell
> npm test
```

### Execution Log Output:
```text
TAP version 13
# Subtest: QA Scenario 1: Valid Booking — End-to-end appointment creation with confirmation
ok 1 - QA Scenario 1: Valid Booking — End-to-end appointment creation with confirmation
# Subtest: QA Scenario 2: Missing Service Selection Prerequisite
ok 2 - QA Scenario 2: Missing Service Selection Prerequisite
# Subtest: QA Scenario 3: Missing Contact Information Validation (Name, Email, Phone, Policy)
ok 3 - QA Scenario 3: Missing Contact Information Validation (Name, Email, Phone, Policy)
# Subtest: QA Scenario 4: Reject Past Dates and Past Date Slot Computation
ok 4 - QA Scenario 4: Reject Past Dates and Past Date Slot Computation
# Subtest: QA Scenario 5: Backend Error Resilience and Recovery
ok 5 - QA Scenario 5: Backend Error Resilience and Recovery
# Subtest: QA Scenario 6: Accidental Repeated Click Protection (Double Submission)
ok 6 - QA Scenario 6: Accidental Repeated Click Protection (Double Submission)
# Subtest: QA Social Planner: Posts Endpoint & Status Pipeline (Draft / Scheduled)
ok 7 - QA Social Planner: Posts Endpoint & Status Pipeline (Draft / Scheduled)
# Subtest: public website and salon catalog are served
ok 8 - public website and salon catalog are served
# Subtest: a slot can only be held once and bookings require policy acceptance
ok 9 - a slot can only be held once and bookings require policy acceptance
# Subtest: appointments block matching stylist slots and admin status changes require authentication
ok 10 - appointments block matching stylist slots and admin status changes require authentication
# Subtest: expired, invalid, and unsupported booking inputs fail explicitly
ok 11 - expired, invalid, and unsupported booking inputs fail explicitly
# Subtest: balayage requires a completed colour consultation before booking
ok 12 - balayage requires a completed colour consultation before booking
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# duration_ms 394.4769
```

---

## 3. Visual Multi-State Evidence

| Evidence Item | Screenshot Path | Description |
| :--- | :--- | :--- |
| **Booking Success Confirmation** | [`screenshots/booking_confirmation.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_confirmation.png) | Confirmation modal with reference `#LUM-...`, demo disclaimer, and service details. |
| **Booking Failure Error Banner** | [`screenshots/booking_failure_error.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_failure_error.png) | High-visibility failure alert (`.booking-failure-card`) with preserved form entries. |
| **Validation Error Highlighting** | [`screenshots/booking_validation_errors.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_validation_errors.png) | Red outline on invalid inputs with dedicated inline error messages. |
| **Social Planner Calendar** | [`screenshots/social_planner_calendar.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/social_planner_calendar.png) | Month calendar wireframe with Draft & Scheduled badges and disclaimer banner. |
| **Social Planner Post Composer** | [`screenshots/social_planner_composer.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/social_planner_composer.png) | Post composer wireframe with caption, platform selector, planned time, and live phone preview. |
