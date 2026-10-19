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

let currentServiceFilter = "all";

function renderServices() {
  const groups = new Map();
  for (const service of services) {
    if (currentServiceFilter !== "all" && service.category !== currentServiceFilter) continue;
    if (!groups.has(service.category)) groups.set(service.category, []);
    groups.get(service.category).push(service);
  }
  const servicesList = document.querySelector("#services-list");
  if (!servicesList) return;

  if (groups.size === 0) {
    servicesList.innerHTML = `<p class="loading-note">No services found in this category.</p>`;
    return;
  }

  servicesList.innerHTML = [...groups.entries()].map(([category, items], groupIndex) => `
    <div class="service-group" data-3d-card="true">
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
  init3DCardTilt();
}

function initServicesFilter() {
  const filterButtons = document.querySelectorAll(".service-filter-btn");
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentServiceFilter = btn.dataset.filter || "all";
      renderServices();
    });
  });
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
  init3DCardTilt();
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

function animateBookingStep() {
  if (!bookingContent) return;
  bookingContent.classList.remove("booking-step-entering");
  void bookingContent.offsetWidth;
  bookingContent.classList.add("booking-step-entering");
}

function renderStepOne(error = "") {
  animateBookingStep();
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
  animateBookingStep();
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
function generateGoogleCalendarUrl({ title, details, location, startAt, durationMinutes }) {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const formatIsoForGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const dates = `${formatIsoForGCal(start)}/${formatIsoForGCal(end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
}

function downloadIcsFile({ title, details, location, startAt, durationMinutes, confirmationId }) {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const formatIcsDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Luma Studio//Salon Appointment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:luma-${confirmationId}@lumastudio.example`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `luma-appointment-${confirmationId.slice(0, 8)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
    animateBookingStep();
    const shortCode = confirmed.id.slice(0, 8).toUpperCase();
    const gcalUrl = generateGoogleCalendarUrl({
      title: `${confirmed.service} · Luma Studio`,
      details: `Your appointment for ${confirmed.service} with ${confirmed.stylist}.\nConfirmation code: ${shortCode}\nLocation: 214 Bedford Ave, Brooklyn, NY 11211\nPhone: (718) 555-0142`,
      location: "214 Bedford Avenue, Brooklyn, NY 11211",
      startAt: confirmed.startAt,
      durationMinutes: service?.durationMinutes || 60
    });
    bookingContent.innerHTML = `
      <div class="success-mark three-d-asterisk" aria-hidden="true">✳</div>
      <h2 id="booking-heading">It’s a <em>date.</em></h2>
      <p class="booking-subtitle">Your chair is reserved. We can’t wait to welcome you.</p>
      <div class="booking-summary" data-3d-card="true">
        <div class="booking-summary-header">
          <strong>${escapeHtml(confirmed.service)}</strong>
          <span class="confirmation-pill">Code: <code>${escapeHtml(shortCode)}</code></span>
        </div>
        <p class="booking-summary-meta">
          <span>${escapeHtml(confirmed.stylist)}</span> · <span>${escapeHtml(formatLongDate(booking.date))} at ${formatTime(confirmed.startAt)}</span><br>
          <span>${formatServicePrice(service)} · ${service?.durationMinutes || 60} min</span>
        </p>
      </div>
      <div class="booking-calendar-actions">
        <a class="button button-outline button-small" href="${escapeHtml(gcalUrl)}" target="_blank" rel="noopener noreferrer">📅 Add to Google Calendar</a>
        <button class="button button-outline button-small" type="button" id="btn-download-ics">📥 Download .ics</button>
      </div>
      <div class="booking-actions">
        <button class="button button-dark" type="button" id="booking-done">Lovely, see you there</button>
      </div>
    `;
    document.querySelector("#btn-download-ics")?.addEventListener("click", () => {
      downloadIcsFile({
        title: `${confirmed.service} · Luma Studio`,
        details: `Your appointment for ${confirmed.service} with ${confirmed.stylist}. Confirmation: ${shortCode}`,
        location: "214 Bedford Avenue, Brooklyn, NY 11211",
        startAt: confirmed.startAt,
        durationMinutes: service?.durationMinutes || 60,
        confirmationId: confirmed.id
      });
      showToast("Calendar event downloaded (.ics)");
    });
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
  initThemeToggle();
  setupHeaderScroll();
  setupScrollAnimations();
  setupScrollPerspective();
  setupScrollProgress();
  initHero3D();
  initTransformationSlider();
  initServicesFilter();
  initHairQuiz();
  initReviewsCarousel();
  init3DCardTilt();
  try {
    [salon, services, stylists] = await Promise.all([
      api("/api/salon"),
      api("/api/services"),
      api("/api/stylists")
    ]);
    renderServices();
    renderStylists();
    renderHours();
    initHairQuiz();
    setupScrollAnimations();
    setupScrollPerspective();
    init3DCardTilt();
  } catch (error) {
    showToast(`The studio details could not load: ${error.message}`);
  }
}

function setupHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const onScroll = () => {
    if (window.scrollY > 24) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function setupScrollProgress() {
  const bar = document.querySelector("#scroll-progress");
  if (!bar) return;
  const updateProgress = () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight <= 0) {
      bar.style.width = "0%";
      return;
    }
    const progress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
    bar.style.width = `${progress}%`;
  };
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  updateProgress();
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
    }, { threshold: 0.1, rootMargin: "0px 0px -4% 0px" });
    document.documentElement.classList.add("motion-ready");
  }

  const selectors = [
    ".hero-copy > *", ".hero-visual", ".intro > *", ".pillar-card", ".section-heading > *",
    ".services-filter-bar", ".service-group", ".services-cta-wrap", ".team-intro-copy > *", ".team-feature-image",
    ".stylist-card", ".gallery-heading > *", ".transformation-card", ".gallery-grid figure", ".quote-section > *",
    ".visit-section > *", ".footer-main > *"
  ];
  let index = 0;
  for (const target of document.querySelectorAll(selectors.join(","))) {
    if (target.dataset.reveal) continue;
    target.dataset.reveal = "pending";
    target.style.setProperty("--reveal-delay", `${Math.min(index++, 5) * 65}ms`);
    revealObserver.observe(target);
  }
}

