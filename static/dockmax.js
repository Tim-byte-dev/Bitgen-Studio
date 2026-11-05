/* bitGen Studio — static/dockmax.js (2.658.0): ⛶ MAXIMIZE THAT KNOWS WHERE THE DOCKER IS - window.H3DockMax.
 *
 * Tim (verbatim): "allow sketcher to be resized vertically when docked. when mamimize button is pressed in docked mode expand
 * to fill empty space dockers that are docked below will be pushed downwards. when maximazi is pressed when it is floating
 * then maximize normally and close other dockers. do the same for timeline and image editor"
 *
 *   For the Sketcher (pushpulldock), the Timeline (timelinedock) and the Image editor (imageeditdock):
 *   DOCKED (in the main column)  ⛶ = the docker grows to the column's whole visible height; the dockers below keep their
 *                                own heights and are pushed down (the column scrolls), the ones above scroll out of view;
 *                                the column scrolls to the docker's top. 🗗 / Esc = back as it was.
 *   FLOATING (anywhere else)     ⛶ = the whole window between the title bar and the status bar, the other dockers closed;
 *                                🗗 / Esc = the layout before (static/dockfull.js for the timeline / image editor; the
 *                                Sketcher's own ext/pushpulldock/ppframe.js)
 *   The page's toggleMax (static/index.html) still does the maximize (the 🗗 button, Esc, docker_status.json); this wraps it
 *   to pick the mode first: the docker's data-dm-mode = "push" | "full", #maincol.dm-push + --dm-h (the column's height).
 *   (The Sketcher's height in the column: --pph and its own bottom handle, 2.658.0 - static/index.html DOCK_VARS.)
 * Pure (Node: scripts/test-dockmax658.js): modeFor(inColumn), pushHeight(colHeight, padTop, padBottom).
 */
(function (root) {
  "use strict";
  var IDS = ["pushpulldock", "timelinedock", "imageeditdock"];
  /** the mode a maximize takes: in the main column = "push", anywhere else (floating, in a ▣ docker, a side column) = "full" */
  function modeFor(inColumn) { return inColumn ? "push" : "full"; }
  /** the height a pushed docker takes: the column's visible height less its padding (120 at least) */
  function pushHeight(colH, padT, padB) { return Math.max(120, Math.round((+colH || 0) - (+padT || 0) - (+padB || 0))); }
  if (typeof module !== "undefined" && module.exports && !root.document) { module.exports = { IDS: IDS, modeFor: modeFor, pushHeight: pushHeight }; return; }

  var doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  /** docked = a child of the main column (directly, or in a row beside the prompt docker) */
  function inColumn(el) {
    var col = $("maincol"); if (!col || !el) return false;
    var p = el.parentElement;
    if (p === col) return true;
    return !!(p && p.classList && p.classList.contains("pf-row") && p.parentElement === col);
  }
  function css() {
    if ($("dmCss")) return;
    var st = doc.createElement("style"); st.id = "dmCss";
    st.textContent = "#maincol.dm-push{overflow-y:auto!important}"
      + "#maincol.dm-push>*{flex-shrink:0!important}"
      + "#maincol.dm-push #videodock:not(.maxed):not(.collapsed){flex:0 0 var(--dm-vh,280px)!important;height:var(--dm-vh,280px)!important}"
      + "#maincol.dm-push .bdock.maxed[data-dm-mode=push]{flex:0 0 var(--dm-h)!important;height:var(--dm-h)!important;min-height:var(--dm-h)!important}";
    doc.head.appendChild(st);
  }
  function fit() {
    var col = $("maincol"); if (!col) return;
    var m = col.querySelector(".bdock.maxed[data-dm-mode=push]");
    if (!m) { col.classList.remove("dm-push"); col.style.removeProperty("--dm-h"); col.style.removeProperty("--dm-vh"); return; }
    var cs = root.getComputedStyle(col);
    // its own bottom handle stays in view (its room taken off), so the docker below starts at the column's bottom
    var sp = m.nextElementSibling, seam = 0;
    if (sp && sp.classList && sp.classList.contains("hsplit")) { var ss = root.getComputedStyle(sp); seam = sp.offsetHeight + (parseFloat(ss.marginTop) || 0) + (parseFloat(ss.marginBottom) || 0); }
    col.style.setProperty("--dm-h", pushHeight(col.clientHeight, parseFloat(cs.paddingTop), parseFloat(cs.paddingBottom) + seam) + "px");
    col.classList.add("dm-push");
  }
  /** a switch for the tests of the older column maximize (scripts/test-dockstatus-ui.js): localStorage h3.dockmax.off = "1" */
  function off() { try { return root.localStorage.getItem("h3.dockmax.off") === "1"; } catch (e) { return false; } }
  function install() {
    if (typeof root.toggleMax !== "function" || root.toggleMax._dm) return false;
    css();
    var orig = root.toggleMax;
    var wrapped = function (id, force) {
      var el = $(id);
      if (el && IDS.indexOf(id) !== -1 && !off()) {
        var on = force != null ? !!force : !el.classList.contains("maxed");
        if (on) {
          el.dataset.dmMode = modeFor(inColumn(el));
          // the elastic StoryBoard keeps the height it shows now (the page would fix it at its --vh while another is maximized)
          var vd = $("videodock"), col0 = $("maincol");
          if (el.dataset.dmMode === "push" && vd && col0 && vd !== el) col0.style.setProperty("--dm-vh", Math.max(30, Math.round(vd.getBoundingClientRect().height)) + "px");
        }
      }
      var r = orig.apply(this, arguments);
      fit();
      if (off() && el) delete el.dataset.dmMode;
      if (el && el.classList.contains("maxed") && el.dataset.dmMode === "push") {
        try { el.scrollIntoView({ block: "start" }); } catch (e) { /* old */ }
        try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* jsdom */ }
      }
      if (root.H3TestEvent && el && IDS.indexOf(id) !== -1) { try { root.H3TestEvent("dockmax", (el.classList.contains("maxed") ? el.dataset.dmMode : "off") + ":" + id); } catch (e) { /* the 🧪 list */ } }
      return r;
    };
    wrapped._dm = true;
    root.toggleMax = wrapped;
    // any other way out of a maximize (a collapse, a hide, the page's own Esc) - the column back to normal
    IDS.forEach(function (id) {
      var el = $(id); if (!el) return;
      try { new root.MutationObserver(function () { if (!el.classList.contains("maxed")) { fit(); } }).observe(el, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* old */ }
    });
    root.addEventListener("resize", function () { var col = $("maincol"); if (col && col.classList.contains("dm-push")) fit(); });
    // the timeline / image editor floating = the whole window, the others closed (the Sketcher does it itself)
    if (root.H3DockFull) ["timelinedock", "imageeditdock"].forEach(function (id) { if ($(id)) root.H3DockFull.attach(id, { engage: function (d) { return d.dataset.dmMode === "full"; } }); });
    return true;
  }
  var tries = 0;
  (function boot() { if (install() || ++tries > 60) return; setTimeout(boot, 500); })();
  root.H3DockMax = { IDS: IDS, modeFor: modeFor, pushHeight: pushHeight, inColumn: inColumn, fit: fit, install: install };
})(typeof window !== "undefined" ? window : globalThis);
