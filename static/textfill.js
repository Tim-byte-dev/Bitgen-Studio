/* bitGen Studio — static/textfill.js (2.608.0): SHAPES FILLED WITH TEXT - shared by the image editor and the timeline.
 * window.H3TextFill / require().
 *
 * Tim (verbatim): "can we fill shapes with text" -> (asked which kind) all three:
 *   STRETCH   the words bent and stretched to fill the shape's outline - each column of the text from the outline's top to
 *             its bottom there (a heart, a circle, a star filled by the letters)            drawEnvelope / spanAt
 *   FLOW      the words wrapped INSIDE the shape, line by line (each line as wide as the shape is there); Fit = the
 *             biggest size that still fits                                                 wrapIn / fitSize
 *   REPEAT    the shape's fill becomes the text repeated in rows (a typographic pattern), turned by an angle, every
 *             other row shifted; clipped to the shape                                      repeatRows
 * Pure (Node): spanAt(poly, x) -> [top, bottom] | null, spansAt(poly, y) -> [[x0, x1] ...], polyBox(poly),
 *   intervalAt(poly, y0, y1) (the widest stretch of a line band inside the shape), wrapIn(text, measure, poly, lh, align)
 *   -> {lines [{text, x, y, w}], overflow}, fitSize(fits(size), lo, hi), rowsOf(spec, W, H) (where repeatRows draws).
 */