function setupScrollPerspective() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const sections = document.querySelectorAll("section:not(.hero)");
  if (!sections.length) return;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const windowH = window.innerHeight;
      sections.forEach((sec) => {
        const rect = sec.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > windowH + 100) return;
        const center = rect.top + rect.height * 0.5;
        const factor = (center - windowH * 0.5) / (windowH * 0.5);
        const pitch = Math.max(-2.6, Math.min(2.6, factor * 2.8));
        const zShift = Math.max(-10, (1 - Math.abs(factor)) * 8);
        sec.style.setProperty("--scroll-pitch", `${pitch.toFixed(2)}deg`);
        sec.style.setProperty("--scroll-z", `${zShift.toFixed(1)}px`);
      });
      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ============================================================
   Luma Signature 3D Professional Hair Dryer (Three.js WebGL)
   ============================================================ */
let hero3DController = null;

function initHero3D() {
  const canvas = document.querySelector("#hero-3d-canvas");
  const stage = document.querySelector("#stage-3d");
  const fallback = document.querySelector("#hero-3d-fallback");
  if (!canvas || !stage) return;

  function showFallbackVisual() {
    if (fallback) fallback.classList.add("visible");
    if (canvas) canvas.style.display = "none";
    const badge = document.querySelector(".stage-3d-badge");
    if (badge) {
      badge.innerHTML = '<span class="badge-dot"></span><span>Luma Studio · Salon Experience</span>';
    }
  }

  if (typeof THREE === "undefined") {
    setTimeout(initHero3D, 80);
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    if (!renderer.getContext()) {
      showFallbackVisual();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth || 400, canvas.clientHeight || 400, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, (canvas.clientWidth || 1) / (canvas.clientHeight || 1), 0.1, 100);
    camera.position.set(0, 0.3, 5.8);

    // Root container
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Levitation group (sine-wave float)
    const levitationGroup = new THREE.Group();
    masterGroup.add(levitationGroup);

    // Model group for loaded model or fallback
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, -0.15, 0);
    levitationGroup.add(chairGroup);

    /* ------------------------------------------------------------
       Soft Pastel Lighting System
       ------------------------------------------------------------ */
    // 1. Warm ambient creamy peach
    const ambientLight = new THREE.AmbientLight(0xfff5ee, 1.25);
    scene.add(ambientLight);

    // 2. Key light with warm champagne highlights
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.6);
    keyLight.position.set(4, 5, 4.5);
    scene.add(keyLight);

    // 3. Gentle rim light in soft rose-blush tone
    const rimLight = new THREE.DirectionalLight(0xf2c8be, 1.4);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // 4. Subtle fill light in soft sage
    const fillLight = new THREE.DirectionalLight(0xe5ede0, 0.7);
    fillLight.position.set(0, -3, 3);
    scene.add(fillLight);

    // 5. Dynamic cursor point light for pearlescent glow
    const cursorLight = new THREE.PointLight(0xffecd9, 1.6, 10);
    cursorLight.position.set(0, 0.5, 3.2);
    scene.add(cursorLight);

    /* ------------------------------------------------------------
       Soft Contact Shadow Plane
       ------------------------------------------------------------ */
    function createContactShadowTexture() {
      const size = 256;
      const cvs = document.createElement("canvas");
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext("2d");
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(50, 42, 38, 0.45)");
      gradient.addColorStop(0.35, "rgba(75, 60, 52, 0.22)");
      gradient.addColorStop(0.7, "rgba(120, 100, 90, 0.06)");
      gradient.addColorStop(1, "rgba(120, 100, 90, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(cvs);
      return texture;
    }

    const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -1.52;
    masterGroup.add(contactShadow);

    /* ------------------------------------------------------------
       Finish / Tone Colors (Cream, Blush, Sage)
       ------------------------------------------------------------ */
    const finishThemes = {
      champagne: {
        leatherColor: 0xf6f0e7,
        leatherRough: 0.48,
        metalColor: 0xdfb778,
        metalRough: 0.18,
        pipingColor: 0xdfb778,
        particleTint: 0xdfb778
      },
      rosewood: {
        leatherColor: 0xe8cfc7,
        leatherRough: 0.52,
        metalColor: 0xdfa698,
        metalRough: 0.2,
        pipingColor: 0xc48b7e,
        particleTint: 0xf2c8be
      },
      sage: {
        leatherColor: 0xd7e0ce,
        leatherRough: 0.5,
        metalColor: 0xc5b288,
        metalRough: 0.22,
        pipingColor: 0x8a9779,
        particleTint: 0xb2bea0
      }
    };
    let currentFinish = "champagne";

    // Track dynamic materials for tone switching
    const upholsteryMaterials = [];
    const metalMaterials = [];

    function applyFinish(finishName) {
      const theme = finishThemes[finishName] || finishThemes.champagne;
      currentFinish = finishName;

      upholsteryMaterials.forEach(mat => {
        if (mat) {
          mat.color.setHex(theme.leatherColor);
          if (mat.roughness !== undefined) mat.roughness = theme.leatherRough;
        }
      });
      metalMaterials.forEach(mat => {
        if (mat) {
          mat.color.setHex(theme.metalColor);
          if (mat.roughness !== undefined) mat.roughness = theme.metalRough;
        }
      });
    }

    /* ------------------------------------------------------------
       Procedural Luxury Salon Chair (Graceful Fallback & Native 3D)
       ------------------------------------------------------------ */
    function buildProceduralSalonChair() {
      const proceduralGroup = new THREE.Group();

      const theme = finishThemes[currentFinish];

      const leatherMat = new THREE.MeshPhysicalMaterial({
        color: theme.leatherColor,
        roughness: theme.leatherRough,
        metalness: 0.05,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
        reflectivity: 0.4
      });
      upholsteryMaterials.push(leatherMat);

      const metalMat = new THREE.MeshPhysicalMaterial({
        color: theme.metalColor,
        metalness: 0.92,
        roughness: theme.metalRough,
        clearcoat: 0.55,
        clearcoatRoughness: 0.15
      });
      metalMaterials.push(metalMat);

      const darkAccentMat = new THREE.MeshStandardMaterial({
        color: 0x3a3632,
        roughness: 0.4,
        metalness: 0.3
      });

      // 1. Circular Disc Base (Heavy beveled hydraulic pedestal)
      const baseGeo = new THREE.CylinderGeometry(1.08, 1.12, 0.06, 48);
      const baseMesh = new THREE.Mesh(baseGeo, metalMat);
      baseMesh.position.y = -1.25;
      proceduralGroup.add(baseMesh);

      const baseRimGeo = new THREE.TorusGeometry(1.09, 0.025, 16, 48);
      const baseRim = new THREE.Mesh(baseRimGeo, darkAccentMat);
      baseRim.rotation.x = Math.PI / 2;
      baseRim.position.y = -1.27;
      proceduralGroup.add(baseRim);

      // 2. Hydraulic Column (Polished multi-stage piston)
      const columnGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.72, 32);
      const column = new THREE.Mesh(columnGeo, metalMat);
      column.position.y = -0.88;
      proceduralGroup.add(column);

      const collarGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 32);
      const collar = new THREE.Mesh(collarGeo, metalMat);
      collar.position.y = -1.18;
      proceduralGroup.add(collar);

      // 3. Hydraulic Pump Foot Pedal
      const pedalLeverGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 16);
      const pedalLever = new THREE.Mesh(pedalLeverGeo, metalMat);
      pedalLever.rotation.z = Math.PI / 3;
      pedalLever.position.set(-0.25, -1.02, 0.22);
      proceduralGroup.add(pedalLever);

      const pedalPadGeo = new THREE.BoxGeometry(0.18, 0.04, 0.12);
      const pedalPad = new THREE.Mesh(pedalPadGeo, darkAccentMat);
      pedalPad.position.set(-0.52, -0.86, 0.22);
      proceduralGroup.add(pedalPad);

      // 4. Seat Under-Carriage Frame
      const frameGeo = new THREE.BoxGeometry(0.72, 0.07, 0.72);
      const frame = new THREE.Mesh(frameGeo, darkAccentMat);
      frame.position.y = -0.52;
      proceduralGroup.add(frame);

      // 5. Plush Cushioned Seat (Round beveled cushion)
      const seatGeo = new THREE.CylinderGeometry(0.88, 0.84, 0.24, 48);
      const seat = new THREE.Mesh(seatGeo, leatherMat);
      seat.position.y = -0.38;
      proceduralGroup.add(seat);

      // Seat piping accent ring
      const pipingGeo = new THREE.TorusGeometry(0.86, 0.022, 16, 48);
      const piping = new THREE.Mesh(pipingGeo, metalMat);
      piping.rotation.x = Math.PI / 2;
      piping.position.y = -0.38;
      proceduralGroup.add(piping);

      // 6. Ergonomic Curved Backrest
      const backRestGeo = new THREE.CylinderGeometry(0.84, 0.86, 0.88, 36, 1, false, Math.PI * 0.7, Math.PI * 0.6);
      const backrest = new THREE.Mesh(backRestGeo, leatherMat);
      backrest.position.set(0, 0.12, 0.05);
      backrest.rotation.y = -Math.PI;
      proceduralGroup.add(backrest);

      // Backrest rear metallic support spine
      const spineGeo = new THREE.BoxGeometry(0.12, 0.82, 0.06);
      const spine = new THREE.Mesh(spineGeo, metalMat);
      spine.position.set(0, 0.08, -0.78);
      proceduralGroup.add(spine);

      // 7. Padded Headrest
      const headrestGeo = new THREE.BoxGeometry(0.44, 0.22, 0.14);
      const headrest = new THREE.Mesh(headrestGeo, leatherMat);
      headrest.position.set(0, 0.68, -0.68);
      headrest.rotation.x = 0.12;
      proceduralGroup.add(headrest);

      const headrestBarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 16);
      const headrestBar = new THREE.Mesh(headrestBarGeo, metalMat);
      headrestBar.position.set(0, 0.54, -0.72);
      proceduralGroup.add(headrestBar);

      // 8. Luxury Metallic Armrests with Soft Top Pads
      [-1, 1].forEach(side => {
        // Metallic curved support
        const armPostGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.44, 16);
        const armPostFront = new THREE.Mesh(armPostGeo, metalMat);
        armPostFront.position.set(side * 0.84, -0.18, 0.28);
        proceduralGroup.add(armPostFront);

        const armPostBack = new THREE.Mesh(armPostGeo, metalMat);
        armPostBack.position.set(side * 0.84, -0.14, -0.32);
        proceduralGroup.add(armPostBack);

        // Curved armrest rail
        const armRailGeo = new THREE.BoxGeometry(0.11, 0.04, 0.74);
        const armRail = new THREE.Mesh(armRailGeo, metalMat);
        armRail.position.set(side * 0.84, 0.05, -0.02);
        proceduralGroup.add(armRail);

        // Padded leather arm cushion
        const armPadGeo = new THREE.BoxGeometry(0.13, 0.05, 0.62);
        const armPad = new THREE.Mesh(armPadGeo, leatherMat);
        armPad.position.set(side * 0.84, 0.08, -0.02);
        proceduralGroup.add(armPad);
      });

      // 9. Client Footrest Platform
      const footrestBarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.62, 16);
      const footrestBar1 = new THREE.Mesh(footrestBarGeo, metalMat);
      footrestBar1.rotation.x = Math.PI / 4;
      footrestBar1.position.set(-0.24, -0.68, 0.64);
      proceduralGroup.add(footrestBar1);

      const footrestBar2 = new THREE.Mesh(footrestBarGeo, metalMat);
      footrestBar2.rotation.x = Math.PI / 4;
      footrestBar2.position.set(0.24, -0.68, 0.64);
      proceduralGroup.add(footrestBar2);

      const footplateGeo = new THREE.BoxGeometry(0.68, 0.04, 0.28);
      const footplate = new THREE.Mesh(footplateGeo, metalMat);
      footplate.position.set(0, -0.88, 0.88);
      footplate.rotation.x = 0.12;
      proceduralGroup.add(footplate);

      return proceduralGroup;
    }

    // Default to procedural chair immediately so stage is never empty
    const fallbackChair = buildProceduralSalonChair();
    chairGroup.add(fallbackChair);

    /* ------------------------------------------------------------
       GLTF/GLB Loader from /models/salon_chair.glb
       ------------------------------------------------------------ */
    if (typeof THREE.GLTFLoader !== "undefined") {
      const loader = new THREE.GLTFLoader();
      loader.load(
        "/models/salon_chair.glb",
        gltf => {
          if (gltf && gltf.scene) {
            // Auto-center using bounding box and scale to fit stage
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetScale = 2.4 / (maxDim || 1);

            gltf.scene.scale.setScalar(targetScale);
            gltf.scene.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale);

            // Traverse meshes and enhance with soft pastel luxury materials
            gltf.scene.traverse(child => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                  // Classify by name or surface properties
                  const matName = (child.material.name || child.name || "").toLowerCase();
                  if (matName.includes("metal") || matName.includes("gold") || matName.includes("chrome") || matName.includes("base") || matName.includes("pedestal")) {
                    metalMaterials.push(child.material);
                  } else {
                    upholsteryMaterials.push(child.material);
                  }
                }
              }
            });

            // Replace procedural placeholder smoothly
            chairGroup.remove(fallbackChair);
            chairGroup.add(gltf.scene);

            const badge = document.querySelector(".stage-3d-badge");
            if (badge) {
              badge.innerHTML = '<span class="badge-dot"></span><span>Luma Studio · 3D Chair Loaded</span>';
            }
          }
        },
        undefined,
        err => {
          // Gracefully retain procedural salon chair fallback without disruption
          console.info("Using procedural 3D luxury salon chair:", err ? (err.message || "GLB not found") : "Ready");
        }
      );
    }

    /* ------------------------------------------------------------
       Floating Ethereal Ambient Particles
       ------------------------------------------------------------ */
    function createSoftParticleTexture() {
      const size = 64;
      const cvs = document.createElement("canvas");
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext("2d");
      const rad = size / 2;
      const grad = ctx.createRadialGradient(rad, rad, 0, rad, rad, rad);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.35, "rgba(255, 240, 230, 0.75)");
      grad.addColorStop(0.7, "rgba(223, 183, 120, 0.25)");
      grad.addColorStop(1, "rgba(223, 183, 120, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rad, rad, rad, 0, Math.PI * 2);
      ctx.fill();
      return new THREE.CanvasTexture(cvs);
    }

    const particleCount = 42;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleMeta = [];

    const pastelPalette = [
      new THREE.Color(0xf2c8be), // Rose quartz
      new THREE.Color(0xdfb778), // Champagne gold
      new THREE.Color(0xfff7f0), // Creamy peach
      new THREE.Color(0xb2bea0)  // Subtle sage
    ];

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const x = (Math.random() - 0.5) * 5.5;
      const y = (Math.random() - 0.5) * 4.2;
      const z = (Math.random() - 0.5) * 3.8;

      particlePos[idx] = x;
      particlePos[idx + 1] = y;
      particlePos[idx + 2] = z;

      const col = pastelPalette[i % pastelPalette.length];
      particleColors[idx] = col.r;
      particleColors[idx + 1] = col.g;
      particleColors[idx + 2] = col.b;

      particleMeta.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        speed: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        driftAmp: 0.25 + Math.random() * 0.35
      });
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      map: createSoftParticleTexture(),
      transparent: true,
      opacity: 0.72,
      vertexColors: true,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ------------------------------------------------------------
       Interactive Controls (Drag to Rotate, Damping, Auto-spin)
       ------------------------------------------------------------ */
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let targetRotationY = 0.4;
    let targetRotationX = 0.12;
    let autoSpin = true;
    let autoSpinSpeed = 0.005;
    let isHovered = false;
    let isVisible = true;
    let animationFrameId = null;

    // Hint banner management
    const hintElement = document.querySelector("#stage-3d-hint");
    function dismissHint() {
      if (hintElement && !hintElement.classList.contains("hidden")) {
        hintElement.classList.add("hidden");
      }
    }

    // Pointer events
    stage.addEventListener("pointerdown", e => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
      stage.style.cursor = "grabbing";
      dismissHint();
    });

    window.addEventListener("pointermove", e => {
      // Dynamic light tracking
      const rect = stage.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        isHovered = true;
        const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        cursorLight.position.x = normX * 3.0;
        cursorLight.position.y = normY * 2.2 + 0.3;
      } else {
        isHovered = false;
      }

      if (isDragging) {
        const deltaX = e.clientX - prevMousePos.x;
        const deltaY = e.clientY - prevMousePos.y;
        targetRotationY += deltaX * 0.008;
        targetRotationX += deltaY * 0.006;
        targetRotationX = Math.max(-0.45, Math.min(0.45, targetRotationX));
        prevMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener("pointerup", () => {
      if (isDragging) {
        isDragging = false;
        stage.style.cursor = "grab";
      }
    });

    // Mobile touch events
    stage.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        dismissHint();
      }
    }, { passive: true });

    stage.addEventListener("touchmove", e => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - prevMousePos.x;
        const deltaY = e.touches[0].clientY - prevMousePos.y;
        targetRotationY += deltaX * 0.009;
        targetRotationX += deltaY * 0.007;
        targetRotationX = Math.max(-0.45, Math.min(0.45, targetRotationX));
        prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    stage.addEventListener("touchend", () => {
      isDragging = false;
    });

    // Control buttons (Spin Toggle & Reset)
    const spinBtn = document.querySelector("#btn-spin-3d, #stage-spin-btn");
    if (spinBtn) {
      spinBtn.addEventListener("click", () => {
        autoSpin = !autoSpin;
        spinBtn.classList.toggle("active", autoSpin);
      });
    }

    const resetBtn = document.querySelector("#btn-reset-3d, #stage-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        targetRotationY = 0.4;
        targetRotationX = 0.12;
      });
    }

    // Tone Finish Buttons
    const tonePills = document.querySelectorAll(".tone-pill");
    tonePills.forEach(pill => {
      pill.addEventListener("click", () => {
        tonePills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const finish = pill.dataset.finish || pill.dataset.tone || "champagne";
        applyFinish(finish);
      });
    });

    // Resize handler
    function updateDimensions() {
      if (!canvas) return;
      const width = canvas.clientWidth || 400;
      const height = canvas.clientHeight || 400;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", updateDimensions);

    // IntersectionObserver for performance (Pause when offscreen)
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
      });
    }, { threshold: 0.05 });
    observer.observe(stage);

    /* ------------------------------------------------------------
       Render & Animation Loop
       ------------------------------------------------------------ */
    const clock = new THREE.Clock();

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Auto-spin when not dragging
      if (autoSpin && !isDragging) {
        targetRotationY += autoSpinSpeed;
      }

      // Smooth lerp damping
      masterGroup.rotation.y += (targetRotationY - masterGroup.rotation.y) * 0.06;
      masterGroup.rotation.x += (targetRotationX - masterGroup.rotation.x) * 0.06;

      // Soft Floating Levitation Physics (Sine-wave)
      const floatY = Math.sin(time * 1.5) * 0.07;
      levitationGroup.position.y = floatY;

      // Dynamic Contact Shadow pulsing with floating height
      contactShadow.scale.setScalar(1 - floatY * 0.45);
      contactShadow.material.opacity = 0.38 - floatY * 0.12;

      // Animate floating ambient particles
      if (particleGeo && particleGeo.attributes.position) {
        const posArr = particleGeo.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          const meta = particleMeta[i];
          posArr[idx + 1] = meta.baseY + Math.sin(time * meta.speed + meta.phase) * meta.driftAmp;
          posArr[idx] = meta.baseX + Math.cos(time * meta.speed * 0.7 + meta.phase) * (meta.driftAmp * 0.4);
          posArr[idx + 2] = meta.baseZ + Math.sin(time * meta.speed * 0.5 + meta.phase) * (meta.driftAmp * 0.4);
        }
        particleGeo.attributes.position.needsUpdate = true;
        particles.rotation.y = time * 0.018;
      }

      renderer.render(scene, camera);
    }

    animate();

    hero3DController = {
      resize: updateDimensions,
      resume: () => {
        isVisible = true;
        updateDimensions();
        if (!animationFrameId) animate();
      },
      pause: () => {
        isVisible = false;
      }
    };
  } catch (err) {
    console.warn("WebGL initialization note:", err);
    showFallbackVisual();
  }
}

