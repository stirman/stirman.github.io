import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_PASSWORD = "l0ve";
const SESSION_KEY = "daily-divine-admin-unlocked";
const LAUNCH_DATE = new Date("2026-04-22T00:00:00-07:00");
const FOUNDER_USER_ADJUSTMENT = 2;

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
  dailyCardImages: new Map(),
  totalEntries30: 0,
  cardImages30: 0,
  sort: "recent",
  search: ""
};

const status = $("status");

$("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("password").value.trim() !== ADMIN_PASSWORD) {
    $("login-error").textContent = "That password didn’t match.";
    return;
  }
  sessionStorage.setItem(SESSION_KEY, "true");
  unlock();
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

document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.dataset.section;
    document.querySelectorAll("[data-section]").forEach((b) => b.classList.toggle("active", b === button));
    document.querySelectorAll(".section").forEach((el) => el.classList.remove("active-section"));
    $(`section-${section}`).classList.add("active-section");
  });
});

["assumption-sub-price", "assumption-text-cost", "assumption-image-cost"].forEach((id) => {
  $(id).addEventListener("input", renderCosts);
});

if (sessionStorage.getItem(SESSION_KEY) === "true") unlock();

function unlock() {
  $("login").classList.add("is-hidden");
  $("dashboard").classList.remove("is-hidden");
  loadData();
}

