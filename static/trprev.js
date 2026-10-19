/* bitGen Studio — static/trprev.js (2.415.0): a LAYER's entry / exit transition seen on the canvas (window.H3TrPrev).
 *
 * Tim: "lets do the medium jobs now" (a transitions library beyond the layer fades). The compile draws a video /
 * picture layer's boundary as its shape (scripts/transitions.py boundary_chain - ffmpeg xfade against a see-through
 * copy of the clip); this draws the same on the canvas: where the layer's FIRST clip starts it enters, where its LAST
 * clip ends it leaves.
 *   wipes (left / right / up / down and the corners), soft wipes, slides / covers / reveals, circle open / close,
 *   iris (circle / box), barn doors - drawn as their shape; the dissolves and the rest - as a fade (close enough).
 *
 *   at(L, c, t, len)  -> {type, p (0..1 through it), dir ("in" | "out")} or null      L = the layer, c = the clip
 *   region(type, p, w, h) -> what the ENTERING picture covers at p: {rect: [x, y, w, h]} | {circle: r, inside} |
 *                         {move: [dx, dy], dirv} | {alpha: a}   (box coordinates: 0..w, 0..h)
 *   apply(g, st, w, h) -> sets the clip path / offset / alpha on g (already translated to the box's centre)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3TrPrev = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DIP = { fade: 1, fadeblack: 1, fadewhite: 1, fadegrays: 1, fadefast: 1, fadeslow: 1, none: 1 };
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  /** the boundary this clip is in at t (it must be the layer's first / last clip) */
  function at(L, c, t, len, first, last) {
    if (!L || !c) return null;
    var st = n(c.start, 0), en = st + n(len, 0), ti = L.transitionIn || {}, to = L.transitionOut || {};
    var half = Math.max(0, n(len, 0) / 2);
    if (first && ti.type && ti.type !== "none") { var d = Math.min(Math.max(0.08, n(ti.dur, 0.5)), half); if (d > 0 && t >= st && t < st + d) return { type: ti.type, p: (t - st) / d, dir: "in" }; }
    if (last && to.type && to.type !== "none") { var e = Math.min(Math.max(0.08, n(to.dur, 0.5)), half); if (e > 0 && t <= en && t > en - e) return { type: to.type, p: (t - (en - e)) / e, dir: "out" }; }
    return null;
  }
  /** what the ENTERING picture covers at progress p (ffmpeg xfade's second input) */
  function region(type, p, w, h) {
    var q = Math.max(0, Math.min(1, p));
    switch (type) {
      case "wipeleft": case "smoothleft": return { rect: [w * (1 - q), 0, w * q, h] };
      case "wiperight": case "smoothright": return { rect: [0, 0, w * q, h] };
      case "wipeup": case "smoothup": return { rect: [0, h * (1 - q), w, h * q] };
      case "wipedown": case "smoothdown": return { rect: [0, 0, w, h * q] };
      case "wipetl": return { rect: [0, 0, w * q, h * q] };
      case "wipetr": return { rect: [w * (1 - q), 0, w * q, h * q] };
      case "wipebl": return { rect: [0, h * (1 - q), w * q, h * q] };
      case "wipebr": return { rect: [w * (1 - q), h * (1 - q), w * q, h * q] };
      case "slideleft": case "coverleft": return { move: [w * (1 - q), 0], dirv: [1, 0] };
      case "slideright": case "coverright": return { move: [-w * (1 - q), 0], dirv: [-1, 0] };
      case "slideup": case "coverup": return { move: [0, h * (1 - q)], dirv: [0, 1] };
      case "slidedown": case "coverdown": return { move: [0, -h * (1 - q)], dirv: [0, -1] };
      // ffmpeg's irises are not linear: the edge (half-way through its soft ramp) sits at d / z = 3q - 1 (open) and
      // 2 - 3q (close), z = the half-diagonal (vf_xfade.c circleopen / circleclose)
      case "circleopen": return { circle: Math.hypot(w, h) / 2 * Math.max(0, Math.min(1, 3 * q - 1)), inside: true };
      case "circlecrop": return { circle: Math.hypot(w, h) / 2 * q, inside: true };
      case "circleclose": return { circle: Math.hypot(w, h) / 2 * Math.max(0, Math.min(1, 2 - 3 * q)), inside: false };
      case "rectcrop": return { rect: [w / 2 * (1 - q), h / 2 * (1 - q), w * q, h * q] };
      case "vertopen": return { rect: [w / 2 * (1 - q), 0, w * q, h] };
      case "horzopen": return { rect: [0, h / 2 * (1 - q), w, h * q] };
      default: return { alpha: q };
    }
  }
  /** the clip's own drawing at its boundary: entering = the region; leaving = everything but the region of what replaces it */
  function apply(g, st, w, h) {
    if (!st) return;
    if (DIP[st.type]) { g.globalAlpha *= st.dir === "in" ? st.p : 1 - st.p; return; }
    var R = region(st.type, st.p, w, h), x0 = -w / 2, y0 = -h / 2;
    if (R.alpha != null) { g.globalAlpha *= st.dir === "in" ? R.alpha : 1 - R.alpha; return; }
    if (R.move) {
      if (st.dir === "in") g.translate(R.move[0], R.move[1]);
      else g.translate(-R.dirv[0] * w * st.p, -R.dirv[1] * h * st.p);       // pushed out the other way
      return;
    }
    g.beginPath();
    if (R.rect) {
      if (st.dir === "out") g.rect(x0, y0, w, h);
      g.rect(x0 + R.rect[0], y0 + R.rect[1], R.rect[2], R.rect[3]);
    } else if (R.circle != null) {
      var inside = st.dir === "in" ? R.inside : !R.inside;
      if (!inside) g.rect(x0, y0, w, h);
      g.moveTo(Math.max(0, R.circle), 0); g.arc(0, 0, Math.max(0, R.circle), 0, Math.PI * 2);
    }
    if (st.dir === "out" || (R.circle != null && !(st.dir === "in" ? R.inside : !R.inside))) g.clip("evenodd"); else g.clip();
  }
  return { at: at, region: region, apply: apply, DIP: DIP };
});
