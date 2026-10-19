const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const handler = require("../api/index.js");

test("Vercel serverless handler serves salon catalog and availability", async () => {
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const salonRes = await fetch(`${baseUrl}/api/salon`);
    assert.equal(salonRes.status, 200);
    const salon = await salonRes.json();
    assert.equal(salon.name, "Luma Studio");

    const servicesRes = await fetch(`${baseUrl}/api/services`);
    assert.equal(servicesRes.status, 200);
    const services = await servicesRes.json();
    assert.ok(services.length >= 6);

    const stylistsRes = await fetch(`${baseUrl}/api/stylists`);
    assert.equal(stylistsRes.status, 200);
    const stylists = await stylistsRes.json();
    assert.ok(stylists.some((s) => s.id === "maya"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
