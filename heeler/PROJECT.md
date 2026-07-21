# Heeler Watch

Public URL: https://stirman.net/heeler/

Hourly watcher for Bay Area / couple-hour-drive adoptable Australian Cattle Dogs, Blue Heelers, Red Heelers, and cattle-dog mixes.

## Sources

Primary structured source: Adopt-a-Pet breed/location pages for San Francisco, Oakland, San Jose, Santa Rosa, and Sacramento.

Source links shown on the site include Petfinder, SF Animal Care & Control, SF SPCA, Oakland Animal Services, Peninsula Humane Society/SPCA, Rocket Dog Rescue, and Milo Foundation. Petfinder API support can be added by setting credentials if Jason gets them.

## Files

- `scan_heeler.py` — pulls listings, localizes dog images into `assets/dogs/`, writes `data/dogs.json`.
- `data/dogs.json` — public rendered dog data, including a persistent `foundAt` timestamp for each listing.
- `data/state.json` — scan status plus the durable all-time `seenIds` ledger used to prevent repeat alerts when a source temporarily drops and later restores listings.
- `index.html`, `styles.css`, `app.js` — static site. Listings default to newest-found first, with a Recent additions / Name sort toggle.

## Update / deploy

```bash
cd /Users/rosie/clawd/stirman/stirman.github.io
python3 heeler/scan_heeler.py
git add heeler
git commit -m "Update Heeler Watch listings"
git push origin master
```

Cron job: `heeler-hourly-scan` runs every hour, executes the scanner, commits/pushes changes only when `heeler/` changed, and stays silent unless a dog ID has never appeared in the durable `seenIds` ledger.
