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
  // 2.763.5: + a named docker confined to a docker (.h3fp-dk inside it - it was 9300, over every floating dialog)
  const SEL = [".h3fp.dg-app", "body > .h3fp", ".h3fp.h3fp-dk", ".secfloat.df-float", ".tsd:not(.docked)", "#vcPanel"];
  /** the order with `x` moved to the end (the top); things `keep(x)` says are no longer floating are dropped */
  function order(list, x, keep) {
    const out = (list || []).filter((y) => y !== x && (!keep || keep(y)));
    if (x != null) out.push(x);
    return out;
  }
  /** 2.763.5 (Tim: "move the pods docker in front of any custom docker, right now it goes behind the custom docker"): two
   *  layers in the band - the dockers (▣ dockers, ▣ New docker… ones, floated main dockers, the stage docker: isDocker) under the floating
   *  dialogs (PODS, 💲 RunPod, Basic Settings, 💬 Community …); in each, the one used last on top. The order -> the order
   *  painted (pure) */
  // 2.764.5 (Tim: "move floating dockers to the front of all docked dockers"): tierOf(x) -> a number (lower = under; true =
  // 0, false = 1): a docker DOCKED inside another one (a ▣ New docker… one confined to a docker) 0, floating dockers 1, the
  // floating dialogs 2 - so no docked docker is ever over a floating one
  function layered(list, tierOf) {
    const l = list || [], t = (x) => { const v = tierOf(x); return v === true ? 0 : v === false ? 1 : +v || 0; };
    const tiers = [...new Set(l.map(t))].sort((a, b) => a - b);
    return [].concat(...tiers.map((k) => l.filter((x) => t(x) === k)));
  }
  /** the z of the i-th in the order (0 = the lowest raised one) - never past the cap */
  function zFor(i) { return Math.min(BAND.cap, BAND.base + 1 + Math.max(0, i | 0)); }

  const api = { BAND, SEL, order, zFor, layered };
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
  const isDocker = (w) => !!(w.classList && (w.classList.contains("h3fp") || w.classList.contains("tsd")));   // ▣ / named / floated main dockers, the timeline's stage docker
  /** 2.764.5: 0 = docked inside a docker (a confined named docker), 1 = a floating docker, 2 = a floating dialog */
  const tierOf = (w) => (isDocker(w) ? (w.classList.contains("h3fp-dk") && w.parentElement !== doc.body ? 0 : 1) : 2);
  function raise(t) {
    const ws = winsOf(t); if (!ws.length) return null;
    for (const x of stack) if (!floating(x)) drop(x);
    // 2.763.5: the floating ones never raised yet join the order first (lowest) - so a docker pressed cannot go over a
    // floating dialog that kept its stylesheet z
    for (const w of doc.querySelectorAll(sel)) if (!stack.includes(w) && !ws.includes(w) && floating(w)) stack.unshift(w);
    for (const w of ws) stack = order(stack, w, floating);
    layered(stack, tierOf).forEach((x, i) => { x.style.zIndex = String(zFor(i)); x.dataset.fz = "1"; });
    return ws[ws.length - 1];
  }
  /** `w` docked / zoned / gone: out of the order, the z it was given cleared (a zoned docker is position: relative) */
  function drop(w) {
    if (!w) return;
    stack = stack.filter((x) => x !== w);
    if (w.dataset && w.dataset.fz) { w.style.zIndex = ""; delete w.dataset.fz; }
  }
  /** the order now, lowest first (floating ones only) */
  function list() { for (const x of stack.slice()) if (!floating(x)) drop(x); return layered(stack, tierOf); }
  /** the one on top (null = none raised yet) */
  function top() { const l = list(); return l.length ? l[l.length - 1] : null; }   // (the top of what is painted)

  // 2.782.1 (Tim: "if a docker is in floating state bring it to the front, right now new floating dockers are going behind the new
  // custom docker"): a docker / dialog that BECOMES floating and shown (floated out, opened, shown again, made) is raised at
  // once - before, only a press raised one, so a docker just floated kept its stylesheet z (or joined the order lowest) and sat
  // behind a ▣ docker raised earlier. A MutationObserver (class / style / added nodes), batched to one frame.
  const shownNow = (w) => { if (!floating(w)) return false; try { const cs = root.getComputedStyle(w); return cs.display !== "none" && cs.visibility !== "hidden"; } catch (e) { return false; } };
  const was = new WeakMap();
  let pend = false;
  function sweepNew() {
    pend = false;
    for (const w of doc.querySelectorAll(sel)) {
      const on = shownNow(w), before = was.get(w);
      was.set(w, on);
      if (before === true && !floating(w)) drop(w);      // 2.808.0: docked / put in a ▣ docker - its band z goes (it painted over floating ones)
      if (on && before === false) raise(w);              // just floated / shown again
      else if (on && before === undefined && booted) raise(w);   // a new one made floating (after the page's start)
    }
  }
  let booted = false;
  function soon() { if (pend) return; pend = true; (root.requestAnimationFrame || setTimeout)(sweepNew); }
  try {
    // only changes on a docker / dialog itself, or one added - the timeline's playback changes styles every frame elsewhere
    const ours = (n) => n && n.nodeType === 1 && ((n.matches && n.matches(sel)) || (n.querySelector && n.querySelector(sel)));
    new root.MutationObserver((ms) => { for (const m of ms) { if (m.type === "attributes" ? (m.target.matches && m.target.matches(sel)) : Array.prototype.some.call(m.addedNodes, ours)) { soon(); return; } } }).observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open"] });
    setTimeout(() => { sweepNew(); booted = true; }, 0);
  } catch (e) { /* an old browser: presses still raise */ }
  doc.addEventListener("pointerdown", (e) => { raise(e.target); }, true);
  doc.addEventListener("focusin", (e) => { raise(e.target); }, true);

  root.H3FloatZ = Object.assign({ raise, drop, list, top, floating }, api);
})(typeof window !== "undefined" ? window : globalThis);
