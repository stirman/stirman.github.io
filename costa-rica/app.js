const itineraryRoot = document.querySelector('#itinerary');
const dateRail = document.querySelector('#dateRail');
const shareButton = document.querySelector('#shareButton');
const toast = document.querySelector('#toast');

const icons = {
  meal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7m3-7v7M5 7h7M8.5 10v11M17 3v18M17 3c2.2 1.8 2.6 5.6 0 8"/></svg>`,
  activity: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c3-2 5-2 8 0s5 2 10 0M3 12c3-2 5-2 8 0s5 2 10 0M6 7c1.8-1.3 3.5-1.4 5.2-.4M17 4v5m-2.5-2.5h5"/></svg>`,
  celebration: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v10H5zM3 11h18M12 11v10M12 11H8.8a2.3 2.3 0 1 1 2.4-2.4L12 11Zm0 0h3.2a2.3 2.3 0 1 0-2.4-2.4L12 11Z"/></svg>`,
  wellness: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-3.2-2.5-5-5.7-5-9.2C7 8.6 9 6 12 3c3 3 5 5.6 5 8.8 0 3.5-1.8 6.7-5 9.2Z"/><path d="M12 21v-8m0 4-3-3m3 1 3-3"/></svg>`
};

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dayId(date) {
  return `day-${date}`;
}

function renderEvent(event) {
  const type = event.type || 'activity';
  const meta = [];
  if (event.location) meta.push(`<span>${escapeHTML(event.location)}</span>`);
  if (event.people) meta.push(`<span>${escapeHTML(event.people)} ${event.people === 1 ? 'person' : 'people'}</span>`);
  if (event.meal && event.meal !== event.title) meta.push(`<span>${escapeHTML(event.meal)}</span>`);

  const tags = [];
  if (event.transport) {
    const label = event.transport === 'Confirmed'
      ? 'Transportation confirmed'
      : event.transport === 'Included'
        ? 'Transportation included'
        : `Transportation · ${event.transport}`;
    tags.push(`<span class="tag transport">${escapeHTML(label)}</span>`);
  }

  const slots = Array.isArray(event.slots) && event.slots.length
    ? `<div class="slots" aria-label="Appointment times">${event.slots.map(slot => `<span class="slot">${escapeHTML(slot)}</span>`).join('')}</div>`
    : '';

  return `
    <article class="event" data-type="${escapeHTML(type)}">
      <div class="event-icon">${icons[type] || icons.activity}</div>
      <div class="event-main">
        <h4>${escapeHTML(event.title)}</h4>
        ${meta.length ? `<p class="event-meta">${meta.join('')}</p>` : ''}
        ${slots}
      </div>
      ${event.time ? `<time class="event-time">${escapeHTML(event.time)}</time>` : ''}
      ${tags.length ? `<div class="event-tags">${tags.join('')}</div>` : ''}
    </article>`;
}

function renderDay(day, index) {
  const number = String(index + 1).padStart(2, '0');
  const art = day.art
    ? `<figure class="day-art"><img src="${escapeHTML(day.art)}" alt="${escapeHTML(day.artAlt || '')}"></figure>`
    : '';

  return `
    <article class="day" id="${dayId(day.date)}" data-date="${escapeHTML(day.date)}">
      <aside class="day-index" aria-hidden="true"><span class="day-number">${number}</span></aside>
      <div class="day-content">
        <header class="day-head">
          <div>
            <p class="day-date">${escapeHTML(day.weekday)} · ${escapeHTML(day.shortDate)}</p>
            <h3>${escapeHTML(day.title)}</h3>
            <p class="day-summary">${escapeHTML(day.summary)}</p>
          </div>
          <span class="day-kicker">${escapeHTML(day.kicker)}</span>
        </header>
        ${art}
        <div class="events">${day.events.map(renderEvent).join('')}</div>
      </div>
    </article>`;
}

function renderRail(days) {
  dateRail.innerHTML = days.map((day, index) => `
    <a class="day-link${index === 0 ? ' active' : ''}" href="#${dayId(day.date)}" data-target="${dayId(day.date)}">
      <strong>${escapeHTML(day.shortDate)}</strong>
      <span>${escapeHTML(day.weekday.slice(0, 3))}</span>
    </a>`).join('');
}

function trackDays() {
  const links = [...document.querySelectorAll('.day-link')];
  const sections = [...document.querySelectorAll('.day')];
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach(link => link.classList.toggle('active', link.dataset.target === visible.target.id));
    const active = links.find(link => link.classList.contains('active'));
    active?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
  }, {rootMargin: '-30% 0px -58% 0px', threshold: [0, .15, .4]});

  sections.forEach(section => observer.observe(section));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

async function sharePage() {
  const shareData = {
    title: 'Pura Vida, Family — Costa Rica 2026',
    text: 'Here’s our Costa Rica family itinerary!',
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Link copied!');
  } catch {
    showToast('Copy the link from your address bar');
  }
}

async function loadItinerary() {
  try {
    const response = await fetch(`./data/itinerary.json?v=${Date.now()}`, {cache: 'no-store'});
    if (!response.ok) throw new Error(`Itinerary request failed: ${response.status}`);
    const data = await response.json();
    renderRail(data.days);
    itineraryRoot.innerHTML = data.days.map(renderDay).join('');
    trackDays();
  } catch (error) {
    console.error(error);
    itineraryRoot.innerHTML = '<p class="loading">The itinerary could not be loaded. Please refresh and try again.</p>';
  }
}

shareButton.addEventListener('click', sharePage);
loadItinerary();
