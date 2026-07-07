# BB28 Fantasy Draft

Static, data-driven Big Brother 28 family fantasy draft tracker published at:

- https://stirman.net/bb28/

## Purpose

Shows:
- Current BB28 contestants / houseguests
- Which family member drafted each houseguest
- Live season status as houseguests are evicted
- A simple family leaderboard until one houseguest remains

## Update flow

Edit `data/season.json`, then publish the repo. The page fetches that JSON with cache-busting and refreshes automatically every `liveRefreshSeconds` seconds.

### Add family members

```json
"familyMembers": [
  { "id": "jason", "name": "Jason", "color": "#00d5ff" },
  { "id": "cassie", "name": "Cassie", "color": "#ff2bd6" }
]
```

### Add / update contestants

```json
{
  "id": "first-last",
  "name": "First Last",
  "age": 29,
  "hometown": "Austin, TX",
  "occupation": "Designer",
  "draftOwner": "jason",
  "status": "active",
  "notes": "HOH week 1"
}
```

Supported statuses:
- `active`
- `evicted`
- `jury`
- `winner`
- `pending`

### Eviction night update

1. Set evicted player status to `evicted` or `jury`.
2. Add an event to `events`.
3. Update `lastUpdated`.
4. Commit/push.

## Deploy

This lives in the `stirman.github.io` GitHub Pages repo. Publishing is a normal git push to `master`:

```bash
git add bb28
git commit -m "feat: add BB28 fantasy draft tracker"
git push origin master
```

## Notes

- The current foundation intentionally uses no build step, no npm dependencies, and no server so it works reliably on GitHub Pages at `/bb28/`.
- The design uses Big Brother-inspired house/eye/neon/stage visuals via CSS, not official copyrighted assets.
- Once the official cast and family draft results are known, update `data/season.json` only.
