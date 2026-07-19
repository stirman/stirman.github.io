#!/usr/bin/env python3
import html, json, os, re, sys, time, urllib.request, urllib.parse, hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(os.environ.get('HEELER_REPO', '/Users/rosie/clawd/stirman/stirman.github.io'))
SITE = REPO / 'heeler'
DATA_PATH = SITE / 'data' / 'dogs.json'
ASSET_DIR = SITE / 'assets' / 'dogs'
STATE_PATH = SITE / 'data' / 'state.json'
USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 HeelerWatch/1.0'
SEARCH_URLS = [
    ('Adopt-a-Pet · San Francisco 50mi', 'https://www.adoptapet.com/s/adopt-an-australian-cattle-dog/california/san-francisco'),
    ('Adopt-a-Pet · San Jose 50mi', 'https://www.adoptapet.com/s/adopt-an-australian-cattle-dog/california/san-jose'),
    ('Adopt-a-Pet · Oakland 50mi', 'https://www.adoptapet.com/s/adopt-an-australian-cattle-dog/california/oakland'),
    ('Adopt-a-Pet · Santa Rosa 50mi', 'https://www.adoptapet.com/s/adopt-an-australian-cattle-dog/california/santa-rosa'),
    ('Adopt-a-Pet · Sacramento 50mi', 'https://www.adoptapet.com/s/adopt-an-australian-cattle-dog/california/sacramento'),
]
SHELTERLUV_SOURCES = [
    ('Milo Foundation · Shelterluv', 11413, 'https://www.milofoundation.org/dogs-for-adoption/'),
]
SOURCE_LINKS = [
    {'name':'Adopt-a-Pet Australian Cattle Dog search','url':'https://www.adoptapet.com/s/adopt-an-australian-cattle-dog/california/san-francisco','status':'active'},
    {'name':'Petfinder breed search (manual/API fallback)','url':'https://www.petfinder.com/search/dogs-for-adoption/us/ca/san-francisco/?breed%5B0%5D=Australian%20Cattle%20Dog%20%2F%20Blue%20Heeler','status':'listed; API requires credentials'},
    {'name':'SF Animal Care & Control','url':'https://www.sfanimalcare.org/adoptable-animals/dogs/','status':'monitored via Adopt-a-Pet/Petfinder listings'},
    {'name':'SF SPCA','url':'https://www.sfspca.org/adoptions/dogs/','status':'monitored via Adopt-a-Pet listings'},
    {'name':'Oakland Animal Services','url':'https://www.oaklandanimalservices.org/adopt/dogs/','status':'monitored via Adopt-a-Pet listings'},
    {'name':'Peninsula Humane Society/SPCA','url':'https://phs-spca.org/adopt/dogs/','status':'manual source link'},
    {'name':'Rocket Dog Rescue','url':'https://www.rocketdogrescue.org/available-dogs','status':'monitored if cross-posted to Adopt-a-Pet'},
    {'name':'Milo Foundation','url':'https://www.milofoundation.org/dogs-for-adoption/','status':'active direct Shelterluv scanner'},
]
HEELER_TERMS = re.compile(r'(australian cattle dog|cattle dog|blue heeler|red heeler|heeler)', re.I)
CITY_DISTANCE_FROM_SF = {
    'San Francisco': 0, 'Oakland': 12, 'Alameda': 15, 'Berkeley': 14, 'Richmond': 18, 'San Rafael': 18,
    'Pacifica': 16, 'Daly City': 8, 'Burlingame': 17, 'San Mateo': 20, 'Redwood City': 27, 'Palo Alto': 33,
    'Mountain View': 39, 'San Jose': 49, 'Santa Clara': 46, 'Sunnyvale': 42, 'Fremont': 38, 'Hayward': 26,
    'Walnut Creek': 25, 'Concord': 29, 'Pleasanton': 40, 'Vallejo': 32, 'Novato': 29, 'Petaluma': 39,
    'Santa Rosa': 55, 'Napa': 47, 'Fairfield': 45, 'Vacaville': 55, 'Sacramento': 88, 'Davis': 73, 'Stockton': 83,
    'Point Richmond': 18, 'Richmond': 18, 'Willits': 140,
}

def approx_distance(city, scraped):
    if city in CITY_DISTANCE_FROM_SF:
        return CITY_DISTANCE_FROM_SF[city]
    try:
        return round(float(scraped or 0), 1)
    except Exception:
        return scraped

def fetch(url):
    req=urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept':'text/html,application/xhtml+xml'})
    with urllib.request.urlopen(req, timeout=35) as r:
        return r.read().decode('utf-8','ignore')

