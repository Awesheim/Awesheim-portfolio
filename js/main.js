/* ---------------------------------------------------------------
   Awesheim — fluid multi-column parallax scroll

   How it works:
   - The figures in index.html are distributed round-robin into
     N columns (responsive: 2 / 3 / 4).
   - The stage is fixed; an invisible spacer gives the page its
     native scrollbar, so scrolling stays completely standard
     (wheel, touch, keyboard, scrollbar).
   - Each column travels exactly the distance its own content
     needs to pass through the viewport, so short columns move
     slower than tall ones and every column lands at the bottom
     together — no dead space, any number of images per column.
   - Each column eases toward its target with its own lerp factor,
     which is what makes the motion fluid instead of locked 1:1
     to the scrollbar.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var docEl = document.documentElement;
  var grid = document.getElementById("grid");
  var footer = document.getElementById("footer");
  var spacer = document.querySelector(".scroll-spacer");
  var tagline = document.querySelector(".tagline");
  var figures = Array.prototype.slice.call(grid.querySelectorAll("figure"));

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Per-column offsets (× viewport height) so tops start staggered,
  // and per-column easing so columns drift at slightly different rates.
  // EASE values are "per 60fps frame" and get converted to a
  // frame-rate independent factor below, so a 120Hz display feels
  // identical to a 60Hz one.
  var STAGGER = [0, 0.16, 0.06, 0.22];
  var EASE = [0.105, 0.16, 0.125, 0.185];
  var FOOTER_EASE = 0.15;

  var cols = [];
  var travel = []; // distance each column must cover
  var current = []; // eased positions
  var maxTravel = 1;
  var footerCurrent = 0;
  var footerHeight = 0;
  var colCount = 0;
  var viewport = 0;
  var rafId = null;
  var lastTime = 0;
  var primed = false; // first frame snaps into place instead of sliding

  function columnsFor(width) {
    if (width < 620) return 2;
    if (width < 1400) return 3;
    return 4;
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
    primed = false; // snap to the current scroll position on the next frame
    measure();
  }

  function measure() {
    var vh = window.innerHeight;
    viewport = vh;
    var padTop = parseFloat(getComputedStyle(grid).paddingTop) || 0;
    var endGap = vh * 0.14; // breathing room before the footer arrives

    travel = cols.map(function (col, i) {
      var stagger = Math.round(vh * STAGGER[i % STAGGER.length]);
      col.style.marginTop = stagger + "px";
      return Math.max(0, padTop + stagger + col.offsetHeight + endGap - vh);
    });
    maxTravel = Math.max(1, Math.max.apply(null, travel));

    footerHeight = footer.offsetHeight;
    spacer.style.height = Math.round(vh + maxTravel + footerHeight) + "px";
  }

  // Converts a "per 60fps frame" lerp factor into one for the real
  // elapsed time, so the motion feels the same on 60Hz and 120Hz.
  function smoothing(ease, steps) {
    return 1 - Math.pow(1 - ease, steps);
  }

  function frame(now) {
    var elapsed = lastTime ? now - lastTime : 16.667;
    lastTime = now;
    // Clamp so returning to a backgrounded tab doesn't jump.
    var steps = Math.min(elapsed, 100) / 16.667;

    var scroll = window.scrollY || window.pageYOffset || 0;
    var progress = Math.min(scroll, maxTravel) / maxTravel;
    var extra = Math.max(0, scroll - maxTravel); // footer reveal range

    for (var i = 0; i < cols.length; i++) {
      var target = progress * travel[i] + extra;
      var next = primed
        ? current[i] + (target - current[i]) * smoothing(EASE[i % EASE.length], steps)
        : target;
      if (Math.abs(target - next) < 0.05) next = target;
      current[i] = next;
      cols[i].style.transform = "translate3d(0," + -next.toFixed(2) + "px,0)";
    }

    var footerNext = primed
      ? footerCurrent + (extra - footerCurrent) * smoothing(FOOTER_EASE, steps)
      : extra;
    if (Math.abs(extra - footerNext) < 0.05) footerNext = extra;
    footerCurrent = footerNext;
    footer.style.transform = "translate3d(0," + -footerNext.toFixed(2) + "px,0)";

    // The small tagline is only legible against bare paper, so it
    // retires once the work starts passing under the masthead.
    var fade = 1 - Math.min(1, scroll / (viewport * 0.45));
    tagline.style.opacity = (fade * fade).toFixed(3);

    primed = true;
    rafId = requestAnimationFrame(frame);
  }

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
    // restore natural flow
    figures.forEach(function (fig) { grid.appendChild(fig); });
    cols.forEach(function (col) { col.remove(); });
    cols = [];
    footer.style.transform = "";
    tagline.style.opacity = "";
    spacer.style.height = "0px";
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (reducedMotion.matches) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (columnsFor(window.innerWidth) !== colCount) {
        build();
      } else {
        measure();
      }
    }, 150);
  });

  function onMotionPreference() {
    if (reducedMotion.matches) stop();
    else start();
  }

  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", onMotionPreference);
  }

  // SVG placeholders have intrinsic sizes from width/height attributes,
  // but re-measure once everything has loaded to be safe (real photos,
  // web fonts, etc.).
  window.addEventListener("load", function () {
    if (!reducedMotion.matches) measure();
  });

  onMotionPreference();
})();
