# Luma Studio — Quality Assurance (QA) Test Checklist

**Document ID:** `QA-LUMA-2026-CHECKLIST`  
**Execution Date:** October 28, 2026  
**Test Suite Status:** 29 Automated Integration Tests Passed (100%), Manual Scenarios Verified  
**Coverage Categories:** Page Loading, Navigation, Required Fields, Mobile Layout, Keyboard Access, Error States, Broken Links, Social Content Planner & Post Composer.  

---

## 1. Page Loading & Critical Rendering (`QA-PAGE`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-PAGE-01** | Initial Document Load & Status | Navigate to `http://localhost:3000/` via desktop browser. | HTTP 200 OK returned; HTML doctype served; `<title>Luma Studio — Hair, with feeling</title>` present. | **PASS** |
| **QA-PAGE-02** | Viewport & Character Encoding | Inspect HTML `<head>` tags in source. | `<meta name="viewport" content="width=device-width, initial-scale=1">` and UTF-8 charset present. | **PASS** |
| **QA-PAGE-03** | Core Security Headers | Inspect HTTP response headers via `curl -I` or DevTools. | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin` returned on HTML & static assets. | **PASS** |
| **QA-PAGE-04** | Static Asset Resolution | Verify loading of `styles.css`, `app.js`, and Google fonts. | All local CSS/JS files return 200 without MIME type mismatch or console errors. | **PASS** |
| **QA-PAGE-05** | Service Worker / Cache Busting | Inspect static file query version strings (`?v=...`). | Browser successfully fetches cache-busted resources without stale style bleeding. | **PASS** |

---

## 2. Navigation & Internal Routing (`QA-NAV`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-NAV-01** | Skip-to-Content Mechanism | Press `Tab` immediately upon loading page. | "Skip to content" button slides down into view; pressing `Enter` moves focus directly to `<main id="main">`. | **PASS** |
| **QA-NAV-02** | Header Anchor Smooth Scrolling | Click navigation links: "Services", "Our people", "The studio", "Contact". | Viewport scrolls smoothly to corresponding section (`#services`, `#team`, `#studio`, `#visit`); URL hash updates. | **PASS** |
| **QA-NAV-03** | Brand Wordmark Return | Scroll down page and click the "luma." logo in header. | Viewport scrolls back to page top (`#home`). | **PASS** |
| **QA-NAV-04** | Mobile Hamburger Menu Toggle | On a viewport < 900px, click the circular menu button. | Navigation drawer expands with slide animation; button `aria-expanded` toggles to `"true"`; clicking a link closes drawer. | **PASS** |
| **QA-NAV-05** | Admin Portal Route | Click "Staff portal" link in footer or visit `/admin`. | Browser routes cleanly to Staff Dashboard (`admin.html`); loads admin CSS/JS. | **PASS** |

---

## 3. Required Fields & Booking Validation (`QA-REQ`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-REQ-01** | Service Selection Prerequisite | Open booking dialog without selecting a service. | Service dropdown displays placeholder; slot computation does not fire until service is chosen. | **PASS** |
| **QA-REQ-02** | Date Selection & Day Filtering | Select Sunday in the date input. | Server and client return empty slots message ("No appointments available on this date"); studio is closed Sundays. | **PASS** |
| **QA-REQ-03** | Slot Selection Hold Creation | Select valid date and click a computed time slot button. | `POST /api/holds` fires; button displays active border state; hold token stored in session state. | **PASS** |
| **QA-REQ-04** | Client Name Field Validation | Leave "Your Name" blank or enter 1 character; click Book. | HTML5 `:invalid` triggered; inline validation message displayed; booking prevented. | **PASS** |
| **QA-REQ-05** | Email Format Validation | Enter `invalid-email` into Email field; attempt submission. | Form enforces RFC 5322 regex; form stops submission. | **PASS** |
| **QA-REQ-06** | Phone Format Validation | Enter invalid phone number; attempt submission. | Field requires valid phone formatting; prevents empty submission. | **PASS** |
| **QA-REQ-07** | Mandatory Policy Acceptance | Fill all fields but leave "I understand the 24-hour cancellation policy" unchecked. | Checkbox highlights with browser validation prompt; form cannot be finalized without checking. | **PASS** |
| **QA-REQ-08** | Balayage Consultation Prerequisite | Select "Dimensional Balayage & Gloss" with unchecked consultation box. | Server rejects booking with 400 Bad Request: "Balayage requires a completed colour consultation". Inline alert advises booking a free consultation first. | **PASS** |
| **QA-REQ-09** | Reject Past Dates | Manually pick or input a date prior to today. | Date input rejects date; displays inline field error: "Past dates cannot be selected"; slot calculation is blocked. | **PASS** |
| **QA-REQ-10** | Field-Level Error Indicators | Submit client form with invalid name, email, or phone. | Each invalid field displays distinct field-level error text below input with red outline and `aria-invalid="true"`. | **PASS** |
| **QA-REQ-11** | Preserve Entries on Failure | Enter valid name and phone, but leave email invalid; click Confirm. | Form validation highlights email error, but pre-filled Name and Phone values remain intact without clearing. | **PASS** |
| **QA-REQ-12** | Mock / Demo Environment Clarity | Complete a valid reservation and inspect confirmation view. | UI renders "Demo Mode · Local Prototype Store" badge and explicitly informs client that appointment is stored locally without claiming external SMS/email dispatch. | **PASS** |

