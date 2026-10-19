/* filters5.js — THE DEVELOP FILTER + LENS CORRECTION (2.482.0): the image editor's gap, round C. window.IEFilters5.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Filter ▸ Develop Filter… (Alt+Shift+Ctrl+A)   a photo developer in one dialog, in tabs:
 *     Basic       white balance (temperature, tint), exposure, contrast, highlights, shadows, whites, blacks,
 *                 texture, clarity, dehaze, vibrance, saturation; Black & White; ✨ Auto (from the histogram)
 *     Curve       highlights / lights / darks / shadows (parametric) + a point curve (RGB, R, G, B)
 *     Color       the colour mixer: red, orange, yellow, green, aqua, blue, purple, magenta x hue / saturation /
 *                 luminance (in Black & White: how light each colour turns)
 *     Grading     shadows / midtones / highlights: hue, saturation, luminance; blending, balance
 *     Detail      sharpening (amount, radius, detail, masking), noise reduction (luminance, colour)
 *     Optics      distortion, vignetting (amount, midpoint), defringe (purple / green fringe amounts)
 *     Geometry    vertical / horizontal perspective, rotate, scale, offset
 *     Effects     grain (amount, size, roughness), a vignette after the crop (amount, midpoint, roundness, feather)
 *     Presets     built-in looks + your own (kept in this editor's settings)
 *   Filter ▸ Lens Correction… (Alt+Shift+Ctrl+R)   distortion (barrel / pincushion), chromatic aberration (red / cyan,
 *     blue / yellow), vignette (amount, midpoint), transform (vertical / horizontal perspective, angle, scale),
 *     the edge (transparent, edge extension, a colour) and a grid over the preview
 * Both are filters like the rest (live preview, the selection, smart filters, Ctrl+F, Actions). Pure (Node:
 * scripts/test-filters5.js): develop(s, w, h, p, ctx), lensCorrect, autoBasic(stats), DEV_DEFAULT, PRESETS, hueBand.
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const FX = isNode ? require("./filters.js") : root.IEFilters;
  const F3 = isNode ? require("./filters3.js") : root.IEFilters3;
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v), c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const N = (id, label, min, max, step, def) => ({ id, label, type: "range", min, max, step, def });
  const SEL = (id, label, options, def) => ({ id, label, type: "select", options, def });
  const CHK = (id, label, def) => ({ id, label, type: "check", def });
  const COL = (id, label, def) => ({ id, label, type: "color", def });
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const smooth = (e0, e1, x) => { const t = c01((x - e0) / (e1 - e0 || 1)); return t * t * (3 - 2 * t); };

  /* ---------------- the settings ---------------- */
  const HUES = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"];
  const HUE_AT = { red: 0, orange: 30, yellow: 60, green: 120, aqua: 180, blue: 225, purple: 275, magenta: 315 };
  const DEV_DEFAULT = () => ({
    temp: 0, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, texture: 0, clarity: 0, dehaze: 0, vibrance: 0, saturation: 0, bw: false,
    pHigh: 0, pLight: 0, pDark: 0, pShadow: 0, curve: null,
    mix: Object.fromEntries(HUES.map((h) => [h, { h: 0, s: 0, l: 0 }])),
    grade: { sh: { h: 220, s: 0, l: 0 }, mid: { h: 30, s: 0, l: 0 }, hi: { h: 45, s: 0, l: 0 }, blending: 50, balance: 0 },
    sharpen: 0, sRadius: 1, sDetail: 25, sMask: 0, nrLum: 0, nrColor: 0,
    distortion: 0, vignette: 0, vMid: 50, fringePurple: 0, fringeGreen: 0,
    vert: 0, horiz: 0, rotate: 0, scale: 100, offX: 0, offY: 0,
    grain: 0, grainSize: 25, grainRough: 50, pcVig: 0, pcMid: 50, pcRound: 0, pcFeather: 50,
  });
  const PRESETS = {
    "Vivid": { contrast: 20, vibrance: 35, saturation: 8, clarity: 12, blacks: -8 },
    "Matte": { contrast: -18, blacks: 30, pShadow: 18, saturation: -12, grain: 12 },
    "Warm film": { temp: 18, tint: 4, contrast: 10, highlights: -15, grain: 20, pcVig: -18, grade: { sh: { h: 200, s: 12, l: 0 }, mid: { h: 30, s: 10, l: 0 }, hi: { h: 45, s: 14, l: 0 }, blending: 50, balance: 0 } },
    "Cool night": { temp: -25, exposure: -0.3, contrast: 15, saturation: -10, pcVig: -25 },
    "Portrait soft": { clarity: -18, texture: -12, highlights: -10, vibrance: 10, mix: { orange: { h: 0, s: -8, l: 10 } } },
    "Landscape punch": { dehaze: 18, clarity: 25, vibrance: 30, highlights: -30, shadows: 25, mix: { blue: { h: 0, s: 15, l: -12 }, green: { h: 0, s: 12, l: 0 } } },
    "Black & White": { bw: true, contrast: 20, clarity: 10, mix: { red: { h: 0, s: 0, l: 10 }, blue: { h: 0, s: 0, l: -20 } } },
    "Teal & orange": { contrast: 12, grade: { sh: { h: 190, s: 28, l: 0 }, mid: { h: 30, s: 0, l: 0 }, hi: { h: 35, s: 22, l: 0 }, blending: 60, balance: 0 }, mix: { orange: { h: 0, s: 15, l: 5 }, aqua: { h: 12, s: 10, l: 0 } } },
  };
  /** a preset on top of the defaults (nested objects merged) */
  function withPreset(name) {
    const d = DEV_DEFAULT(), p = PRESETS[name] || {};
    for (const [k, v] of Object.entries(p)) {
      if (k === "mix") for (const [h, x] of Object.entries(v)) d.mix[h] = Object.assign({}, d.mix[h], x);
      else if (v && typeof v === "object") d[k] = JSON.parse(JSON.stringify(v));
      else d[k] = v;
    }
    return d;
  }
  // each colour's band reaches to its nearest neighbour (red / orange / yellow are 30° apart, the others wider)
  const BAND = Object.fromEntries(Object.keys(HUE_AT).map((k) => [k, Math.min(...Object.keys(HUE_AT).filter((j) => j !== k).map((j) => { const d = Math.abs(HUE_AT[k] - HUE_AT[j]); return Math.min(d, 360 - d); }))]));
  /** a hue's share of the band around each mixer colour (0..1, they sum to ~1) */
  function hueBand(hdeg) {
    const out = {}; let sum = 0;
    for (const k of HUES) { let d = Math.abs(hdeg - HUE_AT[k]); d = Math.min(d, 360 - d); const w = Math.max(0, 1 - d / BAND[k]); out[k] = w; sum += w; }
    if (sum > 0) for (const k of HUES) out[k] /= sum;
    return out;
  }
  /** ✨ Auto: exposure / contrast / whites / blacks / highlights / shadows from the picture's luminance histogram */
  function autoBasic(s) {
    const hist = new Float64Array(256); let n = 0;
    for (let i = 0; i < s.length; i += 4) { if (s[i + 3] < 8) continue; hist[Math.round(luma(s[i], s[i + 1], s[i + 2]))]++; n++; }
    if (!n) return {};
    const pct = (q) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= q * n) return v; } return 255; };
    const lo = pct(0.005), hi = pct(0.995), med = pct(0.5);
    const exposure = Math.max(-2, Math.min(2, Math.log2(118 / Math.max(8, med)) * 0.8));
    return { exposure: +exposure.toFixed(2), whites: Math.round(Math.max(-50, Math.min(60, (250 - hi) * 0.5))), blacks: Math.round(Math.max(-60, Math.min(50, (5 - lo) * 0.6))),
      contrast: Math.round(Math.max(-20, Math.min(30, (180 - (hi - lo)) * 0.15))), highlights: hi > 245 ? -25 : 0, shadows: lo < 10 ? 20 : 0 };
  }

  /* ---------------- geometry: one map for distortion, perspective, rotation, scale ---------------- */
  /** dest (x, y) -> source point, in the whole picture's coordinates */
  function geomMap(W, H, g) {
    const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy), a = (g.rotate || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), sc = (g.scale || 100) / 100;
    const kd = -(g.distortion || 0) / 100 * 0.35, pv = (g.vert || 0) / 100 * 0.6, ph = (g.horiz || 0) / 100 * 0.6, ox = (g.offX || 0) / 100 * W, oy = (g.offY || 0) / 100 * H;
    return (x, y) => {
      let u = (x - cx - ox) / sc, v = (y - cy - oy) / sc;
      const ru = u * ca + v * sa, rv = -u * sa + v * ca; u = ru; v = rv;                     // rotate (the picture turns by +angle)
      const yn = v / cy, xn = u / cx;                                                         // perspective: widen / narrow one end
      u = u * (1 + pv * yn); v = v * (1 + ph * xn);
      const r2 = (u * u + v * v) / (R * R), f = 1 + kd * r2;                                  // barrel (+) / pincushion (-)
      return [cx + u * f, cy + v * f];
    };
  }
  function geomOn(g) { return !!(g.distortion || g.vert || g.horiz || g.rotate || (g.scale && g.scale !== 100) || g.offX || g.offY); }
  function remap(s, w, h, map, ctx, edge, edgeColor) {
    const ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0, out = new Uint8ClampedArray(s.length), px = [0, 0, 0, 0], ec = edgeColor || [0, 0, 0];
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [sx0, sy0] = map(x + ox, y + oy), sx = sx0 - ox, sy = sy0 - oy, i = (y * w + x) * 4;
      const outside = sx0 < -0.5 || sy0 < -0.5 || sx0 > W - 0.5 || sy0 > H - 0.5;
      if (outside && edge === "transparent") continue;
      if (outside && edge === "color") { out[i] = ec[0]; out[i + 1] = ec[1]; out[i + 2] = ec[2]; out[i + 3] = 255; continue; }
      F3.sampleAt(s, w, h, sx, sy, px);
      out[i] = px[0]; out[i + 1] = px[1]; out[i + 2] = px[2]; out[i + 3] = px[3];
    }
    return out;
  }
  /** chromatic aberration: red and blue scaled from the centre against green */
  function caFix(s, w, h, rc, by, ctx) {
    if (!rc && !by) return s;
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h, ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0, cx = W / 2, cy = H / 2;
    const kr = 1 + rc / 100 * 0.01, kb = 1 + by / 100 * 0.01, out = Uint8ClampedArray.from(s), px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x + ox - cx, Y = y + oy - cy, i = (y * w + x) * 4;
      F3.sampleAt(s, w, h, cx + X * kr - ox, cy + Y * kr - oy, px); out[i] = px[0];
      F3.sampleAt(s, w, h, cx + X * kb - ox, cy + Y * kb - oy, px); out[i + 2] = px[2];
    }
    return out;
  }
  /** a vignette multiplier: amount < 0 darkens the edges, > 0 lightens; midpoint = where it starts; roundness - 100
   *  (squarer) .. + 100 (a circle, not the picture's shape); feather = how soft */
  function vignetteMul(W, H, amount, mid, round, feather) {
    const cx = W / 2, cy = H / 2, m = 0.25 + (mid / 100) * 0.75, f = Math.max(0.05, (feather == null ? 50 : feather) / 100), rd = (round || 0) / 100;
    const pw = rd < 0 ? 2 - rd * 6 : 2, ax = rd > 0 ? 1 - rd + rd * W / Math.max(W, H) : 1, ay = rd > 0 ? 1 - rd + rd * H / Math.max(W, H) : 1;
    const corner = Math.pow(Math.pow(ax, pw) + Math.pow(ay, pw), 1 / pw);
    return (x, y) => {
      const dx = Math.abs((x - cx) / cx) * ax, dy = Math.abs((y - cy) / cy) * ay, d = Math.pow(Math.pow(dx, pw) + Math.pow(dy, pw), 1 / pw) / corner;
      return 1 + amount / 100 * smooth(m - f / 2, m + f / 2, d);
    };
  }

  /* ---------------- tone + colour, one pixel at a time ---------------- */
  function toneLut(p) {
    // contrast + highlights / shadows / whites / blacks + the parametric curve - a 1D table on a 0..1 perceptual luminance
    const T = new Float32Array(1024), ct = p.contrast / 100;
    const pc = FX.curveLut && p.curve ? { rgb: FX.curveLut(p.curve.rgb), r: FX.curveLut(p.curve.r), g: FX.curveLut(p.curve.g), b: FX.curveLut(p.curve.b) } : null;
    const sig = (v) => 1 / (1 + Math.exp(-(v - 0.5) * 8)), s0 = sig(0), s1 = sig(1), sgm = (v) => (sig(v) - s0) / (s1 - s0);
    const bump = (x, c, wd) => Math.max(0, 1 - Math.abs(x - c) / wd);
    for (let k = 0; k < 1024; k++) {
      let x = k / 1023;
      x += (p.blacks / 100) * 0.2 * (1 - smooth(0, 0.35, x));
      x += (p.whites / 100) * 0.2 * smooth(0.65, 1, x);
      x += (p.shadows / 100) * 0.3 * bump(x, 0.25, 0.25);
      x += (p.highlights / 100) * 0.3 * bump(x, 0.75, 0.25);
      if (ct > 0) x = x + (sgm(c01(x)) - x) * ct; else if (ct < 0) x = 0.5 + (x - 0.5) * (1 + ct * 0.7);
      x += (p.pShadow / 100) * 0.25 * bump(x, 0.15, 0.15) + (p.pDark / 100) * 0.25 * bump(x, 0.38, 0.2) + (p.pLight / 100) * 0.25 * bump(x, 0.62, 0.2) + (p.pHigh / 100) * 0.25 * bump(x, 0.85, 0.15);
      T[k] = c01(x);
    }
    return { T, pc };
  }
  function hsl(r, g, b) { return FX.rgb2hsl(r * 255, g * 255, b * 255); }
  function develop(s, w, h, p0, ctx) {
    const p = Object.assign(DEV_DEFAULT(), p0 && p0.dev ? p0.dev : p0 || {});
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h, ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0;
    let src = s;
    if (geomOn(p)) src = remap(src, w, h, geomMap(W, H, p), ctx, "edge");
    if (p.fringePurple || p.fringeGreen) src = caFix(src, w, h, p.fringePurple * 0.6, -p.fringeGreen * 0.6, ctx);
    // local contrast bases (clarity, texture, dehaze)
    const n = w * h, needClar = p.clarity || p.texture || p.dehaze;
    let Lb = null, Lt = null;
    if (needClar) {
      const L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = luma(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) / 255;
      Lb = p.clarity || p.dehaze ? FX.gaussPlanes([L], w, h, Math.max(2, Math.min(W, H) / 60))[0] : null;
      Lt = p.texture ? FX.gaussPlanes([L], w, h, 2)[0] : null;
    }
    const { T, pc } = toneLut(p), ev = Math.pow(2, p.exposure), tK = p.temp / 100, tT = p.tint / 100;
    const wbOn = !!(p.temp || p.tint || p.exposure), toneOn = !!(p.contrast || p.highlights || p.shadows || p.whites || p.blacks || p.pHigh || p.pLight || p.pDark || p.pShadow);
    const wbR = 1 + tK * 0.25 - tT * 0.05, wbG = 1 + tT * 0.2, wbB = 1 - tK * 0.25 - tT * 0.05;
    const mixOn = HUES.some((k) => p.mix[k] && (p.mix[k].h || p.mix[k].s || p.mix[k].l));
    const G = p.grade, gradeOn = G && (G.sh.s || G.mid.s || G.hi.s || G.sh.l || G.mid.l || G.hi.l);
    const tint = (hh, ss) => { const a = hh * Math.PI / 180; return [Math.cos(a) * ss, Math.cos(a - 2.094) * ss, Math.cos(a + 2.094) * ss]; };
    const tS = gradeOn ? tint(G.sh.h, G.sh.s / 100 * 0.25) : null, tM = gradeOn ? tint(G.mid.h, G.mid.s / 100 * 0.2) : null, tH = gradeOn ? tint(G.hi.h, G.hi.s / 100 * 0.25) : null;
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < n; i++) {
      const o = i * 4; let r = src[o] / 255, g = src[o + 1] / 255, b = src[o + 2] / 255;
      // white balance + exposure in (roughly) linear light
      if (wbOn) {
        r = Math.pow(r, 2.2) * wbR * ev; g = Math.pow(g, 2.2) * wbG * ev; b = Math.pow(b, 2.2) * wbB * ev;
        r = Math.pow(Math.max(0, r), 1 / 2.2); g = Math.pow(Math.max(0, g), 1 / 2.2); b = Math.pow(Math.max(0, b), 1 / 2.2);
      }
      // dehaze: lift the floor away, push contrast + saturation where it is flat
      if (p.dehaze) { const k = p.dehaze / 100, base = Lb[i], mn = Math.min(r, g, b) * 0.5 + base * 0.5, A = k * 0.35 * mn; r = (r - A) / (1 - A * 0.9); g = (g - A) / (1 - A * 0.9); b = (b - A) / (1 - A * 0.9); }
      // the tone curve on each channel (as film does: contrast also adds a little colour)
      const L0 = c01(luma(r, g, b));
      if (toneOn) { r = T[Math.round(c01(r) * 1023)]; g = T[Math.round(c01(g) * 1023)]; b = T[Math.round(c01(b) * 1023)]; }
      const L1 = c01(luma(r, g, b));
      // clarity / texture: local contrast, midtones mostly
      if (Lb && p.clarity) { const d = (L0 - Lb[i]) * p.clarity / 100 * 1.2 * (1 - Math.abs(L1 - 0.5) * 1.2); r += d; g += d; b += d; }
      if (Lt && p.texture) { const d = (L0 - Lt[i]) * p.texture / 100 * 1.5; r += d; g += d; b += d; }
      // the point curve
      if (pc) { r = pc.rgb[pc.r[clamp(Math.round(r * 255))]] / 255; g = pc.rgb[pc.g[clamp(Math.round(g * 255))]] / 255; b = pc.rgb[pc.b[clamp(Math.round(b * 255))]] / 255; }
      // the colour mixer
      if (mixOn || p.bw) {
        const [hh, ss, ll] = hsl(c01(r), c01(g), c01(b)), band = hueBand(hh * 360);
        let dh = 0, ds = 0, dl = 0; for (const key of HUES) { const m = p.mix[key]; if (!m || !band[key]) continue; dh += m.h * band[key]; ds += m.s * band[key]; dl += m.l * band[key]; }
        if (p.bw) { const y = c01(luma(c01(r), c01(g), c01(b)) + dl / 100 * 0.4 * ss); r = g = b = y; }
        else {
          const h2 = (hh + dh * 0.3 / 360 + 1) % 1, s2 = c01(ss * (1 + ds / 100)), l2 = c01(ll + dl / 100 * 0.25 * ss);
          const c = FX.hsl2rgb(h2, s2, l2); r = c[0] / 255; g = c[1] / 255; b = c[2] / 255;
        }
      }
      // colour grading: tints by tone
      if (gradeOn) {
        const Ly = c01(luma(r, g, b)), bal = G.balance / 100 * 0.25, bl = 0.15 + G.blending / 100 * 0.35;
        const ws = 1 - smooth(0, 0.5 + bal + bl * 0.5, Ly), wh = smooth(0.5 + bal - bl * 0.5, 1, Ly), wm = Math.max(0, 1 - ws - wh);
        r += tS[0] * ws + tM[0] * wm + tH[0] * wh + (G.sh.l * ws + G.mid.l * wm + G.hi.l * wh) / 100 * 0.15;
        g += tS[1] * ws + tM[1] * wm + tH[1] * wh + (G.sh.l * ws + G.mid.l * wm + G.hi.l * wh) / 100 * 0.15;
        b += tS[2] * ws + tM[2] * wm + tH[2] * wh + (G.sh.l * ws + G.mid.l * wm + G.hi.l * wh) / 100 * 0.15;
      }
      // vibrance + saturation
      if ((p.vibrance || p.saturation) && !p.bw) {
        const Ly = luma(r, g, b), mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
        const f = 1 + p.saturation / 100 + p.vibrance / 100 * (1 - sat) * 0.9;
        r = Ly + (r - Ly) * f; g = Ly + (g - Ly) * f; b = Ly + (b - Ly) * f;
      }
      out[o] = clamp(r * 255); out[o + 1] = clamp(g * 255); out[o + 2] = clamp(b * 255); out[o + 3] = src[o + 3];
    }
    let res = out;
    // detail: noise reduction, then sharpening (masked to the edges)
    if (p.nrLum > 0 || p.nrColor > 0) res = FX.run("reducenoise", res, w, h, { strength: Math.round(p.nrLum / 10), preserve: 50, color: p.nrColor, sharpen: 0 });
    if (p.sharpen > 0) {
      const bl = FX.gaussian(res, w, h, Math.max(1, p.sRadius * 2)), k = p.sharpen / 100 * 1.6, det = p.sDetail / 100, mask = p.sMask / 100, s2 = new Uint8ClampedArray(res.length);
      for (let i = 0; i < n; i++) {
        const o = i * 4, e = Math.abs(luma(res[o], res[o + 1], res[o + 2]) - luma(bl[o], bl[o + 1], bl[o + 2])) / 40, m = mask ? smooth(mask * 0.6, mask * 0.6 + 0.3, e) : 1;
        for (let c = 0; c < 3; c++) { let d = res[o + c] - bl[o + c]; d = d * (0.6 + det * 0.8); s2[o + c] = res[o + c] + d * k * m; }
        s2[o + 3] = res[o + 3];
      }
      res = s2;
    }
    // optics vignetting, effects: the after-crop vignette, grain
    if (p.vignette || p.pcVig || p.grain) {
      const vO = p.vignette ? vignetteMul(W, H, p.vignette, p.vMid, 0, 60) : null, vP = p.pcVig ? vignetteMul(W, H, p.pcVig, p.pcMid, p.pcRound, p.pcFeather) : null;
      const rnd = F3.rng(77), gs = Math.max(1, p.grainSize / 25), ga = p.grain / 100 * 60, rough = p.grainRough / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4, X = x + ox, Y = y + oy; let m = 1;
        if (vO) m *= vO(X, Y); if (vP) m *= vP(X, Y);
        let gn = 0; if (ga) { const q = ((Math.floor(X / gs) * 73856093) ^ (Math.floor(Y / gs) * 19349663)) >>> 0; gn = ((q % 1000) / 1000 - 0.5) * (1 - rough) + (rnd() - 0.5) * rough; gn *= ga; }
        for (let c = 0; c < 3; c++) res[o + c] = res[o + c] * m + gn;
      }
    }
    return res;
  }
  function lensCorrect(s, w, h, p, ctx) {
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h, ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0;
    let src = s;
    const g = { distortion: p.distortion, vert: p.vert, horiz: p.horiz, rotate: p.angle, scale: p.scale };
    if (geomOn(g)) src = remap(src, w, h, geomMap(W, H, g), ctx, p.edge === "transparent" ? "transparent" : p.edge === "background colour" ? "color" : "edge", FX.hex3(p.edgeColor));
    src = caFix(src, w, h, p.redcyan, p.blueyellow, ctx);
    if (p.vignette) {
      const v = vignetteMul(W, H, p.vignette, p.vMid, 0, 60), out = Uint8ClampedArray.from(src);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, m = v(x + ox, y + oy); for (let c = 0; c < 3; c++) out[o + c] = src[o + c] * m; }
      src = out;
    }
    return src === s ? Uint8ClampedArray.from(s) : src;
  }

  const FILTERS5 = [
    { id: "develop", group: "Develop", name: "Develop Filter", params: [{ id: "dev", label: "Develop", type: "develop", def: DEV_DEFAULT() }],
      pad: (p) => { const d = (p && p.dev) || {}; return Math.ceil(Math.max(d.clarity || d.dehaze ? 40 : 0, d.sharpen ? 3 : 0, d.nrLum ? 8 : 0, geomOn(d) || d.fringePurple || d.fringeGreen ? 9999 : 0)); },
      apply: (s, w, h, p, ctx) => develop(s, w, h, p.dev || DEV_DEFAULT(), ctx) },
    { id: "lenscorrection", group: "Develop", name: "Lens Correction", params: [N("distortion", "Remove distortion (+ barrel, − pincushion)", -100, 100, 1, 0),
        N("redcyan", "Fix red / cyan fringe", -100, 100, 1, 0), N("blueyellow", "Fix blue / yellow fringe", -100, 100, 1, 0), N("vignette", "Vignette amount", -100, 100, 1, 0), N("vMid", "Vignette midpoint", 0, 100, 1, 50),
        N("vert", "Vertical perspective", -100, 100, 1, 0), N("horiz", "Horizontal perspective", -100, 100, 1, 0), N("angle", "Angle (°)", -180, 180, 0.1, 0), N("scale", "Scale (%)", 50, 150, 1, 100),
        SEL("edge", "Edge", ["edge extension", "transparent", "background colour"], "edge extension"), COL("edgeColor", "Edge colour", "#000000"), CHK("grid", "Show the grid", true)],
      pad: () => 9999, apply: lensCorrect },
  ];
  function register(fx) {
    if (!fx || fx.__filters5) return;
    fx.__filters5 = true;
    for (const f of FILTERS5) if (!fx.byId(f.id)) fx.FILTERS.push(f);
  }

  /* ---------------- the page: the Develop panel, the commands, the grid ---------------- */
  function install(E) {
    const { S, store } = E, doc = E.doc || root.document;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    E.paramTypes = E.paramTypes || {};
    const R = (id, label, min, max, step) => ({ id, label, min, max, step: step || 1 });
    const TABS = {
      Basic: [R("temp", "Temperature", -100, 100), R("tint", "Tint", -100, 100), R("exposure", "Exposure", -5, 5, 0.05), R("contrast", "Contrast", -100, 100), R("highlights", "Highlights", -100, 100), R("shadows", "Shadows", -100, 100),
        R("whites", "Whites", -100, 100), R("blacks", "Blacks", -100, 100), R("texture", "Texture", -100, 100), R("clarity", "Clarity", -100, 100), R("dehaze", "Dehaze", -100, 100), R("vibrance", "Vibrance", -100, 100), R("saturation", "Saturation", -100, 100)],
      Curve: [R("pHigh", "Highlights", -100, 100), R("pLight", "Lights", -100, 100), R("pDark", "Darks", -100, 100), R("pShadow", "Shadows", -100, 100)],
      Detail: [R("sharpen", "Sharpening", 0, 150), R("sRadius", "Radius", 0.5, 3, 0.1), R("sDetail", "Detail", 0, 100), R("sMask", "Masking", 0, 100), R("nrLum", "Noise reduction", 0, 100), R("nrColor", "Color noise reduction", 0, 100)],
      Optics: [R("distortion", "Distortion", -100, 100), R("vignette", "Vignetting", -100, 100), R("vMid", "Midpoint", 0, 100), R("fringePurple", "Defringe: purple", 0, 20), R("fringeGreen", "Defringe: green", 0, 20)],
      Geometry: [R("vert", "Vertical", -100, 100), R("horiz", "Horizontal", -100, 100), R("rotate", "Rotate", -10, 10, 0.1), R("scale", "Scale", 50, 150), R("offX", "X offset", -100, 100), R("offY", "Y offset", -100, 100)],
      Effects: [R("grain", "Grain amount", 0, 100), R("grainSize", "Grain size", 0, 100), R("grainRough", "Roughness", 0, 100), R("pcVig", "Vignette amount", -100, 100), R("pcMid", "Midpoint", 0, 100), R("pcRound", "Roundness", -100, 100), R("pcFeather", "Feather", 0, 100)],
    };
    const slider = (pre, q, v) => `<div class="rw"><label>${esc(q.label)}</label><input type="range" class="dvS" data-k="${pre}${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${v}"><input type="number" class="dvN" data-k="${pre}${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${v}"></div>`;
    const userPresets = () => (store && store.get("dev.presets", {})) || {};
    E.paramTypes.develop = {
      html: (q, v) => {
        const d = Object.assign(DEV_DEFAULT(), v || {});
        const tabs = ["Basic", "Curve", "Color", "Grading", "Detail", "Optics", "Geometry", "Effects", "Presets"];
        const pane = (t) => {
          if (TABS[t]) return TABS[t].map((x) => slider("", x, d[x.id])).join("") + (t === "Basic" ? `<div class="rw"><span></span><label><input type="checkbox" class="dvBW" ${d.bw ? "checked" : ""}> Black &amp; White</label><button type="button" class="ghost dvAuto" title="Exposure, contrast, whites, blacks from the picture's histogram">✨ Auto</button></div>` : t === "Curve" ? `<div class="dvCurve"></div>` : "");
          if (t === "Color") return `<div class="rw"><label>Colour</label><select class="dvHue">${HUES.map((h) => `<option value="${h}">${h[0].toUpperCase() + h.slice(1)}</option>`).join("")}</select></div>` + [["h", "Hue", -100, 100], ["s", "Saturation", -100, 100], ["l", "Luminance", -100, 100]].map(([k, n, a, b]) => `<div class="rw"><label>${n}</label><input type="range" class="dvM" data-m="${k}" min="${a}" max="${b}" value="0"><input type="number" class="dvMN" data-m="${k}" min="${a}" max="${b}" value="0"></div>`).join("");
          if (t === "Grading") return `<div class="rw"><label>Range</label><select class="dvGr"><option value="sh">Shadows</option><option value="mid">Midtones</option><option value="hi">Highlights</option></select></div>` + [["h", "Hue", 0, 360], ["s", "Saturation", 0, 100], ["l", "Luminance", -100, 100]].map(([k, n, a, b]) => `<div class="rw"><label>${n}</label><input type="range" class="dvG" data-g="${k}" min="${a}" max="${b}" value="0"><input type="number" class="dvGN" data-g="${k}" min="${a}" max="${b}" value="0"></div>`).join("")
            + slider("grade.", R("blending", "Blending", 0, 100), d.grade.blending) + slider("grade.", R("balance", "Balance", -100, 100), d.grade.balance);
          if (t === "Presets") return `<div class="dvPre" style="display:flex;flex-wrap:wrap;gap:4px">${Object.keys(PRESETS).map((n) => `<button type="button" class="ghost dvP" data-p="${esc(n)}">${esc(n)}</button>`).join("")}</div>
            <div class="dvUser" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${Object.keys(userPresets()).map((n) => `<button type="button" class="ghost dvU" data-u="${esc(n)}">${esc(n)}</button>`).join("")}</div>
            <div class="rw" style="margin-top:6px"><input type="text" class="dvUN" placeholder="Name" style="flex:1"><button type="button" class="ghost dvUS">💾 Save as preset</button><button type="button" class="ghost dvR" title="Every setting back to 0">↺ Reset all</button></div>`;
          return "";
        };
        return `<div class="rw dvwrap" data-pt="develop" data-pid="${q.id}" style="display:block;min-width:440px"><div class="dvTabs" style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:6px">${tabs.map((t, k) => `<button type="button" class="ghost dvT${k ? "" : " on"}" data-t="${t}" style="padding:2px 6px">${t}</button>`).join("")}</div>
          ${tabs.map((t, k) => `<div class="dvPane" data-t="${t}" style="${k ? "display:none" : ""}">${pane(t)}</div>`).join("")}</div>`;
      },
      bind(el, q, params, changed) {
        const d = params[q.id] = Object.assign(DEV_DEFAULT(), params[q.id] || {});
        const get = (k) => k.split(".").reduce((o, x) => o[x], d), set = (k, v) => { const ks = k.split("."), last = ks.pop(); ks.reduce((o, x) => o[x], d)[last] = v; };
        const sync = (k, v, src) => el.querySelectorAll(`[data-k="${k}"]`).forEach((i) => { if (i !== src) i.value = v; });
        el.querySelectorAll(".dvT").forEach((b) => { b.onclick = () => { el.querySelectorAll(".dvT").forEach((x) => x.classList.toggle("on", x === b)); el.querySelectorAll(".dvPane").forEach((p) => { p.style.display = p.dataset.t === b.dataset.t ? "" : "none"; }); }; });
        el.querySelectorAll(".dvS,.dvN").forEach((i) => { i.oninput = i.onchange = (ev) => { set(i.dataset.k, +i.value || 0); sync(i.dataset.k, i.value, i); changed(ev.type === "change"); }; });
        const bw = el.querySelector(".dvBW"); if (bw) bw.onchange = () => { d.bw = bw.checked; changed(true); };
        const redraw = () => { el.querySelectorAll(".dvS,.dvN").forEach((i) => { i.value = get(i.dataset.k); }); if (bw) bw.checked = !!d.bw; showHue(); showGrade(); };
        const auto = el.querySelector(".dvAuto");
        if (auto) auto.onclick = () => {
          const L = S.layers[S.active]; if (!L || !L.canvas) return;
          const a = autoBasic(L.canvas.getContext("2d").getImageData(0, 0, L.canvas.width, L.canvas.height).data);
          Object.assign(d, a); redraw(); changed(true);
        };
        // the colour mixer
        const hueSel = el.querySelector(".dvHue");
        const showHue = () => { if (!hueSel) return; const m = d.mix[hueSel.value]; el.querySelectorAll(".dvM,.dvMN").forEach((i) => { i.value = m[i.dataset.m]; }); };
        if (hueSel) { hueSel.onchange = showHue; el.querySelectorAll(".dvM,.dvMN").forEach((i) => { i.oninput = i.onchange = (ev) => { d.mix[hueSel.value][i.dataset.m] = +i.value || 0; el.querySelectorAll(`[data-m="${i.dataset.m}"]`).forEach((o) => { if (o !== i) o.value = i.value; }); changed(ev.type === "change"); }; }); showHue(); }
        // grading
        const grSel = el.querySelector(".dvGr");
        const showGrade = () => { if (!grSel) return; const m = d.grade[grSel.value]; el.querySelectorAll(".dvG,.dvGN").forEach((i) => { i.value = m[i.dataset.g]; }); };
        if (grSel) { grSel.onchange = showGrade; el.querySelectorAll(".dvG,.dvGN").forEach((i) => { i.oninput = i.onchange = (ev) => { d.grade[grSel.value][i.dataset.g] = +i.value || 0; el.querySelectorAll(`[data-g="${i.dataset.g}"]`).forEach((o) => { if (o !== i) o.value = i.value; }); changed(ev.type === "change"); }; }); showGrade(); }
        // the point curve
        const cv = el.querySelector(".dvCurve");
        if (cv && E.ui && E.ui.curveWidget) E.ui.curveWidget(cv, d.curve, (v, done) => { d.curve = JSON.parse(JSON.stringify(v)); changed(done); });
        // presets
        const apply = (obj) => { const nd = JSON.parse(JSON.stringify(obj)); for (const k of Object.keys(d)) delete d[k]; Object.assign(d, nd); redraw(); if (cv && E.ui && E.ui.curveWidget) { cv.innerHTML = ""; E.ui.curveWidget(cv, d.curve, (v, done) => { d.curve = JSON.parse(JSON.stringify(v)); changed(done); }); } changed(true); };
        el.querySelectorAll(".dvP").forEach((b) => { b.onclick = () => apply(withPreset(b.dataset.p)); });
        const bindUser = () => el.querySelectorAll(".dvU").forEach((b) => { b.onclick = () => { const u = userPresets()[b.dataset.u]; if (u) apply(Object.assign(DEV_DEFAULT(), u)); }; });
        bindUser();
        const saveB = el.querySelector(".dvUS");
        if (saveB) saveB.onclick = () => {
          const nm = (el.querySelector(".dvUN").value || "").trim().slice(0, 40); if (!nm || !store) return;
          const all = userPresets(); all[nm] = JSON.parse(JSON.stringify(d)); store.set("dev.presets", all);
          const box = el.querySelector(".dvUser"); box.innerHTML = Object.keys(all).map((n) => `<button type="button" class="ghost dvU" data-u="${esc(n)}">${esc(n)}</button>`).join(""); bindUser();
          if (E.say) E.say(`preset "${nm}" kept`);
        };
        const rs = el.querySelector(".dvR"); if (rs) rs.onclick = () => apply(DEV_DEFAULT());
      },
    };
    if (E.ui && E.ui.addCmd) {
      const can = () => !!(S.w && S.layers[S.active]);
      E.ui.addCmd("flt.develop", "Develop Filter…", "Alt+Shift+Ctrl+A", () => E.openFilter("develop"), { enabled: can }, ["Filter", "so.smartfilters"]);
      E.ui.addCmd("flt.lenscorrection", "Lens Correction…", "Alt+Shift+Ctrl+R", () => E.openFilter("lenscorrection"), { enabled: can }, ["Filter", "flt.develop"]);
    }
    // Lens Correction's grid over the picture while its dialog is open
    if (E.overlayHooks) E.overlayHooks.push((g, px) => {
      const dlg = doc.querySelector(".kxdlg"), on = dlg && /Lens Correction/.test((dlg.querySelector("h4") || {}).textContent || "");
      const gr = on && dlg.querySelector('[data-p="grid"]');
      if (!on || !gr || !gr.checked || !S.w) return;
      g.save(); g.strokeStyle = "rgba(120,200,255,.55)"; g.lineWidth = px;
      const step = Math.max(16, Math.round(Math.min(S.w, S.h) / 12));
      g.beginPath(); for (let x = step; x < S.w; x += step) { g.moveTo(x, 0); g.lineTo(x, S.h); } for (let y = step; y < S.h; y += step) { g.moveTo(0, y); g.lineTo(S.w, y); } g.stroke(); g.restore();
    });
  }

  const api = { FILTERS5, register, install, develop, lensCorrect, autoBasic, DEV_DEFAULT, PRESETS, withPreset, hueBand, HUES, geomMap, toneLut };
  if (isNode) module.exports = api;
  else { root.IEFilters5 = api; register(root.IEFilters); }
})(typeof window !== "undefined" ? window : globalThis);
