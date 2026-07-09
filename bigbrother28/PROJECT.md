# BB28 Fantasy Draft — Monjies/Cassie/Crush/Mike

Static, data-driven Big Brother 28 family fantasy draft tracker published at:

- https://stirman.net/bigbrother28/

This is an exact visual/functionality replica of `/bb28/`, with separate family draft ownership.

## Draft ownership

- Monjies: Ashley Trail, Drew Campbell, Barrett Pfeiffer, Yash Patel
- Cassie: Chuk Anyanwu, Lyric Medeiros, Mallory Aurichio, Rick Devens
- Crush: Haley Thogmartin, Jason De Puy, Rome Seymour, Angela Murray
- Mike: Kamu Kirk, LaTrice Verrett, Melody Morris, Taylor Brown

## Keep both BB28 sites updated together

When Jason asks for a Big Brother / BB28 season update, update both:

- `/bb28/data/season.json` — original family draft picks
- `/bigbrother28/data/season.json` — Monjies/Cassie/Crush/Mike picks

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