async function loadData() {
  setStatus("Loading Daily Divine data…");
  state.users = [];
  state.dailyCounts = new Map();
  state.dailyCardImages = new Map();
  state.totalEntries30 = 0;
  state.cardImages30 = 0;

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const today = startOfDay(new Date());
    const thirtyDaysAgo = addDays(today, -29);

    for (const userDoc of usersSnapshot.docs) {
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
        insights30: 0,
        cardImages30: 0
      };

      try {
        const insightsSnapshot = await getDocs(collection(db, "users", userDoc.id, "dailyInsights"));
        insightsSnapshot.forEach((insightDoc) => {
          const day = parseDayId(insightDoc.id);
          if (!day) return;
          const insightData = insightDoc.data();
          user.insightDays.add(dayKey(day));
          if (day >= thirtyDaysAgo) {
            const key = dayKey(day);
            state.dailyCounts.set(key, (state.dailyCounts.get(key) || 0) + 1);
            user.insights30 += 1;
            const inputs = insightData.inputs;
            const entries = Array.isArray(inputs) ? inputs.length : 0;
            user.entries30 += entries;
            state.totalEntries30 += entries;

            const hasCardImage = typeof insightData.cardImageURL === "string" && insightData.cardImageURL.length > 0;
            if (hasCardImage) {
              state.cardImages30 += 1;
              user.cardImages30 += 1;
              state.dailyCardImages.set(key, (state.dailyCardImages.get(key) || 0) + 1);
            }
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
  const metrics = computeMetrics();
  setText("metric-total-users", metrics.totalUsers.toLocaleString());
  setText("metric-new-users", `${metrics.launchUsers.toLocaleString()} since launch + ${FOUNDER_USER_ADJUSTMENT} founders`);
  setText("metric-active-7", metrics.active7.toLocaleString());
  setText("metric-active-rate", `${percent(metrics.active7, metrics.totalUsers)} of total users`);
  setText("metric-active-30", metrics.active30.toLocaleString());
  setText("metric-premium", metrics.premium.toLocaleString());
  setText("metric-premium-rate", `${percent(metrics.premium, metrics.totalUsers)} premium / granted`);
  setText("metric-insights", metrics.insights30.toLocaleString());
  setText("metric-entries", `${state.totalEntries30.toLocaleString()} entries captured`);
  setText("metric-card-images", state.cardImages30.toLocaleString());
  setText("metric-card-image-rate", `${percent(state.cardImages30, Math.max(1, metrics.insights30))} of insights have cards`);

  renderBarChart();
  renderUserGrowthChart();
  renderRetention(metrics.retained, metrics.totalUsers);
  renderInteresting(metrics);
  renderUsers();
  renderCosts();
}

function computeMetrics() {
  const now = new Date();
  const launchUsers = state.users.filter((u) => !u.createdAt || u.createdAt >= LAUNCH_DATE).length;
  const totalUsers = launchUsers + FOUNDER_USER_ADJUSTMENT;
  const active7 = state.users.filter((u) => isWithinDays(u.lastActiveAt, now, 7)).length;
  const active30 = state.users.filter((u) => isWithinDays(u.lastActiveAt, now, 30)).length;
  const premium = state.users.filter((u) => u.isPaidSubscriber || u.grantedPremium).length;
  const paidSubscribers = state.users.filter((u) => u.isPaidSubscriber).length;
  const retained = state.users.filter(hasMultiWeekUsage).length;
  const insights30 = [...state.dailyCounts.values()].reduce((sum, count) => sum + count, 0);
  return { totalUsers, launchUsers, active7, active30, premium, paidSubscribers, retained, insights30 };
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

function renderUserGrowthChart() {
  const today = startOfDay(new Date());
  const days = daysBetween(LAUNCH_DATE, today);
  const points = days.map((day) => {
    const count = state.users.filter((u) => !u.createdAt || startOfDay(u.createdAt) <= day).length + FOUNDER_USER_ADJUSTMENT;
    return { day, value: count };
  });
  drawLineChart($("users-line-chart"), [{ points, className: "chart-line" }], { yPrefix: "", fill: true });
}

function renderRetention(retained, totalUsers) {
  const pct = Math.round((retained / Math.max(1, totalUsers)) * 100);
  $("retention-chart").innerHTML = `
    <div class="ring" style="--value:${pct}%">
      <div class="ring-inner"><div><strong>${pct}%</strong><span>${retained.toLocaleString()} users</span></div></div>
    </div>
    <p class="user-meta">Users with insights in two or more calendar weeks.</p>`;
}

function renderInteresting(metrics) {
  const items = [];
  const avgEntries = metrics.insights30 ? (state.totalEntries30 / metrics.insights30).toFixed(1) : "0.0";
  const topUsers = [...state.users].sort((a, b) => b.insights30 - a.insights30).slice(0, 3).filter((u) => u.insights30 > 0);
  const stalePremium = state.users.filter((u) => (u.isPaidSubscriber || u.grantedPremium) && !isWithinDays(u.lastActiveAt, new Date(), 14));
  const busiest = busiestDay(state.dailyCounts);
  const cardDay = busiestDay(state.dailyCardImages);
  if (busiest) items.push(`<strong>${formatDay(busiest.day)} was the busiest insight day</strong> in the last 30 days, with ${busiest.count} generated insight${busiest.count === 1 ? "" : "s"}.`);
  if (cardDay) items.push(`<strong>${formatDay(cardDay.day)} led card generation</strong> with ${cardDay.count} card image${cardDay.count === 1 ? "" : "s"}, a useful proxy for high-intent engagement.`);
  items.push(`<strong>Depth signal:</strong> people add about ${avgEntries} sign/input${avgEntries === "1.0" ? "" : "s"} per generated insight over the last 30 days.`);
  items.push(`<strong>Retention pulse:</strong> ${percent(metrics.retained, metrics.totalUsers)} of users have returned across multiple weeks, a useful proxy for habit formation.`);
  if (topUsers.length) items.push(`<strong>Most engaged recently:</strong> ${topUsers.map((u) => escapeHtml(u.displayName)).join(", ")} generated the most insights in the last 30 days.`);
  if (stalePremium.length) items.push(`<strong>Win-back opportunity:</strong> ${stalePremium.length} premium/granted user${stalePremium.length === 1 ? "" : "s"} have not been active in 14+ days.`);
  $("insights-list").innerHTML = items.map((item) => `<div class="insight-item">${item}</div>`).join("");
}

function renderCosts() {
  const metrics = computeMetrics();
  const subPrice = numberValue("assumption-sub-price", 7.99);
  const textCost = numberValue("assumption-text-cost", 0.004);
  const imageCost = numberValue("assumption-image-cost", 0.04);
  const textSpend = metrics.insights30 * textCost;
  const imageSpend = state.cardImages30 * imageCost;
  const totalCost = textSpend + imageSpend;
  const revenue = metrics.paidSubscribers * subPrice;
  const margin = revenue - totalCost;
  const costPerInsight = totalCost / Math.max(1, metrics.insights30);

  setText("metric-api-cost", money(totalCost));
  setText("metric-cost-breakdown", `${money(textSpend)} text · ${money(imageSpend)} images`);
  setText("metric-revenue", money(revenue));
  setText("metric-revenue-note", `${metrics.paidSubscribers} paid subscriber${metrics.paidSubscribers === 1 ? "" : "s"} × ${money(subPrice)}`);
  setText("metric-margin", money(margin));
  setText("metric-margin-note", margin >= 0 ? "Estimated profitable before platform fees" : "API cost currently above subscription revenue");
  setText("metric-cost-per-insight", money(costPerInsight));

  const today = startOfDay(new Date());
  const days = Array.from({ length: 30 }, (_, index) => addDays(today, index - 29));
  let cumulativeCost = 0;
  const costPoints = days.map((day, index) => {
    const key = dayKey(day);
    cumulativeCost += (state.dailyCounts.get(key) || 0) * textCost + (state.dailyCardImages.get(key) || 0) * imageCost;
    return { day, value: cumulativeCost };
  });
  const revenuePoints = days.map((day, index) => ({ day, value: revenue * ((index + 1) / 30) }));
  drawLineChart($("profit-chart"), [
    { points: revenuePoints, className: "chart-line revenue" },
    { points: costPoints, className: "chart-line cost" }
  ], { yPrefix: "$", fill: false });

  const breakEvenInsights = textCost > 0 ? Math.max(0, Math.floor((revenue - imageSpend) / textCost)) : 0;
  const items = [
    `<strong>Profitability goal:</strong> estimated 30-day gross margin is ${money(margin)} (${money(revenue)} revenue minus ${money(totalCost)} API cost).`,
    `<strong>Image generation is the biggest lever:</strong> ${state.cardImages30.toLocaleString()} card images × ${money(imageCost)} = ${money(imageSpend)} in estimated image spend.`,
    `<strong>Text insight cost:</strong> ${metrics.insights30.toLocaleString()} insights × ${money(textCost)} = ${money(textSpend)} in estimated text spend.`,
    `<strong>Break-even watch:</strong> with current paid revenue and image volume, text insights can support roughly ${breakEvenInsights.toLocaleString()} monthly generations before API cost catches revenue.`
  ];
  $("cost-insights-list").innerHTML = items.map((item) => `<div class="insight-item">${item}</div>`).join("");
}

function renderUsers() {
  const query = state.search;
  const users = state.users.filter((u) => !query || `${u.displayName} ${u.email}`.toLowerCase().includes(query)).sort(compareUsers);
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
        <span class="badge">${u.cardImages30} cards</span>
      </div>
    </div>`).join("") || '<div class="insight-item">No matching users.</div>';
}

function compareUsers(a, b) {
  if (state.sort === "paid" && a.isPaidSubscriber !== b.isPaidSubscriber) return a.isPaidSubscriber ? -1 : 1;
  if (state.sort === "alpha" || state.sort === "paid") return alpha(a, b);
  const left = a.lastLoginAt ? a.lastLoginAt.getTime() : 0;
  const right = b.lastLoginAt ? b.lastLoginAt.getTime() : 0;
  if (left !== right) return right - left;
  return alpha(a, b);
}

function drawLineChart(svg, series, options = {}) {
  const width = 920;
  const height = 278;
  const pad = { top: 16, right: 24, bottom: 34, left: 48 };
  const allPoints = series.flatMap((s) => s.points);
  const minV = 0;
  const maxV = Math.max(1, ...allPoints.map((p) => p.value));
  const minT = Math.min(...allPoints.map((p) => p.day.getTime()));
  const maxT = Math.max(...allPoints.map((p) => p.day.getTime()));
  const x = (day) => pad.left + ((day.getTime() - minT) / Math.max(1, maxT - minT)) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - ((value - minV) / Math.max(1, maxV - minV)) * (height - pad.top - pad.bottom);
  const defs = `<defs><linearGradient id="softFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c86f7d" stop-opacity=".35"/><stop offset="1" stop-color="#f59d64" stop-opacity=".03"/></linearGradient></defs>`;
  const grid = [0, .5, 1].map((ratio) => {
    const yy = y(maxV * ratio);
    return `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="rgba(91,62,82,.10)"/><text class="axis-label" x="8" y="${yy + 4}">${options.yPrefix || ""}${Math.round(maxV * ratio)}</text>`;
  }).join("");
  const lines = series.map((s, i) => {
    const d = s.points.map((p, index) => `${index ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const fill = options.fill && i === 0 ? `<path class="chart-fill" d="${d} L ${x(s.points.at(-1).day)},${height - pad.bottom} L ${x(s.points[0].day)},${height - pad.bottom} Z"/>` : "";
    return `${fill}<path class="${s.className}" d="${d}"/>`;
  }).join("");
  const first = allPoints[0]?.day || new Date();
  const last = allPoints.at(-1)?.day || new Date();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `${defs}${grid}${lines}<text class="axis-label" x="${pad.left}" y="${height - 8}">${formatDay(first)}</text><text class="axis-label" text-anchor="end" x="${width - pad.right}" y="${height - 8}">${formatDay(last)}</text>`;
}

function alpha(a, b) { return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id); }
function hasMultiWeekUsage(user) { return new Set([...user.insightDays].map(weekKey)).size >= 2; }
function busiestDay(map) { let best = null; for (const [key, count] of map.entries()) if (!best || count > best.count) best = { day: parseDayId(key), count }; return best; }
function setStatus(message, isError = false) { status.textContent = message; status.parentElement.classList.toggle("error", isError); }
function setText(id, text) { $(id).textContent = text; }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function toDate(value) { return value?.toDate ? value.toDate() : value instanceof Date ? value : null; }
function startOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function daysBetween(start, end) { const days = []; for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) days.push(d); return days; }
function isWithinDays(date, now, days) { return date instanceof Date && date >= addDays(startOfDay(now), -(days - 1)); }
function dayKey(date) { return date.toISOString().slice(0, 10); }
function parseDayId(id) { return /^\d{4}-\d{2}-\d{2}$/.test(id) ? new Date(`${id}T00:00:00Z`) : null; }
function weekKey(dayString) { const d = parseDayId(dayString); if (!d) return dayString; const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return `${d.getUTCFullYear()}-${Math.ceil((((d - start) / 86400000) + start.getUTCDay() + 1) / 7)}`; }
function percent(value, total) { return `${Math.round((value / Math.max(1, total)) * 100)}%`; }
function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0 }).format(value); }
function numberValue(id, fallback) { const value = Number($(id).value); return Number.isFinite(value) ? value : fallback; }
function formatTime(date) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatDay(date) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); }
function relativeDate(date) { const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000); return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffDays, "day"); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
