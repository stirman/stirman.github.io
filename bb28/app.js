const DATA_URL = './data/season.json';
let liveTimer;

const $ = (id) => document.getElementById(id);
const fmtDate = (value) => {
  if (!value) return 'TBD';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase() || '?';
const statusLabel = (status = 'active') => ({
  active: 'In the house',
  evicted: 'Evicted',
  jury: 'Jury house',
  winner: 'Winner',
  pending: 'Awaiting reveal'
}[status] || status.replaceAll('-', ' '));

async function loadSeason() {
  const url = `${DATA_URL}?v=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load season data: ${response.status}`);
  return response.json();
}

function familyById(data) {
  return new Map((data.familyMembers || []).map(member => [member.id, member]));
}

function picksForOwner(data, ownerId) {
  return (data.houseguests || []).filter(guest => guest.draftOwner === ownerId);
}

function renderStats(data) {
  const guests = data.houseguests || [];
  const total = guests.length;
  const active = guests.filter(guest => !['evicted'].includes(guest.status)).length;
  const drafted = guests.filter(guest => guest.draftOwner).length;
  $('tagline').textContent = data.tagline || 'The family draft is entering the house.';
  $('status-ticker').textContent = statusText(data);
  $('stat-total').textContent = total || 'TBD';
  $('stat-active').textContent = total ? active : 'TBD';
  $('stat-drafted').textContent = total ? `${drafted}/${total}` : 'TBD';
  $('stat-updated').textContent = fmtDate(data.lastUpdated);
  $('stat-checked').textContent = `Live checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function statusText(data) {
  const guests = data.houseguests || [];
  const winner = guests.find(guest => guest.status === 'winner');
  if (winner) return `${winner.name} wins BB28 — ${ownerName(data, winner.draftOwner)} takes the draft!`;
  const active = guests.filter(guest => !['evicted'].includes(guest.status));
  if (guests.length && active.length === 1) return `${active[0].name} is the final houseguest standing.`;
  if (guests.length) return `${active.length} houseguests still fighting for the key.`;
  return 'Awaiting cast reveal';
}

function ownerName(data, ownerId) {
  return familyById(data).get(ownerId)?.name || 'Undrafted';
}

function ownerColor(data, ownerId) {
  return familyById(data).get(ownerId)?.color || '#00d5ff';
}

function renderDraftBoard(data) {
  const owners = data.familyMembers || [];
  const grid = $('owner-grid');
  if (!owners.length) {
    grid.innerHTML = emptyState('Draft board locked', 'Send the family member list and draft results after the draft. This board is ready for picks, evictions, jury status, and the final winner.');
    return;
  }
  grid.innerHTML = owners.map(owner => {
    const picks = picksForOwner(data, owner.id);
    const pickItems = picks.length
      ? picks.map(guest => `<li><span>${guest.name}</span><small>${statusLabel(guest.status)}</small></li>`).join('')
      : '<li><span>No picks yet</span><small>Draft pending</small></li>';
    return `
      <article class="owner-card" style="--owner-color:${owner.color || '#00d5ff'}">
        <div class="owner-name"><strong>${escapeHtml(owner.name)}</strong><span>${picks.length} picks</span></div>
        <ul class="pick-list">${pickItems}</ul>
      </article>
    `;
  }).join('');
}

function renderPlayers(data) {
  const players = data.familyMembers || [];
  const grid = $('player-grid');
  if (!players.length) {
    grid.innerHTML = emptyState('Players pending', 'Draft players will appear here before houseguests are assigned.');
    return;
  }
  grid.innerHTML = players.map(player => {
    const picks = picksForOwner(data, player.id);
    const pickCount = picks.length;
    return `
      <article class="player-card" style="--owner-color:${escapeAttr(player.color || '#00d5ff')}">
        <strong>${escapeHtml(player.name)}</strong>
        <span>${pickCount ? `${pickCount} pick${pickCount === 1 ? '' : 's'}` : 'Awaiting draft'}</span>
      </article>
    `;
  }).join('');
}

function renderWeeklyWinners(data) {
  const weeks = data.weeklyResults || [];
  const grid = $('weekly-grid');
  if (!weeks.length) {
    grid.innerHTML = emptyState('Waiting on the first competitions', 'Head of Household and Power of Veto winners will appear here week by week once the season starts.');
    return;
  }
  grid.innerHTML = weeks.map(week => {
    const hoh = competitionWinner(week.hoh);
    const pov = competitionWinner(week.pov);
    const weekLabel = week.label || `Week ${week.week}`;
    const date = week.date ? `<time>${escapeHtml(fmtDate(week.date))}</time>` : '';
    return `
      <article class="week-card">
        <div class="week-heading">
          <div>
            <span class="week-kicker">${escapeHtml(weekLabel)}</span>
            ${date}
          </div>
          ${week.status ? `<span class="week-status">${escapeHtml(week.status)}</span>` : ''}
        </div>
        <div class="competition-row">
          <span>HOH</span>
          <strong>${escapeHtml(hoh)}</strong>
        </div>
        <div class="competition-row">
          <span>POV</span>
          <strong>${escapeHtml(pov)}</strong>
        </div>
        ${week.notes ? `<p class="week-notes">${escapeHtml(week.notes)}</p>` : ''}
      </article>
    `;
  }).join('');
}

function competitionWinner(value) {
  if (!value) return 'TBD';
  if (typeof value === 'string') return value;
  return value.winner || value.name || value.houseguest || 'TBD';
}

function renderHouseguests(data) {
  const guests = data.houseguests || [];
  const grid = $('houseguest-grid');
  if (!guests.length) {
    grid.innerHTML = emptyState('The front door is still closed', 'Contestants will appear here after the official BB28 reveal. Draft owner badges and eviction status are already wired up.');
    return;
  }
  grid.innerHTML = guests.map(guest => {
    const status = guest.status || 'active';
    const owner = guest.draftOwner ? ownerName(data, guest.draftOwner) : 'Undrafted';
    const meta = [guest.age && `Age ${guest.age}`, guest.hometown, guest.occupation].filter(Boolean).join(' • ');
    const photo = guest.photoUrl ? `
      <button class="guest-image guest-image-button" type="button" data-lightbox-src="${escapeAttr(guest.photoUrl)}" data-lightbox-caption="${escapeAttr(guest.name)}" aria-label="Open larger photo of ${escapeAttr(guest.name)}">
        <img class="guest-photo" src="${escapeAttr(guest.photoUrl)}" alt="${escapeAttr(`${guest.name} BB28 cast photo`)}" decoding="async" referrerpolicy="no-referrer" onerror="this.remove(); this.parentElement.classList.add('photo-fallback')">
        <span class="image-expand-hint">Tap to enlarge</span>
      </button>
    ` : '';
    const source = guest.sourceUrl ? `<a class="source-link" href="${escapeAttr(guest.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>` : '';
    return `
      <article class="guest-card ${escapeAttr(status)}" style="border-color:${ownerColor(data, guest.draftOwner)}66">
        ${photo || `<div class="guest-image photo-fallback"><div class="avatar">${escapeHtml(initials(guest.name))}</div></div>`}
        <div>
          <h3>${escapeHtml(guest.name)}</h3>
          <p class="guest-meta">${escapeHtml(meta || 'Details coming soon')}</p>
          ${guest.bio ? `<p class="guest-bio">${escapeHtml(guest.bio)}</p>` : ''}
        </div>
        ${guest.notes ? `<p class="guest-meta">${escapeHtml(guest.notes)}</p>` : ''}
        <div class="draft-owner">Drafted by: ${escapeHtml(owner)} ${source}</div>
      </article>
    `;
  }).join('');
}

