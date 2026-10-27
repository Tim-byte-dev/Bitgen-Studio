/* bitGen Studio — ext/timelinedock/tlrange.js (2.603.0): A RANGE ON ONE LAYER - the marker, then Shift+click - and the
 * timeline's UNDO (window.TlRange).
 *
 * Tim (verbatim): "selecting range in timeline is not intuitive. lets drag the timeline marker to the start of the range
 * then shift+click on a different part of the layer and that will be our range in that layer - cut will remove the
 * range in the selected layer only completely(must be able to undo)".
 *
 *   SHIFT+CLICK   on a layer's track (on a clip or between them): the range runs from the position marker to the click,
 *                 on THAT layer (it is highlighted - the range is drawn on its row). Shift+drag = the end follows the
 *                 pointer. No marker yet = the press point is the start (the old Shift+drag). The range is tl.sel with
 *                 layer: true - ✂ Cut (and ⇥ Keep) then edit the WHOLE range on that layer only (scope "layer", whatever
 *                 the scope box says); ripple as its box says.
 *   UNDO          every change to the timeline's content is remembered (tlSave is the one door every edit goes through;
 *                 a burst within 400 ms - a drag - is one step; the selection and the highlighted layer are not edits):
 *                 ↶ / ↷ in the timeline's menu bar, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y over the timeline's layers. 80 steps;
 *                 switching to another saved timeline starts a fresh history.
 * Pure (Node): rangeOf(anchor, t, fps) -> {a, b} | null, Hist (push / undo / redo).
 */
