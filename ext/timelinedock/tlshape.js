/* bitGen Studio — ext/timelinedock/tlshape.js (2.492.0): SHAPE LAYERS with OPERATORS on the timeline's canvas.
 * window.TlShape.
 *
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested" - AFTER-EFFECTS-GAP.md item 4: "Shape layers + operators:
 * Trim Paths, Repeater, Offset Paths, Wiggle Paths, Zig Zag, Pucker & Bloat, Twist, Round Corners; animated path
 * shapes; gradient fills / strokes".
 *
 *   ◆ Shape tool (Q)  drag on the canvas: a rectangle, ellipse, star or polygon layer (Shift = even sides); the kind
 *                     is in the Properties afterwards
 *   Properties        the kind and its size (width / height, corner radius, points, inner radius); fill (colour or a
 *                     two-colour gradient, opacity) and stroke (colour, width, line ends); the operators, each with an
 *                     on / off and its settings: Trim Paths (start, end, offset %), Repeater (copies, offset, position,
 *                     scale %, rotation, start / end opacity), Offset Paths (px), Pucker & Bloat (%), Twist (°), Zig Zag
 *                     (size, ridges, smooth), Wiggle Paths (size, detail, wiggles per second), Round Corners (px)
 *                     Every number has a ◇ that keys it at the playhead (keys "sh_<name>" - the 📈 Graph Editor shows
 *                     them too): an animated shape
 *   The compile       a shape layer is baked by the page before ⚙ Compile (TlParent's bake - video/tlb_<uid>.webm)
 *   2.496.0 (Tim: "Merge Paths, freehand shape paths ..."):
 *   ✎ Freehand tool (Shift+Q) draw a path: a FREEHAND shape layer (kind "path": the points, smoothed + thinned; closed
 *                     when it ends near where it began - or Shift - else an open line with a stroke). Alt = the drawing
 *                     goes into the picked shape layer as another path.
 *   ⧉ Paths           (Properties) ＋ Path: more paths in one shape layer (rectangle / ellipse / star / polygon, their
 *                     size, place, turn) - each filled on its own, or with ⊕ MERGE PATHS on: combined into one outline,
 *                     each extra path by its mode (add, subtract, intersect, exclude) - the operators after it (offset,
 *                     zig zag, trim …) work on the merged outline, its holes included
 * Pure (Node: scripts/test-shape.js): DEFAULTS, base (the kind's corners / outline), roundCorners, densify, perimeter,
 * offsetPts, pucker, twist, zigzag, wiggle, trim, outlines (the whole chain at one moment), bounds, NUMS; 2.496.0 +
 * rasterize, contours (marching squares), thin, merge, MODES, pathOf (a sub-path placed), freehand (points -> a path).
 */