---

## 4. Mobile Layout & Responsive Design (`QA-MOB`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-MOB-01** | Mobile Breakpoint (375px Viewport) | Set browser viewport to 375px width (iPhone standard). | Zero horizontal overflow (`scrollWidth <= 375px`); layout adapts gracefully. | **PASS** |
| **QA-MOB-02** | Mobile Sticky Booking Bar | Scroll through homepage on mobile screen (< 620px). | Floating sticky bar appears at screen bottom with "Good hair starts here" & "Book a visit" button. | **PASS** |
| **QA-MOB-03** | Touch Tap Target Sizing | Inspect buttons, links, and slot items on mobile. | All interactive touch targets are at least 44px by 44px to comply with mobile a11y guidelines. | **PASS** |
| **QA-MOB-04** | Responsive Service Cards | Resize from desktop (1280px) to mobile (375px). | Two-column grid collapses into single-column cards with full-width booking buttons and flexible spacing. | **PASS** |
| **QA-MOB-05** | Responsive Staff Cards | Check team grid on tablet (768px) and mobile (375px). | Grid rearranges neatly into single-column or 2-column cards; images maintain proper 3:4 aspect ratio. | **PASS** |
| **QA-MOB-06** | Dialog Mobile Adaptability | Trigger booking modal on 375px screen width. | Dialog fills screen width with 10px safe margins; dialog is scrollable vertically; close button remains reachable. | **PASS** |

---

## 5. Keyboard Access & Accessibility WCAG 2.1 AA (`QA-KBD`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-KBD-01** | Logical Tab Navigation Order | Press `Tab` repeatedly across entire page. | Focus flows naturally: Skip Link → Top Bar → Wordmark → Menu Toggle → Main Nav → Book CTA → Hero CTAs → Services → Footer. | **PASS** |
| **QA-KBD-02** | High-Contrast Focus Rings | Inspect `:focus-visible` state on buttons and inputs. | High-contrast 2px solid olive outline with 3px offset is clearly visible on every focused element. | **PASS** |
| **QA-KBD-03** | Modal Keyboard Trap & Esc Dismissal | Open booking modal; press `Tab` through form; press `Escape`. | Focus remains constrained within dialog while open; pressing `Escape` dismisses dialog and returns focus to calling trigger. | **PASS** |
| **QA-KBD-04** | Mobile Menu Keyboard Close | Open mobile menu; press `Escape`. | Mobile drawer closes immediately; focus returns cleanly to `menuToggle` button. | **PASS** |
| **QA-KBD-05** | Screen Reader Landmarks & ARIA | Inspect DOM using Accessibility inspector. | `<header role="banner">`, `<main role="main">`, `<footer role="contentinfo">`, `<dialog aria-labelledby="...">` landmarks present. | **PASS** |

---

## 6. Error States & Edge Case Resilience (`QA-ERR`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-ERR-01** | Slot Hold Expiration (5 Minutes) | Hold a slot and wait for hold TTL or submit with invalid hold ID. | API rejects with 400 Bad Request ("Hold expired or not found"); UI prompts user to choose fresh slot. | **PASS** |
| **QA-ERR-02** | Double-Booking Concurrency (Race Condition) | Simultaneously request hold on the same slot from two sessions. | First user receives 200 with hold; second user receives 409 Conflict ("This slot has been held or booked"). | **PASS** |
| **QA-ERR-03** | Path Traversal Protection | Request `GET /../etc/passwd` or `GET /..%2Fserver.js`. | Server sanitizes path and returns 403 Forbidden or 400 Bad Request; zero internal source leakage. | **PASS** |
| **QA-ERR-04** | Admin Endpoint Unauthorized Access | Send `GET /api/admin/bookings` without Authorization header. | API returns HTTP 401 Unauthorized (`{"error": "Unauthorized"}`). | **PASS** |
| **QA-ERR-05** | Admin Invalid Bearer Token | Send `GET /api/admin/bookings` with `Authorization: Bearer wrong-key`. | API returns HTTP 401 Unauthorized; protects client PII. | **PASS** |
| **QA-ERR-06** | Malformed JSON Payload Body | Send `POST /api/bookings` with truncated invalid JSON. | Server returns HTTP 400 Bad Request (`{"error": "Invalid JSON body"}`) without crashing node process. | **PASS** |

