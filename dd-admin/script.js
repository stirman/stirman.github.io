const ADMIN_PASSWORD = "l0ve";
const SESSION_KEY = "daily-divine-admin-unlocked";
const METRICS_URL = "./data/metrics.json";

const $ = (id) => document.getElementById(id);
const state = {
  metrics: null,
  users: [],
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

$("refresh").addEventListener("click", () => loadMetrics(true));
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

$("assumption-sub-price").addEventListener("input", renderCosts);

if (sessionStorage.getItem(SESSION_KEY) === "true") unlock();

function unlock() {
  $("login").classList.add("is-hidden");
  $("dashboard").classList.remove("is-hidden");
  loadMetrics();
}

async function loadMetrics(force = false) {
  setStatus(force ? "Refreshing cached metrics…" : "Loading cached metrics…");
  try {
    const url = `${METRICS_URL}?t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.metrics = await response.json();
    state.users = (state.metrics.users || []).map((user) => ({
      ...user,
      lastLoginAtDate: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
      lastActiveAtDate: user.lastActiveAt ? new Date(user.lastActiveAt) : null
    }));
    if (state.metrics.costs?.subscriptionPrice) {
      $("assumption-sub-price").value = Number(state.metrics.costs.subscriptionPrice).toFixed(2);
    }
    renderAll();
    setStatus(buildStatusMessage(state.metrics));
  } catch (error) {
    console.error(error);
    setStatus("Couldn’t load cached metrics yet. The hourly updater may not have published the first snapshot yet.", true);
  }
}

function renderAll() {
  if (!state.metrics) return;
  const overview = state.metrics.overview;
  setText("metric-total-users", formatNumber(overview.totalUsers));
  setText("metric-new-users", `${formatNumber(overview.launchUsers)} since launch (plus founders already counted in total)`);
  setText("metric-active-7", formatNumber(overview.active7));
  setText("metric-active-rate", `${percent(overview.active7, overview.totalUsers)} of total users`);
  setText("metric-active-30", formatNumber(overview.active30));
  setText("metric-premium", formatNumber(overview.premium));
  setText("metric-premium-rate", `${percent(overview.premium, overview.totalUsers)} premium / granted`);
  setText("metric-insights", formatNumber(overview.insights30));
  setText("metric-entries", `${formatNumber(overview.entries30)} entries captured`);
  setText("metric-card-images", formatNumber(overview.cardImages30));
  setText("metric-card-image-rate", `${percent(overview.cardImages30, Math.max(1, overview.insights30))} of insights have cards`);

  renderBarChart($("insight-chart"), state.metrics.series.dailyInsights, "insight", "insights");
  renderBarChart($("users-growth-chart"), state.metrics.series.totalUsers, "total user", "total users", true);
  renderRetention(overview.retainedUsers, overview.totalUsers);
  renderInteresting();
  renderUsers();
  renderCosts();
}

function renderBarChart(container, series, singular, plural, sparseLabels = false) {
  container.innerHTML = "";
  const max = Math.max(1, ...(series || []).map((item) => item.count || 0));
  const labelEvery = sparseLabels ? Math.max(1, Math.ceil(series.length / 12)) : 1;
  (series || []).forEach((item, index) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(4, ((item.count || 0) / max) * 100)}%`;
    bar.dataset.label = index % labelEvery === 0 || index === series.length - 1 ? compactLabel(item.label) : "";
    const noun = item.count === 1 ? singular : plural;
    bar.dataset.tip = `${item.label} · ${formatNumber(item.count || 0)} ${noun}`;
    container.appendChild(bar);
  });
}

function renderRetention(retained, totalUsers) {
  const pct = Math.round((retained / Math.max(1, totalUsers)) * 100);
  $("retention-chart").innerHTML = `
    <div class="ring" style="--value:${pct}%">
      <div class="ring-inner"><div><strong>${pct}%</strong><span>${formatNumber(retained)} users</span></div></div>
    </div>
    <p class="user-meta">Users with insights in two or more calendar weeks.</p>`;
}

