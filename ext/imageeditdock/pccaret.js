/* pccaret.js — THE IMAGE EDITOR'S TYPE TOOL: WHERE A CLICK PUTS THE CARET (2.602.0), window.PCCaret.
 *
 * Tim (verbatim): "in image-editor text tool make the select tool fit the text that is typed dynamically. change the
 * cursor to a edit text cursor when hover over text, on click edit text from the position of the click".
 * A click on a text layer with the Type tool opened it with EVERYTHING selected; now the caret lands between the two
 * letters nearest the click (the line under it, then the letter edge closest to it).
 *
 * Pure (Node: scripts/test-pccaret.js) - the page hands in a measure(s) -> width in picture px:
 *   nearest(widths, x)                   the index whose prefix width is closest to x (widths[0] = 0)
 *   plainIndex(t, fx, fy, measure)       point text (pcdoc's own drawing): lines split on \n, t.leading, t.align, t.x / t.y
 *   layoutIndex(str, lines, fx, fy, lh, measure)  a laid-out text (pctype.js paragraph / area text): its lines
 *                                        {text, x, y}, found back in the string in order (a wrap drops the space)
 *   unturn(t, box, fx, fy)               a turned text (t.rot): the click turned back round the box's centre
 */
(function (root) {
  "use strict";
  function nearest(widths, x) {
    let best = 0, d = Infinity;
    for (let i = 0; i < widths.length; i++) { const e = Math.abs(widths[i] - x); if (e < d) { d = e; best = i; } }
    return best;
  }
  /** prefix widths of a line: [0, w("a"), w("ab"), ...] - by code points, so an emoji is one step */
  function prefixes(text, measure) {
    const ch = Array.from(String(text || "")), out = [0];
    let s = "";
    for (const c of ch) { s += c; out.push(measure(s)); }
    return { ch, out };
  }
  /** the string index (UTF-16) of code point k in text */
  const unitIndex = (ch, k) => ch.slice(0, k).join("").length;
  function lineCaret(text, startX, fx, measure) {
    const p = prefixes(text, measure);
    return unitIndex(p.ch, nearest(p.out, fx - startX));
  }
  function plainIndex(t, fx, fy, measure) {
    const str = String((t && t.str) || ""), lines = str.split("\n"), size = +t.size || 48, lh = size * (+t.leading || 1.2);
    const li = Math.max(0, Math.min(lines.length - 1, Math.floor((fy - (+t.y || 0)) / lh)));
    const ln = lines[li], w = measure(ln);
    const x0 = t.align === "center" ? t.x - w / 2 : t.align === "right" ? t.x - w : t.x;
    let at = 0;
    for (let i = 0; i < li; i++) at += lines[i].length + 1;
    return at + lineCaret(ln, x0, fx, measure);
  }
  function layoutIndex(str, lines, fx, fy, lh, measure) {
    const s = String(str || ""), L = (lines || []).filter((l) => l && typeof l.text === "string");
    if (!L.length) return s.length;
    // each laid-out line found back in the string, in order
    let from = 0;
    const starts = L.map((l) => { const k = l.text ? s.indexOf(l.text, from) : from; const at = k >= 0 ? k : from; from = at + l.text.length; return at; });
    let li = 0;
    for (let i = 0; i < L.length; i++) if ((+L[i].y || 0) <= fy) li = i;
    if (fy > (+L[L.length - 1].y || 0) + lh) li = L.length - 1;
    return Math.min(s.length, starts[li] + lineCaret(L[li].text, +L[li].x || 0, fx, measure));
  }
  /** M (2.604.0): the text's whole matrix [a, b, c, d] (pcdoc textMat - turned, skewed, stretched); none = t.rot */
  function unturn(t, box, fx, fy, M) {
    if (!box) return [fx, fy];
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (M && M.length === 4) {
      const det = M[0] * M[3] - M[1] * M[2]; if (Math.abs(det) < 1e-9) return [fx, fy];
      const dx = fx - cx, dy = fy - cy;
      return [cx + (M[3] * dx - M[2] * dy) / det, cy + (-M[1] * dx + M[0] * dy) / det];
    }
    const a = +(t && t.rot) || 0;
    if (!a) return [fx, fy];
    const r = -a * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    return [cx + (fx - cx) * c - (fy - cy) * sn, cy + (fx - cx) * sn + (fy - cy) * c];
  }
  const PCCaret = { nearest, prefixes, plainIndex, layoutIndex, unturn };
  if (typeof module !== "undefined" && module.exports) module.exports = PCCaret;
  if (typeof root !== "undefined" && root) root.PCCaret = PCCaret;
})(typeof window !== "undefined" ? window : globalThis);