(function (root) {
  "use strict";
  var DEFAULTS = {
    kind: "rect", w: 200, h: 140, radius: 0, points: 5, inner: 0.45,
    fill: "#f5a623", fill2: "#d0021b", grad: false, fillOp: 100, stroke: "#ffffff", strokeW: 0, cap: "round",
    trim: false, tstart: 0, tend: 100, toff: 0,
    rep: false, rcopies: 3, roffset: 0, rx: 120, ry: 0, rscale: 100, rrot: 0, rop0: 100, rop1: 100,
    offset: false, oamt: 0, pucker: false, pamt: 0, twist: false, tangle: 0,
    zig: false, zsize: 10, zridges: 6, zsmooth: true, wig: false, wsize: 10, wdetail: 4, wspeed: 2, round: false, rrad: 20,
    merge: false            // 2.496.0: Merge Paths (the extra paths in s.more by their modes)
  };
  // the numbers that can be keyed (keys "sh_" + name)
  var NUMS = ["w", "h", "radius", "points", "inner", "fillOp", "strokeW", "tstart", "tend", "toff", "rcopies", "roffset", "rx", "ry", "rscale", "rrot", "rop0", "rop1", "oamt", "pamt", "tangle", "zsize", "zridges", "wsize", "wdetail", "wspeed", "rrad"];

  /* ---------------- geometry: closed outlines as [[x, y], ...] around (0, 0) ---------------- */
  function base(s) {
    var w = Math.max(1, +s.w || 1), h = Math.max(1, +s.h || 1), out = [], i, n;
    if (s.kind === "path" && Array.isArray(s.path) && s.path.length >= 2) {      // 2.496.0: a freehand path (scaled by W / H)
      var pw = Math.max(1, +s.pw || w), ph = Math.max(1, +s.ph || h);
      return { pts: s.path.map(function (q) { return [+q[0] * w / pw, +q[1] * h / ph]; }), corners: true, open: s.closed === false };
    }
    if (s.kind === "ellipse") { n = Math.max(24, Math.round((w + h) / 4)); for (i = 0; i < n; i++) { var a = i / n * Math.PI * 2; out.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]); } return { pts: out, corners: false }; }
    if (s.kind === "star" || s.kind === "polygon") {
      n = Math.max(3, Math.round(+s.points || 5)); var R = Math.min(w, h) / 2, r = R * Math.max(0.05, Math.min(1, +s.inner || 0.45)), k = s.kind === "star" ? 2 * n : n;
      for (i = 0; i < k; i++) { var b = -Math.PI / 2 + i / k * Math.PI * 2, rr = s.kind === "star" && i % 2 ? r : R; out.push([Math.cos(b) * rr * w / Math.min(w, h), Math.sin(b) * rr * h / Math.min(w, h)]); }
      return { pts: out, corners: true };
    }
    out = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    return { pts: out, corners: true, rect: true };
  }
  /** each corner replaced by an arc of radius r (as far as its edges allow) */
  function roundCorners(pts, r) {
    if (!(r > 0) || pts.length < 3) return pts.slice();
    var out = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      var la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), rr = Math.min(r, la / 2, lb / 2);
      var pa = [p[0] + (a[0] - p[0]) / la * rr, p[1] + (a[1] - p[1]) / la * rr], pb = [p[0] + (b[0] - p[0]) / lb * rr, p[1] + (b[1] - p[1]) / lb * rr];
      for (var k = 0; k <= 8; k++) { var t = k / 8, u = 1 - t; out.push([u * u * pa[0] + 2 * u * t * p[0] + t * t * pb[0], u * u * pa[1] + 2 * u * t * p[1] + t * t * pb[1]]); }
    }
    return out;
  }
  /** more points: every edge cut into pieces at most `step` long; `mid[i]` = how far point i is from a corner (0..1) */
  function densify(pts, step, open) {
    var out = [], mid = [], n = pts.length;
    for (var i = 0; i < (open ? n - 1 : n); i++) {
      var a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / Math.max(1, step)));
      for (var j = 0; j < k; j++) { var t = j / k; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); mid.push(1 - Math.abs(2 * t - 1)); }
    }
    if (open && n) { out.push(pts[n - 1].slice()); mid.push(0); }                   // 2.496.0: an open line keeps its end
    return { pts: out, mid: mid };
  }
  function perimeter(pts, closed) { var L = 0, n = pts.length; for (var i = 0; i < (closed ? n : n - 1); i++) { var a = pts[i], b = pts[(i + 1) % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L; }
  function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
  /** pushed out (amt > 0) or in along each point's normal (a closed outline, either winding) */
  function offsetPts(pts, amt) {
    if (!amt) return pts.slice();
    var n = pts.length, area = 0; for (var i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    var sgn = area > 0 ? 1 : -1;
    // each point moved along the MITRE of its two edges' outward normals (a corner stays a corner)
    return pts.map(function (p, i) {
      var a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      var e1x = p[0] - a[0], e1y = p[1] - a[1], l1 = Math.hypot(e1x, e1y) || 1, e2x = b[0] - p[0], e2y = b[1] - p[1], l2 = Math.hypot(e2x, e2y) || 1;
      var n1 = [sgn * e1y / l1, -sgn * e1x / l1], n2 = [sgn * e2y / l2, -sgn * e2x / l2], mx = n1[0] + n2[0], my = n1[1] + n2[1], ml = Math.hypot(mx, my);
      if (ml < 1e-9) return [p[0] + n1[0] * amt, p[1] + n1[1] * amt];
      mx /= ml; my /= ml; var k = Math.min(4, 1 / Math.max(0.25, mx * n1[0] + my * n1[1]));
      return [p[0] + mx * amt * k, p[1] + my * amt * k];
    });
  }
  /** pucker (< 0) pulls the middles of the edges in and pushes the corners out; bloat (> 0) the other way */
  function pucker(d, amt) {
    if (!amt) return d.pts.slice();
    var c = centroid(d.pts), k = amt / 100;
    return d.pts.map(function (p, i) { var f = 1 + k * (d.mid[i] - 0.5) * 2; return [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f]; });
  }
  function twist(pts, deg) {
    if (!deg) return pts.slice();
    var c = centroid(pts), R = Math.max.apply(null, pts.map(function (p) { return Math.hypot(p[0] - c[0], p[1] - c[1]); })) || 1;
    return pts.map(function (p) { var dx = p[0] - c[0], dy = p[1] - c[1], a = deg * Math.PI / 180 * Math.hypot(dx, dy) / R; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; });
  }
  function normals(pts, open) { var n = pts.length; return pts.map(function (p, i) { var a = open && i === 0 ? p : pts[(i - 1 + n) % n], b = open && i === n - 1 ? p : pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1; return [ty / L, -tx / L]; }); }
  /** zig zag: `ridges` peaks of `size` px along the whole outline (smooth = waves) */
  function zigzag(pts, size, ridges, smooth, open) {
    if (!size || !(ridges > 0)) return pts.slice();
    var P = densify(pts, 2, open).pts, N = normals(P, open), L = perimeter(P, !open), s = 0, out = [], k = Math.max(1, Math.round(ridges)) * Math.max(1, pts.length);
    for (var i = 0; i < P.length; i++) {
      if (i) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      var ph = s / L * k, f = smooth ? Math.sin(ph * Math.PI * 2) : (1 - 4 * Math.abs((ph % 1) - 0.5)) * -1;
      out.push([P[i][0] + N[i][0] * size * f, P[i][1] + N[i][1] * size * f]);
    }
    return out;
  }
  function noise1(x) { var i = Math.floor(x), f = x - i, h = function (n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }, u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; }
  /** wiggle paths: each point pushed along its normal by a smooth noise that moves with time */
  function wiggle(pts, size, detail, speed, t, open) {
    if (!size) return pts.slice();
    var P = densify(pts, 3, open).pts, N = normals(P, open), L = perimeter(P, !open), s = 0, d = Math.max(0.2, +detail || 1);
    return P.map(function (p, i) { if (i) s += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]); var v = noise1(s / L * d * 6 + (t || 0) * (+speed || 0)) * size; return [p[0] + N[i][0] * v, p[1] + N[i][1] * v]; });
  }
  /** trim paths: the part of a closed outline from start % to end % (shifted by offset %) - open lines */
  function trim(pts, start, end, off, open) {
    var a = Math.max(0, Math.min(100, start)) / 100, b = Math.max(0, Math.min(100, end)) / 100;
    if (b < a) { var q = a; a = b; b = q; }
    if (open) {                                     // 2.496.0: an open line - the part from start to end (shifted by offset, no wrap)
      var sh = (off || 0) / 100; a = Math.max(0, Math.min(1, a + sh)); b = Math.max(0, Math.min(1, b + sh));
      if (b - a <= 1e-4) return { lines: [], closed: false };
      var cm = [0]; for (var u = 1; u < pts.length; u++) cm.push(cm[u - 1] + Math.hypot(pts[u][0] - pts[u - 1][0], pts[u][1] - pts[u - 1][1]));
      var LL = cm[cm.length - 1] || 1e-9, pos = function (d) { var k2 = 1; while (k2 < cm.length - 1 && cm[k2] < d) k2++; var f2 = (d - cm[k2 - 1]) / Math.max(1e-9, cm[k2] - cm[k2 - 1]); return [pts[k2 - 1][0] + (pts[k2][0] - pts[k2 - 1][0]) * f2, pts[k2 - 1][1] + (pts[k2][1] - pts[k2 - 1][1]) * f2]; };
      var ln = [pos(a * LL)]; for (var v2 = 1; v2 < pts.length - 1; v2++) if (cm[v2] > a * LL && cm[v2] < b * LL) ln.push(pts[v2].slice()); ln.push(pos(b * LL));
      return { lines: [ln], closed: false };
    }
    if (b - a >= 0.9999) return { lines: [pts.concat([pts[0]])], closed: true };
    if (b - a <= 1e-4) return { lines: [], closed: false };
    var ring = pts.concat([pts[0]]), cum = [0];
    for (var i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
    var L = cum[cum.length - 1], o = ((off || 0) / 100 % 1 + 1) % 1;
    var at = function (u) { var d = ((u % 1) + 1) % 1 * L, k = 1; while (k < cum.length - 1 && cum[k] < d) k++; var f = (d - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]); return [ring[k - 1][0] + (ring[k][0] - ring[k - 1][0]) * f, ring[k - 1][1] + (ring[k][1] - ring[k - 1][1]) * f]; };
    // the cut points + every corner between them (over two laps, for a piece that wraps round)
    var d0 = (a + o) * L, d1 = (b + o) * L, line = [at(a + o)];
    for (var lap = 0; lap < 2; lap++) for (var v = 1; v < ring.length; v++) { var dv = cum[v] + lap * L; if (dv > d0 + 1e-9 && dv < d1 - 1e-9) line.push(ring[v].slice()); }
    line.push(at(b + o));
    return { lines: [line], closed: false };
  }
  /* ---------------- 2.496.0: MERGE PATHS - several paths as one (add / subtract / intersect / exclude) ---------------- */
  /** closed loops -> a grid (k cells per px, from (x0, y0)): 1 inside (even-odd over the loops) */
  function rasterize(loops, x0, y0, W, H, k) {
    var g = new Uint8Array(W * H), xs = [];
    for (var j = 0; j < H; j++) {
      var y = y0 + (j + 0.5) / k; xs.length = 0;
      loops.forEach(function (L) { var n = L.length; for (var i = 0; i < n; i++) { var a = L[i], b = L[(i + 1) % n]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); } });
      xs.sort(function (p, q) { return p - q; });
      for (var m = 0; m + 1 < xs.length; m += 2) {
        var i0 = Math.max(0, Math.ceil((xs[m] - x0) * k - 0.5)), i1 = Math.min(W - 1, Math.floor((xs[m + 1] - x0) * k - 0.5));
        for (var ii = i0; ii <= i1; ii++) g[j * W + ii] = 1;
      }
    }
    return g;
  }
  /** a grid's outline as closed loops (marching squares, in px; holes are loops too - fill them even-odd) */
  function contours(g, W, H, x0, y0, k) {
    var at = function (i, j) { return i < 0 || j < 0 || i >= W || j >= H ? 0 : g[j * W + i]; };
    var seg = {}, ends = {};
    var add = function (a, b) { (ends[a] = ends[a] || []).push(b); (ends[b] = ends[b] || []).push(a); };
    // edge keys: "h,i,j" = the edge from cell centre (i, j) to (i + 1, j); "v,i,j" = (i, j) to (i, j + 1)
    for (var j = -1; j < H; j++) for (var i = -1; i < W; i++) {
      var c = at(i, j) * 8 + at(i + 1, j) * 4 + at(i + 1, j + 1) * 2 + at(i, j + 1);
      if (!c || c === 15) continue;
      var T = "h," + i + "," + j, B = "h," + i + "," + (j + 1), L = "v," + i + "," + j, R = "v," + (i + 1) + "," + j;
      switch (c) {
        case 1: add(L, B); break; case 2: add(B, R); break; case 3: add(L, R); break; case 4: add(T, R); break;
        case 5: add(T, R); add(L, B); break; case 6: add(T, B); break; case 7: add(T, L); break; case 8: add(L, T); break;
        case 9: add(T, B); break; case 10: add(L, T); add(B, R); break; case 11: add(T, R); break; case 12: add(L, R); break;
        case 13: add(R, B); break; case 14: add(L, B); break;
      }
    }
    void seg;
    var xy = function (key) { var p = key.split(","), i = +p[1], jj = +p[2]; return p[0] === "h" ? [x0 + (i + 1) / k, y0 + (jj + 0.5) / k] : [x0 + (i + 0.5) / k, y0 + (jj + 1) / k]; };
    var used = {}, loops = [];
    Object.keys(ends).forEach(function (s) {
      if (used[s]) return;
      var loop = [], prev = null, cur = s;
      for (var guard = 0; guard < 1e6; guard++) {
        used[cur] = 1; loop.push(xy(cur));
        var nx = ends[cur].filter(function (q) { return q !== prev && !used[q]; })[0];
        if (nx == null) break;
        prev = cur; cur = nx;
      }
      if (loop.length >= 3) loops.push(loop);
    });
    return loops;
  }
  /** fewer points on a closed loop (Ramer-Douglas-Peucker, tol px) */
  function thin(loop, tol) {
    if (loop.length < 8) return loop;
    var far = 0, fd = -1; for (var i = 1; i < loop.length; i++) { var d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > fd) { fd = d; far = i; } }
    var rdp = function (P) {
      var keep = P.map(function () { return false; }); keep[0] = keep[P.length - 1] = true; var st = [[0, P.length - 1]];
      while (st.length) { var s = st.pop(), a = s[0], b = s[1]; if (b - a < 2) continue; var A = P[a], Bp = P[b], dx = Bp[0] - A[0], dy = Bp[1] - A[1], L = Math.hypot(dx, dy) || 1e-9, best = -1, bi = -1;
        for (var q = a + 1; q < b; q++) { var dd = Math.abs((P[q][0] - A[0]) * dy - (P[q][1] - A[1]) * dx) / L; if (dd > best) { best = dd; bi = q; } }
        if (best > tol) { keep[bi] = true; st.push([a, bi], [bi, b]); } }
      return P.filter(function (_, q) { return keep[q]; });
    };
    var h1 = rdp(loop.slice(0, far + 1)), h2 = rdp(loop.slice(far).concat([loop[0]]));
    return h1.concat(h2.slice(1, -1));
  }
  /** the paths merged: [{pts (closed), mode: add | subtract | intersect | exclude}] (the first = the base) -> closed loops */
  var MODES = ["add", "subtract", "intersect", "exclude"];
  function merge(paths) {
    var all = []; paths.forEach(function (p) { all = all.concat(p.pts); });
    if (!all.length) return [];
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    all.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
    var k = Math.max(0.25, Math.min(2, 700 / Math.max(1, x1 - x0, y1 - y0))), W = Math.ceil((x1 - x0) * k), H = Math.ceil((y1 - y0) * k);
    var acc = null;
    paths.forEach(function (p, n) {
      var g = rasterize([p.pts], x0, y0, W, H, k), m = n ? (MODES.indexOf(p.mode) >= 0 ? p.mode : "add") : "add";
      if (!acc) { acc = g; return; }
      for (var i = 0; i < acc.length; i++) acc[i] = m === "add" ? acc[i] | g[i] : m === "subtract" ? acc[i] & (1 - g[i]) : m === "intersect" ? acc[i] & g[i] : acc[i] ^ g[i];
    });
    return contours(acc, W, H, x0, y0, k).map(function (L) { return thin(L, 0.35); });
  }
  /** 2.496.0: a sub-path (s.more[i]: {kind, w, h, radius, points, inner, path, pw, ph, closed, x, y, rot, mode}) placed
   *  in the layer's space -> {pts, open, corners, rect, mode} */
  function pathOf(p) {
    var B = base(Object.assign({ kind: "ellipse", w: 100, h: 100 }, p)), a = (+p.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), x = +p.x || 0, y = +p.y || 0;
    return { pts: B.pts.map(function (q) { return [x + q[0] * cs - q[1] * sn, y + q[0] * sn + q[1] * cs]; }), open: !!B.open, corners: B.corners, rect: B.rect, mode: MODES.indexOf(p.mode) >= 0 ? p.mode : "add", radius: +p.radius || 0 };
  }
  var areaOf = function (L) { var a = 0; for (var i = 0; i < L.length; i++) { var p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  /** 2.496.0: points drawn by hand -> a path: thinned, smoothed (Chaikin), thinned again; around its own middle
   *  -> {path, w, h, cx, cy, closed} (closed when the ends meet within `close` px) */
  function freehand(raw, close) {
    var P = (raw || []).filter(function (q, i, A) { return !i || Math.hypot(q[0] - A[i - 1][0], q[1] - A[i - 1][1]) > 0.5; });
    if (P.length < 2) return null;
    var closed = P.length > 3 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= (close == null ? 12 : close);
    var rdpOpen = function (Q, tol) { var keep = Q.map(function () { return false; }); keep[0] = keep[Q.length - 1] = true; var st = [[0, Q.length - 1]];
      while (st.length) { var s2 = st.pop(), a = s2[0], b = s2[1]; if (b - a < 2) continue; var A = Q[a], Bq = Q[b], dx = Bq[0] - A[0], dy = Bq[1] - A[1], L = Math.hypot(dx, dy) || 1e-9, best = -1, bi = -1;
        for (var q = a + 1; q < b; q++) { var dd = L > 1e-6 ? Math.abs((Q[q][0] - A[0]) * dy - (Q[q][1] - A[1]) * dx) / L : Math.hypot(Q[q][0] - A[0], Q[q][1] - A[1]); if (dd > best) { best = dd; bi = q; } }
        if (best > tol) { keep[bi] = true; st.push([a, bi], [bi, b]); } }
      return Q.filter(function (_, q) { return keep[q]; }); };
    P = rdpOpen(P, 1.2);
    if (closed) P = P.slice(0, -1);
    for (var it = 0; it < 2 && P.length >= 3; it++) {                       // Chaikin: corners cut a quarter in
      var Q = [], n = P.length;
      for (var i = 0; i < (closed ? n : n - 1); i++) { var a2 = P[i], b2 = P[(i + 1) % n]; Q.push([0.75 * a2[0] + 0.25 * b2[0], 0.75 * a2[1] + 0.25 * b2[1]], [0.25 * a2[0] + 0.75 * b2[0], 0.25 * a2[1] + 0.75 * b2[1]]); }
      P = closed ? Q : [P[0]].concat(Q).concat([P[n - 1]]);
    }
    P = closed ? thin(P, 0.4) : rdpOpen(P, 0.4);
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; P.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r2 = function (v) { return Math.round(v * 100) / 100; };
    return { path: P.map(function (q) { return [r2(q[0] - cx), r2(q[1] - cy)]; }), w: Math.max(1, Math.round(x1 - x0)), h: Math.max(1, Math.round(y1 - y0)), cx: cx, cy: cy, closed: closed };
  }
  /** the shape at one moment: {lines, closed, groups: [{lines, closed}] (each filled on its own, even-odd),
   *  copies: [{x, y, scale, rot, op}]} */
  function outlines(s, t) {
    var B = base(s), main = { pts: B.pts, open: !!B.open, corners: B.corners, rect: B.rect, mode: "add", radius: +s.radius || 0 };
    var paths = [main].concat((Array.isArray(s.more) ? s.more : []).map(pathOf));
    paths.forEach(function (P) {
      if (P.open) return;
      if (s.round && P.corners) P.pts = roundCorners(P.pts, +s.rrad || 0);
      else if (P.rect && P.radius > 0) P.pts = roundCorners(P.pts, P.radius);
    });
    // ⊕ Merge Paths: the closed paths as one outline (its holes too); open lines stay lines
    var groups = [], closedP = paths.filter(function (P) { return !P.open; });
    if (s.merge && closedP.length >= 2) {
      groups.push({ loops: merge(closedP.map(function (P) { return { pts: P.pts, mode: P.mode }; })), open: false, merged: true });
      paths.filter(function (P) { return P.open; }).forEach(function (P) { groups.push({ loops: [P.pts], open: true }); });
    } else paths.forEach(function (P) { groups.push({ loops: [P.pts], open: P.open }); });
    var out = [];
    groups.forEach(function (G) {
      var lines = [], gclosed = !G.open;
      G.loops.forEach(function (pts) {
        if (pts.length < 2) return;
        var op = G.open;
        if (s.offset && !op) pts = offsetPts(pts, (+s.oamt || 0) * (G.merged && areaOf(pts) < 0 ? -1 : 1));   // a hole grows the other way
        var D = densify(pts, 4, op);
        if (s.pucker && !op) pts = pucker(D, +s.pamt || 0); else pts = D.pts;
        if (s.twist) pts = twist(pts, +s.tangle || 0);
        if (s.zig) pts = zigzag(pts, +s.zsize || 0, +s.zridges || 0, s.zsmooth !== false, op);
        if (s.wig) pts = wiggle(pts, +s.wsize || 0, +s.wdetail || 1, +s.wspeed || 0, t, op);
        var T = s.trim ? trim(pts, +s.tstart, +s.tend, +s.toff, op) : { lines: [op ? pts : pts.concat([pts[0]])], closed: !op };
        if (!T.closed) gclosed = false;
        lines = lines.concat(T.lines);
      });
      if (lines.length) out.push({ lines: lines, closed: gclosed });
    });
    var all = []; out.forEach(function (G) { all = all.concat(G.lines); });
    var T = { lines: all, closed: out.length > 0 && out.every(function (G) { return G.closed; }) };
    var copies = [], n = s.rep ? Math.max(1, Math.min(200, Math.round(+s.rcopies || 1))) : 1, o0 = s.rep ? +s.roffset || 0 : 0;
    for (var i = 0; i < n; i++) {
      var k = i + o0, f = n > 1 ? i / (n - 1) : 0;
      copies.push(s.rep ? { x: (+s.rx || 0) * k, y: (+s.ry || 0) * k, scale: Math.pow((+s.rscale || 100) / 100, k), rot: (+s.rrot || 0) * k, op: ((+s.rop0 || 0) + ((s.rop1 == null ? 100 : +s.rop1) - (+s.rop0 || 0)) * f) / 100 } : { x: 0, y: 0, scale: 1, rot: 0, op: 1 });
    }
    return { lines: T.lines, closed: T.closed, groups: out, copies: copies };
  }
  /** the half-size a picture needs round (0, 0) to hold every copy (+ the stroke) */
  function bounds(O, strokeW) {
    var m = 1;
    O.copies.forEach(function (cp) { var a = cp.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); O.lines.forEach(function (L) { L.forEach(function (p) { var x = cp.x + (p[0] * cs - p[1] * sn) * cp.scale, y = cp.y + (p[0] * sn + p[1] * cs) * cp.scale; m = Math.max(m, Math.abs(x), Math.abs(y)); }); }); });
    return Math.ceil(m + (+strokeW || 0) / 2 + 2);
  }
  var pure = { rasterize: rasterize, contours: contours, thin: thin, merge: merge, MODES: MODES, pathOf: pathOf, freehand: freehand, DEFAULTS: DEFAULTS, NUMS: NUMS, base: base, roundCorners: roundCorners, densify: densify, perimeter: perimeter, offsetPts: offsetPts, pucker: pucker, twist: twist, zigzag: zigzag, wiggle: wiggle, trim: trim, outlines: outlines, bounds: bounds, noise1: noise1 };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && window.TlParent && TlParent.bake && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (window.TlShape) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    /** the shape's settings at tau seconds into the clip (keyed numbers tweened) */
    function at(c, tau) {
      var s = Object.assign({}, DEFAULTS, c.shape || {});
      if (c.kf && c.kf.length) NUMS.forEach(function (k) { if (KF.has(c.kf, "sh_" + k)) s[k] = KF.value(c.kf, tau, "sh_" + k, s[k]); });
      if (c.expr && window.TlExpr && TlExpr.num) NUMS.forEach(function (k) { if (c.expr["sh_" + k]) s[k] = TlExpr.num(c, "sh_" + k, tau, s[k]); });   // 2.497.0: ƒx
      return s;
    }
    var cache = new WeakMap();
    /** the shape's picture at tau (cached while nothing changes) */
    function picture(c, tau) {
      var s = at(c, tau), O = outlines(s, tau), sig = JSON.stringify(s) + (s.wig ? "|" + Math.round(tau * FPS) : ""), was = cache.get(c);
      if (was && was.sig === sig) return was.cv;
      var R = bounds(O, s.strokeW), cv = (was && was.cv) || document.createElement("canvas");
      cv.width = 2 * R; cv.height = 2 * R;
      var g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
      O.copies.forEach(function (cp) {
        g.save(); g.translate(R + cp.x, R + cp.y); g.rotate(cp.rot * Math.PI / 180); g.scale(cp.scale, cp.scale); g.globalAlpha = Math.max(0, Math.min(1, cp.op));
        // 2.496.0: each group (a path - or the merged outline with its holes) filled on its own, even-odd
        (O.groups || [{ lines: O.lines, closed: O.closed }]).forEach(function (G) {
          g.beginPath(); G.lines.forEach(function (L) { L.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); if (G.closed) g.closePath(); });
          if (s.fillOp > 0 && G.closed) {
            if (s.grad) { var gr = g.createLinearGradient(-s.w / 2, 0, s.w / 2, 0); gr.addColorStop(0, s.fill); gr.addColorStop(1, s.fill2); g.fillStyle = gr; } else g.fillStyle = s.fill;
            var ga = g.globalAlpha; g.globalAlpha = ga * Math.max(0, Math.min(1, s.fillOp / 100)); g.fill("evenodd"); g.globalAlpha = ga;
          }
          // 2.608.0 (Tim: "can we fill shapes with text"): 🅰 the text repeated in rows inside the shape (static/textfill.js)
          if (s.tfill && s.tfill.on && G.closed && window.H3TextFill) { g.save(); g.clip("evenodd"); H3TextFill.repeatAt(g, s.tfill, 0, 0, Math.max(s.w, s.h, R)); g.restore(); }
          if (s.strokeW > 0) { g.lineWidth = s.strokeW / Math.max(0.01, cp.scale); g.strokeStyle = s.stroke; g.lineCap = s.cap || "round"; g.lineJoin = "round"; g.stroke(); }
        });
        g.restore();
      });
      cache.set(c, { sig: sig, cv: cv });
      return cv;
    }
    /* ◆ the Shape tool: drag a box */
    var D = null;
    C.addTool({ id: "shape", icon: "◆", title: "Shape - drag a rectangle / ellipse / star / polygon layer (Shift = even)", key: "q", cursor: "crosshair",
      down: function (p) { D = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; },
      move: function (p, ev) { if (!D) return; D.x1 = p.x; D.y1 = p.y; if (ev && ev.shiftKey) { var m = Math.max(Math.abs(D.x1 - D.x0), Math.abs(D.y1 - D.y0)); D.x1 = D.x0 + Math.sign(D.x1 - D.x0 || 1) * m; D.y1 = D.y0 + Math.sign(D.y1 - D.y0 || 1) * m; } C.mark(); },
      up: function () {
        var d = D; D = null; if (!d) return;
        var w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0); if (w < 4 || h < 4) { w = 200; h = 140; d.x1 = d.x0 + w / 2; d.y1 = d.y0 + h / 2; d.x0 -= w / 2; d.y0 -= h / 2; }
        add({ kind: lastKind, w: Math.round(w), h: Math.round(h) }, (d.x0 + d.x1) / 2 - C.state.W / 2, (d.y0 + d.y1) / 2 - C.state.H / 2);
        C.setTool("move");
      } });
    var lastKind = "rect";
    /* 2.496.0: ✎ the Freehand tool - draw a path */
    var FH = null;
    C.addTool({ id: "freehand", icon: "✎", title: "Freehand shape - draw a path (it closes when you end where you began, or hold Shift; Alt = into the picked shape layer)", key: "shift+q", cursor: "crosshair",
      down: function (p, ev) { FH = { pts: [[p.x, p.y]], alt: !!(ev && ev.altKey), shift: !!(ev && ev.shiftKey), into: ev && ev.altKey ? C.selClip() : null }; },
      move: function (p, ev) { if (!FH) return; var l = FH.pts[FH.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) >= 1.5) FH.pts.push([p.x, p.y]); if (ev && ev.shiftKey) FH.shift = true; C.draw(); },
      up: function () { var d = FH; FH = null; if (d) drawn(d); C.draw(); } });
    C.onDraw(function (ctx, o) {
      if (!FH || FH.pts.length < 2) return;
      ctx.save(); ctx.strokeStyle = "#f59e2c"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath();
      FH.pts.forEach(function (q, i) { var s2 = o.toScreen(q[0], q[1]); if (i) ctx.lineTo(s2.x, s2.y); else ctx.moveTo(s2.x, s2.y); }); ctx.stroke(); ctx.restore();
    });
    /** a finished drawing: a new freehand shape layer, or (Alt) one more path in the picked shape layer */
    function drawn(d) {
      var z = (C.state.view && C.state.view.z) || 1, f = freehand(d.pts, 14 / z);
      if (!f || (f.w < 3 && f.h < 3)) { say("✎ Freehand: draw a longer line"); return null; }
      if (d.shift && !f.closed && f.path.length >= 3) f.closed = true;
      var into = d.alt && d.into && d.into.c && d.into.c.shape ? d.into.c : null;
      if (into) {
        // into the picked layer's own space (its place, turn and scale undone)
        var b = C.box(into, "img", C.state.t), a = -(b.rot || 0) * Math.PI / 180, sc = (into.tf && into.tf.scale) || 1, dx = f.cx - b.cx, dy = f.cy - b.cy;
        var lx = (dx * Math.cos(a) - dy * Math.sin(a)) / sc, ly = (dx * Math.sin(a) + dy * Math.cos(a)) / sc;
        (into.shape.more = into.shape.more || []).push({ kind: "path", path: f.path.map(function (q) { return [Math.round(q[0] / sc * 100) / 100, Math.round(q[1] / sc * 100) / 100]; }), pw: f.w / sc, ph: f.h / sc, w: Math.round(f.w / sc), h: Math.round(f.h / sc), closed: f.closed, x: Math.round(lx), y: Math.round(ly), rot: Math.round(-a * 180 / Math.PI), mode: "add" });
        delete into.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); C.paintProps();
        say("✎ a path added to the picked shape layer (⧉ Paths in its Properties; ⊕ Merge Paths combines them)");
        return into;
      }
      var c = add(Object.assign({ kind: "path", path: f.path, pw: f.w, ph: f.h, w: f.w, h: f.h, closed: f.closed }, f.closed ? {} : { fillOp: 0, strokeW: 4, stroke: "#ffffff" }), f.cx - C.state.W / 2, f.cy - C.state.H / 2);
      C.setTool("move");
      say("✎ a freehand " + (f.closed ? "shape" : "line") + " (" + f.path.length + " points)");
      return c;
    }
    C.onDraw(function (ctx, o) { if (!D) return; var a = o.toScreen(Math.min(D.x0, D.x1), Math.min(D.y0, D.y1)), b = o.toScreen(Math.max(D.x0, D.x1), Math.max(D.y0, D.y1)); ctx.save(); ctx.strokeStyle = "#f59e2c"; ctx.setLineDash([4, 3]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.restore(); });
    function add(sh, x, y) {
      var len = 5; try { (tl.video || []).forEach(function (v) { len = Math.max(len, (v.start || 0) + (typeof effDur === "function" ? effDur(v) : 5) - (C.state.t || 0)); }); } catch (e) { /* fine */ }
      var c = { name: "", shape: Object.assign({}, DEFAULTS, sh), start: Math.max(0, Math.round((C.state.t || 0) * FPS) / FPS), len: Math.round(Math.min(len, 600) * 100) / 100, opacity: 1, tf: { x: Math.round(x || 0), y: Math.round(y || 0), scale: 1, rot: 0 } };
      c.uid = "u" + Math.random().toString(36).slice(2, 10);
      var n = (tl.images || []).filter(function (L) { return (L.clips || []).some(function (q) { return q.shape; }); }).length + 1;
      C.newLayer("image", c, "Shape " + n);
      say("Shape " + n + ": its kind, fill, stroke and operators are in the Properties");
      return c;
    }
    /* the Properties: kind, size, fill, stroke, the operators - every number keyable */
    var OPS = [["trim", "✂ Trim Paths", [["tstart", "start %"], ["tend", "end %"], ["toff", "offset %"]]],
               ["rep", "⧉ Repeater", [["rcopies", "copies"], ["roffset", "offset"], ["rx", "x"], ["ry", "y"], ["rscale", "scale %"], ["rrot", "rot °"], ["rop0", "start op %"], ["rop1", "end op %"]]],
               ["offset", "⇲ Offset Paths", [["oamt", "px"]]], ["pucker", "✳ Pucker & Bloat", [["pamt", "%"]]], ["twist", "🌀 Twist", [["tangle", "°"]]],
               ["zig", "〰 Zig Zag", [["zsize", "size"], ["zridges", "ridges"]]], ["wig", "≈ Wiggle Paths", [["wsize", "size"], ["wdetail", "detail"], ["wspeed", "per s"]]],
               ["round", "◜ Round Corners", [["rrad", "px"]]]];
    function numRow(c, tau, k, label, s) {
      var keyed = KF.has(c.kf, "sh_" + k), v = Math.round(s[k] * 1000) / 1000;
      return '<label style="white-space:nowrap">' + esc(label) + ' <input type="number" data-sh="' + k + '" value="' + v + '" step="any" style="width:58px"></label><button class="ghost" data-shk="' + k + '" title="Key ' + esc(label) + ' at the playhead" style="padding:0 3px">' + (keyed ? "◆" : "◇") + "</button>";
    }
    C.onProps(function (P, c, sel) {
      if (!c || !c.shape || !P) return;
      var tau = C.tauOf(c, sel.Ly.kind), s = at(c, tau), d = document.createElement("div"); d.className = "tlp-shape";
      var h = '<div class="tlp-t">◆ Shape</div><div class="tlp-row" style="flex-wrap:wrap"><select id="tlpShKind">' + [["rect", "Rectangle"], ["ellipse", "Ellipse"], ["star", "Star"], ["polygon", "Polygon"]].concat(s.kind === "path" ? [["path", "Freehand path"]] : []).map(function (k) { return '<option value="' + k[0] + '"' + (s.kind === k[0] ? " selected" : "") + ">" + k[1] + "</option>"; }).join("") + "</select>"
        + numRow(c, tau, "w", "W", s) + numRow(c, tau, "h", "H", s) + (s.kind === "rect" ? numRow(c, tau, "radius", "radius", s) : "") + (s.kind === "star" || s.kind === "polygon" ? numRow(c, tau, "points", "points", s) : "") + (s.kind === "star" ? numRow(c, tau, "inner", "inner", s) : "") + "</div>"
        + '<div class="tlp-row" style="flex-wrap:wrap"><span>Fill</span><input type="color" data-shc="fill" value="' + esc(s.fill) + '"><label><input type="checkbox" data-shb="grad"' + (s.grad ? " checked" : "") + '> gradient</label><input type="color" data-shc="fill2" value="' + esc(s.fill2) + '">' + numRow(c, tau, "fillOp", "%", s) + "</div>"
        // 2.608.0: 🅰 the shape filled with text (rows)
        + (function () { var tf = s.tfill || {}; return '<div class="tlp-row" style="flex-wrap:wrap"><label title="Fill the shape with the text repeated in rows (on top of its colour - set the fill % to 0 for text only)"><input type="checkbox" id="tlpShTf"' + (tf.on ? " checked" : "") + "> 🅰 Text fill</label>"
          + (tf.on ? '<input type="text" data-shtf="str" value="' + esc(tf.str || "TEXT") + '" style="width:110px" title="The text"><select data-shtf="font" class="h3-font" title="Font">' + ["Arial", "Arial Black", "Impact", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"].concat(["Arial", "Arial Black", "Impact", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"].indexOf(tf.font || "Arial") < 0 ? [tf.font] : []).map(function (f) { return "<option" + (f === (tf.font || "Arial") ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>"
            + '<label>size <input type="number" data-shtf="size" value="' + (tf.size || 24) + '" min="4" max="400" style="width:50px"></label><input type="color" data-shtf="color" value="' + esc(tf.color || "#ffffff") + '" title="Text colour">'
            + '<label>angle <input type="number" data-shtf="angle" value="' + (+tf.angle || 0) + '" min="-90" max="90" style="width:46px"></label><label><input type="checkbox" data-shtf="bold"' + (tf.bold !== false ? " checked" : "") + "> bold</label>" : "") + "</div>"; })()
        + '<div class="tlp-row" style="flex-wrap:wrap"><span>Stroke</span><input type="color" data-shc="stroke" value="' + esc(s.stroke) + '">' + numRow(c, tau, "strokeW", "px", s) + '<select data-shs="cap"><option value="round"' + (s.cap === "round" ? " selected" : "") + '>round ends</option><option value="butt"' + (s.cap === "butt" ? " selected" : "") + '>flat ends</option><option value="square"' + (s.cap === "square" ? " selected" : "") + ">square ends</option></select></div>";
      // 2.496.0: ⧉ more paths in this layer + ⊕ Merge Paths
      var KINDS = [["rect", "Rectangle"], ["ellipse", "Ellipse"], ["star", "Star"], ["polygon", "Polygon"], ["path", "Freehand"]], more = Array.isArray(c.shape.more) ? c.shape.more : [];
      h += '<div class="tlp-row" style="flex-wrap:wrap"><span title="More paths in this shape layer">⧉ Paths</span><select id="tlpShPk">' + KINDS.slice(0, 4).map(function (k) { return '<option value="' + k[0] + '">' + k[1] + "</option>"; }).join("") + '</select><button class="ghost" id="tlpShPAdd" title="One more path in this layer (or draw one with ✎ Freehand + Alt)">＋ Path</button>'
        + '<label title="Combine the paths into one outline - each extra path by its mode"><input type="checkbox" data-shb="merge"' + (s.merge ? " checked" : "") + "> ⊕ Merge Paths</label></div>";
      more.forEach(function (q, i) {
        h += '<div class="tlp-row tlp-shp" style="flex-wrap:wrap;padding-left:10px">' + (i + 2) + '. <select data-shpk="' + i + '">' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (q.kind === k[0] ? " selected" : "") + (k[0] === "path" && q.kind !== "path" ? " disabled" : "") + ">" + k[1] + "</option>"; }).join("") + "</select>"
          + [["w", "W"], ["h", "H"], ["x", "x"], ["y", "y"], ["rot", "rot °"]].map(function (f) { return '<label style="white-space:nowrap">' + f[1] + ' <input type="number" data-shp="' + i + ":" + f[0] + '" value="' + (Math.round((+q[f[0]] || 0) * 100) / 100) + '" step="any" style="width:50px"></label>'; }).join("")
          + '<select data-shpm="' + i + '" title="How it meets the paths before it (with ⊕ Merge Paths)">' + MODES.map(function (m) { return '<option' + (q.mode === m ? " selected" : "") + ">" + m + "</option>"; }).join("") + "</select>"
          + '<button class="ghost" data-shpx="' + i + '" title="Take this path out">✕</button></div>';
      });
      OPS.forEach(function (op) {
        h += '<div class="tlp-row" style="flex-wrap:wrap"><label style="min-width:118px"><input type="checkbox" data-shb="' + op[0] + '"' + (s[op[0]] ? " checked" : "") + "> " + op[1] + "</label>"
          + (s[op[0]] ? op[2].map(function (f) { return numRow(c, tau, f[0], f[1], s); }).join("") + (op[0] === "zig" ? '<label><input type="checkbox" data-shb="zsmooth"' + (s.zsmooth !== false ? " checked" : "") + "> smooth</label>" : "") : "") + "</div>";
      });
      d.innerHTML = h; P.appendChild(d);
      var save = function (repaint) { delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      var setNum = function (k, v) { if (!Number.isFinite(v)) return; if (KF.has(c.kf, "sh_" + k)) { var o = {}; o["sh_" + k] = v; c.kf = KF.set(c.kf, C.tauOf(c, sel.Ly.kind), o, FPS); } else c.shape[k] = v; };
      // 2.608.0: 🅰 text fill
      d.querySelector("#tlpShTf").addEventListener("change", function (e) { c.shape.tfill = Object.assign({ str: "TEXT", font: "Arial", size: 24, color: "#ffffff", angle: 0, bold: true }, c.shape.tfill || {}, { on: e.target.checked }); save(true); });
      d.querySelectorAll("[data-shtf]").forEach(function (el) {
        el.addEventListener("keydown", function (e) { e.stopPropagation(); });
        el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", function () {
          var k = el.dataset.shtf, v = el.type === "checkbox" ? el.checked : el.type === "number" ? +el.value : el.value; if (el.type === "number" && !Number.isFinite(v)) return;
          c.shape.tfill = Object.assign({}, c.shape.tfill || {}); c.shape.tfill[k] = v; save(false);
        });
      });
      d.querySelector("#tlpShKind").addEventListener("change", function (e) { c.shape.kind = e.target.value; if (e.target.value !== "path") lastKind = e.target.value; save(true); });
      d.querySelector("#tlpShPAdd").addEventListener("click", function () { var k = d.querySelector("#tlpShPk").value, n = (c.shape.more = c.shape.more || []).length; c.shape.more.push({ kind: k, w: 100, h: 100, x: 60 + 20 * n, y: 20 * n, rot: 0, mode: "add", points: 5, inner: 0.45 }); save(true); say("⧉ path " + (n + 2) + " - its size, place and mode below; ⊕ Merge Paths combines them"); });
      d.querySelectorAll("[data-shp]").forEach(function (el) { el.addEventListener("input", function () { var nk = el.dataset.shp.split(":"), q = c.shape.more[+nk[0]], v = +el.value; if (!q || !Number.isFinite(v)) return; if ((nk[1] === "w" || nk[1] === "h") && q.kind === "path") { /* a freehand path keeps its own drawing - pw / ph stay */ } q[nk[1]] = v; save(false); }); });
      d.querySelectorAll("[data-shpk]").forEach(function (el) { el.addEventListener("change", function () { var q = c.shape.more[+el.dataset.shpk]; if (q) { q.kind = el.value; save(true); } }); });
      d.querySelectorAll("[data-shpm]").forEach(function (el) { el.addEventListener("change", function () { var q = c.shape.more[+el.dataset.shpm]; if (q) { q.mode = el.value; save(false); } }); });
      d.querySelectorAll("[data-shpx]").forEach(function (el) { el.addEventListener("click", function () { c.shape.more.splice(+el.dataset.shpx, 1); if (!c.shape.more.length) delete c.shape.more; save(true); }); });
      d.querySelectorAll("[data-sh]").forEach(function (el) { el.addEventListener("input", function () { setNum(el.dataset.sh, +el.value); save(false); }); el.addEventListener("change", function () { save(false); if (typeof renderTimeline === "function") renderTimeline(); }); });
      d.querySelectorAll("[data-shc]").forEach(function (el) { el.addEventListener("input", function () { c.shape[el.dataset.shc] = el.value; save(false); }); });
      d.querySelectorAll("[data-shs]").forEach(function (el) { el.addEventListener("change", function () { c.shape[el.dataset.shs] = el.value; save(false); }); });
      d.querySelectorAll("[data-shb]").forEach(function (el) { el.addEventListener("change", function () { c.shape[el.dataset.shb] = el.checked; save(true); }); });
      d.querySelectorAll("[data-shk]").forEach(function (el) {
        el.addEventListener("click", function () {
          var k = el.dataset.shk, tauNow = C.tauOf(c, sel.Ly.kind), o = {}; o["sh_" + k] = at(c, tauNow)[k];
          c.kf = KF.set(c.kf, tauNow, o, FPS);
          if (window.TlGraph && TlGraph.addProp) TlGraph.addProp("sh_" + k, "Shape " + k, 1, "");
          C.keysChanged(c); if (typeof renderTimeline === "function") renderTimeline(); save(true);
        });
      });
      if (window.TlGraph && TlGraph.addProp) NUMS.forEach(function (k) { if (KF.has(c.kf, "sh_" + k)) TlGraph.addProp("sh_" + k, "Shape " + k, 1, ""); });
    });
    window.TlShape = { at: at, picture: picture, add: add, outlines: outlines, drawn: drawn, freehand: freehand, merge: merge, DEFAULTS: DEFAULTS, NUMS: NUMS };
  }
})(typeof window !== "undefined" ? window : globalThis);