def normalize_img(url):
    if not url: return ''
    url = html.unescape(url).replace('\\/','/')
    return url.split(' ')[0]

def localize_image(pet_id, img_url):
    if not img_url: return ''
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ext = '.jpg'
    path = ASSET_DIR / f'{pet_id}{ext}'
    if path.exists() and path.stat().st_size > 1000:
        return './assets/dogs/' + path.name
    try:
        req=urllib.request.Request(img_url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read(5_000_000)
        if len(data) > 500:
            path.write_bytes(data)
            return './assets/dogs/' + path.name
    except Exception:
        pass
    return img_url

def clean_text(s):
    if not s: return ''
    s = html.unescape(str(s).replace('<br>', ' ').replace('<br/>',' ').replace('<br />',' '))
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def _extract_array_after(text, key):
    start = text.find(key)
    if start < 0:
        return []
    lb = text.find('[', start)
    if lb < 0:
        return []
    depth = 0
    in_str = False
    esc = False
    for i in range(lb, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    raw = text[lb:i+1]
                    try:
                        return json.loads(raw)
                    except Exception:
                        return []
    return []

def extract_pets(page, source_name):
    # Adopt-a-Pet embeds an HTML-escaped, slash-escaped JSON chunk containing petsInCity.
    un = html.unescape(page).replace('\\"', '"').replace('\\/', '/')
    pets=[]
    seen=set()
    for arr in [_extract_array_after(un, '"petsInCity"'), _extract_array_after(un, '"petsOutsideCity"')]:
        for p in arr:
            breed=' / '.join([x for x in [p.get('primaryBreed') or p.get('breed'), p.get('secondaryBreed')] if x])
            text=' '.join([breed, p.get('breed') or '', p.get('description') or '', p.get('color') or ''])
            if not HEELER_TERMS.search(text):
                continue
            pid=str(p.get('petId') or hashlib.sha1((p.get('pdpRoute','')+p.get('name','')).encode()).hexdigest()[:10])
            if pid in seen: continue
            seen.add(pid)
            addr=p.get('address') or {}
            photo = normalize_img(p.get('photoUrl') or '')
            if not photo and p.get('primaryPhotoId'):
                photo = 'https://media.adoptapet.com/image/upload/d_Fallback-Photo_Dog-v3.png/c_auto,g_auto,w_800/f_auto,q_auto/' + str(p.get('primaryPhotoId'))
            pets.append({
                'id':'adoptapet-'+pid,
                'name':clean_text(p.get('name')) or 'Unnamed heeler',
                'breed':clean_text(breed or p.get('breed')),
                'sex': {'m':'Male','f':'Female'}.get(str(p.get('sex','')).lower(), clean_text(p.get('sex'))),
                'age':clean_text(p.get('age')),
                'color':clean_text(p.get('color')),
                'size':clean_text(p.get('size')),
                'description':clean_text(p.get('description'))[:900],
                'city':clean_text(addr.get('city')),
                'state':clean_text(addr.get('state')),
                'postalCode':clean_text(addr.get('postalCode')),
                'distanceMiles': approx_distance(clean_text(addr.get('city')), p.get('distance')),
                'sourceDistanceMiles': round(float(p.get('distance') or 0),1) if str(p.get('distance') or '').replace('.','',1).isdigit() else p.get('distance'),
                'shelterName':clean_text(p.get('shelterName')),
                'contactPhone':clean_text(p.get('contactPhone')),
                'contactEmail':clean_text(p.get('contactEmail')),
                'url':normalize_img(p.get('pdpRoute') or ''),
                'source':source_name,
                'imageRemote':photo,
            })
    return pets

def fetch_shelterluv_animals(shelter_id):
    url = f'https://www.shelterluv.com/api/v3/available-animals/{shelter_id}?species=Dog'
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': f'https://www.shelterluv.com/embed/{shelter_id}?species=Dog',
    })
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode('utf-8', 'ignore'))

def age_from_birthday(ts, fallback=''):
    try:
        days = (datetime.now(timezone.utc) - datetime.fromtimestamp(int(ts), timezone.utc)).days
        if days < 60:
            return f'{max(1, days // 7)} weeks'
        if days < 730:
            return f'{max(2, round(days / 30))} mos'
        years = round(days / 365, 1)
        return f'{years:g} yrs'
    except Exception:
        return fallback or ''

