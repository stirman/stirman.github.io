#!/usr/bin/env python3
"""Generate a Squarespace-ready shell pendant product CSV from product photos.

Filename grouping:
  1.JPG, 1-2.JPG, 1-3.JPG -> one product rooted at "1"
  2.JPG, 2-2.JPG          -> one product rooted at "2"

The script keeps the product defaults requested in HAR-3655 and only varies SKU,
URL slug, and image list per product.
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from urllib.parse import quote

DEFAULT_TITLE = "Shell Pendant Necklace"
DEFAULT_DESCRIPTION = (
    "A Northern California naturally sculpted coastal shell pendant with organic "
    "mineral patterning and ocean-polished edges. (18”, 18kt gold-plated necklace)"
)
DEFAULT_PRICE = "111"
DEFAULT_QUANTITY = "1"
DEFAULT_TAGS = "Jewelry"
DEFAULT_CATEGORY = "Shell Neclaces"
DEFAULT_VISIBILITY = "Public"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}

COLUMNS = [
    "Product Type",
    "Title",
    "Description",
    "SKU",
    "Regular Price",
    "Stock",
    "Categories",
    "Tags",
    "Visibility",
    "URL Slug",
    "Images",
]


def filename_root(path: Path) -> str:
    stem = path.stem
    # Treat numeric suffixes after a dash as alternate images for the same item.
    # Examples: 1-2 -> 1, shell-12-3 -> shell-12
    return re.sub(r"-\d+$", "", stem)


def natural_key(value: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def image_value(path: Path, image_base_url: str | None) -> str:
    if image_base_url:
        return image_base_url.rstrip("/") + "/" + quote(path.name)
    return str(path)


def build_rows(image_dir: Path, start_sku: int, image_base_url: str | None, leading_slash: bool):
    files = [p for p in image_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
    grouped: dict[str, list[Path]] = {}
    for path in files:
        grouped.setdefault(filename_root(path), []).append(path)

    rows = []
    for offset, root in enumerate(sorted(grouped, key=natural_key)):
        images = sorted(grouped[root], key=lambda p: natural_key(p.stem))
        slug = f"shell-necklace-{root}"
        if leading_slash:
            slug = "/" + slug
        rows.append({
            "Product Type": "Physical",
            "Title": DEFAULT_TITLE,
            "Description": DEFAULT_DESCRIPTION,
            "SKU": str(start_sku + offset),
            "Regular Price": DEFAULT_PRICE,
            "Stock": DEFAULT_QUANTITY,
            "Categories": DEFAULT_CATEGORY,
            "Tags": DEFAULT_TAGS,
            "Visibility": DEFAULT_VISIBILITY,
            "URL Slug": slug,
            "Images": ";".join(image_value(p, image_base_url) for p in images),
        })
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate shell necklace import CSV defaults for Squarespace.")
    parser.add_argument("image_dir", type=Path, help="Folder containing product images, e.g. 1.JPG and 1-2.JPG")
    parser.add_argument("-o", "--output", type=Path, default=Path("shell-necklace-import.csv"), help="CSV output path")
    parser.add_argument("--start-sku", type=int, default=2400, help="First SKU; increments by 1 per product")
    parser.add_argument("--image-base-url", help="Optional public URL prefix for images; otherwise local paths are written")
    parser.add_argument("--leading-slash", action="store_true", help="Prefix URL Slug values with / if the import template requires it")
    args = parser.parse_args()

    if not args.image_dir.is_dir():
        raise SystemExit(f"Image folder not found: {args.image_dir}")

    rows = build_rows(args.image_dir, args.start_sku, args.image_base_url, args.leading_slash)
    if not rows:
        raise SystemExit(f"No supported image files found in {args.image_dir}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} product rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