function renderInteresting() {
  const overview = state.metrics.overview;
  const users = state.users;
  const items = [];
  const avgEntries = overview.insights30 ? (overview.entries30 / Math.max(1, overview.insights30)).toFixed(1) : "0.0";
  const topUsers = [...users].sort((a, b) => b.insights30 - a.insights30).slice(0, 3).filter((u) => u.insights30 > 0);
  const stalePremium = users.filter((u) => (u.isPaidSubscriber || u.grantedPremium) && !isWithinDays(u.lastActiveAtDate, 14));
  const busiestInsights = busiestDay(state.metrics.series.dailyInsights);
  const busiestCards = busiestDay(state.metrics.series.dailyCardImages);

  if (busiestInsights) items.push(`<strong>${busiestInsights.label} was the busiest insight day</strong> with ${formatNumber(busiestInsights.count)} generated insight${busiestInsights.count === 1 ? "" : "s"}.`);
  if (busiestCards) items.push(`<strong>${busiestCards.label} led card generation</strong> with ${formatNumber(busiestCards.count)} card image${busiestCards.count === 1 ? "" : "s"}.`);
  items.push(`<strong>Depth signal:</strong> users averaged about ${avgEntries} inputs per generated insight in the last 30 days.`);
  items.push(`<strong>Retention pulse:</strong> ${percent(overview.retainedUsers, overview.totalUsers)} of users have returned across multiple weeks.`);
  if (topUsers.length) items.push(`<strong>Most engaged recently:</strong> ${topUsers.map((u) => escapeHtml(u.displayName)).join(", ")} generated the most insights in the last 30 days.`);
  if (stalePremium.length) items.push(`<strong>Win-back opportunity:</strong> ${stalePremium.length} premium/granted user${stalePremium.length === 1 ? "" : "s"} have not been active in 14+ days.`);

  $("insights-list").innerHTML = items.map((item) => `<div class="insight-item">${item}</div>`).join("");
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
        <p class="user-meta">${escapeHtml(u.email || u.id)}<br>${u.lastLoginAtDate ? `Last login ${relativeDate(u.lastLoginAtDate)}` : "No login timestamp"}</p>
      </div>
      <div class="badges">
        ${u.isPaidSubscriber ? '<span class="badge paid">PAID</span>' : ""}
        ${u.grantedPremium ? '<span class="badge granted">GRANTED</span>' : ""}
        <span class="badge">${formatNumber(u.insights30)} insights</span>
        <span class="badge">${formatNumber(u.cardImages30)} cards</span>
      </div>
    </div>
  `).join("") || '<div class="insight-item">No matching users.</div>';
}

function renderCosts() {
  if (!state.metrics) return;
  const costs = state.metrics.costs || {};
  const overview = state.metrics.overview;
  const subPrice = numberValue("assumption-sub-price", costs.subscriptionPrice || 7.99);
  const revenue = overview.paidSubscribers * subPrice;
  const totalCost = Number(costs.totalDollars || 0);
  const grossMargin = revenue - totalCost;
  const costPerInsight = totalCost / Math.max(1, overview.insights30);

  setText("metric-api-cost", money(totalCost));
  setText("metric-cost-breakdown", `${money(costs.textDollars || 0)} text · ${money(costs.imageDollars || 0)} images · ${money(costs.otherDollars || 0)} other`);
  setText("metric-revenue", money(revenue));
  setText("metric-revenue-note", `${overview.paidSubscribers} paid subscriber${overview.paidSubscribers === 1 ? "" : "s"} × ${money(subPrice)}`);
  setText("metric-margin", money(grossMargin));
  setText("metric-margin-note", grossMargin >= 0 ? "Estimated profitable before platform fees" : "API cost currently above subscription revenue");
  setText("metric-cost-per-insight", money(costPerInsight));

  const costSeries = (state.metrics.series.dailyCosts || []).map((item) => ({ day: item.label, value: item.totalDollars || 0 }));
  const cumulativeCosts = [];
  let costRunning = 0;
  costSeries.forEach((item, index) => {
    costRunning += item.value;
    cumulativeCosts.push({ day: item.day, value: costRunning });
  });
  const cumulativeRevenue = costSeries.map((item, index) => ({ day: item.day, value: revenue * ((index + 1) / Math.max(1, costSeries.length)) }));
  drawLineChart($("profit-chart"), [
    { points: cumulativeRevenue, className: "chart-line revenue" },
    { points: cumulativeCosts, className: "chart-line cost" }
  ]);

  const items = [];
  if (costs.available) {
    items.push(`<strong>Real API cost cache:</strong> ${money(totalCost)} across the cached 30-day window, pulled server-side with the Admin API and published into the hourly metrics snapshot.`);
    items.push(`<strong>Biggest cost bucket:</strong> ${renderTopLineItem(costs.byLineItem || [])}.`);
  } else {
    items.push(`<strong>API cost cache unavailable:</strong> ${escapeHtml(costs.error || "No Admin API cost data yet.")}`);
  }
  items.push(`<strong>Revenue estimate:</strong> ${overview.paidSubscribers} paid subscriber${overview.paidSubscribers === 1 ? "" : "s"} at ${money(subPrice)} monthly implies about ${money(revenue)} in monthly recurring revenue.`);
  items.push(`<strong>Snapshot freshness:</strong> this page is powered by an hourly cached metrics file, so it should stay fast and usually be less than an hour old.`);
  $("cost-insights-list").innerHTML = items.map((item) => `<div class="insight-item">${item}</div>`).join("");
}

function compareUsers(a, b) {
  if (state.sort === "paid" && a.isPaidSubscriber !== b.isPaidSubscriber) return a.isPaidSubscriber ? -1 : 1;
  if (state.sort === "alpha" || state.sort === "paid") return alpha(a, b);
  const left = a.lastLoginAtDate ? a.lastLoginAtDate.getTime() : 0;
  const right = b.lastLoginAtDate ? b.lastLoginAtDate.getTime() : 0;
  if (left !== right) return right - left;
  return alpha(a, b);
}

function drawLineChart(svg, series) {
  const width = 920;
  const height = 278;
  const pad = { top: 16, right: 24, bottom: 34, left: 48 };
  const allPoints = series.flatMap((s) => s.points);
  const maxV = Math.max(1, ...allPoints.map((p) => p.value));
  const x = (index, total) => pad.left + (index / Math.max(1, total - 1)) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - (value / maxV) * (height - pad.top - pad.bottom);
  const defs = `<defs><linearGradient id="softFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c86f7d" stop-opacity=".20"/><stop offset="1" stop-color="#f59d64" stop-opacity=".02"/></linearGradient></defs>`;
  const grid = [0, 0.5, 1].map((ratio) => {
    const yy = y(maxV * ratio);
    return `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="rgba(91,62,82,.10)"/><text class="axis-label" x="8" y="${yy + 4}">$${Math.round(maxV * ratio)}</text>`;
  }).join("");
  const lines = series.map((s) => {
    const d = s.points.map((p, index) => `${index ? "L" : "M"}${x(index, s.points.length).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    return `<path class="${s.className}" d="${d}"/>`;
  }).join("");
  const startLabel = allPoints[0]?.day || "Start";
  const endLabel = allPoints.at(-1)?.day || "Now";
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `${defs}${grid}${lines}<text class="axis-label" x="${pad.left}" y="${height - 8}">${startLabel}</text><text class="axis-label" text-anchor="end" x="${width - pad.right}" y="${height - 8}">${endLabel}</text>`;
}

