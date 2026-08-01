/* ---------------------------------------------------------------
   Awesheim — fluid multi-column scroll

   The original design scattered a handful of absolutely positioned
   images at random speeds. That moves nicely but leaves wide screens
   mostly empty, so the layout here is columns instead:

   - The figures are dealt round-robin into N columns (2/3/4 by width).
   - The stage is fixed; an invisible spacer supplies the scrollbar,
     so scrolling stays completely native.
   - Each column travels exactly the distance its own content needs to
     pass through the viewport. Short columns therefore move slower
     than tall ones and every column lands at the bottom together —
     different speeds, but no column runs out early leaving a gap.
   - Each column then eases toward its target with its own lerp
     factor, which is what makes the motion feel fluid rather than
     locked to the scrollbar.

   On top of that, each piece fades from the duotone ramp into colour
   as it rises up the viewport.

   Scrolling is entirely the visitor's: nothing moves on its own.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var docEl = document.documentElement;
  var grid = document.getElementById("grid");
  var spacer = document.querySelector(".scroll-spacer");
  // Populated at boot, either from content.json or from the markup
  // already in index.html (which is the no-JS fallback).
  var figures = [];

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Per-column offsets (x viewport height) so tops start staggered,
  // and per-column easing so columns drift at slightly different rates.
  // EASE values are "per 60fps frame" and are converted to a
  // frame-rate independent factor below, so 120Hz matches 60Hz.
  var STAGGER = [0, 0.16, 0.06, 0.22];
  var EASE = [0.105, 0.16, 0.125, 0.185];

  // Colour mix the tint layer reaches once a piece is at the top,
  // matching the original design's 0.4 blend toward the full image.
  var TINT_MAX = 0.4;

  // At the top of the page the wordmark sits with its centre this far
  // above the middle of the viewport, then descends to its docked
  // position over LOGO_TRAVEL viewport heights of scrolling. It tracks
  // the scroll position directly rather than easing, so it stays in
  // sync with the scrollbar.
  var LOGO_RISE = 0.08;
  var LOGO_TRAVEL = 1;
  // Full size at the hero position, shrinking to this as it docks.
  var LOGO_SCALE_END = 0.4;

  var cols = [];
  var items = [];   // { tint, col, offsetTop, shown }
  var travel = [];
  var current = [];
  var maxTravel = 1;
  var colCount = 0;
  var viewport = 0;
  var padTop = 0;
  var staggers = [];
  var rafId = null;
  var lastTime = 0;
  var primed = false;
  var lastWidth = 0;
  var lastHeight = 0;
  var masthead = document.querySelector(".masthead");
  var aboutEl = document.querySelector(".about");
  var aboutTravel = 0;   // scroll range spent revealing the about panel
  var aboutShown = null;
  var logoOffset = 0;  // px to lift the wordmark by at scroll 0
  var logoShown = null;

  // Fewer, larger columns: the 1500px track still fills edge to edge,
  // so nothing is lost at the sides, but each piece stays big enough
  // to carry the page on its own.
  function columnsFor(width) {
    if (width < 620) return 1;
    if (width < 1024) return 2;
    return 3;
  }

  function build() {
    colCount = columnsFor(window.innerWidth);
    grid.textContent = "";
    cols = [];
    for (var i = 0; i < colCount; i++) {
      var col = document.createElement("div");
      col.className = "col";
      grid.appendChild(col);
      cols.push(col);
    }
    figures.forEach(function (fig, i) {
      cols[i % colCount].appendChild(fig);
    });
    current = cols.map(function () { return 0; });
    primed = false;
    measure();
  }

  function measure() {
    var vh = window.innerHeight;
    viewport = vh;
    lastWidth = window.innerWidth;
    lastHeight = vh;
    padTop = parseFloat(getComputedStyle(grid).paddingTop) || 0;
    // Leave the logo and nav clear at the end of the run.
    var endGap = vh * 0.36;

    staggers = [];
    travel = cols.map(function (col, i) {
      var stagger = Math.round(vh * STAGGER[i % STAGGER.length]);
      col.style.marginTop = stagger + "px";
      staggers.push(stagger);
      return Math.max(0, padTop + stagger + col.offsetHeight + endGap - vh);
    });
    maxTravel = Math.max(1, Math.max.apply(null, travel));

    // Cache each piece's position so the colour fade never has to read
    // layout back out of the DOM while we are writing transforms.
    items = figures.map(function (fig) {
      var col = fig.parentElement;
      return {
        tint: fig.querySelector(".tint"),
        col: cols.indexOf(col),
        offsetTop: fig.offsetTop,
        shown: -1,
      };
    });

    // How far the wordmark has to rise from its docked position to sit
    // LOGO_RISE above the vertical centre. Measured with the offset
    // cleared, so the rect read back is the docked one the CSS defines
    // (which differs between breakpoints).
    masthead.style.setProperty("--logo-y", "0px");
    masthead.style.setProperty("--logo-scale", "1");
    var logoRect = masthead.getBoundingClientRect();
    logoOffset = vh * (0.5 - LOGO_RISE) - (logoRect.top + logoRect.height / 2);
    logoShown = null;

    // The about panel is parked one screen down and slides up over its
    // own stretch of scroll once the work has run out.
    aboutTravel = aboutEl ? vh : 0;
    spacer.style.height = Math.round(vh + maxTravel + aboutTravel) + "px";
  }

  // Converts a "per 60fps frame" lerp factor to one for the real
  // elapsed time, so the feel is identical at any refresh rate.
  function smoothing(ease, steps) {
    return 1 - Math.pow(1 - ease, steps);
  }

  function frame(now) {
    var elapsed = lastTime ? now - lastTime : 16.667;
    lastTime = now;
    // Clamp so returning to a backgrounded tab does not jump.
    var steps = Math.min(elapsed, 100) / 16.667;

    var scroll = window.scrollY || window.pageYOffset || 0;
    var progress = Math.min(scroll, maxTravel) / maxTravel;
    // Scrolling past the end of the work reveals the about panel; the
    // columns keep rising by the same amount so the work clears out.
    var extra = Math.max(0, Math.min(scroll - maxTravel, aboutTravel));

    for (var i = 0; i < cols.length; i++) {
      var target = progress * travel[i] + extra;
      var next = primed
        ? current[i] + (target - current[i]) * smoothing(EASE[i % EASE.length], steps)
        : target;
      if (Math.abs(target - next) < 0.05) next = target;
      current[i] = next;
      cols[i].style.transform = "translate3d(0," + -next.toFixed(2) + "px,0)";
    }

    // Colour rises with the work: duotone at the bottom of the
    // viewport, up to TINT_MAX once it reaches the top.
    var startAt = viewport * 0.2;
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (!it.tint || it.col < 0) continue;
      var top = padTop + staggers[it.col] + it.offsetTop - current[it.col];
      var amount = (startAt - top) / startAt;
      amount = amount < 0 ? 0 : amount > 1 ? 1 : amount;
      var opacity = Math.round(amount * TINT_MAX * 1000) / 1000;
      if (opacity !== it.shown) {
        it.tint.style.opacity = opacity;
        it.shown = opacity;
      }
    }

    // The wordmark descends from the hero position to its docked one,
    // tied straight to the scroll offset rather than eased.
    var logoProgress = Math.min(1, scroll / Math.max(1, viewport * LOGO_TRAVEL));
    var logoY = Math.round(logoOffset * (1 - logoProgress) * 100) / 100;
    if (logoY !== logoShown) {
      var logoScale = 1 + (LOGO_SCALE_END - 1) * logoProgress;
      masthead.style.setProperty("--logo-y", logoY + "px");
      masthead.style.setProperty("--logo-scale", logoScale.toFixed(4));
      logoShown = logoY;
    }

    if (aboutEl && extra !== aboutShown) {
      aboutEl.style.transform = "translate3d(0," + -extra.toFixed(2) + "px,0)";
      aboutShown = extra;
    }

    primed = true;
    rafId = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------ start / stop */

  function start() {
    docEl.classList.add("motion");
    build();
    lastTime = 0;
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  function stop() {
    docEl.classList.remove("motion");
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Restore natural flow, and show the work in colour.
    figures.forEach(function (fig) {
      var tint = fig.querySelector(".tint");
      if (tint) tint.style.opacity = TINT_MAX;
      grid.appendChild(fig);
    });
    cols.forEach(function (col) { col.remove(); });
    cols = [];
    items = [];
    masthead.style.setProperty("--logo-y", "0px");
    masthead.style.setProperty("--logo-scale", String(LOGO_SCALE_END));
    logoShown = null;
    if (aboutEl) aboutEl.style.transform = "";
    aboutShown = null;
    spacer.style.height = "0px";
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (reducedMotion.matches) return;
    // Mobile browsers fire resize as the address bar collapses and
    // expands during a scroll. Re-measuring then would move the scroll
    // range out from under the gesture and make the page lurch, so only
    // react to a width change or a genuinely large height change.
    if (window.innerWidth === lastWidth &&
        Math.abs(window.innerHeight - lastHeight) < 150) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (columnsFor(window.innerWidth) !== colCount) build();
      else measure();
    }, 150);
  });

  function onMotionPreference() {
    if (reducedMotion.matches) stop();
    else start();
  }

  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", onMotionPreference);
  }

  // Re-measure once fonts and any real photography have settled.
  window.addEventListener("load", function () {
    if (!reducedMotion.matches) measure();
  });

  // The about panel is not in normal flow while the fluid scroll is on,
  // so an anchor jump would go nowhere. Scroll to the end instead.
  var aboutLink = document.querySelector('.site-nav a[href="#about"]');
  if (aboutLink) {
    aboutLink.addEventListener("click", function (e) {
      if (!docEl.classList.contains("motion")) return;  // plain anchor is fine
      e.preventDefault();
      window.scrollTo({ top: Math.round(maxTravel + aboutTravel), behavior: "smooth" });
    });
  }

  /* -------------------------------------------------------- boot */

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Kept identical to the markup admin.html writes back into
  // index.html, so the rendered page and the fallback never diverge.
  function figureMarkup(item) {
    var dim = "";
    if (item.width && item.height) {
      dim = ' width="' + esc(item.width) + '" height="' + esc(item.height) + '"';
    }
    var year = item.year ? ' <span class="sep">–</span> ' + esc(item.year) : "";
    return '<figure>' +
      '<div class="frame">' +
      '<img class="duo" src="' + esc(item.src) + '"' + dim + ' alt="' + esc(item.alt) + '">' +
      '<img class="tint" src="' + esc(item.src) + '"' + dim + ' alt="" aria-hidden="true">' +
      '</div>' +
      '<span class="label">' + esc(item.title) + year + '</span>' +
      '</figure>';
  }

  function boot() {
    figures = Array.prototype.slice.call(grid.querySelectorAll("figure"));
    onMotionPreference();
  }

  // content.json is the source of truth. If it cannot be read — opened
  // straight off the filesystem, say — the markup already in the page
  // stands in for it.
  if (window.fetch) {
    fetch("content.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.work) && data.work.length) {
          grid.innerHTML = data.work.map(figureMarkup).join("");
        }
      })
      .catch(function () { /* keep the markup in the page */ })
      .then(boot, boot);
  } else {
    boot();
  }
})();
