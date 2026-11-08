/* bitGen Studio — static/floatz.js (2.724.0): THE FLOATING DOCKERS SHARE ONE ORDER - the one you used last is on top,
 * window.H3FloatZ (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "the community dialog is going behind the custom dialog, give floating dialogs the highest z-index's"
 *
 *   Before: two orders that did not know of each other - the ▣ dockers and the floated main dockers (static/dockgroup.js:
 *   45, 48 when pressed) and the docker windows of static/secfloat.js (💬 Community, Basic Settings, LLM tokens: 47, 49
 *   when pressed) - so a ▣ docker pressed last (48) stayed over 💬 Community (47) however often Community was opened.
 *   Now: every floating dialog sits in ONE band ABOVE the rest of the app (the docked dockers, the status bar 50, the
 *   image editor's full screen 46, the voice chat 50 -> all below BAND.base 60) and BELOW what must always win (the menu
 *   bar's menus 300, the corner video player 200, pop-up menus, message boxes, drop-zone outlines, 9000+). Pressing a
 *   floating dialog anywhere (or tabbing into it), or opening it (SecFloat.show, a ▣ docker shown) brings it to the top of
 *   the band: BAND.base + 1 + its place in the order, the one used last highest. Docked again, a docker drops its z
 *   (static/dockfloat.js clears it) and leaves the order.
 *
 *   The floating dialogs (SEL): ▣ dockers + floated main / side dockers (.h3fp.dg-app), the named dockers made with
 *   ⊞ Docker configs ▸ ▣ New docker… that float over the whole app (body > .h3fp - they were 9300, over everything, so
 *   💬 Community went behind them: THE BUG), 💬 Community / Basic Settings / LLM tokens (.secfloat.df-float), the
 *   timeline's stage docker (.tsd, not docked), the voice chat (#vcPanel).
 *   Not here: the prompt docker (its own lift - static/promptfront.js), the image editor's own panels and the named
 *   dockers confined to a docker (they live inside that docker, 9300 over its own parts).
 * Pure (Node: scripts/test-floatz724.js): BAND, SEL, order, zFor.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const BAND = { base: 60, cap: 199 };
  const SEL = [".h3fp.dg-app", "body > .h3fp", ".secfloat.df-float", ".tsd:not(.docked)", "#vcPanel"];
  /** the order with `x` moved to the end (the top); things `keep(x)` says are no longer floating are dropped */
  function order(list, x, keep) {
    const out = (list || []).filter((y) => y !== x && (!keep || keep(y)));
    if (x != null) out.push(x);
    return out;
  }
  /** the z of the i-th in the order (0 = the lowest raised one) - never past the cap */
  function zFor(i) { return Math.min(BAND.cap, BAND.base + 1 + Math.max(0, i | 0)); }

  const api = { BAND, SEL, order, zFor };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* ================================ the page ================================ */
  const doc = root.document;
  let stack = [];
  const sel = SEL.join(",");
  /** a floating dialog = one of SEL, on the page, floating (position fixed - a docked / tabbed one is not) */
  function floating(w) {
    if (!w || !w.isConnected || !w.matches || !w.matches(sel)) return false;
    try { return root.getComputedStyle(w).position === "fixed"; } catch (e) { return false; }
  }
  /** the floating dialogs holding `t` (or `t` itself), outermost first ([] = none) */
  function winsOf(t) {
    const out = [];
    for (let n = t && (t.nodeType === 1 ? t : t.parentElement); n && n.closest; ) {
      const w = n.closest(sel); if (!w) break;
      if (floating(w)) out.unshift(w);
      n = w.parentElement;
    }
    return out;
  }
  /** bring the floating dialog holding `t` (and any it floats inside) to the top of the band; returns it (null = `t` is
   *  in no floating dialog) */
  function raise(t) {
    const ws = winsOf(t); if (!ws.length) return null;
    for (const x of stack) if (!floating(x)) drop(x);
    for (const w of ws) stack = order(stack, w, floating);
    stack.forEach((x, i) => { x.style.zIndex = String(zFor(i)); x.dataset.fz = "1"; });
    return ws[ws.length - 1];
  }
  /** `w` docked / zoned / gone: out of the order, the z it was given cleared (a zoned docker is position: relative) */
  function drop(w) {
    if (!w) return;
    stack = stack.filter((x) => x !== w);
    if (w.dataset && w.dataset.fz) { w.style.zIndex = ""; delete w.dataset.fz; }
  }
  /** the order now, lowest first (floating ones only) */
  function list() { for (const x of stack.slice()) if (!floating(x)) drop(x); return stack.slice(); }
  /** the one on top (null = none raised yet) */
  function top() { const l = list(); return l.length ? l[l.length - 1] : null; }

  doc.addEventListener("pointerdown", (e) => { raise(e.target); }, true);
  doc.addEventListener("focusin", (e) => { raise(e.target); }, true);

  root.H3FloatZ = Object.assign({ raise, drop, list, top, floating }, api);
})(typeof window !== "undefined" ? window : globalThis);
