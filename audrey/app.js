'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const palette = ['#b75067', '#728566', '#b28a4e', '#688c9d', '#9475a3', '#c17e64'];
  const state = { coins: [], fixed: [], selected: null, map: null, layer: null, markers: new Map() };
  const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
  const mapped = log => typeof log.lat === 'number' && typeof log.lon === 'number' && Number.isFinite(log.lat) && Number.isFinite(log.lon) && Math.abs(log.lat) <= 90 && Math.abs(log.lon) <= 180;
  const distance = coin => typeof coin.distanceMiles === 'number' && Number.isFinite(coin.distanceMiles) && coin.distanceMiles >= 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function dateValue(value) {
    if (!value) return null;
    const string = String(value);
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(string) ? new Date(`${string}T12:00:00`) : new Date(string);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  function dateLabel(value) { const date = dateValue(value); return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'; }
  function link(url, label = 'View source ↗') {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) return null;
      const node = element('a', 'source', label); node.href = parsed.href; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
    } catch { return null; }
  }
  function precision(log) { return log.precision || 'Approximate location; precision not provided'; }
  function message(text) { $('map-message').hidden = !text; $('map-message').textContent = text || ''; }
  function initMap() {
    if (!window.L) { message('The map library could not load. The travel journal is still available below.'); return; }
    try {
      state.map = L.map('map', { scrollWheelZoom: false, worldCopyJump: true }).setView([25, 0], 2);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, noWrap: true
      }).addTo(state.map);
      const tileWarning = element('p', 'map-note'); tileWarning.id = 'tile-warning'; tileWarning.hidden = true; tileWarning.setAttribute('role', 'status'); $('map').parentElement.append(tileWarning);
      const failedTiles = new Set();
      const showTileHealth = () => { tileWarning.hidden = failedTiles.size === 0; tileWarning.textContent = failedTiles.size ? 'Some map tiles could not load. Pan or zoom to request tiles again; the journal remains available.' : ''; };
      tiles.on('tileerror', event => { failedTiles.add(event.tile); showTileHealth(); });
      tiles.on('tileload', event => { failedTiles.delete(event.tile); showTileHealth(); });
      tiles.on('tileunload', event => { failedTiles.delete(event.tile); showTileHealth(); });
      state.layer = L.featureGroup().addTo(state.map);
      state.map.on('popupopen', () => { $('map-message').hidden = true; });
      state.map.on('popupclose', () => { $('map-message').hidden = !$('map-message').textContent; });
    } catch { state.map = null; message('The map could not start. All available logs are listed below.'); }
  }
  function chosen() { return state.selected === null ? state.coins : state.coins.filter(coin => coin.id === state.selected); }
  function select(id) {
    state.selected = id;
    document.querySelectorAll('.coin-card').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === id)));
    $('reset').setAttribute('aria-pressed', String(id === null));
    drawMap(); drawJournal();
  }
  function drawCards() {
    $('coins').replaceChildren();
    for (const coin of state.coins) {
      const button = element('button', 'coin-card'); button.type = 'button'; button.dataset.id = coin.id; button.style.setProperty('--coin', coin.color); button.setAttribute('aria-pressed', 'false');
      button.append(element('span', 'coin-icon', '♥'));
      const body = element('span'); body.append(element('span', 'coin-title', coin.name), element('span', 'coin-detail', coin.id));
      body.append(element('span', 'coin-detail', coin.logs.length ? `${coin.logs.filter(log => !log.familyReported).length} official logs · ${distance(coin) ? number(coin.distanceMiles) + ' source mi' : 'Miles unavailable'}` : 'No logged travels yet'));
      body.append(element('span', 'coin-state', coin.logs.length ? coin.status || 'Journey in progress' : 'Awaiting the first travel log'));
      button.append(body); button.addEventListener('click', () => select(coin.id)); $('coins').append(button);
    }
    if (!state.coins.length) $('coins').append(element('p', 'muted', 'The little hearts will appear here when public data is available.'));
  }
  function drawFixedCards() {
    for (const place of state.fixed) {
      const button = element('button', 'coin-card fixed-cache-card'); button.type = 'button'; button.dataset.fixedId = place.id; button.style.setProperty('--coin', place.color);
      button.append(element('span', 'coin-icon', '⌖'));
      const body = element('span'); body.append(element('span', 'coin-title', place.location), element('span', 'coin-detail', `${place.id} · Fixed geocache`), element('span', 'coin-state', 'Approximate city location · Not a traveling coin'));
      button.append(body);
      button.addEventListener('click', () => { const marker = state.markers.get(place.id); if (!marker || !state.map) return; state.map.setView(marker.getLatLng(), 10); marker.openPopup(); $('map').scrollIntoView({ block: 'center' }); });
      $('coins').append(button);
    }
  }
  function drawFixedMarkers(bounds) {
    for (const place of state.fixed) {
      const content = element('div'); content.append(element('strong', '', `${place.id} · ${place.name}`), element('p', '', `${place.location} · Fixed geocache`), element('p', 'precision', place.precision));
      const source = link(place.sourceUrl, 'View geocache ↗'); if (source) content.append(source);
      const marker = L.circleMarker([place.lat, place.lon], { radius: 11, color: place.color, weight: 3, fillColor: '#fffdf8', fillOpacity: 1 }).bindPopup(content).bindTooltip(`${place.id} · ${place.location} · Fixed cache`).addTo(state.layer);
      state.markers.set(place.id, marker); if (state.selected === null) bounds.push([place.lat, place.lon]);
    }
  }
  function drawStats() {
    $('coin-count').textContent = number(state.coins.length);
    $('stop-count').textContent = number(state.coins.reduce((sum, coin) => sum + coin.logs.filter(log => mapped(log) && !log.familyReported).length, 0));
    const known = state.coins.filter(distance);
    $('mile-count').textContent = known.length ? number(known.reduce((sum, coin) => sum + coin.distanceMiles, 0)) : '—';
    $('mile-count').title = `${known.length} of ${state.coins.length} coins have a source-recorded distance. Missing distances are excluded.`;
  }
  function markerKey(coin, log) { return JSON.stringify([coin.id, log.id]); }
  function popup(coin, log) {
    const box = element('div'); box.append(element('span', 'log-coin', coin.name), element('br'), element('strong', '', log.cacheName || log.location || 'Logged location'), element('p', '', `${log.dateLabel || dateLabel(log.date)} · ${log.type || 'Travel log'}`), element('p', '', log.location || 'Location name unavailable'), element('p', 'precision', precision(log)));
    const source = link(log.sourceUrl || coin.sourceUrl, log.familyReported ? 'View cache (not a travel log) ↗' : 'View source ↗'); if (source) box.append(source);
    return box;
  }
  // Keep one shared world; dashed connections are illustrative, never actual travel paths.
  function routeCoordinates(logs) {
    return logs.map(log => [log.lat, log.lon]);
  }
  function drawMap() {
    const coins = chosen();
    $('map-label').textContent = state.selected === null ? 'All regional journeys' : coins[0]?.name || 'Regional journey';
    if (!state.map) return;
    state.layer.clearLayers(); state.markers.clear();
    const bounds = [];
    for (const coin of coins) {
      const logs = coin.logs.filter(mapped), points = routeCoordinates(logs);
      if (points.length > 1) L.polyline(points, { color: coin.color, weight: 2.5, opacity: .65, dashArray: '5 8', interactive: false }).addTo(state.layer);
      const regions = new Map();
      logs.forEach((log, i) => {
        const key = `${log.lat},${log.lon}`;
        if (!regions.has(key)) regions.set(key, { point: points[i], logs: [] });
        regions.get(key).logs.push(log);
      });
      for (const region of regions.values()) {
        const latest = region.logs[region.logs.length - 1];
        const content = popup(coin, latest);
        content.prepend(element('p', '', `${region.logs.length} ${region.logs.length === 1 ? 'journal entry' : 'journal entries'} in this approximate region · ${coin.id}`));
        if (region.logs.length > 1) content.append(element('p', '', 'Latest log shown here. Every log appears in the journal below.'));
        const marker = L.circleMarker(region.point, { radius: 8, color: '#fffdf8', weight: 2, fillColor: coin.color, fillOpacity: 1 }).bindPopup(content).addTo(state.layer);
        marker.bindTooltip(`${coin.name} · ${coin.id} · ${region.logs.length} regional logs`, { direction: 'top' });
        region.logs.forEach(log => state.markers.set(markerKey(coin, log), marker));
        bounds.push(region.point);
      }
    }
    drawFixedMarkers(bounds);
    if (bounds.length) { state.map.fitBounds(bounds, { padding: [45, 45], maxZoom: 6 }); message('Regional overview · approximate locations, not cache coordinates'); }
    else { state.map.setView([25, 0], 2); message(coins.some(coin => coin.logs.length) ? 'These logs have no public map locations. Read their stories below.' : 'No logged travels to map yet. A little adventure is still ahead.'); }
  }
  function drawJournal() {
    const coins = chosen(), entries = coins.flatMap(coin => [...coin.logs].reverse().map(log => ({ coin, log })));
    entries.sort((a, b) => (dateValue(b.log.date)?.getTime() ?? -Infinity) - (dateValue(a.log.date)?.getTime() ?? -Infinity));
    $('journal-count').textContent = `${number(entries.length)} ${entries.length === 1 ? 'entry' : 'entries'} · newest first`;
    $('journal-intro').textContent = state.selected === null ? 'The latest adventures first, followed by earlier moments along the way.' : `Following ${coins[0]?.name || 'this little heart'}, newest moments first.`;
    $('timeline').replaceChildren();
    if (!entries.length) {
      const empty = element('div', 'empty'); empty.append(element('h3', '', state.coins.length ? 'An adventure waiting to happen' : 'The journal is waiting for its first page'), element('p', '', state.coins.length ? 'No logged travels yet for this selection. Nothing has been added to the map or imagined along the way.' : 'No public coin data is available yet. Check back after the next data update.'));
      if (state.selected !== null) { const source = link(coins[0]?.sourceUrl, 'Visit the public trackable page ↗'); if (source) empty.append(source); }
      $('timeline').append(empty); return;
    }
    for (const { coin, log } of entries) {
      const row = element('article', 'timeline-row'); row.style.setProperty('--coin', coin.color);
      const time = element('time', 'log-date', log.dateLabel || dateLabel(log.date)); if (dateValue(log.date)) time.dateTime = log.date;
      const track = element('div', 'timeline-track'); track.setAttribute('aria-hidden', 'true'); track.append(element('span', 'timeline-dot'));
      const card = element('div', 'log-card'), top = element('div', 'log-top');
      top.append(element('span', 'log-coin', `♥ ${coin.name}`), element('span', 'log-type', log.type || 'Travel log'));
      card.append(top, element('h3', '', log.cacheName || log.location || 'A moment in the journey'));
      if (log.event) card.append(element('p', 'log-text', log.event));
      if (log.text) card.append(element('p', 'log-text', log.text));
      const bottom = element('div', 'log-bottom');
      if (mapped(log) && state.map) {
        const button = element('button', 'location-button', `⌖ ${log.location || 'View approximate location'} ↗`); button.type = 'button';
        button.addEventListener('click', () => { const marker = state.markers.get(markerKey(coin, log)); if (!marker) return; state.map.setView(marker.getLatLng(), 6, { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches }); marker.openPopup(); $('map').scrollIntoView({ behavior: 'auto', block: 'center' }); }); bottom.append(button);
      } else bottom.append(element('span', 'muted', log.location || 'Location not publicly available'));
      const source = link(log.sourceUrl || coin.sourceUrl, log.familyReported ? 'View cache (not a travel log) ↗' : 'View source ↗'); if (source) bottom.append(source);
      const coordinates = link(log.coordinateSource, 'Region coordinate source ↗'); if (coordinates) bottom.append(coordinates);
      card.append(bottom, element('span', 'precision', mapped(log) ? precision(log) : 'Not mapped · public coordinates unavailable'));
      row.append(time, track, card); $('timeline').append(row);
    }
  }
  function updateAge(value) {
    const date = dateValue(value);
    if (!date) { $('updated').textContent = 'Data update time unavailable.'; return; }
    const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
    const age = hours < 0 ? 'timestamp is in the future; check source clock' : hours < 1 ? 'less than an hour ago' : hours < 24 ? `${hours} hours ago` : `${Math.floor(hours / 24)} days ago`;
    $('updated').textContent = `Data updated ${date.toLocaleString('en-US')} · ${age}${hours > 168 ? ' · May be out of date' : ''}.`;
    $('data-notice').textContent = `Public travel history · Updated ${age}. ${hours > 168 ? 'This snapshot may be out of date; check the source links for the latest logs.' : 'Choose a heart to follow its story.'}`;
  }
  async function load() {
    $('data-notice').classList.remove('error'); $('data-notice').textContent = 'Opening the travel journal…';
    try {
      const response = await fetch(`./data/coins.json?v=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.coins)) throw new Error('Unexpected data format');
      const ids = new Set();
      state.coins = data.coins.map((coin, index) => {
        if (!coin || typeof coin.id !== 'string' || !coin.id || typeof coin.name !== 'string' || !Array.isArray(coin.logs)) throw new Error('Invalid coin record');
        if (ids.has(coin.id)) throw new Error('Duplicate coin identifier'); ids.add(coin.id);
        const logIds = new Set();
        coin.logs.forEach(log => { if (!log || typeof log.id !== 'string' || !log.id || logIds.has(log.id)) throw new Error('Invalid or duplicate log identifier'); logIds.add(log.id); });
        return { ...coin, color: /^#[\da-f]{6}$/i.test(coin.color) ? coin.color : palette[index % palette.length], logs: [...coin.logs].sort((a, b) => (dateValue(a.date)?.getTime() ?? Infinity) - (dateValue(b.date)?.getTime() ?? Infinity)) };
      });
      const familyResponse = await fetch(`./data/family-starts.json?v=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!familyResponse.ok) throw new Error('Family starting locations unavailable');
      const family = await familyResponse.json();
      if (!family || typeof family !== 'object' || Array.isArray(family)) throw new Error('Invalid family starting locations');
      for (const coin of state.coins) {
        const starts = family[coin.id] || [];
        if (!Array.isArray(starts) || starts.some(log => !mapped(log) || !log.familyReported || typeof log.id !== 'string')) throw new Error('Invalid family starting stop');
        coin.logs = [...starts, ...coin.logs];
      }
      const fixedResponse = await fetch(`./data/fixed-locations.json?v=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!fixedResponse.ok) throw new Error('Fixed location data unavailable');
      const fixed = await fixedResponse.json();
      if (!Array.isArray(fixed) || fixed.some(place => !mapped(place) || typeof place.id !== 'string' || typeof place.name !== 'string')) throw new Error('Invalid fixed location data');
      state.fixed = fixed;
      drawStats(); drawCards(); drawFixedCards(); select(null); updateAge(data.updatedAt);
      if (!state.coins.length) $('data-notice').textContent = 'No public coin data is available yet. No journeys or distances have been assumed.';
    } catch (error) {
      state.coins = []; drawCards(); select(null);
      ['coin-count', 'stop-count', 'mile-count'].forEach(id => { $(id).textContent = '—'; });
      const notice = $('data-notice'); notice.classList.add('error'); notice.textContent = `We couldn’t load the public travel data (${error.message}). No travel totals can be shown.`;
      const retry = element('button', '', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load); notice.append(retry);
      $('updated').textContent = 'Data update time unavailable — public data could not be loaded.';
    }
  }
  $('reset').addEventListener('click', () => select(null));
  initMap(); load();
})();
