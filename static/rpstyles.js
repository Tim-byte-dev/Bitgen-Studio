/* bitGen Studio — static/rpstyles.js (2.744.0): ON A RUNPOD SERVERLESS ENDPOINT, ONLY THE STYLES IT CAN RENDER (window.H3RpStyles).
 * Tim (verbatim): "if user is using runpod only show the styles that will work with runpod"
 *
 *   2.746.0 (Tim: "when radio is selected for local show local styles, remote show remote styles ..., both , show all
 *   styles"): the server's answer carries each style's `hide` reason - Basic Settings ▸ GPU on Local hides the remote
 *   styles, on Remote the styles for this computer, on Both none - plus the endpoint check below for remote styles.
 *   GET /api/remotegpu/serverless/styles (lib/rpslStyles.js) says, style by style, whether the endpoint's ComfyUI has
 *   every node its workflow uses. While Remote GPU is on RunPod Serverless (and "show every style" is off) the style
 *   pickers - the prompt docker's image styles (#styleSel), the video styles (#videoStyleSel, with its "— template —"),
 *   the Music docker's (#musicSel) - hide the rest (option.hidden + disabled, why in its title) and end with a line
 *   saying how many are hidden. A hidden style that was picked moves to the first one shown (a change event, so the
 *   page follows). The lists are watched: a repaint is filtered again; a style the answer does not know yet (just
 *   saved) asks again. Back on This computer every style shows.
 *   document "h3:rgpu" (static/remotegpu.js: Use it / a save) = ask again.
 *   The image editor's edit-only list (ext/imageeditdock/ieeditonly.js, data-ie-hide) hides options in #styleSel too:
 *   an option stays hidden when either says so.
 *   H3RpStyles.load() -> the answer   .state() -> {map}   .apply() */
(function (root) {
  "use strict";
  var doc = root.document;
  var SELS = ["styleSel", "videoStyleSel", "musicSel"];
  var KIND = { styleSel: "image", videoStyleSel: "video", musicSel: "music" };   // 2.745.0: Basic Settings ▸ GPU "both" filters only the kinds it sends
  var S = { map: null, asked: 0, busy: false };
  function $(id) { return doc.getElementById(id); }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function load() {
    S.asked = Date.now();
    return root.fetch("/api/remotegpu/serverless/styles").then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.styles) { S.map = j; watch(); applyAll(); test("rpstyles", j.filter ? "filter" : "off"); } return j; })
      .catch(function () { return null; });
  }
  function hiddenFor(sel, opt, m) {
    if (!m || opt.dataset.rpsl === "note") return null;
    if (opt.value === "") return sel.id === "videoStyleSel" && m.template && m.template.hide ? m.template.hide : null;
    var st = m.styles[opt.value];
    if (!st) { if (Date.now() - S.asked > 5000) setTimeout(load, 0); return null; }      // a style saved since: ask again
    return st.hide || null;                                  // 2.746.0: the server says why (lib/rpslStyles.js hideWhy)
  }
  function apply(sel) {
    if (!sel || S.busy) return;
    S.busy = true;
    try {
      var m = S.map, n = 0;
      [].slice.call(sel.querySelectorAll('option[data-rpsl="note"]')).forEach(function (o) { o.remove(); });
      [].slice.call(sel.options).forEach(function (o) {
        var why = hiddenFor(sel, o, m);
        var hide = why !== null;
        var ie = o.dataset.ieHide === "1";                                   // the image editor's edit-only list hides it too
        o.hidden = hide || ie; o.disabled = hide || ie;
        if (hide) { n++; o.dataset.rpslWhy = why; o.title = why; }
        else if (o.dataset.rpslWhy != null) { delete o.dataset.rpslWhy; o.removeAttribute("title"); }
      });
      var shown = [].slice.call(sel.options).some(function (o) { return o.value && !o.hidden && o.dataset.rpsl !== "note"; });
      if (n) {
        var note = doc.createElement("option");
        note.dataset.rpsl = "note"; note.disabled = true; note.value = "__rpsl";
        note.textContent = m.where === "local" ? "🖥 " + n + " remote styles hidden: Basic Settings ▸ GPU is on Local"
          : m.where === "remote" && !shown ? "☁ No remote styles: Basic Settings ▸ GPU is on Remote - set it to Local, or a style's Runs on to Remote GPU"   // 2.747.0
          : m.where === "remote" ? "☁ " + n + " styles hidden: Basic Settings ▸ GPU is on Remote - only the remote styles it can render show"
          : "☁ " + n + " styles hidden: your RunPod endpoint cannot render them (Settings ▸ Remote generation)";
        sel.appendChild(note);
      }
      var cur = sel.selectedOptions[0];
      if (cur && (cur.hidden || cur.dataset.rpsl === "note")) {
        var first = [].slice.call(sel.options).find(function (o) { return !o.hidden && !o.disabled; });
        if (first) { sel.value = first.value; S.busy = false; sel.dispatchEvent(new Event("change", { bubbles: true })); S.busy = true; }
      }
    } finally { S.busy = false; }
  }
  function applyAll() { SELS.forEach(function (id) { apply($(id)); }); }
  var watched = {}, againT = 0;
  function again() { clearTimeout(againT); againT = setTimeout(load, 250); }
  function watch() {
    SELS.forEach(function (id) {
      var sel = $(id);
      if (!sel || watched[id] === sel) return;
      watched[id] = sel;
      // only the page's own repaints: the note line this script adds / removes is not one (it would loop for ever)
      var mine = function (n) { return n.nodeType === 1 && n.dataset && n.dataset.rpsl === "note"; };
      new MutationObserver(function (recs) {
        if (S.busy) return;
        var theirs = recs.some(function (r) { return [].slice.call(r.addedNodes).concat([].slice.call(r.removedNodes)).some(function (n) { return !mine(n); }); });
        if (theirs) { apply(sel); again(); }   // 2.746.0: a repaint follows a save - its "Runs on" may have changed
      }).observe(sel, { childList: true });
      apply(sel);
    });
  }
  function boot() {
    watch(); load();
    var tries = 0, t = setInterval(function () { watch(); if (++tries > 40 || SELS.every(function (id) { return watched[id]; })) clearInterval(t); }, 500);
    doc.addEventListener("h3:rgpu", function () { load(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RpStyles = { load: load, apply: applyAll, state: function () { return S; } };
})(typeof window !== "undefined" ? window : globalThis);