/* ============================================================
   Interactive Before & After Hair Transformation Slider (Smooth Physics)
   ============================================================ */
function initTransformationSlider() {
  const stage = document.querySelector("#transformation-stage");
  const before = document.querySelector("#transformation-before");
  const handle = document.querySelector("#transformation-handle");
  if (!stage || !before || !handle) return;

  let isDragging = false;
  let targetPercent = 50;
  let currentPercent = 50;
  let rafId = null;

  const updateDisplay = () => {
    currentPercent += (targetPercent - currentPercent) * 0.20;
    before.style.width = `${currentPercent.toFixed(2)}%`;
    handle.style.left = `${currentPercent.toFixed(2)}%`;
    handle.setAttribute("aria-valuenow", Math.round(currentPercent));

    if (Math.abs(targetPercent - currentPercent) > 0.05 || isDragging) {
      rafId = requestAnimationFrame(updateDisplay);
    } else {
      currentPercent = targetPercent;
      before.style.width = `${currentPercent}%`;
      handle.style.left = `${currentPercent}%`;
      rafId = null;
    }
  };

  const scheduleUpdate = () => {
    if (!rafId) rafId = requestAnimationFrame(updateDisplay);
  };

  const setTarget = (percent) => {
    targetPercent = Math.max(0, Math.min(100, percent));
    scheduleUpdate();
  };

  const handlePointer = (e) => {
    const rect = stage.getBoundingClientRect();
    const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const x = clientX - rect.left;
    setTarget((x / rect.width) * 100);
  };

  const onPointerDown = (e) => {
    isDragging = true;
    stage.classList.add("is-dragging");
    handlePointer(e);
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    handlePointer(e);
  };

  const onPointerUp = () => {
    isDragging = false;
    stage.classList.remove("is-dragging");
  };

  stage.addEventListener("mouseenter", () => stage.classList.add("is-hovered"));
  stage.addEventListener("mouseleave", () => stage.classList.remove("is-hovered"));

  stage.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  stage.addEventListener("touchstart", onPointerDown, { passive: true });
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp, { passive: true });

  handle.addEventListener("keydown", (e) => {
    const current = parseFloat(handle.getAttribute("aria-valuenow") || 50);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      setTarget(current - 5);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      setTarget(current + 5);
      e.preventDefault();
    }
  });

  setTarget(50);
}

