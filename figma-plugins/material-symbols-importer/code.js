// Material Symbols Importer — main thread.
// Nothing in here is specific to any one file: targets (sections/frames) and
// color variables are discovered from whatever document the plugin runs in.

figma.showUI(__html__, { width: 500, height: 680, themeColors: true });

var GRID_COLS = 8;
var GRID_GAP = 16;
var GRID_PADDING = 24;

figma.ui.onmessage = function (msg) {
  if (msg.type === 'init') {
    sendInitData();
  } else if (msg.type === 'import') {
    handleImport(msg).catch(function (e) {
      figma.ui.postMessage({ type: 'import-done', created: 0, errors: [String(e && e.message ? e.message : e)] });
    });
  }
};

sendInitData();

// ---------------------------------------------------------------------------
// Init: discover import targets and color variables
// ---------------------------------------------------------------------------

async function sendInitData() {
  var targets = collectTargets();
  var variables = await collectColorVariables();
  figma.ui.postMessage({
    type: 'init-data',
    targets: targets,
    variables: variables,
    selectionTargetId: currentSelectionTargetId()
  });
}

// Sections at any depth, frames that sit directly on the page or in a section.
function collectTargets() {
  var out = [];
  function walk(node, path) {
    var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.type === 'SECTION') {
        out.push({ id: child.id, name: child.name, kind: 'Section', path: path.join(' / ') });
        walk(child, path.concat(child.name));
      } else if (child.type === 'FRAME') {
        out.push({ id: child.id, name: child.name, kind: 'Frame', path: path.join(' / ') });
      }
    }
  }
  walk(figma.currentPage, []);
  return out;
}

function currentSelectionTargetId() {
  var sel = figma.currentPage.selection;
  if (sel.length === 1 && (sel[0].type === 'SECTION' || sel[0].type === 'FRAME')) {
    return sel[0].id;
  }
  return null;
}

async function collectColorVariables() {
  var result = [];

  // Local variables
  var locals = await figma.variables.getLocalVariablesAsync('COLOR');
  for (var i = 0; i < locals.length; i++) {
    var v = locals[i];
    var hex = await previewHex(v);
    result.push({ source: 'local', id: v.id, name: v.name, group: 'Local variables', hex: hex });
  }

  // Variables from enabled team libraries (best effort — needs a paid plan / enabled libraries)
  try {
    var collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    for (var c = 0; c < collections.length; c++) {
      var col = collections[c];
      var vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
      for (var k = 0; k < vars.length; k++) {
        if (vars[k].resolvedType === 'COLOR') {
          result.push({ source: 'library', key: vars[k].key, name: vars[k].name, group: col.libraryName, hex: null });
        }
      }
    }
  } catch (e) {
    // Team library API unavailable — local variables are still offered.
  }

  // Rank so that names like "Icon/Primary" surface first; UI preselects index 0's group order.
  result.sort(function (a, b) {
    var d = suggestionScore(a.name) - suggestionScore(b.name);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
  return result;
}

function suggestionScore(name) {
  var icon = /icon/i.test(name);
  var primary = /primary|default|main/i.test(name);
  if (icon && primary) return 0;
  if (icon) return 1;
  if (primary) return 2;
  return 3;
}

// Resolve a variable's first-mode value to a hex string for the swatch preview.
async function previewHex(variable, depth) {
  depth = depth || 0;
  if (depth > 5) return null;
  var modeIds = Object.keys(variable.valuesByMode);
  if (!modeIds.length) return null;
  var value = variable.valuesByMode[modeIds[0]];
  if (value && value.type === 'VARIABLE_ALIAS') {
    var target = await figma.variables.getVariableByIdAsync(value.id);
    return target ? previewHex(target, depth + 1) : null;
  }
  if (value && typeof value.r === 'number') {
    return '#' + toHex(value.r) + toHex(value.g) + toHex(value.b);
  }
  return null;
}

function toHex(channel) {
  var s = Math.round(channel * 255).toString(16);
  return s.length === 1 ? '0' + s : s;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function handleImport(msg) {
  var icons = msg.icons; // [{ name, svg }]
  var options = msg.options; // { size, targetId, variable, namePrefix }
  var errors = [];

  var target = await figma.getNodeByIdAsync(options.targetId);
  if (!target || (target.type !== 'SECTION' && target.type !== 'FRAME')) {
    figma.ui.postMessage({ type: 'import-done', created: 0, errors: ['Target frame/section no longer exists. Refresh and pick again.'] });
    return;
  }

  var variable = null;
  if (options.variable) {
    try {
      if (options.variable.source === 'library') {
        variable = await figma.variables.importVariableByKeyAsync(options.variable.key);
      } else {
        variable = await figma.variables.getVariableByIdAsync(options.variable.id);
      }
    } catch (e) {
      errors.push('Could not load the selected color variable — icons keep their default fill.');
    }
  }

  var autoLayout = target.type === 'FRAME' && target.layoutMode && target.layoutMode !== 'NONE';
  var origin = autoLayout ? null : nextFreeSpot(target);

  var created = [];
  for (var i = 0; i < icons.length; i++) {
    var icon = icons[i];
    try {
      var frame = figma.createNodeFromSvg(icon.svg);
      frame.resize(options.size, options.size);
      applyPaint(frame, variable);

      var component = figma.createComponentFromNode(frame);
      component.name = (options.namePrefix || '') + icon.name;

      target.appendChild(component);
      if (!autoLayout) {
        var colIndex = created.length % GRID_COLS;
        var rowIndex = Math.floor(created.length / GRID_COLS);
        component.x = origin.x + colIndex * (options.size + GRID_GAP);
        component.y = origin.y + rowIndex * (options.size + GRID_GAP);
      }
      created.push(component);
    } catch (e) {
      errors.push(icon.name + ': ' + String(e && e.message ? e.message : e));
    }
  }

  if (created.length) {
    figma.currentPage.selection = created;
    figma.viewport.scrollAndZoomIntoView(created);
  }
  figma.notify(created.length + ' icon component' + (created.length === 1 ? '' : 's') + ' imported' +
    (errors.length ? ' (' + errors.length + ' failed)' : ''));
  figma.ui.postMessage({ type: 'import-done', created: created.length, errors: errors });
}

// Place new icons below whatever already lives in the target so nothing overlaps.
function nextFreeSpot(target) {
  var bottom = 0;
  var children = target.children || [];
  for (var i = 0; i < children.length; i++) {
    var c = children[i];
    var b = c.y + c.height;
    if (b > bottom) bottom = b;
  }
  return { x: GRID_PADDING, y: children.length ? bottom + GRID_GAP : GRID_PADDING };
}

// Recolor every filled/stroked shape in the SVG, binding the paint to the
// chosen variable when one is set.
function applyPaint(node, variable) {
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length) {
    node.fills = [makePaint(variable)];
  }
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length) {
    node.strokes = [makePaint(variable)];
  }
  var children = node.children || [];
  for (var i = 0; i < children.length; i++) {
    applyPaint(children[i], variable);
  }
}

function makePaint(variable) {
  var paint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
  if (variable) {
    paint = figma.variables.setBoundVariableForPaint(paint, 'color', variable);
  }
  return paint;
}
