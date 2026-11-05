/* bitGen Studio — static/dockfull.js (2.638.0): A DOCKER'S ⛶ = THE WHOLE WINDOW, THE OTHER DOCKERS CLOSED; 🗗 RESTORE = THE
 * LAYOUT AS IT WAS - window.H3DockFull.
 * Tim (verbatim): "make the solidcraft docker full screen and close the other dockers on maximize, on restore go back to the
 * layout it was in before maximized".
 *
 *   H3DockFull.attach(id)   for a bottom docker (.bdock) that uses the app's own ⛶ / 🗗 (toggleMax - Esc restores too):
 *     MAXIMIZED  it covers the whole bitGen window between the title bar and the status bar (both stay), every other
 *                docker shown is closed (its status-bar button goes dark)
 *     RESTORED   the dockers that were shown open again, each as it was - folded or not, its size (its inline style)
 *                and this browser's docker memory (h3.g. / h3.v. / h3.c. / h3.d. / h3.s. keys) put back as they were
 *     The layout before is kept in this browser (h3.dockfull.<id>) until the restore, so a reload while maximized still
 *     comes back to it.
 *   Used by: ext/solidcraftdock (scdock.js). (The Sketcher has its own, ext/pushpulldock/ppframe.js.)
 * Pure (Node: scripts/test-dockfull638.js): snapshotOf(docks, ls), restorePlan(snap, now). */
