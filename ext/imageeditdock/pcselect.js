/* pcselect.js — THE IMAGE EDITOR'S SELECTION MATHS (2.423.0), window.PCSelect.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 4 of the Photoshop list: Select and Mask,
 * magnetic lasso, edge-aware quick selection, Select Sky, Channels / saved selections. The page is pcrefine.js; this
 * file is pure (Node: scripts/test-psrefine.js):
 *
 *   gray / sobel / boxBlur / guided                     a grey guide, its edges, O(n) box blurs, the GUIDED FILTER
 *                                                       (He, Sun, Tang 2010) - a mask made to follow the picture's edges
 *   dist / band                                         distance to the selection's edge (two passes), the edge band
 *   refine(sel, rgba, w, h, opts)                       SELECT AND MASK: radius (+ smart radius), smooth, feather,
 *                                                       contrast, shift edge -> a soft alpha 0..255
 *   decontaminate(rgba, alpha, w, h, amount, r)         edge pixels' colours pulled from the inside (no halo)
 *   edgeCost / liveWire(cost, w, h, a, b, margin)       MAGNETIC LASSO: the cheapest path along strong edges (Dijkstra
 *                                                       in a window round the two points)
 *   quickGrow(rgba, w, h, x, y, r, tol, edgeT, grad)    QUICK SELECTION that stops at edges: grow from the brush
 *   skyMask(rgba, w, h)                                  SELECT SKY: smooth, sky-coloured, reaching the top edge
 */
