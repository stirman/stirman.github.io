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

function renderStats(data) {
  const guests = data.houseguests || [];
  const total = guests.length;
  const active = guests.filter(guest => !['evicted', 'jury'].includes(guest.status)).length;
  $('tagline').textContent = data.tagline || 'The family draft is entering the house.';
  $('house-status-count').textContent = total ? `${active}/${total} still in the house` : 'Houseguests';
}

function ownerName(data, ownerId) {
  return familyById(data).get(ownerId)?.name || 'Undrafted';
}

function ownerColor(data, ownerId) {
  return familyById(data).get(ownerId)?.color || '#00d5ff';
}

const POWER_POINTS = { hoh: 5, veto: 3, pov: 3, blockbuster: 2 };

function renderWeeklyWinners(data) {
  const weeks = data.weeklyResults || [];
  renderPowerLeaderboard(data, weeks);
  renderPlayerLeaderboard(data, weeks);
  const grid = $('weekly-grid');
  if (!weeks.length) {
    grid.innerHTML = emptyState('Waiting on the first competitions', 'Head of Household, Veto, and Blockbuster winners will appear here week by week once the season starts.');
    return;
  }
  grid.innerHTML = weeks.map(week => {
    const competitions = weeklyCompetitions(week);
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
        ${competitions.map(comp => `
          <div class="competition-row">
            <span class="competition-label ${normalizeCompetitionKey(comp.key || comp.label) === 'blockbuster' ? 'competition-label-blockbuster' : ''}">${normalizeCompetitionKey(comp.key || comp.label) === 'blockbuster' ? 'Block<br>Buster' : escapeHtml(comp.label)}</span>
            <strong>${escapeHtml(competitionWinner(comp.value))}</strong>
          </div>
        `).join('')}
        ${week.notes ? `<p class="week-notes">${escapeHtml(week.notes)}</p>` : ''}
      </article>
    `;
  }).join('');
}

function weeklyCompetitions(week) {
  const base = [
    { key: 'hoh', label: 'HOH', value: week.hoh },
    { key: 'veto', label: 'Veto', value: week.veto ?? week.pov },
    { key: 'blockbuster', label: 'Blockbuster', value: week.blockbuster }
  ];
  const extras = Array.isArray(week.competitions) ? week.competitions.map(comp => ({
    key: normalizeCompetitionKey(comp.type || comp.key || comp.label),
    label: comp.label || competitionLabel(comp.type || comp.key),
    value: comp.winner || comp.houseguest || comp
  })) : [];
  return [...base, ...extras].filter(comp => comp.value);
}

function normalizeCompetitionKey(value = '') {
  const key = String(value).toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'pov' || key === 'powerofveto') return 'veto';
  if (key.includes('blockbuster')) return 'blockbuster';
  if (key.includes('hoh') || key.includes('head')) return 'hoh';
  return key;
}

function competitionLabel(value = '') {
  const key = normalizeCompetitionKey(value);
  if (key === 'hoh') return 'HOH';
  if (key === 'veto') return 'Veto';
  if (key === 'blockbuster') return 'Blockbuster';
  return value || 'Power';
}

function competitionWinner(value) {
  if (!value) return 'TBD';
  if (typeof value === 'string') return value;
  return value.winner || value.name || value.houseguest || 'TBD';
}

function competitionWinnerId(value, data) {
  if (!value) return '';
  if (typeof value === 'object' && (value.houseguestId || value.id)) return value.houseguestId || value.id;
  const winner = competitionWinner(value).toLowerCase();
  return (data.houseguests || []).find(guest => guest.name.toLowerCase() === winner)?.id || '';
}

function renderPowerLeaderboard(data, weeks) {
  const target = $('power-leaderboard');
  const rows = buildPowerLeaderboard(data, weeks);
  if (!rows.length) {
    target.innerHTML = emptyState('Power leaderboard starts soon', 'Once the first HOH, Veto, or Blockbuster winner is known, season-long points will rank every winning houseguest and family member here.');
    return;
  }
  target.innerHTML = `
    <div class="leaderboard-header">
      <div>
        <span class="week-kicker">Season leaderboard</span>
        <h3>Strongest houseguest + family member</h3>
      </div>
      <span class="scoring-key">HOH 5 · Veto 3 · Blockbuster 2</span>
    </div>
    <ol class="leaderboard-list">
      ${rows.map((row, index) => `
        <li class="leaderboard-row" style="--owner-color:${ownerColor(data, row.ownerId)}">
          <span class="rank">#${index + 1}</span>
          <div class="leaderboard-copy">
            <strong>${escapeHtml(row.houseguestName)}</strong>
            <span>${escapeHtml(row.ownerName)} · ${escapeHtml(row.breakdown)}</span>
          </div>
          <b>${row.points}</b>
        </li>
      `).join('')}
    </ol>
  `;
}

function buildPowerLeaderboard(data, weeks) {
  const guestMap = new Map((data.houseguests || []).map(guest => [guest.id, guest]));
  const scores = new Map();
  weeks.forEach(week => weeklyCompetitions(week).forEach(comp => {
    const key = normalizeCompetitionKey(comp.key || comp.label);
    const points = POWER_POINTS[key] || 0;
    if (!points) return;
    const guestId = competitionWinnerId(comp.value, data);
    const guest = guestMap.get(guestId);
    if (!guest) return;
    const current = scores.get(guest.id) || { guest, points: 0, wins: { hoh: 0, veto: 0, blockbuster: 0 } };
    current.points += points;
    current.wins[key] = (current.wins[key] || 0) + 1;
    scores.set(guest.id, current);
  }));
  return [...scores.values()].map(row => ({
    houseguestName: row.guest.name,
    ownerId: row.guest.draftOwner,
    ownerName: ownerName(data, row.guest.draftOwner),
    points: row.points,
    breakdown: scoreBreakdown(row.wins)
  })).sort((a, b) => b.points - a.points || a.houseguestName.localeCompare(b.houseguestName));
}

function scoreBreakdown(wins) {
  const parts = [];
  if (wins.hoh) parts.push(`${wins.hoh} HOH`);
  if (wins.veto) parts.push(`${wins.veto} Veto`);
  if (wins.blockbuster) parts.push(`${wins.blockbuster} Blockbuster`);
  return parts.join(' · ') || 'No wins yet';
}


function renderPlayerLeaderboard(data, weeks) {
  const target = $('player-leaderboard-grid');
  if (!target) return;
  const rows = buildPlayerLeaderboard(data, weeks);
  if (!rows.length) {
    target.innerHTML = emptyState('Player photos are warming up', 'Individual family player standings will appear here once player data is added.');
    return;
  }
  target.innerHTML = rows.map((row, index) => `
    <article class="player-card" style="--player-color:${escapeAttr(row.color || '#00d5ff')}">
      <div class="player-rank">#${index + 1}</div>
      <div class="player-photo" style="background-image:url('${escapeAttr(row.photoUrl)}'); background-position:${escapeAttr(row.photoPosition || 'center')}" role="img" aria-label="${escapeAttr(`${row.name} player photo`)}"></div>
      <div class="player-copy">
        <div class="player-title-row">
          <div class="player-identity">
            <h3>${escapeHtml(row.name)}</h3>
            <p>${escapeHtml(row.groupName)}</p>
          </div>
          <div class="player-score"><strong>${row.points}</strong><span>pts</span></div>
        </div>
        <div class="player-breakdown">${escapeHtml(row.breakdown)}</div>
        ${row.sources.length ? `<ul class="player-sources">${row.sources.map(source => `<li>${escapeHtml(source)}</li>`).join('')}</ul>` : '<p class="player-sources-empty">Waiting on first competition points</p>'}
      </div>
    </article>
  `).join('');
}

function buildPlayerLeaderboard(data, weeks) {
  const players = data.players || [];
  const familyMap = familyById(data);
  const playerGroups = data.playerGroups || {};
  const playersById = new Map(players.map(player => [player.id, player]));
  const rows = new Map(players.map((player, index) => [player.id, {
    ...player,
    sortOrder: index,
    points: 0,
    wins: { hoh: 0, veto: 0, blockbuster: 0 },
    sources: [],
    groupName: familyMap.get(player.scoringGroup)?.name || player.scoringGroup || 'Solo pick'
  }]));
  const guestMap = new Map((data.houseguests || []).map(guest => [guest.id, guest]));
  weeks.forEach(week => weeklyCompetitions(week).forEach(comp => {
    const key = normalizeCompetitionKey(comp.key || comp.label);
    const points = POWER_POINTS[key] || 0;
    if (!points) return;
    const guest = guestMap.get(competitionWinnerId(comp.value, data));
    if (!guest?.draftOwner) return;
    const playerIds = playerGroups[guest.draftOwner] || (playersById.has(guest.draftOwner) ? [guest.draftOwner] : []);
    playerIds.forEach(playerId => {
      const row = rows.get(playerId);
      if (!row) return;
      row.points += points;
      row.wins[key] = (row.wins[key] || 0) + 1;
      row.sources.push(`${competitionLabel(key)}: ${guest.name} (+${points})`);
    });
  }));
  return [...rows.values()].map(row => ({
    ...row,
    breakdown: scoreBreakdown(row.wins)
  })).sort((a, b) => b.points - a.points || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function renderHouseguests(data) {
  const guests = data.houseguests || [];
  const grid = $('houseguest-grid');
  if (!guests.length) {
    grid.innerHTML = emptyState('The front door is still closed', 'Contestants will appear here after the official BB28 reveal.');
    return;
  }
  grid.innerHTML = guests.map(guest => {
    const status = guest.status || 'active';
    const owner = guest.draftOwner ? ownerName(data, guest.draftOwner) : 'Undrafted';
    const meta = [guest.age && `Age ${guest.age}`, guest.hometown, guest.occupation].filter(Boolean).join(' • ');
    const evictedStamp = status === 'evicted'
      ? '<img class="evicted-stamp" src="./assets/evicted-stamp.png" alt="Evicted">'
      : '';
    const photo = guest.photoUrl ? `
      <div class="guest-image has-photo" style="background-image: url('${escapeAttr(guest.photoUrl)}'); background-position: ${escapeAttr(guest.photoPosition || 'center')}" role="img" aria-label="${escapeAttr(`${guest.name} BB28 cast photo`)}">
        ${evictedStamp}
        <div class="owner-ribbon" style="--owner-color:${ownerColor(data, guest.draftOwner)}">${escapeHtml(owner)}</div>
      </div>
    ` : '';
    return `
      <article class="guest-card ${escapeAttr(status)}" style="--owner-color:${ownerColor(data, guest.draftOwner)}; --photo-position:${escapeAttr(guest.photoPosition || 'center')}; border-color:${ownerColor(data, guest.draftOwner)}88">
        ${photo || `<div class="guest-image photo-fallback">${evictedStamp}<div class="avatar">${escapeHtml(initials(guest.name))}</div><div class="owner-ribbon" style="--owner-color:${ownerColor(data, guest.draftOwner)}">${escapeHtml(owner)}</div></div>`}
        <div class="guest-copy">
          <h3>${escapeHtml(guest.name)}</h3>
          <p class="guest-meta">${escapeHtml(meta || 'Details coming soon')}</p>
          ${guest.bio ? `<p class="guest-bio">${escapeHtml(guest.bio)}</p>` : ''}
          ${guest.notes ? `<p class="guest-meta guest-notes">${escapeHtml(guest.notes)}</p>` : ''}
        </div>
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

function renderUpcomingEpisodes(data) {
  const target = $('upcoming-grid');
  if (!target) return;
  const episodes = nextEpisodes(data, 3);
  if (!episodes.length) {
    target.innerHTML = emptyState('Schedule coming soon', 'Upcoming episode times will appear here once the season schedule is available.');
    return;
  }
  target.innerHTML = episodes.map((episode, index) => `
    <article class="episode-card ${index === 0 ? 'next' : ''}">
      <span class="episode-number">${index === 0 ? 'Next' : `#${index + 1}`}</span>
      <div>
        <time>${escapeHtml(episode.dayLabel)}</time>
        <h3>${escapeHtml(episode.dateLabel)}</h3>
        <p>${escapeHtml(episode.timeLabel)}${episode.durationLabel ? ` · ${escapeHtml(episode.durationLabel)}` : ''}</p>
      </div>
    </article>
  `).join('');
}

function nextEpisodes(data, count = 3) {
  const schedule = data.seasonCalendar?.episodeSchedule;
  if (!schedule) return [];
  const weekdayNames = schedule.weekdays || ['Wednesday', 'Thursday', 'Sunday'];
  const weekdaySet = new Set(weekdayNames.map(weekdayIndex));
  const start = parseLocalDate(schedule.startDate || data.seasonCalendar?.premiere);
  const end = parseLocalDate(schedule.endDate || `${new Date().getFullYear()}-12-31`);
  if (!start || !end || !weekdaySet.size) return [];

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cursor = new Date(Math.max(start.getTime(), todayStart.getTime()));
  const [airHour, airMinute] = parseAirtime(schedule.airtime || '8:00 PM');
  const episodes = [];
  while (cursor <= end && episodes.length < count) {
    const iso = localIsoDate(cursor);
    if (weekdaySet.has(cursor.getDay())) {
      const episodeStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), airHour, airMinute);
      if (episodeStart > today) {
        const duration = Number(schedule.explicitDurations?.[iso] || schedule.defaultDurationMinutes || 60);
        episodes.push({
          date: new Date(cursor),
          dayLabel: cursor.toLocaleDateString(undefined, { weekday: 'long' }),
          dateLabel: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          timeLabel: schedule.airtimeLabel || 'CBS',
          durationLabel: duration === 90 ? '90 min' : duration === 60 ? '1 hr' : `${duration} min`
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return episodes;
}

function parseAirtime(value) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return [20, 0];
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = (match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return [hour, minute];
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function localIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekdayIndex(name) {
  return {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }[String(name).toLowerCase()];
}

function shortName(name = '') {
  const parts = String(name).split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[0] : String(name);
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
    renderWeeklyWinners(data);
    renderHouseguests(data);
    renderTimeline(data);
    renderUpcomingEpisodes(data);
    const seconds = Number(data.liveRefreshSeconds || 60);
    clearTimeout(liveTimer);
    liveTimer = setTimeout(render, Math.max(15, seconds) * 1000);
  } catch (error) {
    console.error(error);
    clearTimeout(liveTimer);
    liveTimer = setTimeout(render, 30000);
  }
}


render();
