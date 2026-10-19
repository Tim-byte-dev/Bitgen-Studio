/* pcsketch.js — SKETCH LAYERS: a constrained 2D sketch like a CAD program's (2.462.0), window.PCSketch - the model,
 * the constraint solver, the profiles and the drawing. The editor side (tools, the 📐 Sketch tab) is pcsketchtools.js.
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - asked what a sketch layer is: "something like fusion 360 sketch".
 *
 * A sketch (L.sketch on a layer of type "sketch") holds
 *   pts   [{id, x, y}]                                   every point (line ends, centres, arc ends, lone points)
 *   ents  [{id, t: line | circle | arc | point, p1, p2, c, r, cons}]   line p1-p2; circle c + r; arc c from p1 to p2
 *                                                        (clockwise on screen, its radius = |c p1| = |c p2|); cons =
 *                                                        a CONSTRUCTION entity (dashed while editing, never drawn)
 *   cons  [{id, t, a, b, c, x, y, s}]                   the constraints (below)
 *   dims  [{id, t, refs, v, at, driven}]                the dimensions: DRIVING ones set the geometry, a driven one
 *                                                        (would over-constrain) only shows its value
 *   style {color, w, showDims, fill}                     how the layer draws (the edit marks are the editor's)
 *   origin {pt, h, v}                                    the fixed origin point and its two construction axes
 * Constraints (t): coincident (a, b points) · onLine (a point, b line) · onCircle (a point, b circle / arc) ·
 *   horizontal / vertical (a line - or a, b points) · parallel · perpendicular · collinear (a, b lines) · equal (two
 *   lines = lengths, two circles / arcs = radii) · tangent (a line + b circle / arc, or two circles / arcs; s = 1
 *   outside / -1 inside) · midpoint (a point, b line) · concentric (a, b circles / arcs) · fix (a point at x, y) ·
 *   symmetric (a, b points about the line c).
 * Dimensions (t): dist (two points, aligned) · hdist / vdist (two points, s = their order) · len (a line) · ptline (a
 *   point + a line) · radius / diameter (a circle / arc) · angle (two lines, degrees; s = the side).
 * The solver: Newton steps of least size (each step changes the geometry as little as it can) on the residuals; a
 *   dragged point is "heavy" (it moves only where the constraints let it). DOF: the Jacobian's rank -> the degrees of
 *   freedom left, and which points / radii are still free (an entity drawn black = fully constrained, blue = free).
 * Profiles: the closed regions the lines / arcs / circles make where they meet at their points (faces of the sketch's
 *   graph) -> pcpath paths (arcs as Béziers) for Profile -> Shape and the layer's fill.
 * Pure (Node: scripts/test-sketch.js).
 */
