# BB28 Fantasy Draft

## Finale UI — 20261002-finale

- `status: "complete"` activates the gold/champagne championship hero before the roster and replaces the active-house count with `Season complete · N houseguests`.
- Finale schema: `finale: {date: "2026-10-01", winnerId: "rick-devens", runnerUpId: "taylor-brown", thirdPlaceId: "drew-campbell", juryVote: "6–1", favoriteId: "rick-devens"}`. IDs resolve against this route’s houseguest records; the winner portrait uses the existing local `assets/rick-devens.jpg`.
- Winner, runner-up, third place and America’s Favorite Player are separate from fantasy competition points. Champion/runner-up/AFP badges are derived from finale IDs, so outdated roster statuses cannot stamp the winner or runner-up as evicted.
- The season winner’s draft owner comes from this route’s `houseguests[].draftOwner` and `familyMembers`. Do not copy ownership between routes.
- Competition-point champion(s) come from the existing `buildPlayerLeaderboard`, including all tied leaders; ranks share places for tied totals. Scoring remains **HOH 5 / Veto 3 / Blockbuster 2**, with no season-win or AFP bonus. Preserve `players` and `playerGroups` independently on each route.
- Complete seasons hide the upcoming section, clear episode cards, and make `nextEpisodes()` return an empty array even if the old calendar runs beyond finale night.
- The decorative confetti runs briefly (not continuously), is inaccessible to assistive tech, and is disabled for reduced motion. HTML loads cache-busted `app.js` and `styles.css` (`20261002-finale`).
- Verification on the current final data: competition-point champion **Bruin (45 points)**; season winner’s draft owner **Claghorns**. Node VM checks passed for final results, roster badges, complete-season episode suppression, active-state restoration, group fan-out, and synthetic tied champions/ranks. Both JS syntax checks and scoped `git diff --check` passed. Browser harness startup failed and direct headless Chrome timed out; visual browser QA remains outstanding.
- UI-only update: finale data is supplied separately; no JSON edits or deployment are part of this change. Existing data polling remains available for later corrections.
- Local checks: `node --check bb28/app.js` and `node --check bigbrother28/app.js`; exercise complete/in-progress fixtures, grouped scoring and ties without changing stored JSON. Serve the repo with `python3 -m http.server` to preview.



Static, data-driven Big Brother 28 family fantasy draft tracker published at:

- https://stirman.net/bb28/

## Purpose

Shows:
- Current BB28 contestants / houseguests
- Each houseguest’s assigned family owner on the houseguest card
- A dynamic Houseguests section eyebrow in the form `active/total still in the house` (starts `16/16 still in the house` and drops when statuses become `evicted` or `jury`)
- Weekly Head of Household, Veto, and Blockbuster winners
- A season-long Weekly Power Watch leaderboard ranking each winning houseguest with their family member by points: HOH = 5, Veto = 3, Blockbuster = 2

## Update flow

Edit `data/season.json`, then publish the repo. The page fetches that JSON with cache-busting and refreshes automatically every `liveRefreshSeconds` seconds.

Important: when Jason asks for a Big Brother / BB28 season update, update both `/bb28/data/season.json` and `/bigbrother28/data/season.json`. Keep season-progress fields in sync, but preserve each site's separate `familyMembers` and `houseguests[].draftOwner` picks.

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

### Add weekly HOH / Veto / Blockbuster winners

```json
"weeklyResults": [
  {
    "week": 1,
    "label": "Week 1",
    "date": "2026-07-12",
    "status": "Complete",
    "hoh": { "houseguestId": "first-last", "winner": "First Last" },
    "veto": { "houseguestId": "second-last", "winner": "Second Last" },
    "blockbuster": { "houseguestId": "third-last", "winner": "Third Last" },
    "notes": "Optional short recap."
  }
]
```

Use `null`, `{ "winner": "TBD" }`, or omit a comp until the winner is known. Prefer `houseguestId` plus `winner` so the leaderboard can reliably map points to the correct family member. Legacy `pov` is still supported as Veto.

### Eviction night update

1. Set evicted player status to `evicted` or `jury`.
2. Add HOH/Veto/Blockbuster winners to `weeklyResults` when known; the power leaderboard is computed automatically.
3. Add an event to `events`.
4. Update `lastUpdated`.
5. Commit/push.

Houseguests with either `evicted` or `jury` status receive the visible Evicted stamp. `jury` remains a distinct structured status for jury tracking.

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
- Once weekly HOH/Veto/Blockbuster winners, evictions, or family draft results are known, update `data/season.json` only; power scores are computed in `app.js`.


## 2026-07-08 house count update
- Removed the standalone `Still in the game` summary module entirely.
- The Houseguests section eyebrow now renders the dynamic `active/total still in the house` count from `app.js`.
- Angela Murray (BB26) and Rick Devens (Survivor) remain in `data/season.json` as unofficial Thursday additions, both assigned to `claghorns`, using local images in `assets/`.

## 2026-07-12 power leaderboard update
- Weekly Power Watch now includes a season-long leaderboard for strongest houseguest + family member.
- Scoring: HOH = 5 points; Veto = 3 points; Blockbuster = 2 points.
- Update both `/bb28` and `/bigbrother28` weekly data together after Pacific airtime; do not text spoiler notifications.

## Dee Valladares assignment rule

Dee Valladares stays **Undrafted** until the first eviction. Whichever family member owns/drafted the first evicted houseguest gets Dee assigned to them. Apply this to both `/bb28` and `/bigbrother28` using each route’s own `houseguests[].draftOwner` mapping.
