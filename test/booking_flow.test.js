const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createSalonServer } = require("../server");

test("QA Scenario 1: Valid Booking — End-to-end appointment creation with confirmation", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-valid-booking-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Step 1: Check availability for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1); // skip Sunday
  const dateKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const availRes = await fetch(`${baseUrl}/api/availability?date=${dateKey}&serviceId=signature-cut&stylistId=maya`);
  assert.equal(availRes.status, 200, "Availability endpoint should return 200 OK");
  const slots = await availRes.json();
  assert.ok(Array.isArray(slots) && slots.length > 0, "Slots should be available for a valid service and date");

  // Step 2: Hold a slot
  const slotToHold = slots[0];
  const holdRes = await fetch(`${baseUrl}/api/holds`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slotToHold })
  });
  assert.equal(holdRes.status, 201, "Hold creation should return 201 Created");
  const hold = await holdRes.json();
  assert.ok(hold.id, "Hold token should be generated");

  // Step 3: Complete valid booking submission
  const bookRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      holdId: hold.id,
      name: "Samia Qadir",
      email: "samia.qadir@example.com",
      phone: "(718) 555-0199",
      acceptedPolicy: true
    })
  });
  assert.equal(bookRes.status, 201, "Booking confirmation should return 201 Created");
  const booking = await bookRes.json();
  assert.ok(booking.id, "Booking confirmation must include a unique appointment ID");
  assert.equal(booking.status, "confirmed", "Booking status should be confirmed");
  assert.equal(booking.service, "Signature cut");
  assert.equal(booking.stylist, "Maya Chen");
});

test("QA Scenario 2: Missing Service Selection Prerequisite", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-missing-service-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Attempting availability with missing serviceId
  const availRes = await fetch(`${baseUrl}/api/availability?date=2026-11-04&stylistId=maya`);
  assert.equal(availRes.status, 400, "Missing service must return 400 Bad Request");
  const body = await availRes.json();
  assert.ok(body.error.includes("valid date, service, and stylist"), "Error message must clearly cite missing service");
});

test("QA Scenario 3: Missing Contact Information Validation (Name, Email, Phone, Policy)", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-missing-contact-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Setup a valid hold
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const availRes = await fetch(`${baseUrl}/api/availability?date=${dateKey}&serviceId=signature-cut&stylistId=jules`);
  const slots = await availRes.json();
  const holdRes = await fetch(`${baseUrl}/api/holds`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serviceId: "signature-cut", stylistId: "jules", startAt: slots[0] })
  });
  const hold = await holdRes.json();

  // Subtest 3a: Missing name (1 char)
  const badNameRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holdId: hold.id, name: "A", email: "guest@example.com", phone: "555-0199", acceptedPolicy: true })
  });
  assert.equal(badNameRes.status, 400, "Name under 2 chars must fail with 400");

  // Subtest 3b: Malformed email
  const badEmailRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holdId: hold.id, name: "Maya Lin", email: "not-an-email", phone: "555-0199", acceptedPolicy: true })
  });
  assert.equal(badEmailRes.status, 400, "Invalid email must fail with 400");

  // Subtest 3c: Missing phone / too short
  const badPhoneRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holdId: hold.id, name: "Maya Lin", email: "maya@example.com", phone: "123", acceptedPolicy: true })
  });
  assert.equal(badPhoneRes.status, 400, "Invalid phone must fail with 400");

  // Subtest 3d: Unchecked policy
  const badPolicyRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holdId: hold.id, name: "Maya Lin", email: "maya@example.com", phone: "(718) 555-0199", acceptedPolicy: false })
  });
  assert.equal(badPolicyRes.status, 400, "Unaccepted policy must fail with 400");
  const policyErr = await badPolicyRes.json();
  assert.ok(policyErr.error.includes("cancellation policy"), "Error must clearly cite policy acceptance requirement");
});

test("QA Scenario 4: Reject Past Dates and Past Date Slot Computation", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-past-dates-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Querying availability on yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const pastDateKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const pastAvailRes = await fetch(`${baseUrl}/api/availability?date=${pastDateKey}&serviceId=signature-cut&stylistId=maya`);
  assert.equal(pastAvailRes.status, 200);
  const slots = await pastAvailRes.json();
  assert.deepEqual(slots, [], "Slots for past dates must be strictly empty");

  // Attempting to hold a past timestamp
  const pastHoldRes = await fetch(`${baseUrl}/api/holds`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: yesterday.toISOString() })
  });
  assert.equal(pastHoldRes.status, 409, "Holding a past slot must be rejected with 409 Conflict");
});