/* ============================================================
   Tactile 3D Card Tilt & Holographic Specular Glare System
   ============================================================ */
function init3DCardTilt() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const cards = document.querySelectorAll(
    "[data-3d-card], .service-card, .service-group, .pillar-card, .stylist-card, .gallery-grid figure, .visit-card"
  );

  cards.forEach((card) => {
    if (card._has3dTilt) return;
    card._has3dTilt = true;

    let glare = card.querySelector(".card-3d-glare");
    if (!glare) {
      glare = document.createElement("div");
      glare.className = "card-3d-glare";
      glare.setAttribute("aria-hidden", "true");
      card.appendChild(glare);
    }

    let rafId = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isHovered = false;

    const maxTilt = card.classList.contains("service-card") ? 7 : 10;

    const updateTilt = () => {
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;

      const rotateX = -currentY * maxTilt;
      const rotateY = currentX * maxTilt;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.025, 1.025, 1.025)`;

      const glareX = ((currentX + 0.5) * 100).toFixed(1);
      const glareY = ((currentY + 0.5) * 100).toFixed(1);
      glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.40) 0%, rgba(207, 168, 116, 0.18) 32%, rgba(255, 255, 255, 0) 68%)`;

      if (isHovered || Math.abs(targetX - currentX) > 0.004 || Math.abs(targetY - currentY) > 0.004) {
        rafId = requestAnimationFrame(updateTilt);
      } else {
        card.style.transform = "";
        rafId = null;
      }
    };

    card.addEventListener("mouseenter", () => {
      isHovered = true;
      if (!rafId) rafId = requestAnimationFrame(updateTilt);
    });

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      if (!rafId) rafId = requestAnimationFrame(updateTilt);
    });

    card.addEventListener("mouseleave", () => {
      isHovered = false;
      targetX = 0;
      targetY = 0;
      if (!rafId) rafId = requestAnimationFrame(updateTilt);
    });
  });
