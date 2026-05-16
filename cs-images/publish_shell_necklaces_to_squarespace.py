#!/usr/bin/env python3
"""Publish Shell Pendant Necklace products to Cassie's Squarespace store.

Idempotent-ish importer for HAR-3658:
- groups images in ~/Documents/Shell Necklaces by filename root (1.JPG + 1-2.JPG)
- creates missing physical products on the Shell Necklaces store page
- uploads grouped images for newly-created products
- skips products whose slug or SKU already exists

Secrets are read from /Users/rosie/.openclaw/secrets/squarespace-cassiestirman.env.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.squarespace.com"
STORE_PAGE_TITLE = "Shell Necklaces"
IMAGE_DIR = Path.home() / "Documents" / "Shell Necklaces"
ENV_PATH = Path.home() / ".openclaw/secrets/squarespace-cassiestirman.env"
USER_AGENT = "Rosie HAR Jewelry Import (stirman@gmail.com)"

TITLE = "Shell Pendant Necklace"
DESCRIPTION = (
    "A Northern California naturally sculpted coastal shell pendant with organic "
    "mineral patterning and ocean-polished edges. (18”, 18kt gold-plated necklace)"
)
TAGS = ["Jewelry"]
START_SKU = 2400
PRICE = "111.00"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


def load_key() -> str:
    for line in ENV_PATH.read_text().splitlines():
        if line.strip().startswith("SQUARESPACE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError(f"SQUARESPACE_API_KEY not found in {ENV_PATH}")


API_KEY = load_key()


def headers(content_type: str | None = "application/json") -> dict[str, str]:
    h = {"Authorization": f"Bearer {API_KEY}", "User-Agent": USER_AGENT}
    if content_type:
        h["Content-Type"] = content_type
    return h


def request(method: str, path: str, payload: dict | None = None, *, max_retries: int = 6):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    url = API + path
    for attempt in range(max_retries):
        req = urllib.request.Request(url, data=body, headers=headers(), method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt + 1 < max_retries:
                delay = int(e.headers.get("Retry-After") or min(60, 2 ** attempt))
                print(f"429 from Squarespace; waiting {delay}s before retry", flush=True)
                time.sleep(delay)
                continue
            raise RuntimeError(f"{method} {path} failed HTTP {e.code}: {detail}") from e


def get_all_products() -> list[dict]:
    products: list[dict] = []
    cursor = None
    while True:
        qs = {"type": "PHYSICAL"}
        if cursor:
            qs["cursor"] = cursor
        data = request("GET", "/v2/commerce/products?" + urllib.parse.urlencode(qs))
        products.extend(data.get("products", []))
        page = data.get("pagination", {})
        if not page.get("hasNextPage"):
            return products
        cursor = page.get("nextPageCursor")


def get_store_page_id() -> str:
    data = request("GET", "/1.0/commerce/store_pages")
    pages = data.get("storePages", [])
    for page in pages:
        if page.get("title") == STORE_PAGE_TITLE and page.get("isEnabled"):
            return page["id"]
    raise RuntimeError(f"Enabled store page titled {STORE_PAGE_TITLE!r} not found. Found: {pages}")


def filename_root(path: Path) -> str:
    return re.sub(r"-\d+$", "", path.stem)


def natural_key(value: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def grouped_images() -> dict[str, list[Path]]:
    grouped: dict[str, list[Path]] = {}
    for path in IMAGE_DIR.iterdir():
        if path.is_file() and path.suffix.lower() in IMAGE_EXTS:
            grouped.setdefault(filename_root(path), []).append(path)
    return {root: sorted(paths, key=lambda p: natural_key(p.stem)) for root, paths in sorted(grouped.items(), key=lambda kv: natural_key(kv[0]))}


def product_payload(root: str, sku: int, store_page_id: str) -> dict:
    return {
        "type": "PHYSICAL",
        "storePageId": store_page_id,
        "name": TITLE,
        "description": DESCRIPTION,
        "urlSlug": f"shell-necklace-{root}",
        "tags": TAGS,
        "isVisible": True,
        "variants": [
            {
                "sku": str(sku),
                "pricing": {"basePrice": {"currency": "USD", "value": PRICE}},
                "stock": {"quantity": 1, "unlimited": False},
            }
        ],
    }


def upload_image(product_id: str, path: Path) -> str:
    # Squarespace docs specify multipart/form-data; field name is file.
    cmd = [
        "curl", "-fsS", "--retry", "4", "--retry-delay", "3",
        "-H", f"Authorization: Bearer {API_KEY}",
        "-H", f"User-Agent: {USER_AGENT}",
        "-F", f"file=@{path};type=image/jpeg",
        f"{API}/v2/commerce/products/{product_id}/images",
    ]
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out)["imageId"]


def wait_image_ready(product_id: str, image_id: str, timeout_s: int = 180) -> str:
    deadline = time.time() + timeout_s
    last_status = "UNKNOWN"
    while time.time() < deadline:
        data = request("GET", f"/v2/commerce/products/{product_id}/images/{image_id}/status")
        last_status = data.get("status", "UNKNOWN")
        if last_status in {"READY", "ERROR"}:
            return last_status
        time.sleep(3)
    return f"TIMEOUT({last_status})"


def main() -> int:
    if not IMAGE_DIR.is_dir():
        raise SystemExit(f"Image directory missing: {IMAGE_DIR}")

    store_page_id = get_store_page_id()
    groups = grouped_images()
    products = get_all_products()
    existing_slugs = {p.get("urlSlug", "").removeprefix("p/"): p for p in products}
    existing_skus = {v.get("sku"): p for p in products for v in p.get("variants", [])}

    print(f"Store page: {STORE_PAGE_TITLE} ({store_page_id})")
    print(f"Image groups: {len(groups)} roots: {', '.join(groups)}")

    created = []
    skipped = []
    uploads = []
    for offset, (root, images) in enumerate(groups.items()):
        sku = START_SKU + offset
        slug = f"shell-necklace-{root}"
        if slug in existing_slugs or str(sku) in existing_skus:
            product = existing_slugs.get(slug) or existing_skus[str(sku)]
            skipped.append({"root": root, "sku": sku, "slug": slug, "productId": product.get("id")})
            print(f"SKIP root {root}: existing product {product.get('id')} sku {sku} slug {slug}", flush=True)
            continue

        product = request("POST", "/v2/commerce/products", product_payload(root, sku, store_page_id))
        product_id = product["id"]
        variant_id = (product.get("variants") or [{}])[0].get("id")
        url = product.get("url")
        print(f"CREATE root {root}: product {product_id} sku {sku} {url}", flush=True)
        image_results = []
        first_image_id = None
        for image in images:
            image_id = upload_image(product_id, image)
            status = wait_image_ready(product_id, image_id)
            image_results.append({"file": image.name, "imageId": image_id, "status": status})
            uploads.append({"productId": product_id, "root": root, "file": image.name, "imageId": image_id, "status": status})
            print(f"  image {image.name}: {image_id} {status}", flush=True)
            if first_image_id is None:
                first_image_id = image_id
        if first_image_id and variant_id:
            request("POST", f"/v2/commerce/products/{product_id}/variants/{variant_id}/image", {"imageId": first_image_id})
            print(f"  assigned first image to variant {variant_id}", flush=True)
        created.append({"root": root, "sku": sku, "slug": slug, "productId": product_id, "variantId": variant_id, "url": url, "images": image_results})
        # Keep well below API limits and avoid bursty image processing.
        time.sleep(1)

    result = {
        "storePageId": store_page_id,
        "imageDir": str(IMAGE_DIR),
        "createdCount": len(created),
        "skippedCount": len(skipped),
        "uploadCount": len(uploads),
        "created": created,
        "skipped": skipped,
        "uploads": uploads,
    }
    out_path = Path(__file__).with_name("shell-necklace-import-results.json")
    out_path.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Wrote {out_path}")
    print(f"Created {len(created)}, skipped {len(skipped)}, uploads {len(uploads)}")
    bad = [u for u in uploads if u["status"] != "READY"]
    if bad:
        print(f"WARNING: {len(bad)} image uploads not READY: {bad}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
