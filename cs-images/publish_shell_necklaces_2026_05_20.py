#!/usr/bin/env python3
"""Publish the 2026-05-20 Shell Necklaces add-on batch.

Source images are in ~/Documents/Shell Necklaces 5-20-26 and are named 54-59,
but shell-necklace-54 already exists from the prior import. To publish the six
new necklaces as six distinct products, map source roots 54-59 to the next
available product numbers 55-60 and SKUs 2453-2458.
"""
from __future__ import annotations

import json
import mimetypes
import re
import subprocess
import time
from pathlib import Path

import importlib.util

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("publish", HERE / "publish_shell_necklaces_to_squarespace.py")
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)  # type: ignore[union-attr]

IMAGE_DIR = Path.home() / "Documents" / "Shell Necklaces 5-20-26"
OUT_PATH = HERE / "shell-necklace-import-results-2026-05-20.json"
STORE_PAGE_TITLE = "Shell Necklaces"
TITLE = "Shell Pendant Necklace"
DESCRIPTION = (
    "A Northern California naturally sculpted coastal shell pendant with organic "
    "mineral patterning and ocean-polished edges. (16\" or 18”, 18kt gold-plated necklace)"
)
TAGS = ["Jewelry"]
PRICE = "111.00"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


def filename_root(path: Path) -> str:
    return re.sub(r"-\d+$", "", path.stem)


def natural_key(value: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def grouped_images() -> list[tuple[str, list[Path]]]:
    grouped: dict[str, list[Path]] = {}
    for path in IMAGE_DIR.iterdir():
        if path.is_file() and path.suffix.lower() in IMAGE_EXTS:
            grouped.setdefault(filename_root(path), []).append(path)
    return [(root, sorted(paths, key=lambda p: natural_key(p.stem))) for root, paths in sorted(grouped.items(), key=lambda kv: natural_key(kv[0]))]


def upload_image(product_id: str, path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    cmd = [
        "curl", "-fsS", "--retry", "4", "--retry-delay", "3",
        "-H", f"Authorization: Bearer {publish.API_KEY}",
        "-H", f"User-Agent: {publish.USER_AGENT}",
        "-F", f"file=@{path};type={mime}",
        f"{publish.API}/v2/commerce/products/{product_id}/images",
    ]
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out)["imageId"]


def product_payload(product_number: int, sku: int, store_page_id: str) -> dict:
    return {
        "type": "PHYSICAL",
        "storePageId": store_page_id,
        "name": TITLE,
        "description": DESCRIPTION,
        "urlSlug": f"shell-necklace-{product_number}",
        "tags": TAGS,
        "isVisible": True,
        "variants": [{
            "sku": str(sku),
            "pricing": {"basePrice": {"currency": "USD", "value": PRICE}},
            "stock": {"quantity": 1, "unlimited": False},
        }],
    }


def main() -> int:
    if not IMAGE_DIR.is_dir():
        raise SystemExit(f"Image directory missing: {IMAGE_DIR}")
    groups = grouped_images()
    if len(groups) != 6:
        raise SystemExit(f"Expected 6 image groups in {IMAGE_DIR}, found {len(groups)}: {[g[0] for g in groups]}")

    store_page_id = publish.get_store_page_id()
    products = publish.get_all_products()
    existing_slugs = {(p.get("urlSlug") or "").removeprefix("p/"): p for p in products}
    existing_skus = {v.get("sku"): p for p in products for v in p.get("variants", [])}

    start_product_number = 55
    start_sku = 2453
    created = []
    skipped = []
    uploads = []
    print(f"Store page: {STORE_PAGE_TITLE} ({store_page_id})")
    print("Source mapping: " + ", ".join(f"{root}->shell-necklace-{start_product_number + i}" for i, (root, _) in enumerate(groups)))

    for offset, (source_root, images) in enumerate(groups):
        product_number = start_product_number + offset
        sku = start_sku + offset
        slug = f"shell-necklace-{product_number}"
        if slug in existing_slugs or str(sku) in existing_skus:
            product = existing_slugs.get(slug) or existing_skus[str(sku)]
            skipped.append({"sourceRoot": source_root, "productNumber": product_number, "sku": sku, "slug": slug, "productId": product.get("id"), "url": product.get("url")})
            print(f"SKIP source {source_root} -> {slug}: existing product {product.get('id')}", flush=True)
            continue

        product = publish.request("POST", "/v2/commerce/products", product_payload(product_number, sku, store_page_id))
        product_id = product["id"]
        variant_id = (product.get("variants") or [{}])[0].get("id")
        url = product.get("url")
        print(f"CREATE source {source_root} -> {slug}: product {product_id} sku {sku} {url}", flush=True)
        image_results = []
        first_image_id = None
        for image in images:
            image_id = upload_image(product_id, image)
            status = publish.wait_image_ready(product_id, image_id)
            image_results.append({"file": image.name, "imageId": image_id, "status": status})
            uploads.append({"productId": product_id, "sourceRoot": source_root, "productNumber": product_number, "file": image.name, "imageId": image_id, "status": status})
            print(f"  image {image.name}: {image_id} {status}", flush=True)
            if first_image_id is None:
                first_image_id = image_id
        if first_image_id and variant_id:
            publish.request("POST", f"/v2/commerce/products/{product_id}/variants/{variant_id}/image", {"imageId": first_image_id})
            print(f"  assigned first image to variant {variant_id}", flush=True)
        created.append({"sourceRoot": source_root, "productNumber": product_number, "sku": sku, "slug": slug, "productId": product_id, "variantId": variant_id, "url": url, "images": image_results})
        time.sleep(1)

    payload = {
        "storePageId": store_page_id,
        "imageDir": str(IMAGE_DIR),
        "mappingNote": "Source filenames 54-59 were mapped to shell-necklace-55 through shell-necklace-60 because shell-necklace-54 already existed from the previous import.",
        "createdCount": len(created),
        "skippedCount": len(skipped),
        "uploadCount": len(uploads),
        "created": created,
        "skipped": skipped,
        "uploads": uploads,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT_PATH}")
    print(f"Created {len(created)}, skipped {len(skipped)}, uploads {len(uploads)}")
    bad = [u for u in uploads if u["status"] != "READY"]
    if bad:
        print(f"WARNING: {len(bad)} image uploads not READY: {bad}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
