/* filters3.js — THE FILTER MENU, ROUND B part 1 (2.481.0): Blur, Blur Gallery, Noise, Sharpen, Other. window.IEFilters3.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Blur          Surface Blur (edges kept), Smart Blur (normal / edge only / overlay edge), Average, Lens Blur (a depth
 *                 from transparency or brightness, a focal distance, the iris shape, specular highlights, noise)
 *   Blur Gallery  Field Blur (up to three pins, each its own blur), Iris Blur (a sharp ellipse fading out), Tilt-Shift
 *                 is in Blur already, Path Blur (along a curve), Spin Blur (round an ellipse)
 *   Noise         Reduce Noise (strength, preserve details, colour noise, sharpen details), Dust & Scratches,
 *                 Despeckle
 *   Sharpen       Smart Sharpen (remove Gaussian / Lens / Motion blur, reduce noise, fade in shadows / highlights)
 *   Other         High Pass, Minimum, Maximum (square or round), Offset (wrap / repeat edges / see-through), Custom
 *                 (a 5 x 5 kernel, scale, offset), HSB / HSL
 * Pure (rgba, w, h, params, ctx) -> RGBA like filters.js, registered into IEFilters.FILTERS at load (the Filter menu,
 * the dialog with its live preview, the selection, smart filters, Ctrl+F, Actions). A centre / point parameter pair
 * (cx, cy) can be placed by a click on the picture (filters.js's rule). The 5 x 5 kernel is a parameter kind of its
 * own (E.paramTypes.kernel). Pure helpers (Node: scripts/test-filters3.js): blurPyramid / variableBlur, bilateral1D,
 * medianPlane, minMax, convolve.
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const FX = isNode ? require("./filters.js") : root.IEFilters;
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const N = (id, label, min, max, step, def) => ({ id, label, type: "range", min, max, step, def });
  const SEL = (id, label, options, def) => ({ id, label, type: "select", options, def });
  const CHK = (id, label, def) => ({ id, label, type: "check", def });
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------- helpers ---------------- */
  /** premultiplied float planes and back (a blur must not drag see-through black in) */
  function planes(s, n) { const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), A = new Float32Array(n); for (let i = 0; i < n; i++) { const a = s[i * 4 + 3] / 255; A[i] = a; R[i] = s[i * 4] * a; G[i] = s[i * 4 + 1] * a; B[i] = s[i * 4 + 2] * a; } return [R, G, B, A]; }
  function unplanes(P, n) { const [R, G, B, A] = P, o = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { const a = A[i]; if (a > 1e-6) { o[i * 4] = R[i] / a; o[i * 4 + 1] = G[i] / a; o[i * 4 + 2] = B[i] / a; } o[i * 4 + 3] = a * 255; } return o; }
  const SIGMAS = [0, 1, 2, 4, 8, 16, 32, 64];
  /** the picture blurred at a few sizes (premultiplied planes), for blurs that change across the picture */
  function blurPyramid(s, w, h, maxSigma) {
    const n = w * h, P0 = planes(s, n), levels = [{ sigma: 0, P: P0 }];
    for (const sg of SIGMAS.slice(1)) { if (sg > maxSigma * 2 && levels.length > 1) break; levels.push({ sigma: sg, P: FX.gaussPlanes(P0, w, h, sg) }); }
    return levels;
  }
  /** each pixel blurred by its own sigma(x, y) - between the two nearest pyramid levels */
  function variableBlur(s, w, h, sigmaAt, maxSigma) {
    const L = blurPyramid(s, w, h, Math.max(0.5, maxSigma)), n = w * h, out = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, sg = Math.max(0, Math.min(L[L.length - 1].sigma, sigmaAt(x, y)));
      let k = 0; while (k < L.length - 2 && L[k + 1].sigma < sg) k++;
      const a = L[k], b = L[Math.min(L.length - 1, k + 1)], t = b.sigma > a.sigma ? Math.max(0, Math.min(1, (sg - a.sigma) / (b.sigma - a.sigma))) : 0;
      for (let c = 0; c < 4; c++) out[c][i] = a.P[c][i] * (1 - t) + b.P[c][i] * t;
    }
    return unplanes(out, n);
  }
  /** an edge-keeping blur along one direction (dx, dy = 1, 0 or 0, 1): neighbours weigh less the more they differ */
  function bilateral1D(s, w, h, r, thr, horiz) {
    const out = new Uint8ClampedArray(s.length), t = Math.max(1, thr) * 2.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let ws = 0, ar = 0, ag = 0, ab = 0, aa = 0;
      for (let k = -r; k <= r; k++) {
        const xx = horiz ? Math.max(0, Math.min(w - 1, x + k)) : x, yy = horiz ? y : Math.max(0, Math.min(h - 1, y + k)), j = (yy * w + xx) * 4;
        const d = (Math.abs(s[j] - s[i]) + Math.abs(s[j + 1] - s[i + 1]) + Math.abs(s[j + 2] - s[i + 2])) / 3;
        const wt = Math.max(0, 1 - d / t) * (s[j + 3] / 255); if (!wt) continue;
        ws += wt; ar += s[j] * wt; ag += s[j + 1] * wt; ab += s[j + 2] * wt; aa += s[j + 3];
      }
      if (ws > 0) { out[i] = ar / ws; out[i + 1] = ag / ws; out[i + 2] = ab / ws; } else { out[i] = s[i]; out[i + 1] = s[i + 1]; out[i + 2] = s[i + 2]; }
      out[i + 3] = s[i + 3];
    }
    return out;
  }
  const surface = (s, w, h, r, thr) => bilateral1D(bilateral1D(s, w, h, r, thr, true), w, h, r, thr, false);
  /** the median of a channel in a (2r+1)² window - a running histogram along each row */
  function medianPlane(s, w, h, r, c) {
    const out = new Uint8Array(w * h), hist = new Int32Array(256), half = ((2 * r + 1) * (2 * r + 1) + 1) >> 1;
    for (let y = 0; y < h; y++) {
      hist.fill(0);
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = -r; xx <= r; xx++) hist[s[(Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))) * 4 + c]]++;
      for (let x = 0; x < w; x++) {
        let acc = 0, v = 0; while (v < 255 && acc + hist[v] < half) acc += hist[v++];
        out[y * w + x] = v;
        const xo = Math.max(0, Math.min(w - 1, x - r)), xn = Math.max(0, Math.min(w - 1, x + r + 1));
        for (let yy = y - r; yy <= y + r; yy++) { const row = Math.max(0, Math.min(h - 1, yy)) * w; hist[s[(row + xo) * 4 + c]]--; hist[s[(row + xn) * 4 + c]]++; }
      }
    }
    return out;
  }
  /** the smallest / largest of each channel within r (square: separable; round: a disc) */
  function minMax(s, w, h, r, max, round) {
    const out = Uint8ClampedArray.from(s);
    if (r < 1) return out;
    const pick = max ? Math.max : Math.min;
    if (!round) {
      const tmp = new Uint8ClampedArray(s.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) { let v = s[(y * w + x) * 4 + c]; for (let k = -r; k <= r; k++) { const xx = Math.max(0, Math.min(w - 1, x + k)); v = pick(v, s[(y * w + xx) * 4 + c]); } tmp[(y * w + x) * 4 + c] = v; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) { let v = tmp[(y * w + x) * 4 + c]; for (let k = -r; k <= r; k++) { const yy = Math.max(0, Math.min(h - 1, y + k)); v = pick(v, tmp[(yy * w + x) * 4 + c]); } out[(y * w + x) * 4 + c] = v; }
      return out;
    }
    const offs = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let v = s[(y * w + x) * 4 + c];
      for (const [dx, dy] of offs) v = pick(v, s[(Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))) * 4 + c]);
      out[(y * w + x) * 4 + c] = v;
    }
    return out;
  }
  /** a square kernel (k x k, row by row) over RGB; result / scale + offset */
  function convolve(s, w, h, K, scale, offset) {
    const k = Math.round(Math.sqrt(K.length)), r = (k - 1) >> 1, out = new Uint8ClampedArray(s.length), sc = scale || 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let a0 = 0, a1 = 0, a2 = 0;
      for (let j = 0; j < k; j++) for (let q = 0; q < k; q++) { const v = K[j * k + q]; if (!v) continue; const o = ((Math.max(0, Math.min(h - 1, y + j - r))) * w + Math.max(0, Math.min(w - 1, x + q - r))) * 4; a0 += s[o] * v; a1 += s[o + 1] * v; a2 += s[o + 2] * v; }
      out[i] = a0 / sc + offset; out[i + 1] = a1 / sc + offset; out[i + 2] = a2 / sc + offset; out[i + 3] = s[i + 3];
    }
    return out;
  }
  function sampleAt(s, w, h, x, y, out) {
    x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
    const x0 = x | 0, y0 = y | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
    for (let c = 0; c < 4; c++) { const a = s[(y0 * w + x0) * 4 + c], b = s[(y0 * w + x1) * 4 + c], d = s[(y1 * w + x0) * 4 + c], e = s[(y1 * w + x1) * 4 + c]; out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy; }
    return out;
  }
  /** a blur along a direction field: dir(x, y) -> [dx, dy] (length = how far), n samples, premultiplied */
  function dirBlur(s, w, h, dir, n) {
    const out = new Uint8ClampedArray(s.length), px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [dx, dy] = dir(x, y), len = Math.hypot(dx, dy), i = (y * w + x) * 4;
      if (len < 0.5) { for (let c = 0; c < 4; c++) out[i + c] = s[i + c]; continue; }
      const k = Math.max(2, Math.min(n, Math.ceil(len))); let r = 0, g = 0, b = 0, a = 0;
      for (let t = 0; t < k; t++) { const f = t / (k - 1) - 0.5; sampleAt(s, w, h, x + dx * f, y + dy * f, px); const al = px[3] / 255; r += px[0] * al; g += px[1] * al; b += px[2] * al; a += al; }
      if (a > 1e-6) { out[i] = r / a; out[i + 1] = g / a; out[i + 2] = b / a; }
      out[i + 3] = a / k * 255;
    }
    return out;
  }
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1))); return t * t * (3 - 2 * t); };

  /* ---------------- Blur ---------------- */
  function smartBlur(s, w, h, p) {
    const out = surface(s, w, h, Math.round(p.radius), p.threshold);
    if (p.mode === "normal") return out;
    const o = new Uint8ClampedArray(s.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, xr = Math.min(w - 1, x + 1), yd = Math.min(h - 1, y + 1);
      const L = luma(out[i], out[i + 1], out[i + 2]), gx = luma(out[(y * w + xr) * 4], out[(y * w + xr) * 4 + 1], out[(y * w + xr) * 4 + 2]) - L, gy = luma(out[(yd * w + x) * 4], out[(yd * w + x) * 4 + 1], out[(yd * w + x) * 4 + 2]) - L;
      const edge = Math.hypot(gx, gy) > p.threshold * 0.5;
      if (p.mode === "edge only") { const v = edge ? 255 : 0; o[i] = o[i + 1] = o[i + 2] = v; o[i + 3] = 255; }
      else { if (edge) { o[i] = o[i + 1] = o[i + 2] = 255; } else { o[i] = out[i]; o[i + 1] = out[i + 1]; o[i + 2] = out[i + 2]; } o[i + 3] = s[i + 3]; }
    }
    return o;
  }
  function average(s) {
    let r = 0, g = 0, b = 0, a = 0; for (let i = 0; i < s.length; i += 4) { const al = s[i + 3] / 255; r += s[i] * al; g += s[i + 1] * al; b += s[i + 2] * al; a += al; }
    const out = new Uint8ClampedArray(s.length); if (!a) return out;
    for (let i = 0; i < s.length; i += 4) { out[i] = r / a; out[i + 1] = g / a; out[i + 2] = b / a; out[i + 3] = s[i + 3]; }
    return out;
  }
  const IRIS = { "circle (disc)": 0, triangle: 3, square: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8 };
  function irisPoints(shape, rot, count) {
    const sides = IRIS[shape] || 0, pts = [], a0 = rot * Math.PI / 180;
    for (let ring = 1; ring <= 4; ring++) {
      const m = ring * 6;
      for (let k = 0; k < m; k++) {
        const a = a0 + k / m * 2 * Math.PI; let rr = ring / 4;
        if (sides) { const seg = 2 * Math.PI / sides, t = ((a - a0) % seg + seg) % seg - seg / 2; rr *= Math.cos(Math.PI / sides) / Math.cos(t); }
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
    }
    pts.push([0, 0]);
    return count ? pts.slice(0, count) : pts;
  }
  function lensBlur(s, w, h, p) {
    const n = w * h, depth = new Float32Array(n);
    for (let i = 0; i < n; i++) depth[i] = p.depth === "transparency" ? s[i * 4 + 3] : p.depth === "brightness" ? luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]) : 255;
    if (p.invert) for (let i = 0; i < n; i++) depth[i] = 255 - depth[i];
    const pts = irisPoints(p.shape, p.rotation), R = p.radius, out = new Uint8ClampedArray(s.length), rnd = rng(17), lin = new Float32Array(n * 3);
    // brighter-than-threshold pixels glow (the specular highlights that make bokeh)
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { let v = s[i * 4 + c] / 255; v = v * v; const L = luma(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]); if (p.brightness > 0 && L >= p.threshold) v *= 1 + p.brightness / 10; lin[i * 3 + c] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, rad = R * (p.depth === "none" ? 1 : Math.abs(depth[i] - p.focal) / 255);
      let r = 0, g = 0, b = 0, a = 0, k = 0;
      if (rad < 0.6) { r = lin[i * 3]; g = lin[i * 3 + 1]; b = lin[i * 3 + 2]; a = s[i * 4 + 3]; k = 1; }
      else for (const [dx, dy] of pts) { const xx = Math.max(0, Math.min(w - 1, Math.round(x + dx * rad))), yy = Math.max(0, Math.min(h - 1, Math.round(y + dy * rad))), j = yy * w + xx, al = s[j * 4 + 3] / 255; r += lin[j * 3] * al; g += lin[j * 3 + 1] * al; b += lin[j * 3 + 2] * al; a += s[j * 4 + 3]; k += al; }
      const nz = p.noise ? (rnd() - 0.5) * p.noise : 0;
      if (k > 0) { out[i * 4] = Math.sqrt(Math.min(1, r / k)) * 255 + nz; out[i * 4 + 1] = Math.sqrt(Math.min(1, g / k)) * 255 + nz; out[i * 4 + 2] = Math.sqrt(Math.min(1, b / k)) * 255 + nz; }
      out[i * 4 + 3] = rad < 0.6 ? s[i * 4 + 3] : a / pts.length;
    }
    return out;
  }

  /* ---------------- Blur Gallery ---------------- */
  function fieldBlur(s, w, h, p) {
    const pins = [[p.p1x, p.p1y, p.p1b, true], [p.p2x, p.p2y, p.p2b, true], [p.p3x, p.p3y, p.p3b, !!p.p3]].filter((q) => q[3]).map(([x, y, b]) => [x / 100 * w, y / 100 * h, b]);
    const maxB = Math.max(...pins.map((q) => q[2]));
    return variableBlur(s, w, h, (x, y) => { let ws = 0, acc = 0; for (const [px, py, b] of pins) { const d2 = (x - px) * (x - px) + (y - py) * (y - py) + 1, wt = 1 / d2; ws += wt; acc += b * wt; } return acc / ws / 2; }, maxB / 2);
  }
  function irisBlur(s, w, h, p, ctx) {
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h, ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0;
    const cx = p.cx / 100 * W - ox, cy = p.cy / 100 * H - oy, m = Math.min(W, H), rx = Math.max(1, p.rx / 100 * m), ry = Math.max(1, p.ry / 100 * m), a = p.rotation * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), f = p.feather / 100;
    return variableBlur(s, w, h, (x, y) => { const dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry, d = Math.sqrt(u * u + v * v); return smooth(1 - f, 1, d) * p.blur / 2; }, p.blur / 2);
  }
  function spinBlur(s, w, h, p, ctx) {
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h, ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0;
    const cx = p.cx / 100 * W - ox, cy = p.cy / 100 * H - oy, m = Math.min(W, H), rx = Math.max(1, p.rx / 100 * m), ry = Math.max(1, p.ry / 100 * m), ang = p.angle * Math.PI / 180, f = p.feather / 100;
    return dirBlur(s, w, h, (x, y) => { const dx = x - cx, dy = y - cy, d = Math.sqrt((dx / rx) * (dx / rx) + (dy / ry) * (dy / ry)), k = 1 - smooth(1 - f, 1, d), r = Math.hypot(dx, dy); return [-dy / (r || 1) * r * ang * k, dx / (r || 1) * r * ang * k]; }, 48);
  }
  function pathBlur(s, w, h, p, ctx) {
    const W = (ctx && ctx.W) || w, H = (ctx && ctx.H) || h, ox = (ctx && ctx.x) || 0, oy = (ctx && ctx.y) || 0;
    const P0 = [p.ax / 100 * W - ox, p.ay / 100 * H - oy], P1 = [p.bx / 100 * W - ox, p.by / 100 * H - oy], P2 = [p.ex / 100 * W - ox, p.ey / 100 * H - oy];
    const pts = []; for (let k = 0; k <= 32; k++) { const t = k / 32, u = 1 - t; pts.push([u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1], 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), t]); }
    return dirBlur(s, w, h, (x, y) => {
      let best = 0, bd = Infinity; for (let k = 0; k < pts.length; k++) { const d = (pts[k][0] - x) * (pts[k][0] - x) + (pts[k][1] - y) * (pts[k][1] - y); if (d < bd) { bd = d; best = k; } }
      const q = pts[best], L = Math.hypot(q[2], q[3]) || 1, sp = p.speed * (1 - p.taper / 100 * q[4]);
      return [q[2] / L * sp, q[3] / L * sp];
    }, 64);
  }

  /* ---------------- Noise ---------------- */
  function reduceNoise(s, w, h, p) {
    const n = w * h, Y = new Uint8ClampedArray(s.length), C = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const r = s[i * 4], g = s[i * 4 + 1], b = s[i * 4 + 2], y = luma(r, g, b); Y[i * 4] = Y[i * 4 + 1] = Y[i * 4 + 2] = y; Y[i * 4 + 3] = 255; C[i * 2] = b - y; C[i * 2 + 1] = r - y; }
    const thr = p.strength * 4 * (1 - p.preserve / 100 * 0.7) + 1, rY = Math.max(1, Math.round(p.strength / 2));
    let Ys = p.strength > 0 ? surface(Y, w, h, rY, thr) : Y;
    if (p.sharpen > 0) { const bl = FX.gaussian(Ys, w, h, 1.5), k = p.sharpen / 100; const t2 = new Uint8ClampedArray(Ys.length); for (let i = 0; i < Ys.length; i++) t2[i] = Ys[i] + (Ys[i] - bl[i]) * k; Ys = t2; }
    let Cb = C;
    if (p.color > 0) { const cr = p.color / 100 * 6; const P = FX.gaussPlanes([C.filter((_, i) => i % 2 === 0), C.filter((_, i) => i % 2 === 1)], w, h, cr); Cb = new Float32Array(n * 2); for (let i = 0; i < n; i++) { Cb[i * 2] = P[0][i]; Cb[i * 2 + 1] = P[1][i]; } }
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < n; i++) { const y = Ys[i * 4], cb = Cb[i * 2], cr = Cb[i * 2 + 1], r = y + cr, b = y + cb, g = (y - 0.299 * r - 0.114 * b) / 0.587; out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = s[i * 4 + 3]; }
    return out;
  }
  function dustScratches(s, w, h, p) {
    const r = Math.max(1, Math.round(p.radius)), M = [0, 1, 2].map((c) => medianPlane(s, w, h, r, c)), out = Uint8ClampedArray.from(s);
    for (let i = 0; i < w * h; i++) {
      const far = [0, 1, 2].some((c) => Math.abs(s[i * 4 + c] - M[c][i]) > p.threshold);
      if (far) for (let c = 0; c < 3; c++) out[i * 4 + c] = M[c][i];
    }
    return out;
  }
  function despeckle(s, w, h) {                  // a pixel unlike its (alike) neighbours is noise; an edge's neighbours differ, so it stays
    const M = [0, 1, 2].map((c) => medianPlane(s, w, h, 1, c)), out = Uint8ClampedArray.from(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let lo = 255, hi = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const j = (Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))) * 4, L = luma(s[j], s[j + 1], s[j + 2]); if (L < lo) lo = L; if (L > hi) hi = L; }
      if (hi - lo < 48) for (let c = 0; c < 3; c++) out[i * 4 + c] = M[c][i];
    }
    return out;
  }

  /* ---------------- Sharpen ---------------- */
  function smartSharpen(s, w, h, p) {
    let bl;
    if (p.remove === "motion blur") { const a = p.angle * Math.PI / 180, d = p.radius * 2; bl = dirBlur(s, w, h, () => [Math.cos(a) * d, Math.sin(a) * d], 24); }
    else if (p.remove === "lens blur") { const pts = irisPoints("circle (disc)", 0); bl = new Uint8ClampedArray(s.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; let acc = [0, 0, 0]; for (const [dx, dy] of pts) { const j = (Math.max(0, Math.min(h - 1, Math.round(y + dy * p.radius))) * w + Math.max(0, Math.min(w - 1, Math.round(x + dx * p.radius)))) * 4; acc[0] += s[j]; acc[1] += s[j + 1]; acc[2] += s[j + 2]; } for (let c = 0; c < 3; c++) bl[i + c] = acc[c] / pts.length; bl[i + 3] = s[i + 3]; } }
    else bl = FX.gaussian(s, w, h, p.radius);
    const out = new Uint8ClampedArray(s.length), k = p.amount / 100, nz = p.noise / 100 * 12, fs = p.shadows / 100, fh = p.highlights / 100;
    for (let i = 0; i < s.length; i += 4) {
      const L = luma(s[i], s[i + 1], s[i + 2]) / 255, att = 1 - fs * smooth(0.5, 0, L) - fh * smooth(0.5, 1, L);
      for (let c = 0; c < 3; c++) { let d = s[i + c] - bl[i + c]; if (Math.abs(d) < nz) d *= Math.abs(d) / (nz || 1); out[i + c] = s[i + c] + d * k * Math.max(0, att); }
      out[i + 3] = s[i + 3];
    }
    return out;
  }

  /* ---------------- Other ---------------- */
  function highPass(s, w, h, p) { const b = FX.gaussian(s, w, h, p.radius), out = new Uint8ClampedArray(s.length); for (let i = 0; i < s.length; i += 4) { for (let c = 0; c < 3; c++) out[i + c] = 128 + s[i + c] - b[i + c]; out[i + 3] = s[i + 3]; } return out; }
  function offset(s, w, h, p) {
    const out = new Uint8ClampedArray(s.length), dx = Math.round(p.h), dy = Math.round(p.v);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sx = x - dx, sy = y - dy; const i = (y * w + x) * 4;
      if (p.undefined === "wrap around") { sx = ((sx % w) + w) % w; sy = ((sy % h) + h) % h; }
      else if (p.undefined === "repeat edge pixels") { sx = Math.max(0, Math.min(w - 1, sx)); sy = Math.max(0, Math.min(h - 1, sy)); }
      else if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const j = (sy * w + sx) * 4; out[i] = s[j]; out[i + 1] = s[j + 1]; out[i + 2] = s[j + 2]; out[i + 3] = s[j + 3];
    }
    return out;
  }
  function hsbhsl(s, w, h, p) {
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) {
      const r = s[i] / 255, g = s[i + 1] / 255, b = s[i + 2] / 255;
      if (p.input === "rgb") {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0;
        if (d) hh = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        hh /= 6;
        if (p.rows === "hsb") { out[i] = hh * 255; out[i + 1] = mx ? d / mx * 255 : 0; out[i + 2] = mx * 255; }
        else { const l = (mx + mn) / 2, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0; out[i] = hh * 255; out[i + 1] = sat * 255; out[i + 2] = l * 255; }
      } else {
        const hh = r, sat = g, v = b;
        if (p.rows === "hsb") { const c = v * sat, x = c * (1 - Math.abs((hh * 6) % 2 - 1)), m = v - c, k = Math.floor(hh * 6) % 6, rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k]; out[i] = (rgb[0] + m) * 255; out[i + 1] = (rgb[1] + m) * 255; out[i + 2] = (rgb[2] + m) * 255; }
        else { const q = FX.hsl2rgb(hh, sat, v); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
      }
      out[i + 3] = s[i + 3];
    }
    return out;
  }
  const IDENT5 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const SHARP5 = [0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, 5, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0];

  const FILTERS3 = [
    // Blur
    { id: "surfaceblur", sub: "Blur", name: "Surface Blur", params: [N("radius", "Radius (px)", 1, 100, 1, 5), N("threshold", "Threshold (levels)", 2, 255, 1, 15)], pad: (p) => p.radius,
      apply: (s, w, h, p) => surface(s, w, h, Math.round(p.radius), p.threshold) },
    { id: "smartblur", sub: "Blur", name: "Smart Blur", params: [N("radius", "Radius (px)", 1, 100, 1, 3), N("threshold", "Threshold", 1, 100, 1, 25), SEL("mode", "Mode", ["normal", "edge only", "overlay edge"], "normal")], pad: (p) => p.radius + 1, apply: smartBlur },
    { id: "average", sub: "Blur", name: "Average", params: [], apply: (s) => average(s) },
    { id: "lensblur", sub: "Blur", name: "Lens Blur", params: [SEL("depth", "Depth map", ["none", "transparency", "brightness"], "none"), N("focal", "Blur focal distance", 0, 255, 1, 0), CHK("invert", "Invert the depth", false),
        SEL("shape", "Iris shape", Object.keys(IRIS), "hexagon"), N("radius", "Iris radius (px)", 0, 100, 1, 12), N("rotation", "Blade rotation (°)", 0, 360, 1, 0),
        N("brightness", "Specular brightness", 0, 100, 1, 0), N("threshold", "Specular threshold", 0, 255, 1, 255), N("noise", "Noise", 0, 100, 1, 0)], pad: (p) => p.radius + 1, apply: lensBlur },
    // Blur Gallery
    { id: "fieldblur", sub: "Blur Gallery", name: "Field Blur", params: [N("p1x", "Pin 1 x (%)", 0, 100, 1, 25), N("p1y", "Pin 1 y (%)", 0, 100, 1, 50), N("p1b", "Pin 1 blur (px)", 0, 200, 1, 15),
        N("p2x", "Pin 2 x (%)", 0, 100, 1, 75), N("p2y", "Pin 2 y (%)", 0, 100, 1, 50), N("p2b", "Pin 2 blur (px)", 0, 200, 1, 0), CHK("p3", "Pin 3", false), N("p3x", "Pin 3 x (%)", 0, 100, 1, 50), N("p3y", "Pin 3 y (%)", 0, 100, 1, 15), N("p3b", "Pin 3 blur (px)", 0, 200, 1, 30)],
      pad: (p) => Math.max(p.p1b, p.p2b, p.p3 ? p.p3b : 0), apply: fieldBlur },
    { id: "irisblur", sub: "Blur Gallery", name: "Iris Blur", params: [N("cx", "Centre x (%)", 0, 100, 1, 50), N("cy", "Centre y (%)", 0, 100, 1, 50), N("rx", "Width (% of the short side)", 1, 150, 1, 30), N("ry", "Height (% of the short side)", 1, 150, 1, 30),
        N("rotation", "Rotation (°)", -180, 180, 1, 0), N("feather", "Transition (%)", 1, 100, 1, 40), N("blur", "Blur (px)", 0, 200, 1, 15)], pad: (p) => p.blur, apply: irisBlur },
    { id: "pathblur", sub: "Blur Gallery", name: "Path Blur", params: [N("ax", "Start x (%)", 0, 100, 1, 15), N("ay", "Start y (%)", 0, 100, 1, 70), N("bx", "Curve x (%)", 0, 100, 1, 50), N("by", "Curve y (%)", 0, 100, 1, 30),
        N("ex", "End x (%)", 0, 100, 1, 85), N("ey", "End y (%)", 0, 100, 1, 70), N("speed", "Speed (px)", 0, 300, 1, 40), N("taper", "Taper (%)", 0, 100, 1, 0)], pad: (p) => p.speed, apply: pathBlur },
    { id: "spinblur", sub: "Blur Gallery", name: "Spin Blur", params: [N("cx", "Centre x (%)", 0, 100, 1, 50), N("cy", "Centre y (%)", 0, 100, 1, 50), N("rx", "Width (% of the short side)", 1, 150, 1, 35), N("ry", "Height (% of the short side)", 1, 150, 1, 35),
        N("angle", "Blur angle (°)", 0, 360, 1, 15), N("feather", "Transition (%)", 1, 100, 1, 25)], pad: () => 0, apply: spinBlur },
    // Noise
    { id: "reducenoise", sub: "Noise", name: "Reduce Noise", params: [N("strength", "Strength", 0, 10, 1, 6), N("preserve", "Preserve details (%)", 0, 100, 1, 60), N("color", "Reduce color noise (%)", 0, 100, 1, 45), N("sharpen", "Sharpen details (%)", 0, 100, 1, 25)],
      pad: (p) => p.strength + 6, apply: reduceNoise },
    { id: "dustscratches", sub: "Noise", name: "Dust & Scratches", params: [N("radius", "Radius (px)", 1, 16, 1, 2), N("threshold", "Threshold (levels)", 0, 255, 1, 20)], pad: (p) => p.radius, apply: dustScratches },
    { id: "despeckle", sub: "Noise", name: "Despeckle", params: [], pad: () => 1, apply: despeckle },
    // Sharpen
    { id: "smartsharpen", sub: "Sharpen", name: "Smart Sharpen", params: [N("amount", "Amount (%)", 1, 500, 1, 200), N("radius", "Radius (px)", 0.1, 64, 0.1, 1.5), N("noise", "Reduce noise (%)", 0, 100, 1, 10),
        SEL("remove", "Remove", ["gaussian blur", "lens blur", "motion blur"], "lens blur"), N("angle", "Motion angle (°)", -180, 180, 1, 0), N("shadows", "Fade in shadows (%)", 0, 100, 1, 0), N("highlights", "Fade in highlights (%)", 0, 100, 1, 0)],
      pad: (p) => Math.ceil(p.radius * 3), apply: smartSharpen },
    // Other
    { id: "highpass", sub: "Other", name: "High Pass", params: [N("radius", "Radius (px)", 0.1, 250, 0.1, 10)], pad: (p) => Math.ceil(p.radius * 2), apply: highPass },
    { id: "minimum", sub: "Other", name: "Minimum", params: [N("radius", "Radius (px)", 1, 100, 1, 2), SEL("preserve", "Preserve", ["squareness", "roundness"], "roundness")], pad: (p) => p.radius, apply: (s, w, h, p) => minMax(s, w, h, Math.round(p.radius), false, p.preserve === "roundness") },
    { id: "maximum", sub: "Other", name: "Maximum", params: [N("radius", "Radius (px)", 1, 100, 1, 2), SEL("preserve", "Preserve", ["squareness", "roundness"], "roundness")], pad: (p) => p.radius, apply: (s, w, h, p) => minMax(s, w, h, Math.round(p.radius), true, p.preserve === "roundness") },
    { id: "offset", sub: "Other", name: "Offset", params: [N("h", "Horizontal (px right)", -4000, 4000, 1, 50), N("v", "Vertical (px down)", -4000, 4000, 1, 50), SEL("undefined", "Undefined areas", ["wrap around", "repeat edge pixels", "set to transparent"], "wrap around")], apply: offset },
    { id: "custom", sub: "Other", name: "Custom", params: [{ id: "kernel", label: "Kernel (5 x 5)", type: "kernel", def: SHARP5.slice() }, N("scale", "Scale", 1, 9999, 1, 1), N("offset", "Offset", -9999, 9999, 1, 0)], pad: () => 2,
      apply: (s, w, h, p) => convolve(s, w, h, Array.isArray(p.kernel) && p.kernel.length === 25 ? p.kernel.map(Number) : IDENT5, p.scale, p.offset) },
    { id: "hsbhsl", sub: "Other", name: "HSB / HSL", params: [SEL("input", "Input mode", ["rgb", "hsb / hsl"], "rgb"), SEL("rows", "Row order", ["hsb", "hsl"], "hsb")], apply: hsbhsl },
  ].map((f) => Object.assign({ group: "Filters" }, f));

  function register(fx) {
    if (!fx || fx.__filters3) return;
    fx.__filters3 = true;
    for (const f of FILTERS3) if (!fx.byId(f.id)) fx.FILTERS.push(f);
  }
  function install(E) {
    E.paramTypes = E.paramTypes || {};
    E.paramTypes.kernel = {
      html: (q, v) => {
        const K = Array.isArray(v) && v.length === 25 ? v : IDENT5;
        return `<div class="rw" data-pt="kernel" data-pid="${q.id}" style="display:block"><label>${q.label}</label><div style="display:grid;grid-template-columns:repeat(5,52px);gap:3px;margin-top:4px">${K.map((x, k) => `<input type="number" class="kk" data-k="${k}" value="${x}" step="1" style="width:52px">`).join("")}</div>
          <div style="display:flex;gap:6px;margin-top:4px"><button type="button" class="ghost kkI">Identity</button><button type="button" class="ghost kkS">Sharpen</button><button type="button" class="ghost kkE">Edges</button><button type="button" class="ghost kkB">Blur</button></div></div>`;
      },
      bind(el, q, params, changed) {
        if (!Array.isArray(params[q.id]) || params[q.id].length !== 25) params[q.id] = IDENT5.slice();
        const set = (K) => { params[q.id] = K.slice(); el.querySelectorAll(".kk").forEach((i) => { i.value = params[q.id][+i.dataset.k]; }); changed(true); };
        el.querySelectorAll(".kk").forEach((i) => { i.oninput = i.onchange = (ev) => { params[q.id][+i.dataset.k] = +i.value || 0; changed(ev.type === "change"); }; });
        el.querySelector(".kkI").onclick = () => set(IDENT5);
        el.querySelector(".kkS").onclick = () => set(SHARP5);
        el.querySelector(".kkE").onclick = () => set([0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, -1, 8, -1, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0]);
        el.querySelector(".kkB").onclick = () => set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
      },
    };
  }
  const api = { FILTERS3, register, install, blurPyramid, variableBlur, bilateral1D, surface, medianPlane, minMax, convolve, dirBlur, irisPoints, IDENT5, SHARP5, sampleAt, rng };
  if (isNode) module.exports = api;
  else { root.IEFilters3 = api; register(root.IEFilters); }
})(typeof window !== "undefined" ? window : globalThis);
