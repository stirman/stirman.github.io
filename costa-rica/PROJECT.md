# Costa Rica Family Itinerary

Public URL: https://stirman.net/costa-rica/

## Purpose

A mobile-friendly, illustrated family trip itinerary for July 28–August 5, 2026. It presents each day’s meals, activities, times, group sizes, and transportation notes from the supplied `CR-itinerary.csv`.

## Files

- `index.html` — page shell, metadata, sticky date navigation, share/print controls
- `styles.css` — responsive tropical editorial design and print styles
- `app.js` — loads and renders itinerary data, date navigation, Web Share API
- `data/itinerary.json` — source of truth for day-by-day content
- `data/source-itinerary.csv` — original supplied itinerary for fidelity checks
- `assets/costa-rica-hero.jpg` — original generated hero illustration
- `assets/ocean-adventures.jpg` — original generated fishing/catamaran illustration
- `assets/jungle-macaws.jpg` — original generated hiking/macaw illustration
- `assets/villa-celebration.jpg` — original generated birthday/massage illustration

## Data schema

`data/itinerary.json` contains `trip` metadata and `days[]`. Each day can have:

- `date`, `weekday`, `shortDate`, `kicker`, `title`, `summary`
- optional `art` and `artAlt`
- `events[]` with `type`, `title`, optional `meal`, `time`, `location`, `people`, `transport`, and `slots[]`

Transportation values:

- `Confirmed` — the source CSV contained a check mark
- `Included` — the source CSV explicitly said included
- a time range — the source CSV listed that range in the transportation column

Times and group sizes are omitted when the CSV did not supply them. Do not infer them.

## Update flow

1. Edit `data/itinerary.json`.
2. Validate with `python3 -m json.tool data/itinerary.json`.
3. Serve the repo root and preview `/costa-rica/`.
4. Check `app.js` with `node --check app.js`.
5. Commit only `costa-rica/`, push `master`, wait for GitHub Pages, and verify the live URL plus JSON and image assets.

## Deployment

```bash
cd /Users/rosie/clawd/stirman/stirman.github.io
git add costa-rica
git commit -m "Add illustrated Costa Rica family itinerary"
git push origin master
```

GitHub Pages publishes `master` to the custom domain `stirman.net`.
