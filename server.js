const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const HOLD_MINUTES = 5;
const BOOKING_HORIZON_DAYS = 60;
const SLOT_INTERVAL_MINUTES = 30;
const HOLD_CLEANUP_INTERVAL_MS = 60_000;
const PUBLIC_DIR = path.join(__dirname, "public");

const seed = {
  salon: {
    name: "Luma Studio",
    address: "214 Bedford Avenue, Brooklyn, NY",
    phone: "(718) 555-0142",
    email: "hello@lumastudio.example",
    hours: [
      { day: "Monday", hours: "10am – 7pm" },
      { day: "Tuesday", hours: "10am – 7pm" },
      { day: "Wednesday", hours: "10am – 7pm" },
      { day: "Thursday", hours: "10am – 8pm" },
      { day: "Friday", hours: "10am – 8pm" },
      { day: "Saturday", hours: "9am – 6pm" },
      { day: "Sunday", hours: "Closed" }
    ]
  },
  services: [
    { id: "signature-cut", category: "Cuts & styling", name: "Signature cut", description: "A considered cut, finished with a soft, lived-in blowout.", durationMinutes: 60, price: 85 },
    { id: "gloss-blowout", category: "Cuts & styling", name: "Gloss & blowout", description: "A smooth, high-shine finish with a custom gloss.", durationMinutes: 60, price: 75 },
    { id: "balayage", category: "Colour", name: "Balayage", description: "Dimensional, hand-painted colour with a complimentary consultation before your first appointment.", durationMinutes: 180, price: 245, priceFrom: true, requiresConsultation: true },
    { id: "root-refresh", category: "Colour", name: "Root refresh", description: "Seamless root colour, finished with a nourishing gloss.", durationMinutes: 120, price: 145 },
    { id: "deep-repair", category: "Rituals", name: "Deep repair ritual", description: "A restorative bond-building treatment for stronger, softer hair.", durationMinutes: 45, price: 55 },
    { id: "complimentary-consultation", category: "Consultations", name: "Complimentary colour consultation", description: "A relaxed 20-minute chat to plan your colour and make sure it feels right for you.", durationMinutes: 20, price: 0 }
  ],
  stylists: [
    { id: "maya", name: "Maya Chen", level: "Master stylist", specialties: "Balayage · lived-in colour", image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=700&q=85", serviceIds: ["signature-cut", "gloss-blowout", "balayage", "root-refresh", "deep-repair", "complimentary-consultation"] },
    { id: "jules", name: "Jules Rivera", level: "Senior stylist", specialties: "Modern cuts · healthy hair", image: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=700&q=85", serviceIds: ["signature-cut", "gloss-blowout", "root-refresh", "deep-repair", "complimentary-consultation"] },
    { id: "imani", name: "Imani Brooks", level: "Senior stylist", specialties: "Colour · curl care", image: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=700&q=85", serviceIds: ["signature-cut", "gloss-blowout", "balayage", "root-refresh", "deep-repair", "complimentary-consultation"] }
  ],
  appointments: [],
  holds: []
};

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function appointmentEnd(appointment, services) {
  const service = services.find((item) => item.id === appointment.serviceId);
  return Date.parse(appointment.startAt) + (service?.durationMinutes || 0) * 60_000;
}

function overlaps(start, end, otherStart, otherEnd) {
  return start < otherEnd && otherStart < end;
}

function isBookableStatus(status) {
  return status !== "cancelled";
}

function availableSlots(store, dateKey, serviceId, stylistId, now = Date.now()) {
  const date = parseDateKey(dateKey);
  const service = store.services.find((item) => item.id === serviceId);
  const stylist = store.stylists.find((item) => item.id === stylistId);
  if (!date || !service || !stylist || !stylist.serviceIds.includes(serviceId)) return null;

  const dayOffset = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate())) / 86_400_000);
  if (dayOffset < 0 || dayOffset > BOOKING_HORIZON_DAYS || date.getDay() === 0) return [];

  const openingHour = date.getDay() === 6 ? 9 : 10;
  const closingHour = date.getDay() === 6 ? 18 : (date.getDay() === 4 || date.getDay() === 5 ? 20 : 19);
  const serviceDurationMs = service.durationMinutes * 60_000;
  const activeAppointments = store.appointments.filter((appointment) =>
    appointment.stylistId === stylistId && isBookableStatus(appointment.status)
  );
  const activeHolds = store.holds.filter((hold) =>
    hold.stylistId === stylistId && Date.parse(hold.expiresAt) > now
  );
  const slots = [];

  for (let minute = openingHour * 60; minute + service.durationMinutes <= closingHour * 60; minute += SLOT_INTERVAL_MINUTES) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minute / 60), minute % 60).getTime();
    const end = start + serviceDurationMs;
    if (start <= now) continue;
    const appointmentConflict = activeAppointments.some((appointment) =>
      overlaps(start, end, Date.parse(appointment.startAt), appointmentEnd(appointment, store.services))
    );
    const holdConflict = activeHolds.some((hold) =>
      overlaps(start, end, Date.parse(hold.startAt), Date.parse(hold.endAt))
    );
    if (!appointmentConflict && !holdConflict) slots.push(new Date(start).toISOString());
  }
  return slots;
}

