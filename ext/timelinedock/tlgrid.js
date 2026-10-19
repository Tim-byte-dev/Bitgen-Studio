/* bitGen Studio — ext/timelinedock/tlgrid.js (2.445.0): THE GRID ON THE TIMELINE'S PREVIEW CANVAS, its ⊞ button and the
 * ⚙ Timeline settings' Grids & Guides tab, window.TlGrid.
 *
 * Tim (verbatim): "Add a grid toggle button to the top toolbar in video docker and image editor docker ... in the image
 * editor settings dialog and video docker settings dialog add a tab for grids/guides, grid spacing, major grid spacing,
 * lines or dots, grid color, guideline color, guideline snap distance." ("video docker" = the timeline's preview canvas.)
 *   ⊞ in the timeline's menu bar (beside 🧰) shows / hides the grid over the preview canvas (the picture's pixels -
 *   static/gridspec.js H3Grid draws it at the canvas' zoom: lines or dots, major lines, its colour).
 *   ⚙ Timeline settings ▸ Grids & Guides: H3Grid's tab (spacing, major every n, lines / dots, grid colour + strength,
 *   guideline colour, snap distance) + "Show the grid"; kept in the settings file (custom.settings ui.tl_grid - the same
 *   for every browser), the button's on / off too.
 *
 * 2.446.0 (the same message: "add rulers, guidelines and grid to the preview canvas in video docker too (like how
 * coreldraw impliments them)"): 📏 (beside ⊞) shows RULERS along the top and left of the preview canvas, in picture
 * pixels from the picture's top-left (they follow the zoom and the pan). Drag from a ruler onto the canvas = a GUIDELINE
 * (top ruler: horizontal, left ruler: vertical); drag a guideline to move it, back onto its ruler to remove it; double-
 * click it to type its place. Guidelines belong to the timeline (tl.guides, saved with it), drawn in the guideline colour.
 * MOVING a layer with the Move tool SNAPS its edges / centre to the guidelines, the picture's edges / centre and (when
 * the grid shows) the grid, within the snap distance (Alt = no snapping). Kept: ui.tl_rulers.
 * Pure (Node: scripts/test-tlrulers.js): rulerStep, snapAxis, snapBox, guideAt.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  /* ================================ pure (2.446.0) ================================ */
  /** the ruler's numbered tick spacing (picture px) at zoom z: 1-2-5 steps, at least 60 screen px apart */
  function rulerStep(z) { var zz = z > 0 ? z : 1, steps = [1, 2, 5]; for (var e = 0; e < 7; e++) for (var i = 0; i < 3; i++) { var v = steps[i] * Math.pow(10, e); if (v * zz >= 60) return v; } return 1e7; }
  /** the nearest target within tol to any of the candidate values -> {d (the shift), v (the target)} or null */
  function snapAxis(cands, targets, tol) {
    var best = null;
    for (var i = 0; i < cands.length; i++) for (var j = 0; j < targets.length; j++) {
      var d = targets[j] - cands[i]; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, v: targets[j] };
    }
    return best;
  }
  /** a moved box {cx, cy, w, h} (picture px) snapped: its left / centre / right to xs, top / centre / bottom to ys */
  function snapBox(b, xs, ys, tol) {
    var sx = snapAxis([b.cx - b.w / 2, b.cx, b.cx + b.w / 2], xs, tol), sy = snapAxis([b.cy - b.h / 2, b.cy, b.cy + b.h / 2], ys, tol);
    return { dx: sx ? sx.d : 0, dy: sy ? sy.d : 0, x: sx ? sx.v : null, y: sy ? sy.v : null };
  }
  /** the guideline under a picture point (within tol picture px): its index, or -1 */
  function guideAt(guides, x, y, tol) {
    var best = -1, bd = Infinity;
    for (var i = 0; i < (guides || []).length; i++) { var g = guides[i], d = Math.abs(g.o === "h" ? y - g.p : x - g.p); if (d <= tol && d < bd) { bd = d; best = i; } }
    return best;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { rulerStep: rulerStep, snapAxis: snapAxis, snapBox: snapBox, guideAt: guideAt }; return; }
  var GR = window.H3Grid;
  if (!GR || !$("tlbar")) return;
  function spec() { var u = (typeof cfg === "object" && cfg && cfg.ui) || {}; return GR.clean(u.tl_grid || {}); }
  function save(ui) {
    try { if (typeof cfg === "object" && cfg) cfg.ui = Object.assign({}, cfg.ui || {}, ui); } catch (e) { /* next load */ }
    return fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ui: ui }) }).catch(function () { /* kept in the page */ });
  }
  function redraw() { paintBtn(); if (window.TlCanvas && TlCanvas.mark) TlCanvas.mark(); }

  /* ---- ⊞ in the timeline's menu bar */
  var btn = null;
  function paintBtn() { if (!btn) return; var on = spec().on; btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); }
  function toggle(want) {
    var s = spec(); s.on = typeof want === "boolean" ? want : !s.on;
    save({ tl_grid: s }); redraw();
    return s.on;
  }
  function addBtn() {
    var bar = $("tlbar"); if (!bar || $("tlGridBtn")) return;
    btn = document.createElement("button");
    btn.className = "ghost"; btn.id = "tlGridBtn"; btn.type = "button"; btn.textContent = "⊞";
    btn.title = "Grid over the preview canvas on / off - spacing, major lines, lines or dots, colours: ⚙ ▸ Grids & Guides";
    btn.setAttribute("aria-label", "Grid");
    btn.addEventListener("click", function () { toggle(); });
    var after = $("tlFloatTog") || $("tlStageTog");
    if (after && after.parentNode === bar) bar.insertBefore(btn, after.nextSibling); else bar.insertBefore(btn, bar.firstChild);
    paintBtn();
  }

  /* ---- the grid on the canvas (screen units: the picture at view.ox / oy, view.z screen px per picture px) */
  function hook() {
    if (!window.TlCanvas || !TlCanvas.onDraw) return false;
    TlCanvas.onDraw(function (g, h) {
      var s = spec();
      if (s.on && h.W && h.H) { var v = h.view; GR.draw(g, s, { x: v.ox, y: v.oy, w: h.W * v.z, h: h.H * v.z }, v.z, { lineWidth: 1, viewZoom: v.z }); }
      try { drawGuides(g, h); paintRulers(h); } catch (e) { /* never breaks the canvas */ }
    });
    return true;
  }

  /* ---- ⚙ Timeline settings ▸ Grids & Guides */
  function addTab() {
    if (!window.TimelineSettings || !TimelineSettings.addTab) return;
    TimelineSettings.addTab({ id: "grid", label: "Grids & Guides",
      html: function () { return GR.tabHtml(spec(), "tlg") + '<label class="h3gr-row" style="margin-top:8px"><span>Show the grid</span><input type="checkbox" id="tlgOn"></label>'; },
      open: function (d) {
        var s = spec(), set = function (k, v) { var el = d.querySelector("#tlg" + k); if (el) el.value = v; };
        set("Sp", s.spacing); set("Mj", s.major); set("St", s.style); set("Gc", s.color); set("Go", Math.round(s.opacity * 100)); set("Gd", s.guideColor); set("Sn", s.snap);
        var on = d.querySelector("#tlgOn"); if (on) on.checked = s.on;
      },
      read: function (d) { var s = GR.readTab(d, "tlg", spec()); s.on = !!(d.querySelector("#tlgOn") || {}).checked; return { ui: { tl_grid: s } }; },
      saved: function () { redraw(); } });
  }

  /* ================================ 2.446.0: rulers, guidelines, snapping ================================ */
  var RW = 18;                                                       // the rulers' thickness (screen px)
  function rulersOn() { var u = (typeof cfg === "object" && cfg && cfg.ui) || {}; return !!u.tl_rulers; }
  function guides() { if (typeof tl !== "object" || !tl) return []; if (!Array.isArray(tl.guides)) tl.guides = []; return tl.guides; }
  function keepGuides() { if (typeof tlSave === "function") tlSave(); }
  var rbtn = null, rt = null, rl = null, live = null;               // live = a guideline being dragged {o, p, i (moved one) | -1 (new)}
  function paintRBtn() { if (!rbtn) return; var on = rulersOn(); rbtn.classList.toggle("on", on); rbtn.setAttribute("aria-pressed", on ? "true" : "false"); }
  function toggleRulers(want) { var on = typeof want === "boolean" ? want : !rulersOn(); save({ tl_rulers: on }); paintRBtn(); placeRulers(); redraw(); return on; }
  function addRBtn() {
    var bar = $("tlbar"); if (!bar || $("tlRulerBtn")) return;
    rbtn = document.createElement("button");
    rbtn.className = "ghost"; rbtn.id = "tlRulerBtn"; rbtn.type = "button"; rbtn.textContent = "📏";
    rbtn.title = "Rulers on the preview canvas - drag from a ruler for a guideline (back onto it removes it); moved layers snap to the guidelines";
    rbtn.setAttribute("aria-label", "Rulers");
    rbtn.addEventListener("click", function () { toggleRulers(); });
    var after = $("tlGridBtn"); if (after && after.parentNode === bar) bar.insertBefore(rbtn, after.nextSibling); else bar.appendChild(rbtn);
    paintRBtn();
  }
  function wrap() { return $("tlCanvasWrap"); }
  function S() { return window.TlCanvas ? TlCanvas.state : null; }
  function placeRulers() {
    var w = wrap(); if (!w) return;
    if (!rt) {
      var css = document.createElement("style"); css.id = "tlRulerCss";
      css.textContent = "#tlCanvasWrap .tlruler{position:absolute;z-index:4;background:rgba(20,18,15,.92);cursor:pointer}#tlCanvasWrap .tlruler.h{left:0;right:0;top:0;height:" + RW + "px;cursor:row-resize}"
        + "#tlCanvasWrap .tlruler.v{top:0;bottom:0;left:0;width:" + RW + "px;cursor:col-resize}#tlCanvasWrap .tlruler canvas{display:block;width:100%;height:100%}";
      document.head.appendChild(css);
      rt = document.createElement("div"); rt.className = "tlruler h"; rt.id = "tlRulerTop"; rt.innerHTML = "<canvas></canvas>";
      rl = document.createElement("div"); rl.className = "tlruler v"; rl.id = "tlRulerLeft"; rl.innerHTML = "<canvas></canvas>";
      w.appendChild(rt); w.appendChild(rl);
      rt.addEventListener("pointerdown", function (e) { startNew("h", e); });
      rl.addEventListener("pointerdown", function (e) { startNew("v", e); });
    }
    var on = rulersOn(); rt.style.display = on ? "" : "none"; rl.style.display = on ? "" : "none";
  }
  function paintRulers(h) {
    if (!rt || !rulersOn()) return;
    var v = h.view, step = rulerStep(v.z), gs = spec();
    [[rt, "h"], [rl, "v"]].forEach(function (pair) {
      var el = pair[0], c = el.firstChild, r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
      g.fillStyle = "#9a917f"; g.strokeStyle = "#6f6756"; g.font = "9px system-ui, sans-serif"; g.lineWidth = 1;
      var horiz = pair[1] === "h", len = horiz ? r.width : r.height, o = horiz ? v.ox : v.oy;
      var first = Math.floor(-o / v.z / (step / 5)) * (step / 5);
      g.beginPath();
      for (var p = first; p * v.z + o <= len; p += step / 5) {
        var at = Math.round(p * v.z + o) + 0.5, big = Math.abs(p / step - Math.round(p / step)) < 1e-6;
        if (horiz) { g.moveTo(at, RW); g.lineTo(at, big ? 4 : RW - 5); if (big) g.fillText(String(Math.round(p)), at + 2, 9); }
        else { g.moveTo(RW, at); g.lineTo(big ? 4 : RW - 5, at); if (big) { g.save(); g.translate(9, at - 2); g.rotate(-Math.PI / 2); g.fillText(String(Math.round(p)), 0, 0); g.restore(); } }
      }
      g.stroke();
      // the guidelines' marks on their ruler
      g.fillStyle = gs.guideColor;
      guides().forEach(function (q) { if ((q.o === "v") !== horiz) return; var a = q.p * v.z + o; if (horiz) g.fillRect(a - 1, 0, 2, RW); else g.fillRect(0, a - 1, RW, 2); });
    });
  }
  /* a guideline dragged out of a ruler / moved / dropped back onto a ruler */
  function compAt(e) { var s = S(), c = $("tlCanvas"); if (!s || !c) return null; var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left - s.view.ox) / s.view.z, y: (e.clientY - r.top - s.view.oy) / s.view.z, sx: e.clientX - r.left, sy: e.clientY - r.top }; }
  function overRuler(e, o) { var el = o === "h" ? rt : rl; if (!el || el.style.display === "none") return false; var r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
  function drag(o, i, e) {
    e.preventDefault(); e.stopPropagation();
    live = { o: o, i: i, p: null };
    var mv = function (ev) { var p = compAt(ev); if (!p) return; live.p = Math.round(o === "h" ? p.y : p.x); live.off = overRuler(ev, o); redraw(); };
    var up = function (ev) {
      window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
      var L = guides(), p = live.p, gone = overRuler(ev, o) || p == null;
      if (live.i >= 0) { if (gone) L.splice(live.i, 1); else L[live.i].p = p; }
      else if (!gone) L.push({ o: o, p: p });
      live = null; keepGuides(); redraw();
      if (window.TlCanvas && TlCanvas.say) TlCanvas.say(gone ? (i >= 0 ? "guideline removed" : "") : (o === "h" ? "horizontal" : "vertical") + " guideline at " + p + " px");
    };
    window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
    mv(e);
  }
  function startNew(o, e) { if (e.button !== 0) return; drag(o, -1, e); }
  function hookGuides() {
    var w = wrap(); if (!w || w._tlg) return; w._tlg = true;
    // a guideline under the pointer (Move tool) is picked before the canvas picks a layer
    w.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest(".tlruler")) return;
      var s = S(); if (!s || s.tool !== "move" || s.spaceHand) return;
      var p = compAt(e); if (!p) return;
      var i = guideAt(guides(), p.x, p.y, 4 / s.view.z); if (i < 0) return;
      drag(guides()[i].o, i, e);
    }, true);
    w.addEventListener("dblclick", function (e) {
      var s = S(); if (!s) return; var p = compAt(e); if (!p) return;
      var i = guideAt(guides(), p.x, p.y, 4 / s.view.z); if (i < 0) return;
      e.stopPropagation();
      var g = guides()[i], v = window.prompt((g.o === "h" ? "Horizontal" : "Vertical") + " guideline at (px) - empty removes it", String(g.p));
      if (v == null) return;
      if (String(v).trim() === "") guides().splice(i, 1); else if (isFinite(+v)) g.p = Math.round(+v);
      keepGuides(); redraw();
    }, true);
    w.addEventListener("pointermove", function (e) {
      if (live) return; var s = S(); if (!s || s.tool !== "move" || s.drag) return;
      var p = compAt(e); if (!p) return;
      var i = guideAt(guides(), p.x, p.y, 4 / s.view.z);
      if (i >= 0) $("tlCanvas").style.cursor = guides()[i].o === "h" ? "row-resize" : "col-resize";
    });
  }
  function drawGuides(g, h) {
    var v = h.view, gs = spec(), list = guides().slice();
    if (live && live.p != null && !live.off) list = list.filter(function (q, k) { return k !== live.i; }).concat([{ o: live.o, p: live.p, live: true }]);
    else if (live && live.i >= 0) list = list.filter(function (q, k) { return k !== live.i; });
    if (!list.length) return;
    var c = $("tlCanvas"), cw = c ? c.clientWidth : 4000, ch = c ? c.clientHeight : 4000;
    g.save(); g.lineWidth = 1;
    list.forEach(function (q) {
      g.strokeStyle = gs.guideColor; g.setLineDash(q.live ? [5, 4] : []);
      g.beginPath();
      if (q.o === "h") { var y = Math.round(v.oy + q.p * v.z) + 0.5; g.moveTo(0, y); g.lineTo(cw, y); }
      else { var x = Math.round(v.ox + q.p * v.z) + 0.5; g.moveTo(x, 0); g.lineTo(x, ch); }
      g.stroke();
    });
    g.restore();
  }
  /** canvas.js asks this while a layer is MOVED: b = the moved box (picture px) -> {dx, dy} to add (or null) */
  function snapMove(b, z, ev) {
    if (ev && ev.altKey) return null;
    var s = S(); if (!s) return null;
    var gs = spec(), xs = [0, s.W / 2, s.W], ys = [0, s.H / 2, s.H];
    guides().forEach(function (q) { (q.o === "h" ? ys : xs).push(q.p); });
    if (gs.on) {
      var st = GR.stepFor(gs, z);
      for (var x = st; x < s.W; x += st) xs.push(x);
      for (var y = st; y < s.H; y += st) ys.push(y);
    }
    var r = snapBox(b, xs, ys, gs.snap / (z || 1));
    lastSnap = r.x != null || r.y != null ? r : null;
    return r;
  }
  var lastSnap = null;

  function boot() {
    addBtn(); addTab(); addRBtn(); placeRulers(); hookGuides();
    if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 50) clearInterval(t); }, 200); }
    // the settings file lands after the page: the button follows it
    var k = 0, w = setInterval(function () { paintBtn(); paintRBtn(); placeRulers(); if ((typeof cfg === "object" && cfg && cfg.ui) || ++k > 40) { clearInterval(w); redraw(); } }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.TlGrid = { spec: spec, toggle: toggle, save: save, redraw: redraw, rulers: toggleRulers, rulersOn: rulersOn, guides: guides, snapMove: snapMove,
    lastSnap: function () { return lastSnap; }, rulerStep: rulerStep, snapAxis: snapAxis, snapBox: snapBox, guideAt: guideAt };
})();
