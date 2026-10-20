const loginForm = document.querySelector("#admin-login");
const loginCard = document.querySelector(".admin-card");
const adminError = document.querySelector("#admin-error");
const dashboard = document.querySelector("#admin-dashboard");
const appointmentList = document.querySelector("#appointment-list");
const adminToast = document.querySelector("#admin-toast");
let adminKey = "";

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
  return `
    <article class="appointment-card">
      <div class="appointment-primary">
        <strong>${safe(appointment.client.name)}</strong>
        <span>${safe(appointment.client.email)}</span>
        <span>${safe(appointment.client.phone)}</span>
      </div>
      <div class="appointment-service">
        <span class="appointment-time">${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date)} · ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date)}</span>
        <span>${safe(appointment.service)} with ${safe(appointment.stylist)}</span>
      </div>
      <div class="appointment-status"><label class="booking-label" for="status-${safe(appointment.id)}">STATUS</label><select id="status-${safe(appointment.id)}" data-appointment="${safe(appointment.id)}">${statusOptions.map((status) => `<option value="${status}" ${appointment.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
    </article>
  `;
}

async function loadAppointments() {
  appointmentList.innerHTML = '<p class="admin-empty">Checking the calendar…</p>';
  try {
    const appointments = await adminApi("/api/admin/bookings");
    const today = localDayKey(new Date());
    const upcoming = appointments.filter((item) => item.status !== "cancelled" && localDayKey(new Date(item.startAt)) >= today);
    const todayAppointments = upcoming.filter((item) => localDayKey(new Date(item.startAt)) === today);
    document.querySelector("#dashboard-stats").innerHTML = `
      <article class="stat-card"><span class="stat-value">${todayAppointments.length}</span><span class="stat-label">On today’s calendar</span></article>
      <article class="stat-card"><span class="stat-value">${upcoming.length}</span><span class="stat-label">Upcoming visits</span></article>
      <article class="stat-card"><span class="stat-value">${appointments.filter((item) => item.status === "no-show").length}</span><span class="stat-label">No-show records</span></article>
    `;
    appointmentList.innerHTML = appointments.length
      ? appointments.map(appointmentCard).join("")
      : '<p class="admin-empty">No appointments yet. They’ll show up here when your guests book online.</p>';
  } catch (error) {
    if (adminKey) showAdminToast(error.message);
  }
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
