const dialog = document.querySelector("#booking-dialog");
const bookingContent = document.querySelector("#booking-content");
const toast = document.querySelector("#toast");
const booking = { serviceId: "", stylistId: "", date: "", startAt: "", holdId: "" };
const clientState = { name: "", email: "", phone: "", acceptedPolicy: false };
let services = [];
let stylists = [];
let salon = null;
let slotRequest = 0;
let toastTimer;
let isSubmittingBooking = false;
let isHoldingSlot = false;

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

function getServiceBadge(service) {
  if (service.requiresConsultation) return `<span class="service-tag tag-consult">Consultation Included</span>`;
  if (service.id === "balayage" || service.id === "signature-cut") return `<span class="service-tag tag-popular">Client Favorite</span>`;
  if (service.id === "gloss-treatment") return `<span class="service-tag tag-ritual">Botanical Ritual</span>`;
  return "";
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
        <article class="service-card" data-service-card="${escapeHtml(service.id)}">
          ${getServiceBadge(service)}
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
    <div class="booking-field">
      <label class="booking-label" for="booking-service">01 · YOUR SERVICE *</label>
      <select class="booking-select" id="booking-service" required>${renderServiceOptions()}</select>
      <span class="field-error" id="error-booking-service" role="alert"></span>
    </div>
    <div class="booking-fields-row">
      <div class="booking-field">
        <label class="booking-label" for="booking-stylist">02 · YOUR PERSON</label>
        <select class="booking-select" id="booking-stylist">${renderStylistOptions()}</select>
      </div>
      <div class="booking-field">
        <label class="booking-label" for="booking-date">03 · YOUR DAY *</label>
        <input class="booking-input" id="booking-date" type="date" min="${todayKey()}" max="${dayKeyAfter(60)}" value="${escapeHtml(booking.date || todayKey())}" required>
        <span class="field-error" id="error-booking-date" role="alert"></span>
      </div>
    </div>
    <div class="booking-field">
      <span class="booking-label">04 · A TIME THAT WORKS *</span>
      <div class="slot-list" id="slot-list"><span class="empty-slots">Choose a service and stylist to see available times.</span></div>
      <span class="field-error" id="error-booking-slot" role="alert"></span>
    </div>
    <p class="form-error" role="alert">${escapeHtml(error)}</p>
  `;

  const serviceSelect = document.querySelector("#booking-service");
  const serviceError = document.querySelector("#error-booking-service");
  serviceSelect.addEventListener("change", (event) => {
    booking.serviceId = event.target.value;
    if (booking.serviceId) {
      serviceSelect.classList.remove("has-error");
      serviceError.classList.remove("visible");
    }
    if (!stylistById(booking.stylistId)?.serviceIds?.includes(booking.serviceId)) booking.stylistId = "";
    loadAvailability();
  });

  document.querySelector("#booking-stylist").addEventListener("change", (event) => {
    booking.stylistId = event.target.value;
    loadAvailability();
  });

  const dateInput = document.querySelector("#booking-date");
  const dateError = document.querySelector("#error-booking-date");
  dateInput.addEventListener("change", (event) => {
    const val = event.target.value;
    const today = todayKey();
    if (!val) {
      dateError.textContent = "Please select an appointment date.";
      dateError.classList.add("visible");
      dateInput.classList.add("has-error");
      return;
    }
    if (val < today) {
      dateError.textContent = "Past dates cannot be selected. Please choose today or a future date.";
      dateError.classList.add("visible");
      dateInput.classList.add("has-error");
      const list = document.querySelector("#slot-list");
      if (list) list.innerHTML = '<span class="empty-slots">Past dates are not available. Please choose an upcoming date.</span>';
      return;
    }
    dateError.textContent = "";
    dateError.classList.remove("visible");
    dateInput.classList.remove("has-error");
    booking.date = val;
    loadAvailability();
  });

  const slotContainer = document.querySelector("#slot-list");
  slotContainer?.addEventListener("click", () => {
    if (!booking.serviceId) {
      serviceSelect.classList.add("has-error");
      serviceError.textContent = "Please select a service first to see available appointment slots.";
      serviceError.classList.add("visible");
      serviceSelect.focus();
    }
  });

  if (booking.serviceId && booking.date) loadAvailability();
}

async function loadAvailability() {
  const requestNumber = ++slotRequest;
  const list = document.querySelector("#slot-list");
  if (!list) return;
  if (!booking.serviceId) {
    list.innerHTML = '<span class="empty-slots">Please select a service first.</span>';
    return;
  }
  if (!booking.date) {
    list.innerHTML = '<span class="empty-slots">Please select a valid date.</span>';
    return;
  }
  if (booking.date < todayKey()) {
    list.innerHTML = '<span class="empty-slots">Past dates cannot be booked. Please choose today or later.</span>';
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
    const query = new URLSearchParams({ date: booking.date, serviceId: booking.serviceId, stylistId: booking.stylistId || "any" });
    let slots;
    if (!booking.stylistId || booking.stylistId === "any") {
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
    if ((!booking.stylistId || booking.stylistId === "any") && slots.length) {
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
    <p class="booking-subtitle">Let us know who to look out for. We’ll keep your chair held for five minutes.</p>
    <div class="booking-summary">
      <strong>${escapeHtml(service ? service.name : "Selected Service")}</strong> · ${service ? formatServicePrice(service) : ""} · ${service ? service.durationMinutes : 0} min<br>
      ${escapeHtml(stylist ? stylist.name : "First Available Stylist")} · ${escapeHtml(formatLongDate(booking.date))} at ${formatTime(booking.startAt)}<br>
      <span>Temporary slot hold active for 5 minutes.</span>
    </div>
    <form id="client-form" novalidate>
      <div class="booking-field">
        <label class="booking-label" for="client-name">YOUR NAME *</label>
        <input class="booking-input" id="client-name" name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="e.g. Maya Lin" value="${escapeHtml(clientState.name)}">
        <span class="field-error" id="error-client-name" role="alert"></span>
      </div>
      <div class="booking-fields-row">
        <div class="booking-field">
          <label class="booking-label" for="client-email">EMAIL ADDRESS *</label>
          <input class="booking-input" id="client-email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="name@example.com" value="${escapeHtml(clientState.email)}">
          <span class="field-error" id="error-client-email" role="alert"></span>
        </div>
        <div class="booking-field">
          <label class="booking-label" for="client-phone">PHONE NUMBER *</label>
          <input class="booking-input" id="client-phone" name="phone" type="tel" autocomplete="tel" required pattern="[+()0-9 .-]{7,25}" placeholder="(718) 555-0199" value="${escapeHtml(clientState.phone)}">
          <span class="field-error" id="error-client-phone" role="alert"></span>
        </div>
      </div>
      <p class="policy-note">To keep your chair just for you, please give us 24 hours’ notice if your plans change. Late cancellations and missed appointments may be charged. We’ll confirm the details before any payment is collected.</p>
      <div class="booking-field">
        <label class="policy-check" id="policy-container"><input id="client-policy" name="acceptedPolicy" type="checkbox" required ${clientState.acceptedPolicy ? "checked" : ""}><span>I’ve read and agree to the 24-hour booking and cancellation policy. *</span></label>
        <span class="field-error" id="error-client-policy" role="alert"></span>
      </div>
      <div class="form-error" role="alert">${escapeHtml(error)}</div>
      <div class="booking-actions">
        <button class="button button-outline" type="button" id="booking-back">Back</button>
        <button class="button button-dark" type="submit" id="btn-submit-booking">Confirm my visit</button>
      </div>
      <div class="demo-qa-bar" style="margin-top:16px;padding-top:10px;border-top:1px dashed var(--line);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">QA Verification:</span>
        <button type="button" id="btn-simulate-error" style="background:transparent;border:none;color:var(--error);font-size:12px;text-decoration:underline;cursor:pointer;">Simulate Backend Error (500)</button>
      </div>
    </form>
  `;

  const nameInput = document.querySelector("#client-name");
  const emailInput = document.querySelector("#client-email");
  const phoneInput = document.querySelector("#client-phone");
  const policyInput = document.querySelector("#client-policy");

  nameInput.addEventListener("input", (e) => {
    clientState.name = e.target.value;
    if (clientState.name.trim().length >= 2) {
      nameInput.classList.remove("has-error");
      document.querySelector("#error-client-name").classList.remove("visible");
    }
  });
  emailInput.addEventListener("input", (e) => {
    clientState.email = e.target.value;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientState.email.trim())) {
      emailInput.classList.remove("has-error");
      document.querySelector("#error-client-email").classList.remove("visible");
    }
  });
  phoneInput.addEventListener("input", (e) => {
    clientState.phone = e.target.value;
    if (/^[+()\d\s.-]{7,25}$/.test(clientState.phone.trim())) {
      phoneInput.classList.remove("has-error");
      document.querySelector("#error-client-phone").classList.remove("visible");
    }
  });
  policyInput.addEventListener("change", (e) => {
    clientState.acceptedPolicy = e.target.checked;
    if (clientState.acceptedPolicy) {
      document.querySelector("#policy-container").classList.remove("has-error");
      document.querySelector("#error-client-policy").classList.remove("visible");
    }
  });

  const simBtn = document.querySelector("#btn-simulate-error");
  if (simBtn) {
    simBtn.addEventListener("click", () => {
      nameInput.value = "Maya Lin";
      clientState.name = "Maya Lin";
      emailInput.value = "error@lumastudio.example";
      clientState.email = "error@lumastudio.example";
      phoneInput.value = "(718) 555-0199";
      clientState.phone = "(718) 555-0199";
      policyInput.checked = true;
      clientState.acceptedPolicy = true;
      document.querySelector("#client-form")?.requestSubmit();
    });
  }

  document.querySelector("#booking-back").addEventListener("click", () => renderStepOne());
  document.querySelector("#client-form").addEventListener("submit", submitBooking);
}