(function (root) {
  "use strict";
  var FPS0 = 24;
  function rangeOf(anchor, t, fps) {
    var f = fps || FPS0, a = Math.max(0, Math.min(anchor, t)), b = Math.max(0, Math.max(anchor, t));
    a = Math.round(a * f) / f; b = Math.round(b * f) / f;
    return b - a < 1 / f - 1e-9 ? null : { a: a, b: b };
  }
  /** an undo history of strings: push(before) after a change; undo(now) -> the state to go back to; redo(now) */
  function Hist(max) {
    var U = [], R = [], lim = max || 80;
    return {
      push: function (s) { U.push(s); if (U.length > lim) U.shift(); R.length = 0; },
      undo: function (now) { if (!U.length) return null; R.push(now); return U.pop(); },
      redo: function (now) { if (!R.length) return null; U.push(now); return R.pop(); },
      clear: function () { U.length = 0; R.length = 0; },
      sizes: function () { return [U.length, R.length]; }
    };
  }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { rangeOf: rangeOf, Hist: Hist }; return; }

  function $(id) { return document.getElementById(id); }
  function g(name) { try { return root[name]; } catch (e) { return undefined; } }
  function fps() { try { return typeof TLFPS === "number" ? TLFPS : FPS0; } catch (e) { return FPS0; } }
  function pxs() { try { return PXS; } catch (e) { return 40; } }
  function labw() { try { return LABW; } catch (e) { return 0; } }
  function tlObj() { try { return tl; } catch (e) { return null; } }
  function ph() { try { return typeof playhead === "number" && isFinite(playhead) ? playhead : null; } catch (e) { return null; } }
  function say(t) { try { if (root.TlCanvas && TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function label(lk) { try { return typeof lkLabel === "function" ? lkLabel(lk) : lk; } catch (e) { return lk; } }

  /* ---------------- the layer range ---------------- */
  var CSS = ".tlrsel{position:absolute;top:1px;bottom:1px;z-index:4;pointer-events:none;background:rgba(245,158,44,.30);"
    + "border:2px solid var(--tiger,#f59e2c);border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.4)}"
    + ".tlrsel .lab{position:absolute;left:3px;top:-1px;font:600 .62rem var(--mono,monospace);color:#ffd9a0;text-shadow:0 1px 2px #000;white-space:nowrap}"
    + ".tlsel.tlsel-layer{background:rgba(245,158,44,.05)}"
    + "#tlinner.tlshift .tltrack{cursor:col-resize}";
  function css() { if ($("tlrangeCss")) return; var s = document.createElement("style"); s.id = "tlrangeCss"; s.textContent = CSS; document.head.appendChild(s); }
  function trackOf(lk) { var inner = $("tlinner"); return inner ? inner.querySelector('.tltrack[data-lk="' + (root.CSS && root.CSS.escape ? root.CSS.escape(lk) : lk) + '"]') : null; }
  /** draw the range on its layer's row (after every render, and when the highlighted layer changes) */
  function paintRow() {
    css();
    var inner = $("tlinner"); if (!inner) return;
    inner.querySelectorAll(".tlrsel").forEach(function (x) { x.remove(); });
    var T = tlObj(), s = T && T.sel;
    var band = inner.querySelector(".tlsel"); if (band) band.classList.toggle("tlsel-layer", !!(s && s.layer));
    if (!s || !s.layer || !T.selLayer) return;
    var tr = trackOf(T.selLayer); if (!tr) return;
    var d = document.createElement("div"); d.className = "tlrsel";
    d.style.left = (labw() + s.a * pxs()) + "px"; d.style.width = Math.max(2, (s.b - s.a) * pxs()) + "px";
    d.innerHTML = '<span class="lab"></span>';
    d.querySelector(".lab").textContent = label(T.selLayer) + " " + (s.b - s.a).toFixed(2) + " s";
    d.title = "The range on " + label(T.selLayer) + " - ✂ Cut removes it from this layer only (Ctrl+Z undoes)";
    tr.appendChild(d);
  }
  function wrap(name, after) {
    var f = g(name); if (typeof f !== "function" || f._tlrange) return false;
    var w = function () { var r = f.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { /* the timeline still works */ } return r; };
    w._tlrange = true; root[name] = w; return true;
  }

  var drag = null, fresh = false;
  function onDown(e) {
    if (!e.shiftKey || e.button !== 0) return;
    var inner = e.target && e.target.closest && e.target.closest("#tlinner"); if (!inner) return;
    var tr = e.target.closest(".tltrack[data-lk]");
    if (!tr || e.target.closest(".tlab, button, input, select, [contenteditable], .cx, .sh, #playhead, #playcursor, .mchip, .tlruler")) return;   // a clip's trim handles too (a narrow clip is all handles)
    e.preventDefault(); e.stopImmediatePropagation();
    var lk = tr.dataset.lk, rect = inner.getBoundingClientRect();
    var tAt = function (ev) { return Math.max(0, (ev.clientX - rect.left - labw()) / pxs()); };
    var t0 = tAt(e), anchor = ph(); if (anchor == null) anchor = t0;
    if (typeof pickLayer === "function") pickLayer(lk);
    css();
    var band = document.createElement("div"); band.className = "tlrsel";
    band.innerHTML = '<span class="lab"></span>'; tr.appendChild(band);
    drag = { lk: lk, anchor: anchor, t: t0, band: band, tr: tr };
    var paint = function () {
      var a = Math.min(drag.anchor, drag.t), b = Math.max(drag.anchor, drag.t);
      band.style.left = (labw() + a * pxs()) + "px"; band.style.width = Math.max(2, (b - a) * pxs()) + "px";
      band.querySelector(".lab").textContent = label(lk) + " " + (b - a).toFixed(2) + " s";
    };
    paint();
    var mv = function (ev) { drag.t = tAt(ev); paint(); };
    var up = function () {
      window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
      var d = drag; drag = null; band.remove();
      var r = rangeOf(d.anchor, d.t, fps());
      if (!r) { say("Range: drag the position marker to the range's start, then Shift+click where it ends on the layer"); return; }
      if (typeof setSel === "function") setSel(r.a, r.b);
      var T = tlObj();
      if (T && T.sel) { T.sel.layer = true; T.selLayer = d.lk; if (typeof tlSave === "function") tlSave(); if (typeof renderTimeline === "function") renderTimeline(); }
      say("Range " + r.a.toFixed(2) + " – " + r.b.toFixed(2) + " s on " + label(d.lk) + " - ✂ Cut removes it from " + label(d.lk) + " only (Ctrl+Z undoes)");
      if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_range", d.lk);
    };
    window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
  }
  function onKeyShift(e) { var inner = $("tlinner"); if (inner) inner.classList.toggle("tlshift", !!e.shiftKey); }

  /* ---------------- undo ---------------- */
  var H = Hist(80), last = null, lastAt = 0, restoring = false, forName = null;
  function content() {
    var T = tlObj(); if (!T) return "";
    var keep = { sel: T.sel, selLayer: T.selLayer };
    T.sel = undefined; T.selLayer = undefined;
    try { return JSON.stringify(T); } finally { T.sel = keep.sel; T.selLayer = keep.selLayer; }
  }
  function curName() { try { return typeof tlName === "string" ? tlName : ""; } catch (e) { return ""; } }
  function track() {
    if (restoring) return;
    var now = content();
    if (forName !== curName()) { H.clear(); forName = curName(); last = now; paintBtns(); return; }
    if (last === null) { last = now; return; }
    if (now === last) return;
    if (Date.now() - lastAt > 400) H.push(last);     // a burst (a drag) is one step: its first "before"
    lastAt = Date.now(); last = now; paintBtns();
  }
  function restore(s) {
    var T = tlObj(); if (!T || s == null) return false;
    var keep = { sel: T.sel, selLayer: T.selLayer }, o = JSON.parse(s);
    o.sel = keep.sel; o.selLayer = keep.selLayer;
    restoring = true;
    try { tl = o; if (typeof tlSave === "function") tlSave(); if (typeof renderTimeline === "function") renderTimeline(); }
    finally { restoring = false; }
    last = s; lastAt = 0; paintBtns();
    return true;
  }
  function undo() { var s = H.undo(content()); if (s == null) { say("↶ nothing to undo on the timeline"); return false; } restore(s); say("↶ undone"); return true; }
  function redo() { var s = H.redo(content()); if (s == null) { say("↷ nothing to redo"); return false; } restore(s); say("↷ redone"); return true; }
  function paintBtns() {
    var n = H.sizes(), u = $("tlUndo"), r = $("tlRedo");
    if (u) { u.disabled = !n[0]; u.title = "Undo the last timeline edit (Ctrl+Z) - " + n[0] + " step(s)"; }
    if (r) { r.disabled = !n[1]; r.title = "Redo (Ctrl+Shift+Z / Ctrl+Y) - " + n[1] + " step(s)"; }
  }
  function buttons() {
    if ($("tlUndo")) return;
    var ref = $("tlClear"); if (!ref) return;
    var mk = function (id, txt) { var b = document.createElement("button"); b.className = "ghost"; b.id = id; b.type = "button"; b.textContent = txt; return b; };
    var u = mk("tlUndo", "↶"), r = mk("tlRedo", "↷");
    u.setAttribute("aria-label", "Undo"); r.setAttribute("aria-label", "Redo");
    u.onclick = undo; r.onclick = redo;
    ref.parentNode.insertBefore(u, ref); ref.parentNode.insertBefore(r, ref);
    paintBtns();
  }
  function typing() { var a = document.activeElement; return !!(a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))); }
  function onKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || typing()) return;
    var k = String(e.key).toLowerCase(); if (k !== "z" && k !== "y") return;
    var on = root.TlKeys && TlKeys.onLayers ? TlKeys.onLayers() : false; if (!on) return;
    e.preventDefault(); e.stopPropagation();
    if (k === "y" || e.shiftKey) redo(); else undo();
  }

  function boot() {
    if (typeof g("tlSave") !== "function" || typeof g("renderTimeline") !== "function" || !$("tlinner") || !$("tlClear")) { setTimeout(boot, 120); return; }
    wrap("tlSave", track);
    wrap("renderTimeline", paintRow);
    wrap("pickLayer", function () { var T = tlObj(); if (T && T.sel && T.sel.layer) paintRow(); });
    // a layer range stays one when its ends are moved (the band's handles, I / O, ⟦ In / Out ⟧); a new ruler drag is not one
    var ss = g("setSel");
    if (typeof ss === "function" && !ss._tlrange) {
      var w = function () { var T = tlObj(), was = !!(T && T.sel && T.sel.layer) && !fresh; var r = ss.apply(this, arguments); T = tlObj(); if (was && T && T.sel && !T.sel.layer) { T.sel.layer = true; paintRow(); } return r; };
      w._tlrange = true; root.setSel = w;
    }
    var ds = g("dragSelect");
    if (typeof ds === "function" && !ds._tlrange) {
      var w2 = function () { fresh = true; var T = tlObj(); if (T && T.sel) T.sel.layer = false; try { return ds.apply(this, arguments); } finally { setTimeout(function () { fresh = false; }, 0); } };
      w2._tlrange = true; root.dragSelect = w2;
    }
    forName = curName(); last = content();
    buttons();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKeyShift, true); document.addEventListener("keyup", onKeyShift, true);
    window.addEventListener("blur", function () { var inner = $("tlinner"); if (inner) inner.classList.remove("tlshift"); });
    document.addEventListener("keydown", onKey, true);
    var cut = $("tlCutSel"); if (cut) cut.title = "Cut the selection out. A layer range (the marker, then Shift+click on the layer) is cut from that layer only, completely; a ruler selection follows the scope box. Ctrl+Z undoes";
    paintRow();
  }
  root.TlRange = { rangeOf: rangeOf, Hist: Hist, undo: undo, redo: redo, sizes: function () { return H.sizes(); }, paintRow: paintRow };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
