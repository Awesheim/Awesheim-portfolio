/* ---------------------------------------------------------------
   Awesheim — CMS for the work list.

   The site is static, so nothing here writes to disk. You edit, the
   draft is kept in localStorage, and you export two files to commit:

     content.json  the content index.html reads at runtime
     index.html    the same content written into the markup, so the
                   no-JS fallback and search engines stay in step

   Both are generated from the same data, which is why they cannot
   drift apart.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  /* ------------------------------------------------------- gate */

  /* Set ENABLED to true and PASS_SHA256 to the hex SHA-256 of your
     passphrase to switch the gate on. Generate one with:

       echo -n 'your passphrase' | shasum -a 256

     Be clear-eyed about what this does: it hides the form, nothing
     more. The files are still served to anyone who asks for them, and
     the hash is right here in the source to be attacked offline. It is
     a speed bump for a public URL, not access control. For real
     protection put HTTP auth in front of admin.html and content.json at
     the host (Netlify/Vercel password protection, an .htaccess rule, or
     equivalent). */
  var GATE = {
    ENABLED: false,
    PASS_SHA256: "",
    KEY: "awesheim.admin.unlocked",
  };

  var DRAFT_KEY = "awesheim.admin.draft";
  var WORK_START = "<!-- work:start";
  var WORK_END = "<!-- work:end -->";

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $("list");
  var statusEl = $("status");

  var items = [];
  var pristine = "";   // JSON of what content.json held, to detect edits

  /* ------------------------------------------------- utilities */

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function say(msg, ok) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (ok ? " ok" : "");
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  /* --------------------------------------------------- the data */

  function clean(item) {
    var out = {
      src: (item.src || "").trim(),
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
      alt: (item.alt || "").trim(),
      title: (item.title || "").trim(),
      year: (item.year || "").toString().trim(),
    };
    if (!out.width || !out.height) { delete out.width; delete out.height; }
    return out;
  }

  function serialise() {
    return JSON.stringify({ work: items.map(clean) }, null, 2) + "\n";
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(items)); } catch (e) {}
    say(serialise() === pristine ? "No changes since content.json" : "Unsaved changes — export to keep them");
  }

  // Must match figureMarkup() in js/main.js so the rendered page and the
  // exported fallback markup are the same thing.
  function figureMarkup(item, indent) {
    var pad = indent || "    ";
    var dim = item.width && item.height
      ? ' width="' + esc(item.width) + '" height="' + esc(item.height) + '"' : "";
    var year = item.year ? ' <span class="sep">–</span> ' + esc(item.year) : "";
    return pad + "<figure>\n" +
      pad + "  <div class=\"frame\">\n" +
      pad + "    <img class=\"duo\" src=\"" + esc(item.src) + "\"" + dim + " alt=\"" + esc(item.alt) + "\">\n" +
      pad + "    <img class=\"tint\" src=\"" + esc(item.src) + "\"" + dim + " alt=\"\" aria-hidden=\"true\">\n" +
      pad + "  </div>\n" +
      pad + "  <span class=\"label\">" + esc(item.title) + year + "</span>\n" +
      pad + "</figure>";
  }

  /* ---------------------------------------------------- render */

  function render() {
    listEl.textContent = "";
    items.forEach(function (item, i) {
      listEl.appendChild(row(item, i));
    });
    if (!items.length) {
      var p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No pieces yet. Add one to get started.";
      listEl.appendChild(p);
    }
  }

  function field(labelText, value, attrs, onInput) {
    var label = document.createElement("label");
    var span = document.createElement("span");
    span.textContent = labelText;
    var input = document.createElement("input");
    input.type = attrs.type || "text";
    input.value = value == null ? "" : value;
    if (attrs.placeholder) input.placeholder = attrs.placeholder;
    input.addEventListener("input", function () { onInput(input.value); });
    label.appendChild(span);
    label.appendChild(input);
    return { el: label, input: input };
  }

  function row(item, i) {
    var wrap = document.createElement("div");
    wrap.className = "item";

    /* thumbnail ------------------------------------------------ */
    var thumb = document.createElement("div");
    thumb.className = "thumb";
    var img = document.createElement("img");
    img.alt = "";
    img.src = item._preview || item.src;
    img.addEventListener("error", function () {
      thumb.textContent = "";
      var m = document.createElement("div");
      m.className = "missing";
      m.textContent = "Image not found\n" + (item.src || "(no path)");
      thumb.appendChild(m);
    });
    thumb.appendChild(img);

    /* fields --------------------------------------------------- */
    var fields = document.createElement("div");
    fields.className = "fields";

    var titleRow = document.createElement("div");
    titleRow.className = "row";
    titleRow.appendChild(field("Title", item.title, {}, function (v) {
      item.title = v; saveDraft();
    }).el);
    titleRow.appendChild(field("Year", item.year, { placeholder: "2026" }, function (v) {
      item.year = v; saveDraft();
    }).el);
    fields.appendChild(titleRow);

    fields.appendChild(field("Alt text (describe the piece for screen readers)", item.alt, {}, function (v) {
      item.alt = v; saveDraft();
    }).el);

    var srcField = field("Image path", item.src, { placeholder: "images/my-piece.jpg" }, function (v) {
      item.src = v;
      delete item._preview;
      saveDraft();
      refreshThumb();
    });
    fields.appendChild(srcField.el);

    function refreshThumb() {
      thumb.textContent = "";
      var fresh = document.createElement("img");
      fresh.alt = "";
      fresh.addEventListener("error", function () {
        thumb.textContent = "";
        var m = document.createElement("div");
        m.className = "missing";
        m.textContent = "Image not found";
        thumb.appendChild(m);
      });
      fresh.src = item._preview || item.src;
      thumb.appendChild(fresh);
    }

    /* file picker: records name + real dimensions, previews locally */
    var pick = document.createElement("div");
    pick.className = "filepick";
    var file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    var note = document.createElement("div");
    note.className = "hint";
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f);
      var probe = new Image();
      probe.onload = function () {
        item.width = probe.naturalWidth;
        item.height = probe.naturalHeight;
        item.src = "images/" + f.name;
        item._preview = url;
        srcField.input.value = item.src;
        note.className = "hint warn";
        note.textContent = "Copy " + f.name + " into images/ and commit it (" +
          probe.naturalWidth + "x" + probe.naturalHeight + ")";
        saveDraft();
        refreshThumb();
      };
      probe.onerror = function () {
        note.className = "hint warn";
        note.textContent = "Could not read that file as an image.";
      };
      probe.src = url;
    });
    pick.appendChild(file);
    fields.appendChild(pick);
    fields.appendChild(note);

    /* controls -------------------------------------------------- */
    var side = document.createElement("div");
    side.className = "side";

    var up = document.createElement("button");
    up.textContent = "↑";
    up.title = "Move up";
    up.disabled = i === 0;
    up.addEventListener("click", function () { move(i, -1); });

    var down = document.createElement("button");
    down.textContent = "↓";
    down.title = "Move down";
    down.disabled = i === items.length - 1;
    down.addEventListener("click", function () { move(i, 1); });

    var del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "danger";
    del.addEventListener("click", function () {
      if (!confirm("Remove “" + (item.title || "this piece") + "” from the site?")) return;
      items.splice(i, 1);
      saveDraft();
      render();
    });

    side.appendChild(up);
    side.appendChild(down);
    side.appendChild(del);

    wrap.appendChild(thumb);
    wrap.appendChild(fields);
    wrap.appendChild(side);
    return wrap;
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= items.length) return;
    var tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
    saveDraft();
    render();
  }

  /* ---------------------------------------------------- loading */

  function loadFromServer() {
    return fetch("content.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("content.json returned " + r.status);
        return r.json();
      })
      .then(function (data) {
        var work = (data && Array.isArray(data.work)) ? data.work : [];
        pristine = JSON.stringify({ work: work.map(clean) }, null, 2) + "\n";
        return work;
      });
  }

  function boot() {
    loadFromServer().then(function (work) {
      var draft = null;
      try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
      if (draft && Array.isArray(draft) && draft.length) {
        items = draft;
        say("Restored unsaved changes from this browser");
      } else {
        items = work;
        say("Loaded " + work.length + " pieces from content.json", true);
      }
      render();
    }).catch(function (err) {
      items = [];
      render();
      say("Could not read content.json — " + err.message + ". Serve the folder over http rather than opening the file directly.");
    });
  }

  /* ---------------------------------------------------- actions */

  $("add").addEventListener("click", function () {
    items.push({ src: "", width: 0, height: 0, alt: "", title: "Untitled", year: String(new Date().getFullYear()) });
    saveDraft();
    render();
    window.scrollTo(0, document.body.scrollHeight);
  });

  $("reload").addEventListener("click", function () {
    loadFromServer().then(function (work) {
      items = work;
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      render();
      say("Reloaded from content.json", true);
    }).catch(function (err) { say(String(err.message)); });
  });

  $("revert").addEventListener("click", function () {
    if (!confirm("Discard every change made in this browser since the last export?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    boot();
  });

  $("dl-json").addEventListener("click", function () {
    download("content.json", serialise(), "application/json");
    say("content.json exported — commit it to publish", true);
  });

  $("dl-html").addEventListener("click", function () {
    fetch("index.html", { cache: "no-cache" })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var a = html.indexOf(WORK_START);
        var b = html.indexOf(WORK_END);
        if (a < 0 || b < 0) throw new Error("could not find the work:start/work:end markers in index.html");
        var head = html.slice(0, a);
        var tail = html.slice(b);
        var block = WORK_START + " — generated from content.json by admin.html; do not hand-edit -->\n" +
          items.map(function (it) { return figureMarkup(clean(it)); }).join("\n") + "\n    ";
        download("index.html", head + block + tail, "text/html");
        say("index.html exported — commit it alongside content.json", true);
      })
      .catch(function (err) { say("Export failed: " + err.message); });
  });

  /* ------------------------------------------------------- init */

  function openApp() {
    $("app").hidden = false;
    $("bar").hidden = false;
    boot();
  }

  if (!GATE.ENABLED) {
    openApp();
  } else if (sessionStorage.getItem(GATE.KEY) === "1") {
    openApp();
  } else {
    $("gate").hidden = false;
    $("gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      sha256Hex($("gate-input").value).then(function (hex) {
        if (hex === GATE.PASS_SHA256) {
          sessionStorage.setItem(GATE.KEY, "1");
          $("gate").hidden = true;
          openApp();
        } else {
          $("gate-status").textContent = "Not that one.";
        }
      });
    });
  }
})();
