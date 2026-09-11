#!/usr/bin/env python3
"""Public regional trackable history. Run with uv --with requests --with beautifulsoup4."""
import re
import json
import os
import tempfile
import time
from pathlib import Path
import requests
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit, parse_qs
from bs4 import BeautifulSoup
from geocoins_translate import enrich

IDS = ('TBB8FK9', 'TBB8G36', 'TBB8FXB', 'TBB8G42', 'TBB8G77', 'TBB8FX6', 'TBB8FJ3', 'TBB8FXD')
BASE = 'https://www.geocaching.com'

class RefreshError(RuntimeError):
    pass

def collect_coin(code, fetch):
    if code not in IDS:
        raise RefreshError('Unrecognized public ID')
    url = f'{BASE}/track/details.aspx?tracker={code}'
    logs = {}
    result = {'id': code, 'sourceUrl': url}
    seen = set()
    total = None
    end = 0
    while url:
        if url in seen or len(seen) >= 1000:
            raise RefreshError('Pagination loop or limit')
        seen.add(url)
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.netloc != 'www.geocaching.com' or parsed.path != '/track/details.aspx':
            raise RefreshError('Unsafe history link')
        soup = BeautifulSoup(fetch(url), 'html.parser')
        text = soup.get_text(' ', strip=True)
        if not soup.title or not soup.title.get_text(strip=True).startswith(f'({code}) Travel Bug'):
            raise RefreshError('Unexpected trackable page')
        if 'status' not in result:
            status = re.search(r'Recently Spotted: (.*?) (?:This is not collectible\.|The owner hasn)', text)
            if not status:
                raise RefreshError('Missing status')
            result['status'] = status.group(1)
            distance = re.search(r'Tracking History \(([\d,.]+)mi\)', text)
            result['distanceMiles'] = float(distance.group(1).replace(',', '')) if distance else 0
        counts = re.findall(r'(\d+)-(\d+) of (\d+) records', text)
        if not counts and 'Sorry, I was unable to find any records.' in text and len(seen) == 1 and not soup.select('.BorderTop'):
            total = 0
            break
        if not counts:
            raise RefreshError('Missing declared log count')
        if len(set(counts)) != 1:
            raise RefreshError('Inconsistent page totals')
        start, stop, declared = map(int, counts[0])
        if total is not None and declared != total or start != end + 1 or stop < start:
            raise RefreshError('Missing page or changing total')
        total, end = declared, stop
        if len(soup.select('table.TrackableItemLogTable tr.BorderTop')) != stop - start + 1:
            raise RefreshError('Changed log layout')
        for row in soup.select('table.TrackableItemLogTable tr.BorderTop'):
            cells = row.find_all('td', recursive=False)
            header = row.find('th')
            link = cells[2].find('a', href=re.compile('/live/log/TL'))
            log_id = link['href'].rsplit('/', 1)[-1]
            cache = cells[0].find('a', href=re.compile('/geocache/GC'))
            following = row.find_next_sibling('tr')
            body = following.select_one('.TrackLogText') if following else None
            if body is None or 'BorderBottom' not in following.get('class', []):
                raise RefreshError('Missing log text row')
            body_text = body.get_text('\n', strip=True)
            location = re.sub(r'\s+-\s+[\d,.]+ miles\s*$', '', cells[1].get_text(' ', strip=True)).strip()
            item = dict(id=log_id, date=datetime.strptime(header.get_text(strip=True), '%m/%d/%Y').date().isoformat(),
                        type=header.find('img')['alt'], text=body_text,
                        event=cells[0].get_text(' ', strip=True), cacheName=cache.get_text(strip=True) if cache else None,
                        cacheUrl=cache['href'] if cache else None, location=location, sourceUrl=link['href'])
            if code == 'TBB8G36':
                for phrase, place in [('Kyoto Japan', 'Kyoto, Japan'), ('Mill Valley California', 'Mill Valley, California, United States')]:
                    if phrase in body_text:
                        item['location'] = place
                        item['locationBasis'] = 'Place explicitly mentioned in public log'
            if code == 'TBB8FJ3' and (item.get('cacheUrl') or '').rstrip('/').endswith('/GC5WCVV'):
                item['location'] = 'Rome, Italy'
                item['locationBasis'] = 'Rome supplied by Jason for this cache; placement verified in public trackable log'
            if code == 'TBB8FXD' and (item.get('cacheUrl') or '').rstrip('/').endswith('/GC30T9P'):
                item['location'] = 'Poros, Attica, Greece'
                item['locationBasis'] = 'Poros identified in the public cache description; placement verified in public trackable log'
            logs[log_id] = item
        next_link = soup.find('a', string=re.compile(r'^next'))
        url = urljoin(BASE, next_link['href']) if next_link else None
    if len(logs) != total or end != total:
        raise RefreshError('Incomplete history: declared count mismatch')
    result['logs'] = sorted(reversed(list(logs.values())), key=lambda x: x['date'])
    return result


