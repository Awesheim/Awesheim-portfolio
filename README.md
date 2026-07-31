# Awesheim — Design & Illustration

Portfolio site. Images and short labels only; a big fixed wordmark with the
work scrolling behind it and blurring out at the bottom of the page.

No build step, no dependencies. Open `index.html`, or serve the folder:

```
npx http-server -p 8099
```

## How the scroll works

The problem with a plain fixed/parallax scroll is that every image moves at
the same rate, and the usual fix — one tall column of images — leaves big
empty margins on wide screens.

This does it differently:

1. The figures in `index.html` are distributed round-robin into 2–4 columns
   (`columnsFor()` in `js/main.js`), so wide screens stay filled.
2. The grid is `position: fixed`; an invisible `.scroll-spacer` gives the page
   its scrollbar. Scrolling stays completely native — wheel, trackpad, touch,
   keyboard, scrollbar drag, and browser find all behave normally. Nothing is
   hijacked.
3. **Each column travels exactly the distance its own content needs** to pass
   through the viewport. A short column moves slower than a tall one, and
   every column reaches the bottom at the same moment — so the speeds differ
   but no column runs out early and leaves a hole.
4. On top of that, each column eases toward its target with its own lerp
   factor, so they drift and settle at slightly different rates. That is what
   makes it feel fluid rather than locked to the scrollbar.

Because the travel distance is derived from measured column height, this holds
for any number of images, any mix of portrait and landscape, and any column
count — nothing is hand-tuned per image.

The easing is frame-rate independent, so it feels the same on a 60Hz and a
120Hz display.

## Adding your work

Drop files in `images/` and add a `<figure>` to `index.html`:

```html
<figure>
  <img src="images/my-piece.jpg" width="1200" height="1600" alt="Describe the piece">
  <figcaption><span>13</span>Piece Title</figcaption>
</figure>
```

Set `width` and `height` to the real pixel dimensions. They reserve the right
space before the image loads, which keeps the column measurements correct —
without them the layout will shift as images arrive.

Order in the HTML is the order they are dealt into columns, left to right.

The twelve files currently in `images/` are placeholder SVGs. Replace them.

## Tuning

In `js/main.js`:

- `STAGGER` — how far each column's top is offset, as a fraction of viewport
  height. Bigger spread = more ragged, more editorial.
- `EASE` — per-column smoothing. Lower is looser and more floaty, higher is
  tighter. Keep the values different from each other; that difference is the
  effect.
- `columnsFor()` — the column-count breakpoints.

In `css/style.css`:

- `.blur-veil` — the progressive blur at the bottom, three stacked
  `backdrop-filter` layers with soft masks. Change `height` for how far up it
  reaches, and the `blur()` values for strength.
- `.grid` `padding-top` — how much clear space the wordmark gets before the
  work arrives.

## The wordmark

`.masthead` uses `mix-blend-mode: difference`, so the logo stays legible over
anything that passes behind it — dark or light. The trade-off is that it
inverts hue over saturated artwork. For a plain ink wordmark instead, drop
`mix-blend-mode` and set `color: var(--ink)` on `.masthead` and
`.contact-link` — legible over pale work, but it will disappear into dark
images.

## Fallbacks

- **No JavaScript** — the grid renders as ordinary CSS multi-columns and the
  page scrolls normally.
- **`prefers-reduced-motion`** — the fluid scroll is switched off and the same
  static multi-column layout is used.
