// Line Length Counter — main thread.
//
// Reports wrap-aware line lengths for the text layer(s) in the current
// selection, live as you resize the frame or change the selection.
//
// Figma's plugin API does not expose where a line visually wraps, so we
// reproduce it ourselves using Figma's own text engine as the ruler: a
// hidden scratch text node, set to the same font/size/letter-spacing/case,
// is fed candidate substrings and its auto-sized .width is read back. That
// gives pixel-exact wrap points (kerning, shaping, everything) instead of
// an approximation from a browser font.

figma.showUI(__html__, { width: 340, height: 420, themeColors: true });

var SCRATCH_NAME = '⚠️ Line Length Counter scratch node (safe to delete)';
var scratchNode = null;
var loadedFontKeys = {};

function collectTextNodes(node, out) {
  if (node.type === 'TEXT') {
    out.push(node);
    return;
  }
  var children = node.children || [];
  for (var i = 0; i < children.length; i++) collectTextNodes(children[i], out);
}

// Count by Unicode codepoint (not UTF-16 code unit) so emoji/astral
// characters count as one character each, matching what a person sees.
function charLength(str) {
  return Array.from(str).length;
}

function fontKey(fontName) {
  return fontName.family + '::' + fontName.style;
}

async function loadFontFor(fontName) {
  var key = fontKey(fontName);
  if (!loadedFontKeys[key]) {
    await figma.loadFontAsync(fontName);
    loadedFontKeys[key] = true;
  }
}

async function ensureScratchNode() {
  if (scratchNode && !scratchNode.removed) return scratchNode;
  // Clean up any leftover scratch node from a previous run that crashed
  // before cleanup (e.g. Figma closed mid-session).
  figma.currentPage.findAll(function (n) {
    return n.type === 'TEXT' && n.name === SCRATCH_NAME;
  }).forEach(function (n) { n.remove(); });

  scratchNode = figma.createText();
  scratchNode.name = SCRATCH_NAME;
  scratchNode.visible = false;
  scratchNode.locked = true;
  scratchNode.textAutoResize = 'WIDTH_AND_HEIGHT';
  figma.currentPage.appendChild(scratchNode);
  return scratchNode;
}

// Renders `text` with `style` on the scratch node and returns its pixel width.
async function measureWidth(text, style) {
  if (!text.length) return 0;
  var node = await ensureScratchNode();
  await loadFontFor(style.fontName);
  if (fontKey(node.fontName) !== fontKey(style.fontName)) node.fontName = style.fontName;
  if (node.fontSize !== style.fontSize) node.fontSize = style.fontSize;
  node.letterSpacing = style.letterSpacing;
  node.textCase = style.textCase;
  node.characters = text;
  return node.width;
}

// Greedy word-wrap: walk word-by-word (each word carrying its trailing
// whitespace) and break just before whatever would first overflow maxWidth,
// matching how flow layout engines (and Figma) decide wrap points.
async function wrapParagraph(paragraph, style, maxWidth) {
  if (!paragraph.length) return [''];

  var tokens = paragraph.split(/(\s+)/);
  var merged = [];
  for (var i = 0; i < tokens.length; i++) {
    if (i % 2 === 1) merged[merged.length - 1] += tokens[i];
    else merged.push(tokens[i]);
  }
  merged = merged.filter(function (t) { return t.length > 0; });
  if (!merged.length) return [''];

  var lines = [];
  var current = '';
  for (var j = 0; j < merged.length; j++) {
    var tok = merged[j];
    var candidate = current + tok;
    var w = await measureWidth(candidate, style);
    if (w <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = tok;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

async function analyzeTextNode(tn) {
  if (tn.fontName === figma.mixed || tn.fontSize === figma.mixed) {
    return { name: tn.name, mixed: true };
  }

  var style = {
    fontName: tn.fontName,
    fontSize: tn.fontSize,
    letterSpacing: tn.letterSpacing,
    textCase: tn.textCase
  };
  var wrapEnabled = tn.textAutoResize !== 'WIDTH_AND_HEIGHT';
  var paragraphs = tn.characters.split('\n');
  var rawLines = [];

  if (wrapEnabled) {
    for (var p = 0; p < paragraphs.length; p++) {
      var wrapped = await wrapParagraph(paragraphs[p], style, tn.width);
      rawLines = rawLines.concat(wrapped);
    }
  } else {
    rawLines = paragraphs;
  }

  var lines = rawLines.map(function (line) {
    var trimmed = line.replace(/\s+$/, '');
    return { text: trimmed, length: charLength(trimmed) };
  });
  var maxLine = lines.reduce(function (best, l) { return (!best || l.length > best.length) ? l : best; }, null);

  return {
    name: tn.name,
    mixed: false,
    wrapEnabled: wrapEnabled,
    widthPx: Math.round(tn.width),
    fontLabel: style.fontName.family + ' ' + style.fontName.style + ' / ' + Math.round(style.fontSize) + 'px',
    lineCount: lines.length,
    lines: lines,
    maxLine: maxLine
  };
}

async function analyze() {
  var sel = figma.currentPage.selection;

  if (sel.length === 0) {
    figma.ui.postMessage({ type: 'result', state: 'empty' });
    return;
  }

  var textNodes = [];
  for (var i = 0; i < sel.length; i++) collectTextNodes(sel[i], textNodes);

  if (!textNodes.length) {
    figma.ui.postMessage({ type: 'result', state: 'no-text' });
    return;
  }

  var results = [];
  for (var j = 0; j < textNodes.length; j++) {
    results.push(await analyzeTextNode(textNodes[j]));
  }

  var best = null;
  results.forEach(function (r) {
    if (r.mixed || !r.maxLine) return;
    if (!best || r.maxLine.length > best.length) {
      best = { length: r.maxLine.length, line: r.maxLine.text, nodeName: r.name };
    }
  });

  figma.ui.postMessage({
    type: 'result',
    state: 'ok',
    textNodeCount: textNodes.length,
    best: best,
    nodes: results
  });
}

// ---------------------------------------------------------------------------
// Live updates: re-run on selection change and on any document edit (e.g.
// dragging a frame's width handle), debounced so a drag doesn't spam
// measurements.
// ---------------------------------------------------------------------------

var analyzing = false;
var pendingRerun = false;

function requestAnalyze() {
  if (analyzing) { pendingRerun = true; return; }
  analyzing = true;
  figma.ui.postMessage({ type: 'analyzing' });
  analyze().catch(function (e) {
    figma.ui.postMessage({ type: 'error', message: String(e && e.message ? e.message : e) });
  }).then(function () {
    analyzing = false;
    if (pendingRerun) { pendingRerun = false; requestAnalyze(); }
  });
}

var debounceTimer = null;
function requestAnalyzeDebounced() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(requestAnalyze, 120);
}

figma.on('selectionchange', requestAnalyze);
figma.on('close', function () {
  if (scratchNode && !scratchNode.removed) scratchNode.remove();
});

// documentchange is document-wide, so in dynamic-page access mode Figma
// requires every page to be loaded first. selectionchange/close don't need
// this, so they're registered above without waiting on it.
figma.loadAllPagesAsync().then(function () {
  figma.on('documentchange', function (event) {
    // Our own measurement passes mutate the scratch node hundreds of times,
    // which themselves fire documentchange — filter those out, or every
    // analyze() would immediately queue another one, forever.
    var relevant = (event.documentChanges || []).some(function (change) {
      var id = change.id || (change.node && change.node.id);
      return !scratchNode || id !== scratchNode.id;
    });
    if (relevant && figma.currentPage.selection.length > 0) requestAnalyzeDebounced();
  });
});

requestAnalyze();
