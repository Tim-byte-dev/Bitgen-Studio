/* bitGen Studio — static/uizoom.js (2.988.0): THE UI SIZE SCALES THE WHOLE UI (window.H3UiZoom).
 * Tim (verbatim): "across the ui when user changes ui size can you change the entire ui sizes, buttons, text etc. i am looking
 * at a projected screen 4m away, it is difficult for me to see."
 *
 * Before: the UI size slider (Settings ▸ Themes, the left dock's corner) set the root font size - text written in rem grew,
 * but buttons, icons, gaps, panels and every size written in px stayed small. Now the slider zooms EVERYTHING, as the
 * browser's own zoom does:
 *   in the app (Electron)  webFrame.setZoomFactor (electron/preload.js h3shell.zoom) - text, buttons, icons, dockers, the
 *                          3D views and the canvases (drawn sharp: the zoom raises devicePixelRatio)
 *   in a browser           the text sizes as before (the browser's own Ctrl + / Ctrl − zooms the whole page - CSS zoom
 *                          on the page would push dialogs sized in vh off the screen)
 *   in the app the root font size stays 14 px (it would grow twice otherwise). 60 - 250 % (250 for a projector).
 * Pure (Node: scripts/test-988.js): factorOf, MIN, MAX. */
(function (root) {
  "use strict";
  const MIN = 60, MAX = 250;
  /** the slider's percent -> the zoom factor (clamped; junk = 1) */
  function factorOf(v) { const n = parseInt(v, 10); return (Number.isFinite(n) ? Math.min(MAX, Math.max(MIN, n)) : 100) / 100; }
  const pure = { factorOf, MIN, MAX };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }
  const doc = root.document;
  let now = 1;
  /** the whole UI at v % - returns how: "electron" (the whole page zoomed) | "font" (a browser: the text sizes, as before) */
  function apply(v) {
    const f = factorOf(v), sh = root.h3shell;
    now = f;
    if (sh && typeof sh.zoom === "function") {
      try { sh.zoom(f); doc.documentElement.style.fontSize = "14px"; return "electron"; } catch (e) { /* an older shell: the text sizes below */ }
    }
    // a browser: its own zoom (Ctrl + / Ctrl −) zooms the whole page; CSS zoom here would push dialogs sized in vh off the
    // screen - so the slider keeps sizing the text (rem) as before
    doc.documentElement.style.fontSize = (14 * f) + "px";
    return "font";
  }
  root.H3UiZoom = Object.assign({ apply, factor: () => now }, pure);
})(typeof window !== "undefined" ? window : globalThis);
