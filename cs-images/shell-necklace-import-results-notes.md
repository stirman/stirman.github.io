# Shell Necklace Squarespace Import Results

Date: 2026-05-16
Paperclip issue: HAR-3658

## Result

Imported all 53 expected Shell Pendant Necklace products into Cassie's Squarespace `Shell Necklaces` store page.

- Source folder: `~/Documents/Shell Necklaces`
- Expected roots imported: `1`–`50`, `52`–`54` (`51` is absent from source files)
- Store page: `Shell Necklaces`
- Store page ID: `6a08dc5749069658966bc2d3`
- URL pattern: `https://www.cassiestirman.com/shell-necklaces/p/shell-necklace-{root}`
- SKUs: `2400`–`2452`
- Price: `$111.00`
- Stock: `1` each
- Tag: `Jewelry`
- Visibility: public / visible

## Verification

Squarespace API verification after import:

- Matching products on the `Shell Necklaces` store page: `53`
- All products visible: yes
- All products have at least one image: yes
- All 53 variants have a featured variant image association: yes
- Public spot-checks returned HTTP 200:
  - `https://www.cassiestirman.com/shell-necklaces/p/shell-necklace-1`
  - `https://www.cassiestirman.com/shell-necklaces/p/shell-necklace-54`

Detailed created/skipped/upload records are in `shell-necklace-import-results.json`.

## Import notes

The importer first created root `1` and uploaded its two images, then failed on featured-image association because Squarespace's documented schema showed an `imageId` object but the live API requires `{"imageId":"<id>"}`. After fixing the payload, the importer resumed idempotently, skipped the existing root `1`, created roots `2`–`54` (excluding missing `51`), uploaded images, and associated featured variant images. Root `1` was then manually associated with its first image using the corrected payload.