async function submitBooking(event) {
  event.preventDefault();
  // Protection against accidental repeated clicks/submissions
  if (isSubmittingBooking) return;

  const form = event.currentTarget;
  const errorBox = form.querySelector(".form-error");
  const button = form.querySelector('[type="submit"]');
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const acceptedPolicy = Boolean(formData.get("acceptedPolicy"));

  // Preserve user entries on validation failure
  clientState.name = name;
  clientState.email = email;
  clientState.phone = phone;
  clientState.acceptedPolicy = acceptedPolicy;

  let hasValidationError = false;
  let firstInvalidEl = null;

  const nameEl = document.querySelector("#client-name");
  const nameErr = document.querySelector("#error-client-name");
  if (name.length < 2) {
    nameEl.classList.add("has-error");
    nameEl.setAttribute("aria-invalid", "true");
    nameErr.textContent = "Please enter your full name (minimum 2 characters).";
    nameErr.classList.add("visible");
    hasValidationError = true;
    if (!firstInvalidEl) firstInvalidEl = nameEl;
  } else {
    nameEl.classList.remove("has-error");
    nameEl.removeAttribute("aria-invalid");
    nameErr.classList.remove("visible");
  }

  const emailEl = document.querySelector("#client-email");
  const emailErr = document.querySelector("#error-client-email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailEl.classList.add("has-error");
    emailEl.setAttribute("aria-invalid", "true");
    emailErr.textContent = "Please enter a valid email address (e.g. name@example.com).";
    emailErr.classList.add("visible");
    hasValidationError = true;
    if (!firstInvalidEl) firstInvalidEl = emailEl;
  } else {
    emailEl.classList.remove("has-error");
    emailEl.removeAttribute("aria-invalid");
    emailErr.classList.remove("visible");
  }

  const phoneEl = document.querySelector("#client-phone");
  const phoneErr = document.querySelector("#error-client-phone");
  if (!/^[+()\d\s.-]{7,25}$/.test(phone)) {
    phoneEl.classList.add("has-error");
    phoneEl.setAttribute("aria-invalid", "true");
    phoneErr.textContent = "Please enter a valid telephone number (at least 7 digits).";
    phoneErr.classList.add("visible");
    hasValidationError = true;
    if (!firstInvalidEl) firstInvalidEl = phoneEl;
  } else {
    phoneEl.classList.remove("has-error");
    phoneEl.removeAttribute("aria-invalid");
    phoneErr.classList.remove("visible");
  }

  const policyContainer = document.querySelector("#policy-container");
  const policyErr = document.querySelector("#error-client-policy");
  if (!acceptedPolicy) {
    policyContainer.classList.add("has-error");
    policyErr.textContent = "You must acknowledge and agree to the 24-hour cancellation policy.";
    policyErr.classList.add("visible");
    hasValidationError = true;
    if (!firstInvalidEl) firstInvalidEl = document.querySelector("#client-policy");
  } else {
    policyContainer.classList.remove("has-error");
    policyErr.classList.remove("visible");
  }

  if (hasValidationError) {
    isSubmittingBooking = false;
    if (errorBox) {
      errorBox.innerHTML = `
        <div class="booking-failure-card" role="alert" style="margin-top:8px;">
          <div class="failure-header"><span class="failure-icon">!</span><strong>Missing Required Information</strong></div>
          <p class="failure-detail">Please resolve the highlighted fields before finalizing your appointment.</p>
        </div>
      `;
    }
    if (firstInvalidEl) firstInvalidEl.focus();
    return;
  }

  // Active in-flight submission lock & loading state
  isSubmittingBooking = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.classList.add("is-loading");
  button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> <span>Saving your chair…</span>';
  if (errorBox) errorBox.innerHTML = "";

  try {
    const confirmed = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ holdId: booking.holdId, name, email, phone, acceptedPolicy: true })
    });

    // Confirmation only after success
    isSubmittingBooking = false;
    const service = serviceById(booking.serviceId);
    bookingContent.innerHTML = `
      <div class="demo-mode-tag">Demo Mode · Local Prototype Store</div>
      <div class="success-mark" aria-hidden="true">✳</div>
      <h2 id="booking-heading">It’s a <em>date.</em></h2>
      <p class="booking-subtitle">Your appointment has been registered in the salon’s local storage database.</p>
      <div class="booking-summary">
        <strong>${escapeHtml(confirmed.service)}</strong><br>
        ${escapeHtml(confirmed.stylist)} · ${escapeHtml(formatLongDate(booking.date))} at ${formatTime(confirmed.startAt)}<br>
        ${formatServicePrice(service)} · Confirmation Reference <strong>#LUM-${escapeHtml(confirmed.id.slice(0, 8).toUpperCase())}</strong>
      </div>
      <p class="policy-note"><strong>Demo Environment Notice:</strong> This appointment is stored locally in <code>data/store.json</code> for staff review. Because this demonstration starter does not integrate live external SMS/Email or card payment gateways, no automated text or email message was dispatched. Please present your confirmation reference at the salon upon arrival.</p>
      <button class="button button-dark" type="button" id="booking-done">Lovely, see you there</button>
    `;
    document.querySelector("#booking-done").addEventListener("click", () => dialog.close());
    booking.holdId = "";
    clientState.name = "";
    clientState.email = "";
    clientState.phone = "";
    clientState.acceptedPolicy = false;
  } catch (error) {
    // Clear failure message and reset submission lock
    isSubmittingBooking = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove("is-loading");
    button.textContent = "Try again";

    if (errorBox) {
      if (error.code === "CONSULTATION_REQUIRED") {
        errorBox.innerHTML = `
          <div class="booking-failure-card" role="alert">
            <div class="failure-badge">⚠️ Consultation Required</div>
            <p class="failure-detail">${escapeHtml(error.message)}</p>
            <button class="button button-small button-dark" id="btn-error-consultation" type="button" style="margin-top:8px;">Book complimentary consultation</button>
          </div>
        `;
        document.querySelector("#btn-error-consultation")?.addEventListener("click", () => {
          booking.serviceId = "complimentary-consultation";
          booking.stylistId = "";
          renderStepOne();
        });
        return;
      }

      errorBox.innerHTML = `
        <div class="booking-failure-card" role="alert">
          <div class="failure-header">
            <span class="failure-icon" aria-hidden="true">✕</span>
            <strong>Booking could not be finalized</strong>
          </div>
          <p class="failure-detail">${escapeHtml(error.message)}</p>
          <p class="failure-hint">Your entries remain preserved. Check your details and tap <strong>Try again</strong>, or call the salon directly at <strong>(718) 555-0142</strong>.</p>
        </div>
      `;
    }

    if (error.message.includes("hold expired") || error.message.includes("expired")) {
      setTimeout(() => {
        renderStepOne("Reservation hold expired. The slot was released—please select an available time.");
      }, 3000);
    }
  }
}