---

## 7. Broken Links & External URLs (`QA-LNK`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-LNK-01** | Internal Navigation Anchors | Click every anchor link (`#home`, `#services`, `#team`, `#studio`, `#visit`). | Every anchor target exists in DOM; no dead `#` links. | **PASS** |
| **QA-LNK-02** | Telephone & Email Links | Inspect `href` attributes on phone numbers and email. | Links use valid `tel:+17185550142` and `mailto:hello@lumastudio.example` protocols. | **PASS** |
| **QA-LNK-03** | External Social Media Outbound Links | Inspect Instagram, Facebook, and LinkedIn links. | All external links feature `target="_blank"` and `rel="noreferrer"` for security and performance. | **PASS** |
| **QA-LNK-04** | API Endpoint 404 Safety | Send `GET /api/nonexistent-endpoint`. | Returns clean JSON 404 (`{"error": "API route not found."}`) rather than crashing. | **PASS** |

---

## 8. Social Content Planner & Post Composer (`QA-SOC`)

| ID | Test Scenario | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **QA-SOC-01** | Month Calendar Navigation | In `/planner.html`, click `#btn-prev-month`, `#btn-next-month`, and `#btn-today-month`. | Month title updates (e.g. October 2026, December 2026); grid re-renders with correct start day offset; date cells reflect correct days. | **PASS** |
| **QA-SOC-02** | Create Local Draft & Planned Date/Time | Click "New Post Wireframe" or cell `＋`. Enter caption, pick platform, select planned date & time, click "Save as Draft". | Post saves via `POST /api/posts` with status "Draft"; toast notification confirms save; new draft renders inside calendar day cell with platform tag and clock icon. | **PASS** |
| **QA-SOC-03** | Edit Draft & Transition to Scheduled | Click an existing draft card. Modify caption, adjust planned time, click "Schedule Post". | Post updates via `PATCH /api/posts/:id` with status "Scheduled"; badge reflects green Scheduled state; card updates on calendar and feed. | **PASS** |
| **QA-SOC-04** | Delete Draft Wireframe | Open an existing draft in composer; click "Delete Draft"; confirm prompt. | Post deleted via `DELETE /api/posts/:id`; card removed from calendar; toast confirms removal. | **PASS** |
| **QA-SOC-05** | Live Publishing Disclaimer & Scope Specs | Inspect disclaimer banner and `SCOPE.md` specifications. | UI displays warning: *"Actual publishing requires approved API access, permissions, and scope"*; approved OAuth scopes (Instagram Graph, Pages API, TikTok API, Pinterest API) explicitly documented. | **PASS** |

---

## Summary of Verification Evidence
* **Automated Node Test Suite:** `npm test` passes 12 integration tests (100%).
* **Extended QA Integration Runner:** `node scratch/run_full_qa.js` passes all 29 assertions across 6 suites (100%).
* **Visual Multi-Viewport Evidence:** Screenshots captured and archived in `screenshots/`:
  * Desktop Preview: [`screenshots/desktop_preview_1280.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/desktop_preview_1280.png)
  * Mobile Viewport: [`screenshots/mobile_preview_375.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/mobile_preview_375.png)
  * Booking Validation Errors: [`screenshots/booking_validation_errors.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_validation_errors.png)
  * Booking Failure Error Resilience: [`screenshots/booking_failure_error.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_failure_error.png)
  * Booking Success Confirmation: [`screenshots/booking_confirmation.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/booking_confirmation.png)
  * Social Planner Calendar: [`screenshots/social_planner_calendar.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/social_planner_calendar.png)
  * Social Planner Composer & Mobile Preview: [`screenshots/social_planner_composer.png`](file:///c:/Users/samiaqadir/Desktop/SMJPROJECTS/SALON%20WEBSITE/screenshots/social_planner_composer.png)
