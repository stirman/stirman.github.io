# Shell Pendant Necklace import defaults

Source: HAR-3655.

## Product defaults

Every product should share these values:

- Title: `Shell Pendant Necklace`
- Description: `A Northern California naturally sculpted coastal shell pendant with organic mineral patterning and ocean-polished edges. (18”, 18kt gold-plated necklace)`
- Price: `$111`
- Quantity: `1`
- Tags: `Jewelry`
- Categories: `Shell Necklaces`
- Visibility: `Public`

Only these vary per product:

- SKU: start at `2400`, increment by `1` per product
- Images: grouped by filename root
- URL slug: `shell-necklace-[filename-root]`

## Image grouping rule

- `1.JPG` + `1-2.JPG` = product rooted at `1`
- `2.JPG` + `2-2.JPG` + `2-3.JPG` = product rooted at `2`
- Primary image is the base filename when present; suffixed filenames are alternates.

## CSV helper

Use `generate_shell_import_csv.py` after the images are on the Mac mini:

```bash
cd /Users/rosie/clawd/stirman/stirman.github.io/cs-images
./generate_shell_import_csv.py /path/to/images -o shell-necklace-import.csv --image-base-url 'https://example.com/path-to-uploaded-images'
```

If the Squarespace import template expects slugs with a leading slash, add `--leading-slash`.

## Final import details still needed

Before the final CSV import, confirm:

1. The actual image folder path on the Mac mini.
2. The public image URL prefix, if Squarespace needs image URLs rather than local file paths in the CSV.
3. The target Squarespace Product Page/store slug if the exported template requires a `Product Page` column.
