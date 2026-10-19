/* pcmerge.js — AUTO-ALIGN LAYERS, AUTO-BLEND LAYERS, PHOTOMERGE, MERGE TO HDR (2.486.0): the image editor's gap,
 * round F (part 2). window.PCMerge.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Edit ▸ Auto-Align Layers…    the picked layers (or every visible pixel layer) lined up on one of them: Auto /
 *                                Perspective (a homography), Similarity (move, turn, scale), Reposition (move only)
 *   Edit ▸ Auto-Blend Layers…    Panorama (seams where each picture is best, soft edges, optional matching of tones
 *                                and colours) or Stack Images (each pixel from the sharpest layer - focus stacking);
 *                                the result is a layer mask on each layer, so it can be painted over
 *   File ▸ Automate ▸ Photomerge…   pictures (files or the open documents) stitched into a panorama: one layer per
 *                                picture, placed, blended with masks
 *   File ▸ Automate ▸ Merge to HDR…   bracketed exposures (files or the open documents) aligned and fused into one
 *                                well-exposed picture (exposure fusion: contrast, saturation, well-exposedness, blended
 *                                over a Laplacian pyramid). An 8-bit result, not a 32-bit file.
 *
 * How the matching works: corners (Harris) on a small grey copy, 8 x 8 patches normalised for brightness, nearest
 * neighbours with a ratio test both ways, then RANSAC for the model, refitted on the inliers.
 * Pure (Node: scripts/test-merge.js): toGray, boxBlur, harris, describe, matchFeatures, fitTranslation, fitSimilarity,
 * fitHomography, ransac, features, register, applyH, inv3, mul3, warp, placeAll, seamMasks, stackMasks, gainMatch,
 * fuseExposures.
 */
