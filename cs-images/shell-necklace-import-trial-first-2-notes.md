# Shell Necklace Import Trial — first 2 products

Generated from the first two necklace image groups in `~/Documents/Shell Necklaces`:

- Product 1: `1.JPG`, `1-2.JPG` (the request said `1-1.JPG`, but the folder contains `1-2.JPG`)
- Product 2: `2.JPG`, `2-2.JPG`

Output CSV: `shell-necklace-import-trial-first-2.csv`

Validation:

- 2 product rows generated.
- SKU sequence starts at `2400` and increments to `2401`.
- URL slugs use leading slash: `/shell-necklace-1`, `/shell-necklace-2`.
- Category output is `Shell Necklaces`.
- Each product groups its base image plus alternate image by filename root.
- A full-folder dry run currently finds 53 product groups, not 54; filename root `51` is missing from `~/Documents/Shell Necklaces`.

Remaining before all products:

- Add or locate the missing `51` image group if the final count should be 54 products.
- If Squarespace requires public image URLs instead of local paths, re-run with `--image-base-url` once the uploaded image URL prefix is known.
- If the import template requires a Product Page/store column, add that column before final import.

## Squarespace publish trial

Published on 2026-05-16 to Cassie Stirman's Squarespace Jewelry store page:

- Product 1: https://www.cassiestirman.com/jewelry/p/shell-necklace-1
  - Product ID: `6a08d6369bbeeb1bb61147ca`
  - SKU: `2400`
  - Images uploaded and READY: `1.JPG`, `1-2.JPG`
- Product 2: https://www.cassiestirman.com/jewelry/p/shell-necklace-2
  - Product ID: `6a08d6403508e0735ce4cf8b`
  - SKU: `2401`
  - Images uploaded and READY: `2.JPG`, `2-2.JPG`

Verified both public product URLs return HTTP 200 and show `Shell Pendant Necklace` at `$111.00`.

## Full Squarespace publish — 53 products

Completed on 2026-05-16 for the `Shell Necklaces` Squarespace store page (`6a08dc5749069658966bc2d3`, slug `shell-necklaces`).

- Published all 53 detected necklace groups from `~/Documents/Shell Necklaces`.
- Filename root `51` is not present, so the published roots are `1`–`50`, `52`, `53`, and `54`.
- SKU range is `2400`–`2452`, with `2450` assigned to root `52` because root `51` is missing.
- All products are visible, tagged `Jewelry`, priced at `$111.00`, stock quantity `1`, and use the shared title/description.
- All 103 source images are present on the products; the final importer result recorded 98 READY uploads in this continuation and skipped only root `1`, which had already been created with READY images by the prior timed-out run.
- API verification found all 53 expected `shell-necklace-*` products on the `Shell Necklaces` store page and sampled products `1`, `2`, and `54` with images, SKUs, pricing, stock, and variant image assignment.

Result artifact: `shell-necklace-import-results.json`.
