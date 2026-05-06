import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_PASSWORD = "l0ve";
const SESSION_KEY = "daily-divine-admin-unlocked";
const LAUNCH_DATE = new Date("2026-01-25T00:00:00-08:00");

const firebaseConfig = {
  apiKey: "AIzaSyDsRpQwkMzjJDMP6QICz38U7T7t2ghLj44",
  authDomain: "divine-60db1.firebaseapp.com",
  projectId: "divine-60db1",
  storageBucket: "divine-60db1.firebasestorage.app",
  messagingSenderId: "906079628075",
  appId: "1:906079628075:ios:95027e827c57b53ef8336e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const state = {
  users: [],
  dailyCounts: new Map(),
  totalEntries30: 0,
  sort: "recent",
  search: ""
};

const login = $("login");
const dashboard = $("dashboard");
const status = $("status");

$("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("password").value.trim();
  if (value !== ADMIN_PASSWORD) {
    $("login-error").textContent = "That password didn’t match.";
    return;
  }
  sessionStorage.setItem(SESSION_KEY, "true");
  unlock();
});

$("logout").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  dashboard.classList.add("is-hidden");
  login.classList.remove("is-hidden");
  $("password").value = "";
  $("password").focus();
});

$("refresh").addEventListener("click", () => loadData());
$("user-search").addEventListener("input", (event) => {
  state.search = event.target.value.toLowerCase();
  renderUsers();
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    state.sort = button.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("active", b === button));
    renderUsers();
  });
});

if (sessionStorage.getItem(SESSION_KEY) === "true") unlock();

function unlock() {
  login.classList.add("is-hidden");
  dashboard.classList.remove("is-hidden");
  loadData();
}

async function loadData() {
  setStatus("Loading Daily Divine data…");
  state.users = [];
  state.dailyCounts = new Map();
  state.totalEntries30 = 0;

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const userDocs = usersSnapshot.docs;
    const today = startOfDay(new Date());
    const thirtyDaysAgo = addDays(today, -29);

    for (const userDoc of userDocs) {
      const data = userDoc.data();
      const firstName = clean(data.firstName);
      const lastName = clean(data.lastName);
      const email = clean(data.email);
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName.toLowerCase().includes("john") && fullName.toLowerCase().includes("apple")) continue;

      const user = {
        id: userDoc.id,
        displayName: fullName || email || userDoc.id,
        email,
        createdAt: toDate(data.createdAt),
        lastLoginAt: toDate(data.lastLoginAt),
        lastActiveAt: toDate(data.lastActiveAt) || toDate(data.lastLoginAt),
        isPaidSubscriber: Boolean(data.isPaidSubscriber),
        grantedPremium: Boolean(data.grantedPremium),
        insightDays: new Set(),
        entries30: 0,
        insights30: 0
      };

      try {
        const insightsSnapshot = await getDocs(collection(db, "users", userDoc.id, "dailyInsights"));
        insightsSnapshot.forEach((insightDoc) => {
          const day = parseDayId(insightDoc.id);
          if (!day) return;
          user.insightDays.add(dayKey(day));
          if (day >= thirtyDaysAgo) {
            const key = dayKey(day);
            state.dailyCounts.set(key, (state.dailyCounts.get(key) || 0) + 1);
            user.insights30 += 1;
            const inputs = insightDoc.data().inputs;
            const entries = Array.isArray(inputs) ? inputs.length : 0;
            user.entries30 += entries;
            state.totalEntries30 += entries;
          }
        });
      } catch (error) {
        console.warn(`Could not load dailyInsights for ${userDoc.id}`, error);
      }

      state.users.push(user);
    }

    renderAll();
    setStatus(`Updated ${formatTime(new Date())}. Showing ${state.users.length.toLocaleString()} users from Firestore.`);
  } catch (error) {
    console.error(error);
    setStatus("Couldn’t read Firestore. The static page is deployed, but Firebase rules may need to allow this password-gated admin readout or add web auth for admins.", true);
  }
}

function renderAll() {
  const now = new Date();
  const launchUsers = state.users.filter((u) => !u.createdAt || u.createdAt >= LAUNCH_DATE).length;
  const totalUsers = launchUsers + 2; // Matches the in-app admin dashboard founder adjustment.
  const active7 = state.users.filter((u) => isWithinDays(u.lastActiveAt, now, 7)).length;
  const active30 = state.users.filter((u) => isWithinDays(u.lastActiveAt, now, 30)).length;
  const premium = state.users.filter((u) => u.isPaidSubscriber || u.grantedPremium).length;
  const retained = state.users.filter(hasMultiWeekUsage).length;
  const insights30 = [...state.dailyCounts.values()].reduce((sum, count) => sum + count, 0);

  setText("metric-total-users", totalUsers.toLocaleString());
  setText("metric-new-users", `${launchUsers.toLocaleString()} since launch + 2 founders`);
  setText("metric-active-7", active7.toLocaleString());
  setText("metric-active-rate", `${percent(active7, totalUsers)} of total users`);
  setText("metric-active-30", active30.toLocaleString());
  setText("metric-premium", premium.toLocaleString());
  setText("metric-premium-rate", `${percent(premium, totalUsers)} premium / granted`);
  setText("metric-insights", insights30.toLocaleString());
  setText("metric-entries", `${state.totalEntries30.toLocaleString()} entries captured`);
  setText("metric-retention", `${percent(retained, totalUsers)}`);

  renderBarChart();
  renderRetention(retained, totalUsers);
  renderInteresting({ totalUsers, active7, active30, premium, retained, insights30 });
  renderUsers();
}

