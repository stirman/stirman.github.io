# Daily Divine — Redesign Prototype

A complete, clickable redesign prototype for Daily Divine, combining the soft
lavender/peach sunset atmosphere of `daily-divine-designs/01-golden-horizon.html`
with the journal-first layout of `daily-divine-designs/04-lavender-sunset-journal.html`.

- Public URL: https://stirman.net/daily-divine-redesign/
- Hosting: GitHub Pages from `stirman/stirman.github.io` on `master`
- Self-contained: no build step, no external dependencies, no remote media.
  All assets are relative, so the folder works at `/daily-divine-redesign/`
  or opened straight from disk.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Desktop gallery linking to all 15 screens |
| `app.html` | iPhone-framed prototype (390×844); renders one screen per route |
| `styles.css` | Shared visual system for gallery + app |
| `app.js` | Routing, tab bar state, toasts, and per-screen interactivity |
| `verify.py` | Assertion suite — run `python3 verify.py` |
| `PROJECT.md` | This file |

## Routes

Every screen is directly addressable: `app.html?screen=KEY`.

Keys (15): `welcome`, `daily`, `add-sign`, `guidance`, `moon`, `intention`,
`deck`, `card-detail`, `profile`, `personalization`, `prompt-settings`,
`premium`, `settings`, `admin`, `users`.

Navigation is real: bottom tabs switch Daily / Deck / Moon / Profile, the
center `＋` opens sign capture, back pills return to parent screens, and
save/subscribe/share actions show toasts (carried across navigation via
`sessionStorage`).

## Visual system

Layered dusty lavender → plum sky with a peach/amber sun glow and mountain
ridges; warm cream paper journal sheet; Georgia serif display type; subtle
celestial line art (✦ ☼ ☾); translucent glass tab bar; native-iOS-style
switches, segmented controls, and chips. Strong `:focus-visible` states and
ARIA labels throughout. Warm, feminine, spiritual, premium — never kitschy.

## Verify

```
cd daily-divine-redesign && python3 verify.py
```

Checks all 15 screen keys in `app.html`, gallery links in `index.html`,
relative-only runtime assets, and JS syntax via `node --check` when node
is installed.
