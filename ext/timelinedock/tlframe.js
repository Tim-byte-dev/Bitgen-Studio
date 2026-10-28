/* bitGen Studio — ext/timelinedock/tlframe.js (2.611.0): ▯ FRAME - click a frame on a layer to select it, Del removes it.
 *
 * Tim (verbatim): "can we add a click frame to select frame and del button deletes it".
 *
 *   ▯ FRAME        a sixth edit tool beside ▸ Select / ⇤ / ⇹ / ⇆ / ↔ (the timeline's menu bar, or the F key over the
 *                  layers). With it on, a CLICK on a layer's track selects the ONE frame under the pointer on that layer
 *                  (the position marker jumps to it, the frame is outlined on its row). DRAG across = several frames;
 *                  SHIFT+click = from the selected frame to this one. Clips do not move in this tool.
 *   ← / →          the selection a frame back / on (Shift: its end) - exact at any zoom (a frame can be under a pixel).
 *   DEL / ⌫        over the layers: the selected frame(s) are cut out of THAT layer and the gap is closed (ripple),
 *                  whatever the ripple box says - one ↶ / Ctrl+Z puts them back. Esc drops the selection.
 *                  The cut is the timeline's own ✂ Cut (applySel → /api/timeline/edit, a layer range).
 * Pure (Node): frameAt(t, fps), span(f0, f1, fps), describe(sel, fps).
 */