async function chooseSlot(startAt, stylistId, button) {
  if (isHoldingSlot) return;
  isHoldingSlot = true;
  const errorBox = document.querySelector(".form-error");
  const label = button.textContent;

  // Protect against repeated slot clicks by disabling other slot options
  const allSlotButtons = document.querySelectorAll(".slot-button");
  allSlotButtons.forEach((b) => {
    b.disabled = true;
    if (b !== button) b.classList.add("slot-locked");
  });

  button.classList.add("is-loading");
  button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Holding…';

  try {
    const hold = await api("/api/holds", {
      method: "POST",
      body: JSON.stringify({ serviceId: booking.serviceId, stylistId, startAt })
    });
    booking.startAt = startAt;
    booking.stylistId = stylistId;
    booking.holdId = hold.id;
    isHoldingSlot = false;
    showClientForm();
  } catch (error) {
    isHoldingSlot = false;
    allSlotButtons.forEach((b) => {
      b.disabled = false;
      b.classList.remove("slot-locked");
    });
    button.classList.remove("is-loading");
    button.textContent = label;
    if (errorBox) {
      errorBox.innerHTML = `
        <div class="booking-failure-card" role="alert">
          <div class="failure-header">
            <span class="failure-icon" aria-hidden="true">✕</span>
            <strong>Could not hold time slot</strong>
          </div>
          <p class="failure-detail">${escapeHtml(error.message)}</p>
        </div>
      `;
    }
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
  setupCustomCursor();
  setupFloatingBar();
  setupMagneticButtons();
  setupScrollAnimations();
  setupRotatingHeadline();
  setupHeroParallax();
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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("openBooking")) {
      openBooking({ serviceId: "signature-cut" });
    } else if (urlParams.has("testValidation")) {
      booking.serviceId = "signature-cut";
      booking.stylistId = "maya";
      booking.date = todayKey();
      booking.startAt = new Date().toISOString();
      showClientForm();
      dialog.showModal();
      const form = document.querySelector("#client-form");
      if (form) form.dispatchEvent(new Event("submit", { cancelable: true }));
    } else if (urlParams.has("testError")) {
      booking.serviceId = "signature-cut";
      booking.stylistId = "maya";
      booking.date = todayKey();
      booking.startAt = new Date().toISOString();
      showClientForm();
      dialog.showModal();
      const errBox = document.querySelector(".form-error");
      if (errBox) {
        errBox.innerHTML = `
          <div class="booking-failure-card" role="alert">
            <div class="failure-header"><span class="failure-icon" aria-hidden="true">✕</span><strong>Booking could not be finalized</strong></div>
            <p class="failure-detail">Atelier Reservation Gateway Error (500): The salon booking database server encountered an unexpected failure. Your slot hold remains active—please try again.</p>
            <p class="failure-hint">Your entries remain preserved. Check your details and tap <strong>Try again</strong>, or call the salon directly at <strong>(718) 555-0142</strong>.</p>
          </div>
        `;
      }
    } else if (urlParams.has("testConfirmed")) {
      booking.serviceId = "signature-cut";
      booking.stylistId = "maya";
      booking.date = todayKey();
      booking.startAt = new Date().toISOString();
      showClientForm();
      dialog.showModal();
      const confirmed = {
        id: "cf8931a2-7b19-4a41-b842-1e9a263158ef",
        service: "Signature cut",
        stylist: "Maya Chen",
        startAt: new Date().toISOString(),
        status: "confirmed"
      };
      const service = serviceById(booking.serviceId);
      bookingContent.innerHTML = `
        <div class="demo-mode-tag">Demo Mode · Local Prototype Store</div>
        <div class="success-mark" aria-hidden="true">✳</div>
        <h2 id="booking-heading">It’s a <em>date.</em></h2>
        <p class="booking-subtitle">Your appointment has been registered in the salon’s local storage database.</p>
        <div class="booking-summary">
          <strong>${escapeHtml(confirmed.service)}</strong><br>
          ${escapeHtml(confirmed.stylist)} · ${escapeHtml(formatLongDate(booking.date))} at ${formatTime(confirmed.startAt)}<br>
          ${formatServicePrice(service)} · Confirmation Reference <strong>#LUM-${escapeHtml(confirmed.id.slice(0, 8).toUpperCase())}</strong>
        </div>
        <p class="policy-note"><strong>Demo Environment Notice:</strong> This appointment is stored locally in <code>data/store.json</code> for staff review. Because this demonstration starter does not integrate live external SMS/Email or card payment gateways, no automated text or email message was dispatched. Please present your confirmation reference at the salon upon arrival.</p>
        <button class="button button-dark" type="button" id="booking-done">Lovely, see you there</button>
      `;
    }
  } catch (error) {
    showToast(`The studio details could not load: ${error.message}`);
  }
}

