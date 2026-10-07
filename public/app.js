const dialog = document.querySelector("#booking-dialog");
const bookingContent = document.querySelector("#booking-content");
const toast = document.querySelector("#toast");
const booking = { serviceId: "", stylistId: "", date: "", startAt: "", holdId: "" };
let services = [];
let stylists = [];
let salon = null;
let slotRequest = 0;
let toastTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "Something went wrong. Please try again.");
    error.code = body.code;
    throw error;
  }
  return body;
}

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function formatServicePrice(service) {
  if (!service.price) return "Free";
  return `${service.priceFrom ? "From " : ""}${formatPrice(service.price)}`;
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(isoString));
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dayKeyAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function serviceById(id) {
  return services.find((service) => service.id === id);
}

function stylistById(id) {
  return stylists.find((stylist) => stylist.id === id);
}

function renderServices() {
  const groups = new Map();
  for (const service of services) {
    if (!groups.has(service.category)) groups.set(service.category, []);
    groups.get(service.category).push(service);
  }
  document.querySelector("#services-list").innerHTML = [...groups.entries()].map(([category, items], groupIndex) => `
    <div class="service-group">
      <h3><span aria-hidden="true">0${groupIndex + 1}</span> ${escapeHtml(category)}</h3>
      ${items.map((service) => `
        <article class="service-card">
          <div class="service-card-head">
            <h4>${escapeHtml(service.name)}</h4>
            <span class="service-price">${formatServicePrice(service)}</span>
          </div>
          <p>${escapeHtml(service.description)}</p>
          <div class="service-card-foot">
            <span class="service-duration">${service.durationMinutes} min</span>
            <button class="service-book" type="button" aria-label="${service.requiresConsultation ? "Book a consultation for" : "Book"} ${escapeHtml(service.name)}" data-book-service="${escapeHtml(service.requiresConsultation ? "complimentary-consultation" : service.id)}">${service.requiresConsultation ? "Book a consult" : "Book"}</button>
          </div>
        </article>
      `).join("")}
    </div>
  `).join("");
}

function renderStylists() {
  document.querySelector("#stylists-list").innerHTML = stylists.map((stylist) => `
    <article class="stylist-card">
      <div class="photo-frame stylist-photo-frame"><img src="${escapeHtml(stylist.image)}" alt="Portrait of ${escapeHtml(stylist.name)}" loading="lazy"></div>
      <div class="stylist-info">
        <span class="stylist-level">${escapeHtml(stylist.level)}</span>
        <h3>${escapeHtml(stylist.name)}</h3>
        <span class="stylist-specialties">${escapeHtml(stylist.specialties)}</span>
        <button class="button button-light button-small stylist-book-button" type="button" aria-label="Book with ${escapeHtml(stylist.name)}" data-book-stylist="${escapeHtml(stylist.id)}">Book with ${escapeHtml(stylist.name.split(" ")[0])}</button>
      </div>
    </article>
  `).join("");
}

function renderHours() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  document.querySelector("#hours-list").innerHTML = salon.hours.map((entry) => `
    <li class="${entry.day === today ? "today" : ""}"><span>${escapeHtml(entry.day)}</span><span>${escapeHtml(entry.hours)}</span></li>
  `).join("");
}

function renderServiceOptions() {
  return `<option value="">Choose a service</option>${services.map((service) => `
    <option value="${escapeHtml(service.id)}" ${booking.serviceId === service.id ? "selected" : ""}>${escapeHtml(service.name)} · ${formatServicePrice(service)} · ${service.durationMinutes} min</option>
  `).join("")}`;
}

function renderStylistOptions() {
  const eligible = stylists.filter((stylist) => !booking.serviceId || stylist.serviceIds?.includes(booking.serviceId));
  return `<option value="">Choose a stylist</option><option value="any" ${booking.stylistId === "any" ? "selected" : ""}>First available</option>${eligible.map((stylist) => `
    <option value="${escapeHtml(stylist.id)}" ${booking.stylistId === stylist.id ? "selected" : ""}>${escapeHtml(stylist.name)} · ${escapeHtml(stylist.level)}</option>
  `).join("")}`;
}

