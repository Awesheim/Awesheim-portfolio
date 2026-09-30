# Line Length Counter

A Figma plugin that shows the character count of the longest **wrapped** line of text in the
current selection — live, as you drag a frame's width or click between layers.

## What it does

Select a text layer, or a frame containing one or more text layers, and the plugin panel shows:

- The character count of the longest visually-wrapped line, and a preview of it.
- Which text layer it came from.
- Per text layer: its current width in px, font/size, line count, and a full line-by-line
  breakdown with each line's character count (widest line highlighted).

It updates live as you resize the frame or text box, or change the selection — no re-running
needed.

## Minimize

Click the **–** button (top-right of the panel) to shrink it to a 24px-tall bar showing just
`<selected layer name>: N characters`, with a button to expand back to the full view. Analysis
keeps running while minimized, so the count stays live if you keep resizing.

## How wrap-aware measurement works

Figma's plugin API doesn't expose where a line visually wraps — that's purely a rendering detail.
So this plugin reproduces Figma's own wrapping using Figma's own text engine as the ruler: it
creates a hidden, locked scratch text node (named with a ⚠️ prefix so it's obviously not part of
your design — the plugin removes it on close, but if a run ever crashes before that, it's safe to
delete by hand), sets it to the same font, size, letter-spacing and case as your text, feeds it
candidate substrings, and reads back the pixel width Figma itself renders. That reproduces the
exact wrap points — kerning, shaping, everything — rather than approximating with a browser font.

Word-wrap logic: text is split into paragraphs on hard line breaks (`\n`), then each paragraph is
greedily packed word-by-word against the text layer's own width, breaking just before whatever
word would first overflow — the same logic browsers and Figma use.

## Installing in Figma

**Menu → Plugins → Development → Import plugin from manifest…** → pick `manifest.json` in this
folder.

## Known limitations

- **Uniform styling only.** If a text layer has more than one font/size/style mixed within it,
  wrap-aware measurement is skipped for that layer (the panel says so) — reproducing per-run
  mixed-style wrapping accurately is a lot more work than this needed to be.
- **Auto-width text never wraps.** If a text layer's resizing is set to "Auto width," Figma
  itself never wraps it regardless of frame size — the plugin reflects that (shows raw line
  breaks) rather than pretending otherwise. Set the layer to "Auto height" or a fixed size to
  get wrapping.
- **Paragraph indent isn't modeled.** If a text layer has paragraph indentation set, the first
  line's true available width is slightly narrower than what's used here — a minor edge case.
