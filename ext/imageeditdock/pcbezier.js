/* pcbezier.js — VECTOR LINES THE CORELDRAW WAY: THE MATHS (2.425.0), window.PCBez.
 *
 * Tim (verbatim): "continue with the photoshop gap closure, add a bezier line tool that can be a vector and converted to
 * a path and back to a vector. make the bezier line tool the same as coreldraw". The tools are pcvline.js; this file is
 * pure (Node: scripts/test-psbezier.js) apart from drawLine (a real 2D context).
 *
 *   A VECTOR LINE  a shape layer (pcdoc kind "path", pcpath.js's model) with an OUTLINE PEN: L.shape.line =
 *                  {style, dash, cap, join, miter, start, end, asize, behind, scaleWith, pos, spline?} on top of the
 *                  shape's stroke / strokeW / strokeOn / fill / fillOn. Open curves are never filled (Corel's way).
 *   NODES          pcpath anchors + Corel's three node types: cusp (smooth false), smooth (smooth, handles in line,
 *                  their own lengths), symmetrical (smooth + sym: handles in line AND the same length).
 *   THE EDITS      nodeType, toLine / toCurve (a segment), breakAt, joinEnds, extendToClose, extract, reduce,
 *                  bendSegment (drag a segment, Corel's Shape tool), length / subLength
 *   THE TOOLS'     bspline (B-Spline control points -> Béziers), threePoint (3-Point Curve), curvature (Photoshop's
 *   CURVES         Curvature Pen: a curve THROUGH the points, corners where asked), polyFromClicks
 *   PATH ALIGN     alignSubs / distributeSubs (Path Selection's align / distribute, to the picked ones or the canvas)
 *   THE OUTLINE    DASHES + dashOf, ARROWS + arrowHead (the head's outline at a line end + how much of the line it
 *                  hides), trimSub (a line end shortened under its head), endPose, svgLine / svgDoc (the line as SVG -
 *                  arrowheads as real outlines, the outline pen kept in data-bitgen-vline), drawLine.
 */