function renderStepOne(error = "") {
  bookingContent.innerHTML = `
    <h2 id="booking-heading">Let’s find <em>your chair.</em></h2>
    <p class="booking-subtitle">Good things start with a good conversation. Choose your service, your person and the day that works for you.</p>
    <div class="booking-field"><label class="booking-label" for="booking-service">01 · YOUR SERVICE</label><select class="booking-select" id="booking-service" required>${renderServiceOptions()}</select></div>
    <div class="booking-fields-row">
      <div class="booking-field"><label class="booking-label" for="booking-stylist">02 · YOUR PERSON</label><select class="booking-select" id="booking-stylist" required>${renderStylistOptions()}</select></div>
      <div class="booking-field"><label class="booking-label" for="booking-date">03 · YOUR DAY</label><input class="booking-input" id="booking-date" type="date" min="${todayKey()}" max="${dayKeyAfter(60)}" value="${escapeHtml(booking.date || todayKey())}" required></div>
    </div>
    <div class="booking-field"><span class="booking-label">04 · A TIME THAT WORKS</span><div class="slot-list" id="slot-list"><span class="empty-slots">Choose a service and stylist to see available times.</span></div></div>
    <p class="form-error" role="alert">${escapeHtml(error)}</p>
  `;
  document.querySelector("#booking-service").addEventListener("change", (event) => {
    booking.serviceId = event.target.value;
    if (!stylistById(booking.stylistId)?.serviceIds?.includes(booking.serviceId)) booking.stylistId = "";
    loadAvailability();
  });
  document.querySelector("#booking-stylist").addEventListener("change", (event) => {
    booking.stylistId = event.target.value;
    loadAvailability();
  });
  document.querySelector("#booking-date").addEventListener("change", (event) => {
    booking.date = event.target.value;
    loadAvailability();
  });
  if (booking.serviceId && booking.stylistId && booking.date) loadAvailability();
}

async function loadAvailability() {
  const requestNumber = ++slotRequest;
  const list = document.querySelector("#slot-list");
  if (!list) return;
  if (!booking.serviceId || !booking.stylistId || !booking.date) {
    list.innerHTML = '<span class="empty-slots">Choose a service, stylist and date to see available times.</span>';
    return;
  }
  if (serviceById(booking.serviceId)?.requiresConsultation) {
    list.innerHTML = '<span class="empty-slots">Let’s talk colour first. Balayage is booked after a complimentary consultation.</span><button class="service-book" id="book-consultation" type="button">Book your free consultation</button>';
    document.querySelector("#book-consultation").addEventListener("click", () => {
      booking.serviceId = "complimentary-consultation";
      booking.stylistId = "";
      renderStepOne();
    });
    return;
  }
  list.innerHTML = '<span class="empty-slots">Finding a little time for you…</span>';
  try {
    const query = new URLSearchParams({ date: booking.date, serviceId: booking.serviceId, stylistId: booking.stylistId });
    let slots;
    if (booking.stylistId === "any") {
      const results = await Promise.all(stylists.filter((stylist) => stylist.serviceIds?.includes(booking.serviceId)).map(async (stylist) => ({
        stylistId: stylist.id,
        slots: await api(`/api/availability?${new URLSearchParams({ date: booking.date, serviceId: booking.serviceId, stylistId: stylist.id })}`)
      })));
      slots = results.flatMap((result) => result.slots.map((startAt) => ({ startAt, stylistId: result.stylistId })))
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    } else {
      slots = (await api(`/api/availability?${query}`)).map((startAt) => ({ startAt, stylistId: booking.stylistId }));
    }
    if (requestNumber !== slotRequest || !document.querySelector("#slot-list")) return;
    list.innerHTML = slots.length
      ? slots.slice(0, 18).map((slot) => `<button class="slot-button" type="button" data-slot="${escapeHtml(slot.startAt)}" data-stylist="${escapeHtml(slot.stylistId)}">${formatTime(slot.startAt)}</button>`).join("")
      : '<span class="empty-slots">No openings on this day. Try another date and we’ll find you a good one.</span>';
    if (booking.stylistId === "any" && slots.length) {
      document.querySelectorAll(".slot-button").forEach((button) => {
        const stylist = stylistById(button.dataset.stylist);
        button.title = stylist ? `With ${stylist.name}` : "";
        if (stylist) button.textContent = `${formatTime(button.dataset.slot)} · ${stylist.name.split(" ")[0]}`;
      });
    }
  } catch (error) {
    if (requestNumber === slotRequest && document.querySelector("#slot-list")) {
      list.innerHTML = `<span class="empty-slots">${escapeHtml(error.message)}</span>`;
    }
  }
}