(function (root) {
  "use strict";
  const hyp = Math.hypot, TAU = Math.PI * 2;
  const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const CON_TYPES = ["coincident", "onLine", "onCircle", "horizontal", "vertical", "parallel", "perpendicular", "collinear", "equal", "tangent", "midpoint", "concentric", "fix", "symmetric", "rdiff"];
  const DIM_TYPES = ["dist", "hdist", "vdist", "len", "ptline", "radius", "diameter", "angle"];
  const ANG_K = 100;                                   // an angle residual in radians weighs like 100 px

  /* ================================ the model ================================ */
  function create(ox, oy, o) {
    const s = { v: 1, seq: 0, pts: [], ents: [], cons: [], dims: [], style: Object.assign({ color: "#000000", w: 2, showDims: false, fill: "" }, (o && o.style) || {}) };
    const p = addPoint(s, ox, oy), L = 4000;
    const a = addPoint(s, ox - L, oy), b = addPoint(s, ox + L, oy), c = addPoint(s, ox, oy - L), d = addPoint(s, ox, oy + L);
    const h = addEnt(s, { t: "line", p1: a, p2: b, cons: true, axis: true }), v = addEnt(s, { t: "line", p1: c, p2: d, cons: true, axis: true });
    for (const q of [p, a, b, c, d]) { const P = pt(s, q); addCon(s, { t: "fix", a: q, x: P.x, y: P.y }); }
    s.origin = { pt: p, h, v };
    return s;
  }
  const nid = (s, k) => k + (++s.seq);
  function addPoint(s, x, y) { const id = nid(s, "p"); s.pts.push({ id, x: +x, y: +y }); return id; }
  function addEnt(s, e) { const id = nid(s, "e"); s.ents.push(Object.assign({ id }, e)); return id; }
  function addCon(s, c) { const id = nid(s, "k"); s.cons.push(Object.assign({ id }, c)); return id; }
  function addDim(s, d) { const id = nid(s, "d"); s.dims.push(Object.assign({ id, at: [0, -20], driven: false }, d)); return id; }
  const pt = (s, id) => s.pts.find((p) => p.id === id) || null;
  const ent = (s, id) => s.ents.find((e) => e.id === id) || null;
  /** the points an entity uses */
  const ptsOf = (e) => (e.t === "line" ? [e.p1, e.p2] : e.t === "circle" ? [e.c] : e.t === "arc" ? [e.c, e.p1, e.p2] : e.t === "point" ? [e.p1] : e.t === "spline" ? e.pts.slice() : []);
  /** 2.463.0: a fit-point SPLINE (through its points, Catmull-Rom) as cubic Bézier pieces [[p0, c1, c2, p3]] */
  function splineBez(s, e) {
    const P = e.pts.map((id) => { const q = pt(s, id); return [q.x, q.y]; }), out = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
    }
    return out;
  }
  const bezAt = (b, t) => { const u = 1 - t; return [u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0], u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1]]; };
  /** a spline as a polyline (n steps a piece) */
  function splinePoly(s, e, n) { const out = []; const B = splineBez(s, e); B.forEach((b, i) => { for (let k = i ? 1 : 0; k <= (n || 16); k++) out.push(bezAt(b, k / (n || 16))); }); return out; }
  function spline(s, ids, cons) { const pts = ids.map((a) => (typeof a === "string" ? a : addPoint(s, a[0], a[1]))); return addEnt(s, { t: "spline", pts, cons: !!cons }); }
  const isOrigin = (s, id) => !!(s.origin && (id === s.origin.pt || id === s.origin.h || id === s.origin.v || (ent(s, s.origin.h) && ptsOf(ent(s, s.origin.h)).includes(id)) || (ent(s, s.origin.v) && ptsOf(ent(s, s.origin.v)).includes(id))));
  /** a line from (x1, y1) to (x2, y2) - an end on an existing point id uses it */
  function line(s, a, b, cons) { const p1 = typeof a === "string" ? a : addPoint(s, a[0], a[1]), p2 = typeof b === "string" ? b : addPoint(s, b[0], b[1]); return addEnt(s, { t: "line", p1, p2, cons: !!cons }); }
  function circle(s, c, r, cons) { const ci = typeof c === "string" ? c : addPoint(s, c[0], c[1]); return addEnt(s, { t: "circle", c: ci, r: Math.max(1e-3, +r), cons: !!cons }); }
  function arc(s, c, a, b, cons) { const ci = typeof c === "string" ? c : addPoint(s, c[0], c[1]), p1 = typeof a === "string" ? a : addPoint(s, a[0], a[1]), p2 = typeof b === "string" ? b : addPoint(s, b[0], b[1]); return addEnt(s, { t: "arc", c: ci, p1, p2, cons: !!cons }); }
  function point(s, a) { const p1 = typeof a === "string" ? a : addPoint(s, a[0], a[1]); return addEnt(s, { t: "point", p1 }); }
  /** the circle through three points: {x, y, r} | null (in a line) */
  function circle3(a, b, c) {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-9) return null;
    const A = a[0] * a[0] + a[1] * a[1], B = b[0] * b[0] + b[1] * b[1], C = c[0] * c[0] + c[1] * c[1];
    const x = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d, y = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
    return { x, y, r: hyp(a[0] - x, a[1] - y) };
  }
  /** an arc through three points (start, a point on it, end): its centre + the right direction (p1 -> p2 clockwise on screen) */
  function arc3(s, a, m, b, cons) {
    const C = circle3(a, m, b); if (!C) return null;
    const ang = (p) => Math.atan2(p[1] - C.y, p[0] - C.x), sweep = (x, y) => { let d = y - x; while (d < 0) d += TAU; return d; };
    const cw = sweep(ang(a), ang(m)) < sweep(ang(a), ang(b));          // m lies on the way from a to b (increasing angle)
    return cw ? arc(s, [C.x, C.y], a, b, cons) : arc(s, [C.x, C.y], b, a, cons);
  }
  /** a rectangle from two corners: 4 lines on 4 shared points, 2 horizontal + 2 vertical */
  function rect2(s, a, b, cons) {
    const P = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]].map((q) => addPoint(s, q[0], q[1]));
    const L = [0, 1, 2, 3].map((i) => line(s, P[i], P[(i + 1) % 4], cons));
    addCon(s, { t: "horizontal", a: L[0] }); addCon(s, { t: "vertical", a: L[1] }); addCon(s, { t: "horizontal", a: L[2] }); addCon(s, { t: "vertical", a: L[3] });
    return { pts: P, lines: L };
  }
  /** a rectangle from its centre + a corner: + two construction diagonals meeting at the centre (midpoint of each) */
  function rectC(s, c, b, cons) {
    const a = [2 * c[0] - b[0], 2 * c[1] - b[1]], r = rect2(s, a, b, cons);
    const cp = addPoint(s, c[0], c[1]), d1 = line(s, r.pts[0], r.pts[2], true), d2 = line(s, r.pts[1], r.pts[3], true);
    addEnt(s, { t: "point", p1: cp, cons: true });
    addCon(s, { t: "midpoint", a: cp, b: d1 }); addCon(s, { t: "midpoint", a: cp, b: d2 });
    return Object.assign(r, { centre: cp, diags: [d1, d2] });
  }
  /** remove entities (and the constraints / dimensions on them, and points nothing uses any more) */
  function remove(s, ids) {
    const gone = new Set(ids.filter((id) => !isOrigin(s, id)));
    s.ents = s.ents.filter((e) => !gone.has(e.id));
    const used = new Set(); for (const e of s.ents) ptsOf(e).forEach((p) => used.add(p)); if (s.origin) used.add(s.origin.pt);
    const ptsGone = new Set(s.pts.filter((p) => !used.has(p.id)).map((p) => p.id));
    s.pts = s.pts.filter((p) => !ptsGone.has(p.id));
    const dead = (id) => id != null && (gone.has(id) || ptsGone.has(id));
    s.cons = s.cons.filter((c) => !gone.has(c.id) && !dead(c.a) && !dead(c.b) && !dead(c.c));
    s.dims = s.dims.filter((d) => !gone.has(d.id) && !(d.refs || []).some(dead));
    return s;
  }
  /** move everything (the origin too) */
  function translate(s, dx, dy) {
    for (const p of s.pts) { p.x += dx; p.y += dy; }
    for (const c of s.cons) if (c.t === "fix") { c.x += dx; c.y += dy; }
    return s;
  }
  /** an affine map [a, b, c, d, e, f] (x' = a x + c y + e): points, fix places, radii by the scale */
  function transform(s, m) {
    const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1, ap = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    for (const p of s.pts) [p.x, p.y] = ap(p.x, p.y);
    for (const c of s.cons) if (c.t === "fix") [c.x, c.y] = ap(c.x, c.y);
    for (const e of s.ents) if (e.t === "circle") e.r *= k;
    for (const d of s.dims) if (/dist|len|ptline|radius|diameter/.test(d.t)) d.v *= k;
    return s;
  }

  /* ================================ the residuals ================================ */
  /** the variables: [x, y] of every point, r of every circle -> {index: Map(key -> i), vals: [...]} */
  function vars(s) {
    const idx = new Map(), vals = [];
    for (const p of s.pts) { idx.set(p.id + ".x", vals.length); vals.push(p.x); idx.set(p.id + ".y", vals.length); vals.push(p.y); }
    for (const e of s.ents) if (e.t === "circle") { idx.set(e.id + ".r", vals.length); vals.push(e.r); }
    return { idx, vals };
  }
  function writeBack(s, V, X) {
    for (const p of s.pts) { p.x = X[V.idx.get(p.id + ".x")]; p.y = X[V.idx.get(p.id + ".y")]; }
    for (const e of s.ents) if (e.t === "circle") e.r = Math.max(1e-3, X[V.idx.get(e.id + ".r")]);
  }
  /** the residual rows of the sketch: [{vars: [i...], f(X) -> number, who: constraint / dim id}] */
  function rows(s, V) {
    const I = (k) => V.idx.get(k), out = [];
    const P = (id) => [I(id + ".x"), I(id + ".y")];
    const E = (id) => ent(s, id);
    const add = (who, vs, f) => { if (vs.every((v) => v != null)) out.push({ who, vars: vs, f }); };
    const L = (id) => { const e = E(id); return e && e.t === "line" ? { a: P(e.p1), b: P(e.p2) } : null; };
    // a circle / arc: its centre + its radius (an arc's = |c p1|)
    const C = (id) => { const e = E(id); if (!e) return null; if (e.t === "circle") return { c: P(e.c), rv: [I(e.id + ".r")], r: (X) => X[I(e.id + ".r")] };
      if (e.t === "arc") { const c = P(e.c), p = P(e.p1); return { c, rv: p, r: (X) => hyp(X[p[0]] - X[c[0]], X[p[1]] - X[c[1]]) }; } return null; };
    const d = (X, a, b) => [X[b[0]] - X[a[0]], X[b[1]] - X[a[1]]];
    const len = (v) => hyp(v[0], v[1]) || 1e-12;
    // the arcs' own rule: both ends on the same circle
    for (const e of s.ents) if (e.t === "arc") { const c = P(e.c), a = P(e.p1), b = P(e.p2); add("arc:" + e.id, [...c, ...a, ...b], (X) => hyp(X[a[0]] - X[c[0]], X[a[1]] - X[c[1]]) - hyp(X[b[0]] - X[c[0]], X[b[1]] - X[c[1]])); }
    for (const k of s.cons) {
      const t = k.t;
      if (t === "coincident") { const a = P(k.a), b = P(k.b); add(k.id, [a[0], b[0]], (X) => X[a[0]] - X[b[0]]); add(k.id, [a[1], b[1]], (X) => X[a[1]] - X[b[1]]); }
      else if (t === "fix") { const a = P(k.a); add(k.id, [a[0]], (X) => X[a[0]] - k.x); add(k.id, [a[1]], (X) => X[a[1]] - k.y); }
      else if (t === "horizontal" || t === "vertical") {
        const l = k.b ? { a: P(k.a), b: P(k.b) } : L(k.a); if (!l) continue;
        const j = t === "horizontal" ? 1 : 0; add(k.id, [l.a[j], l.b[j]], (X) => X[l.b[j]] - X[l.a[j]]);
      } else if (t === "onLine" || t === "midpoint") {
        const p = P(k.a), l = L(k.b); if (!l) continue;
        if (t === "midpoint") { for (const j of [0, 1]) add(k.id, [p[j], l.a[j], l.b[j]], (X) => X[p[j]] - (X[l.a[j]] + X[l.b[j]]) / 2); }
        else add(k.id, [...p, ...l.a, ...l.b], (X) => { const u = d(X, l.a, l.b), w = d(X, l.a, p); return (u[0] * w[1] - u[1] * w[0]) / len(u); });
      } else if (t === "onCircle") {
        const p = P(k.a), c = C(k.b); if (!c) continue;
        add(k.id, [...p, ...c.c, ...c.rv], (X) => hyp(X[p[0]] - X[c.c[0]], X[p[1]] - X[c.c[1]]) - c.r(X));
      } else if (t === "parallel" || t === "perpendicular" || t === "collinear") {
        const a = L(k.a), b = L(k.b); if (!a || !b) continue;
        const vs = [...a.a, ...a.b, ...b.a, ...b.b];
        add(k.id, vs, (X) => { const u = d(X, a.a, a.b), w = d(X, b.a, b.b), lu = len(u), lw = len(w); const cr = (u[0] * w[1] - u[1] * w[0]) / (lu * lw), dt = (u[0] * w[0] + u[1] * w[1]) / (lu * lw);
          return ANG_K * (t === "perpendicular" ? dt : cr); });
        if (t === "collinear") add(k.id, vs, (X) => { const u = d(X, a.a, a.b), w = d(X, a.a, b.a); return (u[0] * w[1] - u[1] * w[0]) / len(u); });
      } else if (t === "equal") {
        const la = L(k.a), lb = L(k.b), ca = C(k.a), cb = C(k.b);
        if (la && lb) add(k.id, [...la.a, ...la.b, ...lb.a, ...lb.b], (X) => len(d(X, la.a, la.b)) - len(d(X, lb.a, lb.b)));
        else if (ca && cb) add(k.id, [...ca.c, ...ca.rv, ...cb.c, ...cb.rv], (X) => ca.r(X) - cb.r(X));
      } else if (t === "tangent") {
        const la = L(k.a), ca = C(k.a), lb = L(k.b), cb = C(k.b);
        const l = la || lb, c = la ? cb : lb ? ca : null;
        const le = la ? E(k.a) : lb ? E(k.b) : null, ce = la ? E(k.b) : lb ? E(k.a) : null;
        const shared = le && ce && ce.t === "arc" ? [le.p1, le.p2].find((q) => q === ce.p1 || q === ce.p2) : null;
        if (l && c && shared) {                               // 2.463.0: they share an end - the radius there is square to the line
          const q = P(shared); add(k.id, [...l.a, ...l.b, ...c.c, ...q], (X) => { const u = d(X, l.a, l.b), w = [X[q[0]] - X[c.c[0]], X[q[1]] - X[c.c[1]]]; return (u[0] * w[0] + u[1] * w[1]) / len(u); });
        } else if (l && c) { const sg = k.s === -1 ? -1 : 1; add(k.id, [...l.a, ...l.b, ...c.c, ...c.rv], (X) => { const u = d(X, l.a, l.b), w = d(X, l.a, c.c); return sg * (u[0] * w[1] - u[1] * w[0]) / len(u) - c.r(X); }); }
        else if (ca && cb && E(k.a).t === "arc" && E(k.b).t === "arc" && [E(k.a).p1, E(k.a).p2].some((q) => q === E(k.b).p1 || q === E(k.b).p2)) {
          const ea = E(k.a), eb = E(k.b), q = P([ea.p1, ea.p2].find((x) => x === eb.p1 || x === eb.p2));   // two arcs joined at an end: the centres and that end in a line
          add(k.id, [...ca.c, ...cb.c, ...q], (X) => { const u = [X[ca.c[0]] - X[q[0]], X[ca.c[1]] - X[q[1]]], w = [X[cb.c[0]] - X[q[0]], X[cb.c[1]] - X[q[1]]]; return (u[0] * w[1] - u[1] * w[0]) / (len(u) * len(w)) * ANG_K; });
        }
        else if (ca && cb) { const sg = k.s === -1 ? -1 : 1; add(k.id, [...ca.c, ...ca.rv, ...cb.c, ...cb.rv], (X) => { const dd = hyp(X[cb.c[0]] - X[ca.c[0]], X[cb.c[1]] - X[ca.c[1]]); return sg > 0 ? dd - (ca.r(X) + cb.r(X)) : dd - Math.abs(ca.r(X) - cb.r(X)); }); }
      } else if (t === "concentric") {
        const a = C(k.a), b = C(k.b); if (!a || !b) continue;
        for (const j of [0, 1]) add(k.id, [a.c[j], b.c[j]], (X) => X[a.c[j]] - X[b.c[j]]);
      } else if (t === "rdiff") {                         // 2.463.0: an offset circle / arc: r(a) - r(b) = x
        const a = C(k.a), b = C(k.b); if (!a || !b) continue;
        add(k.id, [...a.c, ...a.rv, ...b.c, ...b.rv], (X) => a.r(X) - b.r(X) - (+k.x || 0));
      } else if (t === "symmetric") {
        const a = P(k.a), b = P(k.b), l = L(k.c); if (!l) continue;
        const vs = [...a, ...b, ...l.a, ...l.b];
        add(k.id, vs, (X) => { const u = d(X, l.a, l.b), m = [(X[a[0]] + X[b[0]]) / 2 - X[l.a[0]], (X[a[1]] + X[b[1]]) / 2 - X[l.a[1]]]; return (u[0] * m[1] - u[1] * m[0]) / len(u); });
        add(k.id, vs, (X) => { const u = d(X, l.a, l.b), w = d(X, a, b); return (u[0] * w[0] + u[1] * w[1]) / len(u); });
      }
    }
    for (const m of s.dims) {
      if (m.driven) continue;
      const r = m.refs || [], v = +m.v;
      if (m.t === "dist") { const a = P(r[0]), b = P(r[1]); add(m.id, [...a, ...b], (X) => len(d(X, a, b)) - v); }
      else if (m.t === "hdist" || m.t === "vdist") { const a = P(r[0]), b = P(r[1]), j = m.t === "hdist" ? 0 : 1, sg = m.s === -1 ? -1 : 1; add(m.id, [a[j], b[j]], (X) => sg * (X[b[j]] - X[a[j]]) - v); }
      else if (m.t === "len") { const l = L(r[0]); if (l) add(m.id, [...l.a, ...l.b], (X) => len(d(X, l.a, l.b)) - v); }
      else if (m.t === "ptline") { const p = P(r[0]), l = L(r[1]), sg = m.s === -1 ? -1 : 1; if (l) add(m.id, [...p, ...l.a, ...l.b], (X) => { const u = d(X, l.a, l.b), w = d(X, l.a, p); return sg * (u[0] * w[1] - u[1] * w[0]) / len(u) - v; }); }
      else if (m.t === "radius" || m.t === "diameter") { const c = C(r[0]); if (c) add(m.id, [...c.c, ...c.rv], (X) => c.r(X) * (m.t === "diameter" ? 2 : 1) - v); }
      else if (m.t === "angle") {
        const a = L(r[0]), b = L(r[1]); if (!a || !b) continue;
        const sg = m.s === -1 ? -1 : 1;
        add(m.id, [...a.a, ...a.b, ...b.a, ...b.b], (X) => { const u = d(X, a.a, a.b), w = d(X, b.a, b.b); return ANG_K * wrapPi(Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]) - sg * v * Math.PI / 180); });
      }
    }
    return out;
  }

  /* ================================ the solver ================================ */
  /** the Jacobian rows (sparse: [{i, v}] per row) by central differences on each row's own variables */
  function jac(R, X) {
    return R.map((r) => {
      const out = [];
      for (const i of new Set(r.vars)) { const h = 1e-6 * Math.max(1, Math.abs(X[i])), x0 = X[i]; X[i] = x0 + h; const fp = r.f(X); X[i] = x0 - h; const fm = r.f(X); X[i] = x0; const g = (fp - fm) / (2 * h); if (Math.abs(g) > 1e-12) out.push({ i, v: g }); }
      return out;
    });
  }
  /** solve A y = b (A dense m x m, symmetric positive) by Gaussian elimination with pivoting; null when singular */
  function solveLin(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-14) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (!f) continue; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const y = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let t = M[r][n]; for (let k = r + 1; k < n; k++) t -= M[r][k] * y[k]; y[r] = t / M[r][r]; }
    return y;
  }
  /** the solve: X moved as little as it can (weights: a heavy variable moves less) until every residual is ~0.
   *  -> {ok, err, iters} (the sketch's points / radii written back when ok, or always with opts.always) */
  function solve(s, opts) {
    const o = opts || {}, V = vars(s), X = V.vals.slice(), R = rows(s, V);
    const W = X.map(() => 1);
    for (const [k, i] of V.idx) if (k.endsWith(".r")) W[i] = o.rW || 25;          // a circle keeps its size rather than its place
    for (const id of o.heavy || []) for (const k of [id + ".x", id + ".y", id + ".r"]) if (V.idx.has(k)) W[V.idx.get(k)] = o.heavyW || 1e4;
    const res = () => R.map((r) => r.f(X));
    const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    let F = res(), err = norm(F), it = 0;
    const tol = o.tol || 1e-7;
    while (err > tol && it < (o.maxIt || 80)) {
      it++;
      const J = jac(R, X), m = R.length;
      // A = J W^-1 J^T + mu I
      const A = Array.from({ length: m }, () => new Array(m).fill(0)), mu = 1e-10;
      const dense = J.map((row) => { const mp = new Map(); for (const { i, v } of row) mp.set(i, (mp.get(i) || 0) + v); return mp; });
      for (let a = 0; a < m; a++) for (let b = a; b < m; b++) { let t = 0; for (const [i, v] of dense[a]) { const w = dense[b].get(i); if (w) t += v * w / W[i]; } A[a][b] = A[b][a] = t; }
      for (let a = 0; a < m; a++) A[a][a] += mu * (1 + A[a][a]);
      const y = solveLin(A, F.map((x) => -x));
      if (!y) break;
      const dx = new Array(X.length).fill(0);
      for (let a = 0; a < m; a++) for (const [i, v] of dense[a]) dx[i] += v * y[a] / W[i];
      // a damped step: halve until the residual falls
      let t = 1, best = null;
      for (let h = 0; h < 12; h++) {
        const X0 = X.slice(); for (let i = 0; i < X.length; i++) X[i] = X0[i] + t * dx[i];
        const F2 = res(), e2 = norm(F2);
        if (e2 < err || h === 11) { best = { F2, e2 }; if (e2 >= err) for (let i = 0; i < X.length; i++) X[i] = X0[i]; break; }
        for (let i = 0; i < X.length; i++) X[i] = X0[i]; t /= 2;
      }
      if (!best || best.e2 >= err) break;
      F = best.F2; err = best.e2;
    }
    const ok = err <= Math.max(tol, 1e-6);
    if (ok || o.always) writeBack(s, V, X);
    return { ok, err, iters: it };
  }
  /** the rank of a dense matrix (rows of numbers) and its null space basis */
  function rankNull(M, n) {
    const A = M.map((r) => r.slice()), piv = [];
    let row = 0;
    const scale = Math.max(1e-12, ...A.map((r) => Math.max(0, ...r.map(Math.abs))));
    const eps = 1e-7 * scale;
    for (let c = 0; c < n && row < A.length; c++) {
      let p = row; for (let r = row + 1; r < A.length; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < eps) continue;
      [A[row], A[p]] = [A[p], A[row]];
      const d = A[row][c]; for (let k = c; k < n; k++) A[row][k] /= d;
      for (let r = 0; r < A.length; r++) if (r !== row && A[r][c]) { const f = A[r][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[row][k]; }
      piv.push(c); row++;
    }
    const free = []; for (let c = 0; c < n; c++) if (!piv.includes(c)) free.push(c);
    const basis = free.map((fc) => { const v = new Array(n).fill(0); v[fc] = 1; piv.forEach((pc, r) => { v[pc] = -A[r][fc]; }); return v; });
    return { rank: piv.length, basis };
  }
  /** the degrees of freedom: {dof, free: Set of "pt.x"... keys that can still move, fullyOf(entity) -> bool} */
  function dof(s) {
    const V = vars(s), X = V.vals.slice(), R = rows(s, V), n = X.length;
    const J = jac(R, X).map((row) => { const r = new Array(n).fill(0); for (const { i, v } of row) r[i] += v; return r; });
    const { rank, basis } = rankNull(J, n);
    const freeIdx = new Set();
    for (const v of basis) { const mx = Math.max(...v.map(Math.abs)) || 1; v.forEach((x, i) => { if (Math.abs(x) > 1e-6 * mx) freeIdx.add(i); }); }
    const free = new Set(); for (const [k, i] of V.idx) if (freeIdx.has(i)) free.add(k);
    const fully = (e) => { const ks = ptsOf(e).flatMap((p) => [p + ".x", p + ".y"]); if (e.t === "circle") ks.push(e.id + ".r"); return ks.every((k) => !free.has(k)); };
    return { dof: n - rank, rank, free, fully, n, m: R.length };
  }
  /** add a constraint / a driving dimension the safe way: refused when it is REDUNDANT (changes nothing the others do
   *  not) or it OVER-CONSTRAINS (cannot be met with the rest) - a dimension then becomes a driven one.
   *  -> {ok, why: "redundant" | "over" | null, id} */
  /** a line squashed to a point / a circle to nothing that was not before (a solve gone wrong) */
  function degenerate(s, before) {
    const L = (S, e) => (e.t === "line" ? hyp(pt(S, e.p2).x - pt(S, e.p1).x, pt(S, e.p2).y - pt(S, e.p1).y) : e.t === "circle" ? e.r : e.t === "arc" ? hyp(pt(S, e.p1).x - pt(S, e.c).x, pt(S, e.p1).y - pt(S, e.c).y) : 1);
    return s.ents.some((e) => { const b = ent(before, e.id); return b && L(before, b) >= 0.5 && L(s, e) < 0.5; });
  }
  function tryAdd(s, item, kind) {
    const before = clone(s), r0 = dof(s).rank;
    const id = kind === "dim" ? addDim(s, item) : addCon(s, conFrom(s, item));
    const r0k = solve(s), r = { ok: r0k.ok && !degenerate(s, before) };
    if (!r.ok) { Object.assign(s, clone(before)); if (kind === "dim") { const id2 = addDim(s, Object.assign({}, item, { driven: true })); measure(s); return { ok: false, why: "over", id: id2, driven: true }; } return { ok: false, why: "over" }; }
    const r1 = dof(s).rank;
    if (r1 <= r0) { Object.assign(s, clone(before)); if (kind === "dim") { const id2 = addDim(s, Object.assign({}, item, { driven: true })); measure(s); return { ok: false, why: "redundant", id: id2, driven: true }; } return { ok: false, why: "redundant" }; }
    return { ok: true, why: null, id };
  }
  /** a dimension's value as the geometry is now (driven dimensions show it; a new driving one starts from it) */
  function valueOf(s, m) {
    const P = (id) => pt(s, id), r = m.refs || [], E = (id) => ent(s, id);
    const rad = (e) => (e.t === "circle" ? e.r : hyp(P(e.p1).x - P(e.c).x, P(e.p1).y - P(e.c).y));
    if (m.t === "dist") { const a = P(r[0]), b = P(r[1]); return hyp(b.x - a.x, b.y - a.y); }
    if (m.t === "hdist" || m.t === "vdist") { const a = P(r[0]), b = P(r[1]), k = m.t === "hdist" ? "x" : "y"; return Math.abs(b[k] - a[k]); }
    if (m.t === "len") { const e = E(r[0]), a = P(e.p1), b = P(e.p2); return hyp(b.x - a.x, b.y - a.y); }
    if (m.t === "ptline") { const p = P(r[0]), e = E(r[1]), a = P(e.p1), b = P(e.p2), u = [b.x - a.x, b.y - a.y], w = [p.x - a.x, p.y - a.y]; return Math.abs(u[0] * w[1] - u[1] * w[0]) / (hyp(u[0], u[1]) || 1); }
    if (m.t === "radius") return rad(E(r[0]));
    if (m.t === "diameter") return 2 * rad(E(r[0]));
    if (m.t === "angle") { const a = E(r[0]), b = E(r[1]), u = [P(a.p2).x - P(a.p1).x, P(a.p2).y - P(a.p1).y], w = [P(b.p2).x - P(b.p1).x, P(b.p2).y - P(b.p1).y]; return Math.abs(Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1])) * 180 / Math.PI; }
    return 0;
  }
  /** which side of a line (a, b point objects) the point p is on: 1 | -1 (on it = 1) */
  const sideOf = (a, b, p) => (((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) >= 0 ? 1 : -1);
  /** a new constraint's settings from the geometry now (the side a tangent keeps) */
  function conFrom(s, c) {
    const k = Object.assign({}, c), P = (id) => pt(s, id), A = ent(s, k.a), B = ent(s, k.b);
    if (k.t === "tangent" && A && B) {
      const l = A.t === "line" ? A : B.t === "line" ? B : null, ci = l === A ? B : A;
      if (l && ci) k.s = sideOf(P(l.p1), P(l.p2), P(ci.c));
      else if (!l) { const r1 = A.t === "circle" ? A.r : hyp(P(A.p1).x - P(A.c).x, P(A.p1).y - P(A.c).y), r2 = B.t === "circle" ? B.r : hyp(P(B.p1).x - P(B.c).x, P(B.p1).y - P(B.c).y);
        const dd = hyp(P(B.c).x - P(A.c).x, P(B.c).y - P(A.c).y); k.s = dd < Math.max(r1, r2) ? -1 : 1; }
    }
    if (k.t === "fix" && k.x == null) { const p = P(k.a); if (p) { k.x = p.x; k.y = p.y; } }
    return k;
  }
  /** a new dimension's settings from the geometry now: its value and its side (s) */
  function dimFrom(s, t, refs) {
    const m = { t, refs }, P = (id) => pt(s, id);
    if (t === "ptline") { const e = ent(s, refs[1]); m.s = sideOf(P(e.p1), P(e.p2), P(refs[0])); }
    if (t === "hdist" || t === "vdist") { const k = t === "hdist" ? "x" : "y"; m.s = P(refs[1])[k] >= P(refs[0])[k] ? 1 : -1; }
    if (t === "angle") { const a = ent(s, refs[0]), b = ent(s, refs[1]), u = [P(a.p2).x - P(a.p1).x, P(a.p2).y - P(a.p1).y], w = [P(b.p2).x - P(b.p1).x, P(b.p2).y - P(b.p1).y]; m.s = (u[0] * w[1] - u[1] * w[0]) >= 0 ? 1 : -1; }
    m.v = Math.round(valueOf(s, m) * 1000) / 1000;
    return m;
  }
  /** driven dimensions take the geometry's values */
  function measure(s) { for (const m of s.dims) if (m.driven) m.v = valueOf(s, m); return s; }
  /** a dimension's new value: solved; refused (the old value back) when it cannot be met */
  function setDim(s, id, v) {
    const m = s.dims.find((x) => x.id === id); if (!m || m.driven) return { ok: false, why: m ? "driven" : "none" };
    const before = clone(s); m.v = +v;
    const r = solve(s);
    if (!r.ok || degenerate(s, before)) { Object.assign(s, before); return { ok: false, why: "over" }; }
    measure(s); return { ok: true };
  }
  /** drag point(s) toward (x, y) (a delta for several): the rest follows the constraints -> {ok} */
  function drag(s, ids, dx, dy, opts) {
    const before = clone(s);
    for (const id of ids) { const p = pt(s, id); if (p) { p.x += dx; p.y += dy; } }
    const r = solve(s, Object.assign({ heavy: ids }, opts || {}));
    if (!r.ok || degenerate(s, before)) { Object.assign(s, before); return { ok: false }; }
    measure(s); return { ok: true };
  }
  /** a circle's radius dragged */
  function dragRadius(s, eid, r) {
    const before = clone(s), e = ent(s, eid); if (!e || e.t !== "circle") return { ok: false };
    e.r = Math.max(0.5, r);
    const res = solve(s, { heavy: [eid] });
    if (!res.ok) { Object.assign(s, before); return { ok: false }; }
    measure(s); return { ok: true };
  }

  /* ================================ geometry for drawing / picking ================================ */
  function arcAngles(s, e) {
    const c = pt(s, e.c), a = pt(s, e.p1), b = pt(s, e.p2);
    const a0 = Math.atan2(a.y - c.y, a.x - c.x); let a1 = Math.atan2(b.y - c.y, b.x - c.x);
    while (a1 <= a0) a1 += TAU;
    return { cx: c.x, cy: c.y, r: hyp(a.x - c.x, a.y - c.y), a0, a1 };
  }
  /** the distance from (x, y) to an entity */
  function distTo(s, e, x, y) {
    if (e.t === "point") { const p = pt(s, e.p1); return hyp(p.x - x, p.y - y); }
    if (e.t === "line") { const a = pt(s, e.p1), b = pt(s, e.p2), u = [b.x - a.x, b.y - a.y], L2 = u[0] * u[0] + u[1] * u[1]; const t = L2 ? Math.max(0, Math.min(1, ((x - a.x) * u[0] + (y - a.y) * u[1]) / L2)) : 0; return hyp(a.x + t * u[0] - x, a.y + t * u[1] - y); }
    if (e.t === "circle") { const c = pt(s, e.c); return Math.abs(hyp(x - c.x, y - c.y) - e.r); }
    if (e.t === "spline") { const q = splinePoly(s, e, 12); let d = Infinity; for (let i = 0; i + 1 < q.length; i++) { const a = q[i], b = q[i + 1], u = [b[0] - a[0], b[1] - a[1]], L2 = u[0] * u[0] + u[1] * u[1]; const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * u[0] + (y - a[1]) * u[1]) / L2)) : 0; d = Math.min(d, hyp(a[0] + t * u[0] - x, a[1] + t * u[1] - y)); } return d; }
    if (e.t === "arc") { const A = arcAngles(s, e); let t = Math.atan2(y - A.cy, x - A.cx); while (t < A.a0) t += TAU; if (t <= A.a1) return Math.abs(hyp(x - A.cx, y - A.cy) - A.r);
      const p1 = pt(s, e.p1), p2 = pt(s, e.p2); return Math.min(hyp(p1.x - x, p1.y - y), hyp(p2.x - x, p2.y - y)); }
    return Infinity;
  }
  /** the nearest point / entity at (x, y) within tol: {k: "pt" | "ent", id} | null (points first) */
  function pick(s, x, y, tol, o) {
    const opt = o || {};
    let best = null;
    if (!opt.entsOnly) for (const p of s.pts) { const d = hyp(p.x - x, p.y - y); if (d <= tol && (!best || d < best.d) && !(opt.skip && opt.skip.includes(p.id)) && (opt.origin !== false || !isOrigin(s, p.id) || p.id === s.origin.pt)) best = { k: "pt", id: p.id, d }; }
    if (best) return best;
    for (const e of s.ents) { if (opt.skip && opt.skip.includes(e.id)) continue; if (e.axis && opt.axes === false) continue; const d = distTo(s, e, x, y) + (e.axis ? tol * 0.5 : 0); if (d <= tol && (!best || d < best.d)) best = { k: "ent", id: e.id, d }; }   // the origin's axes only when nothing else is as near
    return best;
  }

  /* ================================ profiles ================================ */
  /** the closed regions: [{loop: [{e, rev}], area, path}] - lines / arcs meeting at shared (or coincident) points, circles */
  function profiles(s, opts) {
    const o = opts || {}, out = [];
    const use = s.ents.filter((e) => !e.cons && (e.t === "line" || e.t === "arc" || e.t === "circle" || e.t === "spline"));
    // coincident points are one vertex
    const parent = new Map(); const find = (a) => { while (parent.has(a) && parent.get(a) !== a) a = parent.get(a); return a; };
    const unite = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent.set(x, y); };
    for (const k of s.cons) if (k.t === "coincident") unite(k.a, k.b);
    const P = (id) => pt(s, id);
    const edges = [];
    const seenPair = new Set();
    // a line with points kept ON it (onLine) is cut there (a T-junction makes two regions)
    const onPts = new Map(); for (const k of s.cons) if (k.t === "onLine") { if (!onPts.has(k.b)) onPts.set(k.b, []); onPts.get(k.b).push(k.a); }
    const pieces = (e) => {
      if (e.t !== "line" || !onPts.has(e.id)) return [e];
      const a = P(e.p1), b = P(e.p2), u = [b.x - a.x, b.y - a.y], L2 = u[0] * u[0] + u[1] * u[1] || 1;
      const mid = onPts.get(e.id).map((id) => ({ id, t: ((P(id).x - a.x) * u[0] + (P(id).y - a.y) * u[1]) / L2 })).filter((q) => q.t > 1e-6 && q.t < 1 - 1e-6).sort((x, y) => x.t - y.t);
      const ids = [e.p1, ...mid.map((q) => q.id), e.p2], out = [];
      for (let i = 0; i + 1 < ids.length; i++) out.push({ id: e.id + "#" + i, t: "line", p1: ids[i], p2: ids[i + 1], virtual: true });
      return out;
    };
    for (const e0 of use) for (const e of pieces(e0)) if (e.t === "line" || e.t === "arc" || e.t === "spline") {
      const a = find(e.t === "spline" ? e.pts[0] : e.p1), b = find(e.t === "spline" ? e.pts[e.pts.length - 1] : e.p2), k = e.t === "line" ? [a, b].sort().join("|") : null;
      if (k && seenPair.has(k)) continue;                     // two lines over the same two points: one edge
      if (k) seenPair.add(k);
      edges.push({ e, a, b });
    }
    // half-edges with their leaving direction
    const dirAt = (ed, fromA) => {
      const e = ed.e;
      if (e.t === "line") { const a = P(fromA ? e.p1 : e.p2), b = P(fromA ? e.p2 : e.p1); return Math.atan2(b.y - a.y, b.x - a.x); }
      if (e.t === "spline") { const q = splinePoly(s, e, 16), a = fromA ? q[0] : q[q.length - 1], b = fromA ? q[1] : q[q.length - 2]; return Math.atan2(b[1] - a[1], b[0] - a[0]); }
      const A = arcAngles(s, e), t = fromA ? A.a0 + Math.min(0.01, (A.a1 - A.a0) / 4) : A.a1 - Math.min(0.01, (A.a1 - A.a0) / 4);
      const q = [A.cx + A.r * Math.cos(t), A.cy + A.r * Math.sin(t)], base = P(fromA ? e.p1 : e.p2);
      return Math.atan2(q[1] - base.y, q[0] - base.x);
    };
    const out_ = new Map();
    edges.forEach((ed, i) => { if (ed.a === ed.b && ed.e.t === "line") return; for (const fwd of [true, false]) { const v = fwd ? ed.a : ed.b; if (!out_.has(v)) out_.set(v, []); out_.get(v).push({ i, fwd, ang: dirAt(ed, fwd) }); } });
    for (const list of out_.values()) list.sort((p, q) => p.ang - q.ang);
    const used = new Set(), key = (h) => h.i + (h.fwd ? "+" : "-");
    const ptXY = (id) => { const p = P(id); return [p.x, p.y]; };
    for (const [v0, list0] of out_) for (const h0 of list0) {
      if (used.has(key(h0))) continue;
      const loop = []; let h = h0, ok = false;
      for (let guard = 0; guard < 2000; guard++) {
        if (used.has(key(h))) { ok = key(h) === key(h0) && loop.length > 0; break; }
        used.add(key(h)); loop.push(h);
        const ed = edges[h.i], end = h.fwd ? ed.b : ed.a, list = out_.get(end) || [];
        // arrive direction reversed = the direction back along this edge from `end`
        const back = dirAt(ed, !h.fwd);
        // the next half-edge: the first one turning clockwise from the way back (screen y down: the smallest angle above `back`)
        let nxt = null, bestA = Infinity;
        for (const c of list) { if (c.i === h.i && c.fwd === !h.fwd && list.length > 1) continue; let a = c.ang - back; while (a <= 1e-9) a += TAU; if (a < bestA) { bestA = a; nxt = c; } }
        if (!nxt) break;
        h = nxt;
      }
      if (!ok) continue;
      const poly = flatten(s, loop.map((x) => ({ e: edges[x.i].e, rev: !x.fwd })), 8);
      const area = -signedArea(poly);                     // (the faces inside come round this way; the outside one the other)
      if (area > 1e-6) out.push({ loop: loop.map((x) => ({ e: edges[x.i].e.virtual ? edges[x.i].e : edges[x.i].e.id, rev: !x.fwd })), area, poly });
      void v0; void ptXY;
    }
    for (const e of use) if (e.t === "circle") { const c = P(e.c), poly = []; for (let i = 0; i < 64; i++) { const t = (i / 64) * TAU; poly.push([c.x + e.r * Math.cos(t), c.y + e.r * Math.sin(t)]); } out.push({ loop: [{ e: e.id, rev: false }], area: Math.PI * e.r * e.r, poly, circle: e.id }); }
    // holes: a profile inside another (not sharing edges) is cut out of it
    const ek = (x) => (typeof x.e === "string" ? x.e : x.e.id.split("#")[0]);
    for (const p of out) p.holes = out.filter((q) => q !== p && q.area < p.area && inside(q.poly[0], p.poly) && !q.loop.some((x) => p.loop.some((y) => ek(y) === ek(x)))).map((q) => q);
    for (const p of out) p.holes = p.holes.filter((q) => !p.holes.some((r) => r !== q && r.area > q.area && inside(q.poly[0], r.poly)));
    if (o.withPaths !== false) for (const p of out) p.path = pathOf(s, p);
    return out;
  }
  /** 2.494.0: the profile under (x, y) - the smallest closed region holding it (not in one of its holes) -> index | -1 */
  function profileAt(s, x, y, list) {
    const pr = list || profiles(s, { withPaths: false }); let best = -1;
    pr.forEach((p, i) => { if (!inside([x, y], p.poly) || (p.holes || []).some((h) => inside([x, y], h.poly))) return; if (best < 0 || p.area < pr[best].area) best = i; });
    return best;
  }
  /** 2.494.0: the profiles made only of these entities (picked with Sketch Select) -> [index] */
  function profilesOfEnts(s, ids, list) {
    const set = new Set(ids), pr = list || profiles(s, { withPaths: false }), ek = (q) => (typeof q.e === "string" ? q.e : String(q.e.id).split("#")[0]);
    return pr.map((p, i) => (p.loop.every((q) => set.has(ek(q))) ? i : -1)).filter((i) => i >= 0);
  }
  function signedArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function inside(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  /** a loop as a polygon (arcs in `n` steps) */
  function flatten(s, loop, n) {
    const out = [];
    for (const { e, rev } of loop) {
      if (e.t === "line") { const a = pt(s, rev ? e.p2 : e.p1); out.push([a.x, a.y]); }
      else if (e.t === "spline") { const q = splinePoly(s, e, Math.max(4, Math.round(n / 2))); if (rev) q.reverse(); q.pop(); out.push(...q); }
      else if (e.t === "arc") { const A = arcAngles(s, e); for (let i = 0; i < n; i++) { const t = rev ? A.a1 - (A.a1 - A.a0) * i / n : A.a0 + (A.a1 - A.a0) * i / n; out.push([A.cx + A.r * Math.cos(t), A.cy + A.r * Math.sin(t)]); } }
    }
    return out;
  }
  const A_ = (x, y, ix, iy, ox, oy) => ({ x, y, ix: ix == null ? x : ix, iy: iy == null ? y : iy, ox: ox == null ? x : ox, oy: oy == null ? y : oy });
  /** a loop as a pcpath sub (arcs as Béziers of at most 90°) */
  function subOf(s, loop, op) {
    const pts = [];
    const seg = (cx, cy, r, t0, t1) => {          // from t0 to t1 (either way), quarter turns at most
      const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 2))), dt = (t1 - t0) / n, k = (4 / 3) * Math.tan(dt / 4);
      for (let i = 0; i < n; i++) {
        const a0 = t0 + dt * i, a1 = a0 + dt, p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p3 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        const c1 = [p0[0] - k * r * Math.sin(a0), p0[1] + k * r * Math.cos(a0)], c2 = [p3[0] + k * r * Math.sin(a1), p3[1] - k * r * Math.cos(a1)];
        const last = pts[pts.length - 1];
        if (last && hyp(last.x - p0[0], last.y - p0[1]) < 1e-6) { last.ox = c1[0]; last.oy = c1[1]; } else pts.push(A_(p0[0], p0[1], null, null, c1[0], c1[1]));
        pts.push(A_(p3[0], p3[1], c2[0], c2[1]));
      }
    };
    for (const { e: id, rev } of loop) {
      const e = typeof id === "string" ? ent(s, id) : id;
      if (e.t === "line") { const a = pt(s, rev ? e.p2 : e.p1), b = pt(s, rev ? e.p1 : e.p2), last = pts[pts.length - 1]; if (!last || hyp(last.x - a.x, last.y - a.y) > 1e-6) pts.push(A_(a.x, a.y)); pts.push(A_(b.x, b.y)); }
      else if (e.t === "arc") { const A = arcAngles(s, e); if (rev) seg(A.cx, A.cy, A.r, A.a1, A.a0); else seg(A.cx, A.cy, A.r, A.a0, A.a1); }
      else if (e.t === "circle") { const c = pt(s, e.c); seg(c.x, c.y, e.r, 0, TAU); }
      else if (e.t === "spline") {
        let B = splineBez(s, e); if (rev) B = B.slice().reverse().map((b) => [b[3], b[2], b[1], b[0]]);
        for (const b of B) {
          const last = pts[pts.length - 1];
          if (last && hyp(last.x - b[0][0], last.y - b[0][1]) < 1e-6) { last.ox = b[1][0]; last.oy = b[1][1]; } else pts.push(A_(b[0][0], b[0][1], null, null, b[1][0], b[1][1]));
          pts.push(A_(b[3][0], b[3][1], b[2][0], b[2][1]));
        }
      }
    }
    // the last point = the first: drop it (the sub is closed), keeping its incoming handle
    if (pts.length > 1) { const f = pts[0], l = pts[pts.length - 1]; if (hyp(f.x - l.x, f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; pts.pop(); } }
    return { closed: true, op: op || "add", pts };
  }
  function pathOf(s, p) { return { subs: [subOf(s, p.loop, "add")].concat((p.holes || []).map((h) => subOf(s, h.loop, "subtract"))) }; }

  /* ================================ 2.463.0: modify (trim, extend, fillet, chamfer, offset, mirror, patterns) + more shapes ================================ */
  const EPS = 1e-7;
  /** an entity as plain geometry: {k: "seg", a, b} | {k: "circ", c, r, a0, a1 (null = full)} | null */
  function geo(s, e) {
    if (!e) return null;
    if (e.t === "line") { const a = pt(s, e.p1), b = pt(s, e.p2); return { k: "seg", a: [a.x, a.y], b: [b.x, b.y] }; }
    if (e.t === "circle") { const c = pt(s, e.c); return { k: "circ", c: [c.x, c.y], r: e.r, a0: null, a1: null }; }
    if (e.t === "arc") { const A = arcAngles(s, e); return { k: "circ", c: [A.cx, A.cy], r: A.r, a0: A.a0, a1: A.a1 }; }
    return null;
  }
  /** an angle into the arc's range: its offset from a0 (0 .. a1 - a0), or null outside */
  function arcOff(g, ang) { if (g.a0 == null) { let t = ang % TAU; if (t < 0) t += TAU; return t; } let t = ang - g.a0; while (t < -EPS) t += TAU; while (t > TAU) t -= TAU; return t <= g.a1 - g.a0 + 1e-9 ? t : null; }
  /** where two pieces of geometry cross: [{p: [x, y], ta, tb}] (t = 0..1 along a segment, the angle offset on a circle) */
  function crossings(A, B, infA) {
    const out = [];
    const segT = (g, p) => { const u = [g.b[0] - g.a[0], g.b[1] - g.a[1]], L2 = u[0] * u[0] + u[1] * u[1] || 1; return ((p[0] - g.a[0]) * u[0] + (p[1] - g.a[1]) * u[1]) / L2; };
    const onSeg = (t, inf) => inf || (t >= -1e-9 && t <= 1 + 1e-9);
    const param = (g, p, inf) => (g.k === "seg" ? (onSeg(segT(g, p), inf) ? segT(g, p) : null) : arcOff(g, Math.atan2(p[1] - g.c[1], p[0] - g.c[0])));
    let pts = [];
    if (A.k === "seg" && B.k === "seg") {
      const r = [A.b[0] - A.a[0], A.b[1] - A.a[1]], q = [B.b[0] - B.a[0], B.b[1] - B.a[1]], den = r[0] * q[1] - r[1] * q[0];
      if (Math.abs(den) > 1e-12) { const w = [B.a[0] - A.a[0], B.a[1] - A.a[1]], t = (w[0] * q[1] - w[1] * q[0]) / den; pts.push([A.a[0] + t * r[0], A.a[1] + t * r[1]]); }
    } else if (A.k === "circ" && B.k === "circ") {
      const d = hyp(B.c[0] - A.c[0], B.c[1] - A.c[1]);
      if (d > 1e-9 && d <= A.r + B.r + 1e-9 && d >= Math.abs(A.r - B.r) - 1e-9) {
        const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A.r * A.r - a * a)), m = [A.c[0] + a * (B.c[0] - A.c[0]) / d, A.c[1] + a * (B.c[1] - A.c[1]) / d];
        pts.push([m[0] + h * (B.c[1] - A.c[1]) / d, m[1] - h * (B.c[0] - A.c[0]) / d]); if (h > 1e-9) pts.push([m[0] - h * (B.c[1] - A.c[1]) / d, m[1] + h * (B.c[0] - A.c[0]) / d]);
      }
    } else {
      const S_ = A.k === "seg" ? A : B, C_ = A.k === "seg" ? B : A, u = [S_.b[0] - S_.a[0], S_.b[1] - S_.a[1]], f = [S_.a[0] - C_.c[0], S_.a[1] - C_.c[1]];
      const a = u[0] * u[0] + u[1] * u[1], b = 2 * (f[0] * u[0] + f[1] * u[1]), c = f[0] * f[0] + f[1] * f[1] - C_.r * C_.r, D = b * b - 4 * a * c;
      if (a > 1e-12 && D >= -1e-9) { const sq = Math.sqrt(Math.max(0, D)); for (const t of D > 1e-12 ? [(-b - sq) / (2 * a), (-b + sq) / (2 * a)] : [-b / (2 * a)]) pts.push([S_.a[0] + t * u[0], S_.a[1] + t * u[1]]); }
    }
    for (const p of pts) { const ta = param(A, p, infA), tb = param(B, p, false); if (ta != null && tb != null) out.push({ p, ta, tb }); }
    return out;
  }
  const geoParam = (g, x, y) => (g.k === "seg" ? (() => { const u = [g.b[0] - g.a[0], g.b[1] - g.a[1]], L2 = u[0] * u[0] + u[1] * u[1] || 1; return ((x - g.a[0]) * u[0] + (y - g.a[1]) * u[1]) / L2; })() : arcOff(g, Math.atan2(y - g.c[1], x - g.c[0])));
  const geoAt = (g, t) => (g.k === "seg" ? [g.a[0] + t * (g.b[0] - g.a[0]), g.a[1] + t * (g.b[1] - g.a[1])] : [g.c[0] + g.r * Math.cos((g.a0 || 0) + t), g.c[1] + g.r * Math.sin((g.a0 || 0) + t)]);
  /** the places an entity is cut: other entities crossing it + points lying on it -> [{t, p, by: ent id | null, pt: point id | null}] */
  function cutsOf(s, e) {
    const G = geo(s, e), out = [], len = G.k === "seg" ? 1 : G.a0 == null ? TAU : G.a1 - G.a0;
    for (const f of s.ents) {
      if (f.id === e.id || f.t === "point" || f.axis || f.t === "spline") continue;
      const H = geo(s, f); if (!H) continue;
      for (const x of crossings(G, H)) { const t = x.ta; if (G.a0 == null && G.k === "circ") out.push({ t, p: x.p, by: f.id, pt: null }); else if (t > 1e-6 && t < len - 1e-6) out.push({ t, p: x.p, by: f.id, pt: null }); }
    }
    // points on it (ends of other entities, points kept on it) that are not its own ends
    const own = new Set(ptsOf(e));
    for (const q of s.pts) {
      if (own.has(q.id) || (s.origin && isOrigin(s, q.id) && q.id !== s.origin.pt)) continue;
      if (distTo(s, e, q.x, q.y) > 1e-4) continue;
      const t = geoParam(G, q.x, q.y); if (t == null) continue;
      if (G.k === "seg" ? t > 1e-6 && t < 1 - 1e-6 : (G.a0 == null || (t > 1e-6 && t < len - 1e-6))) out.push({ t, p: [q.x, q.y], by: null, pt: q.id });
    }
    out.sort((a, b) => a.t - b.t);
    const res = [];                                               // one cut per place - a point there wins over a crossing
    for (const c of out) { const last = res[res.length - 1]; if (last && Math.abs(c.t - last.t) < 1e-6) { if (c.pt && !last.pt) res[res.length - 1] = c; } else res.push(c); }
    return res;
  }
  /** a point at a cut: the point that made it, else a new one kept on what cut it */
  function cutPoint(s, c) {
    if (c.pt) return c.pt;
    const id = addPoint(s, c.p[0], c.p[1]), f = ent(s, c.by);
    if (f) addCon(s, { t: f.t === "line" ? "onLine" : "onCircle", a: id, b: f.id });
    return id;
  }
  /** constraints of `from` that a new piece `to` should share (direction ones) */
  function copyDirCons(s, from, to) {
    for (const k of s.cons.slice()) {
      if (["horizontal", "vertical"].includes(k.t) && k.a === from && !k.b) addCon(s, { t: k.t, a: to });
      if (["parallel", "perpendicular", "collinear"].includes(k.t) && (k.a === from || k.b === from)) addCon(s, { t: k.t, a: k.a === from ? to : k.a, b: k.b === from ? to : k.b });
    }
  }
  /** drop what no longer fits a shortened entity: its length dims, midpoint / equal on it */
  function dropLenCons(s, id) {
    s.dims = s.dims.filter((m) => !(m.t === "len" && m.refs[0] === id));
    s.cons = s.cons.filter((k) => !((k.t === "midpoint" && k.b === id) || (k.t === "equal" && (k.a === id || k.b === id) && (ent(s, k.a) || {}).t === "line")));
  }
  /** TRIM: the piece of entity `eid` under (x, y), between the places it is cut, goes -> {ok, why} */
  function trim(s, eid, x, y) {
    const e = ent(s, eid); if (!e || e.axis) return { ok: false, why: "pick a line, circle or arc" };
    if (e.t === "point" || e.t === "spline") return { ok: false, why: "points and splines are not trimmed - delete them" };
    const G = geo(s, e), cuts = cutsOf(s, e), tc = geoParam(G, x, y);
    if (e.t === "circle") {
      if (cuts.length < 2) { if (!cuts.length) { remove(s, [eid]); return { ok: true, removed: true }; } return { ok: false, why: "a circle cut in one place only cannot be trimmed" }; }
      let i = cuts.findIndex((c) => c.t > tc); if (i < 0) i = 0;
      const hi = cuts[i], lo = cuts[(i - 1 + cuts.length) % cuts.length];   // the clicked piece runs lo -> hi
      const pa = cutPoint(s, hi), pb = cutPoint(s, lo);             // the arc kept runs hi -> lo (the rest of the circle)
      const aid = addEnt(s, { t: "arc", c: e.c, p1: pa, p2: pb, cons: !!e.cons });
      for (const k of s.cons) { if (k.a === eid) k.a = aid; if (k.b === eid) k.b = aid; }
      for (const m of s.dims) m.refs = m.refs.map((r) => (r === eid ? aid : r));
      s.ents = s.ents.filter((f) => f.id !== eid);
      remove(s, []); return { ok: true, arc: aid };
    }
    const end = G.k === "seg" ? 1 : G.a1 - G.a0;
    let lo = null, hi = null;
    for (const c of cuts) { if (c.t < tc) lo = c; else if (!hi) hi = c; }
    if (!lo && !hi) { remove(s, [eid]); return { ok: true, removed: true }; }
    dropLenCons(s, eid);
    if (!lo) { e.p1 = cutPoint(s, hi); }
    else if (!hi) { e.p2 = cutPoint(s, lo); }
    else {
      const old2 = e.p2, q1 = cutPoint(s, lo), q2 = cutPoint(s, hi);
      e.p2 = q1;
      const nid = e.t === "line" ? addEnt(s, { t: "line", p1: q2, p2: old2, cons: !!e.cons }) : addEnt(s, { t: "arc", c: e.c, p1: q2, p2: old2, cons: !!e.cons });
      if (e.t === "line") copyDirCons(s, eid, nid); else addCon(s, { t: "equal", a: eid, b: nid });
    }
    void end;
    remove(s, []);
    return { ok: true };
  }
  /** EXTEND: a line's end nearest (x, y) runs on to the next thing it meets -> {ok, why} */
  function extend(s, eid, x, y) {
    const e = ent(s, eid); if (!e || e.t !== "line" || e.axis) return { ok: false, why: "pick a line near the end to extend" };
    const a = pt(s, e.p1), b = pt(s, e.p2), atEnd = hyp(b.x - x, b.y - y) <= hyp(a.x - x, a.y - y), endId = atEnd ? e.p2 : e.p1;
    if (s.ents.some((f) => f.id !== eid && ptsOf(f).includes(endId))) return { ok: false, why: "that end is joined to another entity" };
    const G = { k: "seg", a: [a.x, a.y], b: [b.x, b.y] };
    let best = null;
    for (const f of s.ents) {
      if (f.id === eid || f.t === "point" || f.t === "spline") continue;
      const H = geo(s, f); if (!H) continue;
      for (const c of crossings(G, H, true)) { const go = atEnd ? c.ta - 1 : -c.ta; if (go > 1e-6 && (!best || go < best.go)) best = { go, c, f }; }
    }
    if (!best) return { ok: false, why: "nothing to reach in that direction" };
    const P = pt(s, endId); P.x = best.c.p[0]; P.y = best.c.p[1];
    dropLenCons(s, eid);
    addCon(s, { t: best.f.t === "line" ? "onLine" : "onCircle", a: endId, b: best.f.id });
    const r = solve(s); return { ok: r.ok, to: best.f.id };
  }
  /** the corner two lines make: {c: [x, y], shared: point id | null, far1, far2 (point ids), end1, end2 (the ends at the corner)} | null */
  function cornerOf(s, l1, l2) {
    const e1 = ent(s, l1), e2 = ent(s, l2); if (!e1 || !e2 || e1.t !== "line" || e2.t !== "line") return null;
    const shared = [e1.p1, e1.p2].find((p) => p === e2.p1 || p === e2.p2) || null;
    const G1 = geo(s, e1), G2 = geo(s, e2), X = crossings(G1, G2, true);
    let c = shared ? [pt(s, shared).x, pt(s, shared).y] : X.length ? X[0].p : null;
    if (!c) { const r = [G1.b[0] - G1.a[0], G1.b[1] - G1.a[1]], q = [G2.b[0] - G2.a[0], G2.b[1] - G2.a[1]], den = r[0] * q[1] - r[1] * q[0]; if (Math.abs(den) < 1e-12) return null; const w = [G2.a[0] - G1.a[0], G2.a[1] - G1.a[1]], t = (w[0] * q[1] - w[1] * q[0]) / den; c = [G1.a[0] + t * r[0], G1.a[1] + t * r[1]]; }
    const near = (e) => (hyp(pt(s, e.p1).x - c[0], pt(s, e.p1).y - c[1]) <= hyp(pt(s, e.p2).x - c[0], pt(s, e.p2).y - c[1]) ? [e.p1, e.p2] : [e.p2, e.p1]);
    const [end1, far1] = near(e1), [end2, far2] = near(e2);
    return { c, shared, end1, end2, far1, far2 };
  }
  /** an arc from point a to point b round centre c that passes nearest `mid` (its direction chosen so) */
  function arcThrough(s, c, a, b, mid, cons) {
    const C = pt(s, c), A = pt(s, a), Bq = pt(s, b), ang = (q) => Math.atan2(q[1] - C.y, q[0] - C.x), sweep = (x, y) => { let d = y - x; while (d < 0) d += TAU; return d; };
    const t0 = ang([A.x, A.y]), tm = ang(mid), t1 = ang([Bq.x, Bq.y]);
    return sweep(t0, tm) <= sweep(t0, t1) ? addEnt(s, { t: "arc", c, p1: a, p2: b, cons: !!cons }) : addEnt(s, { t: "arc", c, p1: b, p2: a, cons: !!cons });
  }
  /** FILLET: the corner of two lines rounded with radius r (an arc tangent to both, a radius dimension) -> {ok, why, arc} */
  function fillet(s, l1, l2, r) {
    const K0 = cornerOf(s, l1, l2); if (!K0) return { ok: false, why: "pick two lines that meet (or would meet)" };
    const F1 = pt(s, K0.far1), F2 = pt(s, K0.far2), C = K0.c;
    const u1 = [F1.x - C[0], F1.y - C[1]], u2 = [F2.x - C[0], F2.y - C[1]], L1 = hyp(...u1), L2 = hyp(...u2);
    if (L1 < 1e-6 || L2 < 1e-6) return { ok: false, why: "the lines are too short" };
    u1[0] /= L1; u1[1] /= L1; u2[0] /= L2; u2[1] /= L2;
    const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (th < 1e-3 || th > Math.PI - 1e-3) return { ok: false, why: "the lines run the same way - no corner to round" };
    const d = r / Math.tan(th / 2);
    if (d >= L1 || d >= L2) return { ok: false, why: "the radius is too big for those lines" };
    const bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = hyp(...bis), k = r / Math.sin(th / 2), O = [C[0] + bis[0] / bl * k, C[1] + bis[1] / bl * k];
    const before = clone(s);
    const T1 = addPoint(s, C[0] + u1[0] * d, C[1] + u1[1] * d), T2 = addPoint(s, C[0] + u2[0] * d, C[1] + u2[1] * d), O_ = addPoint(s, O[0], O[1]);
    const e1 = ent(s, l1), e2 = ent(s, l2);
    if (e1.p1 === K0.end1) e1.p1 = T1; else e1.p2 = T1;
    if (e2.p1 === K0.end2) e2.p1 = T2; else e2.p2 = T2;
    dropLenCons(s, l1); dropLenCons(s, l2);
    const mid = [O[0] + (C[0] - O[0]) / hyp(C[0] - O[0], C[1] - O[1]) * r, O[1] + (C[1] - O[1]) / hyp(C[0] - O[0], C[1] - O[1]) * r];
    const aid = arcThrough(s, O_, T1, T2, mid);
    remove(s, []);
    const ok1 = tryAdd(s, { t: "tangent", a: l1, b: aid }, "con"), ok2 = tryAdd(s, { t: "tangent", a: l2, b: aid }, "con");
    if (!ok1.ok && ok1.why === "over" || !ok2.ok && ok2.why === "over") { Object.assign(s, before); return { ok: false, why: "the sketch's constraints do not let that corner round" }; }
    const rd = tryAdd(s, Object.assign(dimFrom(s, "radius", [aid]), { v: r }), "dim");
    return { ok: true, arc: aid, dim: rd.id };
  }
  /** CHAMFER: the corner cut by a straight line `d` back along each line -> {ok, why, line} */
  function chamfer(s, l1, l2, d) {
    const K0 = cornerOf(s, l1, l2); if (!K0) return { ok: false, why: "pick two lines that meet (or would meet)" };
    const F1 = pt(s, K0.far1), F2 = pt(s, K0.far2), C = K0.c, L1 = hyp(F1.x - C[0], F1.y - C[1]), L2 = hyp(F2.x - C[0], F2.y - C[1]);
    if (d >= L1 || d >= L2) return { ok: false, why: "the distance is longer than the lines" };
    const T1 = addPoint(s, C[0] + (F1.x - C[0]) / L1 * d, C[1] + (F1.y - C[1]) / L1 * d), T2 = addPoint(s, C[0] + (F2.x - C[0]) / L2 * d, C[1] + (F2.y - C[1]) / L2 * d);
    const e1 = ent(s, l1), e2 = ent(s, l2);
    if (e1.p1 === K0.end1) e1.p1 = T1; else e1.p2 = T1;
    if (e2.p1 === K0.end2) e2.p1 = T2; else e2.p2 = T2;
    dropLenCons(s, l1); dropLenCons(s, l2);
    const nl = addEnt(s, { t: "line", p1: T1, p2: T2, cons: false });
    remove(s, []); solve(s);
    return { ok: true, line: nl };
  }
  /** copies of entities through a map of points (x, y) -> [x', y'] (reflect = a mirror: arcs turn round); the
   *  constraints / dimensions among them come along (opts.keepHV = false: Horizontal / Vertical do not) -> {pm, em} */
  function copyThrough(s, ids, map, opts) {
    const o = opts || {}, pm = new Map(), em = new Map();
    const P = (id) => { if (!pm.has(id)) { const q = pt(s, id), [x, y] = map(q.x, q.y); pm.set(id, o.fixedPt && o.fixedPt(id, x, y) ? id : addPoint(s, x, y)); } return pm.get(id); };
    for (const id of ids) {
      const e = ent(s, id); if (!e || e.axis) continue;
      let n = null;
      if (e.t === "line") n = addEnt(s, { t: "line", p1: P(e.p1), p2: P(e.p2), cons: !!e.cons });
      else if (e.t === "circle") n = addEnt(s, { t: "circle", c: P(e.c), r: e.r * (o.scale || 1), cons: !!e.cons });
      else if (e.t === "arc") n = o.reflect ? addEnt(s, { t: "arc", c: P(e.c), p1: P(e.p2), p2: P(e.p1), cons: !!e.cons }) : addEnt(s, { t: "arc", c: P(e.c), p1: P(e.p1), p2: P(e.p2), cons: !!e.cons });
      else if (e.t === "point") n = addEnt(s, { t: "point", p1: P(e.p1), cons: !!e.cons });
      else if (e.t === "spline") n = addEnt(s, { t: "spline", pts: e.pts.map(P), cons: !!e.cons });
      if (n) em.set(id, n);
    }
    const M = (r) => (em.has(r) ? em.get(r) : pm.has(r) ? pm.get(r) : null);
    for (const k of s.cons.slice()) {
      if (k.t === "fix" || (!o.keepHV && (k.t === "horizontal" || k.t === "vertical"))) continue;
      const a = k.a != null ? M(k.a) : null, b = k.b != null ? M(k.b) : null, c = k.c != null ? M(k.c) : null;
      if ((k.a != null && !a) || (k.b != null && !b) || (k.c != null && !c)) continue;
      if (k.t === "coincident" && a === b) continue;
      const n = Object.assign({}, k, { a, b, c }); delete n.id; if (k.c == null) delete n.c; if (k.b == null) delete n.b;
      if (o.reflect && n.s != null && k.t === "tangent") n.s = -n.s;
      addCon(s, n);
    }
    for (const m of s.dims.slice()) {
      if (!o.keepHV && (m.t === "hdist" || m.t === "vdist")) continue;
      const refs = m.refs.map(M); if (refs.some((r) => !r)) continue;
      const n = Object.assign({}, clone(m), { refs, driven: true }); delete n.id;      // the copies follow; their numbers are references
      if (o.reflect && n.s != null) n.s = -n.s;
      addDim(s, n);
    }
    return { pm, em };
  }
  /** MIRROR the entities about a line (a symmetric constraint for every point and its copy) -> {ok, ents} */
  function mirror(s, ids, lid) {
    const L = ent(s, lid); if (!L || L.t !== "line") return { ok: false, why: "pick the line to mirror about" };
    const a = pt(s, L.p1), b = pt(s, L.p2), u = [b.x - a.x, b.y - a.y], L2 = u[0] * u[0] + u[1] * u[1];
    const refl = (x, y) => { const t = ((x - a.x) * u[0] + (y - a.y) * u[1]) / L2, f = [a.x + t * u[0], a.y + t * u[1]]; return [2 * f[0] - x, 2 * f[1] - y]; };
    const on = (id, x, y) => { const q = pt(s, id); return hyp(q.x - x, q.y - y) < 1e-6; };
    const r = copyThrough(s, ids.filter((x) => x !== lid), refl, { reflect: true, keepHV: Math.abs(u[0]) < 1e-9 || Math.abs(u[1]) < 1e-9, fixedPt: on });
    for (const [o, c] of r.pm) if (o !== c) addCon(s, { t: "symmetric", a: o, b: c, c: lid });
    const sv = solve(s);
    return { ok: sv.ok, ents: [...r.em.values()] };
  }
  /** RECTANGULAR PATTERN: nx x ny copies dx / dy apart (the first = the picked ones) -> {ok, ents} */
  function patternRect(s, ids, nx, ny, dx, dy) {
    const out = [];
    for (let j = 0; j < Math.max(1, ny); j++) for (let i = 0; i < Math.max(1, nx); i++) { if (!i && !j) continue; const r = copyThrough(s, ids, (x, y) => [x + i * dx, y + j * dy], { keepHV: true }); out.push(...r.em.values()); }
    return { ok: true, ents: out };
  }
  /** CIRCULAR PATTERN: n copies round a point over `total` degrees -> {ok, ents} */
  function patternCirc(s, ids, cid, n, total) {
    const C = pt(s, cid); if (!C) return { ok: false, why: "pick the centre point" };
    const tot = total == null ? 360 : total, step = (Math.abs(tot - 360) < 1e-9 ? tot / n : tot / Math.max(1, n - 1)) * Math.PI / 180, out = [];
    for (let i = 1; i < n; i++) { const a = step * i, ca = Math.cos(a), sa = Math.sin(a); const r = copyThrough(s, ids, (x, y) => [C.x + (x - C.x) * ca - (y - C.y) * sa, C.y + (x - C.x) * sa + (y - C.y) * ca], { keepHV: Math.abs(Math.sin(a)) < 1e-9 }); out.push(...r.em.values()); }
    return { ok: true, ents: out };
  }
  /** 2.494.0: the picked lines / arcs as CHAINS joined end to end -> [{loop: [{e, rev}], closed}] (coincident points = one) */
  function chainsOf(s, ids) {
    const parent = new Map(), find = (a) => { while (parent.has(a) && parent.get(a) !== a) a = parent.get(a); return a; };
    for (const k of s.cons) if (k.t === "coincident") { const x = find(k.a), y = find(k.b); if (x !== y) parent.set(x, y); }
    const es = [...new Set(ids)].map((id) => ent(s, id)).filter((e) => e && !e.axis && (e.t === "line" || e.t === "arc") && find(e.p1) !== find(e.p2));
    const ends = es.map((e) => [find(e.p1), find(e.p2)]), V = new Map();
    ends.forEach(([a, b], i) => { for (const v of [a, b]) { if (!V.has(v)) V.set(v, []); V.get(v).push(i); } });
    const used = new Set(), out = [];
    const walk = (i0, v0) => {
      const loop = []; let i = i0, v = v0;
      while (i != null && !used.has(i)) {
        used.add(i); const [a, b] = ends[i], rev = v !== a; loop.push({ e: es[i], rev }); v = rev ? a : b;
        const at = V.get(v) || [], nb = at.filter((j) => j !== i && !used.has(j));
        i = at.length === 2 && nb.length === 1 ? nb[0] : null;
      }
      return { loop, end: v };
    };
    for (let i = 0; i < es.length; i++) { if (used.has(i)) continue; const [a, b] = ends[i]; if (V.get(a).length !== 2) out.push({ loop: walk(i, a).loop, closed: false }); else if (V.get(b).length !== 2) out.push({ loop: walk(i, b).loop, closed: false }); }
    for (let i = 0; i < es.length; i++) if (!used.has(i)) { const w = walk(i, ends[i][0]); out.push({ loop: w.loop, closed: w.end === ends[i][0] && w.loop.length > 1 }); }
    return out;
  }
  /** the left-hand normal of a chain piece at (x, y) (the way the chain runs; screen y down) */
  function leftNormal(s, q, x, y) {
    const e = q.e;
    if (e.t === "line") { const a = pt(s, q.rev ? e.p2 : e.p1), b = pt(s, q.rev ? e.p1 : e.p2), L = hyp(b.x - a.x, b.y - a.y) || 1; return [-(b.y - a.y) / L, (b.x - a.x) / L]; }
    const A = arcAngles(s, e), u = [x - A.cx, y - A.cy], L = hyp(u[0], u[1]) || 1;     // an arc runs p1 -> p2 with the angle growing: its left = the centre
    return q.rev ? [u[0] / L, u[1] / L] : [-u[0] / L, -u[1] / L];
  }
  /** the nearest place on a chain piece to (x, y) -> [x, y] */
  function nearestOn(s, e, x, y) {
    if (e.t === "line") { const a = pt(s, e.p1), b = pt(s, e.p2), u = [b.x - a.x, b.y - a.y], L2 = u[0] * u[0] + u[1] * u[1]; const t = L2 ? Math.max(0, Math.min(1, ((x - a.x) * u[0] + (y - a.y) * u[1]) / L2)) : 0; return [a.x + t * u[0], a.y + t * u[1]]; }
    const A = arcAngles(s, e); let t = Math.atan2(y - A.cy, x - A.cx); while (t < A.a0) t += TAU;
    if (t > A.a1) { const p1 = pt(s, e.p1), p2 = pt(s, e.p2); return hyp(p1.x - x, p1.y - y) < hyp(p2.x - x, p2.y - y) ? [p1.x, p1.y] : [p2.x, p2.y]; }
    return [A.cx + A.r * Math.cos(t), A.cy + A.r * Math.sin(t)];
  }
  /** which side of the picked geometry (x, y) is, and how far: {side: +1 left of the chain / outside a circle, -1 the
   *  other, dist, chain index} - Offset's "where the pointer is" */
  function offsetSide(s, ids, x, y) {
    let best = null;
    chainsOf(s, ids).forEach((c, ci) => { for (const q of c.loop) { const p = nearestOn(s, q.e, x, y), d = hyp(x - p[0], y - p[1]); if (!best || d < best.dist) { const n = leftNormal(s, q, p[0], p[1]); best = { side: (x - p[0]) * n[0] + (y - p[1]) * n[1] >= 0 ? 1 : -1, dist: d, chain: ci }; } } });
    for (const id of ids) { const e = ent(s, id); if (e && e.t === "circle") { const c = pt(s, e.c), r = hyp(x - c.x, y - c.y), d = Math.abs(r - e.r); if (!best || d < best.dist) best = { side: r >= e.r ? 1 : -1, dist: d, circle: id }; } }
    return best;
  }
  /** where two infinite lines / full circles meet -> [[x, y]...] (Offset's joins) */
  function meetAll(A, B) {
    if (A.k === "seg" && B.k === "seg") { const r = [A.b[0] - A.a[0], A.b[1] - A.a[1]], q = [B.b[0] - B.a[0], B.b[1] - B.a[1]], den = r[0] * q[1] - r[1] * q[0]; if (Math.abs(den) < 1e-12) return []; const w = [B.a[0] - A.a[0], B.a[1] - A.a[1]], t = (w[0] * q[1] - w[1] * q[0]) / den; return [[A.a[0] + t * r[0], A.a[1] + t * r[1]]]; }
    if (A.k === "circ" && B.k === "circ") return crossings(Object.assign({}, A, { a0: null }), Object.assign({}, B, { a0: null }), false).map((c) => c.p);
    const S_ = A.k === "seg" ? A : B, C_ = A.k === "seg" ? B : A, u = [S_.b[0] - S_.a[0], S_.b[1] - S_.a[1]], f = [S_.a[0] - C_.c[0], S_.a[1] - C_.c[1]];
    const a = u[0] * u[0] + u[1] * u[1], b = 2 * (f[0] * u[0] + f[1] * u[1]), c = f[0] * f[0] + f[1] * f[1] - C_.r * C_.r, D = b * b - 4 * a * c;
    if (a < 1e-12 || D < -1e-9) return [];
    const sq = Math.sqrt(Math.max(0, D)); return (D > 1e-12 ? [(-b - sq) / (2 * a), (-b + sq) / (2 * a)] : [-b / (2 * a)]).map((t) => [S_.a[0] + t * u[0], S_.a[1] + t * u[1]]);
  }
  /** OFFSET entities by d -> {ok, ents, why}. The picked lines / arcs are walked as chains (joined end to end); each
   *  chain moves to ONE side as a whole: d > 0 = OUT (away from the area a closed chain encloses; to the left of an
   *  open chain), d < 0 = in; circles r + d. opts.toward = [x, y]: the side that point is on (d's size only) - what
   *  the Offset tool does. Joined ends meet (lines at their crossing, arcs where the new circles cross the next piece),
   *  so a rounded rectangle stays closed. Each new line is parallel to its own + kept |d| away, each new arc / circle
   *  concentric with r - r0 kept. opts.preview: no constraints, no solve (the drawing while the pointer moves). */
  function offset(s, ids, d, opts) {
    const o = opts || {}, out = [], P = (id) => pt(s, id), dist = Math.abs(d);
    if (!(dist > 1e-9)) return { ok: false, ents: [], why: "a distance above 0" };
    const tw = o.toward ? offsetSide(s, ids, o.toward[0], o.toward[1]) : null;
    for (const id of ids) {
      const e = ent(s, id); if (!e || e.axis || e.t !== "circle") continue;
      const sg = tw ? (() => { const c = P(e.c); return hyp(o.toward[0] - c.x, o.toward[1] - c.y) >= e.r ? 1 : -1; })() : Math.sign(d), r2 = e.r + sg * dist; if (r2 <= 0.5) continue;
      const c = addEnt(s, { t: "circle", c: e.c, r: r2, cons: !!e.cons }); if (!o.preview) addCon(s, { t: "rdiff", a: c, b: e.id, x: r2 - e.r }); out.push(c);
    }
    const made = [];
    for (const ch of chainsOf(s, ids)) {
      let sg;
      if (tw) { const n = ch.loop.map((q) => q.e).reduce((m, e) => { const p = nearestOn(s, e, o.toward[0], o.toward[1]), dd = hyp(o.toward[0] - p[0], o.toward[1] - p[1]); return !m || dd < m.d ? { d: dd, e, p } : m; }, null), q = ch.loop.find((x) => x.e === n.e), nn = leftNormal(s, q, n.p[0], n.p[1]);
        sg = (o.toward[0] - n.p[0]) * nn[0] + (o.toward[1] - n.p[1]) * nn[1] >= 0 ? 1 : -1; }
      else if (ch.closed) { const A = signedArea(flatten(s, ch.loop, 12)); sg = Math.sign(d) * (A > 0 ? -1 : 1); }     // A > 0: the left is inside
      else sg = Math.sign(d);
      // each piece moved: its ends (at e.p1 / e.p2) + what it is
      const pcs = ch.loop.map((q) => {
        const e = q.e;
        if (e.t === "line") { const a = P(e.p1), b = P(e.p2), n = leftNormal(s, q, a.x, a.y), v = [n[0] * sg * dist, n[1] * sg * dist]; return { q, line: true, p1: [a.x + v[0], a.y + v[1]], p2: [b.x + v[0], b.y + v[1]] }; }
        const A = arcAngles(s, e), r2 = A.r + (q.rev ? 1 : -1) * sg * dist;
        return { q, arc: true, r: r2, c: [A.cx, A.cy], r0: A.r, p1: [A.cx + r2 * Math.cos(A.a0), A.cy + r2 * Math.sin(A.a0)], p2: [A.cx + r2 * Math.cos(A.a1), A.cy + r2 * Math.sin(A.a1)] };
      });
      if (pcs.some((p) => p.arc && p.r <= 0.5)) return { ok: false, ents: out, why: "an arc's radius would be 0 or less - a smaller distance (or the other side)" };
      const endK = (p, atEnd) => ((p.q.rev ? !atEnd : atEnd) ? "p2" : "p1");     // the key of the piece's end in the chain's direction
      const geo = (p) => (p.line ? { k: "seg", a: p.p1, b: p.p2 } : { k: "circ", c: p.c, r: p.r });
      const n = pcs.length, joins = ch.closed ? n : n - 1;
      for (let i = 0; i < joins; i++) {
        const A = pcs[i], B = pcs[(i + 1) % n], ka = endK(A, true), kb = endK(B, false), pa = A[ka], pb = B[kb];
        let p = null;
        if (hyp(pa[0] - pb[0], pa[1] - pb[1]) < 1e-6) p = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
        else {
          const Y = meetAll(geo(A), geo(B));
          const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
          if (Y.length) p = Y.reduce((m, c) => (!m || hyp(c[0] - mid[0], c[1] - mid[1]) < hyp(m[0] - mid[0], m[1] - mid[1]) ? c : m), null);
        }
        if (p) { A[ka] = p; B[kb] = p; A[ka + "j"] = B[kb + "j"] = { p }; }
      }
      for (const pc of pcs) for (const k of ["p1", "p2"]) { const j = pc[k + "j"]; if (j) { if (!j.id) j.id = addPoint(s, j.p[0], j.p[1]); pc[k + "id"] = j.id; } else pc[k + "id"] = addPoint(s, pc[k][0], pc[k][1]); }
      for (const pc of pcs) {
        const e = pc.q.e; let nid;
        if (pc.arc) { nid = addEnt(s, { t: "arc", c: e.c, p1: pc.p1id, p2: pc.p2id, cons: !!e.cons }); if (!o.preview) addCon(s, { t: "rdiff", a: nid, b: e.id, x: pc.r - pc.r0 }); }
        else { nid = addEnt(s, { t: "line", p1: pc.p1id, p2: pc.p2id, cons: !!e.cons }); if (!o.preview) { addCon(s, { t: "parallel", a: nid, b: e.id }); addDim(s, Object.assign(dimFrom(s, "ptline", [pc.p1id, e.id]), { v: dist, driven: false })); } }
        out.push(nid); made.push(nid);
      }
    }
    if (o.preview) return { ok: true, ents: out };
    // a dimension per line over-constrains a closed chain where the corners already fix it: the extra ones become driven
    for (const m of s.dims) if (!m.driven && m.t === "ptline" && made.some((id) => { const e = ent(s, id); return e && e.t === "line" && ptsOf(e).includes(m.refs[0]); })) { m.driven = true; const r0 = dof(s).rank; m.driven = false; const r1 = dof(s).rank; if (r1 <= r0) m.driven = true; }
    const sv = solve(s); measure(s);
    return { ok: sv.ok, ents: out, why: sv.ok ? "" : "the sketch could not take it (over-constrained)" };
  }
  /** a regular POLYGON of n sides inscribed in a construction circle (centre, a corner) -> {ok, lines, circle} */
  function polygon(s, c, v, n) {
    const N = Math.max(3, Math.min(64, Math.round(n || 6))), C = typeof c === "string" ? [pt(s, c).x, pt(s, c).y] : c, r = hyp(v[0] - C[0], v[1] - C[1]); if (r < 1) return { ok: false };
    const cid = typeof c === "string" ? c : addPoint(s, C[0], C[1]), circ = addEnt(s, { t: "circle", c: cid, r, cons: true }), a0 = Math.atan2(v[1] - C[1], v[0] - C[0]);
    const P = []; for (let i = 0; i < N; i++) { const a = a0 + TAU * i / N; P.push(addPoint(s, C[0] + r * Math.cos(a), C[1] + r * Math.sin(a))); }
    const L = P.map((p, i) => addEnt(s, { t: "line", p1: p, p2: P[(i + 1) % N], cons: false }));
    for (const p of P) addCon(s, { t: "onCircle", a: p, b: circ });
    for (let i = 1; i < N; i++) addCon(s, { t: "equal", a: L[0], b: L[i] });
    return { ok: true, lines: L, circle: circ, pts: P };
  }
  /** a SLOT (centre to centre): two half circles + two lines tangent to them, width w -> {ok, ents} */
  function slot(s, c1, c2, w) {
    const r = Math.max(1, w / 2), d = hyp(c2[0] - c1[0], c2[1] - c1[1]); if (d < 1) return { ok: false };
    const u = [(c2[0] - c1[0]) / d, (c2[1] - c1[1]) / d], n = [-u[1] * r, u[0] * r];
    const C1 = addPoint(s, c1[0], c1[1]), C2 = addPoint(s, c2[0], c2[1]);
    const A1 = addPoint(s, c1[0] + n[0], c1[1] + n[1]), A2 = addPoint(s, c2[0] + n[0], c2[1] + n[1]), B1 = addPoint(s, c1[0] - n[0], c1[1] - n[1]), B2 = addPoint(s, c2[0] - n[0], c2[1] - n[1]);
    const top = addEnt(s, { t: "line", p1: A1, p2: A2 }), bot = addEnt(s, { t: "line", p1: B2, p2: B1 });
    const arc2 = arcThrough(s, C2, A2, B2, [c2[0] + u[0] * r, c2[1] + u[1] * r]), arc1 = arcThrough(s, C1, B1, A1, [c1[0] - u[0] * r, c1[1] - u[1] * r]);
    const axis = addEnt(s, { t: "line", p1: C1, p2: C2, cons: true });
    for (const [l, a] of [[top, arc1], [top, arc2], [bot, arc1], [bot, arc2]]) addCon(s, conFrom(s, { t: "tangent", a: l, b: a }));
    addCon(s, { t: "equal", a: arc1, b: arc2 });
    return { ok: true, ents: [top, bot, arc1, arc2, axis] };
  }
  /** a circle by two points of its diameter / through three points */
  function circle2(s, a, b) { return circle(s, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], hyp(b[0] - a[0], b[1] - a[1]) / 2); }
  function circle3p(s, a, b, c) { const C = circle3(a, b, c); return C ? circle(s, [C.x, C.y], C.r) : null; }

  /* ================================ drawing ================================ */
  function fmt(v) { return (Math.round(v * 100) / 100).toString(); }
  /** where a dimension's text goes + its leader lines: {x, y, text, lines: [[x1, y1, x2, y2]]} */
  function dimGeom(s, m) {
    const P = (id) => pt(s, id), r = m.refs || [], at = m.at || [0, -20];
    const text = (m.t === "diameter" ? "⌀" : m.t === "radius" ? "R" : "") + fmt(m.driven ? valueOf(s, m) : m.v) + (m.t === "angle" ? "°" : "");
    const t2 = m.driven ? "(" + text + ")" : text;
    let a, b;
    if (m.t === "len") { const e = ent(s, r[0]); a = P(e.p1); b = P(e.p2); }
    else if (m.t === "dist" || m.t === "hdist" || m.t === "vdist") { a = P(r[0]); b = P(r[1]); }
    else if (m.t === "ptline") { const p = P(r[0]), e = ent(s, r[1]), q1 = P(e.p1), q2 = P(e.p2), u = [q2.x - q1.x, q2.y - q1.y], L2 = u[0] * u[0] + u[1] * u[1] || 1, t = ((p.x - q1.x) * u[0] + (p.y - q1.y) * u[1]) / L2; a = p; b = { x: q1.x + t * u[0], y: q1.y + t * u[1] }; }
    else if (m.t === "radius" || m.t === "diameter") { const e = ent(s, r[0]), c = P(e.c), rr = e.t === "circle" ? e.r : hyp(P(e.p1).x - c.x, P(e.p1).y - c.y); const ang = Math.atan2(at[1], at[0]) || -Math.PI / 4; const e1 = { x: c.x + rr * Math.cos(ang), y: c.y + rr * Math.sin(ang) };
      const from = m.t === "diameter" ? { x: c.x - rr * Math.cos(ang), y: c.y - rr * Math.sin(ang) } : c; const tx = c.x + (rr + 14) * Math.cos(ang), ty = c.y + (rr + 14) * Math.sin(ang);
      return { x: tx, y: ty, text: t2, lines: [[from.x, from.y, e1.x, e1.y], [e1.x, e1.y, tx, ty]], arrows: [[e1.x, e1.y, Math.atan2(e1.y - from.y, e1.x - from.x)]] }; }
    else if (m.t === "angle") { const e1 = ent(s, r[0]), e2 = ent(s, r[1]), m1 = P(e1.p1), m2 = P(e2.p1); const cx = (m1.x + m2.x) / 2 + at[0], cy = (m1.y + m2.y) / 2 + at[1]; return { x: cx, y: cy, text: t2, lines: [] }; }
    if (!a || !b) return null;
    let d = [b.x - a.x, b.y - a.y];
    if (m.t === "hdist") d = [b.x - a.x, 0]; if (m.t === "vdist") d = [0, b.y - a.y];
    const L = hyp(d[0], d[1]) || 1, u = [d[0] / L, d[1] / L], n = [-u[1], u[0]], off = at[0] * n[0] + at[1] * n[1];
    const a2 = m.t === "vdist" ? { x: a.x, y: a.y } : a, b2 = m.t === "hdist" ? { x: b.x, y: a.y } : m.t === "vdist" ? { x: a.x, y: b.y } : b;
    const A = [a2.x + n[0] * off, a2.y + n[1] * off], B = [b2.x + n[0] * off, b2.y + n[1] * off];
    return { x: (A[0] + B[0]) / 2 + n[0] * 8, y: (A[1] + B[1]) / 2 + n[1] * 8, text: t2,
      lines: [[a.x, a.y, A[0], A[1]], [b.x, b.y, B[0], B[1]], [A[0], A[1], B[0], B[1]]], arrows: [[A[0], A[1], Math.atan2(A[1] - B[1], A[0] - B[0])], [B[0], B[1], Math.atan2(B[1] - A[1], B[0] - A[0])]] };
  }
  function strokeEnt(g, s, e) {
    g.beginPath();
    if (e.t === "line") { const a = pt(s, e.p1), b = pt(s, e.p2); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
    else if (e.t === "circle") { const c = pt(s, e.c); g.moveTo(c.x + e.r, c.y); g.arc(c.x, c.y, e.r, 0, TAU); }
    else if (e.t === "arc") { const A = arcAngles(s, e); g.arc(A.cx, A.cy, A.r, A.a0, A.a1); }
    else if (e.t === "spline") { const B = splineBez(s, e); if (B.length) { g.moveTo(B[0][0][0], B[0][0][1]); for (const b of B) g.bezierCurveTo(b[1][0], b[1][1], b[2][0], b[2][1], b[3][0], b[3][1]); } }
    g.stroke();
  }
  function drawDim(g, s, m, color, px) {
    const G = dimGeom(s, m); if (!G) return;
    const k = px || 1;
    g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1 * k;
    g.beginPath(); for (const l of G.lines) { g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); } g.stroke();
    for (const [x, y, a] of G.arrows || []) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7 * k * Math.cos(a - 0.35), y - 7 * k * Math.sin(a - 0.35)); g.lineTo(x - 7 * k * Math.cos(a + 0.35), y - 7 * k * Math.sin(a + 0.35)); g.closePath(); g.fill(); }
    g.font = `${12 * k}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(G.text, G.x, G.y);
    g.restore();
  }
  /** the layer's picture: the entities (not construction), the closed profiles filled (style.fill), the dimensions (style.showDims) */
  function draw(g, s) {
    const st = s.style || {};
    g.save(); g.lineCap = "round"; g.lineJoin = "round";
    if (st.fill) { g.fillStyle = st.fill; for (const p of profiles(s)) { g.beginPath(); for (const poly of [p.poly, ...(p.holes || []).map((h) => h.poly)]) { poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); } g.fill("evenodd"); } }
    g.strokeStyle = st.color || "#000"; g.lineWidth = st.w || 2;
    for (const e of s.ents) if (!e.cons && e.t !== "point") strokeEnt(g, s, e);
    if (st.showDims) for (const m of s.dims) drawDim(g, s, m, st.color || "#000", 1);
    g.restore();
  }
  /** a short name for a constraint (the tab's list) */
  const CON_NAMES = { coincident: "Coincident", onLine: "On line", onCircle: "On circle", horizontal: "Horizontal", vertical: "Vertical", parallel: "Parallel", perpendicular: "Perpendicular", collinear: "Collinear", equal: "Equal", tangent: "Tangent", midpoint: "Midpoint", concentric: "Concentric", fix: "Fix", symmetric: "Symmetric", rdiff: "Offset" };

  const PCSketch = { geo, crossings, cutsOf, trim, extend, cornerOf, arcThrough, fillet, chamfer, copyThrough, mirror, patternRect, patternCirc, offset, chainsOf, offsetSide, profileAt, profilesOfEnts, polygon, slot, circle2, circle3p, splineBez, splinePoly, spline, CON_TYPES, DIM_TYPES, CON_NAMES, conFrom, sideOf, degenerate, create, addPoint, addEnt, addCon, addDim, pt, ent, ptsOf, isOrigin, line, circle, arc, point, circle3, arc3, rect2, rectC, remove, translate, transform,
    vars, rows, solve, dof, rankNull, tryAdd, valueOf, dimFrom, measure, setDim, drag, dragRadius, arcAngles, distTo, pick, profiles, signedArea, inside, flatten, subOf, pathOf, dimGeom, strokeEnt, drawDim, draw, clone };
  if (typeof module !== "undefined" && module.exports) module.exports = PCSketch;
  else root.PCSketch = PCSketch;
})(typeof window !== "undefined" ? window : globalThis);