function timingSafeMatch(provided, expected) {
  if (!expected || !provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function createSalonServer(options = {}) {
  const dataPath = options.dataPath || path.join(__dirname, "data", "store.json");
  const adminKey = options.adminKey === undefined ? process.env.SALON_ADMIN_KEY : options.adminKey;
  let store = readJson(dataPath) || structuredClone(seed);
  let operationQueue = Promise.resolve();

  function enqueue(operation) {
    const result = operationQueue.then(operation);
    operationQueue = result.catch(() => {});
    return result;
  }

  function save() {
    writeJson(dataPath, store);
  }

  function expireHolds() {
    const activeHolds = store.holds.filter((hold) => Date.parse(hold.expiresAt) > Date.now());
    if (activeHolds.length !== store.holds.length) {
      store.holds = activeHolds;
      save();
    }
  }

  function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });
    response.end(JSON.stringify(body));
  }

  function readBody(request) {
    return new Promise((resolve, reject) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body) > 16_384) {
          reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
          request.destroy();
        }
      });
      request.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
        }
      });
      request.on("error", reject);
    });
  }

  function requireAdmin(request, response) {
    if (!adminKey) {
      sendJson(response, 503, { error: "Admin access is not configured. Set SALON_ADMIN_KEY and restart the server." });
      return false;
    }
    const authorization = request.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!timingSafeMatch(token, adminKey)) {
      sendJson(response, 401, { error: "Enter the salon admin key to manage appointments." });
      return false;
    }
    return true;
  }

  async function handleApi(request, response, url) {
    if (request.method === "GET" && url.pathname === "/api/salon") {
      return sendJson(response, 200, store.salon);
    }
    if (request.method === "GET" && url.pathname === "/api/services") {
      return sendJson(response, 200, store.services);
    }
    if (request.method === "GET" && url.pathname === "/api/stylists") {
      return sendJson(response, 200, store.stylists);
    }
    if (request.method === "GET" && url.pathname === "/api/availability") {
      const slots = availableSlots(store, url.searchParams.get("date"), url.searchParams.get("serviceId"), url.searchParams.get("stylistId"));
      return slots === null
        ? sendJson(response, 400, { error: "Choose a valid date, service, and stylist." })
        : sendJson(response, 200, slots);
    }
    if (request.method === "POST" && url.pathname === "/api/holds") {
      const body = await readBody(request);
      return enqueue(() => {
        expireHolds();
        const start = Date.parse(body.startAt);
        if (!Number.isFinite(start)) return sendJson(response, 400, { error: "Choose a valid appointment time." });
        const startDate = new Date(start);
        const dateKey = localDateKey(startDate);
        const slots = availableSlots(store, dateKey, body.serviceId, body.stylistId);
        if (!slots || !slots.includes(startDate.toISOString())) {
          return sendJson(response, 409, { error: "That time was just booked. Please choose another available time." });
        }
        const service = store.services.find((item) => item.id === body.serviceId);
        const hold = {
          id: crypto.randomUUID(),
          serviceId: service.id,
          stylistId: body.stylistId,
          startAt: startDate.toISOString(),
          endAt: new Date(start + service.durationMinutes * 60_000).toISOString(),
          expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString()
        };
        store.holds.push(hold);
        save();
        return sendJson(response, 201, { id: hold.id, expiresAt: hold.expiresAt });
      });
    }
    if (request.method === "POST" && url.pathname === "/api/bookings") {
      const body = await readBody(request);
      return enqueue(() => {
        expireHolds();
        const hold = store.holds.find((item) => item.id === body.holdId);
        if (!hold) return sendJson(response, 409, { error: "Your time hold expired. Please choose another slot." });
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";
        if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^[+()\d\s.-]{7,25}$/.test(phone)) {
          return sendJson(response, 400, { error: "Enter a valid name, email address, and phone number." });
        }
        if (body.acceptedPolicy !== true) return sendJson(response, 400, { error: "Please accept the booking and cancellation policy." });
        const service = store.services.find((item) => item.id === hold.serviceId);
        const hasCompletedConsultation = store.appointments.some((appointment) =>
          appointment.serviceId === "complimentary-consultation" &&
          appointment.client.email === email &&
          appointment.status === "completed" &&
          Date.parse(appointment.startAt) < Date.parse(hold.startAt)
        );
        if (service.requiresConsultation && !hasCompletedConsultation) {
          return sendJson(response, 409, {
            code: "CONSULTATION_REQUIRED",
            error: "Please book and complete a complimentary colour consultation before booking balayage."
          });
        }

        const appointment = {
          id: crypto.randomUUID(),
          serviceId: hold.serviceId,
          stylistId: hold.stylistId,
          startAt: hold.startAt,
          client: { name, email, phone },
          status: "confirmed",
          policyAcceptedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        store.appointments.push(appointment);
        store.holds = store.holds.filter((item) => item.id !== hold.id);
        save();
        return sendJson(response, 201, {
          id: appointment.id,
          service: store.services.find((item) => item.id === hold.serviceId).name,
          stylist: store.stylists.find((item) => item.id === hold.stylistId).name,
          startAt: appointment.startAt,
          status: appointment.status
        });
      });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(request, response)) return;
      if (request.method === "GET" && url.pathname === "/api/admin/bookings") {
        const appointments = [...store.appointments]
          .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
          .map((appointment) => ({
            ...appointment,
            service: store.services.find((item) => item.id === appointment.serviceId)?.name || "Service",
            stylist: store.stylists.find((item) => item.id === appointment.stylistId)?.name || "Stylist"
          }));
        return sendJson(response, 200, appointments);
      }
      const statusMatch = url.pathname.match(/^\/api\/admin\/bookings\/([0-9a-f-]+)\/status$/i);
      if (request.method === "PATCH" && statusMatch) {
        const body = await readBody(request);
        const validStatuses = ["confirmed", "checked-in", "completed", "cancelled", "no-show"];
        return enqueue(() => {
          const appointment = store.appointments.find((item) => item.id === statusMatch[1]);
          if (!appointment) return sendJson(response, 404, { error: "Appointment not found." });
          if (!validStatuses.includes(body.status)) return sendJson(response, 400, { error: "Choose a valid appointment status." });
          appointment.status = body.status;
          appointment.updatedAt = new Date().toISOString();
          save();
          return sendJson(response, 200, { id: appointment.id, status: appointment.status });
        });
      }
    }
    return sendJson(response, 404, { error: "Not found." });
  }

  function serveStatic(request, response, pathname) {
    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(requestedPath);
    } catch {
      return sendJson(response, 400, { error: "Invalid path." });
    }
    const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
    if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return sendJson(response, 404, { error: "Not found." });
    }
    const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "cache-control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin"
    });
    fs.createReadStream(filePath).pipe(response);
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
      else if (request.method === "GET") {
        if (url.pathname === "/admin" || url.pathname === "/admin/") {
          return serveStatic(request, response, "/admin.html");
        }
        return serveStatic(request, response, url.pathname);
      } else sendJson(response, 405, { error: "Method not allowed." });
    } catch (error) {
      if (!response.headersSent) sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : "The request could not be completed." });
      else response.destroy(error);
      if (!error.statusCode) console.error("Request failed:", error);
    }
  });
  const cleanupTimer = setInterval(() => enqueue(() => expireHolds()).catch((error) => console.error("Hold cleanup failed:", error)), HOLD_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
  server.on("close", () => clearInterval(cleanupTimer));
  return server;
}

if (require.main === module) {
  const server = createSalonServer();
  server.listen(PORT, () => {
    console.log(`Luma Studio is listening at http://localhost:${PORT}`);
    if (!process.env.SALON_ADMIN_KEY) console.warn("Set SALON_ADMIN_KEY to enable the protected admin dashboard.");
  });
}

module.exports = { createSalonServer };