function renderBarChart() {
  const chart = $("insight-chart");
  chart.innerHTML = "";
  const today = startOfDay(new Date());
  const days = Array.from({ length: 30 }, (_, index) => addDays(today, index - 29));
  const max = Math.max(1, ...days.map((day) => state.dailyCounts.get(dayKey(day)) || 0));

  days.forEach((day) => {
    const count = state.dailyCounts.get(dayKey(day)) || 0;
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(4, (count / max) * 100)}%`;
    bar.dataset.label = day.getDate();
    bar.dataset.tip = `${formatDay(day)} · ${count} insight${count === 1 ? "" : "s"}`;
    chart.appendChild(bar);
  });
}

function renderRetention(retained, totalUsers) {
  const pct = Math.round((retained / Math.max(1, totalUsers)) * 100);
  $("retention-chart").innerHTML = `
    <div class="ring" style="--value:${pct}%">
      <div class="ring-inner">
        <div><strong>${pct}%</strong><span>${retained.toLocaleString()} users</span></div>
      </div>
    </div>
    <p class="user-meta">Users with insights in two or more calendar weeks.</p>
  `;
}

function renderInteresting(metrics) {
  const list = $("insights-list");
  const items = [];
  const avgEntries = metrics.insights30 ? (state.totalEntries30 / metrics.insights30).toFixed(1) : "0.0";
  const topUsers = [...state.users].sort((a, b) => b.insights30 - a.insights30).slice(0, 3).filter((u) => u.insights30 > 0);
  const stalePremium = state.users.filter((u) => (u.isPaidSubscriber || u.grantedPremium) && !isWithinDays(u.lastActiveAt, new Date(), 14));
  const busiest = busiestDay();

  if (busiest) items.push(`<strong>${formatDay(busiest.day)} was the busiest day</strong> in the last 30 days, with ${busiest.count} generated insight${busiest.count === 1 ? "" : "s"}.`);
  items.push(`<strong>Depth signal:</strong> people add about ${avgEntries} sign/input${avgEntries === "1.0" ? "" : "s"} per generated insight over the last 30 days.`);
  items.push(`<strong>Retention pulse:</strong> ${percent(metrics.retained, metrics.totalUsers)} of users have returned across multiple weeks, a useful proxy for habit formation.`);
  if (topUsers.length) items.push(`<strong>Most engaged recently:</strong> ${topUsers.map((u) => escapeHtml(u.displayName)).join(", ")} generated the most insights in the last 30 days.`);
  if (stalePremium.length) items.push(`<strong>Win-back opportunity:</strong> ${stalePremium.length} premium/granted user${stalePremium.length === 1 ? "" : "s"} have not been active in 14+ days.`);

  list.innerHTML = items.map((item) => `<div class="insight-item">${item}</div>`).join("");
}

function renderUsers() {
  const query = state.search;
  const users = state.users
    .filter((u) => !query || `${u.displayName} ${u.email}`.toLowerCase().includes(query))
    .sort(compareUsers);

  $("users-list").innerHTML = users.map((u) => `
    <div class="user-row">
      <div>
        <p class="user-name">${escapeHtml(u.displayName)}</p>
        <p class="user-meta">${escapeHtml(u.email || u.id)}<br>${u.lastLoginAt ? `Last login ${relativeDate(u.lastLoginAt)}` : "No login timestamp"}</p>
      </div>
      <div class="badges">
        ${u.isPaidSubscriber ? '<span class="badge paid">PAID</span>' : ""}
        ${u.grantedPremium ? '<span class="badge granted">GRANTED</span>' : ""}
        <span class="badge">${u.insights30} insights</span>
      </div>
    </div>
  `).join("") || '<div class="insight-item">No matching users.</div>';
}

function compareUsers(a, b) {
  if (state.sort === "paid" && a.isPaidSubscriber !== b.isPaidSubscriber) return a.isPaidSubscriber ? -1 : 1;
  if (state.sort === "alpha" || state.sort === "paid") return alpha(a, b);
  const left = a.lastLoginAt ? a.lastLoginAt.getTime() : 0;
  const right = b.lastLoginAt ? b.lastLoginAt.getTime() : 0;
  if (left !== right) return right - left;
  return alpha(a, b);
}

function alpha(a, b) { return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id); }
function hasMultiWeekUsage(user) { return new Set([...user.insightDays].map(weekKey)).size >= 2; }
function busiestDay() {
  let best = null;
  for (const [key, count] of state.dailyCounts.entries()) if (!best || count > best.count) best = { day: parseDayId(key), count };
  return best;
}
function setStatus(message, isError = false) { status.textContent = message; status.classList.toggle("error", isError); }
function setText(id, text) { $(id).textContent = text; }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function toDate(value) { return value?.toDate ? value.toDate() : value instanceof Date ? value : null; }
function startOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isWithinDays(date, now, days) { return date instanceof Date && date >= addDays(startOfDay(now), -(days - 1)); }
function dayKey(date) { return date.toISOString().slice(0, 10); }
function parseDayId(id) { return /^\d{4}-\d{2}-\d{2}$/.test(id) ? new Date(`${id}T00:00:00Z`) : null; }
function weekKey(dayString) {
  const d = parseDayId(dayString);
  if (!d) return dayString;
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-${Math.ceil((((d - start) / 86400000) + start.getUTCDay() + 1) / 7)}`;
}
function percent(value, total) { return `${Math.round((value / Math.max(1, total)) * 100)}%`; }
function formatTime(date) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatDay(date) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); }
function relativeDate(date) {
  const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf.format(diffDays, "day");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
