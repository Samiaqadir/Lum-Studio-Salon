# Luma Studio — API & Mock Integration Contract

**Document Version:** 1.0.0  
**Effective Date:** October 28, 2026  
**Lead Integrator:** Samia Qadir (Integration & QA Lead)  
**Target Systems:** Client Frontend (`public/app.js`), Social Planner (`public/planner.html`), Staff Portal (`public/admin.js`), and Node.js REST API Server (`server.js`)

---

## 1. System Architecture & Integration Model

Luma Studio operates a zero-external-dependency, high-integrity HTTP REST service built on Node.js 20+. The system provides seamless dual-mode capability:
1. **Live Local Backend:** Direct HTTP REST communication with in-memory transaction queuing and atomic persistence to `data/store.json`.
2. **Explicit Mock / Prototype Contract:** When operating in offline, sandbox, or frontend-only demonstration modes, clients adhere strictly to the standardized schema defined herein.

```
┌────────────────────────────────────────────────────────┐
│                   Luma Studio Client                   │
│   (public/app.js · public/planner.html · admin.js)     │
└────────────┬─────────────────────────────▲─────────────┘
             │ HTTP Request (JSON)         │ Response (JSON)
             ▼                             │
┌──────────────────────────────────────────┴─────────────┐
│                 Node.js REST API Engine                 │
│         (/api/services, /api/holds, /api/bookings)      │
└────────────┬─────────────────────────────▲─────────────┘
             │ Enqueue Transaction         │ Atomic Commit
             ▼                             │
┌──────────────────────────────────────────┴─────────────┐
│                Persistent JSON Store                   │
│         (data/store.json · POSIX mode 0o600)           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Booking Flow & API Endpoints

### 2.1 GET `/api/salon`
Retrieves salon public metadata, physical atelier location, contact phone/email, and operating hours.

* **Method:** `GET`
* **Authentication:** None (Public)
* **Response (200 OK):**
```json
{
  "name": "Luma Studio",
  "address": "214 Bedford Avenue, Brooklyn, NY",
  "phone": "(718) 555-0142",
  "email": "hello@lumastudio.example",
  "hours": [
    { "day": "Monday", "hours": "10am – 7pm" },
    { "day": "Tuesday", "hours": "10am – 7pm" },
    { "day": "Wednesday", "hours": "10am – 7pm" },
    { "day": "Thursday", "hours": "10am – 8pm" },
    { "day": "Friday", "hours": "10am – 8pm" },
    { "day": "Saturday", "hours": "9am – 6pm" },
    { "day": "Sunday", "hours": "Closed" }
  ]
}
```

---

### 2.2 GET `/api/services`
Retrieves the full salon service menu, categories, durations, and pricing.

* **Method:** `GET`
* **Authentication:** None (Public)
* **Response (200 OK):**
```json
[
  {
    "id": "signature-cut",
    "category": "Cuts & styling",
    "name": "Signature cut",
    "description": "A considered cut, finished with a soft, lived-in blowout.",
    "durationMinutes": 60,
    "price": 85
  },
  {
    "id": "balayage",
    "category": "Colour",
    "name": "Balayage",
    "description": "Dimensional, hand-painted colour with a complimentary consultation before your first appointment.",
    "durationMinutes": 180,
    "price": 245,
    "priceFrom": true,
    "requiresConsultation": true
  }
]
```

---

### 2.3 GET `/api/availability`
Calculates real-time available appointment start times based on salon operating hours, stylist schedule, existing confirmed appointments, and active 5-minute reservation holds.

* **Method:** `GET`
* **Query Parameters:**
  * `date` (*string, required*): ISO date string `YYYY-MM-DD`.
  * `serviceId` (*string, required*): Identifier of service (e.g., `signature-cut`).
  * `stylistId` (*string, optional*): Specific stylist ID, or empty string for "First available".
* **Success Response (200 OK):**
```json
[
  "2026-11-04T14:00:00.000Z",
  "2026-11-04T14:30:00.000Z",
  "2026-11-04T15:00:00.000Z"
]
```
* **Empty Availability Response (200 OK):**
```json
[]
```
*(Returned when day is Sunday, all slots are held/booked, or date is outside the 60-day horizon).*
* **Error Response (400 Bad Request):**
```json
{
  "error": "Choose a valid date, service, and stylist."
}
```

---

### 2.4 POST `/api/holds`
Acquires an exclusive 5-minute temporary reservation hold on an appointment slot to prevent checkout race conditions.

* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "serviceId": "signature-cut",
  "stylistId": "maya",
  "startAt": "2026-11-04T15:00:00.000Z"
}
```
* **Success Response (201 Created):**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "expiresAt": "2026-11-04T15:05:00.000Z"
}
```
* **Conflict Response (409 Conflict):**
```json
{
  "error": "That time was just booked. Please choose another available time."
}
```

---

### 2.5 POST `/api/bookings`
Finalizes an appointment using an active hold token. Validates client contact details, policy acknowledgment, and prerequisite colour consultations.

* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "holdId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Maya Lin",
  "email": "maya.lin@example.com",
  "phone": "(718) 555-0199",
  "acceptedPolicy": true
}
```
* **Success Response (201 Created):**
```json
{
  "id": "e2a1b4c3-9876-4abc-def0-123456789abc",
  "service": "Signature cut",
  "stylist": "Maya Chen",
  "startAt": "2026-11-04T15:00:00.000Z",
  "status": "confirmed"
}
```
* **Validation Error Response (400 Bad Request):**
```json
{
  "error": "Please provide your name, valid email, and phone number."
}
```
* **Hold Expired Response (409 Conflict):**
```json
{
  "error": "Your time hold expired. Please choose another slot."
}
```
* **Consultation Prerequisite Required (409 Conflict):**
```json
{
  "code": "CONSULTATION_REQUIRED",
  "error": "Please book and complete a complimentary colour consultation before booking balayage."
}
```
* **Simulated Gateway Error (500 Internal Server Error):**
*(Triggered via header `x-simulate-error: 500` or test payload)*
```json
{
  "error": "Atelier Reservation Gateway Error (500): The salon booking database server encountered an unexpected failure. Your slot hold remains active—please try again."
}
```

