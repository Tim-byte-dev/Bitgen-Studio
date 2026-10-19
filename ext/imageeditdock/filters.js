/* filters.js — PHOTOSHOP-STYLE ADJUSTMENTS + FILTERS for the image editor (2.333.0).
 *
 * Tim: "can you also add some photoshop like filters". 24 of them, in two
 * menus like Photoshop's Image -> Adjustments and Filter:
 *
 *   Adjustments  Brightness/Contrast, Hue/Saturation, Levels, Color Balance,
 *                Exposure, Vibrance, Black & White, Sepia, Invert, Posterize,
 *                Threshold, Auto Contrast
 *   Filters      Gaussian Blur, Motion Blur, Unsharp Mask, Add Noise, Median
 *                (despeckle), Pixelate, Emboss, Find Edges, Vignette, Glow,
 *                Chromatic Aberration, Oil Paint
 *
 * Every filter is a PURE function (rgba, w, h, params) -> a new RGBA array of
 * the same size - no canvas, so each one is unit-tested in Node. The editor
 * runs it on the active layer (only inside the selection when there is one,
 * blended by its soft edge), previews live, and makes it one undo step.
 * `pad(params)` = how far a pixel's result reaches (the editor computes a
 * selection's box with that margin so blurs see their surroundings).
 */
