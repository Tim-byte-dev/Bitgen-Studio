/* pcshapeops.js — THE SHAPE TOOL'S MODES, TRIM, MIRROR AND OFFSET (2.810.0), window.PCShapeOps.
 *
 * Tim (verbatim): "in image editor, click on shape will draw new shapes, shift+click on shape will change shape to new
 * shape clicked, ctrl+ click will add shape to existing shape (boolean) , alt + click will subtract new selected shape
 * from shape on selected layer. These will select the mode of the new shape being created. left click on the canvas
 * will start drawing as normal(in the selected mode), add the shape options to the right click context menu when shape
 * tool is selected only. add a trim button so shapes can be trimmed like in fusion 360. Add mirror and offset buttons
 * for selected shapes"
 *
 *   THE SHAPE BUTTONS (▭ ▢ ◯ △ ⬠ ╱ on the Shape tool's bar) pick the shape AND the mode the next one is drawn in:
 *     click            New shape (a layer of its own) - the picked layer is left alone (it used to change kind)
 *     Shift+click      Replace: the picked shape layer becomes that shape now, and the next one drawn replaces it
 *     Ctrl+click       Add (pcpen's Combine Shapes op) to the picked shape layer - one boolean shape
 *     Alt+click        Subtract (Subtract Front Shape) from the picked shape layer
 *     Ctrl+Alt+click   Intersect
 *   The mode is S.shapeOp (pcpen.js - its Ops buttons on the same bar show it; ⇄ = Replace is added there). With no
 *   shape layer picked, Replace / Add / Subtract draw a new layer, as before.
 *   ✂ TRIM (tool "shapetrim"): like a CAD sketch's trim - the piece of a shape's outline under the pointer, between the
 *   nearest places other outlines (its own, other shape layers', lines) cross it, is shown red; a click cuts it away.
 *   What is left is joined end to end again (two overlapping circles trimmed inside = one closed outline); pieces
 *   left open stay as lines (not filled - sub.nofill), the stroke switched on if the layer had none. Esc = back.
 *   ⇋ MIRROR: Flip Horizontal / Vertical (about the picked shapes' box together), or Mirror Copy Right / Left / Down / Up
 *   (the copy joined into each shape, mirrored about that side of the box - a symmetric shape from half of it).
 *   ⧈ OFFSET: the outline grown (+) or shrunk (−) by a distance in px, round corners; Keep original = a new layer
 *   "Offset of …" above, else the shape itself changes. Worked on a fine grid (a distance transform) and traced back to
 *   curves - any ops, holes and overlaps give a clean outline (a vector clipper broke on many round corners).
 *   THE RIGHT-CLICK MENU with the Shape tool (or Trim) in hand starts with the modes, Shape ▸, ✂ Trim, Mirror ▸ and
 *   Offset… (E.shapeMenu - pcframes.js puts it first); other tools: nothing new.
 *
 * Pure (Node: scripts/test-shapeops810.js): modeOf, cutsOf, trimPlan, trimAt, sliceSub, joinOpen, mirrorPath,
 * mirrorCopy, edt, offsetPath. PCPath (pcpath.js) is the Bézier maths underneath.
 */
