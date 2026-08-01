# Awesheim — Illustration and design.

Portfolio site. Images and short labels only, with the work scrolling
behind a large fixed wordmark and blurring out at the bottom of the page.

No build step, no dependencies. Open `index.html`, or serve the folder:

```
npx http-server -p 8099
```

## Source files in this repo

- `index-old.html` — the original Claude Design export. It is a
  self-unpacking bundle (React + a base64 payload), kept as reference.
  The palette, logo placement, duotone treatment, progressive blur,
  vertical labels and bottom nav in this build all come from it.
- `awesheim_logo_2013_hvit.ai` — the wordmark, kept as the vector
  source. `images/awesheim-logo.svg` is extracted from it: eight paths,
  ~1.3 KB, inlined into `index.html` so it can be recoloured with CSS
  (`.masthead { color: … }`).

## How the scroll works

The original scattered a handful of absolutely positioned images at
random speeds. That moves nicely, but it leaves wide screens mostly
empty — and a single tall column has the same problem.

This does it differently:

1. The figures in `index.html` are dealt round-robin into 1–3 columns
   (`columnsFor()` in `js/main.js`), so the 1500px track fills edge to
   edge at any width.
2. The grid is `position: fixed`; an invisible `.scroll-spacer` gives
   the page its scrollbar. Scrolling stays completely native — wheel,
   trackpad, touch, keyboard, scrollbar drag and browser find all
   behave normally. Nothing is hijacked.
3. **Each column travels exactly the distance its own content needs** to
   pass through the viewport. A short column moves slower than a tall
   one, and every column reaches the bottom at the same moment — so the
   speeds differ but no column runs out early and leaves a hole.
4. On top of that, each column eases toward its target with its own lerp
   factor, so they drift and settle at slightly different rates. That is
   what makes it feel fluid rather than locked to the scrollbar.

Because travel is derived from measured column height, this holds for
any number of images, any mix of portrait and landscape, and any column
count — nothing is hand-tuned per image.

Easing is frame-rate independent, so 60Hz and 120Hz feel the same.

## Treatment

- **Duotone.** Each piece renders through the `#duotone` SVG filter in
  `index.html`, which flattens luminance onto the ramp from
  `rgb(20,20,20)` to `rgb(102,102,102)` — the same ramp the original
  computed on a canvas. Doing it as a filter avoids re-decoding every
  image into a canvas, and works on whatever you drop in.
- **Colour on the rise.** A second copy of each image sits on top and
  fades in as the piece climbs the viewport, reaching 40% once it
  reaches the top. Work is monochrome at the bottom of the page and
  gains colour as it comes up.
- **Progressive blur.** Six stacked `backdrop-filter` layers
  (1–16px) masked from the bottom edge, plus a 30vh scrim.
- **The wordmark descends.** At the top of the page it sits with its
  centre 8% above the vertical middle; as you scroll it moves down,
  reaching its docked position after one viewport height of scrolling
  and staying there. It is tied straight to the scroll offset rather
  than eased, so it tracks the scrollbar exactly. The docked position
  is measured from the DOM, so the mobile breakpoint's different
  `bottom` value is picked up automatically.

The original also drifted the page on its own at 0.15px/frame, resuming
1.5s after each interaction. That is deliberately not carried over — it
fought touch scrolling on mobile. Nothing moves unless the visitor
scrolls it.

## Adding your work

The five images the original referenced (`assets/work-1…5`) were not in
the repo, so `images/work-01…12.svg` are placeholders. Replace them.

Drop files in `images/` and add a `<figure>` to `index.html`:

```html
<figure>
  <div class="frame">
    <img class="duo" src="images/my-piece.jpg" width="1200" height="1600" alt="Describe the piece">
    <img class="tint" src="images/my-piece.jpg" width="1200" height="1600" alt="" aria-hidden="true">
  </div>
  <span class="label">Piece Title <span class="sep">–</span> 2026</span>
</figure>
```

Both `<img>` tags point at the same file — the browser fetches it once.
Set `width` and `height` to the real pixel dimensions: they reserve the
right space before the image loads, which keeps the column measurements
correct. Without them the layout shifts as images arrive.

Order in the HTML is the order pieces are dealt into columns.

## Tuning

In `js/main.js`:

- `STAGGER` — how far each column's top is offset, as a fraction of
  viewport height. A wider spread reads more ragged and editorial.
- `EASE` — per-column smoothing. Lower is looser and more floaty. Keep
  the values different from each other; that difference *is* the effect.
- `TINT_MAX` — how much colour the work regains at the top (0–1).
- `LOGO_RISE` — how far above the vertical centre the wordmark sits at
  the top of the page, as a fraction of viewport height (0.08 = 8%).
- `LOGO_TRAVEL` — how many viewport heights of scrolling it takes for
  the wordmark to reach its docked position.
- `columnsFor()` — the column-count breakpoints.

In `css/style.css`:

- `.veil i` — the blur stack. `--b` is the blur radius, `--solid` and
  `--fade` are the mask stops measured up from the bottom edge.
- `.masthead` — logo size and position.

## Fallbacks

- **No JavaScript** — the grid renders as ordinary CSS multi-columns and
  the page scrolls normally.
- **`prefers-reduced-motion`** — the fluid scroll is switched off and
  the work is shown in colour.