def collect(old, fetch, geocode):
    import copy
    result = copy.deepcopy(old)
    previous = {c['id']: c for c in old['coins']}
    if set(previous) != set(IDS) or len(old['coins']) != len(IDS):
        raise RefreshError('Baseline must contain all configured public trackables')
    coords = {}
    for coin in old['coins']:
        for log in coin['logs']:
            if log.get('location') and log.get('lat') is not None and log.get('lon') is not None:
                coords[log['location']] = {k: log[k] for k in ('lat', 'lon', 'precision', 'coordinateSource') if k in log}
    coins = []
    for code in IDS:
        fresh = collect_coin(code, fetch)
        before = previous[code]
        old_logs = {x['id']: x for x in before['logs']}
        if set(old_logs) - {x['id'] for x in fresh['logs']}:
            raise RefreshError(f'{code}: existing log IDs disappeared; manual review required')
        for log in fresh['logs']:
            place = log['location']
            if place and place not in coords:
                coords[place] = geocode(place)
            log.update(coords[place] if place else dict(lat=None, lon=None, precision=None))
        coins.append(dict(before, **fresh))
    result['coins'] = coins
    result['uniqueTrackableCount'] = len(coins)
    result['updatedAt'] = datetime.now(timezone.utc).isoformat()
    return result


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as file:
            temporary = file.name
            json.dump(data, file, ensure_ascii=False, indent=2, allow_nan=False)
            file.write('\n')
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def run_collect(old, output, fetch, geocode):
    data = collect(old, fetch, geocode)
    # Fail closed before changing collected output or publishing if translation is unavailable.
    enrich(data, CACHE / 'translations.json')
    atomic_json(output, data)
    return data


class PublicClient:
    def __init__(self, cache, session=None):
        self.cache = Path(cache)
        self.places = json.loads(self.cache.read_text()) if self.cache.exists() else {}
        self.session = session or requests.Session()
        self.last_geocode = 0

    def request(self, url, **kwargs):
        response = self.session.get(url, timeout=45, allow_redirects=False,
                                    headers={'User-Agent': 'StirmanGeocoins/1.0 (+https://stirman.net/audrey/)', 'Accept-Language': 'en-US,en;q=0.9'}, **kwargs)
        if response.status_code != 200:
            raise RefreshError(f'Public request returned HTTP {response.status_code}')
        return response

    def fetch(self, url):
        p = urlsplit(url)
        q = parse_qs(p.query)
        if p.scheme != 'https' or p.netloc != 'www.geocaching.com' or p.path != '/track/details.aspx':
            raise RefreshError('Only public trackable details may be requested')
        if set(q) - {'tracker', 'id', 'page'} or ('tracker' in q and (len(q['tracker']) != 1 or q['tracker'][0] not in IDS)):
            raise RefreshError('Unsafe trackable query')
        if not ('tracker' in q or ('id' in q and q['id'][0].isdigit())):
            raise RefreshError('Missing public trackable identity')
        return self.request(url).text

    def geocode(self, place):
        if place in self.places:
            return self.places[place]
        delay = 1.1 - (time.monotonic() - self.last_geocode)
        if delay > 0:
            time.sleep(delay)
        self.last_geocode = time.monotonic()
        from urllib.parse import urlencode
        url = 'https://nominatim.openstreetmap.org/search?' + urlencode({'q': place, 'format': 'json', 'limit': 1})
        rows = self.request(url).json()
        if not rows:
            raise RefreshError('Named region could not be geocoded')
        lat, lon = float(rows[0]['lat']), float(rows[0]['lon'])
        if not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise RefreshError('Invalid regional coordinates')
        value = dict(lat=lat, lon=lon, precision='Approximate city / region center, not cache coordinates', coordinateSource=url)
        self.places[place] = value
        atomic_json(self.cache, self.places)
        return value


DATA_REL = 'audrey/data/coins.json'
REPO = Path('/Users/rosie/clawd/stirman/stirman.github.io')
CACHE = Path('/Users/rosie/.hermes/cache/geocoins')
REMOTE = 'https://github.com/stirman/stirman.github.io.git'
LIVE = 'https://stirman.net/audrey/data/coins.json'


