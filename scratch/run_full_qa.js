const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createSalonServer } = require("../server");

async function runQASuite() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    suites: []
  };

  function addSuite(name) {
    const suite = { name, tests: [] };
    results.suites.push(suite);
    return {
      test(testName, fn) {
        suite.tests.push({ name: testName, fn });
      }
    };
  }

  // Setup ephemeral test server instance
  const tempDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "luma-qa-"));
  const adminKey = "luma-qa-secure-key";
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json"), adminKey });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (url, options = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: { "content-type": "application/json", ...options.headers }
    });
    let body = null;
    const text = await response.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, headers: response.headers, body, rawText: text };
  };

  function nextWeekday(offsetDays = 1, hour = 11) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    while (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  // Suite 1: Core Static Files & HTTP Security Headers
  const s1 = addSuite("1. Core Web Serving & Security Headers");
  s1.test("Home page (/) serves 200 with HTML, viewport meta, and skip link", async () => {
    const res = await request("/");
    assert.equal(res.status, 200);
    assert.ok(res.rawText.includes("<!doctype html>"));
    assert.ok(res.rawText.includes("viewport"));
    assert.ok(res.rawText.includes("skip-link"));
    assert.ok(res.rawText.includes("Luma Studio"));
  });

  s1.test("Security headers are enforced on static and HTML responses", async () => {
    const res = await request("/");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });

  s1.test("Staff portal route (/admin) resolves to admin dashboard page", async () => {
    const res = await request("/admin");
    assert.equal(res.status, 200);
    assert.ok(res.rawText.includes("STAFF PORTAL"));
    assert.ok(res.rawText.includes("admin-key"));
  });

  s1.test("Path traversal attacks return 400 or 404 without file leakage", async () => {
    const res1 = await request("/%2e%2e%2fpackage.json");
    const res2 = await request("/../../server.js");
    assert.ok(res1.status === 400 || res1.status === 404);
    assert.ok(res2.status === 400 || res2.status === 404);
  });

  // Suite 2: Public Salon & Catalog API
  const s2 = addSuite("2. Public Catalog & Availability API");
  s2.test("GET /api/salon returns studio hours, address, phone and email", async () => {
    const res = await request("/api/salon");
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Luma Studio");
    assert.ok(Array.isArray(res.body.hours));
    assert.ok(res.body.address.includes("Bedford"));
  });

  s2.test("GET /api/services returns full categorized catalog with pricing & duration", async () => {
    const res = await request("/api/services");
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 6);
    const cut = res.body.find((s) => s.id === "signature-cut");
    assert.ok(cut);
    assert.equal(cut.category, "Cuts & styling");
    assert.equal(cut.durationMinutes, 60);
    assert.equal(cut.price, 85);
  });

  s2.test("GET /api/stylists returns staff roster and assigned services", async () => {
    const res = await request("/api/stylists");
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 3);
    const maya = res.body.find((s) => s.id === "maya");
    assert.ok(maya);
    assert.ok(maya.serviceIds.includes("balayage"));
  });

  s2.test("GET /api/availability calculates valid bookable time slots", async () => {
    const targetDate = nextWeekday(2);
    const dateStr = targetDate.toISOString().slice(0, 10);
    const res = await request(`/api/availability?date=${dateStr}&serviceId=signature-cut&stylistId=maya`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  s2.test("GET /api/availability returns empty list for Sunday / closed days", async () => {
    const sun = new Date();
    sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7)); // Next Sunday
    if (sun.getDay() !== 0) sun.setDate(sun.getDate() + 7);
    const dateStr = sun.toISOString().slice(0, 10);
    const res = await request(`/api/availability?date=${dateStr}&serviceId=signature-cut&stylistId=maya`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  // Suite 3: Concurrency, Slot Holds & Appointment Booking
  const s3 = addSuite("3. Slot Holds, Concurrency & Booking Integrity");
  s3.test("POST /api/holds grants an exclusive 5-minute reservation hold", async () => {
    const slot = nextWeekday(3, 14).toISOString();
    const res = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slot })
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.ok(res.body.expiresAt);
  });

  s3.test("Race condition prevention: Competing holds on the same slot trigger 409 Conflict", async () => {
    const slot = nextWeekday(4, 15).toISOString();
    const reqBody = JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slot });
    const [h1, h2] = await Promise.all([
      request("/api/holds", { method: "POST", body: reqBody }),
      request("/api/holds", { method: "POST", body: reqBody })
    ]);
    const statuses = [h1.status, h2.status].sort();
    assert.deepEqual(statuses, [201, 409]);
  });

  s3.test("Booking requires explicit policy acceptance (cancellation & terms)", async () => {
    const slot = nextWeekday(5, 11).toISOString();
    const holdRes = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slot })
    });
    assert.equal(holdRes.status, 201);
    const bookRes = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        holdId: holdRes.body.id,
        name: "Samantha Vance",
        email: "samantha@example.com",
        phone: "(718) 555-0199",
        acceptedPolicy: false
      })
    });
    assert.equal(bookRes.status, 400);
    assert.ok(bookRes.body.error.includes("policy"));
  });

  s3.test("Valid booking completes successfully, sets status to confirmed, and saves record", async () => {
    const slot = nextWeekday(5, 12).toISOString();
    const holdRes = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slot })
    });
    assert.equal(holdRes.status, 201);
    const bookRes = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        holdId: holdRes.body.id,
        name: "Samantha Vance",
        email: "samantha@example.com",
        phone: "(718) 555-0199",
        acceptedPolicy: true
      })
    });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.body.status, "confirmed");
    assert.ok(bookRes.body.id);
  });

  s3.test("Prerequisite check: Balayage rejects bookings without completed colour consultation", async () => {
    const slot = nextWeekday(6, 13).toISOString();
    const holdRes = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "balayage", stylistId: "maya", startAt: slot })
    });
    assert.equal(holdRes.status, 201);
    const bookRes = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        holdId: holdRes.body.id,
        name: "First Time Color Guest",
        email: "newcolorist@example.com",
        phone: "(718) 555-0188",
        acceptedPolicy: true
      })
    });
    assert.equal(bookRes.status, 409);
    assert.equal(bookRes.body.code, "CONSULTATION_REQUIRED");
  });

  // Suite 4: Admin Security, Authorization & Management
  const s4 = addSuite("4. Admin Authentication, Security & CRUD Management");
  s4.test("Admin endpoints reject unauthenticated access with 401", async () => {
    const res = await request("/api/admin/bookings");
    assert.equal(res.status, 401);
  });

  s4.test("Admin endpoints reject invalid bearer tokens with 401", async () => {
    const res = await request("/api/admin/bookings", {
      headers: { authorization: "Bearer wrong-token-12345" }
    });
    assert.equal(res.status, 401);
  });

  s4.test("Admin endpoint accepts valid key and lists all appointments", async () => {
    const res = await request("/api/admin/bookings", {
      headers: { authorization: `Bearer ${adminKey}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  s4.test("Admin can transition appointment status (e.g. to checked-in, completed)", async () => {
    // List bookings to get Samantha Vance's booking
    const listRes = await request("/api/admin/bookings", {
      headers: { authorization: `Bearer ${adminKey}` }
    });
    const booking = listRes.body[0];
    assert.ok(booking, "Booking exists");
    const patchRes = await request(`/api/admin/bookings/${booking.id}/status`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${adminKey}` },
      body: JSON.stringify({ status: "checked-in" })
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.status, "checked-in");
  });

  s4.test("Admin can create new services with auto-assignment to all stylists", async () => {
    const newService = {
      name: "Scalp Detox Ritual",
      category: "Rituals",
      price: 65,
      durationMinutes: 45,
      description: "Exfoliating botanical scalp massage and restorative treatment."
    };
    const res = await request("/api/admin/services", {
      method: "POST",
      headers: { authorization: `Bearer ${adminKey}` },
      body: JSON.stringify(newService)
    });
    assert.equal(res.status, 201);
    const created = res.body.find((s) => s.name === "Scalp Detox Ritual");
    assert.ok(created);
    assert.equal(created.price, 65);

    // Verify stylists received this service
    const stylistsRes = await request("/api/stylists");
    assert.ok(stylistsRes.body.every((st) => st.serviceIds.includes(created.id)));
  });

  // Suite 5: Frontend Design, Card Alignment & Accessibility
  const s5 = addSuite("5. Frontend Design, Card Alignment & Accessibility QA");
  s5.test("styles.css enforces equal card heights with flex: 1 1 0% on .service-card", () => {
    const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");
    assert.ok(css.includes(".service-card { display: flex; flex-direction: column; flex: 1 1 0%;"));
  });

  s5.test("styles.css aligns action buttons and duration badges to bottom baseline with margin-top: auto", () => {
    const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");
    assert.ok(css.includes(".service-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto;"));
  });

  s5.test("styles.css sets white-space: nowrap on .service-book to avoid awkward line wrapping", () => {
    const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");
    assert.ok(css.includes(".service-book {") && css.includes("white-space: nowrap;"));
  });

  s5.test("index.html contains proper semantic structure (main, header, nav, section, footer, dialog)", () => {
    const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
    assert.ok(html.includes("<header class=\"site-header\">"));
    assert.ok(html.includes("<main id=\"main\""));
    assert.ok(html.includes("<dialog class=\"booking-dialog\""));
    assert.ok(html.includes("<footer class=\"site-footer\">"));
  });

  s5.test("index.html has valid aria labels and accessibility attributes", () => {
    const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
    assert.ok(html.includes("aria-label=\"Open navigation\""));
    assert.ok(html.includes("aria-controls=\"main-nav\""));
    assert.ok(html.includes("aria-expanded=\"false\""));
    assert.ok(html.includes("aria-labelledby=\"booking-heading\""));
  });

  s5.test("admin.html input fields have corresponding label elements with matching for/id", () => {
    const html = fs.readFileSync(path.join(__dirname, "../public/admin.html"), "utf8");
    assert.ok(html.includes("for=\"admin-key\""));
    assert.ok(html.includes("id=\"admin-key\""));
  });

  // Suite 6: Social Planner Calendar Navigation & Post Composer
  const s6 = addSuite("6. Social Planner Calendar Navigation & Post Composer");
  s6.test("GET /api/posts returns seed posts with Draft and Scheduled statuses", async () => {
    const res = await request("/api/posts");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body) && res.body.length >= 4);
    assert.ok(res.body.some((p) => p.status === "Draft"));
    assert.ok(res.body.some((p) => p.status === "Scheduled"));
  });

  s6.test("POST /api/posts creates new wireframe draft with planned date & time", async () => {
    const res = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        platform: "instagram",
        caption: "Honey blonde lived-in balayage finish by Maya #BrooklynHair",
        plannedDate: "2026-11-15",
        plannedTime: "11:30",
        status: "Draft"
      })
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "Draft");
    assert.equal(res.body.plannedDate, "2026-11-15");
    assert.equal(res.body.plannedTime, "11:30");
  });

  s6.test("PATCH and DELETE /api/posts/:id allow updating and deleting drafts", async () => {
    const createRes = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        platform: "tiktok",
        caption: "Styling curls with organic serum",
        plannedDate: "2026-11-20",
        plannedTime: "15:00",
        status: "Draft"
      })
    });
    assert.equal(createRes.status, 201);
    const postId = createRes.body.id;

    const patchRes = await request(`/api/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Scheduled", plannedTime: "16:30" })
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.status, "Scheduled");
    assert.equal(patchRes.body.plannedTime, "16:30");

    const delRes = await request(`/api/posts/${postId}`, { method: "DELETE" });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);
  });

  s6.test("planner.html contains calendar month navigation, composer dialog, and publishing disclaimer", () => {
    const html = fs.readFileSync(path.join(__dirname, "../public/planner.html"), "utf8");
    assert.ok(html.includes("id=\"btn-prev-month\""), "Must have previous month navigation button");
    assert.ok(html.includes("id=\"btn-next-month\""), "Must have next month navigation button");
    assert.ok(html.includes("id=\"btn-today-month\""), "Must have today month reset button");
    assert.ok(html.includes("id=\"composer-modal\""), "Must have composer modal dialog");
    assert.ok(html.includes("id=\"post-caption\""), "Must have post caption input");
    assert.ok(html.includes("id=\"post-date\""), "Must have planned date picker");
    assert.ok(html.includes("id=\"post-time\""), "Must have planned time picker");
    assert.ok(html.includes("wireframe-disclaimer-banner"), "Must have wireframe disclaimer banner");
    assert.ok(html.includes("Actual publishing requires approved API access"), "Must explain live API requirements");
  });

  // Execute all suites
  for (const suite of results.suites) {
    console.log(`\n--- ${suite.name} ---`);
    for (const t of suite.tests) {
      results.total++;
      try {
        await t.fn();
        t.status = "PASS";
        results.passed++;
        console.log(`  [PASS] ${t.name}`);
      } catch (err) {
        t.status = "FAIL";
        t.error = err.message;
        results.failed++;
        console.log(`  [FAIL] ${t.name} -> ${err.message}`);
      }
    }
  }

  // Teardown
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });

  fs.writeFileSync(path.join(__dirname, "qa_results.json"), JSON.stringify(results, null, 2), "utf8");
  console.log(`\n========================================`);
  console.log(`QA Execution Complete: ${results.passed}/${results.total} passed (${results.failed} failed).`);
  console.log(`========================================\n`);
  return results;
}

runQASuite().catch((e) => {
  console.error("QA suite failed:", e);
  process.exit(1);
});