---

## 3. Client Resilience & Error Recovery Guarantees

### 3.1 Preservation of User Input
To prevent client frustration, `public/app.js` enforces strict state retention rules:
* When validation errors occur (e.g. invalid email format RFC 5322 or unaccepted cancellation policy), the values of **Name**, **Email**, and **Phone** are immediately saved to `clientState` and retained in DOM input fields.
* On backend 500 errors or network failures, the form inputs are **never cleared**. The client can simply correct errors or click **Try again** without re-typing.

### 3.2 Structured Error Card Presentation
* Server errors render inside a dedicated `.booking-failure-card` with high-visibility icon (`✕` or `!`), detailed diagnosis message, and reassuring recovery guidance ("Your chair hold remains active. Tap Try again or call (718) 555-0142").
* The submit button re-enables and resets text to **Try again** with spinner indicators cleared.

### 3.3 Concurrency & Double-Click Protection
* Handlers for `chooseSlot` and `submitBooking` instantiate an immediate synchronous boolean lock (`isSubmittingBooking = true`, `isHoldingSlot = true`).
* The submission button is disabled and assigned `aria-busy="true"` with `.is-loading` spinner within 0ms of the first click. Rapid subsequent clicks within 150ms are synchronously dropped.

---

## 4. Data Privacy & Unsecured Mock Data Security Policy

> [!CAUTION]
> **Zero Real Customer PII in Mock Environments:** Real customer credit card information, government IDs, and non-test phone numbers or email addresses must NEVER be stored in unsecured mock files or exposed client caches.

### 4.1 Mock / Demonstration Environment Safeguards
1. **Prominent UI Notice:** Upon booking completion in demo mode, the confirmation dialog displays a prominent badge:
   `Demo Mode · Local Prototype Store`
   along with an explicit disclaimer:
   > *"This appointment is stored locally in `data/store.json` for staff review. Because this demonstration starter does not integrate live external SMS/Email or card payment gateways, no automated text or email message was dispatched."*
2. **Synthetic Data Policy:** QA automation and manual test runs must strictly use synthetic test identities (RFC 2606 domain `@example.com` or `@lumastudio.example` and NANP test numbers `(718) 555-01XX`).
3. **Local File Hardening:** When writing to disk (`data/store.json`), the server creates files with POSIX mode `0o600` (read and write permissions restricted strictly to the operating process owner).
4. **Hold Expiration Cleanup:** Uncommitted holds automatically expire after 300 seconds (5 minutes) and are pruned every 60 seconds by `expireHolds()`.

---

## 5. Social Planner Posts API Contract

The Social Content Planner (`public/planner.html`) enables editorial draft creation, date/time scheduling, and wireframe previews without contacting external social platforms.

### 5.1 GET `/api/posts`
Lists all social planner posts and drafts.

* **Response (200 OK):**
```json
[
  {
    "id": "post-1",
    "platform": "instagram",
    "caption": "Soft lived-in waves and warm honey tones by @maya...",
    "plannedDate": "2026-11-04",
    "plannedTime": "11:30",
    "status": "Scheduled",
    "mediaUrl": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=800&q=80",
    "aspectRatio": "4:5",
    "createdAt": "2026-10-25T14:20:00.000Z"
  }
]
```

### 5.2 POST `/api/posts`
Creates a new social post wireframe.

* **Request Body:**
```json
{
  "platform": "instagram",
  "caption": "New textured bob finished with our organic botanical serum. ✨ #BrooklynHair",
  "plannedDate": "2026-11-08",
  "plannedTime": "12:00",
  "status": "Draft",
  "mediaUrl": "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=800&q=80"
}
```
* **Response (201 Created):** Returns created post object with generated `id` and ISO timestamp.

### 5.3 PATCH `/api/posts/:id`
Updates caption, target date/time, media, or status (`Draft` ↔ `Scheduled`).

* **Response (200 OK):** Returns updated post object.

### 5.4 DELETE `/api/posts/:id`
Removes draft from calendar.

* **Response (200 OK):** `{ "success": true }`.

### 5.5 Live Publishing Disclaimer & Required OAuth Scopes
Actual publishing to live social networks is **explicitly disabled** in this wireframe prototype. Enabling automated distribution requires official app review, approved access tokens, and explicit OAuth scopes:
* **Instagram Graph API:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`
* **Facebook Pages API:** `pages_manage_posts`, `pages_read_engagement`
* **TikTok Content Posting API:** `video.upload`, `video.publish`
* **Pinterest API:** `pins:write`, `boards:read`