test("QA Scenario 5: Backend Error Resilience and Recovery", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-backend-error-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Setup valid hold
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const availRes = await fetch(`${baseUrl}/api/availability?date=${dateKey}&serviceId=signature-cut&stylistId=maya`);
  const slots = await availRes.json();
  const holdRes = await fetch(`${baseUrl}/api/holds`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slots[0] })
  });
  const hold = await holdRes.json();

  // Send request simulating 500 backend error
  const errRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-simulate-error": "500" },
    body: JSON.stringify({
      holdId: hold.id,
      name: "Simulate Backend Error",
      email: "error@lumastudio.example",
      phone: "(718) 555-0199",
      acceptedPolicy: true
    })
  });
  assert.equal(errRes.status, 500, "Backend error must return HTTP 500");
  const errBody = await errRes.json();
  assert.ok(errBody.error.includes("Gateway Error (500)"), "Error response must clearly state gateway failure");

  // Verify that the slot hold was NOT consumed and can still be booked on retry
  const retryRes = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      holdId: hold.id,
      name: "Maya Lin",
      email: "maya.lin@example.com",
      phone: "(718) 555-0199",
      acceptedPolicy: true
    })
  });
  assert.equal(retryRes.status, 201, "Subsequent valid submission must succeed after backend recovery");
});

test("QA Scenario 6: Accidental Repeated Click Protection (Double Submission)", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-repeat-click-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Setup valid hold
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 4);
  while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const availRes = await fetch(`${baseUrl}/api/availability?date=${dateKey}&serviceId=signature-cut&stylistId=maya`);
  const slots = await availRes.json();
  const holdRes = await fetch(`${baseUrl}/api/holds`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: slots[0] })
  });
  const hold = await holdRes.json();

  // Send two simultaneous booking confirmations with the same hold token
  const [firstCall, secondCall] = await Promise.all([
    fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holdId: hold.id, name: "Samia Qadir", email: "samia@example.com", phone: "(718) 555-0199", acceptedPolicy: true })
    }),
    fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holdId: hold.id, name: "Samia Qadir", email: "samia@example.com", phone: "(718) 555-0199", acceptedPolicy: true })
    })
  ]);

  const statuses = [firstCall.status, secondCall.status].sort();
  assert.deepEqual(statuses, [201, 409], "Exactly one call must succeed with 201; concurrent duplicate must be rejected with 409");
});

test("QA Social Planner: Posts Endpoint & Status Pipeline (Draft / Scheduled)", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-social-planner-"));
  const server = createSalonServer({ dataPath: path.join(tempDir, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Public GET /api/posts
  const postsRes = await fetch(`${baseUrl}/api/posts`);
  assert.equal(postsRes.status, 200);
  const initialPosts = await postsRes.json();
  assert.ok(Array.isArray(initialPosts) && initialPosts.length >= 4, "Initial seed posts must be available");
  assert.ok(initialPosts.some(p => p.status === "Draft"), "Must contain Draft status post");
  assert.ok(initialPosts.some(p => p.status === "Scheduled"), "Must contain Scheduled status post");

  // Create a new post via public POST /api/posts (DEF-006 verification)
  const publicCreateRes = await fetch(`${baseUrl}/api/posts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: "pinterest",
      caption: "Public wireframe draft creation test #Aesthetic",
      plannedDate: "2026-11-20",
      plannedTime: "10:00",
      status: "Draft"
    })
  });
  assert.equal(publicCreateRes.status, 201, "Public wireframe post creation should succeed with 201 Created");
  const publicCreated = await publicCreateRes.json();
  assert.equal(publicCreated.status, "Draft");
  assert.equal(publicCreated.platform, "pinterest");

  // Edit draft via public PATCH /api/posts/:id
  const publicPatchRes = await fetch(`${baseUrl}/api/posts/${publicCreated.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plannedTime: "16:00", caption: "Edited draft caption for Brooklyn autumn hair" })
  });
  assert.equal(publicPatchRes.status, 200, "Public draft editing should succeed with 200 OK");
  const publicEdited = await publicPatchRes.json();
  assert.equal(publicEdited.plannedTime, "16:00");
  assert.equal(publicEdited.caption, "Edited draft caption for Brooklyn autumn hair");

  // Delete draft via public DELETE /api/posts/:id
  const publicDelRes = await fetch(`${baseUrl}/api/posts/${publicCreated.id}`, {
    method: "DELETE"
  });
  assert.equal(publicDelRes.status, 200, "Public draft deletion should return 200 OK");

  // Create a post via admin POST /api/admin/posts
  const createRes = await fetch(`${baseUrl}/api/admin/posts`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer admin123" },
    body: JSON.stringify({
      platform: "instagram",
      caption: "Testing lived-in colour placement with Maya #Balayage",
      plannedDate: "2026-11-18",
      plannedTime: "14:30",
      status: "Scheduled"
    })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.status, "Scheduled");
  assert.equal(created.platform, "instagram");

  // Update status from Scheduled to Draft via PATCH
  const patchRes = await fetch(`${baseUrl}/api/admin/posts/${created.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer admin123" },
    body: JSON.stringify({ status: "Draft", caption: "Updated copy: Balayage aftercare tips" })
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  assert.equal(updated.status, "Draft");
  assert.equal(updated.caption, "Updated copy: Balayage aftercare tips");
});