function setupRotatingHeadline() {
  const words = document.querySelectorAll(".rotating-word");
  if (words.length <= 1) return;
  let currentIndex = 0;
  setInterval(() => {
    words[currentIndex].classList.remove("is-active");
    currentIndex = (currentIndex + 1) % words.length;
    words[currentIndex].classList.add("is-active");
  }, 3200);
}

function setupHeroParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const heroBanner = document.querySelector(".hero-banner");
  const bgImage = document.querySelector(".hero-bg-image");
  const sconces = document.querySelector(".hero-sconce-lights");
  if (!heroBanner || !bgImage) return;

  let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
  let animationFrame;

  function update() {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;
    bgImage.style.transform = `scale(1.04) translate3d(${currentX * -18}px, ${currentY * -12}px, 0)`;
    if (sconces) {
      sconces.style.transform = `translateY(calc(-50% + ${currentY * 16}px)) translate3d(${currentX * 12}px, 0, 0)`;
    }
    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
      animationFrame = requestAnimationFrame(update);
    } else {
      animationFrame = null;
    }
  }

  heroBanner.addEventListener("mousemove", (e) => {
    const rect = heroBanner.getBoundingClientRect();
    targetX = (e.clientX - rect.left) / rect.width - 0.5;
    targetY = (e.clientY - rect.top) / rect.height - 0.5;
    if (!animationFrame) animationFrame = requestAnimationFrame(update);
  });

  heroBanner.addEventListener("mouseleave", () => {
    targetX = 0;
    targetY = 0;
    if (!animationFrame) animationFrame = requestAnimationFrame(update);
  });
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
    ".hero-centered-content > *", ".intro > *", ".section-heading > *",
    ".service-group", ".services-cta", ".team-intro-copy > *", ".team-feature-image",
    ".stylist-card", ".testimonial-card", ".press-bar", ".gallery-heading > *", ".gallery-grid figure", ".quote-section > *",
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

