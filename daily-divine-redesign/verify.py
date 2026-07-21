#!/usr/bin/env python3
"""Verify the Daily Divine redesign prototype.

Asserts:
  1. All expected files exist.
  2. app.html defines all 15 screen keys (data-screen sections).
  3. index.html gallery links to every screen via app.html?screen=KEY.
  4. All runtime assets (href/src) in the HTML are relative — no absolute
     URLs, protocol-relative URLs, or root-relative paths.
  5. app.js routes all 15 keys and passes `node --check` when node exists.

Run:  python3 verify.py
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SCREENS = [
    "welcome", "daily", "add-sign", "guidance", "moon", "intention",
    "deck", "card-detail", "profile", "personalization", "prompt-settings",
    "premium", "settings", "admin", "users",
]

FILES = ["index.html", "app.html", "styles.css", "app.js", "PROJECT.md", "verify.py"]

failures = []
passes = []


def check(ok, label):
    (passes if ok else failures).append(label)
    print(("  PASS  " if ok else "  FAIL  ") + label)


print("Daily Divine redesign — verifier\n")

print("Files:")
for name in FILES:
    check((ROOT / name).is_file(), f"{name} exists")

app_html = (ROOT / "app.html").read_text(encoding="utf-8")
index_html = (ROOT / "index.html").read_text(encoding="utf-8")
app_js = (ROOT / "app.js").read_text(encoding="utf-8")

print("\nScreens in app.html:")
defined = set(re.findall(r'data-screen="([^"]+)"', app_html))
for key in SCREENS:
    check(key in defined, f'app.html has <section data-screen="{key}">')
check(len(defined) == len(SCREENS),
      f"app.html defines exactly {len(SCREENS)} screens (found {len(defined)})")

print("\nGallery links in index.html:")
for key in SCREENS:
    check(f'href="app.html?screen={key}"' in index_html,
          f"index.html links to app.html?screen={key}")

print("\nRelative runtime assets:")
for name in ("index.html", "app.html"):
    html = (ROOT / name).read_text(encoding="utf-8")
    refs = re.findall(r'(?:href|src)="([^"]+)"', html)
    bad = [r for r in refs
           if r.startswith(("http://", "https://", "//", "/"))]
    check(not bad, f"{name}: all {len(refs)} href/src values are relative"
          + (f" (offenders: {bad})" if bad else ""))
    for ref in refs:
        target = ref.split("?", 1)[0].split("#", 1)[0]
        if target and not (ROOT / target).is_file():
            check(False, f"{name}: referenced asset missing: {target}")

print("\napp.js:")
js_keys = set(re.findall(r"'([a-z-]+)'", app_js))
check(all(k in js_keys for k in SCREENS), "app.js SCREENS covers all 15 keys")

node = shutil.which("node")
if node:
    result = subprocess.run([node, "--check", str(ROOT / "app.js")],
                            capture_output=True, text=True)
    check(result.returncode == 0,
          "node --check app.js (syntax)"
          + ("" if result.returncode == 0 else f": {result.stderr.strip()}"))
else:
    print("  SKIP  node not found — JS syntax check skipped")

print(f"\n{len(passes)} passed, {len(failures)} failed.")
if failures:
    print("Failures:")
    for f in failures:
        print("  - " + f)
    sys.exit(1)
print("All checks passed ✦")