def git_run(args, cwd=None):
    import subprocess
    result = subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True,
                            timeout=120, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    if result.returncode:
        raise RefreshError(f'git {args[0]} failed (exit {result.returncode})')
    return result.stdout


def verify_live(data, fetch=None, attempts=12):
    def live():
        response = requests.get(LIVE, params={'refresh': data['updatedAt']},
                                headers={'Cache-Control': 'no-cache'}, timeout=30)
        response.raise_for_status()
        return response.json()
    fetch = fetch or live
    for attempt in range(attempts):
        try:
            if fetch() == data:
                return
        except (requests.RequestException, ValueError):
            pass
        if attempt + 1 < attempts:
            time.sleep(15)
    raise RefreshError('Pushed, but live data did not match within propagation window')


def publish(data, cache=CACHE, git=git_run):
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='publisher-', dir=cache) as tmp:
        repo = Path(tmp) / 'site'
        git(['clone', '--single-branch', '--branch', 'master', REMOTE, str(repo)])
        git(['fetch', 'origin', 'master'], cwd=repo)
        git(['rebase', 'origin/master'], cwd=repo)
        # Never overwrite newly published logs that were not in our collection.
        remote_data = json.loads(git(['show', f'origin/master:{DATA_REL}'], cwd=repo))
        new_ids = {c['id']: {x['id'] for x in c['logs']} for c in data['coins']}
        for coin in remote_data['coins']:
            if coin['id'] not in new_ids or {x['id'] for x in coin['logs']} - new_ids[coin['id']]:
                raise RefreshError('Remote history advanced; recollect before publishing')
        atomic_json(repo / DATA_REL, data)
        git(['add', '--', DATA_REL], cwd=repo)
        staged = git(['diff', '--cached', '--name-only'], cwd=repo).splitlines()
        if staged and staged != [DATA_REL]:
            raise RefreshError('Unexpected staged publisher paths')
        if staged:
            git(['-c', 'user.name=Geocoins Refresher', '-c', 'user.email=geocoins@stirman.net', 'commit', '-m', 'Refresh public geocoin history', '--', DATA_REL], cwd=repo)
            for attempt in range(3):
                if json.loads((repo / DATA_REL).read_text()) != data:
                    raise RefreshError('Rebase altered generated data')
                try:
                    git(['push', 'origin', 'HEAD:master'], cwd=repo)
                    break
                except RefreshError:
                    if attempt == 2:
                        raise
                    time.sleep(2)
                    git(['fetch', 'origin', 'master'], cwd=repo)
                    # Conflicts deliberately fail closed, never auto-resolve or force.
                    git(['rebase', 'origin/master'], cwd=repo)
            if json.loads((repo / DATA_REL).read_text()) != data:
                raise RefreshError('Rebase altered generated data')
        verify_live(data)


def main(argv=None):
    import argparse
    import sys
    import fcntl
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--collect-only', action='store_true', help='Write cache output only; never commit or push')
    mode.add_argument('--publish', action='store_true', help='Publish only coins.json from an isolated temporary clone')
    parser.add_argument('--baseline', type=Path, default=REPO / DATA_REL)
    parser.add_argument('--output', type=Path, default=CACHE / 'collected.json')
    args = parser.parse_args(argv)
    try:
        if args.output.resolve() == args.baseline.resolve():
            raise RefreshError('Output must not overwrite baseline; use cache output')
        CACHE.mkdir(parents=True, exist_ok=True)
        with (CACHE / 'refresh.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            client = PublicClient(CACHE / 'regions.json')
            baseline = json.loads(args.baseline.read_text())
            # Last successful collection also protects against regressions on later days.
            if args.output.exists():
                prior = json.loads(args.output.read_text())
                by_id = {c['id']: c for c in baseline['coins']}
                for coin in prior['coins']:
                    if coin['id'] not in by_id:
                        raise RefreshError('Unexpected cached trackable')
                    known = {x['id'] for x in by_id[coin['id']]['logs']}
                    by_id[coin['id']]['logs'].extend(x for x in coin['logs'] if x['id'] not in known)
            data = run_collect(baseline, args.output, client.fetch, client.geocode)
            if args.publish:
                publish(data)
        return 0
    except Exception as exc:
        # Do not leak fetched HTML, credentials, or source query strings to notifications.
        message = str(exc) if isinstance(exc, RefreshError) else type(exc).__name__
        print('Geocoins refresh failed: ' + message, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
