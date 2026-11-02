/* bitGen Studio — static/pointericon.js (2.648.0): THE POINTER ICON (window.H3PointerIcon) - the arrow the pick / move tools
 * wear: the Sketcher's Select, the timeline's Move, the image editor's Move.
 * Tim (verbatim): "change the selection icon to a pointer. do these changes for sketcher,timeline and image editor"
 *   PATH         the arrow's outline in a 24 × 24 box (an SVG path - stroked or filled)
 *   svg(o)       an <svg> string: o.size (px, default 16), o.fill (default currentColor), o.stroke, o.title
 *   apply(btn)   the button shows the arrow (its text kept as aria-label) */
(function (root) {
  "use strict";
  const PATH = "M6 3 L6 19 L10 15.2 L12.8 21 L15.4 19.8 L12.6 14 L18 14 Z";
  function svg(o) {
    o = o || {};
    const s = o.size || 16, f = o.fill == null ? "currentColor" : o.fill, k = o.stroke || "none";
    return '<svg class="h3ptr" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:middle">'
      + '<path d="' + PATH + '" fill="' + f + '" stroke="' + k + '" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }
  function apply(btn, o) {
    if (!btn) return btn;
    if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", (btn.textContent || "").trim() || "Select");
    btn.innerHTML = svg(o); btn.dataset.icon = "pointer";
    return btn;
  }
  root.H3PointerIcon = { PATH, svg, apply };
})(typeof window !== "undefined" ? window : globalThis);