/* ============================================================
   Salon Lighting Ambiance Switcher (Daylight vs Evening Glow)
   ============================================================ */
function initThemeToggle() {
  const toggleBtn = document.querySelector("#theme-toggle");
  if (!toggleBtn) return;
  const root = document.documentElement;
  const icon = toggleBtn.querySelector(".theme-toggle-icon");
  const text = toggleBtn.querySelector(".theme-toggle-text");

  const savedTheme = localStorage.getItem("luma_theme") || "daylight";
  applyTheme(savedTheme, false);

  function applyTheme(theme, notify = true) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("luma_theme", theme);
    const isEvening = theme === "evening";
    if (icon) icon.textContent = isEvening ? "☀️" : "🌙";
    if (text) text.textContent = isEvening ? "Daylight" : "Evening Glow";
    toggleBtn.setAttribute("aria-label", isEvening ? "Switch to daylight studio mode" : "Switch to evening candlelight ambiance");
    toggleBtn.classList.toggle("is-evening", isEvening);

    // Update Three.js scene lighting if initialized
    if (window._lumaThreeStage) {
      window._lumaThreeStage.setAmbiance(theme);
    }

    if (notify) {
      showToast(isEvening ? "🌙 Evening candlelight ambiance active" : "☀️ Daylight studio mode active");
    }
  }

  toggleBtn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "daylight";
    const next = current === "daylight" ? "evening" : "daylight";
    applyTheme(next, true);
  });
}

