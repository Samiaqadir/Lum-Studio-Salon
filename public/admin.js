const loginForm = document.querySelector("#admin-login");
const loginCard = document.querySelector(".admin-card");
const adminError = document.querySelector("#admin-error");
const dashboard = document.querySelector("#admin-dashboard");
const appointmentList = document.querySelector("#appointment-list");
const adminToast = document.querySelector("#admin-toast");
const searchInput = document.querySelector("#admin-search");
const appointmentCountEl = document.querySelector("#appointment-count");
const exportCsvBtn = document.querySelector("#export-csv");

let adminKey = "";
let allAppointments = [];
let currentFilter = "all";
let currentSearch = "";

function safe(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function adminApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${adminKey}`, ...options.headers }
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 503) signOut();
    throw new Error(result.error || "The request could not be completed.");
  }
  return result;
}

function appointmentCard(appointment) {
  const date = new Date(appointment.startAt);
  const statusOptions = ["confirmed", "checked-in", "completed", "cancelled", "no-show"];
  const cleanPhone = String(appointment.client.phone || "").replace(/[^\d+]/g, "");
  return `
    <article class="appointment-card status-${safe(appointment.status)}">
      <div class="appointment-primary">
        <div class="appointment-name-row">
          <strong>${safe(appointment.client.name)}</strong>
          <span class="status-badge badge-${safe(appointment.status)}">${safe(appointment.status)}</span>
        </div>
        <div class="appointment-contacts">
          <a class="contact-action-link" href="mailto:${safe(appointment.client.email)}">✉ ${safe(appointment.client.email)}</a>
          <a class="contact-action-link" href="tel:${safe(cleanPhone)}">📞 ${safe(appointment.client.phone)}</a>
        </div>
      </div>
      <div class="appointment-service">
        <span class="appointment-time">${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date)} · ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date)}</span>
        <span>${safe(appointment.service)} with ${safe(appointment.stylist)}</span>
      </div>
      <div class="appointment-status">
        <label class="booking-label" for="status-${safe(appointment.id)}">UPDATE STATUS</label>
        <select id="status-${safe(appointment.id)}" data-appointment="${safe(appointment.id)}" class="admin-status-select">
          ${statusOptions.map((status) => `<option value="${status}" ${appointment.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
    </article>
  `;
}

function filterAppointments() {
  const searchLower = currentSearch.toLowerCase().trim();
  return allAppointments.filter((app) => {
    const matchesFilter = currentFilter === "all" || app.status === currentFilter;
    if (!matchesFilter) return false;
    if (!searchLower) return true;

    const name = String(app.client?.name || "").toLowerCase();
    const email = String(app.client?.email || "").toLowerCase();
    const phone = String(app.client?.phone || "").toLowerCase();
    const service = String(app.service || "").toLowerCase();
    const stylist = String(app.stylist || "").toLowerCase();

    return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower) || service.includes(searchLower) || stylist.includes(searchLower);
  });
}

function renderAppointments() {
  const filtered = filterAppointments();
  if (appointmentCountEl) appointmentCountEl.textContent = filtered.length;

  if (filtered.length === 0) {
    appointmentList.innerHTML = allAppointments.length === 0
      ? '<p class="admin-empty">No appointments yet. They’ll show up here when guests book online.</p>'
      : '<p class="admin-empty">No appointments match your search or filter.</p>';
    return;
  }

  appointmentList.innerHTML = filtered.map(appointmentCard).join("");
}

async function loadAppointments() {
  appointmentList.innerHTML = '<p class="admin-empty">Checking the calendar…</p>';
  try {
    allAppointments = await adminApi("/api/admin/bookings");
    const today = localDayKey(new Date());
    const upcoming = allAppointments.filter((item) => item.status !== "cancelled" && localDayKey(new Date(item.startAt)) >= today);
    const todayAppointments = upcoming.filter((item) => localDayKey(new Date(item.startAt)) === today);
    const completedCount = allAppointments.filter((item) => item.status === "completed").length;

    document.querySelector("#dashboard-stats").innerHTML = `
      <article class="stat-card"><span class="stat-value">${todayAppointments.length}</span><span class="stat-label">On today’s calendar</span></article>
      <article class="stat-card"><span class="stat-value">${upcoming.length}</span><span class="stat-label">Upcoming visits</span></article>
      <article class="stat-card"><span class="stat-value">${completedCount}</span><span class="stat-label">Completed visits</span></article>
      <article class="stat-card"><span class="stat-value">${allAppointments.length}</span><span class="stat-label">Total bookings</span></article>
    `;

    renderAppointments();
  } catch (error) {
    if (adminKey) showAdminToast(error.message);
  }
}

function exportCsv() {
  if (allAppointments.length === 0) {
    showAdminToast("No appointment records to export.");
    return;
  }

  const headers = ["ID", "Guest Name", "Email", "Phone", "Service", "Stylist", "Date Time", "Status", "Booked At"];
  const rows = allAppointments.map((app) => [
    app.id,
    `"${(app.client?.name || "").replace(/"/g, '""')}"`,
    `"${(app.client?.email || "").replace(/"/g, '""')}"`,
    `"${(app.client?.phone || "").replace(/"/g, '""')}"`,
    `"${(app.service || "").replace(/"/g, '""')}"`,
    `"${(app.stylist || "").replace(/"/g, '""')}"`,
    app.startAt,
    app.status,
    app.createdAt || ""
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `luma-appointments-${localDayKey(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAdminToast("Appointments CSV exported successfully.");
}

function showAdminToast(message) {
  adminToast.textContent = message;
  adminToast.classList.add("visible");
  setTimeout(() => adminToast.classList.remove("visible"), 3500);
}

function signOut() {
  adminKey = "";
  loginForm.reset();
  loginCard.hidden = false;
  dashboard.hidden = true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = document.querySelector("#admin-key").value;
  adminError.textContent = "";
  try {
    await adminApi("/api/admin/bookings");
    loginCard.hidden = true;
    dashboard.hidden = false;
    await loadAppointments();
  } catch (error) {
    adminError.textContent = error.message;
    adminKey = "";
  }
});

document.querySelector("#admin-signout").addEventListener("click", signOut);
document.querySelector("#refresh-bookings").addEventListener("click", loadAppointments);
if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderAppointments();
  });
}

document.querySelectorAll(".admin-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".admin-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    currentFilter = pill.dataset.filter;
    renderAppointments();
  });
});

appointmentList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-appointment]");
  if (!select) return;
  try {
    await adminApi(`/api/admin/bookings/${encodeURIComponent(select.dataset.appointment)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value })
    });
    showAdminToast("Appointment status updated.");
    await loadAppointments();
  } catch (error) {
    showAdminToast(error.message);
    await loadAppointments();
  }
});

if (new URLSearchParams(window.location.search).has("setup-needed")) {
  adminError.textContent = "Set SALON_ADMIN_KEY in your environment before signing in.";
}
