const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createSalonServer } = require("../server");

async function withServer(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luma-salon-test-"));
  const server = createSalonServer({ dataPath: path.join(directory, "store.json"), adminKey: "test-admin-key" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, options = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: { "content-type": "application/json", ...options.headers }
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await run({ request, directory, baseUrl });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function nextWeekdayAt(hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0) date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

test("public website and salon catalog are served", async () => {
  await withServer(async ({ request, baseUrl }) => {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Luma Studio/);
    const services = await request("/api/services");
    assert.equal(services.status, 200);
    assert.ok(services.body.some((service) => service.id === "balayage"));
    const stylists = await request("/api/stylists");
    assert.equal(stylists.status, 200);
    assert.ok(stylists.body.some((stylist) => stylist.id === "maya"));
  });
});

test("a slot can only be held once and bookings require policy acceptance", async () => {
  await withServer(async ({ request, directory }) => {
    const startAt = nextWeekdayAt().toISOString();
    const bookingRequest = { serviceId: "signature-cut", stylistId: "maya", startAt };
    const [firstHold, competingHold] = await Promise.all([
      request("/api/holds", { method: "POST", body: JSON.stringify(bookingRequest) }),
      request("/api/holds", { method: "POST", body: JSON.stringify(bookingRequest) })
    ]);
    assert.equal([firstHold.status, competingHold.status].filter((status) => status === 201).length, 1);
    assert.equal([firstHold.status, competingHold.status].filter((status) => status === 409).length, 1);

    const hold = firstHold.status === 201 ? firstHold.body : competingHold.body;
    const missingPolicy = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ holdId: hold.id, name: "Jordan Lee", email: "jordan@example.com", phone: "555-555-1234", acceptedPolicy: false })
    });
    assert.equal(missingPolicy.status, 400);

    const booking = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ holdId: hold.id, name: "Jordan Lee", email: "jordan@example.com", phone: "555-555-1234", acceptedPolicy: true })
    });
    assert.equal(booking.status, 201);
    assert.equal(booking.body.status, "confirmed");
    assert.equal(fs.existsSync(path.join(directory, "store.json")), true);
  });
});

test("appointments block matching stylist slots and admin status changes require authentication", async () => {
  await withServer(async ({ request }) => {
    const startAt = nextWeekdayAt().toISOString();
    const hold = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt })
    });
    assert.equal(hold.status, 201);
    const booking = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ holdId: hold.body.id, name: "Jordan Lee", email: "jordan@example.com", phone: "555-555-1234", acceptedPolicy: true })
    });
    const availability = await request(`/api/availability?date=${startAt.slice(0, 10)}&serviceId=signature-cut&stylistId=maya`);
    assert.equal(availability.status, 200);
    assert.equal(availability.body.includes(startAt), false);

    const unauthorized = await request("/api/admin/bookings");
    assert.equal(unauthorized.status, 401);
    const authorized = await request("/api/admin/bookings", { headers: { authorization: "Bearer test-admin-key" } });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.length, 1);
    const status = await request(`/api/admin/bookings/${booking.body.id}/status`, {
      method: "PATCH",
      headers: { authorization: "Bearer test-admin-key" },
      body: JSON.stringify({ status: "checked-in" })
    });
    assert.equal(status.status, 200);
    assert.equal(status.body.status, "checked-in");
  });
});

test("expired, invalid, and unsupported booking inputs fail explicitly", async () => {
  await withServer(async ({ request }) => {
    const badSlot = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "signature-cut", stylistId: "maya", startAt: new Date(Date.now() + 1_000).toISOString() })
    });
    assert.equal(badSlot.status, 409);
    const noAdminKey = await request("/api/admin/bookings", { headers: { authorization: "Bearer invalid" } });
    assert.equal(noAdminKey.status, 401);
  });
});

test("balayage requires a completed colour consultation before booking", async () => {
  await withServer(async ({ request }) => {
    const startAt = nextWeekdayAt().toISOString();
    const hold = await request("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: "balayage", stylistId: "maya", startAt })
    });
    assert.equal(hold.status, 201);
    const response = await request("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ holdId: hold.body.id, name: "Jordan Lee", email: "jordan@example.com", phone: "555-555-1234", acceptedPolicy: true })
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "CONSULTATION_REQUIRED");
  });
});
