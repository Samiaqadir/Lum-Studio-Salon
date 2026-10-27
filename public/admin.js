const loginForm = document.querySelector("#admin-login");
const loginCard = document.querySelector("#admin-login-card");
const adminError = document.querySelector("#admin-error");
const dashboard = document.querySelector("#admin-dashboard");
const appointmentList = document.querySelector("#appointment-list");
const adminToast = document.querySelector("#admin-toast");

let adminKey = sessionStorage.getItem("salonAdminKey") || "";
let allAppointments = [];
let allServices = [];
let allStylists = [];
let salonData = null;
let currentFilter = "all";
let currentSearch = "";

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function localDayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPrice(num) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function showAdminToast(message) {
  adminToast.textContent = message;
  adminToast.classList.add("visible");
  setTimeout(() => adminToast.classList.remove("visible"), 3500);
}

async function adminApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminKey}`,
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 503) signOut();
    throw new Error(result.error || "The request could not be completed.");
  }
  return result;
}

function getStatusBadge(status) {
  const classes = {
    "confirmed": "badge-confirmed",
    "checked-in": "badge-checked-in",
    "completed": "badge-completed",
    "cancelled": "badge-cancelled",
    "no-show": "badge-no-show"
  };
  return `<span class="status-badge ${classes[status] || 'badge-confirmed'}">${safe(status)}</span>`;
}

function appointmentCard(item) {
  const date = new Date(item.startAt);
  const formattedDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
  const formattedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  const statusOptions = ["confirmed", "checked-in", "completed", "cancelled", "no-show"];

  return `
    <article class="appointment-card" data-id="${safe(item.id)}">
      <div class="appointment-primary">
        <div class="client-avatar" aria-hidden="true">${safe(item.client.name.charAt(0).toUpperCase())}</div>
        <div class="client-details">
          <strong>${safe(item.client.name)}</strong>
          <span class="client-contact"><a href="mailto:${safe(item.client.email)}">${safe(item.client.email)}</a> · <a href="tel:${safe(item.client.phone)}">${safe(item.client.phone)}</a></span>
        </div>
      </div>
      <div class="appointment-service">
        <span class="appointment-time">${formattedDate} at ${formattedTime}</span>
        <span class="service-name">${safe(item.service)} · with <em>${safe(item.stylist)}</em></span>
      </div>
      <div class="appointment-status">
        <label class="booking-label visually-hidden" for="status-${safe(item.id)}">Status</label>
        <select class="status-select" id="status-${safe(item.id)}" data-appointment="${safe(item.id)}">
          ${statusOptions.map((st) => `<option value="${st}" ${item.status === st ? "selected" : ""}>${st.replace("-", " ")}</option>`).join("")}
        </select>
        <button class="btn-delete-booking" type="button" data-delete-id="${safe(item.id)}" title="Delete booking" aria-label="Delete appointment">🗑</button>
      </div>
    </article>
  `;
}

function renderAppointments() {
  const today = localDayKey(new Date());
  let filtered = allAppointments.filter((item) => {
    // Status filter
    if (currentFilter === "today") {
      if (localDayKey(item.startAt) !== today) return false;
    } else if (currentFilter !== "all") {
      if (item.status !== currentFilter) return false;
    }
    // Search query
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const matchName = item.client.name.toLowerCase().includes(q);
      const matchEmail = item.client.email.toLowerCase().includes(q);
      const matchPhone = item.client.phone.toLowerCase().includes(q);
      const matchService = (item.service || "").toLowerCase().includes(q);
      const matchStylist = (item.stylist || "").toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchService && !matchStylist) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    appointmentList.innerHTML = `
      <div class="admin-empty">
        <p>No appointments match your filter criteria.</p>
        <button class="button button-outline button-small" type="button" onclick="resetFilters()">Clear Filters</button>
      </div>
    `;
    return;
  }

  appointmentList.innerHTML = filtered.map(appointmentCard).join("");
}

window.resetFilters = function() {
  currentFilter = "all";
  currentSearch = "";
  document.querySelector("#booking-search").value = "";
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.filter === "all");
  });
  renderAppointments();
};

function updateKPIs() {
  const today = localDayKey(new Date());
  const todayCount = allAppointments.filter((a) => localDayKey(a.startAt) === today && a.status !== "cancelled").length;
  const upcomingCount = allAppointments.filter((a) => localDayKey(a.startAt) >= today && a.status === "confirmed").length;
  const completedCount = allAppointments.filter((a) => a.status === "completed").length;

  let revenueEstimate = 0;
  for (const app of allAppointments) {
    if (app.status === "confirmed" || app.status === "completed" || app.status === "checked-in") {
      const s = allServices.find((srv) => srv.id === app.serviceId);
      if (s && s.price) revenueEstimate += s.price;
    }
  }

  document.querySelector("#stat-today").textContent = todayCount;
  document.querySelector("#stat-upcoming").textContent = upcomingCount;
  document.querySelector("#stat-completed").textContent = completedCount;
  document.querySelector("#stat-revenue").textContent = formatPrice(revenueEstimate);
  document.querySelector("#count-bookings").textContent = allAppointments.length;
}

function renderServices() {
  const container = document.querySelector("#admin-services-list");
  if (!container) return;
  document.querySelector("#count-services").textContent = allServices.length;

  container.innerHTML = allServices.map((service) => `
    <article class="admin-service-card">
      <div class="service-card-top">
        <span class="service-category-tag">${safe(service.category)}</span>
        <strong class="service-price-tag">${service.price ? formatPrice(service.price) : "Free"}</strong>
      </div>
      <h3>${safe(service.name)}</h3>
      <p>${safe(service.description)}</p>
      <div class="service-card-meta">
        <span>⏱ ${service.durationMinutes} minutes</span>
        ${service.requiresConsultation ? '<span class="consult-required-badge">Requires Consultation</span>' : '<span class="direct-booking-badge">Direct Booking</span>'}
      </div>
    </article>
  `).join("");
}

function renderStylists() {
  const container = document.querySelector("#admin-stylists-list");
  if (!container) return;
  document.querySelector("#count-stylists").textContent = allStylists.length;

  container.innerHTML = allStylists.map((stylist) => `
    <article class="admin-stylist-card">
      <img src="${safe(stylist.image)}" alt="${safe(stylist.name)}" class="stylist-portrait" loading="lazy">
      <div class="stylist-card-body">
        <span class="stylist-level-badge">${safe(stylist.level)}</span>
        <h3>${safe(stylist.name)}</h3>
        <p class="stylist-spec">${safe(stylist.specialties)}</p>
        <span class="stylist-services-count">${stylist.serviceIds.length} salon services assigned</span>
      </div>
    </article>
  `).join("");
}

function renderSalonProfile() {
  const container = document.querySelector("#admin-salon-profile");
  if (!container || !salonData) return;

  container.innerHTML = `
    <div class="salon-profile-card">
      <div class="profile-info-grid">
        <div class="profile-item">
          <strong>Studio Name</strong>
          <span>${safe(salonData.name)}</span>
        </div>
        <div class="profile-item">
          <strong>Address</strong>
          <span>${safe(salonData.address)}</span>
        </div>
        <div class="profile-item">
          <strong>Phone</strong>
          <span><a href="tel:${safe(salonData.phone)}">${safe(salonData.phone)}</a></span>
        </div>
        <div class="profile-item">
          <strong>Email</strong>
          <span><a href="mailto:${safe(salonData.email)}">${safe(salonData.email)}</a></span>
        </div>
      </div>
      <div class="profile-hours-section">
        <h3>Weekly Chair Operating Hours</h3>
        <div class="profile-hours-grid">
          ${salonData.hours.map((h) => `
            <div class="hour-row">
              <span class="day-name">${safe(h.day)}</span>
              <span class="day-hours">${safe(h.hours)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function populateModalSelects() {
  const srvSelect = document.querySelector("#new-service-select");
  if (srvSelect) {
    srvSelect.innerHTML = allServices.map((s) => `
      <option value="${safe(s.id)}">${safe(s.name)} (${s.price ? formatPrice(s.price) : "Free"})</option>
    `).join("");
  }
  const stySelect = document.querySelector("#new-stylist-select");
  if (stySelect) {
    stySelect.innerHTML = allStylists.map((st) => `
      <option value="${safe(st.id)}">${safe(st.name)} — ${safe(st.level)}</option>
    `).join("");
  }
  const dateInput = document.querySelector("#new-booking-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = localDayKey(new Date());
  }
}

let allPosts = [];

function renderPlannerFeed() {
  const container = document.querySelector("#admin-planner-feed");
  if (!container) return;
  const countEl = document.querySelector("#count-posts");
  if (countEl) countEl.textContent = allPosts.length;
  if (!allPosts.length) {
    container.innerHTML = '<p class="admin-empty">No social planner posts found.</p>';
    return;
  }
  container.innerHTML = allPosts.map((p) => `
    <article class="post-card status-${p.status.toLowerCase()}" style="padding:16px;background:var(--surface);border-radius:12px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;">${p.platform === 'instagram' ? '📸 Instagram' : p.platform === 'facebook' ? '👥 Facebook' : p.platform === 'pinterest' ? '📌 Pinterest' : '🎵 TikTok'}</span>
        <span class="post-status-badge badge-${p.status.toLowerCase()}" style="font-size:10px;padding:2px 8px;border-radius:12px;background:${p.status === 'Scheduled' ? 'var(--olive-soft)' : '#e9e8e2'};color:${p.status === 'Scheduled' ? 'var(--olive-dark)' : '#4f4e46'};font-weight:700;">${p.status}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);">📅 Planned: ${p.plannedDate} at ${p.plannedTime}</div>
      <p style="margin:0;font-size:13.5px;line-height:1.5;color:var(--ink);">${safe(p.caption)}</p>
      <div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">
        <small style="color:var(--muted);font-size:11px;">Internal Wireframe</small>
        <a class="button button-outline-light button-small" href="/planner.html" target="_blank" style="font-size:11px;padding:3px 8px;">Edit in Planner →</a>
      </div>
    </article>
  `).join("");
}

async function loadAllAdminData() {
  appointmentList.innerHTML = '<p class="admin-empty">Loading salon dashboard…</p>';
  try {
    const [bookings, servicesRes, stylistsRes, salonRes, postsRes] = await Promise.all([
      adminApi("/api/admin/bookings"),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/stylists").then((r) => r.json()),
      fetch("/api/salon").then((r) => r.json()),
      fetch("/api/posts").then((r) => r.json()).catch(() => [])
    ]);

    allAppointments = bookings;
    allServices = servicesRes;
    allStylists = stylistsRes;
    salonData = salonRes;
    allPosts = postsRes || [];

    updateKPIs();
    renderAppointments();
    renderServices();
    renderStylists();
    renderSalonProfile();
    populateModalSelects();
    renderPlannerFeed();
  } catch (error) {
    if (adminKey) showAdminToast(error.message);
  }
}

function signOut() {
  adminKey = "";
  sessionStorage.removeItem("salonAdminKey");
  loginForm.reset();
  loginCard.hidden = false;
  dashboard.hidden = true;
}

// Quick demo login helper
document.querySelector("#btn-quick-demo")?.addEventListener("click", () => {
  document.querySelector("#admin-key").value = "admin123";
  loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
});

// Login Form Submit
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = document.querySelector("#admin-key").value.trim();
  adminError.textContent = "";

  try {
    await adminApi("/api/admin/bookings");
    sessionStorage.setItem("salonAdminKey", adminKey);
    loginCard.hidden = true;
    dashboard.hidden = false;
    await loadAllAdminData();
    showAdminToast("Welcome to Luma Atelier Dashboard.");
  } catch (error) {
    adminError.textContent = error.message;
    adminKey = "";
  }
});

// Sign out and Refresh
document.querySelector("#admin-signout")?.addEventListener("click", signOut);
document.querySelector("#refresh-bookings")?.addEventListener("click", async () => {
  await loadAllAdminData();
  showAdminToast("Dashboard refreshed.");
});

// Tab Navigation
document.querySelectorAll(".admin-tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.hidden = true);

    tabBtn.classList.add("is-active");
    const targetId = tabBtn.dataset.tab;
    const targetPanel = document.querySelector(`#${targetId}`);
    if (targetPanel) targetPanel.hidden = false;
  });
});

