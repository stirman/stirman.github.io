const state = { dogs: [], query: '', milo: false, withPhoto: false, sort: 'recent' };
const $ = id => document.getElementById(id);
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function fmtDate(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso || 'Unknown';
  }
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function foundTime(dog) {
  const timestamp = Date.parse(dog.foundAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareDogs(a, b) {
  const byName = nameCollator.compare(a.name || '', b.name || '');
  if (state.sort === 'name') return byName || foundTime(b) - foundTime(a) || nameCollator.compare(a.id || '', b.id || '');
  return foundTime(b) - foundTime(a) || byName || nameCollator.compare(a.id || '', b.id || '');
}

function filtered() {
  const q = state.query.toLowerCase();
  return state.dogs
    .filter(d => {
      const blob = Object.values(d).join(' ').toLowerCase();
      return (!q || blob.includes(q))
        && (!state.milo || d.shelterName === 'Milo Foundation')
        && (!state.withPhoto || !!d.image);
    })
    .sort(compareDogs);
}

function render() {
  const dogs = filtered();
  $('dogCount').textContent = dogs.length;
  $('empty').hidden = dogs.length > 0;
  $('dogs').innerHTML = dogs.map(d => `
    <article class="dog">
      <div class="photo" role="img" aria-label="${esc(d.name)}" style="background-image:url('${esc(d.image || '')}')">
        <span class="badge">${esc(d.distanceMiles ?? '')} mi · ${esc(d.city || 'Bay Area')}</span>
      </div>
      <div class="dog-body">
        <h2>${esc(d.name)}</h2>
        <p class="meta">${esc([d.breed, d.sex, d.age].filter(Boolean).join(' · '))}</p>
        <div class="chips">${[d.color, d.size, d.shelterName].filter(Boolean).slice(0, 3).map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
        <p class="desc">${esc(d.description || 'No description yet — check the source listing for more details.')}</p>
      </div>
      <div class="actions">
        <a class="button primary" href="${esc(d.url)}">View listing</a>
        ${d.contactPhone ? `<a class="button secondary" href="tel:${esc(d.contactPhone)}">Call shelter</a>` : ''}
      </div>
    </article>`).join('');
}

function setSort(sort) {
  state.sort = sort;
  const recent = sort === 'recent';
  $('sortRecent').classList.toggle('active', recent);
  $('sortRecent').setAttribute('aria-pressed', String(recent));
  $('sortName').classList.toggle('active', !recent);
  $('sortName').setAttribute('aria-pressed', String(!recent));
  render();
}

async function init() {
  const res = await fetch('./data/dogs.json?v=' + Date.now(), { cache: 'no-store' });
  const data = await res.json();
  state.dogs = data.dogs || [];
  $('updatedAt').textContent = 'Updated ' + fmtDate(data.updatedAt);
  $('sources').innerHTML = (data.sources || []).map(s => `<div class="source"><a href="${esc(s.url)}">${esc(s.name)}</a><p>${esc(s.status || '')}</p></div>`).join('');
  render();
}

$('searchBox').addEventListener('input', e => { state.query = e.target.value; render(); });
$('miloToggle').addEventListener('change', e => { state.milo = e.target.checked; render(); });
$('withPhotoToggle').addEventListener('change', e => { state.withPhoto = e.target.checked; render(); });
$('sortRecent').addEventListener('click', () => setSort('recent'));
$('sortName').addEventListener('click', () => setSort('name'));

init().catch(err => {
  console.error(err);
  $('updatedAt').textContent = 'Could not load dog data';
});