(function (root) {
  "use strict";
  var LOCAL = /^h3\.(g|v|c|d|s)\.[A-Za-z0-9_.-]+$/;
  /** the layout now: docks = [{id, btn, shown, collapsed, style}], ls = [[key, value]] -> the snapshot (the docker `self` left out) */
  function snapshotOf(docks, ls, self) {
    var out = { docks: [], local: {} };
    (docks || []).forEach(function (d) { if (d && d.id && d.id !== self) out.docks.push({ id: d.id, btn: d.btn, shown: !!d.shown, collapsed: !!d.collapsed, style: d.style == null ? null : String(d.style) }); });
    var mine = "." + (self || "\u0000");
    (ls || []).forEach(function (kv) { var k = String(kv[0]); if (LOCAL.test(k) && k.slice(-mine.length) !== mine) out.local[k] = String(kv[1]); });
    return out;
  }
  /** what to do to get back: [{id, btn, show, fold, unfold, style}] - only the dockers whose state differs (or whose style must come back) */
  function restorePlan(snap, now) {
    var by = {}; (now || []).forEach(function (d) { by[d.id] = d; });
    return ((snap && snap.docks) || []).map(function (s) {
      var n = by[s.id] || { shown: false, collapsed: false };
      return { id: s.id, btn: s.btn, show: s.shown && !n.shown, hide: !s.shown && n.shown, foldTo: s.shown ? s.collapsed : null, style: s.shown ? s.style : null };
    });
  }
  if (typeof module !== "undefined" && module.exports && !root.document) { module.exports = { snapshotOf: snapshotOf, restorePlan: restorePlan, LOCAL: LOCAL }; return; }

  var doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  var lsGet = function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { if (v == null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); } catch (e) { /* private */ } };
  function lsAll() { var out = []; try { for (var i = 0; i < root.localStorage.length; i++) { var k = root.localStorage.key(i); out.push([k, root.localStorage.getItem(k)]); } } catch (e) { /* none */ } return out; }
  function docksNow() {
    var G = root.H3GoneDocks || {}, out = [];
    Object.keys(G).forEach(function (btn) {
      var id = G[btn], el = $(id), b = $(btn); if (!el) return;
      out.push({ id: id, btn: btn, shown: !el.classList.contains("dockgone") && !!(b ? b.classList.contains("on") : true), collapsed: el.classList.contains("collapsed"), style: el.getAttribute("style") });
    });
    return out;
  }
  function top() { var tb = $("titlebar"); return tb && !tb.classList.contains("hidden") && tb.offsetHeight ? Math.round(tb.getBoundingClientRect().bottom) : 0; }
  function bottom() { var sb = $("statusbar"); if (!sb || !sb.offsetHeight || root.getComputedStyle(sb).display === "none") return 0; return Math.max(0, Math.round(root.innerHeight - sb.getBoundingClientRect().top)); }
  function css() {
    if ($("dockFullCss")) return;
    var st = doc.createElement("style"); st.id = "dockFullCss";
    st.textContent = ".bdock.dockfull.maxed{position:fixed!important;left:0!important;right:0!important;top:var(--df-top,0px)!important;bottom:var(--df-bottom,0px)!important;"
      + "width:auto!important;height:auto!important;max-height:none!important;margin:0!important;z-index:9000;border-radius:0;display:flex!important;flex-direction:column}"
      + ".bdock.dockfull.maxed>.bbody{flex:1 1 auto!important;min-height:0;max-height:none!important;height:auto!important;overflow:hidden}";
    doc.head.appendChild(st);
  }
  function closeOthers(id) {
    docksNow().forEach(function (d) { if (d.id !== id && d.shown && typeof root.toggleDockGone === "function") { try { root.toggleDockGone(d.id, d.btn); } catch (e) { /* fine */ } } });
  }
  function restore(id) {
    var raw = lsGet("h3.dockfull." + id); if (!raw) return false;
    var snap = null; try { snap = JSON.parse(raw); } catch (e) { snap = null; }
    lsSet("h3.dockfull." + id, null);
    if (!snap) return false;
    restorePlan(snap, docksNow()).forEach(function (p) {
      var el = $(p.id); if (!el) return;
      try {
        if (p.show || p.hide) root.toggleDockGone(p.id, p.btn);
        if (p.foldTo != null && el.classList.contains("collapsed") !== p.foldTo && typeof root.toggleCollapse === "function") root.toggleCollapse(p.id);
        if (p.style != null) el.setAttribute("style", p.style); else if (p.foldTo != null) el.removeAttribute("style");
      } catch (e) { /* the next one */ }
    });
    Object.keys(snap.local || {}).forEach(function (k) { lsSet(k, snap.local[k]); });
    try { if (typeof root.saveLayout === "function") root.saveLayout(); root.dispatchEvent(new root.Event("resize")); } catch (e) { /* fine */ }
    return true;
  }
  var attached = {};
  function attach(id, opts) {
    var dock = $(id); if (!dock || attached[id]) return null;
    var o = opts || {};
    attached[id] = true; css(); if (!o.engage) dock.classList.add("dockfull");
    var was = dock.classList.contains("maxed");
    // 2.658.0: o.engage(dock) -> false = this maximize is not a whole-window one (a docked docker grows in its column -
    // static/dockmax.js); the dockfull class (its CSS) only while engaged
    var engaged = !o.engage || !!lsGet("h3.dockfull." + id);
    function fit() {
      dock.style.setProperty("--df-top", top() + "px"); dock.style.setProperty("--df-bottom", bottom() + "px");
      if (o.onFit) try { o.onFit(dock.classList.contains("maxed")); } catch (e) { /* fine */ }
    }
    function change() {
      var m = dock.classList.contains("maxed");
      if (m === was) { if (m) fit(); return; }
      was = m;
      if (m && o.engage) { engaged = !!o.engage(dock); dock.classList.toggle("dockfull", engaged); if (!engaged) { if (o.onFit) try { o.onFit(true); } catch (e) { /* fine */ } return; } }
      if (!m && o.engage && !engaged) { if (o.onFit) try { o.onFit(false); } catch (e) { /* fine */ } return; }
      if (m) {
        if (!lsGet("h3.dockfull." + id)) lsSet("h3.dockfull." + id, JSON.stringify(snapshotOf(docksNow(), lsAll(), id)));
        closeOthers(id); fit();
      } else {
        // the --df-* stay off the style the restore puts back
        dock.style.removeProperty("--df-top"); dock.style.removeProperty("--df-bottom");
        restore(id);
        if (o.onFit) try { o.onFit(false); } catch (e) { /* fine */ }
      }
    }
    try { new root.MutationObserver(change).observe(dock, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* old */ }
    root.addEventListener("resize", function () { if (dock.classList.contains("maxed")) fit(); });
    // a reload while maximized: still maximized = keep the layout before; not any more = put it back now
    if (lsGet("h3.dockfull." + id)) { if (was) { closeOthers(id); fit(); } else setTimeout(function () { restore(id); }, 400); }
    else if (was && o.engage && !o.engage(dock)) { /* 2.658.0: maximized in its column - not the whole window */ }
    else if (was) { lsSet("h3.dockfull." + id, JSON.stringify(snapshotOf(docksNow(), lsAll(), id))); closeOthers(id); fit(); }
    dock.querySelectorAll(".maxbtn").forEach(function (b) { b.dataset.fullTitle = "1"; });
    return { restore: function () { return restore(id); }, snapshot: function () { return lsGet("h3.dockfull." + id); } };
  }
  root.H3DockFull = { attach: attach, snapshotOf: snapshotOf, restorePlan: restorePlan, docksNow: docksNow };
})(typeof window !== "undefined" ? window : globalThis);
