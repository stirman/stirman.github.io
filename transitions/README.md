# Transition Gallery

A playground of image-to-image transitions (WebGL shaders + a GPU particle
system). Each card shows one image; **click the image or its Play button** to
transition to the second image — click again to transition back, so you can
see every effect run both ways.

## Run it

The page needs a tiny local web server (so the browser can load the image
files). From this folder:

```bash
python3 -m http.server 8000
```

Then open **http://127.0.0.1:8000** in Chrome, Edge, Safari, or Firefox.

No build step, no installs — it's a single `index.html` that pulls GSAP from a
CDN, so you just need to be online the first time.

Prefer Node? `npx serve` (or any static file server) works too.

### Seeing a wall of `code 400, message Bad request` in the terminal?

That means your browser tried to load the page over **HTTPS**, but this is a
plain **HTTP** server. Fixes, in order:

1. Open **http://127.0.0.1:8000** — type `http://` explicitly, and use
   `127.0.0.1` instead of `localhost` (Chrome likes to auto-upgrade
   `localhost` to HTTPS). Type it fresh so autocomplete doesn't re-add `https`.
2. Still forced to HTTPS? Try an **Incognito/Private window**, or use
   **Firefox/Safari**.
3. In Chrome you can also turn off **Settings → Privacy and security →
   Security → "Always use secure connections."**

(A local server is required — opening `index.html` directly via `file://`
won't work, because the WebGL effects can't read the images that way.)

## What's inside

- `index.html` — the whole gallery (markup, styles, and all transitions).
- `*.png` — two before/after image pairs (couple, ps), alternated across cards.

## Use your own images

Open `index.html` and edit the `PAIRS` list near the top of the `<script>`:

```js
const PAIRS = [
  { label: 'Couple', before: 'couple1.png', after: 'couple2.png' },
  ...
];
```

Point `before`/`after` at your own files (any aspect ratio works) and reload.
Transitions cycle through the pairs automatically.