(function (root) {
  "use strict";

  /* ---------------- 3 x 3 matrices (row-major) ---------------- */
  const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
  function mul3(A, B) { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; }
  function inv3(m) {
    const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    if (!det || !isFinite(det)) return null;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function applyH(H, x, y) { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; }
  const scale3 = (sx, sy) => [sx, 0, 0, 0, sy, 0, 0, 0, 1], move3 = (tx, ty) => [1, 0, tx, 0, 1, ty, 0, 0, 1];
  /** Gaussian elimination with partial pivoting: A (n x n, flat) x = b */
  function solve(A, b, n) {
    const M = A.slice(), v = b.slice();
    for (let k = 0; k < n; k++) {
      let p = k; for (let r = k + 1; r < n; r++) if (Math.abs(M[r * n + k]) > Math.abs(M[p * n + k])) p = r;
      if (Math.abs(M[p * n + k]) < 1e-12) return null;
      if (p !== k) { for (let c = 0; c < n; c++) { const t = M[k * n + c]; M[k * n + c] = M[p * n + c]; M[p * n + c] = t; } const t = v[k]; v[k] = v[p]; v[p] = t; }
      for (let r = k + 1; r < n; r++) { const f = M[r * n + k] / M[k * n + k]; if (!f) continue; for (let c = k; c < n; c++) M[r * n + c] -= f * M[k * n + c]; v[r] -= f * v[k]; }
    }
    const x = new Array(n);
    for (let k = n - 1; k >= 0; k--) { let s = v[k]; for (let c = k + 1; c < n; c++) s -= M[k * n + c] * x[c]; x[k] = s / M[k * n + k]; }
    return x.every(isFinite) ? x : null;
  }

  /* ---------------- grey copies, blur, corners, patches ---------------- */
  /** a grey (0..1) copy at most maxSide wide / high; ok[] marks pixels that are opaque */
  function toGray(d, w, h, maxSide) {
    const k = Math.min(1, (maxSide || 1e9) / Math.max(w, h)), W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
    const g = new Float32Array(W * H), ok = new Uint8Array(W * H), fx = w / W, fy = h / H;
    for (let y = 0; y < H; y++) {
      const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.min(h, Math.floor((y + 1) * fy)));
      for (let x = 0; x < W; x++) {
        const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.min(w, Math.floor((x + 1) * fx)));
        let s = 0, a = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * w + xx) * 4; s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; a += d[i + 3]; n++; }
        g[y * W + x] = s / n / 255; ok[y * W + x] = a / n > 250 ? 1 : 0;
      }
    }
    return { g, ok, W, H, kx: W / w, ky: H / h };
  }
  /** box blur of radius r (summed along each axis; edges clamped), run `passes` times */
  function boxBlur(src, W, H, r, passes) {
    let a = Float32Array.from(src); if (r < 1) return a;
    const tmp = new Float32Array(W * H), n = 2 * r + 1;
    for (let p = 0; p < (passes || 1); p++) {
      for (let y = 0; y < H; y++) { let s = 0; const o = y * W; for (let k = -r; k <= r; k++) s += a[o + Math.min(W - 1, Math.max(0, k))]; for (let x = 0; x < W; x++) { tmp[o + x] = s / n; s += a[o + Math.min(W - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
      for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(H - 1, Math.max(0, k)) * W + x]; for (let y = 0; y < H; y++) { a[y * W + x] = s / n; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
    }
    return a;
  }
  const PATCH = 8, STEP = 2, HALF = (PATCH - 1) * STEP / 2;
  /** Harris corners: [{x, y, r}] strongest first, at most n, kept `border` px from the edge and on opaque pixels */
  function harris(G, n, border) {
    const { g, ok, W, H } = G, b = boxBlur(g, W, H, 1, 1), xx = new Float32Array(W * H), yy = new Float32Array(W * H), xy = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, gx = (b[i + 1] - b[i - 1]) / 2, gy = (b[i + W] - b[i - W]) / 2; xx[i] = gx * gx; yy[i] = gy * gy; xy[i] = gx * gy; }
    const sxx = boxBlur(xx, W, H, 2, 1), syy = boxBlur(yy, W, H, 2, 1), sxy = boxBlur(xy, W, H, 2, 1), R = new Float32Array(W * H);
    let max = 0;
    for (let i = 0; i < W * H; i++) { const tr = sxx[i] + syy[i]; R[i] = sxx[i] * syy[i] - sxy[i] * sxy[i] - 0.04 * tr * tr; if (R[i] > max) max = R[i]; }
    const bd = Math.max(border || 0, Math.ceil(HALF) + 2), thr = max * 0.002, out = [];
    for (let y = bd; y < H - bd; y++) for (let x = bd; x < W - bd; x++) {
      const i = y * W + x, v = R[i]; if (v <= thr || !ok[i]) continue;
      let best = true;
      for (let dy = -3; dy <= 3 && best; dy++) for (let dx = -3; dx <= 3; dx++) { if (!dx && !dy) continue; const u = R[i + dy * W + dx]; if (u > v || (u === v && (dy < 0 || (dy === 0 && dx < 0)))) { best = false; break; } }
      if (best) out.push({ x, y, r: v });
    }
    out.sort((a, c) => c.r - a.r);
    return out.slice(0, n || 500);
  }
  /** 8 x 8 patches (every 2nd pixel of a blurred copy), mean 0 / length 1; corners near clear pixels dropped */
  function describe(G, pts) {
    const { W, ok } = G, b = G.blur || (G.blur = boxBlur(G.g, G.W, G.H, 1, 2)), out = [];
    for (const p of pts) {
      const d = new Float32Array(PATCH * PATCH); let k = 0, m = 0, bad = false;
      for (let j = 0; j < PATCH && !bad; j++) for (let i = 0; i < PATCH; i++) { const x = Math.round(p.x - HALF + i * STEP), y = Math.round(p.y - HALF + j * STEP), q = y * W + x; if (!ok[q]) { bad = true; break; } d[k++] = b[q]; m += b[q]; }
      if (bad) continue;
      m /= d.length; let s = 0; for (let i = 0; i < d.length; i++) { d[i] -= m; s += d[i] * d[i]; }
      s = Math.sqrt(s); if (s < 0.02) continue;
      for (let i = 0; i < d.length; i++) d[i] /= s;
      out.push({ x: p.x, y: p.y, d });
    }
    return out;
  }
  /** pairs [ax, ay, bx, by]: each other's nearest, and clearly nearer than the runner-up */
  function matchFeatures(A, B, ratio) {
    const rr = (ratio || 0.8) ** 2, bestA = new Int32Array(A.length).fill(-1), bestB = new Int32Array(B.length).fill(-1), dB = new Float32Array(B.length).fill(Infinity), okA = new Uint8Array(A.length);
    const L = PATCH * PATCH;
    for (let i = 0; i < A.length; i++) {
      const a = A[i].d; let b1 = Infinity, b2 = Infinity, bi = -1;
      for (let j = 0; j < B.length; j++) {
        const b = B[j].d; let s = 0; for (let k = 0; k < L && s < b2; k++) { const t = a[k] - b[k]; s += t * t; }
        if (s < b1) { b2 = b1; b1 = s; bi = j; } else if (s < b2) b2 = s;
        if (s < dB[j]) { dB[j] = s; bestB[j] = i; }
      }
      bestA[i] = bi; okA[i] = bi >= 0 && b1 < rr * b2 ? 1 : 0;
    }
    const out = [];
    for (let i = 0; i < A.length; i++) if (okA[i] && bestB[bestA[i]] === i) out.push([A[i].x, A[i].y, B[bestA[i]].x, B[bestA[i]].y]);
    return out;
  }

  /* ---------------- models (b → a) ---------------- */
  function fitTranslation(P) { let tx = 0, ty = 0; for (const p of P) { tx += p[0] - p[2]; ty += p[1] - p[3]; } return P.length ? move3(tx / P.length, ty / P.length) : null; }
  function fitSimilarity(P) {
    if (P.length < 2) return null;
    let max = 0, may = 0, mbx = 0, mby = 0; for (const p of P) { max += p[0]; may += p[1]; mbx += p[2]; mby += p[3]; } const n = P.length; max /= n; may /= n; mbx /= n; mby /= n;
    let sa = 0, sb = 0, sd = 0;
    for (const p of P) { const bx = p[2] - mbx, by = p[3] - mby, ax = p[0] - max, ay = p[1] - may; sa += bx * ax + by * ay; sb += bx * ay - by * ax; sd += bx * bx + by * by; }
    if (sd < 1e-9) return null;
    const a = sa / sd, b = sb / sd;
    return [a, -b, max - (a * mbx - b * mby), b, a, may - (b * mbx + a * mby), 0, 0, 1];
  }
  function normT(pts) {
    let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
    let d = 0; for (const [x, y] of pts) d += Math.hypot(x - mx, y - my); d /= pts.length;
    const s = d > 1e-9 ? Math.SQRT2 / d : 1; return [s, 0, -s * mx, 0, s, -s * my, 0, 0, 1];
  }
  function fitHomography(P) {
    if (P.length < 4) return null;
    const Ta = normT(P.map((p) => [p[0], p[1]])), Tb = normT(P.map((p) => [p[2], p[3]]));
    const AtA = new Array(64).fill(0), Atb = new Array(8).fill(0);
    const add = (row, v) => { for (let r = 0; r < 8; r++) { if (!row[r]) continue; Atb[r] += row[r] * v; for (let c = 0; c < 8; c++) AtA[r * 8 + c] += row[r] * row[c]; } };
    for (const p of P) {
      const [u, v] = applyH(Ta, p[0], p[1]), [x, y] = applyH(Tb, p[2], p[3]);
      add([x, y, 1, 0, 0, 0, -u * x, -u * y], u); add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
    }
    const h = solve(AtA, Atb, 8); if (!h) return null;
    const Ti = inv3(Ta); if (!Ti) return null;
    const H = mul3(Ti, mul3(h.concat([1]), Tb));
    return H[8] ? H.map((x) => x / H[8]) : null;
  }
  const FIT = { translation: [fitTranslation, 1], similarity: [fitSimilarity, 2], homography: [fitHomography, 4] };
  /** does H map a w x h picture to a sensible (convex, not collapsed or blown up) shape? */
  function sane(H, w, h) {
    const c = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const den = H[6] * x + H[7] * y + H[8]; return den > 1e-6 ? applyH(H, x, y) : null; });
    if (c.some((p) => !p || !isFinite(p[0]) || !isFinite(p[1]))) return false;
    let sign = 0, area = 0;
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4], d = c[(i + 2) % 4], cr = (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]); if (cr <= 1e-9) return false; const s = 1; if (sign && s !== sign) return false; sign = s; area += a[0] * b[1] - b[0] * a[1]; }
    const k = Math.abs(area / 2) / (w * h); return k > 0.1 && k < 10;
  }
  function ransac(P, model, o) {
    const opt = o || {}, [fit, m] = FIT[model] || FIT.homography, thr2 = (opt.thr || 2.5) ** 2, iters = opt.iters || (m === 1 ? 60 : m === 2 ? 300 : 800);
    if (P.length < m) return null;
    let seed = opt.seed || 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const inl = (H) => { const out = []; for (let k = 0; k < P.length; k++) { const p = P[k], q = applyH(H, p[2], p[3]), e = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (e < thr2) out.push(k); } return out; };
    let best = null;
    for (let it = 0; it < iters; it++) {
      const pick = new Set(); while (pick.size < m) pick.add(Math.floor(rnd() * P.length));
      const H = fit(Array.from(pick, (k) => P[k])); if (!H || (opt.w && !sane(H, opt.w, opt.h))) continue;
      const ins = inl(H); if (!best || ins.length > best.idx.length) best = { H, idx: ins };
      if (best.idx.length > P.length * 0.9) break;
    }
    if (!best) return null;
    for (let k = 0; k < 2; k++) { const H = fit(best.idx.map((i) => P[i])); if (!H || (opt.w && !sane(H, opt.w, opt.h))) break; const ins = inl(H); if (ins.length < best.idx.length) break; best = { H, idx: ins }; }
    return { H: best.H, inliers: best.idx.length, matches: P.length };
  }
  /** a picture's corners and patches on a grey copy at most maxSide big */
  function features(img, maxSide) {
    const G = toGray(img.data, img.width, img.height, maxSide || 640);
    G.feats = describe(G, harris(G, 600));
    return G;
  }
  const MIN_IN = { translation: 5, similarity: 8, homography: 12 };
  /** b's coordinates → a's (full size): {H, inliers, matches} or null */
  function register(FA, FB, model, o) {
    const md = FIT[model] ? model : "homography", P = matchFeatures(FA.feats, FB.feats, (o && o.ratio) || 0.8);
    const R = ransac(P, md, { thr: 2.5, w: FB.W, h: FB.H, seed: o && o.seed }); if (!R || R.inliers < ((o && o.minInliers) || MIN_IN[md])) return null;
    R.H = mul3(scale3(1 / FA.kx, 1 / FA.ky), mul3(R.H, scale3(FB.kx, FB.ky)));
    return R;
  }

  /* ---------------- warping ---------------- */
  /** src {data, width, height} put through H (src → canvas) into a W x H picture whose (0, 0) is canvas (ox, oy) */
  function warp(src, H, W, Hh, ox, oy) {
    const out = new Uint8ClampedArray(W * Hh * 4), Hi = inv3(H); if (!Hi) return out;
    const sw = src.width, sh = src.height, d = src.data;
    // where the picture lands, to skip the rest
    const cs = [[0, 0], [sw, 0], [sw, sh], [0, sh]].map(([x, y]) => applyH(H, x, y));
    const x0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[0])) - (ox || 0)) - 1), x1 = Math.min(W, Math.ceil(Math.max(...cs.map((c) => c[0])) - (ox || 0)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[1])) - (oy || 0)) - 1), y1 = Math.min(Hh, Math.ceil(Math.max(...cs.map((c) => c[1])) - (oy || 0)) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const X = x + 0.5 + (ox || 0), Y = y + 0.5 + (oy || 0), w = Hi[6] * X + Hi[7] * Y + Hi[8]; if (w <= 0) continue;
      const sx = (Hi[0] * X + Hi[1] * Y + Hi[2]) / w - 0.5, sy = (Hi[3] * X + Hi[4] * Y + Hi[5]) / w - 0.5;
      if (sx < -1 || sy < -1 || sx > sw || sy > sh) continue;
      const fx = Math.floor(sx), fy = Math.floor(sy), ax = sx - fx, ay = sy - fy;
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < 4; k++) {
        const xx = fx + (k & 1), yy = fy + (k >> 1); if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
        const wt = (k & 1 ? ax : 1 - ax) * (k >> 1 ? ay : 1 - ay), i = (yy * sw + xx) * 4, al = d[i + 3] * wt;
        r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al;
      }
      if (a <= 0) continue;
      const o2 = (y * W + x) * 4; out[o2] = r / a; out[o2 + 1] = g / a; out[o2 + 2] = b / a; out[o2 + 3] = a;
    }
    return out;
  }
  /** each picture's place on a shared canvas, chained through the best-matching placed picture:
   *  {W, H, mats: [H | null], unplaced: [index], ref} (maxSide caps the canvas - everything scaled down to fit) */
  function placeAll(imgs, model, o) {
    const opt = o || {}, n = imgs.length, F = opt.feats || imgs.map((im) => features(im)), ref = opt.ref == null ? Math.floor((n - 1) / 2) : opt.ref;
    const mats = new Array(n).fill(null); mats[ref] = I3();
    const placed = [ref], pending = []; for (let i = 0; i < n; i++) if (i !== ref) pending.push(i);
    const cache = new Map(), reg = (j, i) => { const k = j + ":" + i; if (!cache.has(k)) { let r = register(F[j], F[i], model, opt); if (!r && model === "homography") r = register(F[j], F[i], "similarity", opt); cache.set(k, r); } return cache.get(k); };
    for (;;) {
      let best = null;
      for (const i of pending) for (const j of placed) { const r = reg(j, i); if (r && (!best || r.inliers > best.r.inliers)) best = { i, j, r }; }
      if (!best) break;
      mats[best.i] = mul3(mats[best.j], best.r.H); placed.push(best.i); pending.splice(pending.indexOf(best.i), 1);
    }
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (let i = 0; i < n; i++) if (mats[i]) for (const [x, y] of [[0, 0], [imgs[i].width, 0], [imgs[i].width, imgs[i].height], [0, imgs[i].height]]) { const [u, v] = applyH(mats[i], x, y); minx = Math.min(minx, u); miny = Math.min(miny, v); maxx = Math.max(maxx, u); maxy = Math.max(maxy, v); }
    const cap = opt.maxSide || 12000, s = Math.min(1, cap / Math.max(maxx - minx, maxy - miny)), T = mul3(scale3(s, s), move3(-minx, -miny));
    return { W: Math.max(1, Math.ceil((maxx - minx) * s)), H: Math.max(1, Math.ceil((maxy - miny) * s)), mats: mats.map((m) => m && mul3(T, m)), unplaced: pending, ref, scale: s };
  }

  /* ---------------- blending ---------------- */
  /** distance (chamfer 3-4, in px) from each opaque pixel to the nearest clear one or the edge */
  function distIn(d, W, H) {
    const D = new Float32Array(W * H), INF = 1e9;
    for (let i = 0; i < W * H; i++) D[i] = d[i * 4 + 3] >= 128 ? INF : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : D[y * W + x]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!D[i]) continue; D[i] = Math.min(D[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!D[i]) continue; D[i] = Math.min(D[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
    for (let i = 0; i < W * H; i++) D[i] /= 3;
    return D;
  }
  /** owner maps → soft masks (0..255): each owned area grown by r and softened by r, never past the layer's pixels */
  function ownerMasks(owner, layers, W, H, r) {
    return layers.map((L, k) => {
      let m = new Float32Array(W * H); for (let i = 0; i < W * H; i++) m[i] = owner[i] === k ? 1 : 0;
      if (r > 0) { const grown = boxBlur(m, W, H, r, 1); for (let i = 0; i < W * H; i++) grown[i] = grown[i] > 1e-6 ? 1 : 0; m = boxBlur(grown, W, H, r, 1); for (let i = 0; i < W * H; i++) if (owner[i] === k) m[i] = 1; }
      const out = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) out[i] = L[i * 4 + 3] >= 128 ? Math.round(255 * Math.min(1, m[i])) : 0;
      return out;
    });
  }
  /** panorama seams: each pixel from the layer it is deepest inside of (later layers win ties) */
  function seamMasks(layers, W, H, o) {
    const D = layers.map((L) => distIn(L, W, H)), owner = new Int16Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) { let b = 0; for (let k = 0; k < layers.length; k++) if (D[k][i] > 0 && D[k][i] >= b) { b = D[k][i]; owner[i] = k; } }
    return ownerMasks(owner, layers, W, H, o && o.feather != null ? o.feather : Math.max(2, Math.round(Math.min(W, H) / 60)));
  }
  /** focus stacking: each pixel from the layer that is sharpest there (local contrast) */
  function stackMasks(layers, W, H, o) {
    const S = layers.map((L) => {
      const g = new Float32Array(W * H); for (let i = 0; i < W * H; i++) g[i] = (0.299 * L[i * 4] + 0.587 * L[i * 4 + 1] + 0.114 * L[i * 4 + 2]) / 255;
      const lap = new Float32Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; lap[i] = Math.abs(4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W]); }
      const s = boxBlur(lap, W, H, (o && o.radius) || 4, 2); for (let i = 0; i < W * H; i++) if (L[i * 4 + 3] < 128) s[i] = -1;
      return s;
    });
    const owner = new Int16Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) { let b = -0.5; for (let k = 0; k < layers.length; k++) if (S[k][i] > b + 1e-7) { b = S[k][i]; owner[i] = k; } }
    return ownerMasks(owner, layers, W, H, o && o.feather != null ? o.feather : 2);
  }
  /** seamless tones: each layer's colour scaled to match what is already there where they overlap (in order) */
  function gainMatch(layers, W, H, order) {
    const seq = order || layers.map((_, k) => k), acc = new Float32Array(W * H * 3), has = new Uint8Array(W * H), gains = [];
    for (const k of seq) {
      const L = layers[k]; let s1 = [0, 0, 0], s2 = [0, 0, 0], n = 0;
      for (let i = 0; i < W * H; i++) if (has[i] && L[i * 4 + 3] >= 128) { for (let c = 0; c < 3; c++) { s1[c] += acc[i * 3 + c]; s2[c] += L[i * 4 + c]; } n++; }
      const g = n > 50 ? s1.map((v, c) => Math.max(0.5, Math.min(2, (v + 1) / (s2[c] + 1)))) : [1, 1, 1];
      gains[k] = g;
      for (let i = 0; i < W * H; i++) { if (L[i * 4 + 3] < 128) continue; for (let c = 0; c < 3; c++) { if (g[c] !== 1) L[i * 4 + c] = Math.min(255, L[i * 4 + c] * g[c]); if (!has[i]) acc[i * 3 + c] = L[i * 4 + c]; } has[i] = 1; }
    }
    return gains;
  }

  /* ---------------- exposure fusion ---------------- */
  const K5 = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  function down(a, w, h) {
    const t = new Float32Array(w * h), w2 = Math.ceil(w / 2), h2 = Math.ceil(h / 2), o = new Float32Array(w2 * h2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K5[k + 2] * a[y * w + Math.min(w - 1, Math.max(0, x + k))]; t[y * w + x] = s; }
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K5[k + 2] * t[Math.min(h - 1, Math.max(0, 2 * y + k)) * w + 2 * x]; o[y * w2 + x] = s; }
    return o;
  }
  function up(a, w2, h2, w, h) {
    const o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = Math.min(h2 - 1, Math.max(0, (y + 0.5) / 2 - 0.5)), y0 = Math.floor(sy), y1 = Math.min(h2 - 1, y0 + 1), fy = sy - y0;
      for (let x = 0; x < w; x++) { const sx = Math.min(w2 - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), x0 = Math.floor(sx), x1 = Math.min(w2 - 1, x0 + 1), fx = sx - x0; o[y * w + x] = (a[y0 * w2 + x0] * (1 - fx) + a[y0 * w2 + x1] * fx) * (1 - fy) + (a[y1 * w2 + x0] * (1 - fx) + a[y1 * w2 + x1] * fx) * fy; }
    }
    return o;
  }
  function gaussPyr(a, w, h, n) { const P = [{ a, w, h }]; for (let l = 1; l < n; l++) { const p = P[l - 1]; P.push({ a: down(p.a, p.w, p.h), w: Math.ceil(p.w / 2), h: Math.ceil(p.h / 2) }); } return P; }
  function lapPyr(a, w, h, n) { const G = gaussPyr(a, w, h, n); return G.map((g, l) => { if (l === n - 1) return g; const u = up(G[l + 1].a, G[l + 1].w, G[l + 1].h, g.w, g.h), o = new Float32Array(g.a.length); for (let i = 0; i < o.length; i++) o[i] = g.a[i] - u[i]; return { a: o, w: g.w, h: g.h }; }); }
  /** bracketed exposures (same size, lined up) → one picture: RGBA Uint8ClampedArray */
  function fuseExposures(imgs, o) {
    const opt = o || {}, w = imgs[0].width, h = imgs[0].height, N = w * h, ws = opt.wc == null ? 1 : opt.wc, wsat = opt.ws == null ? 1 : opt.ws, we = opt.we == null ? 1 : opt.we;
    const levels = Math.max(1, Math.min(8, Math.floor(Math.log2(Math.min(w, h))) - 2));
    const W = imgs.map((im) => {
      const d = im.data, g = new Float32Array(N), wt = new Float32Array(N);
      for (let i = 0; i < N; i++) g[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 765;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, l = Math.abs(4 * g[i] - g[x > 0 ? i - 1 : i] - g[x < w - 1 ? i + 1 : i] - g[y > 0 ? i - w : i] - g[y < h - 1 ? i + w : i]);
        const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255, m = (r + gg + b) / 3, sat = Math.sqrt(((r - m) ** 2 + (gg - m) ** 2 + (b - m) ** 2) / 3);
        const e = Math.exp(-((r - 0.5) ** 2 + (gg - 0.5) ** 2 + (b - 0.5) ** 2) / (2 * 0.2 * 0.2));
        wt[i] = Math.pow(l + 1e-3, ws) * Math.pow(sat + 1e-3, wsat) * Math.pow(e + 1e-6, we);
      }
      return wt;
    });
    for (let i = 0; i < N; i++) { let s = 0; for (const wt of W) s += wt[i]; for (const wt of W) wt[i] = s > 0 ? wt[i] / s : 1 / W.length; }
    let R = null;
    imgs.forEach((im, k) => {
      const GW = gaussPyr(W[k], w, h, levels);
      for (let c = 0; c < 3; c++) {
        const ch = new Float32Array(N); for (let i = 0; i < N; i++) ch[i] = im.data[i * 4 + c] / 255;
        const LP = lapPyr(ch, w, h, levels);
        if (!R) R = [0, 1, 2].map(() => LP.map((p) => ({ a: new Float32Array(p.a.length), w: p.w, h: p.h })));
        LP.forEach((p, l) => { const dst = R[c][l].a, gw = GW[l].a; for (let i = 0; i < dst.length; i++) dst[i] += p.a[i] * gw[i]; });
      }
    });
    const out = new Uint8ClampedArray(N * 4);
    for (let c = 0; c < 3; c++) {
      const P = R[c]; let cur = P[levels - 1].a;
      for (let l = levels - 2; l >= 0; l--) { const u = up(cur, P[l + 1].w, P[l + 1].h, P[l].w, P[l].h); for (let i = 0; i < u.length; i++) u[i] += P[l].a[i]; cur = u; }
      for (let i = 0; i < N; i++) out[i * 4 + c] = Math.round(Math.max(0, Math.min(1, cur[i])) * 255);
    }
    for (let i = 0; i < N; i++) out[i * 4 + 3] = 255;
    return out;
  }
  const pure = { I3, mul3, inv3, applyH, solve, toGray, boxBlur, harris, describe, matchFeatures, fitTranslation, fitSimilarity, fitHomography, sane, ransac, features, register, warp, placeAll, distIn, seamMasks, stackMasks, gainMatch, fuseExposures, gaussPyr, lapPyr, up, down };

  /* ---------------- the page ---------------- */
  const MODELS = { auto: "homography", perspective: "homography", similarity: "similarity", reposition: "translation" };
  function install(E) {
    const { S, store } = E, doc = E.doc || root.document, win = doc.defaultView || root;
    const say = (t) => (E.say ? E.say(t) : null), FP = E.filePlus;
    if (!FP) return;
    const val = (d, s) => (d.querySelector(s) || {}).value, chk = (d, s) => !!(d.querySelector(s) || {}).checked;
    const later = () => new Promise((ok) => win.setTimeout(ok, 30));
    const canvasOf = (w, h) => { const c = doc.createElement("canvas"); c.width = w; c.height = h; return c; };
    const dataOf = (src) => { const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, c = canvasOf(w, h), g = c.getContext("2d"); g.drawImage(src, 0, 0); return { width: w, height: h, data: g.getImageData(0, 0, w, h).data }; };
    const putData = (canvas, data) => { const g = canvas.getContext("2d"), id = g.createImageData(canvas.width, canvas.height); id.data.set(data); g.putImageData(id, 0, 0); };
    const maskCanvas = (m, w, h) => { const c = canvasOf(w, h), g = c.getContext("2d"), id = g.createImageData(w, h); for (let i = 0; i < m.length; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = m[i]; id.data[i * 4 + 3] = 255; } g.putImageData(id, 0, 0); return c; };
    /** the layers these work on: the picked ones, else every visible pixel layer (bottom first) */
    function chosen() {
      const picked = E.multi && E.multi.list ? E.multi.list() : [];
      const pool = picked.length > 1 ? picked : S.layers.filter((L) => L.visible !== false);
      return S.layers.filter((L) => pool.includes(L) && L.type === "pixel");
    }
    const layerData = (L) => L.canvas.getContext("2d").getImageData(0, 0, S.w, S.h).data;
    async function pictures(d) {
      if (val(d, ".mgSrc") === "docs") return FP.openDocs().map((x) => Object.assign(dataOf(x.canvas), { name: x.name }));
      const files = await FP.pickFiles(), out = [];
      for (const f of files) { const im = await FP.imgOf(f); if (im) out.push(Object.assign(dataOf(im), { name: f.name })); }
      return out;
    }
    const srcRow = () => `<div class="rw"><label>Pictures</label><select class="mgSrc" style="grid-column:2/4"><option value="files">Choose files…</option><option value="docs">The open documents</option></select></div>`;
    const modelRow = (withAuto) => `<div class="rw"><label>Layout</label><select class="mgModel" style="grid-column:2/4">${withAuto ? '<option value="auto">Auto</option>' : ""}<option value="perspective">Perspective</option><option value="similarity">Move, turn and scale</option><option value="reposition">Reposition (move only)</option></select></div>`;
    const busy = (t) => say(t);

    function autoAlign() {
      const Ls = chosen(); if (Ls.length < 2) return say("pick two or more pixel layers (Ctrl-click in Layers), or have two visible");
      FP.dialog("Auto-Align Layers", modelRow(true) + `<div class="rw"><label>Line up on</label><select class="mgRef" style="grid-column:2/4"><option value="mid">The middle layer</option><option value="active">The active layer</option><option value="bottom">The bottom layer</option></select></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">${Ls.length} layers. Each is moved (and turned, scaled or put in perspective) so its details sit on the reference layer's.</div>`,
        async (d) => {
          const model = MODELS[val(d, ".mgModel")] || "homography", rf = val(d, ".mgRef");
          busy("aligning…"); await later();
          const imgs = Ls.map((L) => ({ width: S.w, height: S.h, data: layerData(L) })), act = E.layer && E.layer();
          const ref = rf === "active" && Ls.includes(act) ? Ls.indexOf(act) : rf === "bottom" ? 0 : Math.floor((Ls.length - 1) / 2);
          const P = placeAll(imgs, model, { ref, maxSide: 1e9 }), Ti = inv3(P.mats[ref]);
          let moved = 0;
          E.docOp("Auto-Align Layers", () => {
            Ls.forEach((L, k) => {
              if (k === ref || !P.mats[k]) return;
              const H = mul3(Ti, P.mats[k]), c = canvasOf(S.w, S.h); putData(c, warp(imgs[k], H, S.w, S.h, 0, 0)); L.canvas = c; L.ver = (L.ver || 0) + 1;
              if (L.mask) { const md = L.mask.canvas.getContext("2d").getImageData(0, 0, S.w, S.h); const mc = canvasOf(S.w, S.h); const g = mc.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, S.w, S.h); const wd = warp({ width: S.w, height: S.h, data: md.data }, H, S.w, S.h, 0, 0); const id = g.getImageData(0, 0, S.w, S.h); for (let i = 0; i < wd.length; i += 4) if (wd[i + 3]) { id.data[i] = id.data[i + 1] = id.data[i + 2] = wd[i]; } g.putImageData(id, 0, 0); L.mask.canvas = mc; L.mask.ver = (L.mask.ver || 0) + 1; }
              moved++;
            });
          });
          E.lastAlign = { mats: P.mats.map((m) => m && Ti && mul3(Ti, m)), unplaced: P.unplaced.length, ref };
          say(`${moved} layer${moved === 1 ? "" : "s"} aligned` + (P.unplaced.length ? ` - ${P.unplaced.length} could not be matched and stayed put` : ""));
        });
    }
    function blendInto(Ls, datas, mode, tones, order) {
      if (tones && mode === "panorama") { gainMatch(datas, S.w, S.h, order); Ls.forEach((L, k) => putData(L.canvas, datas[k])); }
      const masks = mode === "stack" ? stackMasks(datas, S.w, S.h) : seamMasks(datas, S.w, S.h);
      Ls.forEach((L, k) => { L.mask = E.newMask("#000"); L.mask.canvas = maskCanvas(masks[k], S.w, S.h); L.mask.ver = 1; L.ver = (L.ver || 0) + 1; });
      return masks;
    }
    function autoBlend() {
      const Ls = chosen(); if (Ls.length < 2) return say("pick two or more pixel layers (Ctrl-click in Layers), or have two visible");
      FP.dialog("Auto-Blend Layers", `<div class="rw"><label>Blend</label><select class="mgMode" style="grid-column:2/4"><option value="panorama">Panorama</option><option value="stack">Stack Images (focus)</option></select></div>
        <div class="rw"><span></span><label style="grid-column:2/4"><input type="checkbox" class="mgTones" checked> Seamless tones and colours</label></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">Each layer gets a mask showing where it is used. Paint on the masks to change a seam.</div>`,
        async (d) => {
          const mode = val(d, ".mgMode"), tones = chk(d, ".mgTones");
          busy("blending…"); await later();
          E.docOp("Auto-Blend Layers", () => { blendInto(Ls, Ls.map((L) => Uint8ClampedArray.from(layerData(L))), mode, tones); });
          say(`${Ls.length} layers blended (${mode === "stack" ? "the sharpest of each" : "a panorama"}) - see their masks`);
        });
    }
    function photomerge() {
      FP.dialog("Photomerge", srcRow() + modelRow(true) + `<div class="rw"><span></span><label style="grid-column:2/4"><input type="checkbox" class="mgBlend" checked> Blend the pictures together</label></div>
        <div class="rw"><span></span><label style="grid-column:2/4"><input type="checkbox" class="mgTones" checked> Seamless tones and colours</label></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">Pictures should overlap by a third or more. Each becomes a layer of a new document.</div>`,
        async (d) => {
          const model = MODELS[val(d, ".mgModel")] || "homography", blend = chk(d, ".mgBlend"), tones = chk(d, ".mgTones");
          const imgs = await pictures(d); if (imgs.length < 2) return say("Photomerge needs two or more pictures");
          busy("stitching " + imgs.length + " pictures…"); await later();
          const P = placeAll(imgs, model, { maxSide: store.get("merge.max", 8000) });
          const put = imgs.map((im, k) => (P.mats[k] ? k : -1)).filter((k) => k >= 0);
          if (put.length < 2) return say("the pictures did not match - they need to overlap");
          E.openDoc(P.W, P.H, "Panorama", null);
          const Ls = [], datas = [];
          put.forEach((k) => { const L = E.makeLayer(String(imgs[k].name || "picture " + (k + 1)).replace(/\.[a-z0-9]+$/i, ""), P.W, P.H), dd = warp(imgs[k], P.mats[k], P.W, P.H, 0, 0); putData(L.canvas, dd); Ls.push(L); datas.push(dd); });
          S.layers = Ls; S.active = Ls.length - 1;
          if (blend) { const order = [put.indexOf(P.ref)].concat(put.map((_, i) => i).filter((i) => put[i] !== P.ref)); blendInto(Ls, datas, "panorama", tones, order); }
          E.refresh(); E.renderLayersPanel(); E.lastMerge = { W: P.W, H: P.H, placed: put.length, unplaced: P.unplaced.length };
          say(`panorama: ${put.length} pictures` + (P.unplaced.length ? `, ${P.unplaced.length} left out (no overlap found)` : ""));
        });
    }
    function mergeHdr() {
      FP.dialog("Merge to HDR", srcRow() + `<div class="rw"><span></span><label style="grid-column:2/4"><input type="checkbox" class="mgAlign" checked> Line the pictures up first</label></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">Bracketed exposures of one scene (dark, normal, bright…). They are fused into one well-exposed picture by exposure fusion - the result is an ordinary 8-bit picture.</div>`,
        async (d) => {
          const align = chk(d, ".mgAlign"); let imgs = await pictures(d); if (imgs.length < 2) return say("Merge to HDR needs two or more exposures");
          const w = imgs[0].width, h = imgs[0].height; if (imgs.some((im) => im.width !== w || im.height !== h)) return say("the exposures must all be the same size");
          busy("merging " + imgs.length + " exposures…"); await later();
          let unaligned = 0;
          if (align) {
            const P = placeAll(imgs, "homography", { maxSide: 1e9 }), Ti = inv3(P.mats[P.ref]);
            imgs = imgs.map((im, k) => { if (k === P.ref || !P.mats[k]) { if (!P.mats[k]) unaligned++; return im; } const dd = warp(im, mul3(Ti, P.mats[k]), w, h, 0, 0); for (let i = 0; i < dd.length; i += 4) if (dd[i + 3] < 255) { dd[i] = im.data[i]; dd[i + 1] = im.data[i + 1]; dd[i + 2] = im.data[i + 2]; dd[i + 3] = 255; } return { width: w, height: h, data: dd }; });
          }
          const out = fuseExposures(imgs);
          E.openDoc(w, h, "Merged HDR", (g) => { const id = g.createImageData(w, h); id.data.set(out); g.putImageData(id, 0, 0); });
          say(`${imgs.length} exposures merged` + (unaligned ? ` (${unaligned} could not be lined up)` : ""));
        });
    }
    const C = E.ui.addCmd, many = () => chosen().length >= 2;
    C("edit.autoalign", "Auto-Align Layers…", "", autoAlign, { enabled: many }, ["Edit", "edit.histsrc", true]);
    C("edit.autoblend", "Auto-Blend Layers…", "", autoBlend, { enabled: many }, ["Edit", "edit.autoalign"]);
    C("auto.photomerge", "Automate: Photomerge…", "", photomerge, {}, ["File", "auto.cropstraighten"]);
    C("auto.hdr", "Automate: Merge to HDR…", "", mergeHdr, {}, ["File", "auto.photomerge"]);
    E.merge = { autoAlign, autoBlend, photomerge, mergeHdr, chosen };
  }

  const PCMerge = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCMerge;
  else root.PCMerge = PCMerge;
})(typeof window !== "undefined" ? window : globalThis);
