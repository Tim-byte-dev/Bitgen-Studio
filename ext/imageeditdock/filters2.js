/* filters2.js — MORE OF IMAGE ▸ ADJUSTMENTS (2.480.0): the image editor's gap, round A. window.IEFilters2.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Image ▸ Adjustments   Shadows / Highlights, HDR Toning, Selective Color, Replace Color (eyedropper), Match Color
 *                         (from another layer / the merged picture), Color Lookup (the timeline's looks + the LUT
 *                         library's .cube files - ＋ Load .cube…)
 *   Image ▸ Apply Image…  another layer (or the merged picture), one of its channels (RGB / R / G / B / alpha /
 *                         luminosity), inverted or not, blended onto the layer (11 modes, opacity, keep transparency)
 *   Adjustment layers     + Selective Color, Color Lookup (Layer ▸ New Adjustment Layer, the Adjustments panel)
 * Each is a pure function like filters.js's (rgba, w, h, params, ctx) -> RGBA (ctx = {x, y, W, H}: where the piece is
 * in the picture - Apply Image needs it), registered into IEFilters.FILTERS at load - so the menus, the dialog (live
 * preview, inside the selection, one undo step, Ctrl+F), smart filters, adjustment layers and Actions all take them.
 * Parameter kinds of their own (E.paramTypes, used by the filter dialog and the Properties panel):
 *   selcolor   the nine colour ranges x cyan / magenta / yellow / black, relative or absolute
 *   lutpick    "" | "look:<name>" | "lut:<file>.cube" (loaded once, parsed by static/clipfx.js H3ClipFx.parseCube)
 *   layerstats Match Color's source: its colour statistics (Lab means + spreads), kept with the settings
 *   layerpick  Apply Image's source: a layer id or "merged" (its pixels cached here while the dialog is open)
 *   color + eyedrop: true   a click on the picture picks the colour (Replace Color)
 * Loaded just before imageedit.js (it registers at load; the menus are built when the editor starts).
 * Pure (Node: scripts/test-filters2.js): rgb2lab / lab2rgb, labStats, selWeights, the FILTERS2 list, register(FX, D).
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const FX = isNode ? require("./filters.js") : root.IEFilters;
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const N = (id, label, min, max, step, def) => ({ id, label, type: "range", min, max, step, def });
  const SEL = (id, label, options, def) => ({ id, label, type: "select", options, def });
  const CHK = (id, label, def) => ({ id, label, type: "check", def });
  const COL = (id, label, def, extra) => Object.assign({ id, label, type: "color", def }, extra || {});
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const hex3 = (h) => FX.hex3(h);

  /* ---------------- colour maths ---------------- */
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const gam = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);
  const LIN = new Float64Array(256); for (let i = 0; i < 256; i++) LIN[i] = lin(i);
  const fL = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fLi = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
  /** sRGB 0-255 -> CIE Lab (D65) */
  function rgb2lab(r, g, b) {
    const R = Number.isInteger(r) && r >= 0 && r < 256 ? LIN[r] : lin(r), G = Number.isInteger(g) && g >= 0 && g < 256 ? LIN[g] : lin(g), B = Number.isInteger(b) && b >= 0 && b < 256 ? LIN[b] : lin(b);
    const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B, Z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
    const fx = fL(X), fy = fL(Y), fz = fL(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  /** CIE Lab -> sRGB 0-255 (not clamped) */
  function lab2rgb(L, a, b) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const X = fLi(fx) * 0.95047, Y = fLi(fy), Z = fLi(fz) * 1.08883;
    const R = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, G = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z, B = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    return [gam(R), gam(G), gam(B)];
  }
  /** colour statistics of a picture (its visible pixels): Lab means + standard deviations (Match Color's source / target) */
  function labStats(s) {
    const n0 = s.length / 4, step = Math.max(1, Math.floor(n0 / 250000));        // a big picture: every k-th pixel
    let n = 0; const m = [0, 0, 0], q = [0, 0, 0];
    for (let i = 0; i < n0; i += step) {
      const o = i * 4; if (s[o + 3] < 8) continue;
      const v = rgb2lab(s[o], s[o + 1], s[o + 2]);
      for (let c = 0; c < 3; c++) { m[c] += v[c]; q[c] += v[c] * v[c]; }
      n++;
    }
    if (!n) return null;
    const mean = m.map((x) => x / n), sd = q.map((x, c) => Math.sqrt(Math.max(1e-6, x / n - mean[c] * mean[c])));
    return { mean, sd, n };
  }

  /* ---------------- Selective Color ---------------- */
  const RANGES = ["reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"];
  const RANGE_NAMES = { reds: "Reds", yellows: "Yellows", greens: "Greens", cyans: "Cyans", blues: "Blues", magentas: "Magentas", whites: "Whites", neutrals: "Neutrals", blacks: "Blacks" };
  const emptySel = () => ({ mode: "relative", ranges: Object.fromEntries(RANGES.map((k) => [k, { c: 0, m: 0, y: 0, k: 0 }])) });
  /** how much of each range a pixel is (0..1): the colour families by their channel order, whites / neutrals / blacks by brightness */
  function selWeights(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), md = r + g + b - mx - mn, w = {};
    w.reds = r === mx && r > md ? (mx - md) / 255 : 0;
    w.greens = g === mx && g > md && r !== mx ? (mx - md) / 255 : 0;
    w.blues = b === mx && b > md && r !== mx && g !== mx ? (mx - md) / 255 : 0;
    w.cyans = r === mn && md > r ? (md - mn) / 255 : 0;
    w.magentas = g === mn && md > g && r !== mn ? (md - mn) / 255 : 0;
    w.yellows = b === mn && md > b && r !== mn && g !== mn ? (md - mn) / 255 : 0;
    w.whites = mn > 128 ? (mn - 128) * 2 / 255 : 0;
    w.blacks = mx < 128 ? (128 - mx) * 2 / 255 : 0;
    w.neutrals = Math.max(0, 1 - (Math.abs(mx - 128) + Math.abs(mn - 128)) / 255);
    return w;
  }
  function selectiveColor(s, p) {
    const sc = p.sel || emptySel(), abs = sc.mode === "absolute", R = sc.ranges || {};
    const act = RANGES.filter((k) => R[k] && (R[k].c || R[k].m || R[k].y || R[k].k));
    if (!act.length) return Uint8ClampedArray.from(s);
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) {
      const r = s[i], g = s[i + 1], b = s[i + 2], W = selWeights(r, g, b);
      const ink = [1 - r / 255, 1 - g / 255, 1 - b / 255], blk = Math.min(ink[0], ink[1], ink[2]), d = [0, 0, 0];
      for (const k of act) {
        const wk = W[k]; if (!wk) continue;
        const a = R[k], adj = [a.c / 100, a.m / 100, a.y / 100], kk = a.k / 100;
        // relative: in proportion to the ink already there (50 % magenta + 10 % = 55 %); absolute: the amount itself
        const dk = abs ? kk : kk * blk;
        for (let c = 0; c < 3; c++) d[c] += ((abs ? adj[c] : adj[c] * ink[c]) + dk) * wk;
      }
      out[i] = clamp(r - d[0] * 255); out[i + 1] = clamp(g - d[1] * 255); out[i + 2] = clamp(b - d[2] * 255); out[i + 3] = s[i + 3];
    }
    return out;
  }

  /* ---------------- Shadows / Highlights + HDR Toning ---------------- */
  function lumPlane(s) { const n = s.length / 4, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]); return L; }
  const blurPlane = (P, w, h, r) => (r > 0.3 ? FX.gaussPlanes([P], w, h, r / 2)[0] : P);
  function shadowsHighlights(s, w, h, p) {
    const L = lumPlane(s), out = new Uint8ClampedArray(s.length);
    const Ls = blurPlane(L, w, h, p.sradius), Lh = p.hradius === p.sradius ? Ls : blurPlane(L, w, h, p.hradius);
    const ts = Math.max(1, p.stone) / 100 * 255, th = Math.max(1, p.htone) / 100 * 255;
    const sa = p.shadows / 100, ha = p.highlights / 100, cc = p.color / 100, mc = p.midtone / 100;
    for (let i = 0, j = 0; j < L.length; i += 4, j++) {
      const l0 = L[j];
      const ms = Math.pow(Math.max(0, 1 - Ls[j] / ts), 2), mh = Math.pow(Math.max(0, (Lh[j] - (255 - th)) / th), 2);
      let l1 = l0 + sa * ms * (255 - l0) * 0.85 - ha * mh * l0 * 0.85;
      if (mc) { const t = l1 / 255 - 0.5; l1 = l1 + (clamp(255 * (0.5 + t * (1 + mc))) - l1) * (1 - Math.min(1, Math.abs(2 * t))); }   // midtones only
      const k = (l1 + 1) / (l0 + 1), amt = Math.max(ms * Math.abs(sa), mh * Math.abs(ha));
      for (let c = 0; c < 3; c++) {
        let v = s[i + c] * k;
        if (cc) v = l1 + (v - l1) * (1 + cc * amt);                                     // colour correction: saturation where it changed
        out[i + c] = clamp(v);
      }
      out[i + 3] = s[i + 3];
    }
    return out;
  }
  function hdrToning(s, w, h, p) {
    const n = s.length / 4, LL = new Float32Array(n);
    for (let i = 0; i < n; i++) LL[i] = Math.log(1 + luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]));
    const base = blurPlane(LL, w, h, p.radius);
    let mean = 0; for (let i = 0; i < n; i++) mean += base[i]; mean /= n || 1;
    const st = p.strength / 100, det = 1 + p.detail / 100, ex = Math.pow(2, p.exposure), gm = 1 / Math.max(0.1, p.gamma);
    const out = new Uint8ClampedArray(s.length), vib = p.vibrance / 100, sat = p.saturation / 100;
    for (let i = 0; i < n; i++) {
      const o = i * 4, l0 = Math.exp(LL[i]) - 1;
      const b2 = mean + (base[i] - mean) * (1 - st * 0.85), lg = b2 + (LL[i] - base[i]) * det;
      let l1 = (Math.exp(lg) - 1) * ex; l1 = 255 * Math.pow(Math.max(0, Math.min(1, l1 / 255)), gm);
      const k = (l1 + 1) / (l0 + 1);
      let R = s[o] * k, G = s[o + 1] * k, B = s[o + 2] * k;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), S0 = mx > 0 ? (mx - mn) / mx : 0, f = 1 + sat + vib * (1 - S0);
      const ly = luma(R, G, B);
      R = ly + (R - ly) * f; G = ly + (G - ly) * f; B = ly + (B - ly) * f;
      out[o] = clamp(R); out[o + 1] = clamp(G); out[o + 2] = clamp(B); out[o + 3] = s[o + 3];
    }
    return out;
  }

  /* ---------------- Replace Color, Match Color ---------------- */
  function replaceColor(s, w, h, p) {
    const t = hex3(p.color), tl = rgb2lab(t[0], t[1], t[2]), fz = Math.max(1, p.fuzziness);
    const out = new Uint8ClampedArray(s.length), hs = p.hue / 360, sd = p.saturation / 100, ld = p.lightness / 100;
    for (let i = 0; i < s.length; i += 4) {
      const r = s[i], g = s[i + 1], b = s[i + 2], l = rgb2lab(r, g, b);
      const dE = Math.hypot(l[0] - tl[0], l[1] - tl[1], l[2] - tl[2]), wgt = Math.max(0, 1 - dE / (fz * 0.6));
      if (wgt <= 0) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = s[i + 3]; continue; }
      let [H, S, Lh] = FX.rgb2hsl(r, g, b);
      H = (H + hs + 1) % 1; S = Math.max(0, Math.min(1, sd >= 0 ? S + (1 - S) * sd : S * (1 + sd))); Lh = Math.max(0, Math.min(1, ld >= 0 ? Lh + (1 - Lh) * ld : Lh * (1 + ld)));
      const c = FX.hsl2rgb(H, S, Lh);
      out[i] = clamp(r + (c[0] - r) * wgt); out[i + 1] = clamp(g + (c[1] - g) * wgt); out[i + 2] = clamp(b + (c[2] - b) * wgt); out[i + 3] = s[i + 3];
    }
    return out;
  }
  function matchColor(s, w, h, p) {
    const src = p.source && p.source.stats, tgt = labStats(s);
    if (!tgt || (!src && !p.neutralize)) return Uint8ClampedArray.from(s);
    const lum = p.luminance / 100, inten = p.intensity / 100, fade = p.fade / 100;
    const sm = src ? src.mean : [tgt.mean[0], 0, 0], ss = src ? src.sd : tgt.sd;
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) {
      const v = rgb2lab(s[i], s[i + 1], s[i + 2]);
      let L = (v[0] - tgt.mean[0]) * (ss[0] / tgt.sd[0]) + sm[0];
      let A = (v[1] - tgt.mean[1]) * (ss[1] / tgt.sd[1]) + sm[1], B = (v[2] - tgt.mean[2]) * (ss[2] / tgt.sd[2]) + sm[2];
      if (p.neutralize) { A -= src ? sm[1] * 0.5 : tgt.mean[1]; B -= src ? sm[2] * 0.5 : tgt.mean[2]; }
      L = L * lum; A *= inten; B *= inten;
      const c = lab2rgb(L, A, B);
      for (let k = 0; k < 3; k++) out[i + k] = clamp(c[k] + (s[i + k] - c[k]) * fade);
      out[i + 3] = s[i + 3];
    }
    return out;
  }

  /* ---------------- Color Lookup ---------------- */
  const LUTS = new Map();                 // "lut:<name>" -> parsed .cube   (filled by the page; tests set it directly)
  const LOOKS = () => (root.H3ClipFx && root.H3ClipFx.LOOKS) || (isNode ? (() => { try { return require("../../static/clipfx.js").LOOKS; } catch (e) { return {}; } })() : {});
  const CFX = () => root.H3ClipFx || (isNode ? (() => { try { return require("../../static/clipfx.js"); } catch (e) { return null; } })() : null);
  const tableCache = new Map();
  /** a 33³ RGB table for "look:<name>" / "lut:<name>" (null = not known / not loaded yet) */
  function tableOf(key) {
    if (!key) return null;
    if (tableCache.has(key)) return tableCache.get(key);
    const C = CFX(); if (!C) return null;
    let t = null;
    if (key.startsWith("look:")) { const g = LOOKS()[key.slice(5)]; if (g) t = C.buildLut({ grade: g }, null, 33); }
    else if (key.startsWith("lut:")) { const L = LUTS.get(key); if (L) t = C.buildLut({ lut: key, lut_mix: 1 }, L, 33); }
    if (t) tableCache.set(key, t);
    return t;
  }
  function sampleTable(T, N, r, g, b, out) {
    const x = r / 255 * (N - 1), y = g / 255 * (N - 1), z = b / 255 * (N - 1);
    const x0 = x | 0, y0 = y | 0, z0 = z | 0, x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), z1 = Math.min(N - 1, z0 + 1), fx = x - x0, fy = y - y0, fz = z - z0;
    for (let c = 0; c < 3; c++) {
      const at = (i, j, k) => T[((k * N + j) * N + i) * 3 + c];
      const a = at(x0, y0, z0) * (1 - fx) + at(x1, y0, z0) * fx, b2 = at(x0, y1, z0) * (1 - fx) + at(x1, y1, z0) * fx;
      const c2 = at(x0, y0, z1) * (1 - fx) + at(x1, y0, z1) * fx, d = at(x0, y1, z1) * (1 - fx) + at(x1, y1, z1) * fx;
      out[c] = ((a * (1 - fy) + b2 * fy) * (1 - fz) + (c2 * (1 - fy) + d * fy) * fz) * 255;
    }
    return out;
  }
  function colorLookup(s, w, h, p) {
    const T = tableOf(p.lut); if (!T) return Uint8ClampedArray.from(s);
    const out = new Uint8ClampedArray(s.length), mix = p.opacity / 100, o = [0, 0, 0];
    for (let i = 0; i < s.length; i += 4) {
      sampleTable(T, 33, s[i], s[i + 1], s[i + 2], o);
      out[i] = clamp(s[i] + (o[0] - s[i]) * mix); out[i + 1] = clamp(s[i + 1] + (o[1] - s[i + 1]) * mix); out[i + 2] = clamp(s[i + 2] + (o[2] - s[i + 2]) * mix); out[i + 3] = s[i + 3];
    }
    return out;
  }

  /* ---------------- Apply Image ---------------- */
  const SOURCES = new Map();              // layer id | "merged" -> {data (the picture's size), W, H}  (the page fills it)
  const BLENDS = ["normal", "multiply", "screen", "overlay", "add", "subtract", "difference", "darken", "lighten", "soft light", "hard light"];
  function blendOne(mode, a, b) {            // a = the layer, b = the source, 0..255
    switch (mode) {
      case "multiply": return a * b / 255;
      case "screen": return 255 - (255 - a) * (255 - b) / 255;
      case "overlay": return a < 128 ? 2 * a * b / 255 : 255 - 2 * (255 - a) * (255 - b) / 255;
      case "add": return a + b;
      case "subtract": return a - b;
      case "difference": return Math.abs(a - b);
      case "darken": return Math.min(a, b);
      case "lighten": return Math.max(a, b);
      case "soft light": { const A = a / 255, B = b / 255; return 255 * (B < 0.5 ? A - (1 - 2 * B) * A * (1 - A) : A + (2 * B - 1) * ((A < 0.25 ? ((16 * A - 12) * A + 4) * A : Math.sqrt(A)) - A)); }
      case "hard light": return b < 128 ? 2 * a * b / 255 : 255 - 2 * (255 - a) * (255 - b) / 255;
      default: return b;
    }
  }
  function applyImage(s, w, h, p, ctx) {
    const src = SOURCES.get(String(p.source || "")); if (!src) return Uint8ClampedArray.from(s);
    const ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0, out = new Uint8ClampedArray(s.length), op = p.opacity / 100, ch = p.channel;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, sx = x + ox, sy = y + oy;
      if (sx >= src.W || sy >= src.H) { for (let c = 0; c < 4; c++) out[i + c] = s[i + c]; continue; }
      const j = (sy * src.W + sx) * 4, sa = src.data[j + 3] / 255;
      let v = null;
      if (ch === "red") v = src.data[j]; else if (ch === "green") v = src.data[j + 1]; else if (ch === "blue") v = src.data[j + 2];
      else if (ch === "alpha") v = src.data[j + 3]; else if (ch === "luminosity") v = luma(src.data[j], src.data[j + 1], src.data[j + 2]);
      for (let c = 0; c < 3; c++) {
        let b = v == null ? src.data[j + c] : v; if (p.invert) b = 255 - b;
        const k = op * (ch === "alpha" ? 1 : sa);
        out[i + c] = clamp(s[i + c] + (blendOne(p.blending, s[i + c], b) - s[i + c]) * k);
      }
      out[i + 3] = p.preserve ? s[i + 3] : Math.max(s[i + 3], Math.round(sa * 255 * op));
    }
    return out;
  }

  /* ---------------- the list ---------------- */
  const FILTERS2 = [
    { id: "colorlookup", group: "Adjustments", after: "channelmixer", name: "Color Lookup",
      params: [{ id: "lut", label: "3D LUT", type: "lutpick", def: "" }, N("opacity", "Amount (%)", 0, 100, 1, 100)], apply: colorLookup },
    { id: "selectivecolor", group: "Adjustments", after: "gradientmap", name: "Selective Color",
      params: [{ id: "sel", label: "Colors", type: "selcolor", def: emptySel() }], apply: (s, w, h, p) => selectiveColor(s, p) },
    { id: "shadowshighlights", group: "Adjustments", after: "selectivecolor", name: "Shadows / Highlights",
      params: [N("shadows", "Shadows: amount (%)", 0, 100, 1, 35), N("stone", "Shadows: tone (%)", 1, 100, 1, 50), N("sradius", "Shadows: radius (px)", 0, 500, 1, 30),
        N("highlights", "Highlights: amount (%)", 0, 100, 1, 0), N("htone", "Highlights: tone (%)", 1, 100, 1, 50), N("hradius", "Highlights: radius (px)", 0, 500, 1, 30),
        N("color", "Color correction", -100, 100, 1, 20), N("midtone", "Midtone contrast", -100, 100, 1, 0)],
      pad: (p) => Math.ceil(Math.max(p.sradius, p.hradius) * 1.5), apply: shadowsHighlights },
    { id: "hdrtoning", group: "Adjustments", after: "shadowshighlights", name: "HDR Toning",
      params: [N("radius", "Edge glow: radius (px)", 1, 500, 1, 60), N("strength", "Edge glow: strength (%)", 0, 100, 1, 50), N("gamma", "Gamma", 0.1, 3, 0.05, 1),
        N("exposure", "Exposure (stops)", -3, 3, 0.05, 0), N("detail", "Detail (%)", -100, 300, 1, 30), N("vibrance", "Vibrance (%)", -100, 100, 1, 0), N("saturation", "Saturation (%)", -100, 100, 1, 20)],
      pad: (p) => Math.ceil(p.radius * 1.5), apply: hdrToning },
    { id: "matchcolor", group: "Adjustments", after: "desaturate", name: "Match Color",
      params: [{ id: "source", label: "Source", type: "layerstats", def: null }, N("luminance", "Luminance (%)", 1, 200, 1, 100), N("intensity", "Color intensity (%)", 1, 200, 1, 100),
        N("fade", "Fade (%)", 0, 100, 1, 0), CHK("neutralize", "Neutralize (take the colour cast out)", false)], apply: matchColor },
    { id: "replacecolor", group: "Adjustments", after: "matchcolor", name: "Replace Color",
      params: [COL("color", "Colour (click the picture)", "#ff0000", { eyedrop: true }), N("fuzziness", "Fuzziness", 1, 200, 1, 40),
        N("hue", "Hue", -180, 180, 1, 0), N("saturation", "Saturation", -100, 100, 1, 0), N("lightness", "Lightness", -100, 100, 1, 0)], apply: replaceColor },
    { id: "applyimage", group: "Image", name: "Apply Image",
      params: [{ id: "source", label: "Source layer", type: "layerpick", def: "merged" }, SEL("channel", "Channel", ["rgb", "red", "green", "blue", "alpha", "luminosity"], "rgb"), CHK("invert", "Invert", false),
        SEL("blending", "Blending", BLENDS, "multiply"), N("opacity", "Opacity (%)", 0, 100, 1, 100), CHK("preserve", "Preserve transparency", true)], apply: applyImage },
  ];
  const ADJ2 = [["colorlookup", "Color Lookup", "▣", "channelmixer"], ["selectivecolor", "Selective Color", "◈", "gradientmap"]];

  /** put the new ones into the editor's lists (once): FILTERS in Photoshop's order, the adjustment layer kinds */
  function register(fx, D) {
    if (!fx || fx.__filters2) return;
    fx.__filters2 = true;
    for (const f of FILTERS2) {
      if (fx.byId(f.id)) continue;
      const k = f.after ? fx.FILTERS.findIndex((x) => x.id === f.after) : -1;
      if (k >= 0) fx.FILTERS.splice(k + 1, 0, f); else fx.FILTERS.push(f);
    }
    if (D && D.ADJ_KINDS) for (const [id, n, ic, after] of ADJ2) {
      if (D.ADJ_KINDS.some((x) => x[0] === id)) continue;
      const k = D.ADJ_KINDS.findIndex((x) => x[0] === after);
      if (k >= 0) D.ADJ_KINDS.splice(k + 1, 0, [id, n, ic]); else D.ADJ_KINDS.push([id, n, ic]);
    }
  }

  /* ---------------- the page: the parameter kinds, Apply Image, the LUTs ---------------- */
  function install(E) {
    const { S } = E, doc = E.doc || root.document, win = doc.defaultView || root;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const say = (t) => (E.say ? E.say(t) : null);
    E.paramTypes = E.paramTypes || {};
    let lutList = null;
    async function lutLib() { if (lutList) return lutList; try { const j = await (await win.fetch("/api/luts")).json(); lutList = (j.luts || []).map((x) => x.name || x); } catch (e) { lutList = []; } return lutList; }
    async function ensureLut(key) {
      if (!key || !key.startsWith("lut:") || LUTS.has(key)) return true;
      try { const t = await (await win.fetch("/api/luts/" + encodeURIComponent(key.slice(4)))).text(); LUTS.set(key, CFX().parseCube(t)); tableCache.delete(key); return true; }
      catch (e) { say("could not load the LUT " + key.slice(4) + ": " + e.message); return false; }
    }
    // an adjustment layer whose LUT is not loaded yet draws again when it arrives
    const pending = new Set();
    E.ensureLut = (key) => { if (!key || LUTS.has(key) || pending.has(key)) return; pending.add(key); ensureLut(key).then((ok) => { pending.delete(key); if (ok) { E.renderLayers && E.renderLayers(); E.refresh && E.refresh(); } }); };
    const scanLuts = () => { for (const L of S.layers || []) if (L.type === "adjust" && L.adj && L.adj.kind === "colorlookup") E.ensureLut((L.adj.params || {}).lut); };
    win.setInterval(scanLuts, 1500);
    /* ---- selcolor ---- */
    E.paramTypes.selcolor = {
      html: (q, v) => `<div class="rw" data-pt="selcolor" data-pid="${q.id}" style="display:block"><div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><label style="flex:none">${esc(q.label)}</label>
        <select class="scR" style="flex:1">${RANGES.map((k) => `<option value="${k}">${RANGE_NAMES[k]}</option>`).join("")}</select></div>
        ${[["c", "Cyan"], ["m", "Magenta"], ["y", "Yellow"], ["k", "Black"]].map(([k, n]) => `<div class="rw"><label>${n} (%)</label><input type="range" class="scS" data-k="${k}" min="-100" max="100" step="1" value="0"><input type="number" class="scN" data-k="${k}" min="-100" max="100" value="0"></div>`).join("")}
        <div class="rw"><span>Method</span><label><input type="radio" name="scM${q.id}" value="relative"> Relative</label><label><input type="radio" name="scM${q.id}" value="absolute"> Absolute</label></div></div>`,
      bind(el, q, params, changed) {
        if (!params[q.id] || !params[q.id].ranges) params[q.id] = emptySel();
        const v = () => params[q.id], rsel = el.querySelector(".scR");
        const show = () => { const R = v().ranges[rsel.value]; el.querySelectorAll(".scS,.scN").forEach((i) => { i.value = R[i.dataset.k]; }); el.querySelectorAll("input[type=radio]").forEach((r) => { r.checked = r.value === v().mode; }); };
        rsel.onchange = show;
        el.querySelectorAll(".scS,.scN").forEach((i) => { i.oninput = i.onchange = (ev) => { const R = v().ranges[rsel.value]; R[i.dataset.k] = Math.max(-100, Math.min(100, +i.value || 0)); el.querySelectorAll(`[data-k="${i.dataset.k}"]`).forEach((o) => { if (o !== i) o.value = R[i.dataset.k]; }); changed(ev.type === "change"); }; });
        el.querySelectorAll("input[type=radio]").forEach((r) => { r.onchange = () => { v().mode = r.value; changed(true); }; });
        show();
      },
    };
    /* ---- lutpick ---- */
    E.paramTypes.lutpick = {
      html: (q, v) => `<div class="rw" data-pt="lutpick" data-pid="${q.id}"><label>${esc(q.label)}</label><select class="lpS" style="min-width:0"><option value="">(none)</option></select><button type="button" class="ghost lpL" title="Load a .cube file into the LUT library (the timeline's too)">＋ .cube…</button></div>`,
      bind(el, q, params, changed) {
        const sel = el.querySelector(".lpS");
        const fill = async () => {
          const looks = Object.keys(LOOKS()), luts = await lutLib();
          sel.innerHTML = `<option value="">(none)</option>` + (looks.length ? `<optgroup label="Looks">${looks.map((n) => `<option value="look:${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>` : "")
            + (luts.length ? `<optgroup label="LUT library">${luts.map((n) => `<option value="lut:${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>` : "");
          sel.value = params[q.id] || "";
        };
        fill();
        sel.onchange = async () => { const k = sel.value; if (await ensureLut(k)) { params[q.id] = k; changed(true); } };
        el.querySelector(".lpL").onclick = () => {
          const inp = doc.createElement("input"); inp.type = "file"; inp.accept = ".cube";
          inp.onchange = async () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            const text = await f.text();
            try { CFX().parseCube(text); } catch (e) { return say("not a 3D .cube LUT: " + e.message); }
            const name = f.name.replace(/[^A-Za-z0-9 ._()-]+/g, "_");
            try { const r = await (await win.fetch("/api/luts?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "text/plain" }, body: text })).json(); if (r.error) throw new Error(r.error); } catch (e) { return say("could not keep the LUT: " + e.message); }
            lutList = null; await fill();
            const saved = (lutList || []).find((n) => n === name || n.replace(/\.cube$/i, "") === name.replace(/\.cube$/i, "")) || name;
            sel.value = "lut:" + saved; await ensureLut(sel.value); params[q.id] = sel.value; changed(true);
          };
          inp.style.display = "none"; doc.body.appendChild(inp); inp.addEventListener("change", () => setTimeout(() => inp.remove(), 0)); inp.click();
        };
      },
    };
    /* ---- layer sources (Match Color's statistics, Apply Image's pixels) ---- */
    const layerName = (L) => L.name || L.type;
    function pixelsOf(id) {
      if (id === "merged") { const c = E.flatten(); return { data: c.getContext("2d").getImageData(0, 0, S.w, S.h).data, W: S.w, H: S.h }; }
      const L = (S.layers || []).find((x) => String(x.id) === String(id));
      if (!L || !L.canvas) return null;
      const c = doc.createElement("canvas"); c.width = S.w; c.height = S.h;
      const g = c.getContext("2d"); g.drawImage(L.canvas, L.x || 0, L.y || 0);
      return { data: g.getImageData(0, 0, S.w, S.h).data, W: S.w, H: S.h };
    }
    const options = (cur, exceptActive) => {
      const act = S.layers && S.layers[S.active];
      return `<option value="merged"${cur === "merged" ? " selected" : ""}>The merged picture</option>` + (S.layers || []).slice().reverse()
        .filter((L) => L.canvas && L.type !== "group" && L.type !== "adjust" && !(exceptActive && L === act))
        .map((L) => `<option value="${esc(L.id)}"${String(cur) === String(L.id) ? " selected" : ""}>${esc(layerName(L))}</option>`).join("");
    };
    E.paramTypes.layerstats = {
      html: (q, v) => `<div class="rw" data-pt="layerstats" data-pid="${q.id}"><label>${esc(q.label)}</label><select class="lsS" style="min-width:0"><option value="">(none)</option>${options(v && v.id, true)}</select><button type="button" class="ghost lsF" title="A picture file as the source">🖼…</button></div>`,
      bind(el, q, params, changed) {
        const sel = el.querySelector(".lsS");
        if (params[q.id] && params[q.id].id) sel.value = params[q.id].id;
        sel.onchange = () => {
          if (!sel.value) { params[q.id] = null; return changed(true); }
          const px = pixelsOf(sel.value); const st = px && labStats(px.data);
          params[q.id] = st ? { id: sel.value, name: sel.options[sel.selectedIndex].text, stats: st } : null; changed(true);
        };
        el.querySelector(".lsF").onclick = () => {
          const inp = doc.createElement("input"); inp.type = "file"; inp.accept = "image/*,.jxl";
          inp.onchange = async () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            try {
              const bmp = await win.createImageBitmap(f), k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height)), c = doc.createElement("canvas");
              c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k)); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
              const st = labStats(c.getContext("2d").getImageData(0, 0, c.width, c.height).data);
              const o = doc.createElement("option"); o.value = "file:" + f.name; o.textContent = "🖼 " + f.name; sel.appendChild(o); sel.value = o.value;
              params[q.id] = st ? { id: o.value, name: f.name, stats: st } : null; changed(true);
            } catch (e) { say("could not read that picture: " + e.message); }
          };
          inp.style.display = "none"; doc.body.appendChild(inp); inp.addEventListener("change", () => setTimeout(() => inp.remove(), 0)); inp.click();
        };
      },
    };
    E.paramTypes.layerpick = {
      html: (q, v) => `<div class="rw" data-pt="layerpick" data-pid="${q.id}"><label>${esc(q.label)}</label><select class="lpk" style="grid-column:2/4;min-width:0">${options(v, false)}</select></div>`,
      bind(el, q, params, changed) {
        const sel = el.querySelector(".lpk");
        const load = () => { const px = pixelsOf(sel.value || "merged"); if (px) SOURCES.set(String(sel.value || "merged"), px); };
        if (params[q.id] != null) sel.value = String(params[q.id]);
        if (!sel.value) sel.value = "merged";
        params[q.id] = sel.value; load();
        sel.onchange = () => { params[q.id] = sel.value; load(); changed(true); };
      },
    };
    // Image ▸ Apply Image…
    if (E.ui && E.ui.addCmd) E.ui.addCmd("image.applyimage", "Apply Image…", "", () => E.openFilter("applyimage"), { enabled: () => !!(S.w && S.layers[S.active]) }, ["Image", "image.trim"]);
    E.filters2 = { LUTS, SOURCES, labStats, ensureLut };
  }

  const api = { FILTERS2, RANGES, RANGE_NAMES, emptySel, selWeights, rgb2lab, lab2rgb, labStats, tableOf, LUTS, SOURCES, BLENDS, blendOne, register, install };
  if (isNode) { module.exports = api; }
  else { root.IEFilters2 = api; register(root.IEFilters, root.PCDoc); }
})(typeof window !== "undefined" ? window : globalThis);
