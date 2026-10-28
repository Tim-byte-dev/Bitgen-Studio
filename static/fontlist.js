/* bitGen Studio — static/fontlist.js (2.607.0): EVERY FONT ON THIS COMPUTER IN EVERY FONT LIST. window.H3Fonts.
 *
 * Tim (verbatim): "Use all the fonts that are installed in the os."
 * The font dropdowns had a fixed handful (Arial, Georgia, Impact ...). Now each one keeps those at the top ("Common") and
 * lists every family installed on this computer below them ("This computer (N)") - the server reads the system font
 * folders (GET /api/fonts, lib/fontFiles.js: Windows Fonts + the user's own, macOS / Linux font folders, <install>/fonts).
 *   The lists it fills by itself (a watcher, nothing to wire): the image editor's Type tool (#ptFont), Properties
 *   (#ppTFont), Character panel (#pcyFont); the timeline's text (#tlpFont), 3D text (#tlp3Font), captions (#tcapFont);
 *   the karaoke style (#ks_font) - and any <select data-h3fonts> or <select class="h3-font">.
 *   A family the browser cannot draw by name (a font only in <install>/fonts, say) is loaded from its file
 *   (/api/fonts/file, as a web font) the moment it is picked; "h3fontload" {family} fires on window when it is in, so
 *   the text using it is drawn again.
 * Pure (Node): merge(common, families) -> {common, more} (the computer's list without the common ones, sorted, no dupes,
 *   no hidden "." / "@" families); SELECTORS.
 */
(function (root) {
  "use strict";
  var SELECTORS = "#ptFont,#ppTFont,#pcyFont,#tlpFont,#tlp3Font,#tcapFont,#ks_font,select[data-h3fonts],select.h3-font";
  var GENERIC = { "": 1, serif: 1, "sans-serif": 1, monospace: 1, cursive: 1, fantasy: 1, "system-ui": 1 };
  function merge(common, families) {
    var seen = {}, c = [], more = [];
    (common || []).forEach(function (f) { var k = String(f).toLowerCase(); if (!seen[k]) { seen[k] = 1; c.push(f); } });
    (families || []).forEach(function (f) {
      f = String(f || "").trim(); var k = f.toLowerCase();
      if (!f || seen[k] || /^[.@]/.test(f) || f.length > 80) return;
      seen[k] = 1; more.push(f);
    });
    more.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: "base" }); });
    return { common: c, more: more };
  }
  var api = { merge: merge, SELECTORS: SELECTORS };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = api; return; }

  var doc = root.document, list = null, loading = null, waiting = [];
  function load() {
    if (list) return Promise.resolve(list);
    if (!loading) loading = fetch("/api/fonts").then(function (r) { return r.ok ? r.json() : { families: [] }; })
      .then(function (j) { list = Array.isArray(j.families) ? j.families : []; return list; })
      .catch(function () { list = []; return list; });
    return loading;
  }
  /* ---- can the browser draw it by name? (a missing family measures exactly like its fallback) */
  var probe = null;
  function drawable(fam) {
    if (GENERIC[String(fam).toLowerCase()]) return true;
    try {
      if (!probe) probe = doc.createElement("canvas").getContext("2d");
      var s = "mmmmmmmmmmlliWW@#0", same = 0;
      ["monospace", "serif", "sans-serif"].forEach(function (fb) {
        probe.font = "72px " + fb; var a = probe.measureText(s).width;
        probe.font = '72px "' + String(fam).replace(/"/g, "") + '", ' + fb; var b = probe.measureText(s).width;
        if (Math.abs(a - b) < 0.01) same++;
      });
      return same < 3;
    } catch (e) { return true; }
  }
  var tried = {};
  /** the family usable on a canvas -> Promise<true | false> (false = the browser's fallback draws it) */
  function ensure(fam) {
    fam = String(fam || "").trim();
    if (!fam || drawable(fam)) return Promise.resolve(true);
    if (tried[fam]) return tried[fam];
    if (typeof root.FontFace !== "function" || !doc.fonts) return Promise.resolve(false);
    var url = function (b, i) { return "url(/api/fonts/file?family=" + encodeURIComponent(fam) + "&bold=" + b + "&italic=" + i + ")"; };
    var faces = [[0, 0, "400", "normal"], [1, 0, "700", "normal"], [0, 1, "400", "italic"], [1, 1, "700", "italic"]].map(function (v) {
      var f = new root.FontFace(fam, url(v[0], v[1]), { weight: v[2], style: v[3] });
      return f.load().then(function (ok) { doc.fonts.add(ok); return true; }, function () { return false; });
    });
    tried[fam] = Promise.all(faces).then(function (r) {
      var any = r.some(Boolean);
      if (any) try { root.dispatchEvent(new root.CustomEvent("h3fontload", { detail: { family: fam } })); } catch (e) { /* old */ }
      return any;
    });
    return tried[fam];
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  /** a <select> of fonts: its own options stay as "Common", every family on this computer goes below them */
  function enhance(sel) {
    if (!sel || sel.tagName !== "SELECT" || sel.dataset.h3fontsDone) return;
    sel.dataset.h3fontsDone = "1";
    sel.addEventListener("change", function () { ensure(sel.value); });
    load().then(function (fams) {
      if (!sel.isConnected || sel.querySelector("optgroup.h3f-more")) return;
      var cur = sel.value, own = [].map.call(sel.options, function (o) { return o.value; });
      var m = merge(own, fams);
      if (!m.more.length) return;
      // the select's own options into a "Common" group (their text / values unchanged), the computer's below
      var g0 = doc.createElement("optgroup"); g0.label = "Common"; g0.className = "h3f-common";
      [].slice.call(sel.children).forEach(function (o) { if (o.tagName === "OPTION" && o.value !== "") g0.appendChild(o); });
      sel.appendChild(g0);
      var g = doc.createElement("optgroup"); g.label = "This computer (" + m.more.length + ")"; g.className = "h3f-more";
      g.innerHTML = m.more.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + "</option>"; }).join("");
      sel.appendChild(g);
      sel.value = cur;
      if (sel.value !== cur && cur) { var o = doc.createElement("option"); o.value = cur; o.textContent = cur; g0.appendChild(o); sel.value = cur; }
      sel.title = (sel.title ? sel.title.replace(/ - \d+ fonts.*$/, "") + " - " : "") + (m.common.length + m.more.length) + " fonts (every font installed on this computer)";
      if (cur) ensure(cur);
    });
  }
  var NOT_DONE = SELECTORS.split(",").map(function (x) { return x + ":not([data-h3fonts-done])"; }).join(",");
  var queued = false;
  function sweep() { queued = false; [].forEach.call(doc.querySelectorAll(NOT_DONE), enhance); }
  function soon() { if (queued) return; queued = true; (root.requestAnimationFrame || setTimeout)(sweep); }
  function start() {
    sweep();
    new root.MutationObserver(soon).observe(doc.body, { childList: true, subtree: true });
    load();
  }
  Object.assign(api, { load: load, ensure: ensure, enhance: enhance, drawable: drawable, families: function () { return list || []; } });
  root.H3Fonts = api;
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