(function (root) {
  "use strict";
  var FPS0 = 24;
  /** the frame a time is in (a time on a frame's edge belongs to the frame it starts) */
  function frameAt(t, fps) { var f = fps || FPS0; return Math.max(0, Math.floor((+t || 0) * f + 1e-6)); }
  /** frames f0..f1 (either order, both in) as a layer range {a, b, f0, n} */
  function span(f0, f1, fps) {
    var f = fps || FPS0, lo = Math.max(0, Math.min(f0, f1)), hi = Math.max(0, Math.max(f0, f1));
    return { a: lo / f, b: (hi + 1) / f, f0: lo, n: hi - lo + 1 };
  }
  /** "frame 12" / "frames 12–15 (4)" for a frame selection, "" for anything else */
  function describe(sel, fps) {
    if (!sel || !sel.frame) return "";
    var f = fps || FPS0, a = Math.round(sel.a * f), n = Math.max(1, Math.round((sel.b - sel.a) * f));
    return n === 1 ? "frame " + a : "frames " + a + "–" + (a + n - 1) + " (" + n + ")";
  }
  var api = { frameAt: frameAt, span: span, describe: describe };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = api; return; }

  function $(id) { return document.getElementById(id); }
  function fps() { try { return typeof TLFPS === "number" ? TLFPS : FPS0; } catch (e) { return FPS0; } }
  function pxs() { try { return PXS; } catch (e) { return 40; } }
  function labw() { try { return LABW; } catch (e) { return 0; } }
  function tlObj() { try { return tl; } catch (e) { return null; } }
  function label(lk) { try { return typeof lkLabel === "function" ? lkLabel(lk) : lk; } catch (e) { return lk; } }
  function say(t) { try { if (root.TlCanvas && TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function on() { return !!(root.TlEdit && TlEdit.mode() === "frame"); }
  function typing() { var a = document.activeElement; return !!(a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))); }
  function trackAt(x, y) {
    var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    for (var i = 0; i < list.length; i++) { var tr = list[i].closest && list[i].closest(".tltrack[data-lk]"); if (tr) return tr; }
    return null;
  }

  /* over the layers: TlKeys asks the element last entered - a repaint (each selection) replaces it, so the pointer's
     own spot is asked again here */
  var px = -1, py = -1;
  function overLayers() {
    if (root.TlKeys && TlKeys.onLayers && TlKeys.onLayers()) return true;
    var el = px >= 0 && document.elementFromPoint ? document.elementFromPoint(px, py) : null;
    return !!(el && el.closest && el.closest("#tlscroll, #tlinner") && el.closest("#timelinedock"));
  }
  var swallow = false;
  function onDown(e) {
    if (!on() || e.button !== 0) return;
    var inner = e.target && e.target.closest && e.target.closest("#tlinner"); if (!inner) return;
    if (e.target.closest(".tlab, button, input, select, [contenteditable], .cx, .kfd, .mchip, .tlruler, .phgrab")) return;
    var tr = e.target.closest(".tltrack[data-lk]") || (e.target.classList.contains("phline") ? trackAt(e.clientX, e.clientY) : null);
    if (!tr) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    swallow = true;
    var lk = tr.dataset.lk, rect = inner.getBoundingClientRect(), F = fps();
    var fAt = function (ev) { return frameAt((ev.clientX - rect.left - labw()) / pxs(), F); };
    var T = tlObj(), cur = T && T.sel;
    var f0 = fAt(e);
    if (e.shiftKey && cur && cur.frame && T.selLayer === lk) f0 = typeof cur.f0 === "number" ? cur.f0 : Math.round(cur.a * F);   // from the selected frame
    var f1 = fAt(e);
    var band = document.createElement("div"); band.className = "tlrsel tlfsel"; band.innerHTML = '<span class="lab"></span>'; tr.appendChild(band);
    var paint = function () {
      var s = span(f0, f1, F);
      band.style.left = (labw() + s.a * pxs()) + "px"; band.style.width = Math.max(2, (s.b - s.a) * pxs()) + "px";
      band.querySelector(".lab").textContent = "▯ " + describe({ frame: true, a: s.a, b: s.b }, F);
    };
    paint();
    var mv = function (ev) { var f = fAt(ev); if (f !== f1) { f1 = f; paint(); } };
    var up = function () {
      window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
      band.remove();
      setTimeout(function () { swallow = false; }, 0);
      select(lk, f0, f1);
    };
    window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
  }
  function onClick(e) { if (swallow && e.target.closest && e.target.closest("#tlinner")) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); swallow = false; } }

  /** select frames f0..f1 on layer lk (the marker goes to the first) */
  function select(lk, f0, f1) {
    var T = tlObj(); if (!T) return null;
    var F = fps(), s = span(f0, f1 == null ? f0 : f1, F);
    T.sel = { a: s.a, b: s.b, layer: true, frame: true, f0: s.f0 };
    if (typeof pickLayer === "function") { try { pickLayer(lk); } catch (x) { /* fine */ } }   // the layer highlighted (tl.selLayer)
    T.selLayer = lk;
    if (typeof tlSave === "function") tlSave();
    if (typeof tlSeek === "function") { try { tlSeek(s.a); } catch (x) { /* fine */ } }
    if (typeof renderTimeline === "function") renderTimeline();
    say("▯ " + describe(T.sel, F) + " on " + label(lk) + " - Del removes it (the gap closes), ← / → a frame on / back, Ctrl+Z undoes, Esc drops it"
      + (pxs() / F < 3 ? " · frames are tiny at this zoom - zoom in to pick one by eye" : ""));
    if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_frame", lk);
    return T.sel;
  }
  /** cut the selected frame(s) out of their layer, ripple on (one undo step) */
  async function remove() {
    var T = tlObj(), s = T && T.sel;
    if (!s || !s.frame || !T.selLayer) return false;
    var what = describe(s, fps()), lk = T.selLayer, rp = $("tlRipple"), was = rp ? rp.checked : false;
    if (typeof applySel !== "function") return false;
    if (rp) rp.checked = true;
    try { await applySel("cut"); } finally { if (rp) rp.checked = was; }
    if (T.sel && T.sel.frame) { T.sel = null; if (typeof tlSave === "function") tlSave(); if (typeof renderTimeline === "function") renderTimeline(); }
    say("▯ " + what + " removed from " + label(lk) + " - the rest moved up (Ctrl+Z undoes)");
    if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_frame_del", lk);
    return true;
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing() || document.querySelector("dialog[open]")) return;
    if (!overLayers()) return;
    var T = tlObj(), s = T && T.sel;
    if (!s || !s.frame) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {     // a frame on / back (Shift: the end grows / shrinks) - any zoom
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var F = fps(), a = Math.round(s.a * F), z = Math.max(a, Math.round(s.b * F) - 1), d = e.key === "ArrowLeft" ? -1 : 1;
      if (e.shiftKey) select(T.selLayer, a, Math.max(a, z + d)); else if (a + d >= 0) select(T.selLayer, a + d, z + d);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); remove(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); T.sel = null; if (typeof tlSave === "function") tlSave(); if (typeof renderTimeline === "function") renderTimeline(); }
  }
  function css() {
    if ($("tlframeCss")) return;
    var st = document.createElement("style"); st.id = "tlframeCss";
    st.textContent = "#tlinner[data-edit=frame] .tltrack{cursor:cell}#tlinner[data-edit=frame] .clip{cursor:cell}"
      + ".tlrsel.tlfsel{border-style:solid;background:rgba(245,158,44,.45);min-width:2px}";
    document.head.appendChild(st);
  }
  function boot() {
    if (!root.TlEdit || !$("tlinner")) { setTimeout(boot, 200); return; }
    css();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", function (e) { px = e.clientX; py = e.clientY; }, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
  }
  root.TlFrame = Object.assign({ select: select, remove: remove }, api);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
