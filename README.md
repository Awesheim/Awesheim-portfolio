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
- **Progressive blur.** Three stacked `backdrop-filter` layers (3–20px)
  plus a 30vh scrim. Each layer is clipped to the band it actually
  affects — see *Performance* below.
- **The wordmark descends and shrinks.** At the top of the page it sits
  full size with its centre 8% above the vertical middle; as you scroll
  it moves down and scales to 40%, reaching its docked position after
  one viewport height of scrolling and staying there. It scales about
  its bottom edge, so it stays on the docked line instead of drifting
  up off it. It is tied straight to the scroll offset rather
  than eased, so it tracks the scrollbar exactly. The docked position
  is measured from the DOM, so the mobile breakpoint's different
  `bottom` value is picked up automatically.

The original also drifted the page on its own at 0.15px/frame, resuming
1.5s after each interaction. That is deliberately not carried over — it
fought touch scrolling on mobile. Nothing moves unless the visitor
scrolls it.

## Performance

The scroll was janky, and an A/B of each effect found a single cause:
the progressive blur. Every layer was `inset: 0`, so the browser blurred
the **whole viewport** once per layer per frame, even though a mask hid
all but a band at the bottom.

Measured over a 4s continuous scroll, frames actually composited:

| | before | after |
|---|---|---|
| desktop 1680×1000 | 1.3 fps | 12.3 fps |
| mobile 390×780 | 14 fps | 60 fps |

Mobile now matches a build with the blur removed entirely — it is free.
Nothing else measured as significant: the duotone filter, the colour
tint layer, the scrim and `will-change` were all within noise.

Two things fixed it, and layer *count* mattered more than blur radius:

1. Each `.veil i` is clipped to its own band (`height: var(--h)`,
   anchored to the bottom) instead of covering the viewport.
2. Six layers down to three.

### Why layering at all

CSS has no primitive for a blur whose radius varies across the element,
so a progressive blur has to be built from layers. With a single layer
you get the artifact this design was working around: a visible line
where sharp content cross-fades into blurred content, reading as a
ghosted double image rather than a gradual blur.

What removes that artifact is **overlap, not layer count**. Each layer
stays fully opaque for only the lower part of its band and fades out
across the rest, so the next radius has faded in before the previous one
ends and no single boundary carries a visible jump. Measured desktop fps
against how it looks:

| layers | fps | look |
|---|---|---|
| 1 | 24.7 | visible sharp-to-blurred edge |
| 2 | 18.4 | slight step at the boundary |
| **3** | **15.7** | **no visible artifact** |
| 4 | 12.5 | no visible artifact |
| 5 | 11.1 | no visible artifact |

Three with generous overlap looks the same as six and costs half. On
mobile every configuration now runs at 60fps, so layer count is purely a
desktop concern. Promoting the layers with `translateZ(0)` was also
tested and made no difference.

## Adding your work

The five images the original referenced (`assets/work-1…5`) were not in
the repo, so `images/work-01…12.svg` are placeholders. Replace them.

**Use `admin.html`** — see *The CMS* below. It edits titles, years, alt
text, ordering and images, and exports the files to commit.

Content lives in `content.json`, which `index.html` reads at runtime.
The same content is also written into `index.html` as plain `<figure>`
markup between the `work:start` / `work:end` comments, so the page still
works with JavaScript off and search engines see it without running
scripts. Both come out of the CMS together, which is why they cannot
drift apart. Do not hand-edit that block.

Each piece uses the same file twice — once for the duotone layer, once
for the colour layer — and the browser fetches it once. `width` and
`height` are the real pixel dimensions; they reserve the right space
before the image loads, which keeps the column measurements correct.

## The CMS

`admin.html` edits the work list: title, year, alt text, image, and
order. Drafts are kept in this browser's localStorage as you type.

Because the site is static and has no server, the page cannot write
files. When you are done it gives you two downloads to commit:

- `content.json` — what the site reads.
- `index.html` — the same content written into the markup for the
  no-JS fallback.

Picking an image records its filename and reads its real dimensions,
and previews it immediately — but **the file itself still has to be
copied into `images/` and committed**. Pieces whose image is missing
are flagged in red.

Serve the folder over http (`npx http-server`) rather than opening
`admin.html` off the filesystem, or the browser will refuse to read
`content.json`.

### Adding a password

There is a gate stub at the top of `js/admin.js`. Set `ENABLED: true`
and put the hex SHA-256 of your passphrase in `PASS_SHA256`:

```
echo -n 'your passphrase' | shasum -a 256
```

Be clear about what that buys you: it hides the form and nothing else.
`admin.html`, `js/admin.js` and `content.json` are still served to
anyone who requests them, and the hash sits in the source to be attacked
offline. It is a speed bump on a public URL, not access control.

For real protection, put HTTP auth in front of `admin.html` at the host
— Netlify and Vercel both have password protection, or an `.htaccess`
rule on classic hosting. Nothing on the published site links to
`admin.html`, and it carries `noindex, nofollow`.

## Tuning

In `js/main.js`:

- `STAGGER` — how far each column's top is offset, as a fraction of
  viewport height. A wider spread reads more ragged and editorial.
- `EASE` — per-column smoothing. Lower is looser and more floaty. Keep
  the values different from each other; that difference *is* the effect.
- `TINT_MAX` — how much colour the work regains at the top (0–1).
- `LOGO_SCALE_END` — the size the wordmark shrinks to once docked.

In `css/style.css`:

- `--logo-dock` — how far above the bottom edge the wordmark parks.
- `LOGO_RISE` — how far above the vertical centre the wordmark sits at
  the top of the page, as a fraction of viewport height (0.08 = 8%).
- `LOGO_TRAVEL` — how many viewport heights of scrolling it takes for
  the wordmark to reach its docked position.
- `columnsFor()` — the column-count breakpoints.

In `css/style.css`:

- `.veil i` — the blur stack. `--b` is the blur radius, `--solid` and
  `--fade` are the mask stops measured up from the bottom edge.
- `.masthead` — logo size and position.

## Pages

- `index.html` — the work, with the about text as a final section.
- `admin.html` — the CMS, not linked from the site.

The about text is a panel parked one screen below the fold; it slides up
as the work runs out past the end of its travel, and sits above the blur
so the type stays crisp. The nav's About button scrolls to it. Without
JavaScript it is simply the last section of the page and the button is
an ordinary anchor jump.

## Fallbacks

- **No JavaScript** — the grid renders as ordinary CSS multi-columns and
  the page scrolls normally.
- **`prefers-reduced-motion`** — the fluid scroll is switched off and
  the work is shown in colour.