function showClientForm(error = "") {
  const service = serviceById(booking.serviceId);
  const stylist = stylistById(booking.stylistId);
  bookingContent.innerHTML = `
    <h2 id="booking-heading">Almost <em>there.</em></h2>
    <p class="booking-subtitle">Let us know who to look out for. We’ll keep your time aside for five minutes.</p>
    <div class="booking-summary"><strong>${escapeHtml(service.name)}</strong> · ${formatServicePrice(service)} · ${service.durationMinutes} min<br>${escapeHtml(stylist.name)} · ${escapeHtml(formatLongDate(booking.date))} at ${formatTime(booking.startAt)}<br><span>Your time is held for five minutes.</span></div>
    <form id="client-form" novalidate>
      <div class="booking-field"><label class="booking-label" for="client-name">YOUR NAME</label><input class="booking-input" id="client-name" name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="How should we greet you?"></div>
      <div class="booking-fields-row">
        <div class="booking-field"><label class="booking-label" for="client-email">EMAIL</label><input class="booking-input" id="client-email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"></div>
        <div class="booking-field"><label class="booking-label" for="client-phone">PHONE</label><input class="booking-input" id="client-phone" name="phone" type="tel" autocomplete="tel" required pattern="[+()0-9 .-]{7,25}" placeholder="(555) 555-0123"></div>
      </div>
      <p class="policy-note">To keep your chair just for you, please give us 24 hours’ notice if your plans change. Late cancellations and missed appointments may be charged. We’ll confirm the details before any payment is collected.</p>
      <label class="policy-check"><input name="acceptedPolicy" type="checkbox" required><span>I’ve read and agree to the booking and cancellation policy.</span></label>
      <p class="form-error" role="alert">${escapeHtml(error)}</p>
      <div class="booking-actions"><button class="button button-outline" type="button" id="booking-back">Back</button><button class="button button-dark" type="submit">Confirm my visit</button></div>
    </form>
  `;
  document.querySelector("#booking-back").addEventListener("click", () => renderStepOne());
  document.querySelector("#client-form").addEventListener("submit", submitBooking);
}

async function submitBooking(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = form.querySelector(".form-error");
  const button = form.querySelector('[type="submit"]');
  const formData = new FormData(form);
  const name = String(formData.get("name")).trim();
  const email = String(formData.get("email")).trim();
  const phone = String(formData.get("phone")).trim();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[+()\d\s.-]{7,25}$/.test(phone) || !formData.get("acceptedPolicy")) {
    errorBox.textContent = "Please enter your name, a valid email and phone, and accept the booking policy.";
    return;
  }
  button.disabled = true;
  button.textContent = "Saving your chair…";
  try {
    const confirmed = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ holdId: booking.holdId, name, email, phone, acceptedPolicy: true })
    });
    const service = serviceById(booking.serviceId);
    bookingContent.innerHTML = `
      <div class="success-mark" aria-hidden="true">✳</div>
      <h2 id="booking-heading">It’s a <em>date.</em></h2>
      <p class="booking-subtitle">Your chair is saved. We can’t wait to see you.</p>
      <div class="booking-summary"><strong>${escapeHtml(confirmed.service)}</strong><br>${escapeHtml(confirmed.stylist)} · ${escapeHtml(formatLongDate(booking.date))} at ${formatTime(confirmed.startAt)}<br>${formatServicePrice(service)} · Confirmation ${escapeHtml(confirmed.id.slice(0, 8).toUpperCase())}</div>
      <p class="booking-subtitle">We’ve saved your booking. For this demo, confirmations are shown here only—connect an email or SMS provider to send a message.</p>
      <button class="button button-dark" type="button" id="booking-done">Lovely, see you there</button>
    `;
    document.querySelector("#booking-done").addEventListener("click", () => dialog.close());
    booking.holdId = "";
  } catch (error) {
    if (error.code === "CONSULTATION_REQUIRED") {
      errorBox.textContent = `${error.message} `;
      const consultationButton = document.createElement("button");
      consultationButton.className = "service-book";
      consultationButton.type = "button";
      consultationButton.textContent = "Book a complimentary consultation";
      consultationButton.addEventListener("click", () => {
        booking.serviceId = "complimentary-consultation";
        booking.stylistId = "";
        renderStepOne();
      });
      errorBox.append(consultationButton);
      button.disabled = false;
      button.textContent = "Try again";
      return;
    }
    errorBox.textContent = error.message;
    button.disabled = false;
    button.textContent = "Try again";
    if (error.message.includes("hold expired")) renderStepOne(error.message);
  }
}

