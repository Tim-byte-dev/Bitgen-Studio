/* bitGen Studio — ext/pushpulldock/ppgeo.js (2.619.0): THE PUSH/PULL MODEL - faces, edges, push/pull, offset, split
 * (window.PPGeo / require()).
 *
 * Tim (verbatim): "can we add a final docker, i feel this one will complete bitgen ... looks like a sketchup made for linux"
 * - asked: our own SketchUp-style docker (IngeTrazo is GPL desktop software - none of its code is used here).
 *
 * THE MODEL (Z up, metres - what the file keeps):
 *   {v: [[x, y, z] ...], f: [{id, loops: [[vi ...] outer, [vi ...] hole ...], mat, grp}], e: [{id, a, b, grp}] (lines that
 *    bound no face), g: [{id, name}] (groups), n (the next id)}
 *   A face's outer loop runs counter-clockwise seen from its normal's side, its holes clockwise. Faces SHARE vertices (an
 *   edge shared by two faces = the same two vertex indices), so push/pull knows a face's neighbours.
 *
 *   addFace(M, pts, o)        a closed loop -> a face. Drawn INSIDE a face (same plane) = a face in a hole of it (push it =
 *                             a pocket / a boss); drawn round coplanar faces = they become its holes; on the ground it
 *                             faces up. -> the face (null: too small / not flat)
 *   addEdge(M, a, b, o)       a line; ends on a face's border with its middle inside = the face SPLIT in two
 *   pushPull(M, fid, d)       d metres along the face's normal: a lone face = a solid (its cap + sides); a face whose
 *                             neighbours are all square to it = moved (the sides stretch); else (a face in a hole, a face
 *                             with sloped neighbours) = new sides + the face moved; a pocket that reaches a face on the far
 *                             side = a hole through it. -> {mode, face}
 *   offset(M, fid, d)         a loop d inside the face's border -> a new face in a hole of it (walls, frames, windows)
 *   move / rotateZ / scale(M, vids, ...)   the vertices of what is picked; copyOf(M, sel) duplicates it first
 *   remove(M, sel), group(M, sel, name), explode(M, gid), gc(M) (unused vertices dropped, indices kept tidy)
 *   faceNormal, facePlane, faceArea, loopPts, neighbours, bbox, selVerts, closestOnLine, linesClosest, toOrtho
 * Everything here is pure (Node: scripts/test-pushpull619.js).
 */
