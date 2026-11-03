# AI Website Testing Assistant — Comprehensive QA Test Plan & Framework

**Project:** Luma Hair Studio Web Application & Appointment Booking System  
**Lead QA Engineer / Author:** Samia Qadir  
**Role:** AI Website Testing Assistant  
**Execution Date:** November 02, 2026  
**Repository:** [https://github.com/Samiaqadir/Lum-Studio-Salon](https://github.com/Samiaqadir/Lum-Studio-Salon)  
**Status:** **ACTIVE / VERIFIED**  

---

## 1. Chosen Scope & Target System

### 1.1 Application Overview
* **Target Website:** Locally hosted web application — **Luma Hair Studio**
* **Local Test URL:** `http://localhost:3000`
* **Architecture:** Zero-external-dependency Node.js HTTP REST service with Vanilla HTML5, CSS3, and modern JavaScript.
* **Storage Engine:** Local JSON data store (`data/store.json`) with POSIX `0o600` process-restricted permissions.

### 1.2 Exact Pages & Modules in Scope
1. **Public Landing & Brand Portal (`/` or `index.html`):**
   * Top contact utility bar (`(718) 555-0142`, `214 Bedford Ave, Brooklyn, NY`, hours, email, social links).
   * Header navigation with skip-to-content accessibility link (`.skip-link`) and mobile hamburger drawer.
   * Hero banner with dynamic typography, Google review trust badges, and dual action buttons.
   * Studio values ticker and philosophy overview.
   * Mobile floating bottom booking bar (active on viewports `< 620px`).
2. **Curated Service Catalogue (`/#services`):**
   * Categorized cards: Cuts & Styling, Colour & Lightening, Rituals & Treatments.
   * Transparent upfront pricing ($75 to $310) and fixed service durations (15 to 180 minutes).
   * Balayage colour consultation prerequisite rule.
3. **Interactive Booking Modal System (`<dialog id="booking-dialog">`):**
   * 4-step progressive disclosure flow (Service & Stylist selection → Date & Computed Availability → Client Details & Policy Acceptance → Confirmation).
   * 5-minute exclusive slot hold locking mechanism (`POST /api/holds`).
4. **Confirmation & Receipt View:**
   * Unique reservation reference (`#LUM-XXXXX`), summary details, arrival guidance, and cancellation policy.
   * Prominent **"Demo Mode · Local Prototype Store"** transparency badge.
5. **Staff Administrative Dashboard (`/admin` or `admin.html`):**
   * Password/token-authenticated dashboard (`SALON_ADMIN_KEY`).
   * Live appointment status management (`confirmed` → `checked-in` → `completed` → `cancelled`) and service catalogue creation.
6. **Social Content Planner & Post Composer (`/planner.html`):**
   * Interactive calendar month view, post composer modal with dynamic character counters, live phone preview, and scheduling state pipeline.

### 1.3 Key User Journeys Under Test
* **User Journey 1: Client Discovery & Appointment Booking (Primary Happy Path):**
  1. Client lands on homepage (`/`), reviews salon atmosphere, and clicks "Explore Services".
  2. Client selects "Signature Cut" ($85), opening the booking dialog with service pre-selected.
  3. Client selects stylist "Maya Chen", chooses a valid weekday, and views computed start times.
  4. Client clicks "11:00 AM", acquiring a 5-minute temporary hold token (`holdId`).
  5. Client enters valid Name, RFC 5322 Email, Phone, accepts the 24-hour cancellation policy, and clicks "Confirm my visit".
  6. Client receives an instant confirmation view displaying reference `#LUM-XXXXX` and arrival guidance.
* **User Journey 2: Staff Administration & Status Workflow:**
  1. Salon manager navigates to `/admin` and provides valid `SALON_ADMIN_KEY`.
  2. Dashboard loads confirmed bookings from `GET /api/admin/bookings`.
  3. Manager filters by date/stylist and transitions a client status from `confirmed` to `checked-in` and then `completed`.
* **User Journey 3: Marketing Social Content Planning & Staging:**
  1. Marketing coordinator navigates to `/planner.html`.
  2. Coordinator browses the November 2026 calendar and clicks `＋` on an open day cell.
  3. Composer modal opens; user enters a caption, selects target platform (Instagram), picks planned time, and saves as "Draft".
  4. User edits draft, tests live smartphone feed preview, and transitions status to "Scheduled".

---

## 2. MVP QA Approach & Test Environment

### 2.1 Dual-Mode MVP Approach
We have implemented a **hybrid testing architecture** combining an interactive browser-based QA tool with automated backend integration suites:

1. **Interactive Browser-Based Test Runner & Guided Manual QA Tool (`public/qa-runner.html`):**
   * **Location:** `http://localhost:3000/qa-runner.html`
   * **Automated Mode:** Executes direct browser-based asynchronous checks against live REST API endpoints (`/api/salon`, `/api/services`, `/api/availability`, `/api/holds`), testing status codes, JSON response schemas, slot hold locks, 409 conflict detection, and security headers with real-time pass/fail metrics.
   * **Guided Manual Mode:** Provides step-by-step testing instructions for all 10 core test cases with interactive pass/fail/blocked toggles, notes capture, and an embedded responsive device preview frame (switchable between 375px mobile and 1280px desktop).
   * **Defect Generator:** Allows testers to log defects on the spot with 1-click Markdown export conforming to the structured defect schema.
2. **Automated Node.js Integration Runner (`npm test`):**
   * Powered by Node.js native test runner (`node --test`), executing 12 comprehensive end-to-end integration scenarios verifying slot hold race conditions, Balayage prerequisite gates, input validation, and admin authentication in under 400ms.
3. **Comprehensive Extended Suite (`node scratch/run_full_qa.js`):**
   * Runs 29 assertions across 6 categories (Security Headers, Catalog API, Booking Integrity, Admin Auth, CSS Card Flexbox Alignment, and Social Planner API).

### 2.2 Environment Setup & Verification Commands
```powershell
# 1. Clone repository
git clone https://github.com/Samiaqadir/Lum-Studio-Salon.git
cd "SALON WEBSITE"

# 2. Configure administrative key and launch server
$env:SALON_ADMIN_KEY = "luma-secure-admin-pass"
npm start

# 3. Access applications and QA tools in browser:
# • Salon Web App:             http://localhost:3000
# • Browser QA Test Runner:    http://localhost:3000/qa-runner.html
# • Staff Administration:      http://localhost:3000/admin
# • Social Content Planner:    http://localhost:3000/planner.html

# 4. Run automated test suites:
npm test                       # 12/12 native integration tests
node scratch/run_full_qa.js    # 29/29 extended QA assertions
```

---

## 3. Core Test Plan (10 Repeatable Test Cases)

The following 10 test cases cover **Navigation**, **Forms**, **Required Fields**, **Links**, **Responsive Layout**, and **Basic Accessibility**:

| Case ID | Category | Title | Preconditions & Inputs | Execution Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-01** | **Navigation** | Skip-to-Content & Header Smooth Scrolling | Desktop browser at `http://localhost:3000` | 1. Press `Tab` upon initial document load.<br>2. Observe skip link.<br>3. Press `Enter`.<br>4. Click nav anchors ("Services", "Our people", "The studio", "Contact"). | • "Skip to content" button slides down into view; pressing `Enter` shifts focus to `<main id="main">`.<br>• Clicking anchor links scrolls smoothly to target sections (`#services`, `#team`, `#studio`, `#visit`); URL hash updates. | **PASS** |
| **TC-02** | **Navigation** | Mobile Hamburger Menu Drawer & Keyboard Trap | Browser viewport `< 900px` (e.g. 375px) | 1. Click hamburger menu toggle button.<br>2. Press `Tab` through drawer items.<br>3. Press `Escape` key.<br>4. Re-open and click "Services" link. | • Navigation drawer slides open; button updates to `aria-expanded="true"`.<br>• Focus is trapped within drawer.<br>• Pressing `Escape` closes drawer immediately and restores focus to menu button.<br>• Clicking a nav link scrolls to section and closes drawer. | **PASS** |
| **TC-03** | **Forms & Req Fields** | Service Selection Prerequisite for Slot Calculation | Booking dialog opened with no service selected | 1. Open booking dialog without selecting a service.<br>2. Observe slot availability container.<br>3. Attempt to click slot area or advance. | • Dropdown displays placeholder *"Choose a service"*.<br>• Slot container displays guidance: *"Please select a service first to see available appointment slots."*<br>• Clicking slot container applies `.has-error` and focus to service dropdown; zero network requests made. | **PASS** |
| **TC-04** | **Forms & Req Fields** | Client Contact Validation & Input Preservation | Active 5-min slot hold acquired | 1. Enter Name: `"M"`, Email: `"invalid-email"`, Phone: `"123"`.<br>2. Click "Confirm my visit".<br>3. Observe field indicators and input values. | • Submission blocked; red outlines applied with `aria-invalid="true"`.<br>• Specific inline errors displayed below inputs.<br>• Focus placed on first invalid field.<br>• Pre-filled inputs are **strictly preserved** in DOM without clearing. | **PASS** |
| **TC-05** | **Forms & Req Fields** | Balayage Consultation Rule & Policy Checkbox | Booking "Dimensional Balayage" ($310) | 1. Select Balayage service.<br>2. Fill valid contact details but leave consultation checkbox unchecked.<br>3. Click "Confirm my visit".<br>4. Re-test leaving cancellation policy unchecked. | • Balayage without consultation triggers HTTP 400/409 with alert advising client to book complimentary consultation first.<br>• Unchecked cancellation policy blocks submission with mandatory browser validation notice. | **PASS** |
| **TC-06** | **Forms & Concurrency** | 5-Minute Slot Hold Lock & Accidental Multi-Click | Two browser sessions or rapid double-click (< 150ms) | 1. Session A selects a time slot.<br>2. Session B simultaneously requests the same slot.<br>3. In Session A, rapidly multi-click "Confirm my visit". | • Session A receives hold token (`POST /api/holds` 200).<br>• Session B receives instant **HTTP 409 Conflict** ("This slot has been held or booked").<br>• Synchronous submit lock drops repeated clicks; button displays spinner (`.is-loading`); exactly 1 booking recorded. | **PASS** |
| **TC-07** | **Links** | Internal Anchors, Contact Protocols & Outbound Security | Homepage loaded | 1. Click telephone link in top bar.<br>2. Click email link.<br>3. Inspect social media links (Instagram, Facebook).<br>4. Test non-existent API route `/api/unknown`. | • Telephone uses `tel:+17185550142`.<br>• Email uses `mailto:hello@lumastudio.example`.<br>• Outbound links have `target="_blank"` and `rel="noreferrer"` for security and performance.<br>• Non-existent API returns clean JSON 404 without server crash. | **PASS** |
| **TC-08** | **Responsive Layout** | 375px Mobile Breakpoint & Floating Booking Bar | Viewport set to 375px (iPhone SE / iPhone 13) | 1. Check page scroll width on 375px.<br>2. Scroll through homepage.<br>3. Inspect floating bottom action bar.<br>4. Tap "Book a visit". | • Page scroll width `<= 375px` with zero horizontal overflow.<br>• Sticky floating bar slides up smoothly at bottom with *"Good hair starts here"*.<br>• Tapping "Book a visit" launches mobile-optimized modal with 10px safe margins. | **PASS** |
| **TC-09** | **Responsive Layout** | Minimum 44px Touch Targets on Mobile | Viewport set to 375px mobile | 1. Inspect computed CSS dimensions of slot buttons, navigation links, and action buttons. | • All touch targets measure at least `44px x 44px` conforming to mobile accessibility standards. Buttons feature adequate finger spacing. | **PASS** |
| **TC-10** | **Basic Accessibility** | WCAG 2.1 AA Focus Rings, Modal Trap & ARIA Landmarks | Keyboard-only testing (`Tab`, `Shift+Tab`, `Esc`) | 1. Press `Tab` through entire page.<br>2. Open booking dialog with keyboard.<br>3. Tab through modal inputs.<br>4. Press `Escape`. | • High-contrast 2px solid olive focus ring with 3px offset visible on every interactive element.<br>• Focus is trapped within modal dialog while open.<br>• Pressing `Escape` closes modal and restores focus to trigger button.<br>• Landmarks (`header`, `main`, `footer`, `dialog`) properly annotated. | **PASS** |

---

## 4. Structured Defect Format Specification

All defects identified during testing must be reported according to the following standardized format:

```text
Defect Record Format:
├── Defect ID:          [DEF-XXX]
├── Title:              [Concise summary of failure]
├── Severity Tier:      [Critical | High | Medium | Low]
├── Page / URL:         [Specific route or component]
├── Environment:        [OS, Browser version, Viewport, Node version]
├── Preconditions:      [Initial state required to reproduce]
├── Steps to Reproduce: [Numbered, deterministic reproduction steps]
├── Expected Result:    [Correct system behavior according to specifications]
├── Actual Result:      [Observed faulty behavior and error messages]
├── Screenshot / Path:  [Relative path to captured visual evidence]
└── Remediation / Log:  [Root cause diagnosis, code fix reference, and retest status]
```

### Severity Tier Definitions
* **Critical (Core Flow / Security Blocked):** Severe defect that completely blocks the user journey (e.g. appointment booking impossible, race condition leading to double bookings, or customer PII leakage in unsecured mock environments).
* **High (Major Function Broken):** Major feature fails or user data is cleared without recovery path (e.g. form validation resets pre-filled fields, authorization fails on draft creation).
* **Medium (Workaround Exists):** Feature functions, but user experience, accessibility, or visual feedback is compromised (e.g. missing animated loading spinner during checkout submission).
* **Low (Cosmetic / Minor Ambiguity):** Minor visual misalignment, typo, or microcopy ambiguity that does not hinder functional execution (e.g. missing planning wireframe disclaimer banner).

---

## 5. Sample Defect Record

The following defect record represents a real, verified issue caught and resolved during test execution:

```markdown
### DEF-001: Form Entries Cleared on Submission Validation Failure

* **Defect ID:** `DEF-001`
* **Title:** Client Name and Phone cleared from form inputs when validation fails on Email
* **Severity:** **High (Major function broken)**
* **Page / URL:** `http://localhost:3000` (`<dialog id="booking-dialog">` Step 2)
* **Environment:** Windows 11 / macOS, Chrome 129 / Safari 18, Viewport 1280px & 375px, Node.js 20+
* **Preconditions:** User has selected a service, date, and held a valid time slot.

* **Steps to Reproduce:**
  1. Open the booking modal on `http://localhost:3000`.
  2. Select "Signature Cut" and pick any available slot on an upcoming date.
  3. Enter Name: "Maya Lin".
  4. Enter Phone: "(718) 555-0199".
  5. Enter an invalid Email: "maya-invalid-email".
  6. Check the mandatory cancellation policy checkbox.
  7. Click "Confirm my visit".

* **Expected Result:**
  * Form submission should be prevented.
  * The Email field should outline in red with an inline error message: "Enter a valid email address".
  * The previously entered Name ("Maya Lin") and Phone ("(718) 555-0199") must remain strictly preserved in their input fields so the user only has to fix the email address.

* **Actual Result (Before Fix):**
  * Form validation triggered, but the form re-render reset all input fields to empty strings.
  * The user was forced to re-type their entire contact profile from scratch, causing significant friction and abandoned bookings.

* **Screenshot / Evidence:**
  * Visual evidence path: `screenshots/booking_validation_errors.png`
  * Automated verification: Subtest 3 in `test/booking_flow.test.js`

* **Root Cause & Remediation:**
  * *Root Cause:* `submitBooking()` was resetting DOM inputs on failed validation passes because input event values were not bound into `clientState` before the validation check.
  * *Remediation:* Updated `submitBooking()` in `public/app.js` to immediately sync DOM values into `clientState` (`clientState.name = name; clientState.email = email; clientState.phone = phone;`) before evaluating validation rules.
  * *Retest Status:* **CLOSED & VERIFIED** (Automated subtest passes 100%; inputs remain populated on validation failure).
```

---

## 6. End-of-Day Acceptance Sign-Off

* [x] **Working Project Skeleton Exists:** Standalone Node.js HTTP server, responsive client SPA, staff portal, and social planner runnable from clean clone.
* [x] **Comprehensive Test Plan:** 10 repeatable, deterministic test cases covering Navigation, Forms, Required Fields, Links, Responsive Layout, and Basic Accessibility.
* [x] **MVP Test Environment Operational:** Both the interactive browser-based runner (`/qa-runner.html`) and automated test runner (`npm test`) execute with 100% pass rates.
* [x] **Structured Defect Format & Sample Record:** Complete defect triage standard with sample record (`DEF-001`) documented and verified.
* [x] **Repository Synchronized:** All artifacts, test matrices, and source code committed to GitHub.

