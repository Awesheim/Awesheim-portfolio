# Portfolio directions

Three whole-page directions for the portfolio, aimed at illustration work
for metal bands. Source for the design canvas published from this branch.

| File | Direction | Idea |
|---|---|---|
| `Main.dc.html` | A — Black Ledger | One large plate, then the work as a ruled index: year, client, scope, medium. Nearest to the restraint of the live site. |
| `Gatefold.dc.html` | B — Gatefold Wall | Twelve plates edge to edge, condensed display type, one oxblood accent. Third tile is drawn in its hover state. |
| `Plate.dc.html` | C — Plate | One piece per screen with a spec table, process crops and registration marks. |

`canvas.json` places the three artboards on the canvas and carries the
note above each one.

All three reuse the real wordmark from `images/awesheim-logo.svg` and the
dark ground from `css/style.css`. The artwork is drawn placeholder
geometry, and every client, album and label name is bracketed.

## Rebuilding the canvas

The published `.html` is generated and deliberately untracked:

```
node "<design skill>/seed-canvas.mjs" \
  --template "<design skill>/payload.template.html" \
  --out awesheim-portfolio-directions.html \
  --title "Awesheim Portfolio Directions" \
  --artboard Main.dc.html --artboard Gatefold.dc.html --artboard Plate.dc.html \
  --canvas canvas.json
```