(function (root) {
  "use strict";
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  /* ------------------------------ helpers ------------------------------ */
  function lut(fn) { const t = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) t[i] = clamp(Math.round(fn(i))); return t; }
  function mapRGB(src, f) {                 // per-pixel RGB -> RGB, alpha kept
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      const r = f(src[i], src[i + 1], src[i + 2]);
      out[i] = r[0]; out[i + 1] = r[1]; out[i + 2] = r[2]; out[i + 3] = src[i + 3];
    }
    return out;
  }
  function applyLut(src, lr, lg, lb) {
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) { out[i] = lr[src[i]]; out[i + 1] = (lg || lr)[src[i + 1]]; out[i + 2] = (lb || lr)[src[i + 2]]; out[i + 3] = src[i + 3]; }
    return out;
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (s === 0) { const v = l * 255; return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const t = (x) => { x = ((x % 1) + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 0.5 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
    return [t(h + 1 / 3) * 255, t(h) * 255, t(h - 1 / 3) * 255];
  }
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

  /** Premultiplied float planes (a blur must not drag transparent black in). */
  function planes(src, w, h) {
    const n = w * h, R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), A = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = src[i * 4 + 3] / 255; A[i] = a; R[i] = src[i * 4] * a; G[i] = src[i * 4 + 1] * a; B[i] = src[i * 4 + 2] * a; }
    return [R, G, B, A];
  }
  function unplanes(P, w, h) {
    const [R, G, B, A] = P, out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const a = A[i];
      if (a > 1e-6) { out[i * 4] = clamp(Math.round(R[i] / a)); out[i * 4 + 1] = clamp(Math.round(G[i] / a)); out[i * 4 + 2] = clamp(Math.round(B[i] / a)); }
      out[i * 4 + 3] = clamp(Math.round(a * 255));
    }
    return out;
  }
  /** One box blur pass (horizontal then vertical), radius r, edges clamped. */
  function boxPass(src, dst, w, h, r) {
    if (r < 1) { dst.set(src); return; }
    const tmp = new Float32Array(w * h), k = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const row = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { tmp[row + x] = acc / k; acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { dst[y * w + x] = acc / k; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
  }
  /** Gaussian by three box passes (the standard sigma -> box sizes). */
  function gaussPlanes(P, w, h, sigma) {
    const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
    let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    const wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    const sizes = []; for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
    return P.map((pl) => {
      let a = Float32Array.from(pl), b = new Float32Array(pl.length);
      for (const s of sizes) { boxPass(a, b, w, h, Math.max(0, (s - 1) / 2)); const t = a; a = b; b = t; }
      return a;
    });
  }
  function gaussian(src, w, h, radius) {
    if (!(radius > 0.2)) return Uint8ClampedArray.from(src);
    return unplanes(gaussPlanes(planes(src, w, h), w, h, radius / 2), w, h);
  }
  function rngOf(seed) {
    let a = seed >>> 0 || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function sample(src, w, h, x, y, c) {        // bilinear, edges clamped
    x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
    const g = (xx, yy) => src[(yy * w + xx) * 4 + c];
    return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
  }

  /* ------------------------------ the filters ------------------------------ */
  const N = (id, label, min, max, step, def) => ({ id, label, type: "range", min, max, step, def });
  const SEL = (id, label, options, def) => ({ id, label, type: "select", options, def });
  const CHK = (id, label, def) => ({ id, label, type: "check", def });

  const FILTERS = [
    /* ---- adjustments ---- */
    { id: "brightness", group: "Adjustments", name: "Brightness / Contrast", params: [N("brightness", "Brightness", -150, 150, 1, 0), N("contrast", "Contrast", -100, 100, 1, 0)],
      apply(s, w, h, p) {
        const c = p.contrast / 100, f = c >= 0 ? 1 / Math.max(0.01, 1 - c * 0.99) : 1 + c;
        return applyLut(s, lut((v) => (v - 127.5) * f + 127.5 + p.brightness));
      } },
    { id: "huesat", group: "Adjustments", name: "Hue / Saturation", params: [N("hue", "Hue", -180, 180, 1, 0), N("saturation", "Saturation", -100, 100, 1, 0), N("lightness", "Lightness", -100, 100, 1, 0), CHK("colorize", "Colorize", false)],
      apply(s, w, h, p) {
        const dh = p.hue / 360, ds = p.saturation / 100, dl = p.lightness / 100;
        return mapRGB(s, (r, g, b) => {
          let [H, S, L] = rgb2hsl(r, g, b);
          if (p.colorize) { H = ((p.hue + 360) % 360) / 360; S = Math.max(0, Math.min(1, 0.25 + ds * 0.75 + 0.25)); }
          else { H = H + dh; S = ds >= 0 ? S + (1 - S) * ds * S : S * (1 + ds); }
          L = dl >= 0 ? L + (1 - L) * dl : L * (1 + dl);
          return hsl2rgb(H, Math.max(0, Math.min(1, S)), Math.max(0, Math.min(1, L)));
        });
      } },
    { id: "levels", group: "Adjustments", name: "Levels", params: [N("inBlack", "Input black", 0, 253, 1, 0), N("inWhite", "Input white", 2, 255, 1, 255), N("gamma", "Gamma (midtones)", 0.1, 5, 0.01, 1), N("outBlack", "Output black", 0, 255, 1, 0), N("outWhite", "Output white", 0, 255, 1, 255)],
      apply(s, w, h, p) {
        const lo = Math.min(p.inBlack, p.inWhite - 1), hi = Math.max(p.inWhite, lo + 1);
        return applyLut(s, lut((v) => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return p.outBlack + Math.pow(t, 1 / p.gamma) * (p.outWhite - p.outBlack); }));
      } },
    { id: "colorbalance", group: "Adjustments", name: "Color Balance", params: [SEL("tone", "Tone", ["shadows", "midtones", "highlights"], "midtones"), N("cr", "Cyan ↔ Red", -100, 100, 1, 0), N("mg", "Magenta ↔ Green", -100, 100, 1, 0), N("yb", "Yellow ↔ Blue", -100, 100, 1, 0), CHK("preserve", "Preserve luminosity", true)],
      apply(s, w, h, p) {
        const wt = (l) => (p.tone === "shadows" ? Math.max(0, 1 - l / 0.5) : p.tone === "highlights" ? Math.max(0, (l - 0.5) / 0.5) : Math.max(0, 1 - Math.abs(l - 0.5) / 0.5));
        const k = 0.6;
        return mapRGB(s, (r, g, b) => {
          const l = luma(r, g, b) / 255, t = wt(l) * k;
          let R = r + p.cr * t, G = g + p.mg * t, B = b + p.yb * t;
          if (p.preserve) { const d = luma(r, g, b) - luma(R, G, B); R += d; G += d; B += d; }
          return [clamp(R), clamp(G), clamp(B)];
        });
      } },
    { id: "exposure", group: "Adjustments", name: "Exposure", params: [N("exposure", "Exposure (stops)", -5, 5, 0.05, 0), N("offset", "Offset", -0.5, 0.5, 0.01, 0), N("gamma", "Gamma", 0.2, 3, 0.01, 1)],
      apply(s, w, h, p) {
        const k = Math.pow(2, p.exposure);
        return applyLut(s, lut((v) => 255 * Math.pow(Math.max(0, Math.min(1, (v / 255) * k + p.offset)), 1 / p.gamma)));
      } },
    { id: "vibrance", group: "Adjustments", name: "Vibrance", params: [N("vibrance", "Vibrance", -100, 100, 1, 0), N("saturation", "Saturation", -100, 100, 1, 0)],
      apply(s, w, h, p) {
        const v = p.vibrance / 100, sa = p.saturation / 100;
        return mapRGB(s, (r, g, b) => {
          const mx = Math.max(r, g, b), avg = (r + g + b) / 3, sat = mx ? (mx - Math.min(r, g, b)) / mx : 0;
          const amt = sa + v * (1 - sat) * 1.5;               // the dull colours move most
          return [clamp(r + (r - avg) * amt), clamp(g + (g - avg) * amt), clamp(b + (b - avg) * amt)];
        });
      } },
    { id: "bw", group: "Adjustments", name: "Black & White", params: [N("red", "Reds", -50, 150, 1, 40), N("green", "Greens", -50, 150, 1, 60), N("blue", "Blues", -50, 150, 1, 20)],
      apply(s, w, h, p) {
        const sum = Math.max(1, p.red + p.green + p.blue);
        return mapRGB(s, (r, g, b) => { const v = clamp((r * p.red + g * p.green + b * p.blue) / sum); return [v, v, v]; });
      } },
    { id: "sepia", group: "Adjustments", name: "Sepia", params: [N("amount", "Amount", 0, 100, 1, 80)],
      apply(s, w, h, p) {
        const a = p.amount / 100;
        return mapRGB(s, (r, g, b) => {
          const R = r * 0.393 + g * 0.769 + b * 0.189, G = r * 0.349 + g * 0.686 + b * 0.168, B = r * 0.272 + g * 0.534 + b * 0.131;
          return [clamp(r + (R - r) * a), clamp(g + (G - g) * a), clamp(b + (B - b) * a)];
        });
      } },
    { id: "invert", group: "Adjustments", name: "Invert", params: [], apply(s) { return applyLut(s, lut((v) => 255 - v)); } },
    { id: "posterize", group: "Adjustments", name: "Posterize", params: [N("levels", "Levels", 2, 32, 1, 4)],
      apply(s, w, h, p) { const n = Math.max(2, Math.round(p.levels)) - 1; return applyLut(s, lut((v) => Math.round(Math.round((v / 255) * n) / n * 255))); } },
    { id: "threshold", group: "Adjustments", name: "Threshold", params: [N("level", "Level", 1, 255, 1, 128)],
      apply(s, w, h, p) { return mapRGB(s, (r, g, b) => { const v = luma(r, g, b) >= p.level ? 255 : 0; return [v, v, v]; }); } },
    { id: "autocontrast", group: "Adjustments", name: "Auto Contrast", params: [N("clip", "Clip (%)", 0, 5, 0.1, 0.5), CHK("perChannel", "Per channel (also fixes a colour cast)", false)],
      apply(s, w, h, p) {
        const n = w * h, hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
        let counted = 0;
        for (let i = 0; i < n; i++) { if (!s[i * 4 + 3]) continue; counted++; hist[0][s[i * 4]]++; hist[1][s[i * 4 + 1]]++; hist[2][s[i * 4 + 2]]++; hist[3][Math.round(luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]))]++; }
        const cut = counted * p.clip / 100;
        const range = (hh) => { let lo = 0, hi = 255, a = 0; while (lo < 255 && (a += hh[lo]) <= cut) lo++; a = 0; while (hi > 0 && (a += hh[hi]) <= cut) hi--; return hi > lo ? [lo, hi] : [0, 255]; };
        const mk = (rg) => lut((v) => (v - rg[0]) * 255 / (rg[1] - rg[0]));
        if (p.perChannel) return applyLut(s, mk(range(hist[0])), mk(range(hist[1])), mk(range(hist[2])));
        return applyLut(s, mk(range(hist[3])));
      } },
    /* ---- filters ---- */
    { id: "gaussian", group: "Filters", name: "Gaussian Blur", params: [N("radius", "Radius (px)", 0.5, 100, 0.5, 4)], pad: (p) => Math.ceil(p.radius * 2),
      apply(s, w, h, p) { return gaussian(s, w, h, p.radius); } },
    { id: "motion", group: "Filters", name: "Motion Blur", params: [N("angle", "Angle (°)", -180, 180, 1, 0), N("distance", "Distance (px)", 1, 120, 1, 20)], pad: (p) => Math.ceil(p.distance),
      apply(s, w, h, p) {
        const out = new Uint8ClampedArray(s.length), a = p.angle * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a);
        const n = Math.max(2, Math.round(p.distance)), step = p.distance / n;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let R = 0, G = 0, B = 0, A = 0;
          for (let k = 0; k <= n; k++) {
            const t = (k - n / 2) * step, sx = Math.max(0, Math.min(w - 1, Math.round(x + dx * t))), sy = Math.max(0, Math.min(h - 1, Math.round(y + dy * t)));
            const i = (sy * w + sx) * 4, al = s[i + 3] / 255;
            R += s[i] * al; G += s[i + 1] * al; B += s[i + 2] * al; A += al;
          }
          const o = (y * w + x) * 4;
          if (A > 0) { out[o] = R / A; out[o + 1] = G / A; out[o + 2] = B / A; }
          out[o + 3] = (A / (n + 1)) * 255;
        }
        return out;
      } },
    { id: "unsharp", group: "Filters", name: "Unsharp Mask", params: [N("amount", "Amount (%)", 1, 500, 1, 120), N("radius", "Radius (px)", 0.3, 50, 0.1, 1.5), N("threshold", "Threshold", 0, 255, 1, 2)], pad: (p) => Math.ceil(p.radius * 2),
      apply(s, w, h, p) {
        const bl = gaussian(s, w, h, p.radius), out = new Uint8ClampedArray(s.length), a = p.amount / 100;
        for (let i = 0; i < s.length; i += 4) {
          for (let c = 0; c < 3; c++) { const d = s[i + c] - bl[i + c]; out[i + c] = Math.abs(d) >= p.threshold ? clamp(s[i + c] + d * a) : s[i + c]; }
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "noise", group: "Filters", name: "Add Noise", params: [N("amount", "Amount", 0, 100, 1, 12), CHK("mono", "Monochromatic", true), CHK("gauss", "Gaussian", true), N("seed", "Seed", 1, 9999, 1, 7)],
      apply(s, w, h, p) {
        const rnd = rngOf(p.seed), out = new Uint8ClampedArray(s.length), amp = p.amount * 1.28;
        const draw = () => (p.gauss ? Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()) * 0.5 : rnd() * 2 - 1);
        for (let i = 0; i < s.length; i += 4) {
          const m = draw() * amp;
          for (let c = 0; c < 3; c++) out[i + c] = clamp(s[i + c] + (p.mono ? m : draw() * amp));
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "median", group: "Filters", name: "Median (despeckle)", params: [N("radius", "Radius (px)", 1, 8, 1, 2)], pad: (p) => p.radius,
      apply(s, w, h, p) {
        // Huang's sliding histogram, per channel, per row
        const r = Math.round(p.radius), out = new Uint8ClampedArray(s.length), half = ((2 * r + 1) * (2 * r + 1) + 1) >> 1;
        for (let c = 0; c < 3; c++) {
          for (let y = 0; y < h; y++) {
            const hist = new Uint32Array(256); let cnt = 0;
            const add = (x, sgn) => { if (x < 0 || x >= w) return; for (let dy = -r; dy <= r; dy++) { const yy = Math.min(h - 1, Math.max(0, y + dy)); hist[s[(yy * w + x) * 4 + c]] += sgn; cnt += sgn; } };
            for (let x = -r; x <= r; x++) add(x, 1);
            for (let x = 0; x < w; x++) {
              const need = (cnt + 1) >> 1; let acc = 0, v = 0;
              for (; v < 256; v++) { acc += hist[v]; if (acc >= need) break; }
              out[(y * w + x) * 4 + c] = v;
              add(x - r, -1); add(x + r + 1, 1);
            }
          }
        }
        for (let i = 3; i < s.length; i += 4) out[i] = s[i];
        void half;
        return out;
      } },
    { id: "pixelate", group: "Filters", name: "Pixelate", params: [N("cell", "Cell size (px)", 2, 200, 1, 12)], pad: (p) => p.cell,
      apply(s, w, h, p) {
        const k = Math.max(2, Math.round(p.cell)), out = new Uint8ClampedArray(s.length);
        for (let by = 0; by < h; by += k) for (let bx = 0; bx < w; bx += k) {
          let R = 0, G = 0, B = 0, A = 0, n = 0;
          for (let y = by; y < Math.min(h, by + k); y++) for (let x = bx; x < Math.min(w, bx + k); x++) { const i = (y * w + x) * 4, al = s[i + 3]; R += s[i] * al; G += s[i + 1] * al; B += s[i + 2] * al; A += al; n++; }
          for (let y = by; y < Math.min(h, by + k); y++) for (let x = bx; x < Math.min(w, bx + k); x++) {
            const i = (y * w + x) * 4;
            if (A) { out[i] = R / A; out[i + 1] = G / A; out[i + 2] = B / A; }
            out[i + 3] = A / n;
          }
        }
        return out;
      } },
    { id: "emboss", group: "Filters", name: "Emboss", params: [N("angle", "Angle (°)", -180, 180, 1, 135), N("height", "Height", 1, 10, 1, 2), N("amount", "Amount (%)", 1, 500, 1, 100), CHK("color", "Keep the colours", false)], pad: (p) => p.height,
      apply(s, w, h, p) {
        const a = p.angle * Math.PI / 180, dx = Math.cos(a) * p.height, dy = -Math.sin(a) * p.height, k = p.amount / 100, out = new Uint8ClampedArray(s.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const L = (xx, yy) => luma(sample(s, w, h, xx, yy, 0), sample(s, w, h, xx, yy, 1), sample(s, w, h, xx, yy, 2));
          const d = (L(x - dx, y - dy) - L(x + dx, y + dy)) * k;
          if (p.color) for (let c = 0; c < 3; c++) out[i + c] = clamp(s[i + c] + d);
          else { const v = clamp(128 + d); out[i] = out[i + 1] = out[i + 2] = v; }
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "edges", group: "Filters", name: "Find Edges", params: [N("strength", "Strength", 0.2, 5, 0.1, 1), CHK("invert", "Dark lines on white", true)], pad: () => 1,
      apply(s, w, h, p) {
        const out = new Uint8ClampedArray(s.length);
        const at = (x, y, c) => s[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const gx = -at(x - 1, y - 1, c) - 2 * at(x - 1, y, c) - at(x - 1, y + 1, c) + at(x + 1, y - 1, c) + 2 * at(x + 1, y, c) + at(x + 1, y + 1, c);
            const gy = -at(x - 1, y - 1, c) - 2 * at(x, y - 1, c) - at(x + 1, y - 1, c) + at(x - 1, y + 1, c) + 2 * at(x, y + 1, c) + at(x + 1, y + 1, c);
            const m = clamp(Math.hypot(gx, gy) * p.strength / 4);
            out[i + c] = p.invert ? 255 - m : m;
          }
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "vignette", group: "Filters", name: "Vignette", params: [N("amount", "Amount", -100, 100, 1, -50), N("size", "Midpoint (%)", 0, 100, 1, 50), N("feather", "Feather (%)", 1, 100, 1, 60)],
      apply(s, w, h, p) {
        const out = new Uint8ClampedArray(s.length), cx = w / 2, cy = h / 2, rmax = Math.hypot(cx, cy);
        const mid = 0.3 + (p.size / 100) * 0.7, soft = Math.max(0.01, p.feather / 100);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const d = Math.hypot((x + 0.5 - cx) / cx * 0.7071, (y + 0.5 - cy) / cy * 0.7071) * Math.SQRT2 * (rmax / rmax);
          let t = (d - (mid - soft / 2)) / soft; t = Math.max(0, Math.min(1, t)); t = t * t * (3 - 2 * t);
          const i = (y * w + x) * 4, a = (p.amount / 100) * t;
          for (let c = 0; c < 3; c++) out[i + c] = clamp(a < 0 ? s[i + c] * (1 + a) : s[i + c] + (255 - s[i + c]) * a);
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "glow", group: "Filters", name: "Glow (bloom)", params: [N("threshold", "Threshold", 0, 255, 1, 170), N("radius", "Radius (px)", 1, 100, 1, 18), N("amount", "Amount (%)", 0, 300, 1, 80)], pad: (p) => Math.ceil(p.radius * 2),
      apply(s, w, h, p) {
        const bright = new Uint8ClampedArray(s.length);
        for (let i = 0; i < s.length; i += 4) {
          const l = luma(s[i], s[i + 1], s[i + 2]), k = l > p.threshold ? (l - p.threshold) / Math.max(1, 255 - p.threshold) : 0;
          bright[i] = s[i] * k; bright[i + 1] = s[i + 1] * k; bright[i + 2] = s[i + 2] * k; bright[i + 3] = 255;
        }
        const bl = gaussian(bright, w, h, p.radius), out = new Uint8ClampedArray(s.length), a = p.amount / 100;
        for (let i = 0; i < s.length; i += 4) {
          for (let c = 0; c < 3; c++) { const g = (bl[i + c] / 255) * a; out[i + c] = clamp(255 - (255 - s[i + c]) * (1 - Math.min(1, g))); }
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "chromatic", group: "Filters", name: "Chromatic Aberration", params: [N("amount", "Shift at the edge (px)", 0, 40, 0.5, 4)], pad: (p) => Math.ceil(p.amount),
      apply(s, w, h, p) {
        const out = new Uint8ClampedArray(s.length), cx = (w - 1) / 2, cy = (h - 1) / 2, rm = Math.max(1, Math.hypot(cx, cy)), k = p.amount / rm;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4, dx = x - cx, dy = y - cy;
          out[i] = sample(s, w, h, cx + dx * (1 - k), cy + dy * (1 - k), 0);
          out[i + 1] = s[i + 1];
          out[i + 2] = sample(s, w, h, cx + dx * (1 + k), cy + dy * (1 + k), 2);
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    { id: "oil", group: "Filters", name: "Oil Paint", params: [N("radius", "Brush (px)", 1, 12, 1, 4)], pad: (p) => p.radius * 2,
      apply(s, w, h, p) {
        // Kuwahara: each pixel takes the mean colour of its calmest quadrant
        // (summed-area tables -> O(pixels) whatever the radius)
        const r = Math.round(p.radius), W1 = w + 1, n = W1 * (h + 1);
        const S = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
        for (let y = 0; y < h; y++) {
          const rs = [0, 0, 0, 0, 0];
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4, L = luma(s[i], s[i + 1], s[i + 2]);
            rs[0] += s[i]; rs[1] += s[i + 1]; rs[2] += s[i + 2]; rs[3] += L; rs[4] += L * L;
            const o = (y + 1) * W1 + x + 1;
            for (let k = 0; k < 5; k++) S[k][o] = S[k][o - W1] + rs[k];
          }
        }
        const box = (k, x0, y0, x1, y1) => S[k][(y1 + 1) * W1 + x1 + 1] - S[k][y0 * W1 + x1 + 1] - S[k][(y1 + 1) * W1 + x0] + S[k][y0 * W1 + x0];
        const out = new Uint8ClampedArray(s.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let best = Infinity, br = 0, bg = 0, bb = 0;
          for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const x0 = Math.max(0, qx < 0 ? x - r : x), x1 = Math.min(w - 1, qx < 0 ? x : x + r);
            const y0 = Math.max(0, qy < 0 ? y - r : y), y1 = Math.min(h - 1, qy < 0 ? y : y + r);
            const cnt = (x1 - x0 + 1) * (y1 - y0 + 1), m = box(3, x0, y0, x1, y1) / cnt, v = box(4, x0, y0, x1, y1) / cnt - m * m;
            if (v < best) { best = v; br = box(0, x0, y0, x1, y1) / cnt; bg = box(1, x0, y0, x1, y1) / cnt; bb = box(2, x0, y0, x1, y1) / cnt; }
          }
          const i = (y * w + x) * 4;
          out[i] = br; out[i + 1] = bg; out[i + 2] = bb; out[i + 3] = s[i + 3];
        }
        return out;
      } },
    /* ---- 2.389.0 (Tim: "build our image editor to have the same functionality and look as photocraft"):
       Photoshop's other everyday adjustments (each also an ADJUSTMENT LAYER - static/pcdoc in the editor) and
       its Blur / Sharpen / Distort / Render / Stylize filters. `sub` = the Filter menu's submenu. ---- */
    { id: "curves", group: "Adjustments", name: "Curves", params: [CURVE("curve", "Curve")],
      apply(s, w, h, p) {
        const c = p.curve || {}, L = curveLut(c.rgb), lr = curveLut(c.r), lg = curveLut(c.g), lb = curveLut(c.b);
        const R = new Uint8ClampedArray(256), G = new Uint8ClampedArray(256), B = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) { R[i] = L[lr[i]]; G[i] = L[lg[i]]; B[i] = L[lb[i]]; }
        return applyLut(s, R, G, B);
      } },
    { id: "photofilter", group: "Adjustments", name: "Photo Filter", params: [COL("color", "Filter colour", "#ec8a00"), N("density", "Density (%)", 1, 100, 1, 25), CHK("preserve", "Preserve luminosity", true)],
      apply(s, w, h, p) {
        const [fr, fg, fb] = hex3(p.color), d = p.density / 100;
        return mapRGB(s, (r, g, b) => {
          let R = r * (1 - d) + (r * fr / 255) * d * 1.0 + fr * d * 0.25, G = g * (1 - d) + (g * fg / 255) * d + fg * d * 0.25, B = b * (1 - d) + (b * fb / 255) * d + fb * d * 0.25;
          if (p.preserve) { const k = luma(r, g, b) - luma(R, G, B); R += k; G += k; B += k; }
          return [clamp(R), clamp(G), clamp(B)];
        });
      } },
    { id: "channelmixer", group: "Adjustments", name: "Channel Mixer", params: [N("rr", "Red ← red (%)", -200, 200, 1, 100), N("rg", "Red ← green (%)", -200, 200, 1, 0), N("rb", "Red ← blue (%)", -200, 200, 1, 0),
        N("gr", "Green ← red (%)", -200, 200, 1, 0), N("gg", "Green ← green (%)", -200, 200, 1, 100), N("gb", "Green ← blue (%)", -200, 200, 1, 0),
        N("br", "Blue ← red (%)", -200, 200, 1, 0), N("bg", "Blue ← green (%)", -200, 200, 1, 0), N("bb", "Blue ← blue (%)", -200, 200, 1, 100), CHK("mono", "Monochrome (the red row)", false)],
      apply(s, w, h, p) {
        const k = (v) => v / 100;
        return mapRGB(s, (r, g, b) => {
          const R = r * k(p.rr) + g * k(p.rg) + b * k(p.rb);
          if (p.mono) return [clamp(R), clamp(R), clamp(R)];
          return [clamp(R), clamp(r * k(p.gr) + g * k(p.gg) + b * k(p.gb)), clamp(r * k(p.br) + g * k(p.bg) + b * k(p.bb))];
        });
      } },
    { id: "gradientmap", group: "Adjustments", name: "Gradient Map", params: [COL("c1", "Shadows colour", "#000000"), COL("c2", "Highlights colour", "#ffffff"), CHK("reverse", "Reverse", false)],
      apply(s, w, h, p) {
        const a = hex3(p.reverse ? p.c2 : p.c1), b = hex3(p.reverse ? p.c1 : p.c2);
        return mapRGB(s, (r, g, bb) => { const t = luma(r, g, bb) / 255; return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)]; });
      } },
    { id: "desaturate", group: "Adjustments", name: "Desaturate", params: [],
      apply(s) { return mapRGB(s, (r, g, b) => { const v = (Math.max(r, g, b) + Math.min(r, g, b)) / 2; return [v, v, v]; }); } },
    { id: "equalize", group: "Adjustments", name: "Equalize", params: [],
      apply(s, w, h) {
        const hist = new Float64Array(256); let n = 0;
        for (let i = 0; i < s.length; i += 4) { if (!s[i + 3]) continue; hist[Math.round(luma(s[i], s[i + 1], s[i + 2]))]++; n++; }
        if (!n) return Uint8ClampedArray.from(s);
        const cdf = new Float64Array(256); let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; cdf[i] = acc / n; }
        return mapRGB(s, (r, g, b) => { const l = luma(r, g, b), t = l > 0 ? cdf[Math.round(l)] * 255 / l : 0; return l > 0 ? [clamp(r * t), clamp(g * t), clamp(b * t)] : [0, 0, 0]; });
      } },
    /* Blur */
    { id: "box", group: "Filters", sub: "Blur", name: "Box Blur", params: [N("radius", "Radius (px)", 1, 100, 1, 6)], pad: (p) => Math.ceil(p.radius),
      apply(s, w, h, p) {
        const P = planes(s, w, h), T = P.map((x) => new Float32Array(x.length)), r = Math.round(p.radius);
        P.forEach((pl, i) => { boxPass(pl, T[i], w, h, r); });
        return unplanes(T, w, h);
      } },
    { id: "radial", group: "Filters", sub: "Blur", name: "Radial Blur", params: [SEL("method", "Method", ["spin", "zoom"], "spin"), N("amount", "Amount", 1, 100, 1, 10), N("cx", "Centre x (%)", 0, 100, 1, 50), N("cy", "Centre y (%)", 0, 100, 1, 50)],
      apply(s, w, h, p) {
        const out = new Uint8ClampedArray(s.length), cx = w * p.cx / 100, cy = h * p.cy / 100, n = 12;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const dx = x - cx, dy = y - cy, acc = [0, 0, 0, 0];
          for (let k = 0; k < n; k++) {
            const t = (k / (n - 1) - 0.5);
            let sx, sy;
            if (p.method === "zoom") { const f = 1 + t * p.amount / 100; sx = cx + dx * f; sy = cy + dy * f; }
            else { const a = t * p.amount * Math.PI / 360, ca = Math.cos(a), sa = Math.sin(a); sx = cx + dx * ca - dy * sa; sy = cy + dx * sa + dy * ca; }
            for (let c = 0; c < 4; c++) acc[c] += sample(s, w, h, sx, sy, c);
          }
          const i = (y * w + x) * 4; for (let c = 0; c < 4; c++) out[i + c] = acc[c] / n;
        }
        return out;
      } },
    { id: "tiltshift", group: "Filters", sub: "Blur", name: "Tilt-Shift", params: [N("radius", "Blur (px)", 1, 60, 1, 12), N("centre", "Focus line (% from top)", 0, 100, 1, 50), N("band", "Sharp band (% of height)", 0, 100, 1, 20), N("fade", "Transition (% of height)", 1, 100, 1, 25)],
      pad: (p) => Math.ceil(p.radius * 2),
      apply(s, w, h, p) {
        const b = gaussian(s, w, h, p.radius), out = new Uint8ClampedArray(s.length);
        const c = h * p.centre / 100, half = h * p.band / 200, fade = Math.max(1, h * p.fade / 100);
        for (let y = 0; y < h; y++) {
          const t = Math.max(0, Math.min(1, (Math.abs(y - c) - half) / fade));
          for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let k = 0; k < 4; k++) out[i + k] = s[i + k] * (1 - t) + b[i + k] * t; }
        }
        return out;
      } },
    /* Sharpen */
    { id: "sharpen", group: "Filters", sub: "Sharpen", name: "Sharpen", params: [N("amount", "Amount (%)", 1, 300, 1, 60)], pad: () => 1,
      apply(s, w, h, p) {
        const out = new Uint8ClampedArray(s.length), k = p.amount / 100;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const at = (xx, yy) => s[(Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))) * 4 + c];
            const avg = (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) / 4;
            out[i + c] = s[i + c] + (s[i + c] - avg) * k * 2;
          }
          out[i + 3] = s[i + 3];
        }
        return out;
      } },
    /* Distort */
    { id: "twirl", group: "Filters", sub: "Distort", name: "Twirl", params: [N("angle", "Angle (°)", -999, 999, 1, 120)],
      apply(s, w, h, p) {
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, a0 = p.angle * Math.PI / 180;
        return warp(s, w, h, (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d >= R) return [x, y];
          const a = a0 * (1 - d / R), ca = Math.cos(a), sa = Math.sin(a); return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca]; });
      } },
    { id: "wave", group: "Filters", sub: "Distort", name: "Wave", params: [N("amplitude", "Amplitude (px)", 1, 200, 1, 10), N("wavelength", "Wavelength (px)", 4, 1000, 1, 80), SEL("dir", "Direction", ["both", "horizontal", "vertical"], "both")],
      apply(s, w, h, p) {
        const k = 2 * Math.PI / p.wavelength, A = p.amplitude;
        return warp(s, w, h, (x, y) => [x + (p.dir !== "vertical" ? A * Math.sin(y * k) : 0), y + (p.dir !== "horizontal" ? A * Math.sin(x * k) : 0)]);
      } },
    { id: "ripple", group: "Filters", sub: "Distort", name: "Ripple", params: [N("amount", "Amount (px)", 1, 60, 1, 6), SEL("size", "Size", ["small", "medium", "large"], "medium")],
      apply(s, w, h, p) {
        const L = { small: 10, medium: 22, large: 48 }[p.size] || 22, k = 2 * Math.PI / L;
        return warp(s, w, h, (x, y) => [x + p.amount * Math.sin(y * k) * Math.cos(x * k * 0.37), y + p.amount * Math.sin(x * k) * Math.cos(y * k * 0.41)]);
      } },
    { id: "spherize", group: "Filters", sub: "Distort", name: "Spherize / Pinch", params: [N("amount", "Amount (%) - negative pinches", -100, 100, 1, 60)],
      apply(s, w, h, p) {
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, a = p.amount / 100;
        return warp(s, w, h, (x, y) => { const dx = (x - cx) / R, dy = (y - cy) / R, d = Math.hypot(dx, dy); if (d >= 1 || d === 0) return [x, y];
          const f = a >= 0 ? Math.pow(d, 1 + a) / d : Math.pow(d, 1 / (1 - a)) / d; return [cx + dx * f * R, cy + dy * f * R]; });
      } },
    /* Render */
    { id: "clouds", group: "Filters", sub: "Render", name: "Clouds (foreground → background)", params: [COL("c1", "Foreground", "#000000"), COL("c2", "Background", "#ffffff"), N("scale", "Scale (px)", 8, 1024, 1, 160), N("seed", "Seed", 1, 9999, 1, 7)],
      apply(s, w, h, p) {
        const a = hex3(p.c1), b = hex3(p.c2), noise = valueNoise(p.seed), out = new Uint8ClampedArray(s.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let v = 0, amp = 0.5, f = 1 / p.scale;
          for (let o = 0; o < 6; o++) { v += noise(x * f, y * f) * amp; amp /= 2; f *= 2; }
          const t = Math.max(0, Math.min(1, v)), i = (y * w + x) * 4;
          out[i] = a[0] + (b[0] - a[0]) * t; out[i + 1] = a[1] + (b[1] - a[1]) * t; out[i + 2] = a[2] + (b[2] - a[2]) * t; out[i + 3] = 255;
        }
        return out;
      } },
    /* Stylize */
    { id: "wind", group: "Filters", sub: "Stylize", name: "Wind", params: [N("strength", "Strength (px)", 2, 200, 1, 30), SEL("from", "From the", ["left", "right"], "left")], pad: (p) => p.strength,
      apply(s, w, h, p) {
        const out = Uint8ClampedArray.from(s), dir = p.from === "left" ? 1 : -1, rnd = rngOf(11);
        for (let y = 0; y < h; y++) {
          const len = Math.max(1, Math.round(p.strength * (0.3 + rnd() * 0.7)));
          for (let x0 = 0; x0 < w; x0++) {
            const x = dir > 0 ? x0 : w - 1 - x0, i = (y * w + x) * 4;
            const L0 = luma(s[i], s[i + 1], s[i + 2]);
            let px = x - dir, best = L0;
            for (let k = 1; k <= len && px >= 0 && px < w; k++, px -= dir) {
              const j = (y * w + px) * 4, Lj = luma(s[j], s[j + 1], s[j + 2]) * (1 - k / len);
              if (Lj > best) { best = Lj; const t = 1 - k / len; out[i] = Math.max(out[i], s[j] * t + s[i] * (1 - t)); out[i + 1] = Math.max(out[i + 1], s[j + 1] * t + s[i + 1] * (1 - t)); out[i + 2] = Math.max(out[i + 2], s[j + 2] * t + s[i + 2] * (1 - t)); }
            }
          }
        }
        return out;
      } },
    { id: "solarize", group: "Filters", sub: "Stylize", name: "Solarize", params: [],
      apply(s) { return applyLut(s, lut((v) => (v > 127 ? 255 - v : v) * 2)); } },
    /* ---- 2.397.0 (Tim: "add the filters like lense flare, swirl,drop shadow, 3d text"): Render ▸ Lens Flare, Distort ▸
       Swirl, Stylize ▸ Drop Shadow and Stylize ▸ 3D Extrude (any layer's pixels; a TEXT layer has its own 3D in Type ▸
       3D Text). ---- */
    { id: "lensflare", group: "Filters", sub: "Render", name: "Lens Flare",
      params: [SEL("lens", "Lens type", ["50-300mm Zoom", "35mm Prime", "105mm Prime", "Movie Prime"], "50-300mm Zoom"), N("cx", "Flare centre x (%)", 0, 100, 1, 30),
               N("cy", "Flare centre y (%)", 0, 100, 1, 30), N("brightness", "Brightness (%)", 10, 300, 1, 100), COL("tint", "Tint", "#ffffff")],
      apply(s, w, h, p) { return lensFlare(s, w, h, p); } },
    { id: "swirl", group: "Filters", sub: "Distort", name: "Swirl",
      params: [N("angle", "Strength (°)", -1080, 1080, 1, 270), N("radius", "Radius (% of the short side)", 1, 150, 1, 45), N("cx", "Centre x (%)", 0, 100, 1, 50),
               N("cy", "Centre y (%)", 0, 100, 1, 50), SEL("falloff", "Falloff", ["smooth", "linear"], "smooth")],
      apply(s, w, h, p) {
        const cx = w * p.cx / 100, cy = h * p.cy / 100, R = Math.max(1, Math.min(w, h) * p.radius / 100), a0 = p.angle * Math.PI / 180;
        return warp(s, w, h, (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d >= R) return [x, y];
          const a = a0 * swirlFall(d / R, p.falloff), ca = Math.cos(a), sa = Math.sin(a); return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca]; });
      } },
    { id: "dropshadow", group: "Filters", sub: "Stylize", name: "Drop Shadow",
      params: [N("angle", "Light angle (°)", -180, 180, 1, 120), N("distance", "Distance (px)", 0, 300, 1, 12), N("size", "Size / blur (px)", 0, 150, 1, 10),
               N("spread", "Spread (%)", 0, 100, 1, 0), N("opacity", "Opacity (%)", 0, 100, 1, 75), COL("color", "Colour", "#000000")],
      pad: (p) => Math.ceil(p.distance + p.size * 2 + 2),
      apply(s, w, h, p) { return dropShadow(s, w, h, p); } },
    { id: "extrude3d", group: "Filters", sub: "Stylize", name: "3D Extrude",
      params: [N("depth", "Depth (px)", 1, 150, 1, 18), N("angle", "Direction (°)", -180, 180, 1, 135), SEL("side", "Sides", ["shaded copy", "solid colour"], "shaded copy"),
               COL("color", "Side colour (solid)", "#3a3a3a"), N("shade", "Shading to the back (%)", 0, 100, 1, 55)],
      pad: (p) => Math.ceil(p.depth + 1),
      apply(s, w, h, p) { return extrude3d(s, w, h, p); } },
  ];
  /* 2.397.0: the new filters' helpers (pure - tested in Node) */
  /** the swirl's turn at distance t (0 centre .. 1 edge) */
  function swirlFall(t, how) { const k = Math.max(0, 1 - t); return how === "linear" ? k : k * k * (3 - 2 * k); }
  /** the shift (dx, dy) of a shadow / extrusion: Photoshop's light angle - 120° = lit from the upper left, the shadow falls
   *  down to the right */
  function offsetOf(angleDeg, dist) { const a = angleDeg * Math.PI / 180; return [-Math.cos(a) * dist, Math.sin(a) * dist]; }
  function lensFlare(s, w, h, p) {
    const out = new Uint8ClampedArray(s.length), D = Math.hypot(w, h), fx = w * p.cx / 100, fy = h * p.cy / 100, B = p.brightness / 100;
    const tint = hex3(p.tint).map((v) => v / 255), lens = String(p.lens || "50-300mm Zoom");
    const zoom = /Zoom/.test(lens), movie = /Movie/.test(lens), p105 = /105/.test(lens), p35 = /35mm/.test(lens);
    const core = D * (p105 ? 0.05 : 0.035), glow = D * (p105 ? 0.2 : 0.13), ringR = D * (zoom ? 0.11 : 0.075), ringW = D * 0.01;
    // the ghosts: discs on the line from the flare through the picture's centre (the lens's internal reflections)
    const cx = w / 2, cy = h / 2, GH = [[0.45, 0.012, [0.5, 1, 0.6]], [0.75, 0.025, [0.7, 0.5, 1]], [1.25, 0.018, [1, 0.7, 0.35]], [1.55, 0.045, [0.45, 0.8, 1]],
      [1.9, 0.03, [1, 0.45, 0.6]], [2.25, 0.06, [0.6, 1, 0.8]]].slice(0, zoom ? 6 : p105 ? 3 : 4);
    const ghosts = GH.map(([t, r, c]) => ({ x: fx + (cx - fx) * t, y: fy + (cy - fy) * t, r: D * r, c }));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - fx, dy = y - fy, d = Math.hypot(dx, dy);
      let r = 0, g = 0, b = 0;
      const k = Math.exp(-(d / core) * (d / core)) * 1.4 + Math.exp(-d / glow) * 0.55;        // the hot core + the glow
      r += k * tint[0]; g += k * tint[1]; b += k * tint[2];
      if (!movie) {                                                                              // the halo ring, red outside
        const q = (d - ringR) / ringW, e = Math.exp(-q * q) * 0.28;
        r += e * (q > 0 ? 1 : 0.55); g += e * 0.7; b += e * (q < 0 ? 1 : 0.5);
      }
      if (zoom || p35) { const th = Math.atan2(dy, dx), ray = Math.pow(0.5 + 0.5 * Math.cos(th * (zoom ? 12 : 8)), 30) * Math.exp(-d / (D * 0.16)) * 0.5; r += ray; g += ray; b += ray; }
      if (movie || p35) {                                                                        // the anamorphic streak
        const st = Math.exp(-Math.abs(dy) / (D * 0.0025)) * Math.exp(-Math.abs(dx) / (D * (movie ? 0.45 : 0.2))) * (movie ? 0.9 : 0.45);
        r += st * 0.7; g += st * 0.85; b += st;
      }
      for (const o of ghosts) {
        const t = Math.hypot(x - o.x, y - o.y) / o.r; if (t >= 1.15) continue;
        const e = (t < 1 ? 0.1 + 0.05 * t * t : 0.15 * Math.max(0, (1.15 - t) / 0.15)) * 1.2;
        r += e * o.c[0]; g += e * o.c[1]; b += e * o.c[2];
      }
      const L = [Math.min(1, r * B), Math.min(1, g * B), Math.min(1, b * B)], i = (y * w + x) * 4, a = s[i + 3] / 255;
      for (let c = 0; c < 3; c++) { const sc = s[i + c] / 255, scr = 1 - (1 - sc) * (1 - L[c]); out[i + c] = clamp(Math.round((scr * a + L[c] * (1 - a)) * 255)); }
      out[i + 3] = clamp(Math.round(Math.max(a, Math.max(L[0], L[1], L[2])) * 255));
    }
    return out;
  }
  function dropShadow(s, w, h, p) {
    const n = w * h, A = new Float32Array(n), [ox, oy] = offsetOf(p.angle, p.distance), sp = p.spread / 100;
    const dx = Math.round(ox), dy = Math.round(oy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = x - dx, sy = y - dy; if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      A[y * w + x] = s[(sy * w + sx) * 4 + 3] / 255;
    }
    let M = A;
    if (p.size > 0.2) { M = gaussPlanes([A], w, h, Math.max(0.3, p.size * (1 - sp) / 2))[0]; }
    if (sp > 0) for (let i = 0; i < n; i++) M[i] = Math.min(1, M[i] / Math.max(0.05, 1 - sp));
    const col = hex3(p.color), op = p.opacity / 100, out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < n; i++) {                                                     // the pixels OVER their shadow
      const o = i * 4, as = s[o + 3] / 255, ash = M[i] * op, ao = as + ash * (1 - as);
      if (ao <= 0) continue;
      for (let c = 0; c < 3; c++) out[o + c] = clamp(Math.round((s[o + c] * as + col[c] * ash * (1 - as)) / ao));
      out[o + 3] = clamp(Math.round(ao * 255));
    }
    return out;
  }
  function extrude3d(s, w, h, p) {
    const depth = Math.max(1, Math.round(p.depth)), [ux, uy] = offsetOf(p.angle, 1), solid = p.side === "solid colour", col = hex3(p.color), sh = p.shade / 100;
    const out = new Uint8ClampedArray(s.length);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;                                             // only where there are pixels
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (s[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return Uint8ClampedArray.from(s);
    const over = (o, r, g, b, a) => { const ab = out[o + 3] / 255, ao = a + ab * (1 - a); if (ao <= 0) return;
      out[o] = (r * a + out[o] * ab * (1 - a)) / ao; out[o + 1] = (g * a + out[o + 1] * ab * (1 - a)) / ao; out[o + 2] = (b * a + out[o + 2] * ab * (1 - a)) / ao; out[o + 3] = ao * 255; };
    for (let k = depth; k >= 1; k--) {                                                // the back slice first, darkest
      const dx = Math.round(ux * k), dy = Math.round(uy * k), dark = 1 - sh * (k / depth);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4, a = s[i + 3] / 255; if (!a) continue;
        const tx = x + dx, ty = y + dy; if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        const base = solid ? col : [s[i] * 0.8, s[i + 1] * 0.8, s[i + 2] * 0.8];
        over((ty * w + tx) * 4, base[0] * dark, base[1] * dark, base[2] * dark, a);
      }
    }
    for (let i = 0; i < s.length; i += 4) { const a = s[i + 3] / 255; if (a) over(i, s[i], s[i + 1], s[i + 2], a); }   // the face on top
    return out;
  }
  /* 2.389.0: the helpers the new ones need */
  function CURVE(id, label) { return { id, label, type: "curve", def: { rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] } }; }
  function COL(id, label, def) { return { id, label, type: "color", def }; }
  function hex3(h) { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || "")); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]; }
  /** A curve's points [[in, out], ...] -> a 256 LUT through them (monotone cubic - no overshoot, like Photoshop's). */
  function curveLut(pts) {
    const P = (Array.isArray(pts) && pts.length >= 2 ? pts : [[0, 0], [255, 255]]).map((q) => [Math.max(0, Math.min(255, +q[0] || 0)), Math.max(0, Math.min(255, +q[1] || 0))])
      .sort((a, b) => a[0] - b[0]).filter((q, i, a) => i === 0 || q[0] > a[i - 1][0]);
    const out = new Uint8ClampedArray(256), n = P.length;
    if (n === 1) { out.fill(P[0][1]); return out; }
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], t = a * a + b * b;
      if (t > 9) { const k = 3 / Math.sqrt(t); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    for (let x = 0; x < 256; x++) {
      if (x <= P[0][0]) { out[x] = P[0][1]; continue; }
      if (x >= P[n - 1][0]) { out[x] = P[n - 1][1]; continue; }
      let i = 0; while (x > P[i + 1][0]) i++;
      const h = P[i + 1][0] - P[i][0], t = (x - P[i][0]) / h, t2 = t * t, t3 = t2 * t;
      out[x] = Math.round((2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h * m[i + 1]);
    }
    return out;
  }
  /** out(x, y) = src at f(x, y) (bilinear) - the distort filters */
  function warp(s, w, h, f) {
    const out = new Uint8ClampedArray(s.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [sx, sy] = f(x, y), i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[i + c] = sample(s, w, h, sx, sy, c);
    }
    return out;
  }
  function valueNoise(seed) {
    const r = rngOf(seed), T = new Float32Array(256 * 256); for (let i = 0; i < T.length; i++) T[i] = r();
    const at = (x, y) => T[((y & 255) << 8) | (x & 255)], sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
      return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy; };
  }
  const byId = (id) => FILTERS.find((f) => f.id === id) || null;
  // 2.389.0: object defaults (a curve) are COPIED - an adjustment layer must never share its params with the next one
  const defaults = (f) => Object.fromEntries((f.params || []).map((q) => [q.id, q.def && typeof q.def === "object" ? JSON.parse(JSON.stringify(q.def)) : q.def]));
  const pad = (f, p) => (f.pad ? Math.max(0, Math.ceil(f.pad(Object.assign(defaults(f), p || {})))) : 0);
  /** Run a filter: fills in the defaults for any missing parameter. */
  function run(id, rgba, w, h, params, ctx) {            // 2.480.0: ctx = {x, y, W, H} - where this piece is in the picture
    const f = byId(id); if (!f) throw new Error("unknown filter " + id);
    return f.apply(rgba, w, h, Object.assign(defaults(f), params || {}), ctx || { x: 0, y: 0, W: w, H: h });
  }
  /** Blend a filtered result into the original by a 0..255 mask (the
   *  selection) - in place on `orig`. mask null = everywhere. */
  function blend(orig, filtered, mask) {
    if (!mask) { orig.set(filtered); return orig; }
    for (let i = 0; i < mask.length; i++) {
      const a = mask[i] / 255; if (!a) continue;
      const o = i * 4;
      for (let c = 0; c < 4; c++) orig[o + c] = Math.round(orig[o + c] * (1 - a) + filtered[o + c] * a);
    }
    return orig;
  }

  const api = { FILTERS, byId, defaults, pad, run, blend, gaussian, rgb2hsl, hsl2rgb, curveLut, hex3, swirlFall, offsetOf, gaussPlanes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IEFilters = api;
})(typeof window !== "undefined" ? window : globalThis);