/* ============================================================
   Interactive Hair Persona & Service Matcher Quiz
   ============================================================ */
let _quizInitialized = false;
function initHairQuiz() {
  const quizSection = document.querySelector("#quiz");
  if (!quizSection) return;

  const steps = quizSection.querySelectorAll(".quiz-step");
  const options = quizSection.querySelectorAll(".quiz-option");
  const backButtons = quizSection.querySelectorAll(".quiz-back-btn");
  const restartBtn = quizSection.querySelector("#quiz-restart-btn");
  const bookResultBtn = quizSection.querySelector("#quiz-book-result");

  const answers = { 1: "", 2: "", 3: "" };

  function showStep(stepNumber) {
    steps.forEach((s) => {
      s.classList.remove("active");
      if (s.dataset.step === String(stepNumber)) {
        s.classList.add("active");
      }
    });
    init3DCardTilt();
  }

  if (!_quizInitialized) {
    _quizInitialized = true;

    options.forEach((btn) => {
      btn.addEventListener("click", () => {
        const stepEl = btn.closest(".quiz-step");
        const currentStep = Number(stepEl.dataset.step);
        answers[currentStep] = btn.dataset.answer;

        stepEl.querySelectorAll(".quiz-option").forEach((opt) => opt.classList.remove("selected"));
        btn.classList.add("selected");

        setTimeout(() => {
          if (currentStep < 3) {
            showStep(currentStep + 1);
          } else {
            computeResult();
          }
        }, 180);
      });
    });

    backButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const stepEl = btn.closest(".quiz-step");
        const currentStep = Number(stepEl.dataset.step);
        if (currentStep > 1) {
          showStep(currentStep - 1);
        }
      });
    });

    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        answers[1] = "";
        answers[2] = "";
        answers[3] = "";
        options.forEach((opt) => opt.classList.remove("selected"));
        showStep(1);
      });
    }

    if (bookResultBtn) {
      bookResultBtn.addEventListener("click", () => {
        const serviceId = bookResultBtn.dataset.serviceId || "signature-cut";
        const stylistId = bookResultBtn.dataset.stylistId || "";
        openBooking({ serviceId, stylistId });
      });
    }
  }

  function computeResult() {
    let serviceId = "signature-cut";
    let title = "Signature Cut & Lived-in Blowout";
    let desc = "A precision tailored cut honoring your natural texture and growth pattern, styled with an effortless blowout.";
    let stylistId = "jules";

    if (answers[2] === "balayage" || (answers[1] === "colored" && answers[3] === "low")) {
      serviceId = "balayage";
      title = "Dimensional Balayage & Colour Consultation";
      desc = "Hand-painted, sun-kissed dimension tailored to grow out seamlessly with zero harsh lines. Includes a complimentary 20-min consultation.";
      stylistId = "maya";
    } else if (answers[2] === "repair" || answers[1] === "damaged") {
      serviceId = "deep-repair";
      title = "Deep Bond Repair Ritual";
      desc = "An intensive restorative bond-building treatment to restore elasticity, moisture balance, and radiant cuticle shine.";
      stylistId = "imani";
    } else if (answers[2] === "roots") {
      serviceId = "root-refresh";
      title = "Root Refresh & Nourishing Gloss";
      desc = "Seamless regrowth blending paired with a conditioning gloss treatment for high-shine color revitalization.";
      stylistId = "maya";
    } else if (answers[1] === "textured") {
      serviceId = "signature-cut";
      title = "Signature Texture Cut & Sculpt";
      desc = "Tailored dry or wet precision cut honoring your natural wave and curl patterns.";
      stylistId = "imani";
    }

    const matchedStylist = stylistById(stylistId) || stylists[0];
    const matchedService = serviceById(serviceId);

    const titleEl = document.querySelector("#quiz-result-title");
    const descEl = document.querySelector("#quiz-result-desc");
    const stylistCardEl = document.querySelector("#quiz-result-stylist");

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;

    if (bookResultBtn) {
      bookResultBtn.dataset.serviceId = serviceId;
      bookResultBtn.dataset.stylistId = stylistId;
    }

    if (stylistCardEl && matchedStylist) {
      stylistCardEl.innerHTML = `
        <div class="matched-stylist-media">
          <img src="${escapeHtml(matchedStylist.image)}" alt="${escapeHtml(matchedStylist.name)}" loading="lazy">
        </div>
        <div class="matched-stylist-details">
          <span class="matched-stylist-tag">RECOMMENDED ARTIST</span>
          <h4>${escapeHtml(matchedStylist.name)}</h4>
          <span class="matched-stylist-spec">${escapeHtml(matchedStylist.specialties)}</span>
          <p class="matched-pricing"><strong>${matchedService ? formatServicePrice(matchedService) : ""}</strong> · ${matchedService?.durationMinutes || 60} min</p>
        </div>
      `;
    }

    showStep("result");
  }
}