(function (root) {
  "use strict";
  const Q = () => root.PCPath || (typeof require === "function" ? require("./pcpath.js") : null);

  /** the mode a shape button's click asks for */
  function modeOf(e) {
    const c = !!(e && (e.ctrlKey || e.metaKey)), a = !!(e && e.altKey), s = !!(e && e.shiftKey);
    if (c && a) return "intersect";
    if (c) return "add";
    if (a) return "subtract";
    if (s) return "replace";
    return "new";
  }
  const MODES = [["new", "▣ New Shape"], ["replace", "⇄ Replace the Picked Shape (Shift+click)"],
    ["add", "⊕ Add to the Picked Shape (Ctrl+click)"], ["subtract", "⊖ Subtract From the Picked Shape (Alt+click)"],
    ["intersect", "⊗ Intersect With the Picked Shape (Ctrl+Alt+click)"]];

  /* ================================ trim ================================ */
  /** a sub-path as a polyline with its parameter u (segment index + t) at every point */
  function sampled(sub) {
    const P = Q(), C = P.segs(sub), out = [];
    if (!sub.pts.length) return out;
    out.push([sub.pts[0].x, sub.pts[0].y, 0]);
    C.forEach((c, i) => {
      const len = Math.hypot(c[2] - c[0], c[3] - c[1]) + Math.hypot(c[4] - c[2], c[5] - c[3]) + Math.hypot(c[6] - c[4], c[7] - c[5]);
      const n = Math.max(P.isLine(c) ? 4 : 8, Math.min(160, Math.ceil(Math.sqrt(len / 0.25) * 1.5)));
      for (let k = 1; k <= n; k++) { const t = k / n, q = P.cubicAt(c, t); out.push([q[0], q[1], i + t]); }
    });
    return out;
  }
  function segX(a, b, c, d) {      // [alpha on ab, beta on cd] or null
    const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return null;
    const qx = c[0] - a[0], qy = c[1] - a[1], al = (qx * sy - qy * sx) / den, be = (qx * ry - qy * rx) / den;
    return al >= -1e-9 && al <= 1 + 1e-9 && be >= -1e-9 && be <= 1 + 1e-9 ? [al, be] : null;
  }
  const boxOf = (pl) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pl) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; };
  const overlap = (A, B, m) => A[0] <= B[2] + m && B[0] <= A[2] + m && A[1] <= B[3] + m && B[1] <= A[3] + m;
  /** t on segment c nearest to (x, y), searched round t0 */
  function refineT(c, t0, x, y) {
    const P = Q(); let lo = Math.max(0, t0 - 0.08), hi = Math.min(1, t0 + 0.08);
    for (let it = 0; it < 40; it++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3, a1 = P.cubicAt(c, m1), a2 = P.cubicAt(c, m2);
      if (Math.hypot(a1[0] - x, a1[1] - y) < Math.hypot(a2[0] - x, a2[1] - y)) hi = m2; else lo = m1;
    }
    return (lo + hi) / 2;
  }
  /** where the sub-path `s` of `path` is crossed: its own other parts, the path's other subs and `others` (paths) -
   *  sorted parameters u (segment + t) */
  function cutsOf(path, s, others) {
    const P = Q(), sub = path.subs[s]; if (!sub || sub.pts.length < 2) return [];
    const A = sampled(sub), C = P.segs(sub), nA = A.length - 1, us = [];
    const cutters = [];
    // an open cutter is reached a little past its ends (0.6 px) - a piece left by an earlier trim ends right ON the
    // outline it was cut at, and must still count as crossing it
    const reach = (pl, q) => {
      if (q.closed || pl.length < 2) return pl;
      const ext = (p0, p1) => { const dx = p0[0] - p1[0], dy = p0[1] - p1[1], L = Math.hypot(dx, dy) || 1; return [p0[0] + dx / L * 0.6, p0[1] + dy / L * 0.6, p0[2]]; };
      return [ext(pl[0], pl[1])].concat(pl, [ext(pl[pl.length - 1], pl[pl.length - 2])]);
    };
    path.subs.forEach((q, j) => { if (q.pts.length > 1) cutters.push({ pl: j === s ? A : reach(sampled(q), q), self: j === s, closed: q.closed }); });
    for (const o of others || []) for (const q of (o && o.subs) || []) if (q.pts.length > 1) cutters.push({ pl: reach(sampled(q), q), self: false });
    const BA = boxOf(A);
    for (const K of cutters) {
      if (!overlap(BA, boxOf(K.pl), 1)) continue;
      const B = K.pl, nB = B.length - 1;
      for (let i = 0; i < nA; i++) {
        const a = A[i], b = A[i + 1], ea = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
        for (let j = 0; j < nB; j++) {
          if (K.self && (Math.abs(i - j) <= 1 || (sub.closed && ((i === 0 && j === nB - 1) || (j === 0 && i === nA - 1))))) continue;
          const c = B[j], d = B[j + 1];
          if (Math.max(c[0], d[0]) < ea[0] - 1e-9 || Math.min(c[0], d[0]) > ea[2] + 1e-9 || Math.max(c[1], d[1]) < ea[1] - 1e-9 || Math.min(c[1], d[1]) > ea[3] + 1e-9) continue;
          const r = segX(a, b, c, d); if (!r) continue;
          const x = a[0] + (b[0] - a[0]) * r[0], y = a[1] + (b[1] - a[1]) * r[0];
          let u = a[2] + (b[2] - a[2]) * r[0], k = Math.min(C.length - 1, Math.floor(u));
          if (b[2] - k > 1 + 1e-9) k = Math.floor(b[2] - 1e-9);
          u = k + refineT(C[k], u - k, x, y);
          us.push(u);
        }
      }
    }
    const N = C.length, ws = us.map((u) => (sub.closed ? ((u % N) + N) % N : u)).filter((w) => sub.closed || (w > 1e-6 && w < N - 1e-6)).sort((p, q) => p - q), out = [];
    for (const w of ws) { if (out.length && Math.abs(w - out[out.length - 1]) < 1e-4) continue; out.push(w); }
    if (sub.closed && out.length > 1 && Math.abs(out[0] + N - out[out.length - 1]) < 1e-4) out.pop();
    return out;
  }
  /** cubics -> an open sub-path (anchors joined at the cubics' ends) */
  function cubicsToSub(list, op) {
    const P = Q(); if (!list.length) return null;
    const pts = [P.anchor(list[0][0], list[0][1], list[0][0], list[0][1], list[0][2], list[0][3])];
    list.forEach((c, i) => {
      const nx = list[i + 1];
      pts.push(P.anchor(c[6], c[7], c[4], c[5], nx ? nx[2] : c[6], nx ? nx[3] : c[7]));
    });
    return { closed: false, op: op || "add", pts };
  }
  /** the piece of `sub` from parameter u1 to u2 (a closed sub wraps when u2 < u1) as an open sub-path */
  function sliceSub(sub, u1, u2) {
    const P = Q(), C = P.segs(sub), N = C.length; if (!N) return null;
    if (sub.closed && u2 <= u1) u2 += N;
    const out = [], k0 = Math.floor(u1), k1 = Math.max(k0, Math.ceil(u2) - 1);
    for (let k = k0; k <= k1; k++) {
      const c = C[((k % N) + N) % N], t0 = k === k0 ? u1 - k : 0, t1 = k === k1 ? u2 - k : 1;
      if (t1 - t0 < 1e-9) continue;
      if (P.isLine(c)) { const a = P.cubicAt(c, t0), b = P.cubicAt(c, t1); out.push([a[0], a[1], a[0], a[1], b[0], b[1], b[0], b[1]]); continue; }
      let piece = t0 > 0 ? P.splitCubic(c, t0)[1] : c;
      if (t1 < 1) piece = P.splitCubic(piece, (t1 - t0) / (1 - t0))[0];
      out.push(piece);
    }
    const s = cubicsToSub(out, sub.op);
    if (s && sub.plain) s.plain = true;
    return s;
  }
  const near = (a, b, tol) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;
  function revSub(s) { return Q().reverseSub(s); }
  /** open sub-paths whose ends meet are joined; a run that comes back to its start is closed */
  function joinOpen(subs, tol) {
    const t = tol == null ? 0.75 : tol;
    let list = subs.map((s) => JSON.parse(JSON.stringify(s)));
    const glue = (a, b) => {                              // a's end = b's start
      const e = a.pts[a.pts.length - 1], f = b.pts[0];
      e.ox = f.ox; e.oy = f.oy; e.smooth = false;
      a.pts = a.pts.concat(b.pts.slice(1)); return a;
    };
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < list.length && !changed; i++) {
        const a = list[i]; if (a.closed) continue;
        for (let j = 0; j < list.length && !changed; j++) {
          if (i === j) continue; const b = list[j]; if (b.closed) continue;
          const aS = a.pts[0], aE = a.pts[a.pts.length - 1], bS = b.pts[0], bE = b.pts[b.pts.length - 1];
          let m = null;
          if (near(aE, bS, t)) m = glue(a, b);
          else if (near(aE, bE, t)) m = glue(a, revSub(b));
          else if (near(aS, bE, t)) m = glue(b, a);
          else if (near(aS, bS, t)) m = glue(revSub(a), b);
          if (m) { m.op = a.op; list = list.filter((_, k) => k !== i && k !== j); list.push(m); changed = true; }
        }
      }
    }
    for (const s of list) {
      if (s.closed || s.pts.length < 3) continue;
      const f = s.pts[0], l = s.pts[s.pts.length - 1];
      if (near(f, l, t)) { f.ix = l.ix; f.iy = l.iy; f.smooth = false; s.pts.pop(); s.closed = true; }
    }
    for (const s of list) { if (s.closed) delete s.nofill; else s.nofill = true; }
    return list;
  }
  /** what a trim at (x, y) would do on `path` (cut by its own subs + `others`): {s, cuts, remove (sub), keep [subs]} or null */
  function trimPlan(path, others, x, y, tol) {
    const P = Q(), hit = P.nearestSeg(path, x, y);
    if (!hit || hit.d > (tol == null ? 6 : tol)) return null;
    const sub = path.subs[hit.s], N = P.segs(sub).length, u = hit.i + hit.t, cuts = cutsOf(path, hit.s, others);
    if (sub.closed) {
      if (cuts.length < 2) return { s: hit.s, cuts, whole: true, remove: Object.assign(JSON.parse(JSON.stringify(sub)), {}), keep: [] };
      let a = cuts[cuts.length - 1], b = cuts[0];
      for (let k = 0; k < cuts.length - 1; k++) if (u >= cuts[k] && u <= cuts[k + 1]) { a = cuts[k]; b = cuts[k + 1]; break; }
      return { s: hit.s, cuts, whole: false, remove: sliceSub(sub, a, b), keep: [sliceSub(sub, b, a)].filter(Boolean) };
    }
    const all = [0].concat(cuts, [N]);
    let a = 0, b = N;
    for (let k = 0; k < all.length - 1; k++) if (u >= all[k] && u <= all[k + 1]) { a = all[k]; b = all[k + 1]; break; }
    const keep = [];
    if (a > 1e-6) keep.push(sliceSub(sub, 0, a));
    if (b < N - 1e-6) keep.push(sliceSub(sub, b, N));
    return { s: hit.s, cuts, whole: a <= 1e-6 && b >= N - 1e-6, remove: sliceSub(sub, a, b), keep: keep.filter(Boolean) };
  }
  /** the path after the trim (null = nothing under the point) */
  function trimAt(path, others, x, y, tol) {
    const plan = trimPlan(path, others, x, y, tol); if (!plan) return null;
    const rest = path.subs.filter((_, i) => i !== plan.s);
    const closed = rest.filter((s) => s.closed), open = rest.filter((s) => !s.closed).concat(plan.keep);
    return { subs: closed.map((s) => JSON.parse(JSON.stringify(s))).concat(joinOpen(open)), plan };
  }

  /* ================================ mirror ================================ */
  /** the path flipped about x = c (axis "h") or y = c ("v"); each sub turned round so it keeps its winding */
  function mirrorPath(path, axis, c) {
    const P = Q(), m = axis === "v" ? [1, 0, 0, -1, 0, 2 * c] : [-1, 0, 0, 1, 2 * c, 0];
    const q = P.transform(path, m);
    q.subs = q.subs.map((s) => { const r = P.reverseSub(s); r.op = s.op; if (s.nofill) r.nofill = true; if (s.plain) r.plain = true; return r; });
    return q;
  }
  /** side -> the axis and the line for a box {x, y, w, h} */
  function mirrorLine(side, b) {
    if (side === "left") return ["h", b.x];
    if (side === "down") return ["v", b.y + b.h];
    if (side === "up") return ["v", b.y];
    return ["h", b.x + b.w];
  }
  /** the path with its mirror copy joined in (added as components after its own) */
  function mirrorCopy(path, side, box) {
    const [axis, c] = mirrorLine(side, box), m = mirrorPath(path, axis, c);
    return { subs: JSON.parse(JSON.stringify(path.subs)).concat(m.subs) };
  }

  /* ================================ offset ================================ */
  /** squared Euclidean distance to the nearest seed (seed[i] = 1) - Felzenszwalb & Huttenlocher, two 1D passes */
  function edt(seed, W, H) {
    const INF = 1e20, D = new Float64Array(W * H), n = Math.max(W, H), f = new Float64Array(n), dd = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let i = 0; i < W * H; i++) D[i] = seed[i] ? 0 : INF;
    const pass = (len) => {
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (sx <= z[k]) { k--; sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = sx; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; dd[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    };
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = D[y * W + x]; pass(H); for (let y = 0; y < H; y++) D[y * W + x] = dd[y]; }
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = D[y * W + x]; pass(W); for (let x = 0; x < W; x++) D[y * W + x] = dd[x]; }
    return D;
  }
  /** the cells a polyline passes through set to 255 */
  function lineCells(m, W, H, pl) {
    for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i], b = pl[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let k = 0; k <= n; k++) { const x = Math.floor(a[0] + (b[0] - a[0]) * k / n), y = Math.floor(a[1] + (b[1] - a[1]) * k / n); if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 255; }
    }
  }
  /** a path's outline offset by d px (+ grows, − shrinks; round corners), worked on a fine grid (any ops, holes,
   *  overlaps - always a clean result) and traced back to Béziers; all subs "add", holes wound the other way.
   *  Open subs (lines): + = the band round them. -> path or null */
  function offsetPath(path, d, opts) {
    const P = Q(), o = opts || {}; if (!d || !path || !path.subs || !path.subs.length) return null;
    const area = { subs: path.subs.filter((s) => s.closed && !s.nofill && s.pts.length > 2) }, lines = path.subs.filter((s) => (!s.closed || s.nofill) && s.pts.length > 1);
    if (!area.subs.length && (d < 0 || !lines.length)) return null;
    const b = P.bbox(path); if (!b) return null;
    const pad = Math.abs(d) + 4, span = Math.max(b.w, b.h) + 2 * pad, k = Math.max(0.5, Math.min(o.scale || 3, (o.cells || 1400) / span));
    const ox = b.x - pad, oy = b.y - pad, W = Math.ceil((b.w + 2 * pad) * k) + 2, H = Math.ceil((b.h + 2 * pad) * k) + 2;
    const toGrid = (p) => P.transform(p, [k, 0, 0, k, -ox * k, -oy * k]);
    // all "add" = one nonzero fill (a ring's hole is a sub wound the other way); else the ops in order
    const joint = area.subs.every((q, i) => q.op === "add" || (i === 0 && q.op !== "subtract" && q.op !== "intersect"));
    const inside = area.subs.length ? P.raster(toGrid(area), W, H, joint) : new Uint8Array(W * H);
    const r = Math.abs(d) * k + 0.5, r2 = r * r, out = new Uint8Array(W * H);
    if (d > 0) {
      const seed = new Uint8Array(W * H);
      for (let i = 0; i < seed.length; i++) seed[i] = inside[i] ? 1 : 0;
      for (const s of toGrid({ subs: lines }).subs) lineCells(seed, W, H, P.flatten(s, 0.25));
      const D = edt(seed, W, H);
      for (let i = 0; i < out.length; i++) out[i] = D[i] <= r2 ? 255 : 0;
    } else {
      const seed = new Uint8Array(W * H);
      for (let i = 0; i < seed.length; i++) seed[i] = inside[i] ? 0 : 1;
      const D = edt(seed, W, H);
      for (let i = 0; i < out.length; i++) out[i] = inside[i] && D[i] > r2 ? 255 : 0;
    }
    const traced = P.fromMask(out, W, H, o.tol == null ? 0.9 : o.tol, 6);
    if (!traced.subs.length) return null;
    const back = P.transform(traced, [1 / k, 0, 0, 1 / k, ox, oy]);
    back.subs.forEach((s) => { s.op = "add"; });
    return back;
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win, store } = E; if (!doc || !E.tools || !E.tools.shape) return;
    const P = win.PCPath, D = E.D, say = E.say || (() => {}), sep = E.ui.sep;
    const T = E.tools.shape;
    const KIND_NAMES = { rect: "Rectangle", rounded: "Rounded Rectangle", ellipse: "Ellipse", triangle: "Triangle", polygon: "Polygon", line: "Line" };
    const MODE_WORDS = { new: "drawn as a new shape", replace: "replaces the picked shape", add: "added to the picked shape", subtract: "subtracted from the picked shape", intersect: "intersected with the picked shape" };
    const isShapeL = (L) => !!(L && L.type === "shape" && L.shape);
    const shown = (L) => (D && D.shown ? D.shown(S.layers, L) : L.visible !== false);
    const editable = (L) => isShapeL(L) && shown(L) && !(L.locks && (L.locks.all || L.locks.px));
    const picked = () => { const ls = E.multi ? E.multi.list() : []; const out = (ls.length ? ls : [E.layer()]).filter(isShapeL); return out; };
    const pathOf = (L) => (L.shape.kind === "path" ? L.shape.path : P.fromShape(L.shape));
    const asPath = (L) => { if (L.shape.kind !== "path") L.shape = P.toPathShape(L.shape); return L.shape; };
    const done = (L) => { P.syncShape(L.shape); D.rasterize(L); };

    /* ---- the modes */
    function setMode(m, quiet) {
      S.shapeOp = m; store.set("pen.shapeop", m);
      if (!quiet) { const A = E.layer(); say(`${KIND_NAMES[S.shapeKind] || "Shape"}: the next one is ${MODE_WORDS[m]}` + (m !== "new" && !isShapeL(A) ? " - pick a shape layer first, or it is a new layer" : "")); }
      if (E.renderOptions) E.renderOptions();
    }
    function pickKind(kind, e) {
      const m = modeOf(e);
      S.shapeKind = kind; store.set("t.shape", kind);
      const A = E.layer();
      if (m === "replace" && isShapeL(A)) {
        E.setLayer(A, "shape kind", (L) => {
          const s = L.shape, k = kind === "rounded" ? "rect" : kind;
          s.kind = k; delete s._bb;
          if (kind === "rounded" && !s.radius) s.radius = 16;
          if (kind === "rect") { s.radius = 0; delete s.radii; }
          if (k === "line") s.strokeW = Math.max(1, s.strokeW || 4);
        });
      }
      setMode(m);
      if (S.tool !== "shape") E.setTool("shape");
    }
    E.shapeMode = { set: setMode, pickKind, modeOf };

    /* ---- Replace: the next shape drawn takes the picked shape layer's place (its look kept) */
    const upBase = T.up;
    T.up = function (e, fx, fy) {
      const A = E.layer();
      if (S.shapeOp !== "replace" || !isShapeL(A)) return upBase.call(this, e, fx, fy);
      const before = E.snapStruct(), n0 = S.undo.length;
      S.shapeOp = "new";
      try { upBase.call(this, e, fx, fy); } finally { S.shapeOp = "replace"; }
      const L = E.layer(); if (S.undo.length === n0 || !L || L === A || !isShapeL(L)) return;
      S.undo.pop();
      const keep = ["fill", "fillOn", "stroke", "strokeW", "strokeOn", "dash", "tfill"], look = {};
      for (const k of keep) if (A.shape[k] !== undefined) look[k] = A.shape[k];
      A.shape = Object.assign(JSON.parse(JSON.stringify(L.shape)), look);
      if (L.shape.kind === "line") A.shape.strokeW = Math.max(1, A.shape.strokeW || 4);
      if (A.shape.kind === "path") P.syncShape(A.shape);
      S.layers.splice(S.layers.indexOf(L), 1); S.active = S.layers.indexOf(A);
      D.rasterize(A);
      E.push({ t: "struct", before, after: E.snapStruct(), label: "replace shape" });
      E.refresh(); E.renderLayersPanel(); E.renderOptions();
    };

    /* ---- the bar: the shape buttons take the mode; ⇄ joins the Ops; ✂ Trim, ⇋ Mirror, ⧈ Offset */
    const optBase = T.options, bindBase = T.bindOptions;
    const offD = () => +store.get("so.off", 10) || 10, offKeep = () => store.get("so.offkeep", true) !== false;
    T.options = function () {
      let h = optBase.call(this);
      const rep = `<button class="ghost pnop${S.shapeOp === "replace" ? " on" : ""}" data-pnshop="replace" title="Replace the picked shape (Shift+click a shape)">⇄</button>`;
      h = h.replace(/(<button[^>]*data-pnshop="new"[^>]*>[^<]*<\/button>)/, "$1" + rep);
      return h + `<span class="sep"></span><button class="ghost" id="psoTrim" title="✂ Trim: click a piece of a shape's outline to cut it away, between the places other outlines cross it (Esc = back)">✂</button>`
        + `<button class="ghost" id="psoMirror" title="⇋ Mirror the picked shapes: flip them, or join a mirrored copy">⇋▾</button>`
        + `<button class="ghost" id="psoOff" title="⧈ Offset the picked shapes' outlines: grow (+) or shrink (−) by a distance">⧈</button>`;
    };
    T.bindOptions = function (o) {
      bindBase.call(this, o);
      o.querySelectorAll(".ptsk").forEach((b) => {
        b.title = `${KIND_NAMES[b.dataset.sk] || b.title} - click: a new one, Shift+click: the picked shape becomes it, Ctrl+click: add to it, Alt+click: subtract from it (U)`;
        b.onclick = (ev) => pickKind(b.dataset.sk, ev);
      });
      const q = (id) => o.querySelector("#" + id);
      if (q("psoTrim")) q("psoTrim").onclick = () => E.setTool("shapetrim");
      if (q("psoMirror")) q("psoMirror").onclick = (ev) => { const kr = (E.kx || E.stage).getBoundingClientRect(), r = ev.currentTarget.getBoundingClientRect(); E.ui.menuAt(MIRROR_ITEMS, r.left - kr.left, r.bottom - kr.top, 0); };
      if (q("psoOff")) q("psoOff").onclick = () => offsetDialog();
    };

    /* ---- ✂ the Trim tool */
    let hover = null;                  // {L, plan}
    const cache = new Map();
    function others(L) { return S.layers.filter((x) => x !== L && isShapeL(x) && shown(x)).map(pathOf); }
    function planAt(fx, fy) {
      const tol = 7 / (S.zoom || 1), cands = S.layers.filter(editable);
      const A = E.layer(); let best = null;
      for (const L of cands) {
        const p = pathOf(L), h = P.nearestSeg(p, fx, fy); if (!h || h.d > tol) continue;
        const score = h.d - (L === A ? tol / 2 : 0);
        if (!best || score < best.score) best = { L, score };
      }
      if (!best) return null;
      const key = best.L.id + "|" + fx.toFixed(1) + "," + fy.toFixed(1);
      if (cache.has(key)) return cache.get(key);
      const plan = trimPlan(pathOf(best.L), others(best.L), fx, fy, tol);
      const r = plan ? { L: best.L, plan } : null;
      if (cache.size > 200) cache.clear(); cache.set(key, r);
      return r;
    }
    E.tools.shapetrim = {
      id: "shapetrim", name: "Trim", cursor: "crosshair",
      options() { return `<span style="color:var(--pc-dim)">✂ Trim - the red piece of an outline (between the places other outlines cross it) is cut away when you click; what is left is joined end to end. Esc / </span><button class="ghost" id="psoTrimBack">▭ Shape tool</button>`; },
      bindOptions(o) { const b = o.querySelector("#psoTrimBack"); if (b) b.onclick = () => E.setTool("shape"); },
      hover(e, fx, fy) { hover = planAt(fx, fy); E.drawOverlay(); },
      down(e, fx, fy) {
        const h = planAt(fx, fy); hover = null;
        if (!h) { say("✂ nothing to trim there - point at a shape's outline"); return false; }
        trimLayer(h.L, fx, fy); return false;
      },
      key(e) { if (e.key === "Escape") { E.setTool("shape"); return true; } return false; },
      leave() { hover = null; cache.clear(); },
    };
    function trimLayer(L, fx, fy) {
      const tol = 7 / (S.zoom || 1), res = trimAt(pathOf(L), others(L), fx, fy, tol);
      if (!res) return;
      E.setLayer(L, "trim", (Ly) => {
        const s = asPath(Ly); s.path = { subs: res.subs };
        if (!res.subs.length) { s.path = P.empty(); }
        if (res.subs.some((q) => q.nofill) && !(s.strokeOn && s.strokeW > 0)) { s.strokeOn = true; s.strokeW = Math.max(2, s.strokeW || 0); s.stroke = s.fillOn !== false ? s.fill || s.stroke || "#000" : s.stroke || "#000"; }
        P.syncShape(s);
      });
      cache.clear();
      say(res.plan.whole ? "✂ trimmed: the whole outline (nothing crosses it)" : `✂ trimmed - ${res.subs.filter((q) => q.closed).length} closed, ${res.subs.filter((q) => !q.closed).length} open outline(s) left`);
    }
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "shapetrim" || !hover || !hover.plan) return;
      g.save(); g.setLineDash([]);
      g.lineWidth = 3 * px; g.strokeStyle = "#e5484d"; g.beginPath(); if (hover.plan.remove) P.trace(g, hover.plan.remove); g.stroke();
      g.fillStyle = "#e5484d";
      const sub = pathOf(hover.L).subs[hover.plan.s], C = sub ? P.segs(sub) : [];
      for (const u of hover.plan.cuts) { const k = Math.min(C.length - 1, Math.floor(u)), q = C[k] ? P.cubicAt(C[k], u - k) : null; if (q) { g.beginPath(); g.arc(q[0], q[1], 3.5 * px, 0, Math.PI * 2); g.fill(); } }
      g.restore();
    });

    /* ---- ⇋ mirror */
    function boxOfAll(ls) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const L of ls) { const b = P.bbox(pathOf(L)); if (!b) continue; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
      return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    function mirror(how) {
      const ls = picked(); if (!ls.length) return say("⇋ pick a shape layer (or several) to mirror");
      const b = boxOfAll(ls); if (!b) return;
      E.structOp(how.startsWith("flip") ? "flip shape" : "mirror copy", () => {
        for (const L of ls) {
          const s = asPath(L);
          if (how === "flipH") s.path = mirrorPath(s.path, "h", b.x + b.w / 2);
          else if (how === "flipV") s.path = mirrorPath(s.path, "v", b.y + b.h / 2);
          else s.path = mirrorCopy(s.path, how, b);
          done(L);
        }
      });
      say(how.startsWith("flip") ? `⇋ flipped ${ls.length} shape(s)` : `⇋ a mirrored copy joined into ${ls.length} shape(s)`);
    }

    /* ---- ⧈ offset */
    function offset(d, keep) {
      const ls = picked(); if (!ls.length) return say("⧈ pick a shape layer (or several) to offset");
      if (!d) return say("⧈ the distance is 0");
      const made = ls.map((L) => ({ L, p: offsetPath(pathOf(L), d) }));
      if (!made.some((m) => m.p)) return say(d < 0 ? "⧈ nothing is left - the shape is thinner than the offset" : "⧈ nothing to offset (no closed outline or line)");
      E.structOp("offset", () => {
        for (const { L, p } of made) {
          if (!p) continue;
          if (keep) {
            const N = E.makeLayer("Offset of " + L.name, S.w, S.h, "shape");
            N.shape = Object.assign(P.toPathShape(L.shape), { path: p });
            if (L.shape.kind === "line") Object.assign(N.shape, { fill: N.shape.stroke, fillOn: true, strokeOn: false });
            if (L.parent != null) N.parent = L.parent;
            P.syncShape(N.shape); D.rasterize(N);
            S.layers.splice(S.layers.indexOf(L) + 1, 0, N); S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(N);
          } else { const wasLine = L.shape.kind === "line", s = asPath(L); s.path = p; if (wasLine) Object.assign(s, { fill: s.stroke, fillOn: true, strokeOn: false }); done(L); }
        }
      });
      say(`⧈ offset ${d > 0 ? "+" : ""}${d} px - ${made.filter((m) => m.p).length} shape(s)` + (keep ? " (new layers above)" : ""));
    }
    function offsetDialog() {
      E.ui.dialog("Offset", `<div class="kxrow"><span>Distance (px)</span><input type="number" id="psoDD" step="1" value="${offD()}" style="width:80px"></div>
        <div class="kxrow" style="color:var(--pc-dim)">+ grows the outline, − shrinks it (round corners)</div>
        <div class="kxrow"><label><input type="checkbox" id="psoDK"${offKeep() ? " checked" : ""}> Keep the original (the offset is a new layer above)</label></div>`,
      (d) => { const v = +d.querySelector("#psoDD").value || 0, k = d.querySelector("#psoDK").checked; store.set("so.off", v || 10); store.set("so.offkeep", k); offset(v, k); }, { okLabel: "⧈ Offset" });
    }

    /* ---- the commands + the right-click menu (Shape / Trim tool only) */
    const add = E.ui.addCmd;
    for (const [m, label] of MODES) add("shape.mode." + m, label, "", () => setMode(m), { checked: () => (S.shapeOp || "new") === m });
    for (const k of Object.keys(KIND_NAMES)) add("shape.kind." + k, KIND_NAMES[k], "", () => { S.shapeKind = k; store.set("t.shape", k); if (S.tool !== "shape") E.setTool("shape"); else E.renderOptions(); }, { checked: () => S.shapeKind === k });
    add("shape.trim", "✂ Trim", "", () => E.setTool(S.tool === "shapetrim" ? "shape" : "shapetrim"), { checked: () => S.tool === "shapetrim" });
    add("shape.flipH", "⇋ Flip Horizontal", "", () => mirror("flipH"), { enabled: () => picked().length > 0 });
    add("shape.flipV", "⇵ Flip Vertical", "", () => mirror("flipV"), { enabled: () => picked().length > 0 });
    add("shape.mirRight", "Mirror Copy → Right", "", () => mirror("right"), { enabled: () => picked().length > 0 });
    add("shape.mirLeft", "Mirror Copy ← Left", "", () => mirror("left"), { enabled: () => picked().length > 0 });
    add("shape.mirDown", "Mirror Copy ↓ Down", "", () => mirror("down"), { enabled: () => picked().length > 0 });
    add("shape.mirUp", "Mirror Copy ↑ Up", "", () => mirror("up"), { enabled: () => picked().length > 0 });
    add("shape.offset", "⧈ Offset…", "", () => offsetDialog(), { enabled: () => picked().length > 0 });
    const MIRROR_ITEMS = ["shape.flipH", "shape.flipV", sep, "shape.mirRight", "shape.mirLeft", "shape.mirDown", "shape.mirUp"];
    E.shapeMenu = () => (S.tool === "shape" || S.tool === "shapetrim"
      ? MODES.map(([m]) => "shape.mode." + m).concat([sep, { label: "Shape", items: Object.keys(KIND_NAMES).map((k) => "shape.kind." + k) }, "shape.trim", { label: "⇋ Mirror", items: MIRROR_ITEMS }, "shape.offset"])
      : []);
    E.shapeOps = { mirror, offset, trimLayer, planAt, picked };
  }

  const PCShapeOps = { MODES, modeOf, sampled, cutsOf, sliceSub, joinOpen, trimPlan, trimAt, mirrorPath, mirrorLine, mirrorCopy, edt, offsetPath, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCShapeOps;
  if (root && root.document) root.PCShapeOps = PCShapeOps;
})(typeof window !== "undefined" ? window : globalThis);
