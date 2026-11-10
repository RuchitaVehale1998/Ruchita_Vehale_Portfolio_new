# Ruchita Vehale — Catalogue of Machines

A hand-built static site: plain HTML, CSS and ES modules. **No framework, no build step, no runtime network
dependencies except Google Fonts.** Everything is in [`site/`](site/).

Concept: every field she works in is paired with the older machine it descends from — twelve working models
(Turing machine, camera obscura, Jacquard loom, sea chart, gyroscope, spark-gap telegraph, difference engine,
core memory, switchboard, Antikythera dial, Hollerith card, Enigma) plus a card catalogue of the papers.
Palette: black, greys, white, and one red.

```
site/
  index.html          the whole catalogue — every description of her work is plain HTML (survives without JS)
  css/styles.css      design system
  js/main.js          lazy-mounts each plate, wires the HTML controls to the plate APIs
  js/core.js          scene runner (one rAF loop, visible-only), line-art helpers
  js/tape.js          fixed ITA2 paper tape, fed by scroll
  js/flap.js          split-flap metrics board
  js/panel.js         Altair-style front panel + index overlay
  js/lib/*.js         pure machine logic (Enigma, Turing, codes, eye) — no DOM
  js/plates/*.js      one canvas per plate (hero + twelve machines)
  files/              résumé PDF
```

## Run locally

```bash
python3 -m http.server 8137   # from the repo root
# open http://localhost:8137/site/
```

Flags: `?debug` shows an fps counter · `?motion=0` pauses animation (same as `prefers-reduced-motion`); plates redraw when you interact with them.

## Edit

* **Text, numbers, descendants** — edit `site/index.html` (each plate has a `.desc` block).
* **Skill graph / timeline data** — `site/js/plates/switch.js` (projects and skills) and `site/js/plates/gears.js` (roles).
* **Résumé** — overwrite `site/files/Ruchita_Vehale_Resume.pdf`.
* **Paper links** — add an `<a href>` (DOI) to each card in `#drawer`.

## Verified machine logic

`js/lib` is plain, testable code. Known answers it satisfies: Enigma I (rotors I-II-III, reflector B, rings AAA,
start AAA) enciphers `AAAAA` as `BDZGO` and double-steps correctly; the 3-state busy beaver halts with six 1s in
14 steps; Hollerith zones follow 12 + 1–9 (A–I), 11 + 1–9 (J–R), 0 + 2–9 (S–Z); the difference engine's added
columns equal direct polynomial evaluation.

## Deploy

`.github/workflows/hugo.yml` uploads `./site` to GitHub Pages on every push to `main`
(Settings → Pages → Source → GitHub Actions). `netlify.toml` publishes `site` with no build command.
All paths are relative, so it also works under a `/<repo>/` subpath.

The earlier Hugo version (`content/`, `themes/`, `hugo.yaml`, `public/`, `archetypes/`) is still in the repo, unused.
