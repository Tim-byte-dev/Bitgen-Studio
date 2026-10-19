/* pcmode.js — IMAGE ▸ MODE, PROOF COLOURS, GAMUT WARNING, CMYK TIFF (2.487.0): the image editor's gap, round G.
 * window.PCMode.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Image ▸ Mode ▸ Bitmap…         black and white only: 50 % threshold, pattern dither, diffusion dither or a halftone
 *                                  screen (cell size, angle) - flattened onto white, one layer
 *                  Grayscale       every pixel layer turned grey; what you paint afterwards shows grey too
 *                  Duotone…        a grey picture printed with 1-4 inks (monotone, duotone, tritone, quadtone): each
 *                                  ink's colour and how much of it the shadows / midtones take; presets
 *                  Indexed Color…  up to 256 colours: Local (made from the picture), Web (216), Uniform, Grey, Black
 *                                  and white; dither none / diffusion / pattern; transparency kept or not - one layer
 *                  RGB Color       back to full colour (the look of the mode you were in is kept)
 *                  CMYK Color…     colours limited to what a press can print (coated / uncoated / newsprint, black
 *                                  generation, total ink); exports as a CMYK TIFF
 *                  Color Table…    an indexed picture's colours: change one, save / load .act colour tables
 *                  8 Bits/Channel  (the only depth here - the browser's canvas holds 8 bits per channel)
 *   View ▸ Proof Setup…  the press to simulate, black generation, total ink, simulate paper colour, the warning colour
 *        Proof Colors (Alt+Ctrl+Y)   the picture as the press would print it (on screen only)
 *        Gamut Warning (Shift+Ctrl+Y)   colours the press cannot print shown in the warning colour (on screen only)
 *   Export As ▸ TIFF (CMYK, for print)   four-channel separations; the Info panel's C M Y K read from the same model
 *
 * The press model: the four process inks and the paper as sRGB colours, multiplied in linear light, dot gain
 * t + g·4t(1-t), black point compensation. A colour's CMYK is found by solving that model (black from grey
 * component replacement, total ink limited) on a 17 x 17 x 17 grid, read with trilinear interpolation (a
 * 64 x 64 x 64 table on screen). A simple press simulation, not an ICC profile.
 * Pure (Node: scripts/test-mode.js): lin, srgb, GRAY_W, grayOf, PRESS, GCR, makePress, solve, buildLut, lutAt,
 * lab, dE, webPalette, uniformPalette, grayPalette, indexImage, bitmapImage, BAYER8, duotoneLut, DUO_PRESETS,
 * encodeTIFFcmyk, actBytes, parseAct.
 */
