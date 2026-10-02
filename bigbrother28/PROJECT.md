# BB28 Fantasy Draft — Monjies/Cassie/Crush/Mike/Fins

## Finale UI — 20261002-finale

- `status: "complete"` activates the gold/champagne championship hero before the roster and replaces the active-house count with `Season complete · N houseguests`.
- Finale schema: `finale: {date: "2026-10-01", winnerId: "rick-devens", runnerUpId: "taylor-brown", thirdPlaceId: "drew-campbell", juryVote: "6–1", favoriteId: "rick-devens"}`. IDs resolve against this route’s houseguest records; the winner portrait uses the existing local `assets/rick-devens.jpg`.
- Winner, runner-up, third place and America’s Favorite Player are separate from fantasy competition points. Champion/runner-up/AFP badges are derived from finale IDs, so outdated roster statuses cannot stamp the winner or runner-up as evicted.
- The season winner’s draft owner comes from this route’s `houseguests[].draftOwner` and `familyMembers`. Do not copy ownership between routes.
- Competition-point champion(s) come from the existing `buildPlayerLeaderboard`, including all tied leaders; ranks share places for tied totals. Scoring remains **HOH 5 / Veto 3 / Blockbuster 2**, with no season-win or AFP bonus. Preserve `players` and `playerGroups` independently on each route.
- Complete seasons hide the upcoming section, clear episode cards, and make `nextEpisodes()` return an empty array even if the old calendar runs beyond finale night.
- The decorative confetti runs briefly (not continuously), is inaccessible to assistive tech, and is disabled for reduced motion. HTML loads cache-busted `app.js` and `styles.css` (`20261002-finale`).
- Verification on the current final data: competition-point champion **Monjies (44 points)**; season winner’s draft owner **Cassie**. Node VM checks passed for final results, roster badges, complete-season episode suppression, active-state restoration, group fan-out, and synthetic tied champions/ranks. Both JS syntax checks and scoped `git diff --check` passed. Browser harness startup failed and direct headless Chrome timed out; visual browser QA remains outstanding.
- UI-only update: finale data is supplied separately; no JSON edits or deployment are part of this change. Existing data polling remains available for later corrections.
- Local checks: `node --check bb28/app.js` and `node --check bigbrother28/app.js`; exercise complete/in-progress fixtures, grouped scoring and ties without changing stored JSON. Serve the repo with `python3 -m http.server` to preview.



Static, data-driven Big Brother 28 family fantasy draft tracker published at:

- https://stirman.net/bigbrother28/

This is an exact visual/functionality replica of `/bb28/`, with separate family draft ownership.

## Draft ownership

- Monjies: Ashley Trail, Drew Campbell, Barrett Pfeiffer, Yash Patel
- Cassie: Chuk Anyanwu, Lyric Medeiros, Mallory Aurichio, Rick Devens
- Crush: Haley Thogmartin, Rome Seymour, Angela Murray
- Mike: Kamu Kirk, Melody Morris, Taylor Brown
- Fins: Jason De Puy, LaTrice Verrett

## Keep both BB28 sites updated together

When Jason asks for a Big Brother / BB28 season update, update both:

- `/bb28/data/season.json` — original family draft picks
- `/bigbrother28/data/season.json` — Monjies/Cassie/Crush/Mike/Fins picks

Sync season-progress fields between both sites, especially:

- `lastUpdated`
- `status`
- `houseguests[].status`, `notes`, bios/photos/source updates
- `weeklyResults`
- `events`
- `sources`

Do **not** sync `familyMembers`, `houseguests[].draftOwner`, or draft-specific calendar/event wording across the two sites; those must stay separate.

## Deploy

This lives in the `stirman.github.io` GitHub Pages repo. Publishing is a normal git push to `master`:

```bash
git add bb28 bigbrother28
git commit -m "Update BB28 draft sites"
git push origin master
```

The page fetches `data/season.json` with cache-busting and refreshes automatically every `liveRefreshSeconds` seconds.

## Weekly Power Watch

The section is shared with `/bb28/` and now includes a computed season-long leaderboard for strongest houseguest + family member. Scoring: HOH = 5 points; Veto = 3 points; Blockbuster = 2 points. Keep `weeklyResults` synced with `/bb28/data/season.json`, but preserve this route’s separate `familyMembers` and `houseguests[].draftOwner` values.

Prefer weekly result records like:

```json
{
  "week": 1,
  "label": "Week 1",
  "hoh": { "houseguestId": "first-last", "winner": "First Last" },
  "veto": { "houseguestId": "second-last", "winner": "Second Last" },
  "blockbuster": { "houseguestId": "third-last", "winner": "Third Last" }
}
```

Update after Pacific airtime and do not send spoiler texts when the watcher/site updates.

Houseguests with either `evicted` or `jury` status receive the visible Evicted stamp. `jury` remains a distinct structured status for jury tracking.

## Dee Valladares assignment rule

For this `/bigbrother28` family draft, Dee Valladares is explicitly assigned to **Fins**. Preserve that assignment during eviction and season-progress updates; do not replace it from `/bb28`’s separate first-eviction rule.