(function (root) {
  "use strict";
  const Q = (typeof module !== "undefined" && module.exports) ? require("./pcpath.js") : root.PCPath;
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /* ================================ the outline pen ================================ */
  const LINE_DEFAULT = { style: "solid", dash: "", cap: "round", join: "round", miter: 10, start: "none", end: "none", asize: 4, behind: false, scaleWith: false, pos: "center" };
  const STYLES = [["solid", "Solid"], ["dash", "Dashed"], ["dot", "Dotted"], ["dashdot", "Dash-dot"], ["dashdotdot", "Dash-dot-dot"], ["longdash", "Long dash"], ["custom", "Custom…"]];
  const DASHES = { solid: [], dash: [4, 2], dashdot: [4, 2, 1, 2], dashdotdot: [4, 2, 1, 2, 1, 2], longdash: [9, 3] };
  /** the dash pattern in px for a width (round / square caps grow each dash by the width: the gaps make room) */
  function dashOf(line, w) {
    const L = Object.assign({}, LINE_DEFAULT, line || {}), ww = Math.max(0.5, +w || 1), capped = L.cap !== "butt";
    let pat;
    if (L.style === "dot") pat = capped ? [0, 2] : [1, 1.5];
    else if (L.style === "custom") pat = String(L.dash || "").split(/[\s,]+/).map(Number).filter((v) => isFinite(v) && v >= 0).slice(0, 12);
    else pat = DASHES[L.style] || [];
    if (!pat.length || pat.every((v) => v === 0)) return [];
    if (pat.length % 2) pat = pat.concat(pat);
    return pat.map((v, i) => Math.max(0, (capped && L.style !== "dot" ? (i % 2 ? v + 1 : Math.max(0, v - 1)) : v) * ww));
  }
  const ARROWS = [["none", "None"], ["arrow", "Arrow"], ["triangle", "Triangle"], ["open", "Open arrow"], ["half", "Half arrow"], ["circle", "Circle"], ["square", "Square"], ["diamond", "Diamond"], ["bar", "Bar"]];
  /** an arrowhead's outline at a line end: tip (x, y), `ang` = the direction it points (out of the line), the line's
   *  width w, size = head length as a multiple of the width (at least w + 6 px). -> {polys (filled), lines (stroked at w),
   *  trim (how much of the line the head covers)} */
  function arrowHead(type, x, y, ang, w, size) {
    if (!type || type === "none") return { polys: [], lines: [], trim: 0 };
    const ww = Math.max(0.5, +w || 1), L = Math.max(ww * (+size || 4), ww + 6), H = L * 0.8, c = Math.cos(ang), s = Math.sin(ang);
    const T = (px, py) => [r3(x + px * c - py * s), r3(y + px * s + py * c)];
    const P = (pts) => pts.map(([a, b]) => T(a, b));
    if (type === "arrow") return { polys: [P([[0, 0], [-L, H / 2], [-L * 0.72, 0], [-L, -H / 2]])], lines: [], trim: L * 0.6 };
    if (type === "triangle") return { polys: [P([[0, 0], [-L, H / 2], [-L, -H / 2]])], lines: [], trim: L * 0.9 };
    if (type === "half") return { polys: [P([[0, 0], [-L, H / 2], [-L * 0.72, 0]])], lines: [], trim: L * 0.6 };
    if (type === "open") return { polys: [], lines: [P([[-L, H / 2], [0, 0], [-L, -H / 2]])], trim: ww * 0.5 };
    if (type === "circle") { const n = 24, pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([-L / 2 + Math.cos(a) * L / 2, Math.sin(a) * L / 2]); } return { polys: [P(pts)], lines: [], trim: L / 2 }; }
    if (type === "square") return { polys: [P([[0, -L / 2], [0, L / 2], [-L, L / 2], [-L, -L / 2]])], lines: [], trim: L / 2 };
    if (type === "diamond") return { polys: [P([[0, 0], [-L / 2, H / 2], [-L, 0], [-L / 2, -H / 2]])], lines: [], trim: L / 2 };
    if (type === "bar") return { polys: [P([[0, -H / 2], [0, H / 2], [-ww, H / 2], [-ww, -H / 2]])], lines: [], trim: 0 };
    return { polys: [], lines: [], trim: 0 };
  }

  /* ================================ lengths, ends, trimming ================================ */
  function cubicLen(c, n) {
    let len = 0, px = c[0], py = c[1];
    for (let i = 1; i <= (n || 32); i++) { const [x, y] = Q.cubicAt(c, i / (n || 32)); len += Math.hypot(x - px, y - py); px = x; py = y; }
    return len;
  }
  const subLength = (sub) => Q.segs(sub).reduce((a, c) => a + cubicLen(c), 0);
  const length = (p) => ((p && p.subs) || []).reduce((a, s) => a + subLength(s), 0);
  /** a cubic's t where the length FROM ITS START is `d` */
  function tAtLen(c, d) {
    const n = 64; let len = 0, px = c[0], py = c[1];
    for (let i = 1; i <= n; i++) {
      const [x, y] = Q.cubicAt(c, i / n), l = Math.hypot(x - px, y - py);
      if (len + l >= d) return (i - 1 + (l > 0 ? (d - len) / l : 0)) / n;
      len += l; px = x; py = y;
    }
    return 1;
  }
  /** where an open sub-path ends and which way it points (out of the line): which = "start" | "end" */
  function endPose(sub, which) {
    const pts = sub.pts, n = pts.length; if (n < 2) return null;
    if (which === "end") {
      const b = pts[n - 1], a = pts[n - 2];
      const from = (b.ix !== b.x || b.iy !== b.y) ? [b.ix, b.iy] : (a.ox !== a.x || a.oy !== a.y) ? [a.ox, a.oy] : [a.x, a.y];
      return { x: b.x, y: b.y, ang: Math.atan2(b.y - from[1], b.x - from[0]) };
    }
    const a = pts[0], b = pts[1];
    const from = (a.ox !== a.x || a.oy !== a.y) ? [a.ox, a.oy] : (b.ix !== b.x || b.iy !== b.y) ? [b.ix, b.iy] : [b.x, b.y];
    return { x: a.x, y: a.y, ang: Math.atan2(a.y - from[1], a.x - from[0]) };
  }
  /** an open sub-path with `d0` cut off its start and `d1` off its end (along the curve) - the line under arrowheads */
  function trimSub(sub, d0, d1) {
    let s = clone(sub);
    const cutEnd = (sb, d) => {
      while (d > 0 && sb.pts.length >= 2) {
        const n = sb.pts.length, a = sb.pts[n - 2], b = sb.pts[n - 1], c = [a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y], L = cubicLen(c);
        if (L <= d + 1e-9) { if (n === 2) { b.x = a.x; b.y = a.y; b.ix = a.x; b.iy = a.y; a.ox = a.x; a.oy = a.y; return sb; } sb.pts.pop(); sb.pts[sb.pts.length - 1].ox = sb.pts[sb.pts.length - 1].x; sb.pts[sb.pts.length - 1].oy = sb.pts[sb.pts.length - 1].y; d -= L; continue; }
        const [l] = Q.splitCubic(c, tAtLen(c, L - d));
        a.ox = l[2]; a.oy = l[3]; b.ix = l[4]; b.iy = l[5]; b.x = l[6]; b.y = l[7]; b.ox = b.x; b.oy = b.y;
        return sb;
      }
      return sb;
    };
    if (d1 > 0) s = cutEnd(s, d1);
    if (d0 > 0) { s = Q.reverseSub(s); s = cutEnd(s, d0); s = Q.reverseSub(s); }
    return s;
  }

  /* ================================ Corel's node edits ================================ */
  const nodeTypeOf = (a) => (!a.smooth ? "cusp" : a.sym ? "symmetrical" : "smooth");
  /** set a node's type: cusp (handles free), smooth (handles in line, own lengths), symmetrical (in line, same length) */
  function nodeType(p, s, i, type) {
    const q = clone(p), sub = q.subs[s], a = sub && sub.pts[i]; if (!a) return q;
    if (type === "cusp") { a.smooth = false; delete a.sym; return q; }
    const n = sub.pts.length, prev = i > 0 ? sub.pts[i - 1] : sub.closed ? sub.pts[n - 1] : null, next = i < n - 1 ? sub.pts[i + 1] : sub.closed ? sub.pts[0] : null;
    let li = Math.hypot(a.ix - a.x, a.iy - a.y), lo = Math.hypot(a.ox - a.x, a.oy - a.y);
    if (li < 1e-9 && lo < 1e-9) { const r = Q.setSmooth(q, s, i); const b = r.subs[s].pts[i]; if (type === "symmetrical") { b.sym = true; symmetrize(b); } return r; }
    // the tangent: through both handles (or the one there is / the neighbours)
    let tx, ty;
    if (li > 1e-9 && lo > 1e-9) { tx = (a.ox - a.x) / lo - (a.ix - a.x) / li; ty = (a.oy - a.y) / lo - (a.iy - a.y) / li; }
    else if (lo > 1e-9) { tx = a.ox - a.x; ty = a.oy - a.y; }
    else if (li > 1e-9) { tx = a.x - a.ix; ty = a.y - a.iy; }
    else { tx = (next || a).x - (prev || a).x; ty = (next || a).y - (prev || a).y; }
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    if (li < 1e-9) li = prev ? Math.hypot(a.x - prev.x, a.y - prev.y) / 3 : lo;
    if (lo < 1e-9) lo = next ? Math.hypot(next.x - a.x, next.y - a.y) / 3 : li;
    if (type === "symmetrical") li = lo = (li + lo) / 2;
    a.ix = a.x - tx * li; a.iy = a.y - ty * li; a.ox = a.x + tx * lo; a.oy = a.y + ty * lo; a.smooth = true;
    if (type === "symmetrical") a.sym = true; else delete a.sym;
    return q;
  }
  function symmetrize(a) { const lo = Math.hypot(a.ox - a.x, a.oy - a.y), li = Math.hypot(a.ix - a.x, a.iy - a.y), m = (li + lo) / 2; if (lo > 1e-9) { a.ox = a.x + (a.ox - a.x) / lo * m; a.oy = a.y + (a.oy - a.y) / lo * m; } if (li > 1e-9) { a.ix = a.x + (a.ix - a.x) / li * m; a.iy = a.y + (a.iy - a.y) / li * m; } }
  /** move one handle the Corel way: cusp = alone, smooth = the other turns (its length kept), symmetrical = mirrored */
  function moveHandle(p, s, i, which, x, y) {
    const q = clone(p), a = q.subs[s] && q.subs[s].pts[i]; if (!a) return q;
    const k = which === "in" ? ["ix", "iy", "ox", "oy"] : ["ox", "oy", "ix", "iy"];
    a[k[0]] = x; a[k[1]] = y;
    if (a.smooth) {
      const dx = a.x - x, dy = a.y - y, dl = Math.hypot(dx, dy);
      const len = a.sym ? dl : Math.hypot(a[k[2]] - a.x, a[k[3]] - a.y);
      if (dl > 1e-9) { a[k[2]] = a.x + dx / dl * len; a[k[3]] = a.y + dy / dl * len; }
    }
    return q;
  }
  /** the segment from node i to the next: a straight line (To Line) */
  function toLine(p, s, i) {
    const q = clone(p), sub = q.subs[s]; if (!sub) return q;
    const n = sub.pts.length, j = i + 1 < n ? i + 1 : sub.closed ? 0 : -1; if (j < 0) return q;
    const a = sub.pts[i], b = sub.pts[j];
    a.ox = a.x; a.oy = a.y; b.ix = b.x; b.iy = b.y; a.smooth = false; b.smooth = false; delete a.sym; delete b.sym;
    return q;
  }
  /** the segment from node i to the next: a curve (To Curve - handles at its thirds, still looking straight) */
  function toCurve(p, s, i) {
    const q = clone(p), sub = q.subs[s]; if (!sub) return q;
    const n = sub.pts.length, j = i + 1 < n ? i + 1 : sub.closed ? 0 : -1; if (j < 0) return q;
    const a = sub.pts[i], b = sub.pts[j];
    if (a.ox === a.x && a.oy === a.y) { a.ox = a.x + (b.x - a.x) / 3; a.oy = a.y + (b.y - a.y) / 3; }
    if (b.ix === b.x && b.iy === b.y) { b.ix = b.x + (a.x - b.x) / 3; b.iy = b.y + (a.y - b.y) / 3; }
    return q;
  }
  const isLineSeg = (sub, i) => { const n = sub.pts.length, j = i + 1 < n ? i + 1 : sub.closed ? 0 : -1; if (j < 0) return false; const a = sub.pts[i], b = sub.pts[j]; return a.ox === a.x && a.oy === a.y && b.ix === b.x && b.iy === b.y; };
  /** Break Curve at node i: a closed sub-path opens there (the node doubled); an open one splits in two */
  function breakAt(p, s, i) {
    const q = clone(p), sub = q.subs[s]; if (!sub || sub.pts.length < 2) return q;
    const n = sub.pts.length, a = sub.pts[i];
    if (sub.closed) {
      const pts = sub.pts.slice(i).concat(sub.pts.slice(0, i)), end = clone(a);
      pts[0] = Object.assign(clone(a), { ix: a.x, iy: a.y, smooth: false }); delete pts[0].sym;
      end.ox = end.x; end.oy = end.y; end.smooth = false; delete end.sym;
      pts.push(end);
      q.subs[s] = { closed: false, op: sub.op, pts };
      return q;
    }
    if (i <= 0 || i >= n - 1) return q;
    const first = sub.pts.slice(0, i + 1).map(clone), second = sub.pts.slice(i).map(clone);
    const f = first[first.length - 1]; f.ox = f.x; f.oy = f.y; f.smooth = false; delete f.sym;
    const g = second[0]; g.ix = g.x; g.iy = g.y; g.smooth = false; delete g.sym;
    q.subs.splice(s, 1, { closed: false, op: sub.op, pts: first }, { closed: false, op: "add", pts: second });
    return q;
  }
  const isEnd = (sub, i) => !sub.closed && (i === 0 || i === sub.pts.length - 1);
  /** Join Two Nodes: two open ends (of one sub-path = it closes; of two = they become one) meet at their middle */
  function joinEnds(p, A, B) {
    const q = clone(p), [s1, i1] = A, [s2, i2] = B, S1 = q.subs[s1], S2 = q.subs[s2];
    if (!S1 || !S2 || !isEnd(S1, i1) || !isEnd(S2, i2)) return null;
    if (s1 === s2) {
      if (i1 === i2 || S1.pts.length < 3) return null;
      const a = S1.pts[0], b = S1.pts[S1.pts.length - 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ib = [b.ix - b.x, b.iy - b.y];
      Object.assign(a, { ix: mx + ib[0], iy: my + ib[1], ox: mx + (a.ox - a.x), oy: my + (a.oy - a.y), x: mx, y: my });
      S1.pts.pop(); S1.closed = true;
      return q;
    }
    let a = i1 === 0 ? Q.reverseSub(S1) : S1;               // a: ends at the join
    let b = i2 === 0 ? S2 : Q.reverseSub(S2);               // b: starts at the join
    const ea = a.pts[a.pts.length - 1], sb = b.pts[0], mx = (ea.x + sb.x) / 2, my = (ea.y + sb.y) / 2;
    const m = { x: mx, y: my, ix: mx + (ea.ix - ea.x), iy: my + (ea.iy - ea.y), ox: mx + (sb.ox - sb.x), oy: my + (sb.oy - sb.y), smooth: false };
    const pts = a.pts.slice(0, -1).concat([m], b.pts.slice(1));
    const lo = Math.min(s1, s2), hi = Math.max(s1, s2);
    q.subs.splice(hi, 1); q.subs.splice(lo, 1, { closed: false, op: q.subs[lo] ? (s1 < s2 ? S1.op : S2.op) : "add", pts });
    return q;
  }
  /** Extend Curve to Close: a straight segment from the end back to the start (Auto-Close does it for every open one) */
  function extendToClose(p, s) {
    const q = clone(p), sub = q.subs[s]; if (!sub || sub.closed || sub.pts.length < 2) return q;
    const a = sub.pts[0], b = sub.pts[sub.pts.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6 && sub.pts.length > 2) { a.ix = b.ix; a.iy = b.iy; sub.pts.pop(); }
    else { b.ox = b.x; b.oy = b.y; a.ix = a.x; a.iy = a.y; }
    sub.closed = true;
    return q;
  }
  const autoClose = (p) => { let q = clone(p); q.subs.forEach((sb, s) => { if (!sb.closed && sb.pts.length >= 2) q = extendToClose(q, s); }); return q; };
  /** Extract Subpath: [the rest, the one taken out] */
  function extract(p, s) { const q = clone(p); const [one] = q.subs.splice(s, 1); return [q, { subs: one ? [Object.assign(one, { op: "add" })] : [] }]; }
  function reverse(p, s) { const q = clone(p); if (q.subs[s]) q.subs[s] = Q.reverseSub(q.subs[s]); return q; }
  /** Reduce Nodes: refitted with fewer nodes - `smooth` 0..100 (Corel's Curve Smoothness) -> the tolerance */
  function reduce(sub, smooth) {
    const tol = 0.25 + Math.max(0, Math.min(100, +smooth || 0)) / 100 * 6;
    const pts = Q.flatten(sub, 0.2).map((v) => (Array.isArray(v) ? v : [v.x, v.y]));
    if (sub.closed && pts.length > 2) { const a = pts[0], b = pts[pts.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) pts.pop(); }
    const out = Q.fromPolygon(pts, sub.closed, tol, 50);
    out.op = sub.op;
    return out.pts.length >= 2 && out.pts.length < sub.pts.length + (sub.closed ? 0 : 1) ? out : clone(sub);
  }
  /** the Shape tool's segment drag: the segment i -> i+1 bent so its point at t follows (dx, dy) (both handles move) */
  function bendSegment(p, s, i, t, dx, dy) {
    const q = toCurve(p, s, i), sub = q.subs[s], n = sub.pts.length, j = i + 1 < n ? i + 1 : 0, a = sub.pts[i], b = sub.pts[j];
    const tt = Math.max(0.05, Math.min(0.95, t)), w1 = 3 * (1 - tt) * (1 - tt) * tt, w2 = 3 * (1 - tt) * tt * tt;
    // the least move of the two handles that puts B(t) at B(t) + d: each moved along d, weighted
    const k = 1 / (w1 * w1 + w2 * w2);
    a.ox += dx * w1 * k; a.oy += dy * w1 * k; b.ix += dx * w2 * k; b.iy += dy * w2 * k;
    if (a.smooth) { const r = moveHandle(q, s, i, "out", a.ox, a.oy); q.subs[s].pts[i] = r.subs[s].pts[i]; }
    if (b.smooth) { const r = moveHandle(q, s, j, "in", b.ix, b.iy); q.subs[s].pts[j] = r.subs[s].pts[j]; }
    return q;
  }

  /* ================================ the curve tools' curves ================================ */
  const A = (x, y, ix, iy, ox, oy, sm) => Q.anchor(x, y, ix, iy, ox, oy, sm);
  /** B-Spline: control points [[x, y]...] -> a cubic Bézier sub-path (uniform cubic B-spline; open = clamped: it starts
   *  and ends ON the first / last control point, closed = periodic) */
  function bspline(ctrl, closed) {
    const P = (ctrl || []).map((c) => (Array.isArray(c) ? c : [c.x, c.y]));
    const n = P.length;
    if (n < 2) return { closed: false, op: "add", pts: P.map(([x, y]) => A(x, y)) };
    if (n === 2) return { closed: false, op: "add", pts: [A(P[0][0], P[0][1]), A(P[1][0], P[1][1])] };
    const seg = (p0, p1, p2, p3) => ({ s: [(p0[0] + 4 * p1[0] + p2[0]) / 6, (p0[1] + 4 * p1[1] + p2[1]) / 6], c1: [(2 * p1[0] + p2[0]) / 3, (2 * p1[1] + p2[1]) / 3], c2: [(p1[0] + 2 * p2[0]) / 3, (p1[1] + 2 * p2[1]) / 3], e: [(p1[0] + 4 * p2[0] + p3[0]) / 6, (p1[1] + 4 * p2[1] + p3[1]) / 6] });
    let Pe, segsN;
    if (closed) { Pe = P; segsN = n; }
    else { Pe = [P[0], P[0], ...P, P[n - 1], P[n - 1]]; segsN = Pe.length - 3; }
    const S = []; for (let k = 0; k < segsN; k++) S.push(seg(Pe[k % Pe.length], Pe[(k + 1) % Pe.length], Pe[(k + 2) % Pe.length], Pe[(k + 3) % Pe.length]));
    if (!closed) { while (S.length && Math.hypot(S[0].s[0] - S[0].e[0], S[0].s[1] - S[0].e[1]) < 1e-9) S.shift(); while (S.length && Math.hypot(S[S.length - 1].s[0] - S[S.length - 1].e[0], S[S.length - 1].s[1] - S[S.length - 1].e[1]) < 1e-9) S.pop(); }
    const pts = [];
    S.forEach((g, k) => {
      if (k === 0) pts.push(A(g.s[0], g.s[1], g.s[0], g.s[1], g.c1[0], g.c1[1], false));
      else { const a = pts[pts.length - 1]; a.ox = g.c1[0]; a.oy = g.c1[1]; a.smooth = true; }
      pts.push(A(g.e[0], g.e[1], g.c2[0], g.c2[1], g.e[0], g.e[1], false));
    });
    if (closed && pts.length > 1) { const last = pts.pop(); pts[0].ix = last.ix; pts[0].iy = last.iy; pts[0].smooth = true; }
    return { closed: !!closed, op: "add", pts: pts.map((a) => Object.assign(a, { x: r3(a.x), y: r3(a.y), ix: r3(a.ix), iy: r3(a.iy), ox: r3(a.ox), oy: r3(a.oy) })) };
  }
  /** 3-Point Curve: from a to b, bent so it passes through m (a parabola as a cubic) */
  function threePoint(a, b, m) {
    const qx = 2 * m[0] - (a[0] + b[0]) / 2, qy = 2 * m[1] - (a[1] + b[1]) / 2;
    return { closed: false, op: "add", pts: [A(a[0], a[1], a[0], a[1], a[0] + 2 / 3 * (qx - a[0]), a[1] + 2 / 3 * (qy - a[1])), A(b[0], b[1], b[0] + 2 / 3 * (qx - b[0]), b[1] + 2 / 3 * (qy - b[1]), b[0], b[1])] };
  }
  /** Photoshop's Curvature Pen: a smooth curve THROUGH the points (Catmull-Rom tangents, handle = a third of the
   *  neighbours' distance), {corner: true} points are corners; closed wraps round */
  function curvature(points, closed) {
    const P = (points || []).map((c) => (Array.isArray(c) ? { x: c[0], y: c[1], corner: !!c[2] } : c)), n = P.length;
    if (!n) return { closed: false, op: "add", pts: [] };
    const pts = P.map((p, i) => {
      const prev = i > 0 ? P[i - 1] : closed ? P[n - 1] : null, next = i < n - 1 ? P[i + 1] : closed ? P[0] : null;
      if (p.corner || !prev || !next) {
        // an end / corner: its handles point a third of the way to the neighbour along the curve's chord (kept straight for corners)
        if (p.corner) return A(p.x, p.y);
        const nb = prev || next, other = prev ? (i > 1 ? P[i - 2] : null) : (i < n - 2 ? P[i + 2] : null);
        if (!nb) return A(p.x, p.y);
        let tx = nb.x - p.x, ty = nb.y - p.y;
        if (other && !nb.corner) { tx = (nb.x - p.x) * 2 - (other.x - p.x) * 0.5; ty = (nb.y - p.y) * 2 - (other.y - p.y) * 0.5; }
        const tl = Math.hypot(tx, ty) || 1, d = Math.hypot(nb.x - p.x, nb.y - p.y) / 3;
        const hx = p.x + tx / tl * d, hy = p.y + ty / tl * d;
        return prev ? A(p.x, p.y, hx, hy, p.x, p.y) : A(p.x, p.y, p.x, p.y, hx, hy);
      }
      let tx = next.x - prev.x, ty = next.y - prev.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const li = Math.hypot(p.x - prev.x, p.y - prev.y) / 3, lo = Math.hypot(next.x - p.x, next.y - p.y) / 3;
      return A(p.x, p.y, p.x - tx * li, p.y - ty * li, p.x + tx * lo, p.y + ty * lo, true);
    });
    return { closed: !!closed && n > 2, op: "add", pts };
  }
  /** a straight-segment run (Polyline, 2-Point Line) */
  const polyFromClicks = (pts, closed) => ({ closed: !!closed, op: "add", pts: pts.map(([x, y]) => A(x, y)) });
  /** Ctrl's constrain angle (Corel: 15°) from (x0, y0) */
  function constrain(x0, y0, x, y, deg) {
    const st = (deg || 15) * Math.PI / 180, a = Math.round(Math.atan2(y - y0, x - x0) / st) * st, r = Math.hypot(x - x0, y - y0);
    return [x0 + Math.cos(a) * r, y0 + Math.sin(a) * r];
  }

  /* ================================ path alignment (Photoshop's Path Selection) ================================ */
  /** align the components idx: how = left | hcenter | right | top | vcenter | bottom, to the box `to` (their own when null) */
  function alignSubs(p, idx, how, to) {
    const q = clone(p), boxes = idx.map((k) => Q.bbox({ subs: [q.subs[k]] }));
    if (boxes.some((b) => !b)) return q;
    const all = to || boxes.reduce((u, b) => ({ x: Math.min(u.x, b.x), y: Math.min(u.y, b.y), r: Math.max(u.r, b.x + b.w), bt: Math.max(u.bt, b.y + b.h) }), { x: Infinity, y: Infinity, r: -Infinity, bt: -Infinity });
    const U = to ? { x: to.x, y: to.y, r: to.x + to.w, bt: to.y + to.h } : all;
    idx.forEach((k, j) => {
      const b = boxes[j]; let dx = 0, dy = 0;
      if (how === "left") dx = U.x - b.x; else if (how === "right") dx = U.r - (b.x + b.w); else if (how === "hcenter") dx = (U.x + U.r) / 2 - (b.x + b.w / 2);
      else if (how === "top") dy = U.y - b.y; else if (how === "bottom") dy = U.bt - (b.y + b.h); else if (how === "vcenter") dy = (U.y + U.bt) / 2 - (b.y + b.h / 2);
      const m = Q.translate({ subs: [q.subs[k]] }, dx, dy); q.subs[k] = m.subs[0];
    });
    return q;
  }
  /** distribute the components' centres evenly: how = h | v (3 or more; the outer two stay) */
  function distributeSubs(p, idx, how) {
    const q = clone(p); if (idx.length < 3) return q;
    const items = idx.map((k) => { const b = Q.bbox({ subs: [q.subs[k]] }); return { k, c: how === "h" ? b.x + b.w / 2 : b.y + b.h / 2 }; }).sort((a, b) => a.c - b.c);
    const c0 = items[0].c, c1 = items[items.length - 1].c, step = (c1 - c0) / (items.length - 1);
    items.forEach((it, j) => { const d = c0 + step * j - it.c; const m = Q.translate({ subs: [q.subs[it.k]] }, how === "h" ? d : 0, how === "v" ? d : 0); q.subs[it.k] = m.subs[0]; });
    return q;
  }

  /* ================================ the line as SVG ================================ */
  const escA = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const polyD = (pts, close) => pts.map(([x, y], i) => (i ? "L" : "M") + r3(x) + " " + r3(y)).join("") + (close ? "Z" : "");
  /** the parts of a vector line: {fillD (closed area), strokeD (the line, open ends trimmed under their heads), heads
   *  [{d, fill: true} | {d, fill: false}]} */
  function parts(s) {
    const p = s.path || { subs: [] }, L = Object.assign({}, LINE_DEFAULT, s.line || {}), w = s.strokeOn !== false ? +s.strokeW || 0 : 0;
    const closed = p.subs.filter((x) => x.closed), open = p.subs.filter((x) => !x.closed);
    const heads = [], lines = [];
    for (const sub of open) {
      let d0 = 0, d1 = 0;
      if (w > 0 && sub.pts.length >= 2 && !sub.plain) {
        for (const [which, type] of [["start", L.start], ["end", L.end]]) {
          if (!type || type === "none") continue;
          const e = endPose(sub, which); if (!e) continue;
          const h = arrowHead(type, e.x, e.y, e.ang, w, L.asize);
          for (const poly of h.polys) heads.push({ d: polyD(poly, true), fill: true, pts: poly });
          for (const ln of h.lines) heads.push({ d: polyD(ln, false), fill: false, pts: ln });
          if (which === "start") d0 = h.trim; else d1 = h.trim;
        }
      }
      lines.push(d0 || d1 ? trimSub(sub, d0, d1) : sub);
    }
    return { fill: { subs: closed }, closedStroke: { subs: closed }, open: lines, heads, w, L };
  }
  function svgLine(s) {
    const P = parts(s), L = P.L, w = P.w, out = [];
    const fillOn = s.fillOn !== false && P.fill.subs.length;
    const dash = dashOf(L, w);
    const strokeAttr = `fill="none" stroke="${escA(s.stroke || "#000")}" stroke-width="${r3(w)}" stroke-linecap="${L.cap}" stroke-linejoin="${L.join}" stroke-miterlimit="${L.miter}"${dash.length ? ` stroke-dasharray="${dash.map(r3).join(" ")}"` : ""}`;
    let defs = "", fillPaint = escA(s.fill || "#000");
    if (fillOn && s.fillGrad) {                                       // 2.429.0: a gradient fill
      const gr = s.fillGrad, id = "bg" + Math.abs(JSON.stringify(s.path).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);
      const stops = Array.isArray(gr.stops) && gr.stops.length > 1     // 2.434.0: the Gradient Editor's stops (+ their opacity)
        ? gr.stops.map((q) => `<stop offset="${r3(+q.t || 0)}" stop-color="${escA(q.c || "#000")}"${q.a != null && q.a < 1 ? ` stop-opacity="${r3(+q.a)}"` : ""}/>`).join("")
        : `<stop offset="0" stop-color="${escA(gr.c1 || s.fill || "#000")}"/><stop offset="1" stop-color="${escA(gr.c2 || "#fff")}"/>`;
      if (gr.type === "radial") defs = `<defs><radialGradient id="${id}">${stops}</radialGradient></defs>`;
      else { const a = (+gr.angle || 0) * Math.PI / 180; defs = `<defs><linearGradient id="${id}" x1="${r3(0.5 - Math.cos(a) / 2)}" y1="${r3(0.5 + Math.sin(a) / 2)}" x2="${r3(0.5 + Math.cos(a) / 2)}" y2="${r3(0.5 - Math.sin(a) / 2)}">${stops}</linearGradient></defs>`; }
      fillPaint = `url(#${id})`;
    }
    const fillEl = fillOn ? `${defs}<path d="${Q.toSvg(P.fill)}" fill="${fillPaint}" fill-rule="${L.evenodd ? "evenodd" : "nonzero"}"/>` : "";
    const strokeEls = w > 0 ? [P.closedStroke.subs.length ? `<path d="${Q.toSvg(P.closedStroke)}" ${strokeAttr}/>` : "", P.open.length ? `<path d="${Q.toSvg({ subs: P.open })}" ${strokeAttr}/>` : ""].join("") : "";
    const headEls = P.heads.map((h) => (h.fill ? `<path d="${h.d}" fill="${escA(s.stroke || "#000")}"/>` : `<path d="${h.d}" fill="none" stroke="${escA(s.stroke || "#000")}" stroke-width="${r3(w)}" stroke-linecap="round" stroke-linejoin="round"/>`)).join("");
    if (L.behind) out.push(strokeEls, fillEl); else out.push(fillEl, strokeEls);
    out.push(headEls);
    for (const lb of L.labels || []) if (lb && lb.text) out.push(`<text x="${r3(lb.x)}" y="${r3(lb.y)}" font-size="${r3(lb.size || 14)}" font-family="Arial, sans-serif" text-anchor="${lb.align === "left" ? "start" : lb.align === "right" ? "end" : "middle"}" fill="${escA(lb.color || s.stroke || "#000")}"${lb.angle ? ` transform="rotate(${r3(lb.angle * 180 / Math.PI)} ${r3(lb.x)} ${r3(lb.y)})"` : ""}>${escA(lb.text)}</text>`);
    const data = Object.assign({ path: s.path, stroke: s.stroke, strokeW: s.strokeW, strokeOn: s.strokeOn, fill: s.fill, fillOn: s.fillOn, line: L }, s.fillGrad ? { fillGrad: s.fillGrad } : {});
    return `<g data-bitgen-vline="${escA(JSON.stringify(data))}">${out.join("")}</g>`;
  }
  function svgDoc(shapes, W, H) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${(Array.isArray(shapes) ? shapes : [shapes]).map(svgLine).join("")}</svg>`;
  }
  /** vector lines kept in an SVG we wrote (data-bitgen-vline) -> their shape settings */
  function fromSvg(text) {
    const out = [], re = /data-bitgen-vline="([^"]*)"/g; let m;
    while ((m = re.exec(String(text || "")))) {
      try {
        const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
        if (j && j.path && Array.isArray(j.path.subs)) out.push(Object.assign({ kind: "path" }, j, { path: Q.normalize(j.path), line: Object.assign({}, LINE_DEFAULT, j.line || {}) }));
      } catch (e) { /* not ours */ }
    }
    return out;
  }

  /* ================================ drawing (a real 2D context) ================================ */
  function mk(g, W, H) {
    const c = g && g.canvas, d = c && c.ownerDocument;
    if (d) { const n = d.createElement("canvas"); n.width = W; n.height = H; return n; }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(W, H);
    return null;
  }
  function strokeStyle(g, s, L, w) {
    g.lineWidth = w; g.strokeStyle = s.stroke || "#000"; g.lineCap = L.cap; g.lineJoin = L.join; g.miterLimit = Math.max(1, +L.miter || 10);
    if (g.setLineDash) g.setLineDash(dashOf(L, w));
  }
  /** the fill's style: its colour, or a linear (angle °, 0 = left -> right) / radial gradient over the filled area's box */
  function fillStyleOf(g, s, area) {
    const gr = s.fillGrad; if (!gr || !g.createLinearGradient) return s.fill || "#000";
    const b = Q.bbox(area) || { x: 0, y: 0, w: 1, h: 1 }, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let G;
    if (gr.type === "radial") G = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, Math.hypot(b.w, b.h) / 2));
    else { const a = (+gr.angle || 0) * Math.PI / 180, r = Math.abs(b.w * Math.cos(a)) / 2 + Math.abs(b.h * Math.sin(a)) / 2; G = g.createLinearGradient(cx - Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * r, cy - Math.sin(a) * r); }
    if (Array.isArray(gr.stops) && gr.stops.length > 1) {              // 2.434.0
      for (const q of gr.stops) { const n = parseInt(String(q.c || "#000000").slice(1), 16) || 0; G.addColorStop(Math.max(0, Math.min(1, +q.t || 0)), `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${q.a == null ? 1 : q.a})`); }
    } else { G.addColorStop(0, gr.c1 || s.fill || "#000"); G.addColorStop(1, gr.c2 || "#fff"); }
    return G;
  }
  /** a vector line onto g: fill (closed parts), the outline (dashes, caps, joins, inside / centre / outside for closed
   *  parts, behind the fill or over it), arrowheads at the open ends */
  function drawLine(g, s) {
    const p = s.path; if (!p || !p.subs || !p.subs.length) return;
    const P = parts(s), L = P.L, w = P.w;
    const fill = () => {
      if (s.fillOn === false || !P.fill.subs.length) return;
      const style = fillStyleOf(g, s, P.fill);                              // 2.429.0: a gradient fill (Object Properties)
      if (L.evenodd) { g.save(); g.beginPath(); for (const q of P.fill.subs) Q.trace(g, q); g.fillStyle = style; g.fill("evenodd"); g.restore(); return; }   // 2.428.0: a complex star's holes
      Q.fillArea(g, P.fill, style);
    };
    // 2.428.0: a dimension's / callout's text (pcdraw.js) - {text, x, y, angle, size}
    const labels = () => {
      for (const lb of L.labels || []) {
        if (!lb || !lb.text) continue;
        g.save(); g.translate(lb.x, lb.y); g.rotate(lb.angle || 0);
        g.font = `${lb.weight || 400} ${Math.max(4, lb.size || 14)}px ${lb.font || "Arial, sans-serif"}`; g.textAlign = lb.align || "center"; g.textBaseline = lb.base || "bottom";
        g.fillStyle = lb.color || s.stroke || "#000"; g.fillText(String(lb.text), 0, 0); g.restore();
      }
    };
    const stroke = () => {
      if (w <= 0) return;
      if (P.closedStroke.subs.length) {
        if (L.pos === "inside" || L.pos === "outside") {
          const W = g.canvas.width, H = g.canvas.height, t = mk(g, W, H), tg = t && t.getContext("2d");
          if (tg) {
            strokeStyle(tg, s, L, w * 2); tg.beginPath(); for (const q of P.closedStroke.subs) Q.trace(tg, q); tg.stroke();
            tg.setLineDash([]); tg.globalCompositeOperation = L.pos === "inside" ? "destination-in" : "destination-out"; Q.fillArea(tg, P.closedStroke, "#000");
            g.drawImage(t, 0, 0);
          }
        } else { g.save(); strokeStyle(g, s, L, w); g.beginPath(); for (const q of P.closedStroke.subs) Q.trace(g, q); g.stroke(); g.restore(); }
      }
      if (P.open.length) { g.save(); strokeStyle(g, s, L, w); g.beginPath(); for (const q of P.open) Q.trace(g, q); g.stroke(); g.restore(); }
      if (P.heads.length) {
        g.save(); g.setLineDash && g.setLineDash([]); g.fillStyle = s.stroke || "#000"; g.strokeStyle = s.stroke || "#000"; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
        for (const h of P.heads) { g.beginPath(); h.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (h.fill) { g.closePath(); g.fill(); } else g.stroke(); }
        g.restore();
      }
    };
    g.save();
    if (L.behind) { stroke(); fill(); } else { fill(); stroke(); }
    labels();
    g.restore();
  }

  const api = { LINE_DEFAULT, STYLES, DASHES, ARROWS, dashOf, arrowHead, cubicLen, subLength, length, tAtLen, endPose, trimSub,
    nodeTypeOf, nodeType, moveHandle, symmetrize, toLine, toCurve, isLineSeg, breakAt, isEnd, joinEnds, extendToClose, autoClose, extract, reverse, reduce, bendSegment,
    bspline, threePoint, curvature, polyFromClicks, constrain, alignSubs, distributeSubs, parts, svgLine, svgDoc, fromSvg, drawLine };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCBez = api;
})(typeof window !== "undefined" ? window : globalThis);
