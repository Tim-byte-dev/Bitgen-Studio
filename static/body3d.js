/* bitGen Studio — static/body3d.js (2.471.0): PARAMETRIC 3D BODIES - the shared core, window.Body3D.
 *
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" - and for the engine: "in settings give user option for 1 and 3, use the option the user
 * selects but add both 1 and 3" (1 = OpenCascade in the browser, static/body3docc.js; 3 = Blender on this computer,
 * lib/body3d.js + scripts/blend_body3d.py). Both take the same JOB and give back the same MESH.
 *
 * A body = {params: [{name, expr}], features: [feature…], view, look} - every number of a feature is an EXPRESSION
 * ("20", "width / 2 + 3", "d1 * 2", "45 deg", "1 in") over the parameters; changing a parameter or the sketch a feature
 * uses rebuilds the body (the timeline of features, top to bottom, like a parametric CAD program):
 *   extrude  {sketch, profiles ("all" | [i…]), dist, dist2, dir: one | sym | two, mode: new | join | cut | intersect, z}
 *   revolve  {sketch, profiles, axis: "x" | "y" | <a sketch line id>, angle, mode, z}
 *   fillet   {radius, edges: all | top | bottom | vertical | horizontal}
 *   chamfer  {dist, edges}
 *   split    {plane: XY | XZ | YZ, offset, keep: pos | neg}       (Split Body: the other half becomes a new body layer)
 *   shell    {thick, face: top | bottom | none}                    (hollow it - the open face)
 *   each with {id, name, off (suppressed)}.
 * Model space: the sketch's origin = (0, 0, 0), X right, Y up (the picture's y turned over), Z toward you; units = the
 * sketch's pixels (as its dimensions).
 *
 *   expr(src, vars)            a number (throws {message} on a bad one) - + - * / ^ ( ), pi, sin cos tan asin acos atan
 *                              sqrt abs min max round floor ceil, units mm cm m in deg rad
 *   resolveParams(params)      {values: {name: n}, errors: {name: msg}, order} - in dependency order, cycles caught
 *   loopSegs(K, s, loop)       a sketch profile's loop -> segments in model space: {k: L, a, b} | {k: A, a, m, b} (3-point
 *                              arc) | {k: C, c, r} | {k: B, a, c1, c2, b}
 *   profilesOf(K, s, which)    [{outer: segs, holes: [segs…], area}]
 *   axisOf(K, s, ref)          {o: [x, y], d: [dx, dy]} in model space
 *   plan(body, sketchOf, K)    -> {job, errors}: the job for an engine (every number worked out, the profiles as segments)
 *   segPoly(segs, step)        a loop as a polygon (arcs / curves in steps)
 *   featureEdges(mesh, deg)    the edges to draw (a face crease over `deg`, the open edges) -> Float32Array of lines
 *   meshInfo(mesh)             {tris, bbox: [min, max], area, volume}
 *   toSTL(mesh, name)          binary STL bytes;  toGLB(mesh, {color, metal, rough, name}) -> a .glb (bytes)
 *   render(T, mesh, o)         three.js (static/vendor/three-m3d.min.js) -> a canvas: o = {w, h, view {yaw, pitch, roll},
 *                              place {x, y, scale}, color, metal, rough, edges, edgeColor, edgeLines}
 *   engine() / setEngine(e)    the user's choice (Settings ▸ 3D: "occ" | "blender"), from /api/body3d/settings
 *   build(job, engine?)        -> Promise mesh {vertices, normals?, triangles, engine, ms} through the chosen engine
 */
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4, px: 1, deg: Math.PI / 180, rad: 1 };
  const FUNCS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs,
    min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil };
  const FEATURES = ["extrude", "revolve", "fillet", "chamfer", "split", "shell"];
  const MODES = ["new", "join", "cut", "intersect"];
  const EDGE_SETS = ["all", "top", "bottom", "vertical", "horizontal"];
  const bad = (m) => { const e = new Error(m); e.bad = true; return e; };

  /* ================================ expressions ================================ */
  function tokens(src) {
    const out = [], s = String(src == null ? "" : src);
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) { const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i)); if (!m) throw bad("a bad number at " + (i + 1)); out.push({ t: "n", v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)); out.push({ t: "id", v: m[0] }); i += m[0].length; continue; }
      if ("+-*/^(),".includes(c)) { out.push({ t: c }); i++; continue; }
      throw bad(`"${c}" is not allowed`);
    }
    return out;
  }
  function expr(src, vars) {
    if (typeof src === "number") { if (!Number.isFinite(src)) throw bad("not a number"); return src; }
    const T = tokens(src), V = vars || {};
    let i = 0;
    const peek = () => T[i], eat = (t) => { if (!T[i] || T[i].t !== t) throw bad(`"${t}" expected`); return T[i++]; };
    function prim() {
      const k = T[i];
      if (!k) throw bad("the expression ends too early");
      if (k.t === "n") { i++; return unit(k.v); }
      if (k.t === "(") { i++; const v = add(); eat(")"); return unit(v); }
      if (k.t === "-") { i++; return -pow(); }
      if (k.t === "+") { i++; return pow(); }
      if (k.t === "id") {
        i++;
        const n = k.v;
        if (peek() && peek().t === "(" && FUNCS[n]) { i++; const args = [add()]; while (peek() && peek().t === ",") { i++; args.push(add()); } eat(")"); return FUNCS[n](...args); }
        if (n === "pi" || n === "PI") return Math.PI;
        if (Object.prototype.hasOwnProperty.call(V, n)) { const v = V[n]; if (typeof v !== "number" || !Number.isFinite(v)) throw bad(`"${n}" has no value`); return unit(v); }
        throw bad(`"${n}" is not a parameter`);
      }
      throw bad("unexpected " + k.t);
    }
    function unit(v) { const k = T[i]; if (k && k.t === "id" && UNITS[k.v] != null && !(T[i + 1] && T[i + 1].t === "(")) { i++; return v * UNITS[k.v]; } return v; }
    function pow() { const b = prim(); if (peek() && peek().t === "^") { i++; return Math.pow(b, pow()); } return b; }
    function mul() { let v = pow(); while (peek() && (peek().t === "*" || peek().t === "/")) { const o = T[i++].t, r = pow(); v = o === "*" ? v * r : v / r; } return v; }
    function add() { let v = mul(); while (peek() && (peek().t === "+" || peek().t === "-")) { const o = T[i++].t, r = mul(); v = o === "+" ? v + r : v - r; } return v; }
    if (!T.length) throw bad("empty");
    const v = add();
    if (i < T.length) throw bad("unexpected " + T[i].t + " at the end");
    if (!Number.isFinite(v)) throw bad("not a finite number");
    return v;
  }
  const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const RESERVED = new Set(Object.keys(FUNCS).concat(Object.keys(UNITS), ["pi", "PI"]));
  /** the parameters in dependency order: {values, errors, order} */
  function resolveParams(params) {
    const list = (params || []).filter((p) => p && p.name), values = {}, errors = {}, order = [];
    const byName = new Map(); for (const p of list) { if (!NAME.test(p.name) || RESERVED.has(p.name)) errors[p.name] = "not a usable name"; else if (byName.has(p.name)) errors[p.name] = "named twice"; else byName.set(p.name, p); }
    const state = new Map();                // 1 = working on it, 2 = done
    function visit(n, stack) {
      if (state.get(n) === 2) return;
      if (state.get(n) === 1) { for (const m of stack.slice(stack.indexOf(n))) errors[m] = "goes round in a circle (" + stack.slice(stack.indexOf(n)).concat(n).join(" → ") + ")"; return; }
      state.set(n, 1);
      const p = byName.get(n); let ids = [];
      try { ids = tokens(p.expr).filter((t) => t.t === "id" && byName.has(t.v)).map((t) => t.v); } catch (e) { /* the value says why */ }
      for (const d of ids) visit(d, stack.concat(n));
      state.set(n, 2);
      if (errors[n]) return;
      try { values[n] = expr(p.expr, values); order.push(n); } catch (e) { errors[n] = e.message; }
    }
    for (const n of byName.keys()) visit(n, []);
    return { values, errors, order };
  }
  const val = (x, V, what) => { try { return expr(x, V); } catch (e) { throw bad((what ? what + ": " : "") + e.message); } };

  /* ================================ sketch profiles -> model space ================================ */
  const toM = (s, K, x, y) => { const o = K.pt(s, s.origin.pt); return [x - o.x, o.y - y]; };
  function loopSegs(K, s, loop) {
    const out = [];
    for (const { e: id, rev } of loop) {
      const e = typeof id === "string" ? K.ent(s, id) : id; if (!e) continue;
      if (e.t === "line") { const a = K.pt(s, rev ? e.p2 : e.p1), b = K.pt(s, rev ? e.p1 : e.p2); out.push({ k: "L", a: toM(s, K, a.x, a.y), b: toM(s, K, b.x, b.y) }); }
      else if (e.t === "arc") {
        const A = K.arcAngles(s, e), t0 = rev ? A.a1 : A.a0, t1 = rev ? A.a0 : A.a1, tm = (A.a0 + A.a1) / 2;
        const P = (t) => toM(s, K, A.cx + A.r * Math.cos(t), A.cy + A.r * Math.sin(t));
        out.push({ k: "A", a: P(t0), m: P(tm), b: P(t1) });
      } else if (e.t === "circle") { const c = K.pt(s, e.c); out.push({ k: "C", c: toM(s, K, c.x, c.y), r: e.r }); }
      else if (e.t === "spline") {
        let B = K.splineBez(s, e); if (rev) B = B.slice().reverse().map((b) => [b[3], b[2], b[1], b[0]]);
        for (const b of B) out.push({ k: "B", a: toM(s, K, b[0][0], b[0][1]), c1: toM(s, K, b[1][0], b[1][1]), c2: toM(s, K, b[2][0], b[2][1]), b: toM(s, K, b[3][0], b[3][1]) });
      }
    }
    return out;
  }
  function profilesOf(K, s, which) {
    const all = K.profiles(s, { withPaths: false });
    // a hole of a hole is a profile of its own: the outer ones are those that are not a hole of anything
    const holeOf = new Set(); for (const p of all) for (const h of p.holes || []) holeOf.add(h);
    const idx = which === "all" || which == null ? all.map((_, i) => i) : [].concat(which).map((n) => +n).filter((n) => n >= 0 && n < all.length);
    return idx.map((i) => all[i]).filter((p) => which !== "all" && which != null ? true : !holeOf.has(p))
      .map((p) => ({ outer: loopSegs(K, s, p.loop), holes: (p.holes || []).map((h) => loopSegs(K, s, h.loop)), area: p.area }));
  }
  function axisOf(K, s, ref) {
    if (ref === "x" || ref === "X") return { o: [0, 0], d: [1, 0] };
    if (ref === "y" || ref === "Y" || ref == null) return { o: [0, 0], d: [0, 1] };
    const e = K.ent(s, ref);
    if (!e || e.t !== "line") throw bad("the axis is not a line of the sketch");
    const a = K.pt(s, e.p1), b = K.pt(s, e.p2), A = toM(s, K, a.x, a.y), B = toM(s, K, b.x, b.y), L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    return { o: A, d: [(B[0] - A[0]) / L, (B[1] - A[1]) / L] };
  }
  function segPoly(segs, step) {
    const out = [], st = step || 10 * Math.PI / 180;
    for (const g of segs) {
      if (g.k === "L") out.push(g.a);
      else if (g.k === "C") { const n = Math.max(12, Math.ceil(TAU / st)); for (let i = 0; i < n; i++) out.push([g.c[0] + g.r * Math.cos(TAU * i / n), g.c[1] + g.r * Math.sin(TAU * i / n)]); }
      else if (g.k === "A") {
        const c = circ3(g.a, g.m, g.b); if (!c) { out.push(g.a); continue; }
        let t0 = Math.atan2(g.a[1] - c[1], g.a[0] - c[0]), tm = Math.atan2(g.m[1] - c[1], g.m[0] - c[0]), t1 = Math.atan2(g.b[1] - c[1], g.b[0] - c[0]);
        const ccw = ((tm - t0 + TAU) % TAU) < ((t1 - t0 + TAU) % TAU);
        let sweep = ccw ? (t1 - t0 + TAU) % TAU : -((t0 - t1 + TAU) % TAU); if (Math.abs(sweep) < 1e-9) sweep = ccw ? TAU : -TAU;
        const n = Math.max(2, Math.ceil(Math.abs(sweep) / st));
        for (let i = 0; i < n; i++) { const t = t0 + sweep * i / n; out.push([c[0] + c[2] * Math.cos(t), c[1] + c[2] * Math.sin(t)]); }
      } else if (g.k === "B") { const n = 12; for (let i = 0; i < n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * g.a[0] + 3 * u * u * t * g.c1[0] + 3 * u * t * t * g.c2[0] + t * t * t * g.b[0], u * u * u * g.a[1] + 3 * u * u * t * g.c1[1] + 3 * u * t * t * g.c2[1] + t * t * t * g.b[1]]); } }
    }
    return out;
  }
  function circ3(a, b, c) {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-12) return null;
    const A = a[0] * a[0] + a[1] * a[1], B = b[0] * b[0] + b[1] * b[1], C = c[0] * c[0] + c[1] * c[1];
    const x = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d, y = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
    return [x, y, Math.hypot(a[0] - x, a[1] - y)];
  }

  /* ================================ the body -> a job ================================ */
  let fseq = 0;
  const fid = () => "f" + Date.now().toString(36) + (++fseq).toString(36);
  function normFeature(f) {
    const t = FEATURES.includes(f && f.type) ? f.type : null; if (!t) return null;
    const o = Object.assign({ id: f.id || fid(), name: f.name || t[0].toUpperCase() + t.slice(1), off: !!f.off }, f, { type: t });
    if (t === "extrude") Object.assign(o, { dist: o.dist == null ? "20" : String(o.dist), dist2: o.dist2 == null ? "0" : String(o.dist2), dir: ["one", "sym", "two"].includes(o.dir) ? o.dir : "one", mode: MODES.includes(o.mode) ? o.mode : "join", profiles: o.profiles == null ? "all" : o.profiles, z: o.z == null ? "0" : String(o.z), taper: o.taper == null ? "0" : String(o.taper) });
    if (t === "revolve") Object.assign(o, { angle: o.angle == null ? "360" : String(o.angle), axis: o.axis == null ? "y" : o.axis, mode: MODES.includes(o.mode) ? o.mode : "join", profiles: o.profiles == null ? "all" : o.profiles, z: o.z == null ? "0" : String(o.z) });
    if (t === "fillet") Object.assign(o, { radius: o.radius == null ? "2" : String(o.radius), edges: EDGE_SETS.includes(o.edges) ? o.edges : "all" });
    if (t === "chamfer") Object.assign(o, { dist: o.dist == null ? "2" : String(o.dist), edges: EDGE_SETS.includes(o.edges) ? o.edges : "all" });
    if (t === "split") Object.assign(o, { plane: ["XY", "XZ", "YZ"].includes(o.plane) ? o.plane : "XY", offset: o.offset == null ? "0" : String(o.offset), keep: o.keep === "neg" ? "neg" : "pos" });
    if (t === "shell") Object.assign(o, { thick: o.thick == null ? "2" : String(o.thick), face: ["top", "bottom", "none"].includes(o.face) ? o.face : "top" });
    return o;
  }
  function newBody(o) {
    return Object.assign({ v: 1, params: [], features: [], view: { yaw: -35, pitch: 25, roll: 0 }, look: { color: "#b8c4d0", metal: 0.1, rough: 0.45, edges: true, edgeColor: "#1b2733" } }, o || {});
  }
  /** body -> {job, errors: [{id, msg}], values}; sketchOf(layerId) -> the sketch data (s) | null; K = PCSketch */
  function plan(body, sketchOf, K) {
    const { values, errors: perr } = resolveParams(body.params);
    const errors = Object.keys(perr).map((n) => ({ id: "param:" + n, msg: n + ": " + perr[n] }));
    const ops = [];
    let first = true;
    for (const f0 of body.features || []) {
      const f = normFeature(f0); if (!f || f.off) continue;
      try {
        if (f.type === "extrude" || f.type === "revolve") {
          const s = sketchOf(f.sketch); if (!s) throw bad("its sketch is gone");
          const profiles = profilesOf(K, s, f.profiles); if (!profiles.length) throw bad("the sketch has no closed profile");
          const z = val(f.z, values, "plane offset");
          if (f.type === "extrude") {
            const d = val(f.dist, values, "distance"), d2 = f.dir === "two" ? val(f.dist2, values, "second distance") : 0;
            if (f.dir !== "two" && Math.abs(d) < 1e-6) throw bad("the distance is 0");
            ops.push({ op: "extrude", id: f.id, profiles, z, dist: d, dist2: d2, dir: f.dir, mode: first ? "new" : f.mode, taper: val(f.taper, values, "taper") });
          } else {
            const a = val(f.angle, values, "angle"); if (Math.abs(a) < 1e-6) throw bad("the angle is 0");
            ops.push({ op: "revolve", id: f.id, profiles, z, axis: axisOf(K, s, f.axis), angle: Math.max(-360, Math.min(360, a)), mode: first ? "new" : f.mode });
          }
          first = false;
        } else {
          if (first) throw bad("make a body first (Extrude or Revolve)");
          if (f.type === "fillet") { const r = val(f.radius, values, "radius"); if (r <= 0) throw bad("the radius must be more than 0"); ops.push({ op: "fillet", id: f.id, radius: r, edges: f.edges }); }
          if (f.type === "chamfer") { const d = val(f.dist, values, "distance"); if (d <= 0) throw bad("the distance must be more than 0"); ops.push({ op: "chamfer", id: f.id, dist: d, edges: f.edges }); }
          if (f.type === "split") ops.push({ op: "split", id: f.id, plane: f.plane, offset: val(f.offset, values, "offset"), keep: f.keep });
          if (f.type === "shell") { const t = val(f.thick, values, "thickness"); if (t <= 0) throw bad("the thickness must be more than 0"); ops.push({ op: "shell", id: f.id, thick: t, face: f.face }); }
        }
      } catch (e) { errors.push({ id: f.id, msg: f.name + ": " + e.message }); }
    }
    return { job: { v: 1, ops, tol: 0.05 }, errors, values };
  }

  /* ================================ meshes ================================ */
  function meshInfo(m) {
    const V = m.vertices, T = m.triangles, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < V.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], V[i + k]); mx[k] = Math.max(mx[k], V[i + k]); }
    let area = 0, vol = 0;
    for (let i = 0; i < T.length; i += 3) {
      const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      vol += (V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1]) - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c]) + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c])) / 6;
    }
    return { tris: T.length / 3, bbox: [mn, mx], area, volume: Math.abs(vol) };
  }
  /** the edges to draw: where two faces meet at more than `deg`, and open edges (vertices merged by position) */
  function featureEdges(m, deg) {
    const V = m.vertices, T = m.triangles, lim = Math.cos(((deg == null ? 30 : deg) * Math.PI) / 180);
    const key = (i) => Math.round(V[i * 3] * 1e4) + "," + Math.round(V[i * 3 + 1] * 1e4) + "," + Math.round(V[i * 3 + 2] * 1e4);
    const id = new Map(), uid = []; for (let i = 0; i < V.length / 3; i++) { const k = key(i); if (!id.has(k)) id.set(k, i); uid.push(id.get(k)); }
    const nrm = []; for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], l = Math.hypot(...n) || 1; nrm.push([n[0] / l, n[1] / l, n[2] / l]);
    }
    const E = new Map();
    for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = uid[T[t + k]], b = uid[T[t + (k + 1) % 3]]; if (a === b) continue;
      const kk = a < b ? a + "_" + b : b + "_" + a; if (!E.has(kk)) E.set(kk, { a, b, f: [] }); E.get(kk).f.push(t / 3);
    }
    const out = [];
    for (const e of E.values()) {
      let draw = e.f.length !== 2;
      if (!draw) { const p = nrm[e.f[0]], q = nrm[e.f[1]]; draw = p[0] * q[0] + p[1] * q[1] + p[2] * q[2] < lim; }
      if (draw) out.push(V[e.a * 3], V[e.a * 3 + 1], V[e.a * 3 + 2], V[e.b * 3], V[e.b * 3 + 1], V[e.b * 3 + 2]);
    }
    return Float32Array.from(out);
  }
  function toSTL(m, name) {
    const V = m.vertices, T = m.triangles, n = T.length / 3, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    const head = String(name || "bitGen body").slice(0, 79); for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 127);
    dv.setUint32(80, n, true);
    for (let t = 0; t < n; t++) {
      const o = 84 + t * 50, ia = T[t * 3] * 3, ib = T[t * 3 + 1] * 3, ic = T[t * 3 + 2] * 3;
      const ux = V[ib] - V[ia], uy = V[ib + 1] - V[ia + 1], uz = V[ib + 2] - V[ia + 2], vx = V[ic] - V[ia], vy = V[ic + 1] - V[ia + 1], vz = V[ic + 2] - V[ia + 2];
      const N = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], l = Math.hypot(...N) || 1;
      for (let k = 0; k < 3; k++) dv.setFloat32(o + k * 4, N[k] / l, true);
      [ia, ib, ic].forEach((p, j) => { for (let k = 0; k < 3; k++) dv.setFloat32(o + 12 + j * 12 + k * 4, V[p + k], true); });
    }
    return new Uint8Array(buf);
  }
  const hexRGB = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); const n = m ? parseInt(m[1], 16) : 0xb8c4d0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  /** a .glb: one mesh, positions + normals (flat per triangle) + indices, one PBR material; model units -> metres / 100
   *  so a 200-pixel body is 2 m in a 3D layer (glTF is Y up - as model space) */
  function toGLB(m, o) {
    const opt = o || {}, k = opt.scale == null ? 0.01 : opt.scale;
    const V = m.vertices, T = m.triangles, n = T.length;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(n);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let t = 0; t < n; t += 3) {
      const P = [T[t], T[t + 1], T[t + 2]].map((i) => [V[i * 3] * k, V[i * 3 + 1] * k, V[i * 3 + 2] * k]);
      const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], v = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
      const N = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...N) || 1;
      for (let j = 0; j < 3; j++) { for (let q = 0; q < 3; q++) { pos[(t + j) * 3 + q] = P[j][q]; nor[(t + j) * 3 + q] = N[q] / l; mn[q] = Math.min(mn[q], P[j][q]); mx[q] = Math.max(mx[q], P[j][q]); } idx[t + j] = t + j; }
    }
    const bin = new Uint8Array(pos.byteLength + nor.byteLength + idx.byteLength);
    bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(nor.buffer), pos.byteLength); bin.set(new Uint8Array(idx.buffer), pos.byteLength * 2);
    const [r, g, b] = hexRGB(opt.color);
    const gltf = { asset: { version: "2.0", generator: "bitGen Studio body3d" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: opt.name || "body" }],
      meshes: [{ name: opt.name || "body", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
      materials: [{ name: "body", pbrMetallicRoughness: { baseColorFactor: [r, g, b, 1], metallicFactor: opt.metal == null ? 0.1 : +opt.metal, roughnessFactor: opt.rough == null ? 0.45 : +opt.rough } }],
      buffers: [{ byteLength: bin.byteLength }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength, byteLength: nor.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength * 2, byteLength: idx.byteLength, target: 34963 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: n, type: "VEC3", min: mn, max: mx }, { bufferView: 1, componentType: 5126, count: n, type: "VEC3" }, { bufferView: 2, componentType: 5125, count: n, type: "SCALAR" }] };
    let js = new TextEncoder().encode(JSON.stringify(gltf)); const jpad = (4 - (js.length % 4)) % 4;
    if (jpad) { const t = new Uint8Array(js.length + jpad); t.set(js); t.fill(0x20, js.length); js = t; }
    const total = 12 + 8 + js.length + 8 + bin.length, out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
    const bo = 20 + js.length; dv.setUint32(bo, bin.length, true); dv.setUint32(bo + 4, 0x004e4942, true); out.set(bin, bo + 8);
    return out;
  }

  /* ================================ drawing it (three.js) ================================ */
  let R = null;
  function render(T, m, o) {
    const w = Math.max(1, Math.round(o.w)), h = Math.max(1, Math.round(o.h));
    if (!R) { R = new T.WebGLRenderer({ canvas: root.document.createElement("canvas"), alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false }); R.setClearColor(0x000000, 0); }
    R.setSize(w, h, false);
    const scene = new T.Scene(), geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(Array.from(m.vertices), 3));
    geo.setIndex(Array.from(m.triangles)); geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ color: new T.Color(o.color || "#b8c4d0"), metalness: o.metal == null ? 0.1 : o.metal, roughness: o.rough == null ? 0.45 : o.rough, flatShading: !m.smooth, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: T.DoubleSide });
    const grp = new T.Group(); grp.add(new T.Mesh(geo, mat));
    if (o.edges !== false) {
      const eg = new T.BufferGeometry(); eg.setAttribute("position", new T.Float32BufferAttribute(Array.from(o.edgeLines || featureEdges(m, 30)), 3));
      grp.add(new T.LineSegments(eg, new T.LineBasicMaterial({ color: new T.Color(o.edgeColor || "#1b2733") })));
    }
    const v = o.view || {}, rad = (d) => (d || 0) * Math.PI / 180;
    grp.rotation.order = "XYZ"; grp.rotation.set(rad(v.pitch), rad(v.yaw), rad(v.roll));
    scene.add(grp);
    scene.add(new T.HemisphereLight(0xffffff, 0x444450, 1.3));
    const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(0.6, 1, 1.4); scene.add(sun);
    const fill = new T.DirectionalLight(0xffffff, 0.5); fill.position.set(-1, -0.3, 0.5); scene.add(fill);
    // orthographic, 1 model unit = place.scale pixels, the model origin at place.x / place.y of the picture
    const p = o.place || { x: w / 2, y: h / 2, scale: 1 }, k = p.scale || 1;
    const cam = new T.OrthographicCamera(-p.x / k, (w - p.x) / k, p.y / k, -(h - p.y) / k, -1e5, 1e5);
    cam.position.set(0, 0, 1e4); cam.lookAt(0, 0, 0);
    R.render(scene, cam);
    geo.dispose(); mat.dispose();
    return R.domElement;
  }

  /* ================================ the engines ================================ */
  let ENGINE = null;
  function engine() {
    if (ENGINE) return Promise.resolve(ENGINE);
    return fetch("/api/body3d/settings").then((r) => r.json()).then((j) => (ENGINE = j.engine === "blender" ? "blender" : "occ")).catch(() => (ENGINE = "occ"));
  }
  function setEngine(e) { ENGINE = e === "blender" ? "blender" : "occ"; return fetch("/api/body3d/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: ENGINE }) }).then((r) => r.json()).catch(() => ({ engine: ENGINE })); }
  function build(job, eng) {
    const t0 = Date.now();
    return (eng ? Promise.resolve(eng) : engine()).then((e) => {
      if (e === "blender") {
        return fetch("/api/body3d/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) })
          .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "Blender: " + r.status); return j; }))
          .then((j) => Object.assign(j.mesh, { engine: "blender", ms: Date.now() - t0, warnings: j.warnings || [] }));
      }
      if (!root.Body3DOCC) throw new Error("the OpenCascade engine (static/body3docc.js) is not loaded");
      return root.Body3DOCC.build(job).then((m) => Object.assign(m, { engine: "occ", ms: Date.now() - t0 }));
    });
  }

  const Body3D = { TAU, UNITS, FEATURES, MODES, EDGE_SETS, tokens, expr, resolveParams, loopSegs, profilesOf, axisOf, segPoly, circ3, normFeature, newBody, plan,
    meshInfo, featureEdges, toSTL, toGLB, hexRGB, render, engine, setEngine, build };
  if (typeof module !== "undefined" && module.exports) module.exports = Body3D;
  else root.Body3D = Body3D;
})(typeof window !== "undefined" ? window : globalThis);
