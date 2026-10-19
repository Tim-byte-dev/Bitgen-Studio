/* pcpath.js — THE IMAGE EDITOR'S PEN, PATHS, VECTOR MASKS AND CUSTOM SHAPES (2.421.0), window.PCPath.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 1 of the Photoshop list: "pen tool / paths /
 * vector masks / custom shapes / path operations". Photoshop's behaviour, our own code:
 *
 *   A PATH       {subs: [{closed, op, pts: [{x, y, ix, iy, ox, oy, smooth}]}]} - each sub-path (a "component") is a run
 *                of anchors joined by cubic Béziers; (ix, iy) = the handle INTO the anchor, (ox, oy) = the one OUT of it
 *                (both = the anchor: a corner with straight sides). op = how the component meets the ones before it:
 *                add (Combine Shapes) | subtract (Subtract Front Shape) | intersect (Intersect Shape Areas) |
 *                exclude (Exclude Overlapping Shapes) - read bottom to top, starting from nothing.
 *   WHERE        the WORK PATH (S.work - what the Pen draws when no path is picked), SAVED PATHS (S.paths, the Paths
 *                panel), a SHAPE LAYER's outline (L.shape.kind = "path", L.shape.path - every shape layer becomes one
 *                the moment an anchor is edited) and a layer's VECTOR MASK (L.vmask = {path, on, density, feather,
 *                linked}). All four undo with the layers (snapStruct carries S.paths / S.work, pcdoc's DEEP keys
 *                carry shape and vmask).
 *   THE TOOLS    P: Pen (click = corner, drag = smooth, click the first anchor = close, Alt-drag = a cusp; over the
 *                path it adds / deletes anchors), Freeform Pen (draw - fitted to Béziers; Curve Fit px), Add Anchor,
 *                Delete Anchor, Convert Point. A: Path Selection (whole components: move, Alt-drag copies, Delete,
 *                their op, Combine), Direct Selection (anchors and handles; marquee; arrows nudge; Delete). U: Custom
 *                Shape (heart, star, arrow, bubble ... + Define Custom Shape from any path). Pen / shapes draw a
 *                SHAPE layer or a PATH (the options bar), with the op for new components.
 *   THE PANEL    Paths (next to Layers / History): Work Path, saved paths, the active layer's Shape Path and Vector
 *                Mask; fill / stroke the path (brush, pencil, eraser), path -> selection (Ctrl-click), selection ->
 *                work path (tolerance), path -> vector mask / shape layer, new, duplicate, rename, delete, save,
 *                export / import SVG.
 *
 * Pure (Node, scripts/test-pspath.js): the Bézier maths (cubicAt, splitCubic, flatten, bbox, nearestSeg,
 * hitAnchor), the edits (insertAt, removeAnchor, setCorner, setSmooth, dragHandle, pullHandles, moveAnchors, moveSubs,
 * transform, fitBox, reverseSub), shapes (fromShape, custom, CUSTOM), fitting (simplify, fromPolygon), the pixel
 * side (raster - a scanline rasterizer with the four ops; contours - boundary tracing with holes; fromMask), SVG
 * (parseSvg, toSvg, svgDoc) and PSD knots (toPsd, fromPsd). The canvas side draws with a real 2D context.
 */
