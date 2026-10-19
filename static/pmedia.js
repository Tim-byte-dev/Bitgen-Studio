/* bitGen Studio — THE PROJECT'S MEDIA IN EVERY DROPDOWN (2.298.0).
 *
 * Tim (verbatim): "scan the projects subfolders for images and music and
 * videos before adding it to a dropdown. scan for assets, characters,
 * locations etc."
 *
 * window.bgMedia - one helper every media dropdown uses (the video dock's
 * board song, the stems dock's song, the music-video dialog, the frame
 * picker):
 *   load(kind)                 -> Promise<[{name, rel, group, asset}]>
 *                                 (GET /api/pmedia - the WHOLE project,
 *                                 scanned when the dropdown fills)
 *   fill(select, list, opts)   -> the <select> gets one <optgroup> per
 *                                 group (Assets, Gallery, Characters · Vera,
 *                                 Locations · Pier, References, Songs, ...).
 *                                 An asset's value is its NAME (what every
 *                                 consumer already understands); anything
 *                                 else is "rel:<project path>".
 *   resolve(value)             -> Promise<asset name>: a "rel:" pick is
 *                                 adopted into the asset folder first (POST
 *                                 /api/pmedia/adopt - a hard link), so the
 *                                 name then works everywhere.
 *   thumbSrc(entry)            -> an <img> src for any listed picture.
 */
(function () {
  "use strict";
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function load(kind) {
    return fetch("/api/pmedia?kind=" + encodeURIComponent(kind))
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j[kind]) || []; });
  }
  function valueOf(x) { return x.asset ? x.name : "rel:" + x.rel; }
  function fill(sel, list, opts) {
    if (!sel) return;
    var o = opts || {};
    var keep = o.keep !== undefined ? o.keep : sel.value;
    var html = o.placeholder !== undefined
      ? '<option value="">' + esc(o.placeholder) + "</option>" : "";
    var groups = [], by = {};
    (list || []).forEach(function (x) {
      if (o.filter && !o.filter(x)) return;
      if (!by[x.group]) { by[x.group] = []; groups.push(x.group); }
      by[x.group].push(x);
    });
    groups.forEach(function (g) {
      html += '<optgroup label="' + esc(g) + '">'
        + by[g].map(function (x) {
            return '<option value="' + esc(valueOf(x)) + '" title="' + esc(x.rel) + '">'
              + esc(x.name) + "</option>";
          }).join("") + "</optgroup>";
    });
    sel.innerHTML = html;
    if (keep) {
      sel.value = keep;
      // a kept asset name that is not in the list (a stale pick) stays shown
      if (sel.value !== keep && o.keepMissing !== false && !/^rel:/.test(keep)) {
        var op = document.createElement("option");
        op.value = keep; op.textContent = keep;
        sel.insertBefore(op, sel.firstChild && sel.firstChild.value === "" ? sel.firstChild.nextSibling : sel.firstChild);
        sel.value = keep;
      }
    }
    return groups;
  }
  function resolve(value) {
    var v = String(value || "");
    if (!/^rel:/.test(v)) return Promise.resolve(v);
    return fetch("/api/pmedia/adopt", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rel: v.slice(4) }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.error || !d.name) throw new Error((d && d.error) || "could not use that file");
        return d.name;
      });
  }
  function thumbSrc(x) {
    return x.asset ? "/passets/images/" + encodeURIComponent(x.name)
      : "/pmedia?rel=" + encodeURIComponent(x.rel);
  }
  window.bgMedia = { load: load, fill: fill, resolve: resolve, thumbSrc: thumbSrc, valueOf: valueOf };
})();