function buildStatusMessage(metrics) {
  const generated = new Date(metrics.generatedAt);
  const ageMinutes = Math.max(0, Math.round((Date.now() - generated.getTime()) / 60000));
  const freshness = ageMinutes > (metrics.refreshCadenceMinutes || 60) + 10 ? ` · stale by about ${ageMinutes} min` : ` · about ${ageMinutes} min old`;
  return `Showing cached metrics updated ${metrics.generatedAtHuman || generated.toLocaleString()}${freshness}.`;
}

function renderTopLineItem(items) {
  if (!items.length) return "No cost line items yet";
  const top = items[0];
  return `${escapeHtml(top.name)} at ${money(top.dollars)}`;
}

function busiestDay(series) { return [...(series || [])].sort((a, b) => (b.count || 0) - (a.count || 0))[0]; }
function alpha(a, b) { return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id); }
function isWithinDays(date, days) { return date instanceof Date && date >= new Date(Date.now() - (days * 86400000)); }
function compactLabel(label) { return String(label || "").replace(/\s+/g, ""); }
function setStatus(message, isError = false) { status.textContent = message; status.parentElement.classList.toggle("error", isError); }
function setText(id, text) { $(id).textContent = text; }
function percent(value, total) { return `${Math.round((value / Math.max(1, total)) * 100)}%`; }
function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0 }).format(Number(value || 0)); }
function numberValue(id, fallback) { const value = Number($(id).value); return Number.isFinite(value) ? value : fallback; }
function formatNumber(value) { return Number(value || 0).toLocaleString(); }
function relativeDate(date) { const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000); return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffDays, "day"); }
function startOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