(function (root) {
  "use strict";
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function gray(rgba, w, h) { const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) g[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255; return g; }
  function sobel(g, w, h) {
    const m = new Float32Array(w * h); let mx = 1e-6;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X0 = Math.max(0, x - 1), X1 = Math.min(w - 1, x + 1), Y0 = Math.max(0, y - 1), Y1 = Math.min(h - 1, y + 1);
      const a = g[Y0 * w + X0], b = g[Y0 * w + x], c = g[Y0 * w + X1], d = g[y * w + X0], f = g[y * w + X1], gg = g[Y1 * w + X0], hh = g[Y1 * w + x], ii = g[Y1 * w + X1];
      const gx = (c + 2 * f + ii) - (a + 2 * d + gg), gy = (gg + 2 * hh + ii) - (a + 2 * b + c), v = Math.hypot(gx, gy);
      m[y * w + x] = v; if (v > mx) mx = v;
    }
    for (let i = 0; i < m.length; i++) m[i] /= mx;
    return m;
  }
  /** mean over a (2r+1)² box (clamped at the edges, the true count) - separable, O(n) */
  function boxBlur(src, w, h, r) {
    if (r < 1) return Float32Array.from(src);
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let s = 0; const o = y * w;
      for (let x = 0; x <= Math.min(w - 1, r); x++) s += src[o + x];
      for (let x = 0; x < w; x++) {
        const a = x - r - 1, b = x + r; if (a >= 0) s -= src[o + a]; if (b < w && x > 0) s += src[o + b];
        tmp[o + x] = s / (Math.min(w - 1, x + r) - Math.max(0, x - r) + 1);
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = 0; y <= Math.min(h - 1, r); y++) s += tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        const a = y - r - 1, b = y + r; if (a >= 0) s -= tmp[a * w + x]; if (b < h && y > 0) s += tmp[b * w + x];
        out[y * w + x] = s / (Math.min(h - 1, y + r) - Math.max(0, y - r) + 1);
      }
    }
    return out;
  }
  /** the guided filter: p (0..1) smoothed so its edges follow I's (grey guide); r = window radius, eps = how much edge */
  function guided(I, p, w, h, r, eps) {
    const n = w * h, Ip = new Float32Array(n), II = new Float32Array(n);
    for (let i = 0; i < n; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
    const mI = boxBlur(I, w, h, r), mp = boxBlur(p, w, h, r), mIp = boxBlur(Ip, w, h, r), mII = boxBlur(II, w, h, r);
    const a = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = mII[i] - mI[i] * mI[i], cv = mIp[i] - mI[i] * mp[i]; a[i] = cv / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
    const ma = boxBlur(a, w, h, r), mb = boxBlur(b, w, h, r), q = new Float32Array(n);
    for (let i = 0; i < n; i++) q[i] = ma[i] * I[i] + mb[i];
    return q;
  }
  /** each pixel's distance (px, chamfer 3-4) to the nearest pixel on the OTHER side of the selection's edge */
  function dist(sel, w, h) {
    const INF = 1e9, d = new Float32Array(w * h), inside = (i) => sel[i] >= 128;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, me = inside(i);
      const edge = (x > 0 && inside(i - 1) !== me) || (x < w - 1 && inside(i + 1) !== me) || (y > 0 && inside(i - w) !== me) || (y < h - 1 && inside(i + w) !== me);
      d[i] = edge ? 0.5 : INF;
    }
    const pass = (x, y, dx, dy, c) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) return; const i = y * w + x, j = Y * w + X; if (d[j] + c < d[i]) d[i] = d[j] + c; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { pass(x, y, -1, 0, 1); pass(x, y, 0, -1, 1); pass(x, y, -1, -1, 1.4142); pass(x, y, 1, -1, 1.4142); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { pass(x, y, 1, 0, 1); pass(x, y, 0, 1, 1); pass(x, y, 1, 1, 1.4142); pass(x, y, -1, 1, 1.4142); }
    return d;
  }
  /** a separable max (grow) / min (shrink) filter over a (2r+1)² square */
  function minmax(src, w, h, r, max) {
    const pick = max ? Math.max : Math.min, tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = src[y * w + x]; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = pick(v, src[y * w + k]); tmp[y * w + x] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = tmp[y * w + x]; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = pick(v, tmp[k * w + x]); out[y * w + x] = v; }
    return out;
  }
  /** SELECT AND MASK. opts: radius (px: the band the edge is looked for in), smart (the band narrower where the edge is
   *  sharp), smooth (px), feather (px), contrast (0..100), shift (-100..100 % of the radius, + = outwards) */
  function refine(sel, rgba, w, h, opts) {
    const o = Object.assign({ radius: 0, smart: false, smooth: 0, feather: 0, contrast: 0, shift: 0 }, opts || {});
    const n = w * h, a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = sel[i] / 255;
    let alpha = a;
    if (o.radius > 0) {
      // the edge band (within radius of the edge): each pixel judged by its colour against the nearby SURE inside and
      // SURE outside (local colour models), then cleaned along the picture's edges with the guided filter
      const I = gray(rgba, w, h), d = dist(sel, w, h), g = sobel(I, w, h), R = o.radius;
      const band = new Uint8Array(n), F = new Float32Array(n), B = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let Ri = R; if (o.smart) Ri = R * (1 - 0.75 * Math.min(1, g[i] * 2.5));
        band[i] = d[i] <= Ri ? 1 : 0;
        if (d[i] > R) { if (sel[i] >= 128) F[i] = 1; else B[i] = 1; }
      }
      const R2 = Math.max(6, Math.round(R * 1.5)), bl = (x) => boxBlur(boxBlur(x, w, h, R2), w, h, R2);
      const wF = bl(F), wB = bl(B), mF = [], mB = [];
      for (let c = 0; c < 3; c++) { const cf = new Float32Array(n), cb = new Float32Array(n); for (let i = 0; i < n; i++) { cf[i] = rgba[i * 4 + c] * F[i]; cb[i] = rgba[i * 4 + c] * B[i]; } mF.push(bl(cf)); mB.push(bl(cb)); }
      const est = Float32Array.from(alpha);
      for (let i = 0; i < n; i++) {
        if (!band[i] || wF[i] < 1e-3 || wB[i] < 1e-3) continue;
        let dF = 0, dB = 0;
        for (let c = 0; c < 3; c++) { const v = rgba[i * 4 + c]; dF += (v - mF[c][i] / wF[i]) ** 2; dB += (v - mB[c][i] / wB[i]) ** 2; }
        est[i] = dF + dB > 1e-6 ? dB / (dF + dB) : alpha[i];
      }
      const q = guided(I, est, w, h, 2, 1e-4), out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = band[i] ? (est[i] < 0.08 || est[i] > 0.92 ? est[i] : clamp01(q[i])) : alpha[i];   // sure ones stay sure
      alpha = out;
    }
    // Shift Edge: the soft edge moved out (a max filter) or in (a min filter) - its softness kept
    const shiftPx = Math.round(o.shift / 100 * Math.max(4, o.radius || 8));
    if (shiftPx) alpha = minmax(alpha, w, h, Math.abs(shiftPx), shiftPx > 0);
    if (o.smooth > 0) { alpha = boxBlur(alpha, w, h, Math.round(o.smooth)); for (let i = 0; i < n; i++) { const v = alpha[i]; alpha[i] = v * v * (3 - 2 * v); } }
    if (o.feather > 0) { const r = Math.max(1, Math.round(o.feather / 2)); alpha = boxBlur(boxBlur(boxBlur(alpha, w, h, r), w, h, r), w, h, r); }
    if (o.contrast > 0) { const k = 1 + o.contrast / 12; for (let i = 0; i < n; i++) alpha[i] = clamp01((alpha[i] - 0.5) * k + 0.5); }
    const res = new Uint8Array(n); for (let i = 0; i < n; i++) res[i] = Math.round(clamp01(alpha[i]) * 255);
    return res;
  }
  /** colour decontamination: where the alpha is partial, the colour moves towards the nearby solid inside's colour */
  function decontaminate(rgba, alpha, w, h, amount, r) {
    const n = w * h, R = r || 6, wt = new Float32Array(n), ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) { const a = alpha[i] / 255, k = a > 0.92 ? 1 : 0; wt[i] = k; for (let c = 0; c < 3; c++) ch[c][i] = rgba[i * 4 + c] * k; }
    const W2 = boxBlur(boxBlur(wt, w, h, R), w, h, R), F = ch.map((c) => boxBlur(boxBlur(c, w, h, R), w, h, R));
    const out = Uint8ClampedArray.from(rgba), am = amount == null ? 1 : amount;
    for (let i = 0; i < n; i++) {
      const a = alpha[i] / 255; if (a >= 0.99 || a <= 0.01 || W2[i] < 1e-4) continue;
      const k = (1 - a) * am;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = rgba[i * 4 + c] * (1 - k) + (F[c][i] / W2[i]) * k;
    }
    return out;
  }
  /** the magnetic lasso's cost: cheap on strong edges */
  function edgeCost(rgba, w, h, contrast) {
    const g = sobel(gray(rgba, w, h), w, h), c = new Float32Array(w * h), k = contrast == null ? 0.1 : contrast;
    for (let i = 0; i < c.length; i++) { const e = g[i] < k ? g[i] * 0.3 : g[i]; c[i] = 1 - 0.97 * Math.sqrt(e); }
    return c;
  }
  /** the cheapest 8-connected path from a to b (inside their box + margin): [[x, y] ...] from a to b */
  function liveWire(cost, w, h, a, b, margin) {
    const m = margin == null ? 40 : margin;
    const x0 = Math.max(0, Math.min(a[0], b[0]) - m), y0 = Math.max(0, Math.min(a[1], b[1]) - m), x1 = Math.min(w - 1, Math.max(a[0], b[0]) + m), y1 = Math.min(h - 1, Math.max(a[1], b[1]) + m);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, N = bw * bh, D = new Float32Array(N).fill(Infinity), P = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const id = (x, y) => (y - y0) * bw + (x - x0);
    const heap = [], push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
    const ax = Math.round(a[0]), ay = Math.round(a[1]), bx = Math.round(b[0]), by = Math.round(b[1]);
    const s = id(ax, ay), t = id(bx, by); D[s] = 0; push(s, 0);
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [-1, -1, 1.4142]];
    while (heap.length) {
      const [dv, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === t) break;
      const x = (k % bw) + x0, y = Math.floor(k / bw) + y0;
      for (const [dx, dy, l] of NB) {
        const X = x + dx, Y = y + dy; if (X < x0 || Y < y0 || X > x1 || Y > y1) continue;
        const j = id(X, Y); if (done[j]) continue;
        const nd = dv + cost[Y * w + X] * l + 0.02 * l;
        if (nd < D[j]) { D[j] = nd; P[j] = k; push(j, nd); }
      }
    }
    const out = []; let k = t;
    if (P[k] < 0 && k !== s) return [[ax, ay], [bx, by]];
    while (k >= 0) { out.push([(k % bw) + x0, Math.floor(k / bw) + y0]); if (k === s) break; k = P[k]; }
    return out.reverse();
  }
  /** QUICK SELECTION that respects edges: grow from (x, y) (up to 10 brush radii) over pixels near the brush's colours that are
   *  not across a strong edge (grad > edgeT) -> a 0 / 255 mask */
  function quickGrow(rgba, w, h, x, y, r, tol, edgeT, grad) {
    const out = new Uint8Array(w * h), cx = Math.round(x), cy = Math.round(y), R = Math.max(2, r), lim = Math.max(R * 10, 120);   // far: the edges stop it
    // the brush's colours: the mean of its disc
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let yy = Math.max(0, cy - R); yy <= Math.min(h - 1, cy + R); yy++) for (let xx = Math.max(0, cx - R); xx <= Math.min(w - 1, cx + R); xx++) {
      if ((xx - cx) ** 2 + (yy - cy) ** 2 > R * R) continue; const i = (yy * w + xx) * 4; sr += rgba[i]; sg += rgba[i + 1]; sb += rgba[i + 2]; n++;
    }
    if (!n) return out;
    sr /= n; sg /= n; sb /= n;
    const T = tol == null ? 40 : tol, E2 = edgeT == null ? 0.35 : edgeT, stack = [cy * w + cx];
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return out;
    out[cy * w + cx] = 255;
    while (stack.length) {
      const k = stack.pop(), px = k % w, py = (k - px) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = px + dx, Y = py + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X; if (out[j]) continue;
        if ((X - cx) ** 2 + (Y - cy) ** 2 > lim * lim) continue;
        const i = j * 4, d = Math.hypot(rgba[i] - sr, rgba[i + 1] - sg, rgba[i + 2] - sb);
        const inDisc = (X - cx) ** 2 + (Y - cy) ** 2 <= R * R * 0.25;
        if (!inDisc && (d > T || (grad && grad[j] > E2))) continue;
        out[j] = 255; stack.push(j);
      }
    }
    return out;
  }
  /** SELECT SKY: the smooth, sky-coloured area reaching the top edge (soft at the edges) */
  function skyMask(rgba, w, h) {
    const g = gray(rgba, w, h), gr = sobel(g, w, h), loc = boxBlur(gr, w, h, 2), cand = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = rgba[i * 4], gg = rgba[i * 4 + 1], b = rgba[i * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0;
      const blue = b >= r && b + 10 >= gg && b > 70, bright = mx > 170 && sat < 0.25, warm = r > 180 && gg > 110 && b > 60 && sat < 0.6;   // blue / overcast / a sunset
      cand[i] = loc[i] < 0.12 && (blue || bright || warm) ? 1 : 0;
    }
    const out = new Uint8Array(w * h), stack = [];
    for (let x = 0; x < w; x++) if (cand[x]) { out[x] = 255; stack.push(x); }
    // the colour must stay close to where it came from (no leaking into a white wall far below)
    while (stack.length) {
      const k = stack.pop(), px = k % w, py = (k - px) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = px + dx, Y = py + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X; if (out[j] || !cand[j]) continue;
        const a = k * 4, c = j * 4; if (Math.abs(rgba[a] - rgba[c]) + Math.abs(rgba[a + 1] - rgba[c + 1]) + Math.abs(rgba[a + 2] - rgba[c + 2]) > 24) continue;
        out[j] = 255; stack.push(j);
      }
    }
    // small specks inside the sky (birds, wires) join it; then soft edges along the skyline
    const filled = new Uint8Array(w * h); for (let i = 0; i < out.length; i++) filled[i] = out[i];
    const bl = boxBlur(Float32Array.from(out, (v) => v / 255), w, h, 3);
    for (let i = 0; i < out.length; i++) if (!filled[i] && bl[i] > 0.85) filled[i] = 255;
    return refine(filled, rgba, w, h, { radius: 6 });
  }

  const api = { gray, sobel, boxBlur, guided, dist, minmax, refine, decontaminate, edgeCost, liveWire, quickGrow, skyMask };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCSelect = api;
})(typeof window !== "undefined" ? window : globalThis);