/* ============================================================
   Client Reviews & Testimonials Carousel
   ============================================================ */
function initReviewsCarousel() {
  const track = document.querySelector("#reviews-track");
  const cards = document.querySelectorAll(".review-card");
  const dots = document.querySelectorAll("#reviews-dots .dot");
  const prevBtn = document.querySelector("#reviews-prev");
  const nextBtn = document.querySelector("#reviews-next");
  if (!track || cards.length === 0) return;

  let currentIndex = 0;

  function updateCarousel(index) {
    if (index < 0) index = cards.length - 1;
    if (index >= cards.length) index = 0;
    currentIndex = index;

    cards.forEach((card, idx) => {
      card.classList.toggle("active", idx === currentIndex);
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === currentIndex);
      dot.setAttribute("aria-selected", idx === currentIndex ? "true" : "false");
    });
  }

  if (prevBtn) prevBtn.addEventListener("click", () => updateCarousel(currentIndex - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => updateCarousel(currentIndex + 1));

  dots.forEach((dot, idx) => {
    dot.addEventListener("click", () => updateCarousel(idx));
  });

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let timer = setInterval(() => {
      if (!track.matches(":hover")) {
        updateCarousel(currentIndex + 1);
      }
    }, 7000);
    track.addEventListener("mouseenter", () => clearInterval(timer));
  }
}

initialise();