async function chooseSlot(startAt, stylistId, button) {
  const errorBox = document.querySelector(".form-error");
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Holding…";
  try {
    const hold = await api("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: booking.serviceId, stylistId, startAt })
    });
    booking.startAt = startAt;
    booking.stylistId = stylistId;
    booking.holdId = hold.id;
    showClientForm();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message;
    button.disabled = false;
    button.textContent = label;
    if (error.message.includes("just booked")) loadAvailability();
  }
}

function openBooking(selection = {}) {
  booking.serviceId = selection.serviceId || "";
  booking.stylistId = selection.stylistId || "";
  booking.date = todayKey();
  booking.startAt = "";
  booking.holdId = "";
  renderStepOne();
  dialog.showModal();
}

document.addEventListener("click", (event) => {
  const bookButton = event.target.closest("[data-book]");
  if (bookButton) openBooking();
  const serviceButton = event.target.closest("[data-book-service]");
  if (serviceButton) openBooking({ serviceId: serviceButton.dataset.bookService });
  const stylistButton = event.target.closest("[data-book-stylist]");
  if (stylistButton) openBooking({ stylistId: stylistButton.dataset.bookStylist });
  const slotButton = event.target.closest("[data-slot]");
  if (slotButton) chooseSlot(slotButton.dataset.slot, slotButton.dataset.stylist, slotButton);
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

const menuToggle = document.querySelector(".menu-toggle");
function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  document.querySelector(".main-nav").classList.toggle("open", isOpen);
}
menuToggle.addEventListener("click", () => setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true"));
document.querySelectorAll(".main-nav a, .main-nav button").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

async function initialise() {
  setupScrollAnimations();
  try {
    [salon, services, stylists] = await Promise.all([
      api("/api/salon"),
      api("/api/services"),
      api("/api/stylists")
    ]);
    renderServices();
    renderStylists();
    renderHours();
    setupScrollAnimations();
  } catch (error) {
    showToast(`The studio details could not load: ${error.message}`);
  }
}

let revealObserver;
function setupScrollAnimations() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.reveal = "visible";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    document.documentElement.classList.add("motion-ready");
  }

  const selectors = [
    ".hero-copy > *", ".hero-visual", ".intro > *", ".section-heading > *",
    ".service-group", ".services-cta", ".team-intro-copy > *", ".team-feature-image",
    ".stylist-card", ".gallery-heading > *", ".gallery-grid figure", ".quote-section > *",
    ".visit-section > *", ".footer-main > *"
  ];
  let index = 0;
  for (const target of document.querySelectorAll(selectors.join(","))) {
    if (target.dataset.reveal) continue;
    target.dataset.reveal = "pending";
    target.style.setProperty("--reveal-delay", `${Math.min(index++, 4) * 70}ms`);
    revealObserver.observe(target);
  }
}

initialise();