(function (root) {
  "use strict";
  const FP = typeof module !== "undefined" && module.exports ? require("./pcfileplus.js") : root.PCFilePlus;

  /* ---------------- colour basics ---------------- */
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const srgb = (v) => { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
  const LIN8 = Float32Array.from({ length: 256 }, (_, i) => lin(i / 255));
  const GRAY_W = [0.2126, 0.7152, 0.0722];                                 // the same weights as the canvas grayscale() filter
  const grayOf = (r, g, b) => Math.round(GRAY_W[0] * r + GRAY_W[1] * g + GRAY_W[2] * b);
  const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  function lab(r, g, b) {                                                  // sRGB 0..1 → CIE L*a*b* (D65)
    const R = lin(r), G = lin(g), B = lin(b);
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const fx = f(X), fy = f(Y), fz = f(Z); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  const dE = (a, b) => { const p = lab(a[0], a[1], a[2]), q = lab(b[0], b[1], b[2]); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

  /* ---------------- the press ---------------- */
  const PRESS = {
    coated: { name: "Coated press (300 % ink)", paper: [0.96, 0.96, 0.95], dotGain: 0.12, tac: 3.0 },
    uncoated: { name: "Uncoated press (260 % ink)", paper: [0.94, 0.93, 0.88], dotGain: 0.18, tac: 2.6 },
    newsprint: { name: "Newsprint (240 % ink)", paper: [0.86, 0.85, 0.8], dotGain: 0.26, tac: 2.4 } };
  const GCR = { none: 0, light: 0.35, medium: 0.6, heavy: 0.85, maximum: 1 };
  const INKS = [[0, 174, 239], [236, 0, 140], [255, 242, 0], [35, 31, 32]].map((c) => c.map((v) => lin(v / 255)));
  /** the press as a function: makePress({press, gcr, tac}) → {abs(c, m, y, k) linear, rel(c, m, y, k) sRGB 0..1, ...} */
  function makePress(o) {
    const opt = o || {}, P = PRESS[opt.press] || PRESS.coated, paper = P.paper.map(lin), dg = P.dotGain, gcr = GCR[opt.gcr] != null ? GCR[opt.gcr] : GCR.medium;
    const TAC = opt.tac ? Math.max(1, Math.min(4, opt.tac / 100)) : P.tac;
    const gain = (t) => Math.max(0, Math.min(1, t + dg * 4 * t * (1 - t)));
    function abs(c, m, y, k) {
      const t = [gain(c), gain(m), gain(y), gain(k)], out = [0, 0, 0];
      for (let ch = 0; ch < 3; ch++) { let v = paper[ch]; for (let i = 0; i < 4; i++) v *= 1 - t[i] * (1 - INKS[i][ch]); out[ch] = v; }
      return out;
    }
    const cB = Math.min(1, (TAC - 1) / 3), black = abs(cB, cB, cB, 1);
    const rel = (c, m, y, k) => { const a = abs(c, m, y, k); return a.map((v, ch) => srgb((v - black[ch]) / (paper[ch] - black[ch]))); };
    const absS = (c, m, y, k) => abs(c, m, y, k).map(srgb);
    return { abs, absS, rel, black, paper, tac: TAC, gcr, press: P, key: [opt.press || "coated", gcr, TAC].join(":") };
  }
  /** the CMYK (0..1) that prints closest to an sRGB colour (0..1): {cmyk, out (relative sRGB), dE} */
  function solve(Pr, r, g, b) {
    const t = [r, g, b], kfull = 1 - Math.max(r, g, b);
    const run = (k) => {
      const lim = Math.max(0, Pr.tac - k);
      let x = [1 - r - k, 1 - g - k, 1 - b - k].map((v) => Math.max(0, Math.min(1, v)));
      const fit = () => { const s = x[0] + x[1] + x[2]; if (s > lim) x = x.map((v) => v * lim / s); };
      fit();
      let f = Pr.rel(x[0], x[1], x[2], k);
      for (let it = 0; it < 24; it++) {
        const e = [t[0] - f[0], t[1] - f[1], t[2] - f[2]]; if (Math.abs(e[0]) + Math.abs(e[1]) + Math.abs(e[2]) < 3e-4) break;
        const J = [0, 0, 0, 0, 0, 0, 0, 0, 0], h = 1e-3;
        for (let j = 0; j < 3; j++) { const xx = x.slice(); xx[j] = xx[j] + (xx[j] > 1 - h ? -h : h); const d = xx[j] - x[j], fj = Pr.rel(xx[0], xx[1], xx[2], k); for (let i = 0; i < 3; i++) J[i * 3 + j] = (fj[i] - f[i]) / d; }
        const det = J[0] * (J[4] * J[8] - J[5] * J[7]) - J[1] * (J[3] * J[8] - J[5] * J[6]) + J[2] * (J[3] * J[7] - J[4] * J[6]);
        let dx;
        if (Math.abs(det) > 1e-12) {
          const inv = [J[4] * J[8] - J[5] * J[7], J[2] * J[7] - J[1] * J[8], J[1] * J[5] - J[2] * J[4], J[5] * J[6] - J[3] * J[8], J[0] * J[8] - J[2] * J[6], J[2] * J[3] - J[0] * J[5], J[3] * J[7] - J[4] * J[6], J[1] * J[6] - J[0] * J[7], J[0] * J[4] - J[1] * J[3]].map((v) => v / det);
          dx = [0, 1, 2].map((i) => inv[i * 3] * e[0] + inv[i * 3 + 1] * e[1] + inv[i * 3 + 2] * e[2]);
        } else dx = e.map((v) => -v);
        const xn = x.map((v, i) => Math.max(0, Math.min(1, v + Math.max(-0.5, Math.min(0.5, dx[i])))));
        const old = x; x = xn; fit(); const fn = Pr.rel(x[0], x[1], x[2], k);
        if (Math.hypot(t[0] - fn[0], t[1] - fn[1], t[2] - fn[2]) > Math.hypot(e[0], e[1], e[2]) + 1e-9) { x = old.map((v, i) => Math.max(0, Math.min(1, v + 0.25 * (xn[i] - v)))); fit(); f = Pr.rel(x[0], x[1], x[2], k); } else f = fn;
      }
      return { cmyk: [x[0], x[1], x[2], k], out: f, err: Math.hypot(t[0] - f[0], t[1] - f[1], t[2] - f[2]) };
    };
    let best = run(Pr.gcr * kfull);
    if (best.err > 0.01) for (const k of [Pr.gcr * kfull + (1 - Pr.gcr * kfull) * 0.5, 1]) { const r2 = run(k); if (r2.err < best.err) best = r2; }
    best.dE = dE(t, best.out);
    return best;
  }
  /** the press solved on an N x N x N grid */
  function buildLut(opt, N) {
    const Pr = makePress(opt), n = N || 17, cnt = n * n * n, cmyk = new Float32Array(cnt * 4), rel = new Float32Array(cnt * 3), absA = new Float32Array(cnt * 3), de = new Float32Array(cnt);
    for (let bi = 0; bi < n; bi++) for (let gi = 0; gi < n; gi++) for (let ri = 0; ri < n; ri++) {
      const i = (bi * n + gi) * n + ri, s = solve(Pr, ri / (n - 1), gi / (n - 1), bi / (n - 1)), a = Pr.absS(...s.cmyk);
      cmyk.set(s.cmyk, i * 4); rel.set(s.out, i * 3); absA.set(a, i * 3); de[i] = s.dE;
    }
    return { N: n, cmyk, rel, abs: absA, de, press: Pr, key: Pr.key };
  }
  /** trilinear read of a table with `w` values per node at r, g, b (0..255) */
  function lutAt(L, arr, w, r, g, b, out) {
    const n = L.N - 1, fr = r / 255 * n, fg = g / 255 * n, fb = b / 255 * n, r0 = Math.min(n - 1, Math.floor(fr)), g0 = Math.min(n - 1, Math.floor(fg)), b0 = Math.min(n - 1, Math.floor(fb));
    const dr = fr - r0, dg = fg - g0, db = fb - b0, o = out || new Array(w).fill(0);
    for (let k = 0; k < w; k++) o[k] = 0;
    for (let c = 0; c < 8; c++) {
      const ri = r0 + (c & 1), gi = g0 + ((c >> 1) & 1), bi = b0 + (c >> 2), wt = (c & 1 ? dr : 1 - dr) * ((c >> 1) & 1 ? dg : 1 - dg) * (c >> 2 ? db : 1 - db);
      if (!wt) continue; const i = ((bi * L.N + gi) * L.N + ri) * w; for (let k = 0; k < w; k++) o[k] += arr[i + k] * wt;
    }
    return o;
  }
  /** a 64 x 64 x 64 screen table: [r, g, b] bytes per entry for `arr` (rel or abs), + the out-of-gamut flags */
  function screenTable(L, which, thr) {
    const T = new Uint8Array(64 * 64 * 64 * 3), G = new Uint8Array(64 * 64 * 64), o = [0, 0, 0], d = [0];
    for (let b = 0; b < 64; b++) for (let g = 0; g < 64; g++) for (let r = 0; r < 64; r++) {
      const i = (b * 64 + g) * 64 + r, R = r * 255 / 63, Gg = g * 255 / 63, B = b * 255 / 63;
      lutAt(L, L[which], 3, R, Gg, B, o); T[i * 3] = Math.round(o[0] * 255); T[i * 3 + 1] = Math.round(o[1] * 255); T[i * 3 + 2] = Math.round(o[2] * 255);
      lutAt(L, L.de, 1, R, Gg, B, d); G[i] = d[0] > thr ? 1 : 0;
    }
    return { T, G };
  }

  /* ---------------- indexed colour ---------------- */
  const webPalette = () => { const p = []; for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) p.push([r * 51, g * 51, b * 51]); return p; };
  function uniformPalette(n) { const l = Math.max(2, Math.floor(Math.cbrt(Math.max(8, Math.min(256, n))) + 1e-9)), p = []; for (let r = 0; r < l; r++) for (let g = 0; g < l; g++) for (let b = 0; b < l; b++) p.push([r, g, b].map((v) => Math.round(v * 255 / (l - 1)))); return p; }
  const grayPalette = (n) => { const c = Math.max(2, Math.min(256, n | 0)); return Array.from({ length: c }, (_, i) => { const v = Math.round(i * 255 / (c - 1)); return [v, v, v]; }); };
  const BAYER8 = (() => { const m = [[0]]; let M = m; for (let s = 1; s < 8; s *= 2) { const N = []; for (let y = 0; y < 2 * s; y++) { N.push([]); for (let x = 0; x < 2 * s; x++) { const q = [[0, 2], [3, 1]][Math.floor(y / s)][Math.floor(x / s)]; N[y].push(4 * M[y % s][x % s] + q); } } M = N; } return M.map((row) => row.map((v) => (v + 0.5) / 64)); })();
  function nearestFn(pal) {
    const cache = new Map();
    return (r, g, b) => { const key = (r << 16) | (g << 8) | b; let v = cache.get(key); if (v !== undefined) return v; let best = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { const p = pal[i], d = 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } } if (cache.size > 300000) cache.clear(); cache.set(key, best); return best; };
  }
  /** an RGBA picture put on a palette: {data (RGBA), index (Uint8Array, 255 = clear when the palette is shorter)} */
  function indexImage(d, w, h, pal, o) {
    const opt = o || {}, near = nearestFn(pal), out = new Uint8ClampedArray(w * h * 4), idx = new Uint8Array(w * h), amt = opt.amount == null ? 1 : opt.amount;
    const err = opt.dither === "diffusion" ? new Float32Array(w * h * 3) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      if (opt.transparency !== false && d[i + 3] < 128) { idx[p] = 255; continue; }
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (opt.transparency === false && d[i + 3] < 255) { const a = d[i + 3] / 255; r = r * a + 255 * (1 - a); g = g * a + 255 * (1 - a); b = b * a + 255 * (1 - a); }
      if (err) { r += err[p * 3]; g += err[p * 3 + 1]; b += err[p * 3 + 2]; }
      if (opt.dither === "pattern") { const t = (BAYER8[y & 7][x & 7] - 0.5) * 64 * amt; r += t; g += t; b += t; }
      r = Math.max(0, Math.min(255, Math.round(r))); g = Math.max(0, Math.min(255, Math.round(g))); b = Math.max(0, Math.min(255, Math.round(b)));
      const k = near(r, g, b), q = pal[k]; idx[p] = k; out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; out[i + 3] = 255;
      if (err) { const e = [(r - q[0]) * amt, (g - q[1]) * amt, (b - q[2]) * amt]; const put = (xx, yy, f) => { if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; err[j] += e[0] * f; err[j + 1] += e[1] * f; err[j + 2] += e[2] * f; }; put(x + 1, y, 7 / 16); put(x - 1, y + 1, 3 / 16); put(x, y + 1, 5 / 16); put(x + 1, y + 1, 1 / 16); }
    }
    return { data: out, index: idx };
  }
  /** black and white only (flattened onto white): threshold, pattern, diffusion or halftone */
  function bitmapImage(d, w, h, o) {
    const opt = o || {}, out = new Uint8ClampedArray(w * h * 4), g = new Float32Array(w * h), lvl = opt.level == null ? 128 : opt.level;
    for (let p = 0; p < w * h; p++) { const i = p * 4, a = d[i + 3] / 255; g[p] = (grayOf(d[i], d[i + 1], d[i + 2]) * a + 255 * (1 - a)); }
    const cell = Math.max(2, opt.cell || 8), ang = (opt.angle == null ? 45 : opt.angle) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; let v = g[p], on;
      if (opt.method === "pattern") on = v / 255 > BAYER8[y & 7][x & 7];
      else if (opt.method === "diffusion") { on = v >= 128; const e = v - (on ? 255 : 0); if (x + 1 < w) g[p + 1] += e * 7 / 16; if (y + 1 < h) { if (x > 0) g[p + w - 1] += e * 3 / 16; g[p + w] += e * 5 / 16; if (x + 1 < w) g[p + w + 1] += e / 16; } }
      else if (opt.method === "halftone") { const u = (x + 0.5) * ca + (y + 0.5) * sa, vv = -(x + 0.5) * sa + (y + 0.5) * ca, spot = (Math.cos(2 * Math.PI * u / cell) + Math.cos(2 * Math.PI * vv / cell)) / 2, dark = 1 - v / 255; on = !(spot > 1 - 2 * dark); }
      else on = v >= lvl;
      const c = on ? 255 : 0, i = p * 4; out[i] = out[i + 1] = out[i + 2] = c; out[i + 3] = 255;
    }
    return out;
  }
  /* ---------------- duotone ---------------- */
  const DUO_PRESETS = {
    sepia: { name: "Sepia", inks: [{ color: "#000000", curve: 0 }, { color: "#a0662e", curve: 15 }] },
    blue: { name: "Blue duotone", inks: [{ color: "#000000", curve: 0 }, { color: "#2f6bb3", curve: 10 }] },
    cyanotype: { name: "Cyanotype (monotone)", inks: [{ color: "#163e74", curve: 0 }] },
    gold: { name: "Gold tritone", inks: [{ color: "#000000", curve: -5 }, { color: "#c8a24a", curve: 20 }, { color: "#7a4a1d", curve: 0 }] },
    warm: { name: "Warm quadtone", inks: [{ color: "#000000", curve: -10 }, { color: "#6b4a2b", curve: 0 }, { color: "#b07a4a", curve: 10 }, { color: "#e3c8a0", curve: 25 }] },
    mono: { name: "Black (monotone)", inks: [{ color: "#000000", curve: 0 }] } };
  /** grey (0..255) → RGB through the inks: Uint8Array(256 * 3) */
  function duotoneLut(inks) {
    const L = new Uint8Array(256 * 3), I = (inks || []).slice(0, 4).map((k) => ({ c: hex(k.color).map((v) => lin(v / 255)), gm: Math.pow(2, -(+k.curve || 0) / 50) }));
    for (let v = 0; v < 256; v++) {
      const dark = 1 - LIN8[v];
      for (let ch = 0; ch < 3; ch++) { let o = 1; for (const k of I) { const t = Math.pow(dark, k.gm); o *= 1 - t * (1 - k.c[ch]); } L[v * 3 + ch] = Math.round(srgb(o) * 255); }
    }
    return L;
  }
  /* ---------------- files ---------------- */
  /** a CMYK TIFF: cmykOf(r, g, b) → [c, m, y, k] 0..1; clear areas print as paper */
  function encodeTIFFcmyk(id, cmykOf) {
    const w = id.width, h = id.height, d = id.data, n = 12, ifd = 8, ifdLen = 2 + n * 12 + 4, bpsAt = ifd + ifdLen, dataAt = bpsAt + 8, size = dataAt + w * h * 4;
    const b = new Uint8Array(size), v = new DataView(b.buffer);
    b[0] = 0x49; b[1] = 0x49; v.setUint16(2, 42, true); v.setUint32(4, ifd, true); v.setUint16(ifd, n, true);
    const tags = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 4, bpsAt], [259, 3, 1, 1], [262, 3, 1, 5], [273, 4, 1, dataAt], [277, 3, 1, 4], [278, 4, 1, h], [279, 4, 1, w * h * 4], [284, 3, 1, 1], [296, 3, 1, 1], [332, 3, 1, 1]];
    tags.forEach(([tag, type, count, val], k) => { const o = ifd + 2 + k * 12; v.setUint16(o, tag, true); v.setUint16(o + 2, type, true); v.setUint32(o + 4, count, true); if (type === 3 && count === 1) v.setUint16(o + 8, val, true); else v.setUint32(o + 8, val, true); });
    for (let k = 0; k < 4; k++) v.setUint16(bpsAt + k * 2, 8, true);
    const cache = new Map();
    for (let p = 0, o = dataAt; p < w * h; p++, o += 4) {
      const i = p * 4, a = d[i + 3] / 255, r = Math.round(d[i] * a + 255 * (1 - a)), g = Math.round(d[i + 1] * a + 255 * (1 - a)), bb = Math.round(d[i + 2] * a + 255 * (1 - a)), key = (r << 16) | (g << 8) | bb;
      let c = cache.get(key); if (!c) { c = cmykOf(r, g, bb).map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255)); if (cache.size > 200000) cache.clear(); cache.set(key, c); }
      b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2]; b[o + 3] = c[3];
    }
    return b;
  }
  /** .act colour tables: 256 x RGB, then the count and the clear index (0xFFFF = none) */
  function actBytes(pal, clearIx) { const b = new Uint8Array(772); pal.slice(0, 256).forEach((c, i) => b.set(c, i * 3)); const n = Math.min(256, pal.length); b[768] = n >> 8; b[769] = n & 255; const t = clearIx == null ? 0xffff : clearIx; b[770] = t >> 8; b[771] = t & 255; return b; }
  function parseAct(bytes) { const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); if (u.length < 768) return null; const n = u.length >= 772 ? ((u[768] << 8) | u[769]) || 256 : 256; const out = []; for (let i = 0; i < Math.min(256, n); i++) out.push([u[i * 3], u[i * 3 + 1], u[i * 3 + 2]]); return out; }

  const pure = { lin, srgb, GRAY_W, grayOf, lab, dE, PRESS, GCR, INKS, makePress, solve, buildLut, lutAt, screenTable, webPalette, uniformPalette, grayPalette, BAYER8, nearestFn, indexImage, bitmapImage, DUO_PRESETS, duotoneLut, encodeTIFFcmyk, actBytes, parseAct, hex };

  /* ---------------- the page ---------------- */
  const MODES = { bitmap: "Bitmap", gray: "Grayscale", duotone: "Duotone", indexed: "Indexed Color", rgb: "RGB Color", cmyk: "CMYK Color" };
  function install(E) {
    const { S, store } = E, doc = E.doc || root.document, win = doc.defaultView || root, FPx = E.filePlus;
    const say = (t) => (E.say ? E.say(t) : null), esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const dialog = FPx ? FPx.dialog : null, val = (d, s) => (d.querySelector(s) || {}).value, chk = (d, s) => !!(d.querySelector(s) || {}).checked;
    const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    if (!S.imgMode) S.imgMode = "rgb";
    (E.docExtras = E.docExtras || []).push({ snap: () => ({ mode: S.imgMode || "rgb", modeOpt: S.imgModeOpt ? JSON.parse(JSON.stringify(S.imgModeOpt)) : null }), put: (v) => { S.imgMode = (v && v.mode) || "rgb"; S.imgModeOpt = v ? v.modeOpt : null; } });
    // the proof setup (the editor's, kept on this computer) and the tables made from it
    let setup = Object.assign({ press: "coated", gcr: "medium", tac: 0, paper: false, thr: 4, warn: "#808080" }, store.get("proof.setup", {}));
    const luts = new Map();
    function lutFor(opt) { const o = { press: opt.press, gcr: opt.gcr, tac: opt.tac || 0 }, k = JSON.stringify(o); if (!luts.has(k)) { if (luts.size > 4) luts.clear(); luts.set(k, buildLut(o, 17)); } return luts.get(k); }
    const tables = new Map();
    function tableFor(opt, which) { const k = JSON.stringify([opt.press, opt.gcr, opt.tac || 0, which, opt.thr]); if (!tables.has(k)) { if (tables.size > 6) tables.clear(); tables.set(k, screenTable(lutFor(opt), which, opt.thr || 4)); } return tables.get(k); }
    const modeOpt = () => S.imgModeOpt || {};
    const cmykSetup = () => (S.imgMode === "cmyk" ? Object.assign({}, setup, modeOpt()) : setup);
    E.cmykOf = (r, g, b) => lutAt(lutFor(cmykSetup()), lutFor(cmykSetup()).cmyk, 4, r, g, b);
    E.inGamut = (r, g, b) => lutAt(lutFor(setup), lutFor(setup).de, 1, r, g, b)[0] <= (setup.thr || 4);
    // what a mode does to a picture's pixels (view, flatten, and when baking)
    let duoCache = null;
    function modePixels(d) {
      const m = S.imgMode;
      if (m === "gray") { for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = grayOf(d[i], d[i + 1], d[i + 2]); }
      else if (m === "duotone") { const key = JSON.stringify(modeOpt().inks); if (!duoCache || duoCache.key !== key) duoCache = { key, L: duotoneLut(modeOpt().inks) }; const L = duoCache.L; for (let i = 0; i < d.length; i += 4) { const v = grayOf(d[i], d[i + 1], d[i + 2]); d[i] = L[v * 3]; d[i + 1] = L[v * 3 + 1]; d[i + 2] = L[v * 3 + 2]; } }
      else if (m === "indexed") { const pal = modeOpt().palette || [[0, 0, 0], [255, 255, 255]], near = nearestFn(pal); for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) continue; const q = pal[near(d[i], d[i + 1], d[i + 2])]; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; } }
      else if (m === "bitmap") { for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = grayOf(d[i], d[i + 1], d[i + 2]) >= 128 ? 255 : 0; }
      else if (m === "cmyk") { const { T } = tableFor(cmykSetup(), "rel"); for (let i = 0; i < d.length; i += 4) { const j = (((d[i + 2] >> 2) * 64 + (d[i + 1] >> 2)) * 64 + (d[i] >> 2)) * 3; d[i] = T[j]; d[i + 1] = T[j + 1]; d[i + 2] = T[j + 2]; } }
    }
    let scratch = null;
    E.viewFinish = function (c, screen) {
      const mode = S.imgMode || "rgb", proof = screen && S.proofOn, gamut = screen && S.gamutOn && mode !== "cmyk" && mode !== "bitmap";
      if (mode === "rgb" && !proof && !gamut) return c;
      const w = c.width, h = c.height, g = c.getContext("2d");
      if (mode === "gray" && !proof && !gamut) {                                   // fast: the canvas's own grey filter
        if (!scratch) scratch = doc.createElement("canvas"); scratch.width = w; scratch.height = h; const sg = scratch.getContext("2d"); sg.clearRect(0, 0, w, h); sg.drawImage(c, 0, 0);
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "copy"; g.filter = "grayscale(1)"; g.drawImage(scratch, 0, 0); g.restore();
        return c;
      }
      const id = g.getImageData(0, 0, w, h), d = id.data;
      if (mode !== "rgb") modePixels(d);
      if (proof || gamut) {
        const ps = mode === "cmyk" ? cmykSetup() : setup, P = proof ? tableFor(ps, ps.paper ? "abs" : "rel") : null, Gt = gamut ? tableFor(setup, "rel").G : null, wc = hex(setup.warn);
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue; const j = ((d[i + 2] >> 2) * 64 + (d[i + 1] >> 2)) * 64 + (d[i] >> 2);
          if (Gt && Gt[j]) { d[i] = wc[0]; d[i + 1] = wc[1]; d[i + 2] = wc[2]; continue; }
          if (P) { d[i] = P.T[j * 3]; d[i + 1] = P.T[j * 3 + 1]; d[i + 2] = P.T[j * 3 + 2]; }
        }
      }
      g.putImageData(id, 0, 0);
      return c;
    };
    const pixelLayers = () => S.layers.filter((L) => L.type === "pixel");
    function bakeLayers(fn) { for (const L of pixelLayers()) { const g = L.canvas.getContext("2d"), id = g.getImageData(0, 0, L.canvas.width, L.canvas.height); fn(id.data, id.width, id.height); g.putImageData(id, 0, 0); L.ver = (L.ver || 0) + 1; } }
    /** what the current mode shows, written into the pixels (before leaving it) */
    const bakeMode = () => { if (S.imgMode && S.imgMode !== "rgb") bakeLayers((d) => modePixels(d)); };
    const flatData = () => { const f = E.flatten(); return f.getContext("2d").getImageData(0, 0, S.w, S.h).data; };
    function oneLayer(name, data) { const L = E.makeLayer(name, S.w, S.h), g = L.canvas.getContext("2d"), id = g.createImageData(S.w, S.h); id.data.set(data); g.putImageData(id, 0, 0); S.layers = [L]; S.active = 0; }
    function setMode(m, opt, label, work) {
      if (!S.w) return say("open a picture first");
      E.docOp(label || "Mode: " + MODES[m], () => { if (work && work() === false) return false; S.imgMode = m; S.imgModeOpt = opt || null; });
      say("mode: " + MODES[m]);
    }
    const toRGB = () => setMode("rgb", null, "Mode: RGB Color", () => bakeMode());
    const toGray = () => setMode("gray", null, "Mode: Grayscale", () => { bakeMode(); bakeLayers((d) => { for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = grayOf(d[i], d[i + 1], d[i + 2]); }); });
    function dlgBitmap() {
      if (!S.w) return say("open a picture first");
      dialog("Bitmap", `<div class="rw"><label>Method</label><select class="mdM" style="grid-column:2/4"><option value="threshold">50 % Threshold</option><option value="pattern">Pattern Dither</option><option value="diffusion" selected>Diffusion Dither</option><option value="halftone">Halftone Screen</option></select></div>
        <div class="rw"><label>Halftone cell (px) / angle</label><input type="number" class="mdC" value="8" min="2" max="200"><input type="number" class="mdA" value="45" min="-180" max="180"></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">Black and white only. The layers are flattened onto white into one layer.</div>`,
        (d) => { const o = { method: val(d, ".mdM"), cell: +val(d, ".mdC") || 8, angle: +val(d, ".mdA") || 0 }; setMode("bitmap", o, "Mode: Bitmap", () => { const fd = flatData(); oneLayer("Bitmap", bitmapImage(fd, S.w, S.h, o)); }); });
    }
    function paletteOf(kind, n, data) {
      if (kind === "web") return webPalette(); if (kind === "uniform") return uniformPalette(n); if (kind === "gray") return grayPalette(n); if (kind === "bw") return [[0, 0, 0], [255, 255, 255]];
      return FP ? FP.quantize(data, Math.max(2, Math.min(256, n))) : uniformPalette(n);
    }
    function dlgIndexed() {
      if (!S.w) return say("open a picture first");
      dialog("Indexed Color", `<div class="rw"><label>Palette</label><select class="mdP" style="grid-column:2/4"><option value="local">Local (from the picture)</option><option value="web">Web (216)</option><option value="uniform">Uniform</option><option value="gray">Grey</option><option value="bw">Black and white</option></select></div>
        <div class="rw"><label>Colours</label><input type="number" class="mdN" value="256" min="2" max="256"></div>
        <div class="rw"><label>Dither / amount (%)</label><select class="mdD"><option value="diffusion">Diffusion</option><option value="pattern">Pattern</option><option value="none">None</option></select><input type="number" class="mdAm" value="75" min="0" max="100"></div>
        <div class="rw"><span></span><label style="grid-column:2/4"><input type="checkbox" class="mdT" checked> Keep transparency</label></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">The layers are flattened into one layer. Image ▸ Mode ▸ Color Table… shows and changes the colours.</div>`,
        (d) => {
          const kind = val(d, ".mdP"), n = +val(d, ".mdN") || 256, dither = val(d, ".mdD"), amount = (+val(d, ".mdAm") || 0) / 100, tr = chk(d, ".mdT");
          const fd = flatData(), pal = paletteOf(kind, n, fd);
          setMode("indexed", { palette: pal, kind, dither, transparency: tr }, "Mode: Indexed Color", () => oneLayer("Index", indexImage(fd, S.w, S.h, pal, { dither, amount, transparency: tr }).data));
          say(`indexed: ${pal.length} colours`);
        });
    }
    function dlgDuotone() {
      if (!S.w) return say("open a picture first");
      const cur = S.imgMode === "duotone" && modeOpt().inks ? modeOpt().inks : DUO_PRESETS.sepia.inks;
      const inkRow = (k, ink) => `<div class="rw mdInk" data-k="${k}"><label>Ink ${k + 1}</label><input type="color" class="mdIc" value="${ink ? ink.color : "#808080"}"><input type="range" class="mdIv" min="-50" max="50" value="${ink ? ink.curve : 0}" title="Curve: more (right) or less (left) of this ink in the midtones"></div>`;
      dialog("Duotone", `<div class="rw"><label>Preset</label><select class="mdPre" style="grid-column:2/4"><option value="">—</option>${Object.entries(DUO_PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join("")}</select></div>
        <div class="rw"><label>Type</label><select class="mdTy" style="grid-column:2/4"><option value="1">Monotone</option><option value="2">Duotone</option><option value="3">Tritone</option><option value="4">Quadtone</option></select></div>
        ${[0, 1, 2, 3].map((k) => inkRow(k, cur[k])).join("")}<canvas class="mdRamp" width="300" height="18" style="width:calc(100% - 20px);margin:6px 10px;height:18px;border:1px solid var(--pc-line)"></canvas>`,
        (d) => { const inks = read(d); setMode("duotone", { inks }, "Mode: Duotone", () => { bakeMode(); bakeLayers((dd) => { for (let i = 0; i < dd.length; i += 4) dd[i] = dd[i + 1] = dd[i + 2] = grayOf(dd[i], dd[i + 1], dd[i + 2]); }); }); },
        (d) => {
          const ty = d.querySelector(".mdTy"); ty.value = String(cur.length);
          const show = () => { const n = +ty.value; d.querySelectorAll(".mdInk").forEach((r) => { r.style.display = +r.dataset.k < n ? "" : "none"; }); ramp(); };
          const ramp = () => { const L = duotoneLut(read(d)), c = d.querySelector(".mdRamp"), g = c.getContext("2d"); for (let x = 0; x < 300; x++) { const v = Math.round(x / 299 * 255); g.fillStyle = `rgb(${L[v * 3]},${L[v * 3 + 1]},${L[v * 3 + 2]})`; g.fillRect(x, 0, 1, 18); } };
          d.querySelector(".mdPre").onchange = (e) => { const p = DUO_PRESETS[e.target.value]; if (!p) return; ty.value = String(p.inks.length); p.inks.forEach((ink, k) => { const r = d.querySelector(`.mdInk[data-k="${k}"]`); r.querySelector(".mdIc").value = ink.color; r.querySelector(".mdIv").value = ink.curve; }); show(); };
          ty.onchange = show; d.querySelectorAll(".mdIc,.mdIv").forEach((el) => { el.oninput = ramp; });
          show();
        });
      function read(d) { const n = +d.querySelector(".mdTy").value; return Array.from(d.querySelectorAll(".mdInk")).slice(0, n).map((r) => ({ color: r.querySelector(".mdIc").value, curve: +r.querySelector(".mdIv").value })); }
    }
    const pressRows = (o) => `<div class="rw"><label>Press</label><select class="mdPr" style="grid-column:2/4">${Object.entries(PRESS).map(([k, p]) => `<option value="${k}"${o.press === k ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
        <div class="rw"><label>Black generation</label><select class="mdG" style="grid-column:2/4">${Object.keys(GCR).map((k) => `<option value="${k}"${o.gcr === k ? " selected" : ""}>${k[0].toUpperCase() + k.slice(1)}</option>`).join("")}</select></div>
        <div class="rw"><label>Total ink (%; 0 = the press's)</label><input type="number" class="mdTac" value="${o.tac || 0}" min="0" max="400"></div>`;
    const readPress = (d) => ({ press: val(d, ".mdPr"), gcr: val(d, ".mdG"), tac: +val(d, ".mdTac") || 0 });
    function dlgCmyk() {
      if (!S.w) return say("open a picture first");
      dialog("CMYK Color", pressRows(S.imgMode === "cmyk" ? modeOpt() : setup) + `<div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">Colours the press cannot print are brought to the nearest it can. Export As ▸ TIFF (CMYK) writes the four inks. A simple press simulation, not an ICC profile.</div>`,
        (d) => { const o = readPress(d); say("working out the press…"); win.setTimeout(() => setMode("cmyk", o, "Mode: CMYK Color", () => { bakeMode(); const Lt = lutFor(o), out = [0, 0, 0]; bakeLayers((dd) => { const cache = new Map(); for (let i = 0; i < dd.length; i += 4) { if (!dd[i + 3]) continue; const key = (dd[i] << 16) | (dd[i + 1] << 8) | dd[i + 2]; let v = cache.get(key); if (!v) { lutAt(Lt, Lt.rel, 3, dd[i], dd[i + 1], dd[i + 2], out); v = out.map((x) => Math.round(x * 255)); if (cache.size > 200000) cache.clear(); cache.set(key, v); } dd[i] = v[0]; dd[i + 1] = v[1]; dd[i + 2] = v[2]; } }); }), 20); });
    }
    function dlgTable() {
      if (S.imgMode !== "indexed") return say("Color Table is for indexed pictures (Image ▸ Mode ▸ Indexed Color…)");
      const pal = modeOpt().palette.map((c) => c.slice());
      dialog("Color Table", `<div class="mdTab" style="display:grid;grid-template-columns:repeat(16,16px);gap:2px;margin:6px 10px">${pal.map((c, i) => `<input type="color" data-i="${i}" value="${toHex(c)}" style="width:16px;height:16px;padding:0;border:0">`).join("")}</div>
        <div class="rw"><span></span><button class="ghost mdSave">💾 Save .act…</button><button class="ghost mdLoad">⤒ Load .act…</button></div><div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">${pal.length} colours. Click one to change it.</div>`,
        (d) => {
          const now = Array.from(d.querySelectorAll(".mdTab input")).map((el) => hex(el.value)), old = modeOpt().palette;
          E.docOp("Color Table", () => {
            const map = new Map(); old.forEach((c, i) => map.set((c[0] << 16) | (c[1] << 8) | c[2], now[i] || c)); const near = nearestFn(old);
            bakeLayers((dd) => { for (let i = 0; i < dd.length; i += 4) { if (!dd[i + 3]) continue; let q = map.get((dd[i] << 16) | (dd[i + 1] << 8) | dd[i + 2]); if (!q) q = now[near(dd[i], dd[i + 1], dd[i + 2])]; dd[i] = q[0]; dd[i + 1] = q[1]; dd[i + 2] = q[2]; } });
            S.imgModeOpt = Object.assign({}, modeOpt(), { palette: now });
          });
        },
        (d) => {
          d.querySelector(".mdSave").onclick = () => { const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([actBytes(Array.from(d.querySelectorAll(".mdTab input")).map((el) => hex(el.value)))], { type: "application/octet-stream" })); a.download = (S.name || "colours").replace(/\.[a-z0-9]+$/i, "") + ".act"; doc.body.appendChild(a); a.click(); win.setTimeout(() => a.remove(), 1000); };
          d.querySelector(".mdLoad").onclick = () => { const inp = doc.createElement("input"); inp.type = "file"; inp.accept = ".act"; inp.style.display = "none"; doc.body.appendChild(inp); inp.onchange = async () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return; const p = parseAct(new Uint8Array(await f.arrayBuffer())); if (!p) return say("not a colour table (.act)"); d.querySelector(".mdTab").innerHTML = p.map((c, i) => `<input type="color" data-i="${i}" value="${toHex(c)}" style="width:16px;height:16px;padding:0;border:0">`).join(""); }; inp.click(); };
        });
    }
    function dlgProof() {
      dialog("Proof Setup", pressRows(setup) + `<div class="rw"><span></span><label style="grid-column:2/4"><input type="checkbox" class="mdPa"${setup.paper ? " checked" : ""}> Simulate the paper colour</label></div>
        <div class="rw"><label>Gamut warning: beyond (ΔE) / colour</label><input type="number" class="mdTh" value="${setup.thr}" min="1" max="50"><input type="color" class="mdW" value="${setup.warn}"></div>`,
        (d) => { setup = Object.assign({}, readPress(d), { paper: chk(d, ".mdPa"), thr: +val(d, ".mdTh") || 4, warn: val(d, ".mdW") || "#808080" }); store.set("proof.setup", setup); E.refresh(); say("proof: " + PRESS[setup.press].name); });
    }
    const toggle = (k, label) => { S[k] = !S[k]; if (S[k]) say(label + " - working out the press…"); win.setTimeout(() => { E.refresh(); if (S[k]) say(label + " on"); }, 10); };
    // menus
    const C = E.ui.addCmd, docOpen = () => !!S.w;
    C("mode.bitmap", "Bitmap…", "", dlgBitmap, { enabled: docOpen, checked: () => S.imgMode === "bitmap" });
    C("mode.gray", "Grayscale", "", toGray, { enabled: docOpen, checked: () => S.imgMode === "gray" });
    C("mode.duotone", "Duotone…", "", dlgDuotone, { enabled: docOpen, checked: () => S.imgMode === "duotone" });
    C("mode.indexed", "Indexed Color…", "", dlgIndexed, { enabled: docOpen, checked: () => S.imgMode === "indexed" });
    C("mode.rgb", "RGB Color", "", toRGB, { enabled: docOpen, checked: () => !S.imgMode || S.imgMode === "rgb" });
    C("mode.cmyk", "CMYK Color…", "", dlgCmyk, { enabled: docOpen, checked: () => S.imgMode === "cmyk" });
    C("mode.table", "Color Table…", "", dlgTable, { enabled: () => S.imgMode === "indexed" });
    C("mode.8bit", "8 Bits/Channel", "", () => say("8 bits per channel is the only depth here (the browser's canvas)"), { checked: () => true });
    const IM = E.ui.MENUS.find(([n]) => n === "Image");
    if (IM) IM[1].unshift({ label: "Mode", items: ["mode.bitmap", "mode.gray", "mode.duotone", "mode.indexed", "mode.rgb", "mode.cmyk", E.ui.sep, "mode.table", E.ui.sep, "mode.8bit"] }, E.ui.sep);
    C("view.proofsetup", "Proof Setup…", "", dlgProof, {}, ["View", "view.maskov", true]);
    C("view.proof", "Proof Colors", "Alt+Ctrl+Y", () => toggle("proofOn", "proof colours"), { enabled: docOpen, checked: () => !!S.proofOn }, ["View", "view.proofsetup"]);
    C("view.gamut", "Gamut Warning", "Shift+Ctrl+Y", () => toggle("gamutOn", "gamut warning"), { enabled: docOpen, checked: () => !!S.gamutOn }, ["View", "view.proof"]);
    // CMYK TIFF
    if (FPx && FPx.addType) {
      FPx.addType("image/x-tiff-cmyk", (id) => encodeTIFFcmyk(id, (r, g, b) => E.cmykOf(r, g, b)));
      if (E.exportFormats && !E.exportFormats.some((x) => x[0] === "tiffcmyk")) E.exportFormats.push(["tiffcmyk", "TIFF (CMYK, for print)", "image/x-tiff-cmyk", "tif", false]);
    }
    E.modes = { setMode, toGray, toRGB, dlgBitmap, dlgIndexed, dlgDuotone, dlgCmyk, dlgTable, dlgProof, lutFor, setup: () => setup, modePixels };
  }

  const PCMode = Object.assign({ install, MODES }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCMode;
  else root.PCMode = PCMode;
})(typeof window !== "undefined" ? window : globalThis);
