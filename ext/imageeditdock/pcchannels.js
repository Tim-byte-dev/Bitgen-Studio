/* pcchannels.js — CHANNEL EDITING + SPOT CHANNELS, the pure part (2.467.0), window.PCChannels.
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - the gap row "editing a single colour channel's pixels; spot channels". The Channels panel (pcrefine.js) uses:
 *
 *   targetOf(set)                  {r, g, b} flags from a set / string of the targeted colour channels ("rgb" = all)
 *   keepChannels(before, after, t) after an edit: the channels NOT targeted (and the alpha, when not all are) back as
 *                                  they were - painting / filters / fills then change only the targeted channels
 *   inkOf(data, color, solidity)   a spot channel's ink as rgba (its colour, alpha = density x solidity)
 *   overInk(rgba, data, color, solidity)   the picture with a spot channel's ink laid over it (what merging does)
 *   viewOf(rgba, t)                the picture as the Channels panel shows a target: one channel = grey, two = those two
 *                                  in colour (the third dark), all = as it is
 */
(function (root) {
  "use strict";
  function targetOf(s) {
    const str = typeof s === "string" ? s : [...(s || [])].join("");
    if (!str || str === "rgb") return { r: true, g: true, b: true };
    return { r: str.includes("r"), g: str.includes("g"), b: str.includes("b") };
  }
  const all = (t) => !!(t && t.r && t.g && t.b);
  /** in place on `after` (rgba): the untargeted channels from `before` */
  function keepChannels(before, after, t) {
    if (!t || all(t)) return after;
    const keep = [!t.r, !t.g, !t.b, true];
    for (let i = 0; i < after.length; i += 4) for (let c = 0; c < 4; c++) if (keep[c]) after[i + c] = before[i + c];
    return after;
  }
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  function inkOf(data, color, solidity) {
    const [r, g, b] = hexRgb(color), k = Math.max(0, Math.min(100, solidity == null ? 100 : +solidity)) / 100, o = new Uint8ClampedArray(data.length * 4);
    for (let i = 0; i < data.length; i++) { o[i * 4] = r; o[i * 4 + 1] = g; o[i * 4 + 2] = b; o[i * 4 + 3] = data[i] * k; }
    return o;
  }
  function overInk(rgba, data, color, solidity) {
    const [r, g, b] = hexRgb(color), k = Math.max(0, Math.min(100, solidity == null ? 100 : +solidity)) / 100, o = Uint8ClampedArray.from(rgba);
    for (let i = 0; i < data.length; i++) { const a = (data[i] / 255) * k; if (!a) continue; o[i * 4] = o[i * 4] * (1 - a) + r * a; o[i * 4 + 1] = o[i * 4 + 1] * (1 - a) + g * a; o[i * 4 + 2] = o[i * 4 + 2] * (1 - a) + b * a; }
    return o;
  }
  function viewOf(rgba, t) {
    const o = Uint8ClampedArray.from(rgba); if (!t || all(t)) return o;
    const on = [t.r, t.g, t.b], n = on.filter(Boolean).length;
    for (let i = 0; i < o.length; i += 4) {
      if (n === 1) { const v = rgba[i + on.indexOf(true)]; o[i] = o[i + 1] = o[i + 2] = v; }
      else for (let c = 0; c < 3; c++) if (!on[c]) o[i + c] = 0;
      o[i + 3] = 255;
    }
    return o;
  }
  const PCChannels = { targetOf, all, keepChannels, hexRgb, inkOf, overInk, viewOf };
  if (typeof module !== "undefined" && module.exports) module.exports = PCChannels;
  else root.PCChannels = PCChannels;
})(typeof window !== "undefined" ? window : globalThis);
