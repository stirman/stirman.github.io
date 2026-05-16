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