// Search and Filter Listeners
document.querySelector("#booking-search")?.addEventListener("input", (e) => {
  currentSearch = e.target.value.trim();
  renderAppointments();
});

document.querySelectorAll(".filter-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("is-active"));
    pill.classList.add("is-active");
    currentFilter = pill.dataset.filter;
    renderAppointments();
  });
});

// Appointment Status Change & Delete
appointmentList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-appointment]");
  if (!select) return;
  try {
    await adminApi(`/api/admin/bookings/${encodeURIComponent(select.dataset.appointment)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value })
    });
    showAdminToast("Appointment status updated.");
    await loadAllAdminData();
  } catch (error) {
    showAdminToast(error.message);
    await loadAllAdminData();
  }
});

appointmentList.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest("[data-delete-id]");
  if (!deleteBtn) return;
  const id = deleteBtn.dataset.deleteId;
  if (!confirm("Are you sure you want to remove this booking?")) return;
  try {
    await adminApi(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
    showAdminToast("Appointment removed.");
    await loadAllAdminData();
  } catch (error) {
    showAdminToast(error.message);
  }
});

// Walk-in / New Appointment Modal
const bookingModal = document.querySelector("#admin-booking-modal");
document.querySelector("#btn-open-booking-modal")?.addEventListener("click", () => {
  populateModalSelects();
  bookingModal.showModal();
});
document.querySelector("#btn-close-booking-modal")?.addEventListener("click", () => bookingModal.close());
document.querySelector("#btn-cancel-booking-modal")?.addEventListener("click", () => bookingModal.close());

document.querySelector("#admin-new-booking-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.querySelector("#new-client-name").value.trim();
  const phone = document.querySelector("#new-client-phone").value.trim();
  const email = document.querySelector("#new-client-email").value.trim();
  const serviceId = document.querySelector("#new-service-select").value;
  const stylistId = document.querySelector("#new-stylist-select").value;
  const dateVal = document.querySelector("#new-booking-date").value;
  const timeVal = document.querySelector("#new-booking-time").value;

  const startAt = new Date(`${dateVal}T${timeVal}:00`).toISOString();

  try {
    await adminApi("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({ name, phone, email, serviceId, stylistId, startAt, status: "confirmed" })
    });
    bookingModal.close();
    document.querySelector("#admin-new-booking-form").reset();
    showAdminToast(`Appointment created for ${name}!`);
    await loadAllAdminData();
  } catch (error) {
    showAdminToast(error.message);
  }
});

// New Service Modal
const serviceModal = document.querySelector("#admin-service-modal");
document.querySelector("#btn-open-service-modal")?.addEventListener("click", () => serviceModal.showModal());
document.querySelector("#btn-close-service-modal")?.addEventListener("click", () => serviceModal.close());
document.querySelector("#btn-cancel-service-modal")?.addEventListener("click", () => serviceModal.close());

document.querySelector("#admin-new-service-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.querySelector("#new-srv-name").value.trim();
  const category = document.querySelector("#new-srv-category").value;
  const price = Number(document.querySelector("#new-srv-price").value) || 0;
  const durationMinutes = Number(document.querySelector("#new-srv-duration").value) || 60;
  const requiresConsultation = document.querySelector("#new-srv-consult").value === "true";
  const description = document.querySelector("#new-srv-desc").value.trim();

  try {
    await adminApi("/api/admin/services", {
      method: "POST",
      body: JSON.stringify({ name, category, price, durationMinutes, requiresConsultation, description })
    });
    serviceModal.close();
    document.querySelector("#admin-new-service-form").reset();
    showAdminToast(`Service "${name}" added to catalog!`);
    await loadAllAdminData();
  } catch (error) {
    showAdminToast(error.message);
  }
});

// Check if user is already logged in
if (adminKey) {
  adminApi("/api/admin/bookings")
    .then(() => {
      loginCard.hidden = true;
      dashboard.hidden = false;
      return loadAllAdminData();
    })
    .catch(() => signOut());
}
