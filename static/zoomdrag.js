/* bitGen Studio — static/zoomdrag.js (2.648.0): SHIFT + RIGHT-DRAG ZOOMS (window.H3ZoomDrag) - the Sketcher, the timeline's
 * canvas and the image editor share it.
 * Tim (verbatim): "add zoom control, shift + drag foward = zoom in, shift + drag back = zoom out, add a zoom to selection
 * tool, change the selection icon to a pointer. do these changes for sketcher,timeline and image editor" - the drag is
 * Shift + the RIGHT button (Tim's pick: Shift + left-drag already adds to a selection / keeps an axis / draws straight).
 *
 *   attach(el, {zoom(f, x, y, ev), start?(x, y, ev), end?(moved, ev), enabled?() -> bool}) -> detach()
 *     A press of the right button with Shift (no Ctrl / Alt / Meta) on el is the zoom's: caught first (capture), so the
 *     editor's own tools / pan / orbit never see it. Moving the pointer UP (forward) zooms in, DOWN (back) zooms out -
 *     f > 1 = in - always round the point pressed (x, y = px from el's top-left). No context menu opens during the drag or
 *     right after it (a plain Shift+right-click with no drag is left alone - Artist mode leaves with it).
 *   factor(dy) (pure): the zoom for dy px of pointer travel (up = negative dy = in): 100 px = ×1.82
 *   isPress(ev) (pure): Shift + the right button, nothing else held */
(function (root) {
  "use strict";
  const STEP = 0.006;
  const factor = (dy) => Math.exp(-dy * STEP);
  const isPress = (e) => !!e && e.button === 2 && !!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
  function attach(el, o) {
    if (!el || !o || typeof o.zoom !== "function") return () => {};
    let d = null, eatUntil = 0;
    const down = (e) => {
      if (!isPress(e) || (o.enabled && !o.enabled())) return;
      const r = el.getBoundingClientRect();
      d = { id: e.pointerId, y: e.clientY, x0: e.clientX - r.left, y0: e.clientY - r.top, moved: 0 };
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      stop(e);
      if (o.start) try { o.start(d.x0, d.y0, e); } catch (x) { /* fine */ }
    };
    const move = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const dy = e.clientY - d.y; d.y = e.clientY; d.moved += Math.abs(dy);
      if (dy) o.zoom(factor(dy), d.x0, d.y0, e);
      stop(e);
    };
    const up = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const moved = d.moved; d = null;
      if (moved > 3) eatUntil = Date.now() + 700;                     // the contextmenu after a drag (Windows: on release)
      try { el.releasePointerCapture(e.pointerId); } catch (x) { /* fine */ }
      if (moved > 3) stop(e);
      if (o.end) try { o.end(moved, e); } catch (x) { /* fine */ }
    };
    const menu = (e) => { if (d || Date.now() < eatUntil) stop(e); };   // while dragging (Linux / Mac: on press) and right after
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerup", up, true);
    el.addEventListener("pointercancel", up, true);
    el.addEventListener("contextmenu", menu, true);
    return () => { ["pointerdown", "pointermove", "pointerup", "pointercancel", "contextmenu"].forEach((t, i) => el.removeEventListener(t, [down, move, up, up, menu][i], true)); };
  }
  root.H3ZoomDrag = { attach, factor, isPress, STEP };
})(typeof window !== "undefined" ? window : globalThis);
