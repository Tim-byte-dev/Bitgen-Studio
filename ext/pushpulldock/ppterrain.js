/* bitGen Studio — ext/pushpulldock/ppterrain.js (2.653.0): THE GROUND of the 📏 Sketcher - a height field (window.PPTerrain /
 * require()), its contour lines, and the ground in the 3D view.
 *
 * Tim (verbatim): "... and terrain elevation tools like contour lines and shape the ground to match the contours."
 * (agreed with Tim: contours + a sculpt brush + a heightmap image)
 *
 * The model keeps the ground in M.arch.terrain (saved with it, undone with it) - null = no ground:
 *   {x0, y0 (its south-west corner), cell (metres between two heights), nx, ny (cells across / along), h [(nx+1)*(ny+1)
 *    heights, row by row from the south - z of each grid point, metres], col (a colour / "mat:<key>" / "tex:<id>"),
 *    step (the contour interval), major (every n-th line drawn darker + labelled), show (contours on the 3D ground),
 *    sides (the ground's edges drawn down - it reads as a block of earth), contours [{id, pts [[x, y] ...], z, closed}],
 *    cn (the contours' id counter)}
 *
 *   clean(o) -> terrain | null        make(A, o) a flat ground round the building (its lowest floor, a little under it)
 *   at(T, x, y) the height there (bilinear; clamped to the edge)       hit(T, o, d) where a ray meets it -> [x, y, z] | null
 *   brush(T, mode, x, y, r, s, target)  raise | lower | smooth | flatten - a soft round brush (r metres, s metres a dab)
 *   2.656.0 pads: T.pads [{id, name, pts, z, batter (1 : n), mode both | cut | fill, cut, fill (m³)}] - addPad(T, pts, o)
 *                 (level = o.z or the ground's mean inside), applyPad(T, q) (flat inside, batters out to the ground), padAt
 *   fit(T)        THE GROUND SHAPED TO THE CONTOURS: the drawn lines' heights held, the rest a smooth (harmonic) surface between
 *                 them (over-relaxed Gauss-Seidel; the edges free)
 *   level(T, A, margin)  the ground under every room levelled to just below its floor, blended out over `margin` metres
 *   fromImage(T, grey, gw, gh, lo, hi)  a heightmap picture (grey 0..1, row 0 = the north edge) -> heights lo..hi
 *   resample(T, o) a new size / cell / place keeping the shape;   lines(T) the contour lines (marching squares) at its interval
 *   mesh(T) {pos, nrm, uv, idx} - the view, the .glb export;   bounds(T) {min, max}
 *   attach(V, AV) -> TV  the ground in the Sketcher's view (a mesh + its contour lines + the drawn contours; TV.ring(p, r) the
 *                 brush's circle, TV.draft(pts, z) a contour being drawn, TV.update() after a dab, TV.hit(ev))
 * Pure parts tested in Node: scripts/test-terrain653.js; the clicks: scripts/test-ui653-ui.js. */
