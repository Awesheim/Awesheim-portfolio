# Line Length Counter

A small Figma plugin that shows the longest line of text (by character count) in the current
selection, live as you click around.

## What it does

Select a text layer, or a frame containing one or more text layers, and the plugin panel shows:

- The character count of the longest line (split on hard line breaks — see limitation below).
- Which text layer that line came from.
- A preview of the line itself.
- If the selection contains multiple text layers, a per-layer breakdown sorted longest-first.

It updates automatically as your selection changes — no re-running needed.

## Installing in Figma

**Menu → Plugins → Development → Import plugin from manifest…** → pick `manifest.json` in this
folder.

## Limitation: hard line breaks only

Figma's plugin API exposes a text layer's raw characters, including explicit line breaks (`\n`),
but it does not expose where a line visually wraps due to auto-width/fixed-width containers —
that's a rendering detail the API doesn't surface. "Longest line" here means the longest line
between actual line breaks in the text content, not the longest visually-wrapped line.
