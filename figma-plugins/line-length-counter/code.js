// Line Length Counter — main thread.
// Reports the longest line (by hard line break, \n) across the text
// layer(s) in the current selection, live as the selection changes.

figma.showUI(__html__, { width: 300, height: 220, themeColors: true });

function collectTextNodes(node, out) {
  if (node.type === 'TEXT') {
    out.push(node);
    return;
  }
  var children = node.children || [];
  for (var i = 0; i < children.length; i++) {
    collectTextNodes(children[i], out);
  }
}

// Count by Unicode codepoint (not UTF-16 code unit) so emoji/astral
// characters count as one character each, matching what a person sees.
function charLength(str) {
  return Array.from(str).length;
}

function analyze() {
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

  var best = null; // { length, line, nodeName }
  var perNode = [];

  textNodes.forEach(function (tn) {
    var lines = tn.characters.split('\n');
    var maxLen = 0;
    var maxLine = '';
    lines.forEach(function (line) {
      var len = charLength(line);
      if (len > maxLen) {
        maxLen = len;
        maxLine = line;
      }
    });
    perNode.push({ name: tn.name, maxLen: maxLen, lineCount: lines.length });
    if (!best || maxLen > best.length) {
      best = { length: maxLen, line: maxLine, nodeName: tn.name };
    }
  });

  perNode.sort(function (a, b) { return b.maxLen - a.maxLen; });

  figma.ui.postMessage({
    type: 'result',
    state: 'ok',
    textNodeCount: textNodes.length,
    best: best,
    perNode: perNode
  });
}

figma.on('selectionchange', analyze);
analyze();