(function (root) {
  "use strict";
  const MAXN = 200;                  // cells a side at most (201 x 201 heights)
  const COL = "mat:grass";
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const num = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const colOk = (c, d) => (typeof c === "string" && (/^#[0-9a-f]{6}$/i.test(c) ? true : /^(mat:[a-z_]{2,24}|tex:[a-z0-9_]{1,24})$/.test(c)) ? c.toLowerCase() : d);

  /* ---------------- the model */
  function clean(o) {
    if (!o || typeof o !== "object") return null;
    const cell = num(o.cell, 0.5, 0.1, 10);
    const nx = Math.round(num(o.nx, 80, 1, MAXN)), ny = Math.round(num(o.ny, 80, 1, MAXN)), N = (nx + 1) * (ny + 1);
    const z0 = num(o.z0, 0, -1000, 5000);
    const h = Array.isArray(o.h) && o.h.length === N ? o.h.map((v) => r3(num(v, z0, -1000, 5000))) : new Array(N).fill(r3(z0));
    let cn = Math.max(1, Math.floor(+o.cn || 1));
    const seen = new Set();
    const contours = (Array.isArray(o.contours) ? o.contours : []).slice(0, 500).map((c) => {
      if (!c || !Array.isArray(c.pts)) return null;
      const pts = c.pts.slice(0, 2000).filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])).map((p) => [r3(+p[0]), r3(+p[1])]);
      if (pts.length < 2) return null;
      let id = Number.isInteger(+c.id) && +c.id > 0 ? +c.id : 0;
      return { id, pts, z: r3(num(c.z, 0, -1000, 5000)), closed: !!c.closed && pts.length >= 3 };
    }).filter(Boolean);
    contours.forEach((c) => { cn = Math.max(cn, c.id + 1); });
    contours.forEach((c) => { if (!c.id || seen.has(c.id)) c.id = cn++; seen.add(c.id); });
    // 2.656.0: the cut / fill pads (their outline, level, batter and the volumes moved when last applied)
    const pads = (Array.isArray(o.pads) ? o.pads : []).slice(0, 200).map((q) => {
      if (!q || !Array.isArray(q.pts)) return null;
      const pts = q.pts.slice(0, 500).filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])).map((p) => [r3(+p[0]), r3(+p[1])]);
      if (pts.length < 3) return null;
      let id = Number.isInteger(+q.id) && +q.id > 0 ? +q.id : 0;
      return { id, pts, z: r3(num(q.z, 0, -1000, 5000)), batter: num(q.batter, 2, 0.2, 20), mode: ["both", "cut", "fill"].includes(q.mode) ? q.mode : "both",
        cut: r3(num(q.cut, 0, 0, 1e9)), fill: r3(num(q.fill, 0, 0, 1e9)), name: String(q.name || "Pad").slice(0, 60) };
    }).filter(Boolean);
    pads.forEach((q) => { cn = Math.max(cn, q.id + 1); });
    pads.forEach((q) => { if (!q.id || seen.has(q.id)) q.id = cn++; seen.add(q.id); });
    return { x0: r3(num(o.x0, -20, -1e5, 1e5)), y0: r3(num(o.y0, -20, -1e5, 1e5)), cell, nx, ny, h, col: colOk(o.col, COL),
      step: num(o.step, 0.5, 0.05, 100), major: Math.round(num(o.major, 5, 1, 20)), show: o.show !== false, sides: o.sides !== false, contours, pads, cn };
  }
  /** a flat ground round what the model has (40 m at least, 10 m past it), its height just under the lowest floor */
  function make(A, o) {
    o = o || {};
    const B = A && root.PPArch && root.PPArch.has(A) ? root.PPArch.bbox(A) : null;
    const cx = B ? (B.min[0] + B.max[0]) / 2 : 0, cy = B ? (B.min[1] + B.max[1]) / 2 : 0;
    const zs = ((A && A.rooms) || []).filter((R) => R.closed).map((R) => R.z);
    const z0 = o.z != null ? +o.z : (zs.length ? Math.min.apply(null, zs) : 0) - 0.03;
    const w = num(o.w, B ? Math.max(40, Math.ceil(B.max[0] - B.min[0] + 20)) : 40, 1, 2000), l = num(o.l, B ? Math.max(40, Math.ceil(B.max[1] - B.min[1] + 20)) : 40, 1, 2000);
    let cell = num(o.cell, 0.5, 0.1, 10);
    if (Math.max(w, l) / cell > MAXN) cell = Math.max(w, l) / MAXN;
    const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(l / cell));
    return clean({ x0: cx - nx * cell / 2, y0: cy - ny * cell / 2, cell, nx, ny, z0, col: o.col });
  }
  const K = (T, i, j) => j * (T.nx + 1) + i;
  const xOf = (T, i) => T.x0 + i * T.cell, yOf = (T, j) => T.y0 + j * T.cell;
  function bounds(T) {
    let lo = Infinity, hi = -Infinity; for (const v of T.h) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return { min: [T.x0, T.y0, lo], max: [T.x0 + T.nx * T.cell, T.y0 + T.ny * T.cell, hi] };
  }
  /** the height at (x, y) - between the four grid points round it; past an edge, the edge's */
  function at(T, x, y) {
    const fx = Math.min(T.nx, Math.max(0, (x - T.x0) / T.cell)), fy = Math.min(T.ny, Math.max(0, (y - T.y0) / T.cell));
    const i = Math.min(T.nx - 1, Math.floor(fx)), j = Math.min(T.ny - 1, Math.floor(fy)), u = fx - i, v = fy - j;
    const a = T.h[K(T, i, j)], b = T.h[K(T, i + 1, j)], c = T.h[K(T, i + 1, j + 1)], d = T.h[K(T, i, j + 1)];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * u * v + d * (1 - u) * v;
  }
  const inside = (T, x, y) => x >= T.x0 - 1e-9 && y >= T.y0 - 1e-9 && x <= T.x0 + T.nx * T.cell + 1e-9 && y <= T.y0 + T.ny * T.cell + 1e-9;
  /** where the ray o + t d (t > 0) first meets the ground -> [x, y, z] | null (marched in half cells, then halved down) */
  function hit(T, o, d) {
    if (!T) return null;
    const B = bounds(T);
    let t0 = 0, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      const lo = k === 2 ? B.min[2] - 0.01 : B.min[k], hi = k === 2 ? B.max[2] + 0.01 : B.max[k];
      if (Math.abs(d[k]) < 1e-12) { if (o[k] < lo || o[k] > hi) return null; continue; }
      let a = (lo - o[k]) / d[k], b = (hi - o[k]) / d[k]; if (a > b) { const s = a; a = b; b = s; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (!(t1 >= t0) || !Number.isFinite(t1)) return null;
    const f = (t) => o[2] + d[2] * t - at(T, o[0] + d[0] * t, o[1] + d[1] * t);
    const flat = Math.hypot(d[0], d[1]), step = Math.max(T.cell * 0.5 / Math.max(flat, 0.05), (t1 - t0) / 4000);
    let ta = t0, fa = f(ta);
    if (fa <= 0) return [o[0] + d[0] * ta, o[1] + d[1] * ta, at(T, o[0] + d[0] * ta, o[1] + d[1] * ta)];   // it starts under the ground (seen from below / the edge)
    for (let t = t0 + step; ; t += step) {
      const tb = Math.min(t, t1), fb = f(tb);
      if (fb <= 0) {
        let a = ta, b = tb; for (let n = 0; n < 30; n++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
        const x = o[0] + d[0] * b, y = o[1] + d[1] * b; return [x, y, at(T, x, y)];
      }
      ta = tb; fa = fb; if (tb >= t1) return null;
    }
  }

  /* ---------------- shaping */
  const fall = (q) => { const s = 1 - q * q; return s * s; };       // 1 in the middle, 0 at the edge, soft
  /** one dab of the brush: raise / lower (s metres in the middle), smooth / flatten (s = how hard, 0..1 a dab) toward the
      neighbours' mean / `target` -> how many heights changed */
  function brush(T, mode, x, y, r, s, target) {
    if (!T || !(r > 0)) return 0;
    const i0 = Math.max(0, Math.floor((x - r - T.x0) / T.cell)), i1 = Math.min(T.nx, Math.ceil((x + r - T.x0) / T.cell));
    const j0 = Math.max(0, Math.floor((y - r - T.y0) / T.cell)), j1 = Math.min(T.ny, Math.ceil((y + r - T.y0) / T.cell));
    const old = mode === "smooth" ? T.h.slice() : null;
    const k = Math.min(1, Math.max(0.02, +s || 0));
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dd = Math.hypot(xOf(T, i) - x, yOf(T, j) - y); if (dd >= r) continue;
      const w = fall(dd / r), q = K(T, i, j); let v = T.h[q];
      if (mode === "raise") v += s * w;
      else if (mode === "lower") v -= s * w;
      else if (mode === "flatten") { if (!Number.isFinite(+target)) continue; v += (+target - v) * Math.min(1, w * k); }
      else if (mode === "smooth") {
        let sum = 0, c = 0; [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([a, b]) => { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii <= T.nx && jj <= T.ny) { sum += old[K(T, ii, jj)]; c++; } });
        if (c) v += (sum / c - v) * Math.min(1, w * k);
      } else return 0;
      v = r3(Math.min(5000, Math.max(-1000, v)));
      if (v !== T.h[q]) { T.h[q] = v; n++; }
    }
    return n;
  }
  /** the grid points a contour holds: every point within ¾ of a cell of the line takes its height (the nearest line wins)
      -> {fixed: Float64Array (NaN = free), n} */
  function held(T) {
    const N = (T.nx + 1) * (T.ny + 1), fixed = new Float64Array(N).fill(NaN), dist = new Float64Array(N).fill(Infinity);
    let n = 0;
    (T.contours || []).forEach((C) => {
      const P = C.closed ? C.pts.concat([C.pts[0]]) : C.pts;
      for (let s = 0; s + 1 < P.length; s++) {
        const a = P[s], b = P[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / (T.cell * 0.25)));
        for (let q = 0; q <= m; q++) {
          const x = a[0] + (b[0] - a[0]) * q / m, y = a[1] + (b[1] - a[1]) * q / m;
          const fi = (x - T.x0) / T.cell, fj = (y - T.y0) / T.cell;
          for (let j = Math.floor(fj) - 1; j <= Math.ceil(fj) + 1; j++) for (let i = Math.floor(fi) - 1; i <= Math.ceil(fi) + 1; i++) {
            if (i < 0 || j < 0 || i > T.nx || j > T.ny) continue;
            const dd = Math.hypot(xOf(T, i) - x, yOf(T, j) - y); if (dd > T.cell * 0.75) continue;
            const k = K(T, i, j); if (dd < dist[k]) { if (Number.isNaN(fixed[k])) n++; dist[k] = dd; fixed[k] = C.z; }
          }
        }
      }
    });
    return { fixed, n };
  }
  /** THE GROUND SHAPED TO THE CONTOURS -> {held, its} (held = 0: no contour on the ground, nothing changed) */
  function fit(T, opt) {
    if (!T) return { held: 0, its: 0 };
    const { fixed, n } = held(T); if (!n) return { held: 0, its: 0 };
    const W = T.nx + 1, H = T.ny + 1, N = W * H, h = new Float64Array(N);
    let mean = 0; for (let k = 0; k < N; k++) if (!Number.isNaN(fixed[k])) mean += fixed[k]; mean /= n;
    for (let k = 0; k < N; k++) h[k] = Number.isNaN(fixed[k]) ? mean : fixed[k];
    const w = 2 / (1 + Math.sin(Math.PI / Math.max(W, H)));       // over-relaxation for a grid this size
    const maxIt = Math.min(6000, (opt && opt.its) || 8 * Math.max(W, H) + 200);
    let it = 0;
    for (; it < maxIt; it++) {
      let big = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i; if (!Number.isNaN(fixed[k])) continue;
        let s = 0, c = 0;
        if (i > 0) { s += h[k - 1]; c++; } if (i < W - 1) { s += h[k + 1]; c++; }
        if (j > 0) { s += h[k - W]; c++; } if (j < H - 1) { s += h[k + W]; c++; }
        const d = (s / c - h[k]) * w; h[k] += d; const a = Math.abs(d); if (a > big) big = a;
      }
      if (big < 1e-4) { it++; break; }
    }
    for (let k = 0; k < N; k++) T.h[k] = r3(h[k]);
    return { held: n, its: it };
  }
  /** the ground under each room levelled to just below its floor (3 cm), blended back over `margin` metres round it */
  function level(T, A, margin) {
    if (!T || !A || !root.PPArch) return 0;
    const P = root.PPArch, m = Math.max(0, +margin || 0);
    const X = (A.rooms || []).filter((R) => R.closed).map((R) => ({ R, X: P.exterior(R) })).filter((q) => q.X && q.X.length >= 3);
    if (!X.length) return 0;
    const segD = (p, Q) => { let d = Infinity; for (let i = 0; i < Q.length; i++) d = Math.min(d, P.segDist(p, Q[i], Q[(i + 1) % Q.length]).d); return d; };
    let n = 0;
    for (let j = 0; j <= T.ny; j++) for (let i = 0; i <= T.nx; i++) {
      const p = [xOf(T, i), yOf(T, j)], k = K(T, i, j);
      let target = null, wt = 0;
      X.forEach(({ R, X: Q }) => {
        const z = R.z - 0.03, inn = P.inPoly(p, Q);
        const w = inn ? 1 : m > 0 ? (() => { const d = segD(p, Q); return d < m ? fall(d / m) : 0; })() : 0;
        if (w > 0 && (w > wt || (w === wt && (target == null || z < target)))) { wt = w; target = z; }
      });
      if (target == null) continue;
      const v = r3(T.h[k] + (target - T.h[k]) * wt); if (v !== T.h[k]) { T.h[k] = v; n++; }
    }
    return n;
  }
  /** a heightmap: grey (0..1, row by row from the TOP of the picture = the north edge, +y) gw x gh -> lo..hi metres */
  function fromImage(T, grey, gw, gh, lo, hi) {
    if (!T || !grey || !(gw > 0) || !(gh > 0)) return 0;
    const g = (x, y) => grey[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
    for (let j = 0; j <= T.ny; j++) for (let i = 0; i <= T.nx; i++) {
      const fx = i / T.nx * (gw - 1), fy = (1 - j / T.ny) * (gh - 1), x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
      const val = g(x, y) * (1 - u) * (1 - v) + g(x + 1, y) * u * (1 - v) + g(x + 1, y + 1) * u * v + g(x, y + 1) * (1 - u) * v;
      T.h[K(T, i, j)] = r3(lo + (hi - lo) * Math.min(1, Math.max(0, val)));
    }
    return (T.nx + 1) * (T.ny + 1);
  }
  /** a new size / cell / corner, the shape kept (each new point the old ground's height there) -> a new terrain */
  function resample(T, o) {
    const w = num(o.w, T.nx * T.cell, 1, 2000), l = num(o.l, T.ny * T.cell, 1, 2000);
    let cell = num(o.cell, T.cell, 0.1, 10); if (Math.max(w, l) / cell > MAXN) cell = Math.max(w, l) / MAXN;
    const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(l / cell));
    const cx = o.cx != null ? +o.cx : T.x0 + T.nx * T.cell / 2, cy = o.cy != null ? +o.cy : T.y0 + T.ny * T.cell / 2;
    const N = Object.assign({}, T, { x0: r3(cx - nx * cell / 2), y0: r3(cy - ny * cell / 2), cell, nx, ny, h: [] });
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) N.h.push(r3(at(T, N.x0 + i * cell, N.y0 + j * cell)));
    return clean(N);
  }

  /* ---------------- 2.656.0: cut / fill pads (Tim: "can you add a cut/fill landscaping tool to sketcher") */
  function inPoly(p, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function edgeDist(p, P) {
    let d = Infinity;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1];
      const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L)) : 0; d = Math.min(d, Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t)); }
    return d;
  }
  /** the ground's mean height inside an outline (a level that roughly balances cut and fill) */
  function meanIn(T, P) {
    let s = 0, n = 0;
    for (let j = 0; j <= T.ny; j++) for (let i = 0; i <= T.nx; i++) if (inPoly([xOf(T, i), yOf(T, j)], P)) { s += T.h[K(T, i, j)]; n++; }
    if (!n) { P.forEach((p) => { s += at(T, p[0], p[1]); n++; }); }
    return r3(s / n);
  }
  /** a pad cut / filled into the ground: inside flat at q.z; outside, batters at 1 : q.batter (metres across per metre up)
      cut down to it (mode both / cut) and filled up to it (both / fill) -> {cut, fill} m³ (also kept on the pad) */
  function applyPad(T, q) {
    if (!T || !q || !q.pts || q.pts.length < 3) return { cut: 0, fill: 0 };
    const r = Math.max(0.2, +q.batter || 2), A = T.cell * T.cell; let cut = 0, fill = 0;
    for (let j = 0; j <= T.ny; j++) for (let i = 0; i <= T.nx; i++) {
      const p = [xOf(T, i), yOf(T, j)], k = K(T, i, j), h0 = T.h[k];
      const d = inPoly(p, q.pts) ? 0 : edgeDist(p, q.pts);
      let h = h0;
      if (q.mode !== "fill") h = Math.min(h, q.z + d / r);
      if (q.mode !== "cut") h = Math.max(h, q.z - d / r);
      h = r3(h);
      if (h !== h0) { if (h < h0) cut += (h0 - h) * A; else fill += (h - h0) * A; T.h[k] = h; }
    }
    q.cut = r3(cut); q.fill = r3(fill);
    return { cut: q.cut, fill: q.fill };
  }
  function addPad(T, pts, o) {
    if (!T || !Array.isArray(pts) || pts.length < 3) return null;
    o = o || {};
    const P = pts.map((p) => [r3(p[0]), r3(p[1])]);
    const q = { id: T.cn++, pts: P, z: r3(o.z != null && Number.isFinite(+o.z) ? +o.z : meanIn(T, P)), batter: num(o.batter, 2, 0.2, 20), mode: ["both", "cut", "fill"].includes(o.mode) ? o.mode : "both", cut: 0, fill: 0, name: "Pad " + ((T.pads || []).length + 1) };
    if (!T.pads) T.pads = [];
    T.pads.push(q); applyPad(T, q); return q;
  }
  /** the pad whose outline (or inside) is at a plan point -> the pad | null */
  function padAt(T, p, tol) {
    let best = null;
    ((T && T.pads) || []).forEach((q) => { const d = inPoly(p, q.pts) ? 0 : edgeDist(p, q.pts); if (d <= tol && (!best || d < best.d)) best = { q, d }; });
    return best ? best.q : null;
  }
  const fmtV = (v) => (v >= 100 ? Math.round(v) : +v.toFixed(1)) + " m³";

  /* ---------------- the contour lines (marching squares) */
  /** -> [{z, major, segs: [[x1, y1, x2, y2] ...]}] - one level every `step` (fewer when there would be more than 300) */
  function lines(T, step) {
    if (!T) return [];
    const B = bounds(T); let st = +step || T.step; if (!(st > 0)) return [];
    while ((B.max[2] - B.min[2]) / st > 300) st *= 2;
    const out = [], W = T.nx + 1;
    for (let n = Math.ceil(B.min[2] / st - 1e-9); n * st <= B.max[2] + 1e-9; n++) {
      const L = n * st, segs = [];
      const v = (i, j) => { const x = T.h[j * W + i] - L; return x === 0 ? 1e-9 : x; };
      const edge = (i, j, a, b, ax, ay, bx, by) => { const t = a / (a - b); return [ax + (bx - ax) * t, ay + (by - ay) * t]; };
      for (let j = 0; j < T.ny; j++) for (let i = 0; i < T.nx; i++) {
        const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = xOf(T, i), y0 = yOf(T, j), x1 = x0 + T.cell, y1 = y0 + T.cell;
        const S = () => edge(0, 0, a, b, x0, y0, x1, y0), E = () => edge(0, 0, b, c, x1, y0, x1, y1), Nn = () => edge(0, 0, d, c, x0, y1, x1, y1), Wn = () => edge(0, 0, a, d, x0, y0, x0, y1);
        const seg = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
        switch (idx) {
          case 1: case 14: seg(S(), Wn()); break;
          case 2: case 13: seg(S(), E()); break;
          case 3: case 12: seg(Wn(), E()); break;
          case 4: case 11: seg(E(), Nn()); break;
          case 6: case 9: seg(S(), Nn()); break;
          case 7: case 8: seg(Wn(), Nn()); break;
          case 5: case 10: {                                           // a saddle: the middle decides
            const m = (a + b + c + d) / 4 > 0;
            if ((idx === 5) === m) { seg(S(), E()); seg(Wn(), Nn()); } else { seg(S(), Wn()); seg(E(), Nn()); }
            break;
          }
          default: break;
        }
      }
      if (segs.length) out.push({ z: Math.round(L * 1e6) / 1e6, major: Math.round(L / st) % (T.major || 5) === 0, segs });
    }
    return out;
  }

  /* ---------------- the mesh */
  /** the ground's triangles (+ its edges down to a metre under its lowest point, when T.sides) - pos / nrm / uv (metres) / idx */
  function mesh(T, holes) {
    const W = T.nx + 1, H = T.ny + 1, pos = [], nrm = [], uv = [], idx = [];
    const HO = (holes || []).filter((P) => P && P.length >= 3), inHole = (x, y) => HO.some((P) => inPoly([x, y], P));   // 2.657.0: the ground cut away under a pool
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = xOf(T, i), y = yOf(T, j), z = T.h[j * W + i];
      const hx = T.h[j * W + Math.min(W - 1, i + 1)] - T.h[j * W + Math.max(0, i - 1)], hy = T.h[Math.min(H - 1, j + 1) * W + i] - T.h[Math.max(0, j - 1) * W + i];
      const dx = (Math.min(W - 1, i + 1) - Math.max(0, i - 1)) * T.cell, dy = (Math.min(H - 1, j + 1) - Math.max(0, j - 1)) * T.cell;
      const n = [-hx / dx, -hy / dy, 1], l = Math.hypot(n[0], n[1], n[2]);
      pos.push(x, y, z); nrm.push(n[0] / l, n[1] / l, n[2] / l); uv.push(x, y);
    }
    for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W, x = xOf(T, i), y = yOf(T, j), h2 = T.cell;
      if (!HO.length) { idx.push(a, b, c, a, c, d); continue; }
      if (!inHole(x + h2 * 0.67, y + h2 * 0.33)) idx.push(a, b, c);
      if (!inHole(x + h2 * 0.33, y + h2 * 0.67)) idx.push(a, c, d);
    }
    if (T.sides) {
      const zb = bounds(T).min[2] - 1;
      const side = (P, n) => {                                         // P: the edge's grid points in order (outside on the right)
        const base = pos.length / 3;
        P.forEach(([i, j], q) => { const x = xOf(T, i), y = yOf(T, j); pos.push(x, y, T.h[j * W + i], x, y, zb); nrm.push(n[0], n[1], 0, n[0], n[1], 0); uv.push(q * T.cell, T.h[j * W + i], q * T.cell, zb); });
        for (let q = 0; q + 1 < P.length; q++) { const a = base + q * 2, b = a + 1, c = a + 3, d = a + 2; idx.push(a, b, c, a, c, d); }
      };
      const S = [], E = [], Nn = [], Ws = [];
      for (let i = 0; i < W; i++) { S.push([i, 0]); Nn.push([W - 1 - i, H - 1]); }
      for (let j = 0; j < H; j++) { E.push([W - 1, j]); Ws.push([0, H - 1 - j]); }
      side(S, [0, -1]); side(E, [1, 0]); side(Nn, [0, 1]); side(Ws, [-1, 0]);
      const b0 = pos.length / 3, x1 = xOf(T, W - 1), y1 = yOf(T, H - 1);           // the bottom
      pos.push(T.x0, T.y0, zb, x1, T.y0, zb, x1, y1, zb, T.x0, y1, zb); nrm.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1); uv.push(T.x0, T.y0, x1, T.y0, x1, y1, T.x0, y1);
      idx.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
    }
    return { pos, nrm, uv, idx };
  }
  /** a contour line nearest a plan point (within tol metres) -> {C, d} | null */
  function contourAt(T, p, tol) {
    let best = null;
    ((T && T.contours) || []).forEach((C) => {
      const P = C.closed ? C.pts.concat([C.pts[0]]) : C.pts;
      for (let s = 0; s + 1 < P.length; s++) {
        const a = P[s], b = P[s + 1], ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1];
        const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L)) : 0;
        const d = Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t);
        if (d <= tol && (!best || d < best.d)) best = { C, d };
      }
    });
    return best;
  }
  function addContour(T, pts, z, closed) {
    if (!T || !Array.isArray(pts) || pts.length < 2) return null;
    const C = { id: T.cn++, pts: pts.map((p) => [r3(p[0]), r3(p[1])]), z: r3(+z || 0), closed: !!closed && pts.length >= 3 };
    T.contours.push(C); return C;
  }
  /** what the plan draws of the ground: its contour lines (the majors labelled) + the drawn ones */
  function planLines(T, col) {
    const out = { lines: [], texts: [] }; if (!T) return out;
    const c = col || {};
    lines(T).forEach((Lv) => {
      Lv.segs.forEach((s) => out.lines.push({ pts: [[s[0], s[1]], [s[2], s[3]]], col: Lv.major ? c.major || "#7a6a52" : c.minor || "#b9ad98", k: "contour" }));
      if (Lv.major) { let b = null; Lv.segs.forEach((s) => { const L = Math.hypot(s[2] - s[0], s[3] - s[1]); if (!b || L > b.L) b = { s, L }; }); if (b) out.texts.push({ p: [(b.s[0] + b.s[2]) / 2, (b.s[1] + b.s[3]) / 2], t: fmtZ(Lv.z), h: 0.3, col: c.major || "#7a6a52" }); }
    });
    (T.contours || []).forEach((C) => out.lines.push({ pts: C.closed ? C.pts.concat([C.pts[0]]) : C.pts, col: c.drawn || "#e07a1f", k: "contour" }));
    (T.pads || []).forEach((q) => {                                     // 2.656.0: the pads - outline, level, cut / fill
      out.lines.push({ pts: q.pts.concat([q.pts[0]]), col: c.pad || "#c0392b", k: "contour", dash: true });
      let cx = 0, cy = 0; q.pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= q.pts.length; cy /= q.pts.length;
      out.texts.push({ p: [cx, cy + 0.2], t: q.name + " " + fmtZ(q.z), h: 0.3, col: c.pad || "#c0392b", bold: true });
      out.texts.push({ p: [cx, cy - 0.25], t: "cut " + fmtV(q.cut) + " · fill " + fmtV(q.fill), h: 0.24, col: c.pad || "#c0392b" });
    });
    return out;
  }
  const fmtZ = (z) => (+z.toFixed(2)) + " m";

  /* ---------------- three.js: the ground in the Sketcher's view */
  function attach(V, AV) {
    const T3 = V.T, scene = V.scene;
    const G = new T3.Group(); G.name = "pp-terrain"; scene.add(G);
    const ui = new T3.Group(); ui.name = "pp-terrain-ui"; scene.add(ui); V.hideOnShot = (V.hideOnShot || []).concat([ui]);
    const TV = { V, mesh: null, lines: null, drawn: null, ringL: null, draftL: null, key: "" };
    const mats = new Map();
    const T = () => (V.M && V.M.arch && V.M.arch.terrain) || null;
    function disposeOf(o) { if (!o || !o.traverse) return; o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material && !x.material.userData.cached) x.material.dispose(); }); if (o.parent) o.parent.remove(o); }
    function mat(col) {
      const k = col + "|" + V.styleName; if (mats.has(k)) return mats.get(k);
      const F = root.PPFurn, lk = F && V.styleName !== "mono" ? F.look(T3, col) : { color: F ? F.hex(col) : col, map: null };
      const m = new T3.MeshStandardMaterial({ color: V.styleName === "mono" ? "#f0f0ec" : lk.color, map: lk.map || null, roughness: 0.95, metalness: 0, side: T3.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
        transparent: V.styleName === "xray", opacity: V.styleName === "xray" ? 0.4 : 1, depthWrite: V.styleName !== "xray", wireframe: V.styleName === "wire" });
      m.userData.cached = true; mats.set(k, m); return m;
    }
    function contourGeo(t) {
      const pos = [], col = [], cMinor = new T3.Color("#3b2f22"), cMajor = new T3.Color("#1d160f");
      const HO = root.PPSite && V.M && V.M.arch ? root.PPSite.holes(V.M.arch) : [];
      lines(t).forEach((Lv) => Lv.segs.forEach((s) => {
        if (HO.length && HO.some((P) => inPoly([(s[0] + s[2]) / 2, (s[1] + s[3]) / 2], P))) return;   // 2.657.0: not across a pool
        const c = Lv.major ? cMajor : cMinor;
        pos.push(s[0], s[1], Lv.z + 0.012, s[2], s[3], Lv.z + 0.012); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }));
      const g = new T3.BufferGeometry(); g.setAttribute("position", new T3.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T3.Float32BufferAttribute(col, 3)); return g;
    }
    function drawnGeo(t) {
      const pos = [];
      (t.contours || []).forEach((C) => { const P = C.closed ? C.pts.concat([C.pts[0]]) : C.pts; for (let s = 0; s + 1 < P.length; s++) pos.push(P[s][0], P[s][1], C.z + 0.02, P[s + 1][0], P[s + 1][1], C.z + 0.02); });
      (t.pads || []).forEach((q) => { const P = q.pts.concat([q.pts[0]]); for (let s = 0; s + 1 < P.length; s++) pos.push(P[s][0], P[s][1], q.z + 0.03, P[s + 1][0], P[s + 1][1], q.z + 0.03); });   // 2.656.0: the pads' outlines
      const g = new T3.BufferGeometry(); g.setAttribute("position", new T3.Float32BufferAttribute(pos, 3)); return g;
    }
    function rebuild() {
      [TV.mesh, TV.lines, TV.drawn].forEach(disposeOf); TV.mesh = TV.lines = TV.drawn = null;
      const t = T(); TV.key = "";
      if (!t) { V.draw && V.draw(); return; }
      const holes = root.PPSite && V.M && V.M.arch ? root.PPSite.holes(V.M.arch) : [];
      const m = mesh(t, holes), g = new T3.BufferGeometry();
      g.setAttribute("position", new T3.Float32BufferAttribute(m.pos, 3)); g.setAttribute("normal", new T3.Float32BufferAttribute(m.nrm, 3)); g.setAttribute("uv", new T3.Float32BufferAttribute(m.uv, 2)); g.setIndex(m.idx);
      TV.mesh = new T3.Mesh(g, mat(t.col)); TV.mesh.receiveShadow = true; TV.mesh.castShadow = true; TV.mesh.userData.tag = { ak: "terrain" }; TV.mesh.raycast = () => {}; G.add(TV.mesh);
      TV.key = t.nx + "x" + t.ny + "|" + t.sides + "|" + JSON.stringify(holes);
      TV.lines = new T3.LineSegments(t.show ? contourGeo(t) : new T3.BufferGeometry(), new T3.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })); TV.lines.raycast = () => {}; TV.lines.renderOrder = 2; G.add(TV.lines);
      TV.drawn = new T3.LineSegments(drawnGeo(t), new T3.LineBasicMaterial({ color: 0xe07a1f, depthTest: false, transparent: true })); TV.drawn.raycast = () => {}; TV.drawn.renderOrder = 12; G.add(TV.drawn);
      V.draw && V.draw();
    }
    /** after a dab: the same grid - its heights / normals / contours redrawn in place (no new mesh) */
    let pend = 0;
    function update() {
      const t = T(); if (!t || !TV.mesh || TV.key !== t.nx + "x" + t.ny + "|" + t.sides + "|" + JSON.stringify(root.PPSite && V.M && V.M.arch ? root.PPSite.holes(V.M.arch) : [])) { rebuild(); return; }
      const m = mesh(t), g = TV.mesh.geometry;
      g.attributes.position.array.set(m.pos); g.attributes.position.needsUpdate = true; g.attributes.normal.array.set(m.nrm); g.attributes.normal.needsUpdate = true;
      g.computeBoundingSphere(); g.computeBoundingBox();
      V.draw && V.draw();
      if (!pend) pend = (root.requestAnimationFrame || ((f) => setTimeout(f, 30)))(() => { pend = 0; const t2 = T(); if (!t2 || !TV.lines) return; TV.lines.geometry.dispose(); TV.lines.geometry = t2.show ? contourGeo(t2) : new T3.BufferGeometry(); V.draw && V.draw(); });
    }
    /** the brush's circle on the ground (p = [x, y] | null) */
    function ring(p, r) {
      disposeOf(TV.ringL); TV.ringL = null;
      const t = T(); if (!p || !t || !(r > 0)) { V.draw && V.draw(); return; }
      const pts = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2, x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r; pts.push(new T3.Vector3(x, y, at(t, x, y) + 0.04)); }
      TV.ringL = new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0xf59e2c, depthTest: false, transparent: true })); TV.ringL.renderOrder = 30; TV.ringL.raycast = () => {}; ui.add(TV.ringL);
      V.draw && V.draw();
    }
    /** a contour being drawn (its points + the pointer) at its height */
    function draft(pts, z) {
      disposeOf(TV.draftL); TV.draftL = null;
      if (pts && pts.length >= 2) {
        TV.draftL = new T3.Line(new T3.BufferGeometry().setFromPoints(pts.map((p) => new T3.Vector3(p[0], p[1], (+z || 0) + 0.03))), new T3.LineBasicMaterial({ color: 0xf59e2c, depthTest: false, transparent: true }));
        TV.draftL.renderOrder = 31; TV.draftL.raycast = () => {}; ui.add(TV.draftL);
      }
      V.draw && V.draw();
    }
    TV.hit = (ev) => { const t = T(); if (!t) return null; const r = V.ray(ev); return hit(t, r.o, r.d); };
    TV.terrain = T;
    Object.assign(TV, { rebuild, update, ring, draft, group: G });
    if (AV) {
      const prev = AV.onRebuild; AV.onRebuild = () => { if (prev) prev(); try { rebuild(); } catch (e) { console.warn("Sketcher ground:", e); } };   // with the building, after an undo / a load
      const ex = AV.exportMeshes;                                        // the .glb takes the ground too
      if (ex) AV.exportMeshes = function () {
        const out = ex.apply(this, arguments), t = T(); if (!t || !TV.mesh) return out;
        const m = mesh(t, root.PPSite && V.M && V.M.arch ? root.PPSite.holes(V.M.arch) : []), F = root.PPFurn, pos = [], nrm = [], idx = [];
        for (let q = 0; q < m.idx.length; q += 3) [m.idx[q], m.idx[q + 1], m.idx[q + 2]].forEach((v) => { pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); nrm.push(m.nrm[v * 3], m.nrm[v * 3 + 1], m.nrm[v * 3 + 2]); idx.push(idx.length); });
        out.push({ color: F ? F.hex(t.col) : t.col, alpha: 1, pos, nrm, idx, name: "Ground" }); return out;
      };
      AV.terrainView = TV;
    }
    rebuild();
    return TV;
  }

  const api = { MAXN, COL, clean, make, at, hit, bounds, brush, held, fit, level, fromImage, resample, lines, mesh, contourAt, addContour, planLines, fmtZ, fmtV, inPoly, edgeDist, meanIn, applyPad, addPad, padAt, attach };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPTerrain = api;
})(typeof window !== "undefined" ? window : globalThis);
