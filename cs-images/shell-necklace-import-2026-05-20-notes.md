# Shell Necklace Add-on Import — 2026-05-20

Paperclip issue: HAR-3663

## Result

Published six new visible Shell Pendant Necklace products to Cassie's Squarespace `Shell Necklaces` store page.

- Source folder: `~/Documents/Shell Necklaces 5-20-26`
- Source filename groups: `54`–`59`, each with primary and secondary PNG image
- Existing `shell-necklace-54` was already live from the prior import, so the new source groups were mapped to the next six available products:
  - source `54` → `shell-necklace-55`, SKU `2453`
  - source `55` → `shell-necklace-56`, SKU `2454`
  - source `56` → `shell-necklace-57`, SKU `2455`
  - source `57` → `shell-necklace-58`, SKU `2456`
  - source `58` → `shell-necklace-59`, SKU `2457`
  - source `59` → `shell-necklace-60`, SKU `2458`
- Store page ID: `6a08dc5749069658966bc2d3`
- Price: `$111.00`
- Stock: `1` each
- Category: `Shell Necklaces`
- Tag: `Jewelry`
- Visibility: public / visible
- Description includes the existing length wording: `(16" or 18”, 18kt gold-plated necklace)`
- Attached the existing required `Necklace Length` checkout form (`6a09f91a888e7f148c516238`) to all six new products.

## Verification

- Created products: `6`
- Uploaded images: `12`, all `READY`
- Internal Squarespace admin readback verified all six new products have:
  - `productFormId = 6a09f91a888e7f148c516238`
  - two product images
  - SKUs `2453`–`2458`
  - the 16"/18” description text
- Public smoke test passed on `https://www.cassiestirman.com/shell-necklaces/p/shell-necklace-60`: Add To Cart opens the required Necklace Length dialog with radio options `16"` and `18"`.

Detailed API results:

- `shell-necklace-import-results-2026-05-20.json`
- `shell-necklace-form-update-results-2026-05-20.json`