def extract_shelterluv_pets(source_name, shelter_id, source_url):
    payload = fetch_shelterluv_animals(shelter_id)
    pets=[]
    for a in payload.get('animals', []):
        breed = ' / '.join([clean_text(a.get('breed')), clean_text(a.get('secondary_breed'))]).strip(' /')
        desc = clean_text(a.get('kennel_description'))
        attrs = ', '.join(clean_text(x) for x in (a.get('attributes') or [])[:8])
        text = ' '.join([breed, desc, attrs, clean_text(a.get('name')), clean_text(a.get('primary_color')), clean_text(a.get('secondary_color'))])
        if not HEELER_TERMS.search(text):
            continue
        photo_items = [p for p in (a.get('photos') or []) if isinstance(p, dict)]
        photos = sorted(photo_items, key=lambda p: (not p.get('isCover'), p.get('order_column') or 999, p.get('id') or 0))
        photo = normalize_img((photos[0] or {}).get('url') if photos else '')
        location = clean_text(a.get('location') or a.get('campus') or 'Point Richmond')
        city = 'Point Richmond'
        if 'Willits' in location:
            city = 'Willits'
        elif 'Foster' in location:
            city = 'Foster Home'
        elif 'Richmond' in location or 'Main Campus' in location:
            city = 'Point Richmond'
        pets.append({
            'id':'shelterluv-'+clean_text(a.get('uniqueId') or str(a.get('nid'))),
            'name':clean_text(a.get('name')) or 'Unnamed heeler',
            'breed':breed,
            'sex':clean_text(a.get('sex')),
            'age':age_from_birthday(a.get('birthday'), clean_text((a.get('age_group') or {}).get('name'))),
            'color':' / '.join([x for x in [clean_text(a.get('primary_color')), clean_text(a.get('secondary_color'))] if x]),
            'size':clean_text(a.get('weight_group')),
            'description':(desc or attrs)[:900],
            'city':city,
            'state':'CA',
            'postalCode':'94801' if city != 'Willits' else '95490',
            'distanceMiles': approx_distance('Point Richmond' if city == 'Foster Home' else city, None),
            'shelterName':'Milo Foundation',
            'contactPhone':'',
            'contactEmail':'',
            'url':clean_text(a.get('public_url')) or source_url,
            'source':source_name,
            'imageRemote':photo,
        })
    return pets

def apply_found_at(pets, old, now):
    old_by_id={d.get('id'): d for d in old.get('dogs',[]) if d.get('id')}
    for p in pets:
        p['foundAt']=old_by_id.get(p.get('id'), {}).get('foundAt') or now


def main():
    SITE.mkdir(parents=True, exist_ok=True); (SITE/'data').mkdir(exist_ok=True); ASSET_DIR.mkdir(parents=True, exist_ok=True)
    old={}
    if DATA_PATH.exists():
        try: old=json.loads(DATA_PATH.read_text())
        except Exception: old={}
    all_pets=[]; errors=[]
    for name,url in SEARCH_URLS:
        try:
            page=fetch(url)
            all_pets.extend(extract_pets(page,name))
        except Exception as e:
            errors.append({'source':name,'url':url,'error':repr(e)})
    for name,shelter_id,url in SHELTERLUV_SOURCES:
        try:
            all_pets.extend(extract_shelterluv_pets(name, shelter_id, url))
        except Exception as e:
            errors.append({'source':name,'url':url,'error':repr(e)})
    dedup={}
    for p in all_pets:
        key=p.get('url') or p['id']
        if key not in dedup or (p.get('distanceMiles') or 999) < (dedup[key].get('distanceMiles') or 999):
            dedup[key]=p
    pets=list(dedup.values())
    pets.sort(key=lambda p: (float(p.get('distanceMiles') or 999), p.get('name','')))
    for p in pets:
        p['image']=localize_image(p['id'].replace('/','-'), p.get('imageRemote',''))
    now=datetime.now(timezone.utc).isoformat(timespec='seconds')
    apply_found_at(pets, old, now)
    payload={
        'updatedAt':now,
        'location':'San Francisco Bay Area + couple-hour drive',
        'breedTerms':['Australian Cattle Dog','Blue Heeler','Red Heeler','Cattle Dog'],
        'count':len(pets),
        'dogs':pets,
        'sources':SOURCE_LINKS,
        'scanErrors':errors,
    }
    DATA_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False)+'\n')
    old_ids=set(d.get('id') for d in old.get('dogs',[]))
    new=[p for p in pets if p.get('id') not in old_ids]
    STATE_PATH.write_text(json.dumps({'lastRunAt':now,'count':len(pets),'newIds':[p['id'] for p in new]}, indent=2)+'\n')
    print(f'Heeler scan complete: {len(pets)} dogs, {len(new)} new, {len(errors)} source errors')
    if new:
        print('New: ' + ', '.join(f"{p['name']} ({p.get('city','')})" for p in new[:8]))
if __name__=='__main__': main()