function setupCustomCursor() {
  if (window.matchMedia("(pointer: coarse), (hover: none)").matches) return;
  const cursorEl = document.querySelector("#custom-cursor");
  if (!cursorEl) return;

  const dot = cursorEl.querySelector(".cursor-dot");
  const ring = cursorEl.querySelector(".cursor-ring");
  const text = cursorEl.querySelector(".cursor-text");
  const glow = cursorEl.querySelector(".cursor-ambient-glow");

  document.documentElement.classList.add("has-custom-cursor");

  let mouseX = -100, mouseY = -100;
  let ringX = -100, ringY = -100;
  let isVisible = false;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isVisible) {
      isVisible = true;
      cursorEl.classList.add("is-visible");
      ringX = mouseX;
      ringY = mouseY;
    }
  });

  window.addEventListener("mouseleave", () => {
    isVisible = false;
    cursorEl.classList.remove("is-visible");
  });

  window.addEventListener("mousedown", (e) => {
    cursorEl.classList.add("is-clicking");
    const ripple = document.createElement("div");
    ripple.className = "cursor-ripple";
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  });

  window.addEventListener("mouseup", () => {
    cursorEl.classList.remove("is-clicking");
  });

  function renderCursor() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;

    dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    if (glow) glow.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    if (text) text.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("button, a, .service-card, .stylist-card, .photo-frame, input, select, textarea, .testimonial-card, .quick-book-pill, .quick-top-btn");
    if (!target) {
      cursorEl.className = "custom-cursor is-visible";
      if (text) text.textContent = "";
      return;
    }

    cursorEl.className = "custom-cursor is-visible";
    if (target.matches("button, a, .button, .service-book, .slot-button, .nav-book, .quick-book-pill, .quick-top-btn")) {
      cursorEl.classList.add("is-hover-button");
    } else if (target.matches(".service-card, .testimonial-card, .stylist-card")) {
      cursorEl.classList.add("is-hover-card");
    } else if (target.matches(".photo-frame, .gallery-grid figure, .team-feature-image")) {
      cursorEl.classList.add("is-hover-gallery");
      if (text) text.textContent = "VIEW";
    } else if (target.matches("input, select, textarea")) {
      cursorEl.classList.add("is-hover-input");
    }
  });

  document.addEventListener("mouseout", (e) => {
    const related = e.relatedTarget;
    if (!related || !related.closest("button, a, .service-card, .stylist-card, .photo-frame, input, select, textarea, .testimonial-card, .quick-book-pill, .quick-top-btn")) {
      cursorEl.className = "custom-cursor is-visible";
      if (text) text.textContent = "";
    }
  });
}

function setupFloatingBar() {
  const bar = document.querySelector("#floating-quick-bar");
  const topBtn = document.querySelector("#quick-top-btn");
  if (!bar) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 450) {
      bar.classList.add("is-visible");
    } else {
      bar.classList.remove("is-visible");
    }
  }, { passive: true });

  if (topBtn) {
    topBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function setupMagneticButtons() {
  if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
  const items = document.querySelectorAll(".hero-main-cta, .nav-book, .quick-book-pill");
  items.forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate3d(${x * 0.18}px, ${y * 0.18}px, 0)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "";
    });
  });
}

initialise();