(function (root) {
  "use strict";
  function polyBox(poly) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poly || []) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  /** where the vertical line at x crosses the outline: [the topmost, the bottommost] (null = outside) */
  function spanAt(poly, x) {
    const n = (poly || []).length; let top = Infinity, bot = -Infinity;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      if ((ax <= x && bx > x) || (bx <= x && ax > x)) { const y = ay + (x - ax) / (bx - ax) * (by - ay); top = Math.min(top, y); bot = Math.max(bot, y); }
    }
    return top < bot ? [top, bot] : null;
  }
  /** the horizontal line at y inside the outline: [[x0, x1] ...] left to right (even-odd) */
  function spansAt(poly, y) {
    const n = (poly || []).length, xs = [];
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    const out = []; for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] > xs[k]) out.push([xs[k], xs[k + 1]]);
    return out;
  }
  /** the widest stretch [x0, x1] that is inside the outline all the way from y0 to y1 (null = none) */
  function intervalAt(poly, y0, y1) {
    const ys = [y0 + 0.5, (y0 + y1) / 2, y1 - 0.5]; let best = null;
    for (const s of spansAt(poly, ys[1])) {
      let a = s[0], b = s[1];
      for (const y of [ys[0], ys[2]]) {
        const sp = spansAt(poly, y).filter((q) => q[1] > a && q[0] < b);
        if (!sp.length) { a = b; break; }
        const q = sp.reduce((m, t) => (Math.min(t[1], b) - Math.max(t[0], a) > Math.min(m[1], b) - Math.max(m[0], a) ? t : m));
        a = Math.max(a, q[0]); b = Math.min(b, q[1]);
      }
      if (b - a > 0 && (!best || b - a > best[1] - best[0])) best = [a, b];
    }
    return best;
  }
  /** the words wrapped inside the outline: lines (top = the outline's top + a little), each in its band's stretch */
  function wrapIn(text, measure, poly, lh, align) {
    const pb = polyBox(poly), lines = [];
    if (!pb) return { lines, overflow: !!String(text || "").trim() };
    const sp = measure(" "), bottom = pb.y + pb.h + 0.5;
    let y = pb.y + lh * 0.08, overflow = false;
    outer: for (const para of String(text == null ? "" : text).split("\n")) {
      let words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { y += lh; continue; }                     // an empty paragraph = an empty line
      while (words.length) {
        if (y + lh > bottom) { overflow = true; break outer; }
        const iv = intervalAt(poly, y, y + lh), room = iv ? iv[1] - iv[0] - lh * 0.15 : 0;
        let s = "", w = 0, k = 0;
        while (k < words.length) {
          const ww = measure(words[k]), nw = s ? w + sp + ww : ww;
          if (nw > room) { if (!s && room > pb.w * 0.6) { s = words[k]; w = ww; k++; } break; }   // a word longer than the widest line goes in anyway
          s = s ? s + " " + words[k] : words[k]; w = nw; k++;
        }
        if (!k) { y += lh * 0.25; continue; }                         // too narrow here: a little lower
        words = words.slice(k);
        const x = align === "left" ? iv[0] + lh * 0.075 : align === "right" ? iv[1] - lh * 0.075 - w : (iv[0] + iv[1]) / 2 - w / 2;
        lines.push({ text: s, x, y, w }); y += lh;
      }
    }
    return { lines, overflow };
  }
  /** the biggest size (lo .. hi) for which fits(size) is true - binary search, whole px */
  function fitSize(fits, lo, hi) {
    let a = Math.max(1, Math.floor(lo || 4)), b = Math.max(a, Math.ceil(hi || 400));
    if (!fits(a)) return a;
    while (b - a > 1) { const m = Math.floor((a + b) / 2); if (fits(m)) a = m; else b = m; }
    return fits(b) ? b : a;
  }
  /** REPEAT: the rows over a W x H region turned by spec.angle round its middle: [{y, x0, shift}] in the turned frame */
  function rowsOf(spec, W, H) {
    const size = Math.max(4, +spec.size || 24), lh = size * (+spec.leading || 1.15), R = Math.hypot(W, H) / 2 + lh, out = [];
    let k = 0;
    for (let y = -R; y <= R; y += lh, k++) out.push({ y, x0: -R, shift: spec.stagger === false ? 0 : (k % 2) * 0.5 });
    return { rows: out, R, lh, size };
  }
  const api = { polyBox, spanAt, spansAt, intervalAt, wrapIn, fitSize, rowsOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  /* ---------------- the page ---------------- */
  const fontOf = (s) => `${s.italic ? "italic " : ""}${s.weight || (s.bold ? 700 : 400)} ${Math.max(1, +s.size || 24)}px "${String(s.font || "Arial").replace(/"/g, "")}", sans-serif`;
  /** STRETCH: src's ink box (sb) drawn column by column into the outline (poly, in g's coordinates) */
  function drawEnvelope(g, src, sb, poly) {
    const pb = polyBox(poly); if (!pb || !sb || sb.w < 1 || sb.h < 1) return;
    const W = Math.ceil(pb.w), cw = Math.max(1, sb.w / Math.max(1, W));
    for (let x = 0; x < W; x++) {
      const sp = spanAt(poly, pb.x + x + 0.5); if (!sp) continue;
      const sx = sb.x + Math.min(sb.w - cw, (x + 0.5) / W * sb.w - cw / 2);
      g.drawImage(src, Math.max(sb.x, sx), sb.y, cw, sb.h, pb.x + x, sp[0], 1.02, sp[1] - sp[0]);
    }
  }
  /** REPEAT: the text in rows over the whole of g's canvas (the caller clips it to the shape) */
  function repeatRows(g, spec) {
    const W = g.canvas.width, H = g.canvas.height;
    repeatAt(g, spec, (+spec.ox || 0) + W / 2, (+spec.oy || 0) + H / 2, Math.hypot(W, H) / 2);
  }
  /** REPEAT round (cx, cy) out to radius R (in g's current coordinates) */
  function repeatAt(g, spec, cx, cy, R) {
    const str = String(spec.str == null ? "" : spec.str).replace(/\s+/g, " ").trim(); if (!str) return;
    const size = Math.max(4, +spec.size || 24), lh = size * (+spec.leading || 1.15), RR = R + lh;
    g.save(); g.translate(cx, cy); g.rotate((+spec.angle || 0) * Math.PI / 180);
    g.font = fontOf(Object.assign({}, spec, { size })); g.fillStyle = spec.color || "#000000"; g.textBaseline = "top";
    const unit = str + (spec.sep == null ? "  ·  " : spec.sep), uw = Math.max(1, g.measureText(unit).width);
    const line = unit.repeat(Math.ceil((2 * RR) / uw) + 2);
    let k = 0;
    for (let y = -RR; y <= RR; y += lh, k++) g.fillText(line, -RR - uw + (spec.stagger === false ? 0 : (k % 2) * 0.5 * uw), y);
    g.restore();
  }
  Object.assign(api, { drawEnvelope, repeatRows, repeatAt, fontOf });
  root.H3TextFill = api;
})(typeof window !== "undefined" ? window : globalThis);