(function (root) {
  "use strict";
  const EPS = 1e-6, PEPS = 1e-5;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const r9 = (x) => Math.round(x * 1e9) / 1e9;
  const clean = (p) => [r9(+p[0] || 0), r9(+p[1] || 0), r9(+p[2] || 0)];

  function newModel() { return { v: [], f: [], e: [], g: [], n: 1 }; }
  function nextId(M) { return M.n++; }
  /** a vertex at p (an existing one within 1e-5 m is reused) -> its index */
  const near = (v, q) => v && Math.abs(v[0] - q[0]) < PEPS && Math.abs(v[1] - q[1]) < PEPS && Math.abs(v[2] - q[2]) < PEPS;
  const vkey = (q) => Math.round(q[0] * 1e4) + "," + Math.round(q[1] * 1e4) + "," + Math.round(q[2] * 1e4);
  /** a vertex at p (an existing one within 1e-5 m is reused - a hash of 0.1 mm cells, checked; a full look for small models) */
  function vAt(M, p) {
    const q = clean(p), k = vkey(q);
    if (!M._vx) Object.defineProperty(M, "_vx", { value: new Map(), writable: true, enumerable: false, configurable: true });
    const hit = M._vx.get(k); if (hit != null && near(M.v[hit], q)) return hit;
    if (M.v.length < 4000) for (let i = 0; i < M.v.length; i++) if (near(M.v[i], q)) { M._vx.set(k, i); return i; }
    M.v.push(q); M._vx.set(k, M.v.length - 1); return M.v.length - 1;
  }
  function vNew(M, p) { M.v.push(clean(p)); return M.v.length - 1; }
  const face = (M, id) => M.f.find((x) => x.id === id) || null;
  const loopPts = (M, loop) => loop.map((i) => M.v[i]);
  /** Newell's normal of points (not normalized - its length is twice the area) */
  function newell(P) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); }
    return [x, y, z];
  }
  function faceNormal(M, F) { return norm(newell(loopPts(M, F.loops[0]))); }
  function facePlane(M, F) { const n = faceNormal(M, F), p = M.v[F.loops[0][0]]; return { n, d: dot(n, p), p }; }
  function loopArea(P) { return len(newell(P)) / 2; }
  function faceArea(M, F) { let a = loopArea(loopPts(M, F.loops[0])); for (let k = 1; k < F.loops.length; k++) a -= loopArea(loopPts(M, F.loops[k])); return a; }
  /** a plane's 2D axes (u, w) - the face drawn flat */
  function basis(n) {
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = norm(cross(a, n)), w = cross(n, u);
    return { u, w };
  }
  const to2 = (p, o, B) => { const d = sub(p, o); return [dot(d, B.u), dot(d, B.w)]; };
  function inPoly2(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function onSeg2(pt, a, b, eps) {
    const ab = [b[0] - a[0], b[1] - a[1]], ap = [pt[0] - a[0], pt[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1];
    if (L < 1e-18) return Math.hypot(ap[0], ap[1]) < eps;
    const t = (ap[0] * ab[0] + ap[1] * ab[1]) / L; if (t < -1e-9 || t > 1 + 1e-9) return false;
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t) < eps;
  }
  const onBorder2 = (pt, poly) => poly.some((a, i) => onSeg2(pt, a, poly[(i + 1) % poly.length], 1e-6));
  /** strictly inside (not on the border) */
  const inside2 = (pt, poly) => !onBorder2(pt, poly) && inPoly2(pt, poly);
  function coplanar(M, F, pts) {
    const P = facePlane(M, F);
    return pts.every((p) => Math.abs(dot(P.n, p) - P.d) < 1e-6);
  }
  const sameGroup = (a, b) => (a || null) === (b || null);
  const edgeKey = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  function loopEdges(loop) { return loop.map((a, i) => [a, loop[(i + 1) % loop.length]]); }
  function faceEdgeKeys(F) { const s = new Set(); F.loops.forEach((l) => loopEdges(l).forEach(([a, b]) => s.add(edgeKey(a, b)))); return s; }
  /** faces sharing an edge with F */
  function neighbours(M, F) {
    const keys = faceEdgeKeys(F);
    return M.f.filter((G) => G !== F && G.loops.some((l) => loopEdges(l).some(([a, b]) => keys.has(edgeKey(a, b)))));
  }
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  /** faces sitting in F's holes (their outer loop = one of F's holes) */
  function innerFaces(M, F) { return M.f.filter((G) => G !== F && F.loops.slice(1).some((h) => sameSet(h, G.loops[0]))); }
  /** the face whose hole F fills */
  function hostOf(M, F) { return M.f.find((H) => H !== F && H.loops.slice(1).some((h) => sameSet(h, F.loops[0]))) || null; }

  /* ---------------- building */
  function addFace(M, pts, o) {
    const opt = o || {};
    let P = pts.map(clean);
    for (let i = P.length - 1; i > 0; i--) if (len(sub(P[i], P[i - 1])) < PEPS) P.splice(i, 1);
    if (P.length > 2 && len(sub(P[0], P[P.length - 1])) < PEPS) P.pop();
    if (P.length < 3) return null;
    let nn = newell(P); if (len(nn) / 2 < 1e-9) return null;
    let n = norm(nn);
    const pl = dot(n, P[0]);
    if (P.some((p) => Math.abs(dot(n, p) - pl) > 1e-5)) return null;              // not flat
    // the host: a coplanar face (same group) this loop sits strictly inside
    const host = M.f.find((F) => sameGroup(F.grp, opt.grp) && coplanar(M, F, P) && (() => {
      const H = facePlane(M, F), B = basis(H.n), o2 = H.p, outer = loopPts(M, F.loops[0]).map((q) => to2(q, o2, B));
      const holes = F.loops.slice(1).map((l) => loopPts(M, l).map((q) => to2(q, o2, B)));
      const mine = P.map((q) => to2(q, o2, B));
      return mine.every((q) => inside2(q, outer) && !holes.some((h) => inPoly2(q, h)));
    })());
    if (host) { const hn = faceNormal(M, host); if (dot(hn, n) < 0) { P.reverse(); n = mul(n, -1); } }
    else if (Math.abs(n[2]) > 1 - 1e-9 && Math.abs(P[0][2]) < 1e-9 && n[2] < 0 && !opt.keepWinding) { P.reverse(); n = mul(n, -1); }   // on the ground: up
    const loop = P.map((p) => vAt(M, p));
    const F = { id: nextId(M), loops: [loop], mat: opt.mat != null ? opt.mat : host ? host.mat : null, grp: opt.grp || null };
    // coplanar faces of the group inside this loop -> its holes
    if (!host) {
      const B = basis(n), o2 = P[0], mine = P.map((q) => to2(q, o2, B));
      M.f.forEach((G) => {
        if (!sameGroup(G.grp, F.grp) || !coplanar(M, G, P)) return;
        const g2 = loopPts(M, G.loops[0]).map((q) => to2(q, o2, B));
        if (g2.every((q) => inside2(q, mine))) F.loops.push(G.loops[0].slice().reverse());
      });
    }
    if (host) host.loops.push(loop.slice().reverse());
    M.f.push(F);
    // its border lines replace stray lines that ran there
    const keys = faceEdgeKeys(F); M.e = M.e.filter((E) => !keys.has(edgeKey(E.a, E.b)));
    return F;
  }
  /** a vertex on a face border / a line at p (inserted into every loop + line that runs through it) -> its index */
  function insertOnEdge(M, p) {
    const q = clean(p), at = vAt(M, q);
    const onAB = (a, b) => { if (a === at || b === at) return false; const A = M.v[a], Bv = M.v[b], ab = sub(Bv, A), ap = sub(q, A), L = dot(ab, ab); if (L < 1e-18) return false;
      const t = dot(ap, ab) / L; if (t <= 1e-9 || t >= 1 - 1e-9) return false; return len(sub(ap, mul(ab, t))) < 1e-6; };
    M.f.forEach((F) => F.loops.forEach((l) => { for (let k = 0; k < l.length; k++) { const a = l[k], b = l[(k + 1) % l.length]; if (onAB(a, b)) { l.splice(k + 1, 0, at); k++; } } }));
    const more = [];
    M.e.forEach((E) => { if (onAB(E.a, E.b)) { more.push({ id: nextId(M), a: at, b: E.b, grp: E.grp || null }); E.b = at; } });
    M.e.push(...more);
    return at;
  }
  function addEdge(M, a, b, o) {
    const opt = o || {}, A = clean(a), Bp = clean(b);
    if (len(sub(A, Bp)) < PEPS) return null;
    // a split: both ends on one face's outer border, its middle inside, nothing of the border crossed
    for (const F of M.f) {
      if (!sameGroup(F.grp, opt.grp) || !coplanar(M, F, [A, Bp])) continue;
      const H = facePlane(M, F), Bs = basis(H.n), o2 = H.p, outer = loopPts(M, F.loops[0]).map((q) => to2(q, o2, Bs));
      const a2 = to2(A, o2, Bs), b2 = to2(Bp, o2, Bs), m2 = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
      if (!onBorder2(a2, outer) || !onBorder2(b2, outer) || !inside2(m2, outer)) continue;
      if (F.loops.slice(1).some((h) => inPoly2(m2, loopPts(M, h).map((q) => to2(q, o2, Bs))))) continue;
      const crosses = outer.some((p, i) => { const q = outer[(i + 1) % outer.length]; return segX(a2, b2, p, q); });
      if (crosses) continue;
      const ia = insertOnEdge(M, A), ib = insertOnEdge(M, Bp);
      const L = F.loops[0], i = L.indexOf(ia), j = L.indexOf(ib);
      if (i < 0 || j < 0 || i === j) continue;
      const one = [], two = [];
      for (let k = i; ; k = (k + 1) % L.length) { one.push(L[k]); if (k === j) break; }
      for (let k = j; ; k = (k + 1) % L.length) { two.push(L[k]); if (k === i) break; }
      if (one.length < 3 || two.length < 3) continue;
      const holes = F.loops.slice(1);
      const G = { id: nextId(M), loops: [two], mat: F.mat, grp: F.grp };
      F.loops = [one];
      const two2 = two.map((x) => to2(M.v[x], o2, Bs));
      holes.forEach((h) => { const c = to2(M.v[h[0]], o2, Bs); (inPoly2(c, two2) ? G : F).loops.push(h); });
      M.f.push(G);
      return { split: [F.id, G.id] };
    }
    const ia = vAt(M, A), ib = vAt(M, Bp);
    if (M.e.some((E) => edgeKey(E.a, E.b) === edgeKey(ia, ib))) return null;
    if (M.f.some((F) => faceEdgeKeys(F).has(edgeKey(ia, ib)))) return null;
    const E = { id: nextId(M), a: ia, b: ib, grp: opt.grp || null };
    M.e.push(E); return { edge: E.id };
  }
  /** do segments a-b and p-q cross at a point inside both (touching ends do not count) */
  function segX(a, b, p, q) {
    const d = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    const d1 = d(p, q, a), d2 = d(p, q, b), d3 = d(a, b, p), d4 = d(a, b, q);
    return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
  }

  /* ---------------- push / pull */
  function pushPull(M, fid, dist) {
    const F = face(M, fid); if (!F) throw new Error("no such face");
    const d = +dist; if (!Number.isFinite(d) || Math.abs(d) < 1e-6) return { mode: "none", face: F.id };
    const n = faceNormal(M, F), off = mul(n, d);
    const inner = innerFaces(M, F);
    const vs = new Set(); F.loops.forEach((l) => l.forEach((i) => vs.add(i)));
    const others = M.f.filter((G) => G !== F && !inner.includes(G) && G.loops.some((l) => l.some((i) => vs.has(i))));
    const host = hostOf(M, F);
    const lone = !others.length && !host;
    const square = !host && others.length && others.every((G) => Math.abs(dot(faceNormal(M, G), n)) < 1e-6);
    if (square) {                                            // the sides stretch
      vs.forEach((i) => { M.v[i] = clean(add(M.v[i], off)); });
      const th = through(M, F); if (th) return { mode: "through", face: th.id };
      return { mode: "move", face: F.id };
    }
    const map = new Map();
    vs.forEach((i) => map.set(i, vNew(M, add(M.v[i], off))));
    const sides = [];
    F.loops.forEach((l) => loopEdges(l).forEach(([a, b]) => {
      const q = [a, b, map.get(b), map.get(a)];
      sides.push({ id: nextId(M), loops: [lone && d < 0 ? q.slice().reverse() : q], mat: F.mat, grp: F.grp });
    }));
    const top = { id: nextId(M), loops: F.loops.map((l) => l.map((i) => map.get(i))), mat: F.mat, grp: F.grp };
    // the faces in its holes go with it - not from a lone face (a ring pulled up into walls keeps the room's floor)
    if (!lone) inner.forEach((G) => { G.loops = G.loops.map((l) => l.map((i) => (map.has(i) ? map.get(i) : vNew(M, add(M.v[i], off))))); });
    if (lone) {
      if (d > 0) F.loops = F.loops.map((l) => l.slice().reverse());        // the bottom faces down
      else top.loops = top.loops.map((l) => l.slice().reverse());
    } else M.f.splice(M.f.indexOf(F), 1);
    M.f.push(...sides, top);
    if (!lone) { const th = through(M, top, sides); if (th) return { mode: "through", face: th.id }; }
    return { mode: lone ? "solid" : "extrude", face: top.id };
  }
  /** a pushed face T now lying on a face G that faces the other way (the far side of the solid), inside it: T goes and
   *  G gets a hole there - a hole through. The same outline as G: both go (the solid is open there) -> G | null */
  function through(M, T, skip) {
    const tp = facePlane(M, T), t2 = loopPts(M, T.loops[0]);
    for (const G of M.f) {
      if (G === T || (skip && skip.includes(G)) || !sameGroup(G.grp, T.grp) || !coplanar(M, G, t2)) continue;
      const H = facePlane(M, G); if (dot(H.n, tp.n) > -1 + 1e-9) continue;
      const B = basis(H.n), outer = loopPts(M, G.loops[0]).map((q) => to2(q, H.p, B)), mine = t2.map((q) => to2(q, H.p, B));
      if (mine.every((q) => inside2(q, outer))) {
        G.loops.push(T.loops[0].slice());
        const L = G.loops[G.loops.length - 1]; if (dot(norm(newell(loopPts(M, L))), H.n) > 0) L.reverse();
        M.f.splice(M.f.indexOf(T), 1);
        return G;
      }
      if (mine.length === outer.length && mine.every((q) => onBorder2(q, outer))) { M.f.splice(M.f.indexOf(T), 1); M.f.splice(M.f.indexOf(G), 1); return G; }
    }
    return null;
  }

  /* ---------------- offset */
  function offsetLoop2(P, d) {
    const n = P.length, out = [];
    let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const s = area >= 0 ? 1 : -1;                                       // inward = left of a counter-clockwise edge
    const lines = P.map((a, i) => { const b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * s, ny = dx / l * s;
      return { p: [a[0] + nx * d, a[1] + ny * d], dir: [dx / l, dy / l] }; });
    for (let i = 0; i < n; i++) {
      const L1 = lines[(i - 1 + n) % n], L2 = lines[i];
      const den = L1.dir[0] * L2.dir[1] - L1.dir[1] * L2.dir[0];
      if (Math.abs(den) < 1e-9) { out.push(L2.p); continue; }
      const t = ((L2.p[0] - L1.p[0]) * L2.dir[1] - (L2.p[1] - L1.p[1]) * L2.dir[0]) / den;
      out.push([L1.p[0] + L1.dir[0] * t, L1.p[1] + L1.dir[1] * t]);
    }
    return out;
  }
  function offset(M, fid, dist) {
    const F = face(M, fid); if (!F) throw new Error("no such face");
    const d = +dist; if (!(d > 1e-6)) throw new Error("the offset is a distance inside the face (more than 0)");
    const H = facePlane(M, F), B = basis(H.n), o = H.p, outer = loopPts(M, F.loops[0]).map((q) => to2(q, o, B));
    const inn = offsetLoop2(outer, d);
    const sa = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
    const flipped = inn.some((q, i) => { const a = outer[i], b = outer[(i + 1) % outer.length], c = inn[(i + 1) % inn.length]; return (b[0] - a[0]) * (c[0] - q[0]) + (b[1] - a[1]) * (c[1] - q[1]) <= 1e-12; });
    if (flipped || Math.sign(sa(inn)) !== Math.sign(sa(outer)) || !inn.every((q) => inside2(q, outer))) throw new Error("that offset does not fit inside the face");
    const holes = F.loops.slice(1).map((l) => loopPts(M, l).map((q) => to2(q, o, B)));
    if (holes.some((h) => h.some((q) => !inside2(q, inn)))) throw new Error("the face's holes are in the way of that offset");
    const pts = inn.map((q) => add(o, add(mul(B.u, q[0]), mul(B.w, q[1]))));
    const G = addFace(M, pts, { grp: F.grp, mat: F.mat });
    if (!G) throw new Error("that offset leaves no face");
    // the holes that were in F are inside G now
    if (F.loops.length > 2) { const moved = F.loops.slice(1, -1); F.loops = [F.loops[0], F.loops[F.loops.length - 1]]; G.loops.push(...moved); }
    return { face: G.id };
  }

  /* ---------------- picking, transforms */
  /** the vertices of a selection {f: [ids], e: [ids]} */
  function selVerts(M, sel) {
    const s = new Set();
    (sel.f || []).forEach((id) => { const F = face(M, id); if (F) F.loops.forEach((l) => l.forEach((i) => s.add(i))); });
    (sel.e || []).forEach((id) => { const E = M.e.find((x) => x.id === id); if (E) { s.add(E.a); s.add(E.b); } });
    return [...s];
  }
  function move(M, vids, t) { vids.forEach((i) => { M.v[i] = clean(add(M.v[i], t)); }); }
  function rotateZ(M, vids, c, deg) {
    const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    vids.forEach((i) => { const p = sub(M.v[i], c); M.v[i] = clean([c[0] + p[0] * cs - p[1] * sn, c[1] + p[0] * sn + p[1] * cs, c[2] + p[2]]); });
  }
  function scale(M, vids, c, k) { vids.forEach((i) => { M.v[i] = clean(add(c, mul(sub(M.v[i], c), k))); }); }
  /** a copy of the selection (new vertices, the same groups) -> the copy's selection */
  function copyOf(M, sel) {
    const map = new Map(), nv = (i) => { if (!map.has(i)) map.set(i, vNew(M, M.v[i])); return map.get(i); };
    const out = { f: [], e: [] };
    (sel.f || []).forEach((id) => { const F = face(M, id); if (!F) return; const G = { id: nextId(M), loops: F.loops.map((l) => l.map(nv)), mat: F.mat, grp: F.grp }; M.f.push(G); out.f.push(G.id); });
    (sel.e || []).forEach((id) => { const E = M.e.find((x) => x.id === id); if (!E) return; const N = { id: nextId(M), a: nv(E.a), b: nv(E.b), grp: E.grp }; M.e.push(N); out.e.push(N.id); });
    return out;
  }
  function remove(M, sel) {
    const fs = new Set(sel.f || []), es = new Set(sel.e || []);
    // a line erased that borders faces takes them with it
    const gone = new Set(M.e.filter((E) => es.has(E.id)).map((E) => edgeKey(E.a, E.b)));
    (sel.edgeKeys || []).forEach((k) => gone.add(k));
    M.f.forEach((F) => { if (gone.size && [...faceEdgeKeys(F)].some((k) => gone.has(k))) fs.add(F.id); });
    M.f = M.f.filter((F) => !fs.has(F.id));
    M.e = M.e.filter((E) => !es.has(E.id) && !gone.has(edgeKey(E.a, E.b)));
    gc(M);
    return fs.size + es.size;
  }
  function group(M, sel, name) {
    const id = nextId(M); M.g.push({ id, name: String(name || "Group " + (M.g.length + 1)).slice(0, 60) });
    (sel.f || []).forEach((x) => { const F = face(M, x); if (F) F.grp = id; });
    (sel.e || []).forEach((x) => { const E = M.e.find((y) => y.id === x); if (E) E.grp = id; });
    return id;
  }
  function explode(M, gid) { M.f.forEach((F) => { if (F.grp === gid) F.grp = null; }); M.e.forEach((E) => { if (E.grp === gid) E.grp = null; }); M.g = M.g.filter((g) => g.id !== gid); }
  /** unused vertices dropped (indices renumbered); empty groups dropped */
  function gc(M) {
    const used = new Set(); M.f.forEach((F) => F.loops.forEach((l) => l.forEach((i) => used.add(i)))); M.e.forEach((E) => { used.add(E.a); used.add(E.b); });
    const map = new Map(), v = [];
    M.v.forEach((p, i) => { if (used.has(i)) { map.set(i, v.length); v.push(p); } });
    M.v = v; if (M._vx) M._vx = new Map();
    M.f.forEach((F) => { F.loops = F.loops.map((l) => l.map((i) => map.get(i))); });
    M.e.forEach((E) => { E.a = map.get(E.a); E.b = map.get(E.b); });
    const g = new Set(); M.f.forEach((F) => F.grp && g.add(F.grp)); M.e.forEach((E) => E.grp && g.add(E.grp));
    M.g = M.g.filter((x) => g.has(x.id));
    return M;
  }
  function bbox(M, vids) {
    const ids = vids || M.v.map((_, i) => i);
    if (!ids.length) return null;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    ids.forEach((i) => { const p = M.v[i]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } });
    return { min: mn, max: mx, center: mul(add(mn, mx), 0.5), size: sub(mx, mn) };
  }
  /** the point on the line (p, dir) closest to point q */
  function closestOnLine(p, dir, q) { const d = norm(dir); return add(p, mul(d, dot(sub(q, p), d))); }
  /** the point on line 1 (p1, d1) closest to line 2 (p2, d2) - push/pull's distance from the mouse ray */
  function linesClosest(p1, d1, p2, d2) {
    const a = dot(d1, d1), b = dot(d1, d2), c = dot(d2, d2), w = sub(p1, p2), d = dot(d1, w), e = dot(d2, w), den = a * c - b * b;
    const t = Math.abs(den) < 1e-12 ? 0 : (b * e - c * d) / den;
    return { point: add(p1, mul(d1, t)), t };
  }
  /** a rectangle's 4 corners from two opposite corners on a plane (n) - on the ground: axis-aligned */
  function rectPts(a, b, n) {
    const N = norm(n || [0, 0, 1]);
    let u = Math.abs(N[2]) > 0.999 ? [1, 0, 0] : norm(cross([0, 0, 1], N));
    const w = cross(N, u), d = sub(b, a), du = dot(d, u), dw = dot(d, w);
    return [a, add(a, mul(u, du)), add(add(a, mul(u, du)), mul(w, dw)), add(a, mul(w, dw))];
  }
  function circlePts(c, r, n, sides, start) {
    const N = norm(n || [0, 0, 1]), B = basis(N), k = Math.max(3, Math.min(360, sides | 0 || 24)), s0 = start || 0;
    const out = [];
    for (let i = 0; i < k; i++) { const t = s0 + (i / k) * Math.PI * 2; out.push(add(c, add(mul(B.u, Math.cos(t) * r), mul(B.w, Math.sin(t) * r)))); }
    return out;
  }
  /** "1.5", "150cm", "1500mm", "2m", "3,4" (two lengths), "6s" (sides) -> {vals: [metres...], sides} | null */
  function parseVcb(text) {
    const s = String(text || "").trim().toLowerCase(); if (!s) return null;
    const m = /^(\d+)\s*s$/.exec(s); if (m) return { vals: [], sides: Math.max(3, Math.min(360, +m[1])) };
    const parts = s.split(/[,;x×]/).map((x) => x.trim()).filter(Boolean);
    const vals = [];
    for (const p of parts) {
      const q = /^(-?\d*\.?\d+)\s*(mm|cm|m|km|in|"|ft|')?$/.exec(p); if (!q) return null;
      const k = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, '"': 0.0254, ft: 0.3048, "'": 0.3048 }[q[2] || "m"];
      vals.push(+q[1] * k);
    }
    return vals.length ? { vals } : null;
  }
  function fmtLen(m) { const a = Math.abs(m); return a >= 1 ? (+m.toFixed(3)) + " m" : a >= 0.01 ? (+(m * 100).toFixed(1)) + " cm" : (+(m * 1000).toFixed(1)) + " mm"; }
  /** the model as plain JSON (what is saved) - checked + tidied */
  function fromJson(o) {
    const M = newModel();
    if (!o || typeof o !== "object") return M;
    M.v = (Array.isArray(o.v) ? o.v : []).map((p) => clean(Array.isArray(p) ? p : [0, 0, 0]));
    const ok = (i) => Number.isInteger(i) && i >= 0 && i < M.v.length;
    M.f = (Array.isArray(o.f) ? o.f : []).filter((F) => F && Array.isArray(F.loops) && F.loops.length && F.loops.every((l) => Array.isArray(l) && l.length >= 3 && l.every(ok)))
      .map((F) => ({ id: +F.id || 0, loops: F.loops.map((l) => l.slice()), mat: typeof F.mat === "string" && (/^#[0-9a-f]{6}$/i.test(F.mat) || /^mat:[a-z_]{2,24}$/.test(F.mat)) ? F.mat : null, grp: +F.grp || null }));
    M.e = (Array.isArray(o.e) ? o.e : []).filter((E) => E && ok(E.a) && ok(E.b) && E.a !== E.b).map((E) => ({ id: +E.id || 0, a: E.a, b: E.b, grp: +E.grp || null }));
    M.g = (Array.isArray(o.g) ? o.g : []).filter((g) => g && +g.id).map((g) => Object.assign({ id: +g.id, name: String(g.name || "Group").slice(0, 60) }, g.soft ? { soft: true } : {}));
    let mx = 0; M.f.concat(M.e).concat(M.g).forEach((x) => { mx = Math.max(mx, x.id || 0); }); M.n = Math.max(+o.n || 1, mx + 1);
    M.f.concat(M.e).forEach((x) => { if (!x.id) x.id = M.n++; });
    // 2.620.0: the architecture (rooms, walls, doors, windows, roofs, lights - pparch.js) rides along
    if (o.arch && typeof o.arch === "object") M.arch = root.PPArch ? root.PPArch.clean(o.arch) : JSON.parse(JSON.stringify(o.arch));
    return M;
  }
  const toJson = (M) => Object.assign({ v: M.v, f: M.f, e: M.e, g: M.g, n: M.n }, M.arch ? { arch: M.arch } : {});

  const api = { EPS, newModel, vAt, face, newell, faceNormal, facePlane, faceArea, loopPts, basis, to2, inPoly2, neighbours, innerFaces, hostOf,
    addFace, addEdge, insertOnEdge, pushPull, offset, offsetLoop2, selVerts, move, rotateZ, scale, copyOf, remove, group, explode, gc, bbox,
    closestOnLine, linesClosest, rectPts, circlePts, parseVcb, fmtLen, fromJson, toJson, edgeKey, faceEdgeKeys, loopEdges,
    v3: { sub, add, mul, dot, cross, len, norm } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPGeo = api;
})(typeof window !== "undefined" ? window : globalThis);
