# Handoff: the "Catalogue of Machines" portfolio

What was built for **www.ruchita.uk**, how it works, how it was checked and shipped, and how to build a similar site.
It is written for an engineer or a coding agent picking this up cold. Every path is relative to the repo root.

- **Live site:** https://www.ruchita.uk (the bare domain redirects there)
- **Repo:** https://github.com/RuchitaVehale1998/Ruchita_Vehale_Portfolio_new
- **Branches:** `main` (deployed), `catalogue-of-machines` (working branch, merged through PRs #1–#7), `archive/hugo-site` (the old Hugo site, unchanged)
- **Walkthrough video:** https://www.ruchita.uk/walkthrough.mp4 (2.5 min, desktop then phone)

---

## 1. What was done, in order

| PR | Date | Change |
|---|---|---|
| #1 | 2026-11-10 | Rewrote the old Hugo portfolio as a hand-built static site in `site/`: thirteen "plates", each a working canvas model of a historic machine, plus a hero, a paper-tape strip, a split-flap metrics board, a front panel and an index. |
| #2 | 2026-11-10 | Made each plate lead with a real project and its own animated illustration, with the machine second. Replaced the hero (no Bloch sphere, no eye) with a LiDAR point cloud above a Turing tape. Cut red to one small accent per drawing. Linked the four papers to their publishers through DOIs and corrected the paper details against Crossref. |
| #3 | 2026-11-10 | Phone and small-tablet optimisation (no horizontal overflow from 320 px to 1024 px, 44 px touch targets, 16 px inputs, a Close button on the index, a narrow layout for every scene). The DeGould role now ends May 2026. |
| #4 | 2026-11-10 | A walkthrough video, a preview GIF, the recorder script, and "Live site" plus demo links at the top of the README. |
| #5 | 2026-11-10 | Moved the video into `site/` so it plays in the browser. GitHub will not play it, as explained in section 8. |
| #6 | 2026-11-11 | Link-preview image (`og:image`) and the sharing and search metadata, so LinkedIn shows a card. Added `robots.txt` and `sitemap.xml`. |
| #7 | 2026-11-11 | Removed the old Hugo files from `main`; they are kept on `archive/hugo-site`. Added `.gitignore`. |

The repo's GitHub "website" field is set to `https://www.ruchita.uk` (`gh repo edit --homepage`).

---

## 2. Architecture

**Plain static site.** HTML, CSS and ES modules; no framework, no build step, no package.json. The only runtime third
party is Google Fonts (Bodoni Moda and IBM Plex Mono). Everything deployable is in `site/`; `docs/` and `tools/` are
repo-only.

```
site/
  index.html             the whole page; all text about the person is real HTML (readable without JS)
  css/styles.css         design tokens, layout, every breakpoint
  js/main.js             lazy-mounts each canvas, wires the HTML controls to scene APIs, boots the globals
  js/core.js             scene runner (one requestAnimationFrame loop) and the 2D drawing helpers
  js/tape.js             fixed ITA2 paper tape down the left edge, advanced by scrolling
  js/flap.js             split-flap metrics board in the hero
  js/panel.js            Altair-style front panel (plate number in binary) and the index overlay
  js/lib/*.js            pure machine logic, no DOM: enigma.js, tm.js (Turing programs), codes.js (Hollerith, ITA2)
  js/plates/*.js         one scene per plate: hero.js + hero-lidar.js, turing, obscura, loom, chart, gyro, radio,
                         engine, core, switch, gears, card, enigma
  js/projects/*.js       the project illustrations: dego, drive, apple, slam, landing, antenna, follow, firmware
  files/                 résumé PDF
  og-image.jpg  walkthrough.mp4  robots.txt  sitemap.xml  favicon.svg
tools/
  record-walkthrough.mjs records the walkthrough video and the preview GIF
  make-og-image.mjs      makes the 1200 x 630 link-preview image
docs/
  preview.gif            the README's inline preview
.github/workflows/hugo.yml  deploys ./site to GitHub Pages (the name is historical; there is no Hugo)
```

### The scene runner (`site/js/core.js`)

- **One loop.** A single `requestAnimationFrame` loop. Each scene draws only while its canvas is on screen (IntersectionObserver).
- **Pixel ratio.** Clamped to 2, or to 1.5 on screens under 760 px.
- **Reduced motion.** With `prefers-reduced-motion` or `?motion=0`, each scene renders a settled still (150 simulated frames). It then redraws in short bursts only while it is being interacted with.
- **Lazy loading.** `main.js` loads a scene's module when its canvas comes within 600 px of the viewport.
- **Debugging.** `?debug` shows frames per second.

**Scene contract.** A module default-exports a factory:

```js
import { C, label, ink, line, corners, out, TAP } from '../core.js';

export default function myScene(env) {        // env: canvas, w, h, small, reduced, ptr, redraw(), now(), kick()
  let speed = 1;
  const api = { speed(v) { speed = +v; } };     // called by <input data-for="myScene" data-call="speed">
  function draw(ctx, t, dt) {                   // t, dt in seconds; ctx is already scaled to CSS pixels
    const { w, h, ptr } = env;                  // ptr: x, y, in, down, dx, dy, click (true for one frame)
    const narrow = w < 640;                     // layouts adapt to the CANVAS width, not the viewport
    if (ptr.click) { /* … */ }
    ink(ctx, 0.9, 1.4); line(ctx, 0, h / 2, w, h / 2);
    label(ctx, `${TAP} TO DO X`, 14, h - 12, { size: 9.5, color: C.g3 });   // TAP = "TAP" on touch screens, else "CLICK"
    out(env, 'myScene-read', `<b>speed</b> ${speed}`);                      // fills [data-out="myScene-read"] in the plate
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api /*, resize(w, h), destroy() */ };
}
```

**Registering a scene:**
1. Add it to `loaders` in `main.js`.
2. Put a canvas in a figure:
   ```html
   <figure class="fig" style="--ar:16/10;--arm:4/5"><canvas data-scene="myScene" data-key="myScene" aria-hidden="true"></canvas><figcaption>…</figcaption></figure>
   ```
   `--ar` is the desktop aspect ratio; `--arm` is used at 760 px and below.

**HTML controls drive scenes without any wiring code:**
- **Inputs and buttons:** `data-for="<key>" data-call="<method>"` (plus `data-arg` for buttons) calls `api[method](value)`.
- **Segmented button groups:** `.seg` groups toggle `.on` for you.

**Helpers in `core.js`:**
- **Colour and maths:** `C` (canvas palette), `rgba`, `clamp`, `lerp`, `rng(seed)`, `gauss`.
- **Drawing:** `ink`, `line`, `circle`, `label`, `tag`, `grid`, `arrow`, `dim`, `hatch`, `corners`, `centerline`, `roundRect`.
- **Runtime:** `out`, `REDUCED`, `params`, `isSmall`, `TAP`.

### Plate anatomy (project first, then the machine)

```html
<section class="plate" id="p2" data-n="2" data-title="Camera obscura" data-year="c. 1011–1021" data-proj="3D localisation, DeGould">
  <header class="ph"> big roman numeral + eyebrow + h2 </header>
  <div class="proj">   project illustration figure  +  .dl (role line, description, .m metrics, .stack) </div>
  <p class="mhead"><b>The machine behind it</b> …</p>
  <div class="pbody">  machine figure  +  aside.tb (spec table, .note, .try, .read[data-out]) </div>
  <div class="ctrls">  inputs and buttons with data-for / data-call </div>
</section>
```

The index overlay (`panel.js`) is built from each section's `data-title`, `data-year` and `data-proj`.

### What is on each plate

| Plate | Machine (scene) | Project illustration |
|---|---|---|
| Hero | LiDAR point cloud being mapped (`hero-lidar.js`) above a binary-counter Turing tape (`hero.js`) | |
| I | Turing machine: increment, invert, unary add, busy beaver (`turing.js`, logic in `lib/tm.js`) | |
| II | Camera obscura, with a draggable object and stereo (`obscura.js`) | DeGould 3D defect localisation (`dego.js`) |
| III | Jacquard loom, with clickable card holes (`loom.js`) | DriveSense OOD pipeline (`drive.js`) and apple detection (`apple.js`) |
| IV | Sea chart dead reckoning; click to drop beacons (`chart.js`) | Dynamic SLAM (`slam.js`) |
| V | Gyroscope and attitude indicator, drag to tilt (`gyro.js`) | Precision landing without GPS (`landing.js`) |
| VI | Spark-gap telegraph and resonance (`radio.js`) | Multi-band antenna, S11 sweep (`antenna.js`) |
| VII | Difference engine with a crank (`engine.js`) | Leader–follower robots (`follow.js`) |
| VIII | Magnetic-core memory (`core.js` plate) | HVN firmware links and bus traces (`firmware.js`) |
| IX | Switchboard: projects patched to skills, red cords (`switch.js`) | |
| X | Antikythera-style dial: career timeline, red pointer (`gears.js`) | |
| XI | Hollerith punched card: the résumé (`card.js`) | |
| XII | Card catalogue: the four papers, each linked to its DOI (HTML only) | |
| XIII | Enigma I; typing a message opens a `mailto:` with it (`enigma.js`) | |

---

## 3. Design system

- **Palette (CSS tokens on `:root`):**
  - Black `--k #000`; greys `--g1 #232323`, `--g2 #3a3a3a`, `--g3 #6b6b6b`, `--g4 #a0a0a0`.
  - Off-white `--w #f1f1f1`; one red `--red #c4382d`.
  - The canvas palette `C` in `core.js` mirrors these.
- **Red is a rare accent:** one small detail per drawing (a read-head tooth, a sweep ray, a pointer tip), and no glows.
  - **Exceptions the owner asked for:** the switchboard's patch cords are red, and the gears calendar keeps its red pointer, active ring and role label.
- **Type:**
  - Bodoni Moda for display: the name, plate titles, numerals.
  - IBM Plex Mono for everything else, including canvas labels (9–11 px).
- **Line art:** 1–1.6 px strokes, corner registration marks, dashed centre lines, "illustrative" labels on every project model.
- **Layout:** the fixed paper tape on the left (68 px, or 30 px on phones), a fixed top bar, a max content width of 1480 px.
  - Hero: two columns above 1060 px.
  - Plates: figure and spec sheet side by side above 1060 px, one column below.

---

## 4. Content accuracy rules (follow these on any similar site)

- **Illustrations are labelled "illustrative" and never show invented numbers.** Any figure in a canvas or the copy must come from the owner's résumé or their published work.
- **Verify publications against Crossref, not memory.** Crossref gave the real author order, volume, issue, pages and journal name. The original cards had a wrong journal name, a date that didn't match the record, a singular/plural slip in one title, and an author line implying first authorship on all four.
  ```bash
  curl -sS -G https://api.crossref.org/works --data-urlencode "query.bibliographic=<paper title>" \
       --data-urlencode "query.author=<surname>" --data-urlencode "rows=3" -A "portfolio-check/1.0"
  curl -sS https://api.crossref.org/works/<DOI>   # full record: authors in order, volume, issue, pages, dates
  ```
  Link papers through `https://doi.org/<DOI>`, which redirects to the publisher. Publisher sites block automated browsers (Cloudflare 403), so check the redirect target rather than the page.
- **Show authorship exactly.** List the real authors in order with the owner in bold. "SURNAME, Name, et al." implies first authorship.
- **Keep private data off the page.** The page shows no phone number.

---

## 5. Phones and small screens

**Breakpoints (all in `styles.css`; desktop rules are untouched by them):**

| Media query | What it does |
|---|---|
| `max-width: 1060px` | single column; grids use `minmax(0, 1fr)` |
| `max-width: 760px` | phone: 30 px tape, front panel hidden, tighter header, wrapping segmented controls and metric rows, index overlay as a grid with a Close button, text inputs at 16 px |
| `761px – 846px` | tablet portrait: extra height for the Turing (`#p1`) and switchboard (`#p9`) figures, whose scenes use compact layouts below a 720 px canvas |
| `max-width: 400px`, `360px` | more height for those two figures on small phones |
| `pointer: coarse` | 44 px touch targets, keyboard hints hidden, Close button shown, no tap flash, larger front-panel switches |

**Lessons that fixed real bugs:**
- **`grid-template-columns: 1fr` lets a child's minimum width stretch the whole column.** At 320 px the page was 58 px wider than the screen, which makes phones zoom out. Use `minmax(0, 1fr)` for single-column grids, and let long values wrap.
- **iOS Safari zooms the page when you focus any input under 16 px.** Set text inputs to 16 px on phones.
- **Canvas layouts must branch on the canvas width (`env.w`), not the viewport.** At 320 px a canvas is only 256 px wide.
  - Each scene has `narrow` (and sometimes `tiny`) branches: shorter labels, labels moved off clipped edges, text sized to its box, readouts placed below their diagram.
- **A keyboard-only control is a bug on phones.** The index could only be closed with Esc until the Close button was added.

**How to measure overflow:** `innerWidth` reports the zoomed-out width when a page overflows on a phone, so use
`document.documentElement.clientWidth` as the true layout width. The audit used for this work is in Appendix A. It
reports overflowing elements, small tap targets, tiny text, inputs under 16 px and canvas sizes.

**Widths checked:** 320, 360, 375, 390, 414, 430, 540, 667 × 375 (landscape), 768, 844 × 390 and 1024, all with zero
overflow. Every scene was looked at on a 320 px phone. Not yet done: a real iPhone and Android pass (only emulated).

---

## 6. Sharing and search

**Tags in `<head>`:**
- `<link rel="canonical" href="https://www.ruchita.uk/">` and `<meta name="author">`.
- Open Graph: `og:type` website, `og:url`, `og:site_name`, `og:locale`, `og:title`, `og:description`, `og:image` (absolute URL, with type, 1200 × 630 size and alt text).
- Twitter/X: `twitter:card` `summary_large_image`, plus title, description, image and alt text.
- A schema.org `Person` JSON-LD block: name, job title, city, universities, skill areas, LinkedIn and GitHub. It deliberately has no email or phone.
- A meta description of 150 characters. Google cuts snippets at about 160.

**Preview image (`site/og-image.jpg`):**
- `node tools/make-og-image.mjs site/og-image.jpg`.
- It screenshots the hero at 1200 × 630, at 2× pixel ratio for sharpness, in headless Chrome.
- It hides UI chrome (`.top nav, .panel, .lede, .cta, .meta, .figlab, .flaps`), adds the address, and scales the result down to an 85 KB JPEG.
- LinkedIn wants about 1.91:1, at least 1200 × 627, under 5 MB.

**`site/robots.txt` and `site/sitemap.xml`:** the robots file allows everything and points to the sitemap. Update the sitemap's `lastmod` when content changes.

**Checking a preview:**
- Nothing appears until the tags are deployed. LinkedIn's Post Inspector showed "no image" because the tags had only been added locally.
- Without `og:type`, LinkedIn labels the page "article".
- After deploying, fetch the page as LinkedIn's crawler does:
  ```bash
  UA="LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)"
  curl -sSL -A "$UA" https://ruchita.uk/ | grep -E 'og:|twitter:|canonical'
  curl -sS -A "$UA" -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' https://www.ruchita.uk/og-image.jpg
  ```
- Then run LinkedIn's Post Inspector (it needs a login). It forces a re-scrape; LinkedIn otherwise caches old previews for days.

**Google Search Console (pending, the owner's step):**
- Either add the DNS TXT record at the domain provider for a domain property, as a new record that leaves the Pages records alone.
- Or, for same-day verification, use a URL-prefix property with the HTML tag method: add the `google-site-verification` meta tag to the head and deploy.
- Then submit `https://www.ruchita.uk/sitemap.xml`.

---

## 7. Analytics (deliberately not installed)

The owner chose **no analytics**. For a similar site, these are the cookieless options researched in November 2026.
Pricing changes, so confirm on each vendor's page.

| Option | Cost | Notes |
|---|---|---|
| GoatCounter | free for personal sites (not re-checked in November 2026) | no cookies, small async script, ignores localhost |
| Umami Cloud | free "Hobby" plan, about 100k events a month | cookieless; count clicks with a `data-umami-event="name"` attribute on a link, with no extra JS. Sources disagreed on the free plan's site limit (1 or 3). |
| Cloudflare Web Analytics | free | no cookies or local storage; works without proxying through Cloudflare; ad blockers may block it |
| Plausible | paid, from about $9 a month for 10k pageviews | the most polished; open source and self-hostable |

**How to add one without changing the site:**
- Paste the vendor's snippet exactly as their dashboard gives it, as a single `defer` or `async` script before `</head>`. Snippet formats change, so don't copy one from memory.
- Nothing visual changes, and no consent banner is needed for a cookieless tool. That is a product judgment, not legal advice.
- Check on the live page that the script request returns 200 and that a visit shows in the dashboard.
- Every hosted option needs an account the owner creates. An agent must not create accounts on their behalf.

---

## 8. The walkthrough video

`node tools/record-walkthrough.mjs <outDir> [desktop|phone|both]`. It needs Node 22+, Google Chrome and ffmpeg, and it
records the live site; set `SITE_URL` to record another address.

**How it works:**
- **Browser:** drives headless Chrome over the DevTools protocol, with a small built-in client and no dependencies.
- **Desktop pass:** 1366 × 768 at pixel ratio 1.4056, giving 1920 × 1080 frames.
- **Phone pass:** 390 × 844 at pixel ratio 2, with touch emulation.
- **Pre-warm (not recorded):** visits every canvas first, so each scene is mounted and its readouts are filled in. Some plates grow when they mount (the Turing rule table); without this, a scroll measured earlier lands in the wrong place.
- **Injected for the recording only:**
  - a full-width caption bar at the bottom, so captions never cover content;
  - a fake cursor that follows the protocol's mouse events;
  - a scroll helper that centres a figure (and its controls) between the header and the caption bar.
- **Interactions:** real mouse clicks and drags on the canvases. It ticks the stereo pinhole, punches loom holes, drops chart beacons, tilts the gyro, tunes the radio, cranks the engine, patches the switchboard, turns the gears dial and types into the Enigma.
  - It never clicks the résumé download, the paper links or the Enigma "email" button.
- **Frame capture:** `Page.startScreencast` captures about 54 fps. Ack every frame, or Chrome stops sending.
- **Encoding:** ffmpeg turns the frames into H.264 at a constant 30 fps, CRF 28, limited-range BT.709 `yuv420p`, `+faststart`. The result is 149 s and 11 MB.
- **GIF:** `docs/preview.gif` is cut from three moments (hero, switchboard, gears) at 720 px, 12 fps, 64 colours, about 10 s and 1.5 MB.

**Options:**
- `STOP_AFTER=<scene>` records only up to that scene, for quick iteration.
- `DEBUG=1` logs where each scroll and click landed.

**Hosting (why the video lives in `site/`):**
- GitHub's file page won't preview a file this size.
- Its raw URL is served as `application/octet-stream`, so it downloads instead of playing.
- Its README renderer strips `<video>` tags. This was confirmed by rendering one through `gh api -X POST markdown`.
- So the video is served by GitHub Pages at `/walkthrough.mp4` as `video/mp4` with range requests, and the README shows the GIF linking to it. Git stores the file only once.

**Refreshing it after content changes:**
1. Re-run the recorder.
2. Copy `walkthrough.mp4` into `site/` and `preview.gif` into `docs/`.
3. Check frames before committing (section 10).

---

## 9. Deployment

- **Hosting:** GitHub Pages, deployed by `.github/workflows/hugo.yml` on every push to `main`. It uploads `./site` with `actions/upload-pages-artifact` and deploys it with `actions/deploy-pages`, in about 25 s.
- **Domain:** set in the repo's Pages settings, so there is no CNAME file. The custom domain is `www.ruchita.uk`, HTTPS is enforced, and the bare domain 301-redirects to `www`.
- **Flow used for every change:**
  1. Commit on `catalogue-of-machines` and push.
  2. Open a PR into `main` and merge it (a merge commit, as for #1–#7).
  3. Wait for the run: `gh run watch <id> --exit-status`.
  4. Verify the live site (section 10).
- **Netlify:** `netlify.toml` (`publish = "site"`) is left over from a Netlify connection. Its two deploy-preview checks fail on every PR. This predates the rewrite, they are not on the live path, and disconnecting them is done in Netlify's dashboard.
- **Old Hugo site:** on `archive/hugo-site`, at commit `3fae618`. Before it was removed from `main`, every removed path was checked to be byte-identical to that commit.

---

## 10. Verification toolkit

- **Syntax:**
  ```bash
  for f in site/js/*.js site/js/*/*.js tools/*.mjs; do node --check "$f" || echo "FAIL $f"; done
  ```
- **Local preview with no caching:** see Appendix B, or run `python3 -m http.server 8137` from the repo root and open `http://localhost:8137/site/`. In an embedded browser, force-refresh edited files with `fetch(url, {cache: 'reload'})` before reloading.
- **The live site matches the commit:**
  ```bash
  for f in $(git ls-files site); do rel=${f#site/}
    a=$(curl -sS "https://www.ruchita.uk/$rel?cb=$RANDOM" | shasum -a 256 | cut -d' ' -f1)
    b=$(git show origin/main:"$f" | shasum -a 256 | cut -d' ' -f1)
    [ "$a" = "$b" ] || echo "MISMATCH $rel"; done
  ```
  The `?cb=` query defeats the CDN's 10-minute cache.
- **Every scene draws:** in the browser console, scroll each `canvas[data-scene]` into view, wait about a second, and count non-transparent pixels with `getImageData`. Also check that `document.querySelectorAll('.fig.failed').length` is 0 and that the console has no errors.
- **Overflow and touch audit:** Appendix A, at each width in section 5.
- **Video and GIF:** before committing,
  - check duration, size and pixel format with `ffprobe`;
  - extract a frame from every scene with `ffmpeg -ss <t> -i walkthrough.mp4 -frames:v 1` and lay them out as contact sheets with Pillow;
  - look for half-mounted canvases, missed clicks, legible captions and a sensible cursor position.

---

## 11. Gotchas worth knowing

- **DevTools mouse events:** a `mouseReleased` must name `button: 'left'` even though no button is held afterwards. Otherwise nothing registers as a click, and drags never end.
- **Screencast timestamps:** the first screencast frames can arrive with out-of-order timestamps; sort before encoding.
- **ffmpeg concat:** the concat demuxer ignores the last entry's duration unless the last `file` line is repeated.
- **Colour range:** frames captured as JPEG encode as full-range `yuvj420p`, which some players (Safari, QuickTime) show washed out. Convert with `scale=…:in_range=pc:out_range=tv:out_color_matrix=bt709` and tag the stream as BT.709 limited range.
- **Headless Chrome:**
  - use `--headless=new` and disable timer throttling and renderer backgrounding;
  - emulate `prefers-reduced-motion: no-preference`;
  - wait for `document.fonts.ready` before capturing.
- **zsh:**
  - unquoted `$VAR` is not word-split, so pass lists as arrays or inline;
  - `$n:l` is parsed as a lowercase modifier, so write `${n}`;
  - an unmatched glob is an error.
- **Python on macOS:** the python.org build's `urllib` failed TLS verification here, so use `curl` for HTTP lookups.
- **Embedded browser panes:**
  - they may only run `requestAnimationFrame` while visible, so take a throwaway screenshot first to wake them before timing anything;
  - they cache aggressively, so serve with `no-store`.
- **GitHub-hosted media:** see section 8 (no README `<video>`, raw URLs download, large files don't preview).
- **Previews need deploying first:** link previews read the deployed page; local changes are invisible to LinkedIn.

---

## 12. Owner's decisions and preferences

- **Look:** black, greys, white and a rare red; nothing that copies sarangvehale.github.io (no Bloch sphere); no staring eye.
- **Content:** projects first, machines second; illustrations stay illustrative (no real footage or plots wanted).
- **Kept on purpose:** the gears calendar's red pointer and active ring; the red switchboard cords.
- **Left out:** no phone number on the page; no analytics.
- **Résumé PDF:** left as it is for the owner to update. It still disagrees with the site on the DeGould end date, the publication details and the phone number.
- **Workflow:** only change `site/` when asked, and ask before publishing anything beyond what was requested.

## 13. Open items

- **Résumé PDF:** the owner will update it.
- **Google Search Console:** DNS TXT verification, then submit the sitemap.
- **Netlify:** disconnect the two failing projects (dashboard).
- **Real-device pass:** iPhone Safari and Android Chrome.
- **Claims to re-confirm:** a few on the site come from the old site rather than the résumé: the 10 Hz landing loop, 98.87% mAP at 1,500 epochs, the Cube Orange / ArduCopter setup, the four detection modes and the upward-facing camera.

---

## 14. Recipe: building a similar site

1. **Gather sources first.** Get the résumé, the papers (check each DOI on Crossref), links and photos. List every number you plan to show and where it comes from.
2. **Pick a concept that leads with the person's work.** Here: each project beside the historic machine it descends from. Keep the visual concept as the frame, not the subject.
3. **Set the system.** Two typefaces, a near-monochrome palette with one rare accent, line-art drawing helpers, and a single animation loop that draws only what is visible and respects reduced motion.
4. **Build the page as real HTML first.** Every description, metric and link must be readable without JS. Canvases are enhancement, marked `aria-hidden`.
5. **One module per scene,** using the contract in section 2. Each scene needs a narrow-width branch, an `api` for HTML controls, and "illustrative" labels.
6. **Make it responsive from the start.**
   - Use `minmax(0, 1fr)` for single-column grids.
   - Set inputs to 16 px on phones.
   - Give touch screens 44 px targets in a `pointer: coarse` block.
   - Give every keyboard shortcut a touch equivalent.
   - Audit at 320, 375, 768 and 1024 px.
7. **Add sharing and search basics before launch:** `og:image` (1200 × 630), canonical link, Twitter card, Person JSON-LD, `robots.txt`, sitemap.
8. **Deploy `site/` with the Pages workflow and a custom domain;** set the repo's website field. Change things through PRs into `main`.
9. **Verify live:** checksum every file, fetch as LinkedInBot, check every scene draws with no console errors, check on real phones.
10. **Optionally:** record a walkthrough (section 8) and add cookieless analytics (section 7) if the owner wants them.

---

## Appendix A: small-screen audit

Paste into the browser console on the page, or serve it locally and `eval` it. Then call `__audit()`.

```js
window.__audit = (opts = {}) => {
  const W = document.documentElement.clientWidth, R = {};   // true layout width (innerWidth lies when content overflows)
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  R.size = `layout ${W}px, scrollWidth ${document.documentElement.scrollWidth}px  => overflow ${document.documentElement.scrollWidth - W}px`;
  const over = new Map();
  document.querySelectorAll('body *').forEach((e) => {
    if (e.closest('#tape, .indexov, .panel')) return;
    const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (r.right > W + 1.5 || r.left < -1.5) over.set(name(e), `${Math.round(r.left)}→${Math.round(r.right)}`);
  });
  R.overflow = [...over].slice(0, 14).map(([k, v]) => `${k} ${v}`);
  const taps = new Map();
  document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, .sw, label.chk, li[data-n]').forEach((e) => {
    if (e.closest('.panel') || (!opts.overlay && e.closest('.indexov'))) return;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return;
    const m = Math.min(r.width, r.height); if (m < (opts.min || 40)) { const k = name(e); const o = taps.get(k) || { n: 0, w: 0, h: 0 }; o.n++; o.w = Math.round(r.width); o.h = Math.round(r.height); taps.set(k, o); }
  });
  R.smallTaps = [...taps].map(([k, o]) => `${k} x${o.n} (${o.w}x${o.h})`);
  const tiny = new Map();
  document.querySelectorAll('body *').forEach((e) => {
    if (e.closest('.indexov, .panel, #tape')) return;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const cs = getComputedStyle(e); if (cs.display === 'none') return; const fs = parseFloat(cs.fontSize);
    if (fs < (opts.minFont || 11)) tiny.set(name(e), fs);
  });
  R.tinyText = [...tiny].slice(0, 16).map(([k, v]) => `${k} ${v}px`);
  R.zoomInputs = [...document.querySelectorAll('input[type=text], input:not([type]), textarea, select')].map((e) => `${name(e)} ${getComputedStyle(e).fontSize}`);
  R.canvases = [...document.querySelectorAll('canvas[data-scene]')].map((c) => `${c.dataset.scene}:${Math.round(c.clientWidth)}x${Math.round(c.clientHeight)}`).join(' ');
  return JSON.stringify(R, null, 1);
};
```

## Appendix B: no-cache local server

Saved locally as `.claude/serve.py`, which is git-ignored. Run `python3 serve.py 8137` from the repo root, then open
`http://localhost:8137/site/`.

```python
"""Local static server for the portfolio preview. Sends no-store so edits always show on refresh."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
```
