# BB28 Fantasy Draft

Static, data-driven Big Brother 28 family fantasy draft tracker published at:

- https://stirman.net/bb28/

## Purpose

Shows:
- Current BB28 contestants / houseguests
- Draft players and each houseguest’s assigned player after the draft
- Live season status as houseguests are evicted
- Weekly Head of Household and Power of Veto winners
- No season-long family leaderboard; the draft has one winner at the finale

## Update flow

Edit `data/season.json`, then publish the repo. The page fetches that JSON with cache-busting and refreshes automatically every `liveRefreshSeconds` seconds.

### Add family members

```json
"familyMembers": [
  { "id": "jason", "name": "Jason", "color": "#00d5ff" },
  { "id": "cassie", "name": "Cassie", "color": "#ff2bd6" }
]
```


### Draft players

Current player IDs in `familyMembers`:
- `mimi` — Mimi
- `pa` — Pa
- `bruin` — Bruin
- `cannan` — Cannan
- `stacey` — Stacey
- `cru` — Cru
- `greenley` — Greenley
- `cadence` — Cadence
- `cassie` — Cassie
- `jason` — Jason
- `ca-stirmans` — CA Stirmans
- `mimi-pa` — Mimi + Pa
- `claghorns` — Claghorns

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

### Add weekly HOH / POV winners

```json
"weeklyResults": [
  {
    "week": 1,
    "label": "Week 1",
    "date": "2026-07-12",
    "status": "Complete",
    "hoh": { "winner": "First Last" },
    "pov": { "winner": "Second Last" },
    "notes": "Optional short recap."
  }
]
```

Use `null`, `{ "winner": "TBD" }`, or omit a comp until the winner is known.

### Eviction night update

1. Set evicted player status to `evicted` or `jury`.
2. Add HOH/POV winners to `weeklyResults` when known.
3. Add an event to `events`.
4. Update `lastUpdated`.
5. Commit/push.

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
- Once weekly HOH/POV winners, evictions, or family draft results are known, update `data/season.json` only.