function renderTimeline(data) {
  const events = data.events || [];
  $('timeline').innerHTML = events.length ? events.map(event => `
    <li>
      <time>${escapeHtml(fmtDate(event.date))} • ${escapeHtml((event.type || 'event').replaceAll('_', ' '))}</time>
      <strong>${escapeHtml(event.title || 'Season update')}</strong>
      <p>${escapeHtml(event.description || '')}</p>
    </li>
  `).join('') : '<li><strong>No diary room entries yet.</strong></li>';
}

function emptyState(title, message) {
  return `<div class="empty-state"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div></div>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function escapeAttr(value = '') { return escapeHtml(value); }

async function render() {
  try {
    const data = await loadSeason();
    renderStats(data);
    renderDraftBoard(data);
    renderPlayers(data);
    renderWeeklyWinners(data);
    renderHouseguests(data);
    renderTimeline(data);
    const seconds = Number(data.liveRefreshSeconds || 60);
    clearTimeout(liveTimer);
    liveTimer = setTimeout(render, Math.max(15, seconds) * 1000);
  } catch (error) {
    console.error(error);
    $('status-ticker').textContent = 'Diary room technical difficulty — retrying live data.';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(render, 30000);
  }
}

function openLightbox(src, caption) {
  const lightbox = $('image-lightbox');
  const image = $('lightbox-image');
  const label = $('lightbox-caption');
  image.src = src;
  image.alt = caption ? `${caption} BB28 cast photo` : 'BB28 cast photo';
  label.textContent = caption || '';
  lightbox.hidden = false;
  document.body.classList.add('lightbox-open');
}

function closeLightbox() {
  const lightbox = $('image-lightbox');
  const image = $('lightbox-image');
  lightbox.hidden = true;
  image.src = '';
  image.alt = '';
  document.body.classList.remove('lightbox-open');
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-lightbox-src]');
  if (trigger) {
    openLightbox(trigger.dataset.lightboxSrc, trigger.dataset.lightboxCaption);
    return;
  }
  if (event.target.closest('[data-lightbox-close]')) {
    closeLightbox();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('image-lightbox').hidden) closeLightbox();
});

render();