(function (root) {
  "use strict";

  /* ================================ the model ================================ */
  const OPS = ["add", "subtract", "intersect", "exclude"];
  const OP_NAMES = { add: "Combine Shapes", subtract: "Subtract Front Shape", intersect: "Intersect Shape Areas", exclude: "Exclude Overlapping Shapes" };
  const OP_ICON = { add: "⊕", subtract: "⊖", intersect: "⊗", exclude: "⊘" };
  const PSD_OP = { add: "combine", subtract: "subtract", intersect: "intersect", exclude: "exclude" };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const fin = (v, d) => (isFinite(+v) ? +v : d);
  function anchor(x, y, ix, iy, ox, oy, smooth) {
    return { x, y, ix: ix == null ? x : ix, iy: iy == null ? y : iy, ox: ox == null ? x : ox, oy: oy == null ? y : oy, smooth: !!smooth };
  }
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const empty = () => ({ subs: [] });
  const count = (p) => ((p && p.subs) || []).reduce((n, s) => n + s.pts.length, 0);
  const hasIn = (a) => a.ix !== a.x || a.iy !== a.y;
  const hasOut = (a) => a.ox !== a.x || a.oy !== a.y;
  /** a sane path from anything (a PSD, an old save, a typo) */
  function normalize(p) {
    const subs = ((p && p.subs) || []).map((s) => Object.assign({ closed: !!s.closed, op: OPS.includes(s.op) ? s.op : "add",
      pts: (s.pts || []).filter((a) => a && isFinite(+a.x) && isFinite(+a.y)).map((a) => { const o = anchor(+a.x, +a.y, fin(a.ix, +a.x), fin(a.iy, +a.y), fin(a.ox, +a.x), fin(a.oy, +a.y), a.smooth); if (a.sym && a.smooth) o.sym = true; return o; }) }, s.plain ? { plain: true } : {}))   // 2.425.0: + Corel's symmetrical nodes; 2.428.0: + plain (no arrowheads)
      .filter((s) => s.pts.length);
    return { subs };
  }

  /* ================================ Béziers ================================ */
  const segOf = (a, b) => [a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y];
  /** the segments of a sub-path: [x0, y0, c1x, c1y, c2x, c2y, x1, y1] - the closing one last */
  function segs(sub) {
    const n = sub.pts.length, out = [];
    for (let i = 0; i < n - 1; i++) out.push(segOf(sub.pts[i], sub.pts[i + 1]));
    if (sub.closed && n > 1) out.push(segOf(sub.pts[n - 1], sub.pts[0]));
    return out;
  }
  const isLine = (c) => c[2] === c[0] && c[3] === c[1] && c[4] === c[6] && c[5] === c[7];
  function cubicAt(c, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
    return [a * c[0] + b * c[2] + d * c[4] + e * c[6], a * c[1] + b * c[3] + d * c[5] + e * c[7]];
  }
  /** De Casteljau: the segment split at t -> [left, right] */
  function splitCubic(c, t) {
    const L = (a, b) => a + (b - a) * t;
    const x01 = L(c[0], c[2]), y01 = L(c[1], c[3]), x12 = L(c[2], c[4]), y12 = L(c[3], c[5]), x23 = L(c[4], c[6]), y23 = L(c[5], c[7]);
    const xa = L(x01, x12), ya = L(y01, y12), xb = L(x12, x23), yb = L(y12, y23), xm = L(xa, xb), ym = L(ya, yb);
    return [[c[0], c[1], x01, y01, xa, ya, xm, ym], [xm, ym, xb, yb, x23, y23, c[6], c[7]]];
  }
  function flattenSeg(c, tol, out) {
    if (isLine(c)) { out.push([c[6], c[7]]); return; }
    const len = Math.hypot(c[2] - c[0], c[3] - c[1]) + Math.hypot(c[4] - c[2], c[5] - c[3]) + Math.hypot(c[6] - c[4], c[7] - c[5]);
    const n = Math.max(2, Math.min(256, Math.ceil(Math.sqrt(len / Math.max(0.05, tol || 0.5)) * 1.5)));
    for (let k = 1; k <= n; k++) out.push(cubicAt(c, k / n));
  }
  /** a sub-path as a polyline (closed: the last point = the first) */
  function flatten(sub, tol) {
    if (!sub.pts.length) return [];
    const out = [[sub.pts[0].x, sub.pts[0].y]];
    for (const c of segs(sub)) flattenSeg(c, tol, out);
    return out;
  }
  function bbox(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of (p && p.subs) || []) for (const [x, y] of flatten(s, 0.2)) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return x0 === Infinity ? null : { x: r3(x0), y: r3(y0), w: r3(x1 - x0), h: r3(y1 - y0) };
  }
  function signedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  }
  /** the anchor (or a handle) under (x, y) within r: {s, i, part: "anchor" | "in" | "out"}; handles only where
   *  handlesFor(s, i) says (Photoshop shows them on the picked anchors) */
  function hitAnchor(p, x, y, r, handlesFor) {
    const subs = (p && p.subs) || [];
    let best = null, bd = r;
    const consider = (s, i, part, px, py) => { const d = Math.hypot(px - x, py - y); if (d <= bd) { bd = d; best = { s, i, part }; } };
    subs.forEach((sub, s) => sub.pts.forEach((a, i) => {
      if (handlesFor && handlesFor(s, i)) { if (hasIn(a)) consider(s, i, "in", a.ix, a.iy); if (hasOut(a)) consider(s, i, "out", a.ox, a.oy); }
    }));
    if (best) return best;
    subs.forEach((sub, s) => sub.pts.forEach((a, i) => consider(s, i, "anchor", a.x, a.y)));
    return best;
  }
  /** the nearest point ON the path: {s, i (the segment's first anchor), t, d, x, y} */
  function nearestSeg(p, x, y) {
    let best = null;
    ((p && p.subs) || []).forEach((sub, s) => segs(sub).forEach((c, i) => {
      const N = isLine(c) ? 8 : 40;
      let bt = 0, bd = Infinity;
      for (let k = 0; k <= N; k++) { const q = cubicAt(c, k / N), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; bt = k / N; } }
      let lo = Math.max(0, bt - 1 / N), hi = Math.min(1, bt + 1 / N);
      for (let it = 0; it < 30; it++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3, a1 = cubicAt(c, m1), a2 = cubicAt(c, m2);
        if (Math.hypot(a1[0] - x, a1[1] - y) < Math.hypot(a2[0] - x, a2[1] - y)) hi = m2; else lo = m1;
      }
      const t = (lo + hi) / 2, q = cubicAt(c, t), d = Math.hypot(q[0] - x, q[1] - y);
      if (!best || d < best.d) best = { s, i, t, d, x: q[0], y: q[1] };
    }));
    return best;
  }

  /* ================================ edits (each returns a NEW path) ================================ */
  /** a new anchor ON segment i of sub s at t - the curve keeps its shape */
  function insertAt(p, s, i, t) {
    const q = clone(p), sub = q.subs[s], n = sub.pts.length, j = (i + 1) % n, a = sub.pts[i], b = sub.pts[j];
    const [L, R] = splitCubic(segOf(a, b), Math.max(0.001, Math.min(0.999, t)));
    const curve = !isLine(segOf(a, b));
    if (curve) { a.ox = L[2]; a.oy = L[3]; b.ix = R[4]; b.iy = R[5]; }
    const m = curve ? anchor(L[6], L[7], L[4], L[5], R[2], R[3], true) : anchor(L[6], L[7]);
    sub.pts.splice(i + 1, 0, m);
    return q;
  }
  function removeAnchor(p, s, i) {
    const q = clone(p), sub = q.subs[s]; if (!sub) return q;
    sub.pts.splice(i, 1);
    if (!sub.pts.length) q.subs.splice(s, 1);
    else if (sub.pts.length < 2) sub.closed = false;
    return q;
  }
  function setCorner(p, s, i) {
    const q = clone(p), a = q.subs[s].pts[i];
    a.ix = a.ox = a.x; a.iy = a.oy = a.y; a.smooth = false; delete a.sym;
    return q;
  }
  /** smooth handles from the neighbours (the tangent through them, a third of each side's length) */
  function setSmooth(p, s, i) {
    const q = clone(p), sub = q.subs[s], n = sub.pts.length, a = sub.pts[i];
    const prev = i > 0 ? sub.pts[i - 1] : sub.closed ? sub.pts[n - 1] : null, next = i < n - 1 ? sub.pts[i + 1] : sub.closed ? sub.pts[0] : null;
    if (!prev && !next) return q;
    let tx = (next || a).x - (prev || a).x, ty = (next || a).y - (prev || a).y;
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const li = prev ? Math.hypot(a.x - prev.x, a.y - prev.y) / 3 : Math.hypot(next.x - a.x, next.y - a.y) / 3;
    const lo = next ? Math.hypot(next.x - a.x, next.y - a.y) / 3 : li;
    a.ix = a.x - tx * li; a.iy = a.y - ty * li; a.ox = a.x + tx * lo; a.oy = a.y + ty * lo; a.smooth = true; delete a.sym;
    return q;
  }
  /* ---- 2.465.0+ (2.466.0): ROUND CORNERS on any path - a joined / merged shape's corners too ---- */
  const cub = (sub, i) => { const n = sub.pts.length, a = sub.pts[i], b = sub.pts[(i + 1) % n]; return [[a.x, a.y], [a.ox, a.oy], [b.ix, b.iy], [b.x, b.y]]; };
  const bz = (c, u) => { const v = 1 - u; return [0, 1].map((k) => v * v * v * c[0][k] + 3 * v * v * u * c[1][k] + 3 * v * u * u * c[2][k] + u * u * u * c[3][k]); };
  const bzD = (c, u) => { const v = 1 - u; return [0, 1].map((k) => 3 * v * v * (c[1][k] - c[0][k]) + 6 * v * u * (c[2][k] - c[1][k]) + 3 * u * u * (c[3][k] - c[2][k])); };
  const nrm = (v) => { const l = Math.hypot(v[0], v[1]); return l > 1e-12 ? [v[0] / l, v[1] / l] : null; };
  /** the direction a segment runs at u (a zero derivative - a handle on its anchor - looks a little further in) */
  function dirAt(c, u) {
    let d = nrm(bzD(c, u)); if (d) return d;
    const e = u > 0.5 ? Math.max(0, u - 1e-3) : Math.min(1, u + 1e-3), p = bz(c, u), q = bz(c, e);
    d = nrm(u > 0.5 ? [p[0] - q[0], p[1] - q[1]] : [q[0] - p[0], q[1] - p[1]]);
    return d || nrm([c[3][0] - c[0][0], c[3][1] - c[0][1]]) || [1, 0];
  }
  /** de Casteljau: c -> [0..u], [u..1] */
  function splitC(c, u) {
    const L = (a, b) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const p01 = L(c[0], c[1]), p12 = L(c[1], c[2]), p23 = L(c[2], c[3]), a = L(p01, p12), b = L(p12, p23), m = L(a, b);
    return [[c[0], p01, a, m], [m, b, p23, c[3]]];
  }
  const subC = (c, u0, u1) => { const l = splitC(c, u1)[0]; return u0 > 0 ? splitC(l, u0 / u1)[1] : l; };
  /** the parameter at chord distance t from the end (fromEnd) or the start */
  function uAt(c, t, fromEnd) {
    const P = fromEnd ? c[3] : c[0]; let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, q = bz(c, fromEnd ? 1 - m : m), d = Math.hypot(q[0] - P[0], q[1] - P[1]); if (d < t) lo = m; else hi = m; }
    const m = (lo + hi) / 2; return fromEnd ? 1 - m : m;
  }
  const chord = (c) => Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1]);
  /** is anchor i of sub a CORNER (no handles, or handles not in one line) with two sides to round between */
  function isCorner(sub, i) {
    const n = sub.pts.length; if (n < 3 && !(sub.closed && n >= 2)) return false;
    if (!sub.closed && (i === 0 || i === n - 1)) return false;
    const dIn = dirAt(cub(sub, (i - 1 + n) % n), 1), dOut = dirAt(cub(sub, i), 0);
    return dIn[0] * dOut[1] - dIn[1] * dOut[0] !== 0 && Math.acos(Math.max(-1, Math.min(1, dIn[0] * dOut[0] + dIn[1] * dOut[1]))) > 0.02;
  }
  /** round corners with radius r: picks [[s, i]] (null = every corner of the path). Each rounded anchor becomes two
   *  (where the arc meets each side) joined by a circular arc (a cubic, handles 4/3 tan(φ/4) r); its sides are cut
   *  back (curves split - de Casteljau); a radius too big for a side is cut to fit (half the side). -> {path, count} */
  function roundCorners(p, picks, r) {
    const q = clone(p); let count = 0;
    if (!(r > 0)) return { path: q, count };
    q.subs = q.subs.map((sub, s) => {
      const n = sub.pts.length, segN = sub.closed ? n : n - 1;
      const want = new Set((picks ? picks.filter(([ss]) => ss === s).map(([, i]) => i) : sub.pts.map((_, i) => i)).filter((i) => isCorner(sub, i)));
      if (!want.size) return sub;
      const segs = []; for (let k = 0; k < segN; k++) segs.push({ c: cub(sub, k), u0: 0, u1: 1 });
      const info = new Map();
      // how far back each corner cuts its sides (t = r tan(φ/2), φ the turn), at most half of each side
      for (const i of want) {
        const a = segs[(i - 1 + segN) % segN], b = segs[i];
        const dIn = dirAt(a.c, 1), dOut = dirAt(b.c, 0), phi = Math.acos(Math.max(-1, Math.min(1, dIn[0] * dOut[0] + dIn[1] * dOut[1])));
        if (phi > Math.PI - 1e-3) continue;                              // folding straight back: no arc fits
        const t = Math.min(r * Math.tan(phi / 2), chord(a.c) / 2, chord(b.c) / 2);
        if (!(t > 1e-6)) continue;
        info.set(i, { t });
      }
      for (const [i, o] of info) { segs[(i - 1 + segN) % segN].u1 = uAt(segs[(i - 1 + segN) % segN].c, o.t, true); segs[i].u0 = uAt(segs[i].c, o.t, false); }
      const cut = segs.map((g) => subC(g.c, g.u0, g.u1));
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a0 = sub.pts[i], inS = i > 0 || sub.closed ? cut[(i - 1 + segN) % segN] : null, outS = i < segN ? cut[i] : null;
        if (!info.has(i)) {
          const A = Object.assign({}, a0);
          if (inS) { A.ix = inS[2][0]; A.iy = inS[2][1]; }
          if (outS) { A.ox = outS[1][0]; A.oy = outS[1][1]; }
          pts.push(A); continue;
        }
        const S = inS[3], Ee = outS[0], g0 = segs[(i - 1 + segN) % segN], g1 = segs[i];
        const dS = dirAt(g0.c, g0.u1), dE = dirAt(g1.c, g1.u0);
        const phi = Math.acos(Math.max(-1, Math.min(1, dS[0] * dE[0] + dS[1] * dE[1])));
        // the radius the cut actually allows (the chord S-E = 2 rr sin(φ/2))
        const rr = Math.hypot(Ee[0] - S[0], Ee[1] - S[1]) / (2 * Math.max(1e-9, Math.sin(phi / 2))), h = (4 / 3) * Math.tan(phi / 4) * rr;
        pts.push({ x: S[0], y: S[1], ix: inS[2][0], iy: inS[2][1], ox: S[0] + dS[0] * h, oy: S[1] + dS[1] * h, smooth: true });
        pts.push({ x: Ee[0], y: Ee[1], ix: Ee[0] - dE[0] * h, iy: Ee[1] - dE[1] * h, ox: outS[1][0], oy: outS[1][1], smooth: true });
        count++;
      }
      return Object.assign({}, sub, { pts });
    });
    return { path: q, count };
  }
  /** Convert Point's click: a curve anchor -> a corner, a corner -> smooth */
  const convert = (p, s, i) => { const a = p.subs[s].pts[i]; return hasIn(a) || hasOut(a) ? setCorner(p, s, i) : setSmooth(p, s, i); };
  /** move one handle; a SMOOTH anchor turns its other handle to stay opposite (its own length kept) unless `cusp` */
  function dragHandle(p, s, i, which, x, y, cusp) {
    const q = clone(p), a = q.subs[s].pts[i];
    if (which === "in") { a.ix = x; a.iy = y; } else { a.ox = x; a.oy = y; }
    if (cusp) { a.smooth = false; delete a.sym; }
    else if (a.smooth) {
      const ox = which === "in" ? "ox" : "ix", oy = which === "in" ? "oy" : "iy";
      const dx = a.x - x, dy = a.y - y, dl = Math.hypot(dx, dy), len = a.sym ? dl : Math.hypot(a[ox] - a.x, a[oy] - a.y);   // 2.425.0: a symmetrical node mirrors
      if (dl > 1e-9 && len > 1e-9) { a[ox] = a.x + dx / dl * len; a[oy] = a.y + dy / dl * len; }
    }
    return q;
  }
  /** the Pen's / Convert Point's drag on an anchor: symmetric handles, the OUT one under the pointer */
  function pullHandles(p, s, i, x, y, cuspOnlyOut) {
    const q = clone(p), a = q.subs[s].pts[i];
    a.ox = x; a.oy = y;
    if (!cuspOnlyOut) { a.ix = 2 * a.x - x; a.iy = 2 * a.y - y; a.smooth = true; } else a.smooth = false;
    return q;
  }
  function moveAnchors(p, list, dx, dy) {
    const q = clone(p);
    for (const [s, i] of list) { const a = q.subs[s] && q.subs[s].pts[i]; if (!a) continue; a.x += dx; a.y += dy; a.ix += dx; a.iy += dy; a.ox += dx; a.oy += dy; }
    return q;
  }
  function moveSubs(p, idx, dx, dy) {
    const list = []; for (const s of idx) if (p.subs[s]) p.subs[s].pts.forEach((_, i) => list.push([s, i]));
    return moveAnchors(p, list, dx, dy);
  }
  /** m = [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (a canvas transform) */
  function transform(p, m) {
    const q = clone(p), T = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    for (const s of q.subs) for (const a of s.pts) { [a.x, a.y] = T(a.x, a.y); [a.ix, a.iy] = T(a.ix, a.iy); [a.ox, a.oy] = T(a.ox, a.oy); }
    return q;
  }
  const translate = (p, dx, dy) => transform(p, [1, 0, 0, 1, dx, dy]);
  /** the path's box `from` mapped onto `to` (a zero side keeps its scale) */
  function fitBox(p, from, to) {
    const sx = from.w > 1e-9 ? to.w / from.w : 1, sy = from.h > 1e-9 ? to.h / from.h : 1;
    return transform(p, [sx, 0, 0, sy, to.x - from.x * sx, to.y - from.y * sy]);
  }
  function reverseSub(sub) {
    const s = clone(sub);
    s.pts = s.pts.reverse().map((a) => { const o = anchor(a.x, a.y, a.ox, a.oy, a.ix, a.iy, a.smooth); if (a.sym) o.sym = true; return o; });
    return s;
  }

  /* ================================ shapes ================================ */
  const K = 0.5522847498;
  function ellipseSub(cx, cy, rx, ry, op) {
    const kx = rx * K, ky = ry * K;
    return { closed: true, op: op || "add", pts: [
      anchor(cx, cy - ry, cx - kx, cy - ry, cx + kx, cy - ry, true), anchor(cx + rx, cy, cx + rx, cy - ky, cx + rx, cy + ky, true),
      anchor(cx, cy + ry, cx + kx, cy + ry, cx - kx, cy + ry, true), anchor(cx - rx, cy, cx - rx, cy + ky, cx - rx, cy - ky, true)] };
  }
  /** a shape layer's settings (pcdoc SHAPE_DEFAULT: rect / rounded / ellipse / triangle / polygon / line) as a path */
  function fromShape(s, op) {
    const x = Math.min(s.x, s.x + s.w), y = Math.min(s.y, s.y + s.h), w = Math.abs(s.w), h = Math.abs(s.h), o = op || "add";
    if (s.kind === "path") return clone(s.path) || empty();
    if (s.kind === "ellipse") return { subs: [ellipseSub(x + w / 2, y + h / 2, w / 2, h / 2, o)] };
    if (s.kind === "line") return { subs: [{ closed: false, op: o, pts: [anchor(s.x, s.y), anchor(s.x + s.w, s.y + s.h)] }] };
    if (s.kind === "polygon" || s.kind === "triangle") {
      const n = s.kind === "triangle" ? 3 : Math.max(3, Math.min(64, s.sides || 5)), pts = [];
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; pts.push(anchor(x + w / 2 + Math.cos(a) * w / 2, y + h / 2 + Math.sin(a) * h / 2)); }
      return { subs: [{ closed: true, op: o, pts }] };
    }
    // 2.439.0: each corner its own radius (radii [tl, tr, br, bl]), else the one radius
    const rr = (Array.isArray(s.radii) && s.radii.length === 4 ? s.radii : [s.radius, s.radius, s.radius, s.radius]).map((v) => Math.max(0, Math.min(+v || 0, w / 2, h / 2)));
    if (rr.some((v, i) => v !== rr[0])) {
      const [a, b2, c, d] = rr, pts = [];
      // a corner C rounded with r: from S (on the side coming in) to E (on the side going out), the handles toward C
      const corner = (cx, cy, r, sx, sy, ex, ey) => {
        if (r <= 0) { pts.push(anchor(cx, cy)); return; }
        pts.push(anchor(sx, sy, sx, sy, sx + (cx - sx) * K, sy + (cy - sy) * K));
        pts.push(anchor(ex, ey, ex + (cx - ex) * K, ey + (cy - ey) * K, ex, ey));
      };
      corner(x, y, a, x, y + a, x + a, y);                         // top left: from the left side to the top side
      corner(x + w, y, b2, x + w - b2, y, x + w, y + b2);          // top right
      corner(x + w, y + h, c, x + w, y + h - c, x + w - c, y + h); // bottom right
      corner(x, y + h, d, x + d, y + h, x, y + h - d);             // bottom left
      return { subs: [{ closed: true, op: o, pts }] };
    }
    const r = rr[0];
    if (r <= 0) return { subs: [{ closed: true, op: o, pts: [anchor(x, y), anchor(x + w, y), anchor(x + w, y + h), anchor(x, y + h)] }] };
    const k = r * K;
    return { subs: [{ closed: true, op: o, pts: [
      anchor(x + r, y, x + r - k, y, x + r, y), anchor(x + w - r, y, x + w - r, y, x + w - r + k, y),
      anchor(x + w, y + r, x + w, y + r - k, x + w, y + r), anchor(x + w, y + h - r, x + w, y + h - r, x + w, y + h - r + k),
      anchor(x + w - r, y + h, x + w - r + k, y + h, x + w - r, y + h), anchor(x + r, y + h, x + r, y + h, x + r - k, y + h),
      anchor(x, y + h - r, x, y + h - r + k, x, y + h - r), anchor(x, y + r, x, y + r, x, y + r - k)] }] };
  }
  /** a shape layer turned into a PATH shape (its look kept: a line becomes a stroked open path) */
  function toPathShape(s) {
    if (s.kind === "path") return clone(s);
    const o = Object.assign(clone(s), { kind: "path", path: fromShape(s) });
    if (s.kind === "line") Object.assign(o, { fillOn: false, strokeOn: true, stroke: s.strokeOn ? s.stroke : s.fill, strokeW: Math.max(1, s.strokeW || 4) });
    syncShape(o);
    return o;
  }
  /** a path shape's x / y / w / h = its box (and the box it was drawn at, _bb) */
  function syncShape(s) {
    const b = bbox(s.path) || { x: 0, y: 0, w: 0, h: 0 };
    s.x = b.x; s.y = b.y; s.w = b.w; s.h = b.h; s._bb = [b.x, b.y, b.w, b.h];
    return s;
  }
  /** anything that changed x / y / w / h (the move tool, crop, Image Size, Properties) moves / scales the path */
  function fitShape(s) {
    if (!s || s.kind !== "path" || !s.path) return s;
    if (!Array.isArray(s._bb)) return syncShape(s);
    const [x, y, w, h] = s._bb;
    if (Math.abs(x - s.x) > 1e-6 || Math.abs(y - s.y) > 1e-6 || Math.abs(w - s.w) > 1e-6 || Math.abs(h - s.h) > 1e-6) {
      s.path = fitBox(s.path, { x, y, w, h }, { x: s.x, y: s.y, w: s.w, h: s.h });
      s._bb = [s.x, s.y, s.w, s.h];
    }
    return s;
  }

  /* ================================ SVG ================================ */
  /** an SVG path's d -> a path (M L H V C S Q T Z, absolute and relative; an arc A becomes its chord) */
  function parseSvg(d, op) {
    const tok = String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const subs = []; let sub = null, cx = 0, cy = 0, sx = 0, sy = 0, cmd = "", lc = null, lq = null, i = 0;
    const num = () => +tok[i++];
    const more = () => i < tok.length && !/^[A-Za-z]$/.test(tok[i]);
    const start = (x, y) => { sub = { closed: false, op: op || "add", pts: [anchor(x, y)] }; subs.push(sub); sx = x; sy = y; };
    const lineTo = (x, y) => { if (!sub) start(cx, cy); sub.pts.push(anchor(x, y)); };
    const curveTo = (x1, y1, x2, y2, x, y) => { if (!sub) start(cx, cy); const a = sub.pts[sub.pts.length - 1]; a.ox = x1; a.oy = y1; if (hasIn(a)) a.smooth = Math.abs((a.x - a.ix) * (a.oy - a.y) - (a.y - a.iy) * (a.ox - a.x)) < 1e-3 * (1 + Math.hypot(a.ox - a.x, a.oy - a.y) * Math.hypot(a.x - a.ix, a.y - a.iy)); sub.pts.push(anchor(x, y, x2, y2)); };
    while (i < tok.length) {
      if (/^[A-Za-z]$/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      const ax = (v) => (rel ? cx + v : v), ay = (v) => (rel ? cy + v : v);
      if (C === "Z") { if (sub) { sub.closed = true; const f = sub.pts[0], l = sub.pts[sub.pts.length - 1]; if (sub.pts.length > 1 && Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; sub.pts.pop(); } cx = sx; cy = sy; sub = null; } lc = lq = null; continue; }
      if (!more()) { i++; continue; }
      if (C === "M") { const x = ax(num()), y = ay(num()); start(x, y); cx = x; cy = y; cmd = rel ? "l" : "L"; lc = lq = null; continue; }
      if (C === "L") { const x = ax(num()), y = ay(num()); lineTo(x, y); cx = x; cy = y; lc = lq = null; continue; }
      if (C === "H") { const x = rel ? cx + num() : num(); lineTo(x, cy); cx = x; lc = lq = null; continue; }
      if (C === "V") { const y = rel ? cy + num() : num(); lineTo(cx, y); cy = y; lc = lq = null; continue; }
      if (C === "C") { const x1 = ax(num()), y1 = ay(num()), x2 = ax(num()), y2 = ay(num()), x = ax(num()), y = ay(num()); curveTo(x1, y1, x2, y2, x, y); lc = [x2, y2]; lq = null; cx = x; cy = y; continue; }
      if (C === "S") { const x1 = lc ? 2 * cx - lc[0] : cx, y1 = lc ? 2 * cy - lc[1] : cy, x2 = ax(num()), y2 = ay(num()), x = ax(num()), y = ay(num()); curveTo(x1, y1, x2, y2, x, y); lc = [x2, y2]; lq = null; cx = x; cy = y; continue; }
      if (C === "Q" || C === "T") {
        let qx, qy;
        if (C === "Q") { qx = ax(num()); qy = ay(num()); } else { qx = lq ? 2 * cx - lq[0] : cx; qy = lq ? 2 * cy - lq[1] : cy; }
        const x = ax(num()), y = ay(num());
        curveTo(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y); lq = [qx, qy]; lc = null; cx = x; cy = y; continue;
      }
      if (C === "A") { num(); num(); num(); num(); num(); const x = ax(num()), y = ay(num()); lineTo(x, y); cx = x; cy = y; lc = lq = null; continue; }
      i++;
    }
    return { subs: subs.filter((s) => s.pts.length) };
  }
  const f2 = (v) => String(Math.round(v * 100) / 100);
  /** one sub-path as SVG d */
  function subSvg(sub) {
    if (!sub.pts.length) return "";
    let d = `M${f2(sub.pts[0].x)} ${f2(sub.pts[0].y)}`;
    for (const c of segs(sub)) d += isLine(c) ? ` L${f2(c[6])} ${f2(c[7])}` : ` C${f2(c[2])} ${f2(c[3])} ${f2(c[4])} ${f2(c[5])} ${f2(c[6])} ${f2(c[7])}`;
    if (sub.closed) { const n = sub.pts.length; if (isLine(segOf(sub.pts[n - 1], sub.pts[0]))) d = d.replace(/ L[-\d. ]+$/, ""); d += " Z"; }
    return d;
  }
  /** the whole path as one d (subtracted components wound the other way, so a nonzero fill makes their holes) */
  function toSvg(p) {
    return ((p && p.subs) || []).map((s) => {
      const area = signedArea(flatten(s, 1));
      const want = s.op === "subtract" ? -1 : 1;
      return subSvg(Math.sign(area || 1) === want ? s : reverseSub(s));
    }).filter(Boolean).join(" ");
  }
  /** a stand-alone SVG file of the path (intersect / exclude components drawn even-odd - the nearest SVG has) */
  function svgDoc(p, W, H, fill, stroke, strokeW) {
    const odd = ((p && p.subs) || []).some((s) => s.op === "intersect" || s.op === "exclude");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W)}" height="${Math.round(H)}" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}">\n`
      + `  <path d="${toSvg(p)}" fill="${fill || "#000000"}" fill-rule="${odd ? "evenodd" : "nonzero"}"${stroke && strokeW > 0 ? ` stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"` : ""}/>\n</svg>\n`;
  }
  /** the path(s) of an SVG file (every <path d>, <rect>, <circle>, <ellipse>, <polygon>; transforms are not read) */
  function fromSvgFile(text) {
    const out = empty(), T = String(text || "");
    const attr = (tag, k) => { const m = new RegExp(`\\s${k}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag); return m ? m[1] : null; };
    const re = /<(path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/gi; let m;
    while ((m = re.exec(T))) {
      const tag = m[0], k = m[1].toLowerCase(), n = (a) => +attr(tag, a) || 0;
      let q = null;
      if (k === "path") q = parseSvg(attr(tag, "d"));
      else if (k === "rect") q = fromShape({ kind: "rect", x: n("x"), y: n("y"), w: n("width"), h: n("height"), radius: n("rx") });
      else if (k === "circle") q = { subs: [ellipseSub(n("cx"), n("cy"), n("r"), n("r"))] };
      else if (k === "ellipse") q = { subs: [ellipseSub(n("cx"), n("cy"), n("rx"), n("ry"))] };
      else if (k === "line") q = { subs: [{ closed: false, op: "add", pts: [anchor(n("x1"), n("y1")), anchor(n("x2"), n("y2"))] }] };
      else { const v = (attr(tag, "points") || "").trim().split(/[\s,]+/).map(Number); const pts = []; for (let i = 0; i + 1 < v.length; i += 2) pts.push(anchor(v[i], v[i + 1])); q = { subs: [{ closed: k === "polygon", op: "add", pts }] }; }
      if (q) out.subs.push(...q.subs);
    }
    return normalize(out);
  }

  /* ================================ custom shapes ================================ */
  function starD(n, inner) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? 50 * inner : 50; pts.push(`${f2(50 + Math.cos(a) * r)} ${f2(52 + Math.sin(a) * r)}`); }
    return "M" + pts.join(" L") + " Z";
  }
  // each one drawn in a 100 x 100 box (ours - simple geometry; Photoshop's own shape library is not copied)
  const CUSTOM = [
    { id: "heart", name: "Heart", d: "M50 92 C20 70 0 52 0 30 C0 12 14 0 28 0 C40 0 47 7 50 15 C53 7 60 0 72 0 C86 0 100 12 100 30 C100 52 80 70 50 92 Z" },
    { id: "star5", name: "Star", d: starD(5, 0.382) },
    { id: "star8", name: "Burst", d: starD(12, 0.7) },
    { id: "arrow", name: "Arrow", d: "M0 35 L60 35 L60 10 L100 50 L60 90 L60 65 L0 65 Z" },
    { id: "chevron", name: "Chevron", d: "M0 0 L45 0 L100 50 L45 100 L0 100 L55 50 Z" },
    { id: "plus", name: "Plus", d: "M35 0 L65 0 L65 35 L100 35 L100 65 L65 65 L65 100 L35 100 L35 65 L0 65 L0 35 L35 35 Z" },
    { id: "cross", name: "Cross", d: "M20 0 L50 30 L80 0 L100 20 L70 50 L100 80 L80 100 L50 70 L20 100 L0 80 L30 50 L0 20 Z" },
    { id: "check", name: "Check", d: "M0 55 L15 40 L38 62 L85 10 L100 25 L38 92 Z" },
    { id: "bolt", name: "Lightning", d: "M60 0 L10 58 L45 58 L35 100 L90 38 L55 38 L70 0 Z" },
    { id: "bubble", name: "Speech Bubble", d: "M10 0 L90 0 C96 0 100 4 100 10 L100 60 C100 66 96 70 90 70 L40 70 L15 95 L22 70 L10 70 C4 70 0 66 0 60 L0 10 C0 4 4 0 10 0 Z" },
    { id: "drop", name: "Drop", d: "M50 0 C50 0 85 45 85 65 C85 85 69 100 50 100 C31 100 15 85 15 65 C15 45 50 0 50 0 Z" },
    { id: "moon", name: "Moon", d: "M60 0 C30 5 10 28 10 55 C10 82 32 100 58 100 C78 100 92 90 100 76 C92 80 84 82 75 82 C48 82 28 62 28 38 C28 22 40 6 60 0 Z" },
    { id: "house", name: "House", d: "M50 0 L100 45 L85 45 L85 100 L60 100 L60 65 L40 65 L40 100 L15 100 L15 45 L0 45 Z" },
    { id: "cloud", name: "Cloud", d: "M25 85 C10 85 0 74 0 61 C0 48 10 38 23 38 C25 22 38 10 54 10 C68 10 80 19 84 32 C94 34 100 43 100 55 C100 72 88 85 72 85 Z" },
    { id: "ring", name: "Ring", path: () => ({ subs: [ellipseSub(50, 50, 50, 50, "add"), ellipseSub(50, 50, 30, 30, "subtract")] }) },
    { id: "frame", name: "Frame", path: () => ({ subs: [fromShape({ kind: "rect", x: 0, y: 0, w: 100, h: 100 }).subs[0], Object.assign(fromShape({ kind: "rect", x: 14, y: 14, w: 72, h: 72 }).subs[0], { op: "subtract" })] }) },
  ];
  /** a custom shape (a CUSTOM id, or {d} / {path} of yours) fitted to x, y, w, h; the first component takes `op` */
  function custom(which, x, y, w, h, op) {
    const def = typeof which === "string" ? CUSTOM.find((c) => c.id === which) : which;
    if (!def) return empty();
    const base = def.path ? (typeof def.path === "function" ? def.path() : clone(def.path)) : parseSvg(def.d);
    const b = bbox(base) || { x: 0, y: 0, w: 100, h: 100 };
    const out = fitBox(base, b, { x, y, w, h });
    if (op && out.subs.length) out.subs[0].op = op;
    return out;
  }

  /* ================================ fitting ================================ */
  function dpOpen(pts, tol) {
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let md = -1, mi = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      for (let i = a + 1; i < b; i++) {
        const d = L > 1e-9 ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  /** Douglas-Peucker (closed: cut at the two farthest points first) */
  function simplify(pts, tol, closed) {
    if (!closed || pts.length < 4) return dpOpen(pts, tol);
    let far = 0, fd = -1;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
    const a = dpOpen(pts.slice(0, far + 1), tol), b = dpOpen(pts.slice(far).concat([pts[0]]), tol);
    return a.slice(0, -1).concat(b.slice(0, -1));
  }
  /** a polyline -> a sub-path: simplified, smooth anchors (Catmull-Rom tangents) where it bends gently, corners where
   *  it turns sharply (more than `cornerDeg`) */
  function fromPolygon(poly, closed, tol, cornerDeg) {
    let pts = (poly || []).filter((q) => q && isFinite(q[0]) && isFinite(q[1]));
    if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts = pts.slice(0, -1);
    pts = simplify(pts, Math.max(0.25, tol == null ? 2 : tol), closed);
    const n = pts.length, lim = (cornerDeg == null ? 55 : cornerDeg) * Math.PI / 180;
    const sub = { closed: !!closed && n > 2, op: "add", pts: pts.map(([x, y]) => anchor(x, y)) };
    if (n < 3) return sub;
    for (let i = 0; i < n; i++) {
      const hasP = closed || i > 0, hasN = closed || i < n - 1; if (!hasP || !hasN) continue;
      const P = pts[(i - 1 + n) % n], C = pts[i], N = pts[(i + 1) % n];
      const a1 = Math.atan2(C[1] - P[1], C[0] - P[0]), a2 = Math.atan2(N[1] - C[1], N[0] - C[0]);
      let turn = Math.abs(a2 - a1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn > lim) continue;
      let tx = N[0] - P[0], ty = N[1] - P[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const li = Math.hypot(C[0] - P[0], C[1] - P[1]) / 3, lo = Math.hypot(N[0] - C[0], N[1] - C[1]) / 3, a = sub.pts[i];
      a.ix = C[0] - tx * li; a.iy = C[1] - ty * li; a.ox = C[0] + tx * lo; a.oy = C[1] + ty * lo; a.smooth = true;
    }
    return sub;
  }

  /* ================================ pixels ================================ */
  /** the path's AREA as W x H coverage (0 / 255, sampled at pixel centres): each component filled nonzero, then
   *  combined with what is below by its op (joint = all of them in one nonzero fill, an SVG's way). Pure (Node) - the
   *  page uses a canvas for soft edges. */
  function raster(p, W, H, joint) {
    const acc = new Uint8Array(W * H), one = new Uint8Array(W * H);
    const all = ((p && p.subs) || []).filter((q) => q.pts.length >= 2);
    // joint: every component in ONE nonzero fill (what an SVG viewer does with a path's d), ops ignored
    for (const sub of joint ? [{ op: "add", group: all }] : all) {
      one.fill(0);
      const edges = [];
      for (const q of sub.group || [sub]) {
        const poly = flatten(q, 0.25);
        for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1], 1] : [b[0], b[1], a[0], a[1], -1]); }
      }
      for (let y = 0; y < H; y++) {
        const cy = y + 0.5, xs = [];
        for (const e of edges) if (cy >= e[1] && cy < e[3]) xs.push([e[0] + (cy - e[1]) / (e[3] - e[1]) * (e[2] - e[0]), e[4]]);
        if (!xs.length) continue;
        xs.sort((a, b) => a[0] - b[0]);
        let wind = 0;
        for (let k = 0; k < xs.length - 1; k++) {
          wind += xs[k][1];
          if (wind !== 0) { const x0 = Math.max(0, Math.ceil(xs[k][0] - 0.5)), x1 = Math.min(W - 1, Math.ceil(xs[k + 1][0] - 0.5) - 1); for (let x = x0; x <= x1; x++) one[y * W + x] = 255; }
        }
      }
      const op = sub.op || "add";
      for (let i = 0; i < acc.length; i++) {
        const a = acc[i], b = one[i];
        acc[i] = op === "add" ? (a | b) : op === "subtract" ? (b ? 0 : a) : op === "intersect" ? (a && b ? 255 : 0) : ((a ? 1 : 0) ^ (b ? 1 : 0)) ? 255 : 0;
      }
    }
    return acc;
  }
  /** the outlines of a W x H mask (>= thr = inside): pixel-edge loops, inside on the right, outer loops positive area,
   *  holes negative; diagonal neighbours stay separate (4-connected). -> [{pts: [[x, y] ...], area}] */
  function contours(mask, W, H, thr) {
    const T = thr == null ? 128 : thr, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] >= T;
    const VW = W + 1, out1 = new Int8Array(VW * (H + 1)).fill(-1), out2 = new Int8Array(VW * (H + 1)).fill(-1);
    const addE = (vx, vy, d) => { const v = vy * VW + vx; if (out1[v] < 0) out1[v] = d; else out2[v] = d; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) addE(x, y, 0);              // top: right
      if (!inside(x + 1, y)) addE(x + 1, y, 1);          // right side: down
      if (!inside(x, y + 1)) addE(x + 1, y + 1, 2);      // bottom: left
      if (!inside(x - 1, y)) addE(x, y + 1, 3);          // left side: up
    }
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], loops = [];
    for (let v0 = 0; v0 < out1.length; v0++) {
      while (out1[v0] >= 0 || out2[v0] >= 0) {
        let v = v0, d = out1[v0] >= 0 ? out1[v0] : out2[v0];
        const d0 = d, pts = [];
        const has = (w, c) => out1[w] === c || out2[w] === c;
        for (let guard = 0; guard < 4 * (W + 2) * (H + 2); guard++) {
          if (out1[v] === d) out1[v] = -1; else if (out2[v] === d) out2[v] = -1; else break;
          const vx = v % VW, vy = (v - vx) / VW; pts.push([vx, vy]);
          const nv = (vy + DY[d]) * VW + vx + DX[d];
          let nd = -1;
          for (const c of [(d + 1) % 4, d, (d + 3) % 4]) {          // a right turn first: diagonal pixels stay apart
            if (nv === v0 && c === d0) { nd = -2; break; }           // back at the start: the loop is closed
            if (has(nv, c)) { nd = c; break; }
          }
          if (nd < 0) break;
          v = nv; d = nd;
        }
        if (pts.length >= 4) loops.push({ pts, area: signedArea(pts) });
      }
    }
    return loops;
  }
  /** a mask -> a path (Make Work Path): each outline from its edge midpoints, simplified to `tol` px and fitted;
   *  outer outlines Combine, holes Subtract, islands in holes Combine again - in nesting order */
  function fromMask(mask, W, H, tol, minArea) {
    const loops = contours(mask, W, H, 128).filter((l) => Math.abs(l.area) >= (minArea == null ? 4 : minArea));
    // the nesting depth of each loop: a ray from the middle of one of its vertical edges, crossing the others' vertical edges
    const vEdges = loops.map((l) => { const e = []; for (let i = 0; i < l.pts.length; i++) { const a = l.pts[i], b = l.pts[(i + 1) % l.pts.length]; if (a[0] === b[0]) e.push([a[0], Math.min(a[1], b[1])]); } return e; });
    const depth = loops.map((l, i) => {
      const e0 = vEdges[i][0]; if (!e0) return 0;
      const px = e0[0], py = e0[1] + 0.5;
      let d = 0;
      loops.forEach((_, j) => { if (j === i) return; let c = 0; for (const [x, y] of vEdges[j]) if (x > px && py > y && py < y + 1) c++; if (c % 2) d++; });
      return d;
    });
    const order = loops.map((_, i) => i).sort((a, b) => depth[a] - depth[b]);
    const subs = [];
    for (const i of order) {
      const L = loops[i].pts, mids = L.map((a, k) => { const b = L[(k + 1) % L.length]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
      const sub = fromPolygon(mids, true, tol == null ? 2 : tol, 50);
      if (sub.pts.length < 3) continue;
      sub.op = depth[i] % 2 ? "subtract" : "add";
      subs.push(sub);
    }
    return { subs };
  }

  /* ================================ PSD knots ================================ */
  /** -> ag-psd's vectorMask {paths: [{open, operation, knots: [{linked, points: [inX, inY, x, y, outX, outY]}]}]} */
  function toPsd(p) {
    return { paths: ((p && p.subs) || []).filter((s) => s.pts.length).map((s) => ({ open: !s.closed, operation: PSD_OP[s.op] || "combine", fillRule: "non-zero",
      knots: s.pts.map((a) => ({ linked: !!a.smooth, points: [a.ix, a.iy, a.x, a.y, a.ox, a.oy] })) })) };
  }
  function fromPsd(vm, W, H) {
    const back = { combine: "add", subtract: "subtract", intersect: "intersect", exclude: "exclude", xor: "exclude" };
    const subs = ((vm && vm.paths) || []).filter((q) => q && (q.knots || []).length).map((q) => ({ closed: !q.open, op: back[q.operation] || "add",
      pts: q.knots.map((k) => { const v = k.points || []; return anchor(v[2], v[3], v[0], v[1], v[4], v[5], k.linked); }) }));
    if (vm && vm.fillStartsWithAllPixels && W && H) subs.unshift(fromShape({ kind: "rect", x: 0, y: 0, w: W, h: H }).subs[0]);
    return normalize({ subs });
  }

  /* ================================ the canvas side ================================ */
  /** a sub-path into a 2D context's current path (or any {moveTo, bezierCurveTo, lineTo, closePath}) */
  function trace(g, sub) {
    if (!sub.pts.length) return;
    g.moveTo(sub.pts[0].x, sub.pts[0].y);
    for (const c of segs(sub)) { if (isLine(c)) g.lineTo(c[6], c[7]); else g.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); }
    if (sub.closed) g.closePath();
  }
  function traceAll(g, p) { g.beginPath(); for (const s of (p && p.subs) || []) trace(g, s); }
  const simple = (p) => ((p && p.subs) || []).every((s, i) => s.op === "add" || (i === 0 && s.op !== "subtract" && s.op !== "intersect"));
  const mk = (c, W, H) => { const d = c && c.ownerDocument; if (d) { const n = d.createElement("canvas"); n.width = W; n.height = H; return n; } return new root.OffscreenCanvas(W, H); };
  /** fill the path's AREA (its ops) on g with `style` */
  function fillArea(g, p, style) {
    const subs = ((p && p.subs) || []).filter((s) => s.pts.length > 1);
    if (!subs.length) return;
    if (simple(p)) { g.save(); g.beginPath(); for (const s of subs) trace(g, s); g.fillStyle = style; g.fill("nonzero"); g.restore(); return; }
    const W = g.canvas.width, H = g.canvas.height, t = mk(g.canvas, W, H), tg = t.getContext("2d");
    if (g.getTransform) tg.setTransform(g.getTransform());
    tg.fillStyle = "#000";
    subs.forEach((s, i) => {
      const op = i === 0 && s.op !== "subtract" && s.op !== "intersect" ? "add" : s.op;
      tg.globalCompositeOperation = op === "subtract" ? "destination-out" : op === "intersect" ? "destination-in" : op === "exclude" ? "xor" : "source-over";
      tg.beginPath(); trace(tg, s); tg.fill("nonzero");
    });
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = style; tg.fillRect(0, 0, W, H);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(t, 0, 0); g.restore();
  }
  /** the area as a W x H coverage mask (0 - 255, soft edges) */
  function areaMask(p, W, H, likeCanvas) {
    const c = mk(likeCanvas, W, H), g = c.getContext("2d");
    fillArea(g, p, "#000");
    const d = g.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
    return m;
  }
  const outlineCache = new Map();
  /** the outline of the COMBINED area (a stroke follows the result of the ops, like Photoshop's) */
  function outline(p, W, H, likeCanvas) {
    if (simple(p)) return p;
    const key = W + "x" + H + JSON.stringify(p.subs);
    if (outlineCache.has(key)) return outlineCache.get(key);
    const o = fromMask(areaMask(p, W, H, likeCanvas), W, H, 0.6, 1);
    if (outlineCache.size > 24) outlineCache.clear();
    outlineCache.set(key, o);
    return o;
  }
  /** a PATH shape layer (pcdoc.drawShape hands it here): fill (the ops) + stroke (the result's outline; open
   *  components stroked as they are) */
  function drawPathShape(g, s) {
    if (s.line && root.PCBez && root.PCBez.drawLine) return root.PCBez.drawLine(g, s);   // 2.425.0: a VECTOR LINE (pcbezier.js: the outline pen, arrowheads)
    const p = s.path; if (!p || !p.subs || !p.subs.length) return;
    if (s.fillOn !== false) fillArea(g, p, s.fill || "#000");
    const sw = s.strokeOn ? s.strokeW || 0 : 0;
    if (sw > 0) {
      g.save(); g.lineWidth = sw; g.strokeStyle = s.stroke || "#000"; g.lineJoin = "round"; g.lineCap = "round";
      if (s.dash && g.setLineDash) g.setLineDash([sw * 3, sw * 2]);
      const closed = { subs: p.subs.filter((q) => q.closed) }, open = p.subs.filter((q) => !q.closed);
      g.beginPath();
      for (const q of (closed.subs.length ? outline(closed, g.canvas.width, g.canvas.height, g.canvas).subs : [])) trace(g, q);
      for (const q of open) trace(g, q);
      g.stroke(); g.restore();
    }
  }
  const vmCache = new WeakMap();
  /** a layer's VECTOR MASK as an alpha canvas (white = shown): the area, density (how much the outside hides), feather */
  function vmaskAlpha(L, W, H, newCanvas) {
    const V = L.vmask; if (!V || V.on === false || !V.path) return null;
    const dens = V.density == null ? 1 : V.density, fe = V.feather || 0;
    const key = `${W}x${H}|${dens}|${fe}|${V.invert ? 1 : 0}|` + JSON.stringify(V.path.subs);
    const hit = vmCache.get(L); if (hit && hit.key === key) return hit.c;
    const c = newCanvas(W, H), g = c.getContext("2d");
    if (!V.invert) {
      if (dens < 1) { g.fillStyle = `rgba(255,255,255,${1 - dens})`; g.fillRect(0, 0, W, H); }
      fillArea(g, V.path, "#fff");
    } else {
      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
      const t = newCanvas(W, H), tg = t.getContext("2d"); fillArea(tg, V.path, `rgba(0,0,0,${dens})`);
      g.globalCompositeOperation = "destination-out"; g.drawImage(t, 0, 0); g.globalCompositeOperation = "source-over";
    }
    let out = c;
    if (fe > 0) { out = newCanvas(W, H); const og = out.getContext("2d"); og.filter = `blur(${fe}px)`; og.drawImage(c, 0, 0); og.filter = "none"; }
    vmCache.set(L, { key, c: out });
    return out;
  }

  const api = { OPS, OP_NAMES, OP_ICON, PSD_OP, CUSTOM, anchor, clone, empty, count, normalize, segs, isLine, cubicAt, splitCubic, flatten, bbox,
    signedArea, hitAnchor, nearestSeg, insertAt, removeAnchor, setCorner, setSmooth, convert, roundCorners, isCorner, splitC, dragHandle, pullHandles, moveAnchors, moveSubs,
    transform, translate, fitBox, reverseSub, ellipseSub, fromShape, toPathShape, syncShape, fitShape, parseSvg, subSvg, toSvg, svgDoc, fromSvgFile,
    custom, simplify, fromPolygon, raster, contours, fromMask, toPsd, fromPsd, trace, traceAll, fillArea, areaMask, outline, drawPathShape, vmaskAlpha };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCPath = api;
  api.install = null;     // the page part (tools, panel, menus) is added below when there is a page
})(typeof window !== "undefined" ? window : globalThis);
