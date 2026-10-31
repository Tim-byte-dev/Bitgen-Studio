/* bitGen Studio — ext/pushpulldock/ppmesh.js (2.625.0): EDITING THE MODEL'S FACES, EDGES AND CORNERS (window.PPMesh /
 * require() - pure, after ppgeo.js).
 * Tim: "if user clicks a face show extrude in the properties panel, positive extrude will extrude positive, negative will cut
 * object, if user moves the face extrude to the face as blender does it, allow user to rotate face twist the extrusion to match
 * the rotated face. if user clicks an edge and moved it resize/move the edge .show edge properties, include extrude edge to
 * create a new face.add fillet to edge properties. allow user to select multiple edges, if user ctrl selects a edge then select
 * the edges that loop the face  if user selects a vertex move vertex."
 *
 *   extrude(M, fid, d, {twist, scale})  d along the face's normal; + = out, - = in (a cut: push / pull's pocket / hole
 *                                       through). A twist (degrees round its normal) / a scale = Blender's extrude + rotate:
 *                                       new sides (two triangles each when twisted) and the top turned -> {mode, face}
 *   rotateFace(M, fid, deg)             the face turned round its normal (its middle); the faces beside it that are no longer
 *                                       flat are split into triangles
 *   moveVerts(M, ids, t)                corners moved (a vertex, an edge's ends) - faces bent out of flat are split
 *   setEdgeLength(M, key, L)            the edge stretched / shrunk about its middle
 *   extrudeEdge(M, key, vec)            a new face from the edge (the edge and the edge moved by vec) -> the face
 *   fillet(M, key, r, seg)              the edge between two faces rounded (radius r, seg pieces) -> {ok, faces} | {ok:false, why}
 *   edgeFaces(M, a, b), edgeLoop(M, key, fid)   the faces on an edge; every edge of the loop (of fid, else its first
 *                                       face) the edge is in
 *   findV(M, p), edgeEnds(M, key), edgeDir(M, key), faceCenter(M, F)
 */
(function (root) {
  "use strict";
  const G = () => root.PPGeo;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const r9 = (x) => Math.round(x * 1e9) / 1e9;
  const clean = (p) => [r9(p[0]), r9(p[1]), r9(p[2])];
  const nid = (M) => M.n++;
  const vNew = (M, p) => { M.v.push(clean(p)); return M.v.length - 1; };
  /** p turned by a (radians) round the axis n (unit) through c */
  function rot(p, c, n, a) {
    const v = sub(p, c), cs = Math.cos(a), sn = Math.sin(a), k = dot(n, v);
    return add(c, add(add(mul(v, cs), mul(cross(n, v), sn)), mul(n, k * (1 - cs))));
  }
  function faceCenter(M, F) { const P = F.loops[0].map((i) => M.v[i]); let c = [0, 0, 0]; P.forEach((p) => { c = add(c, p); }); return mul(c, 1 / P.length); }
  function findV(M, p, eps) { const e = eps || 1e-6; for (let i = 0; i < M.v.length; i++) { const q = M.v[i]; if (Math.abs(q[0] - p[0]) < e && Math.abs(q[1] - p[1]) < e && Math.abs(q[2] - p[2]) < e) return i; } return -1; }
  const edgeEnds = (M, key) => String(key).split("_").map(Number);
  function edgeDir(M, key) { const [a, b] = edgeEnds(M, key); return norm(sub(M.v[b], M.v[a])); }
  /** the faces with a and b next to each other in one of their loops -> [{F, li, i (a's place), fwd (a then b)}] */
  function edgeFaces(M, a, b) {
    const out = [];
    M.f.forEach((F) => F.loops.forEach((l, li) => l.forEach((x, i) => {
      const y = l[(i + 1) % l.length];
      if (x === a && y === b) out.push({ F, li, i, fwd: true });
      else if (x === b && y === a) out.push({ F, li, i, fwd: false });
    })));
    return out;
  }
  /** every edge (key) of the loop the edge is in - of face fid when it is one of the edge's faces */
  function edgeLoop(M, key, fid) {
    const [a, b] = edgeEnds(M, key), fs = edgeFaces(M, a, b); if (!fs.length) return [G().edgeKey(a, b)];
    const h = fs.find((x) => x.F.id === fid) || fs[0], l = h.F.loops[h.li];
    return G().loopEdges(l).map(([x, y]) => G().edgeKey(x, y));
  }
  /* ---- flat faces */
  function flat(M, loop) {
    if (loop.length <= 3) return true;
    const P = loop.map((i) => M.v[i]), n = norm(G().newell(P)), d = dot(n, P[0]);
    return P.every((p) => Math.abs(dot(n, p) - d) < 1e-6);
  }
  /** a one-loop face that is no longer flat -> triangles (a fan from its first corner), same material / group */
  function splitBent(M, ids) {
    const touch = ids ? new Set(ids) : null;
    const out = [];
    M.f.slice().forEach((F) => {
      if (touch && !F.loops.some((l) => l.some((i) => touch.has(i)))) return;
      if (F.loops.length !== 1 || flat(M, F.loops[0])) return;
      const l = F.loops[0], k = M.f.indexOf(F);
      const T = []; for (let i = 1; i + 1 < l.length; i++) T.push({ id: i === 1 ? F.id : nid(M), loops: [[l[0], l[i], l[i + 1]]], mat: F.mat, grp: F.grp });
      M.f.splice(k, 1, ...T); out.push(F.id);
    });
    return out;
  }
  function moveVerts(M, ids, t) { ids.forEach((i) => { M.v[i] = clean(add(M.v[i], t)); }); splitBent(M, ids); return true; }
  function setEdgeLength(M, key, L) {
    const [a, b] = edgeEnds(M, key), A = M.v[a], B = M.v[b], c = mul(add(A, B), 0.5), u = norm(sub(B, A)), h = Math.max(0.001, +L) / 2;
    M.v[a] = clean(sub(c, mul(u, h))); M.v[b] = clean(add(c, mul(u, h))); splitBent(M, [a, b]); return true;
  }
  function rotateFace(M, fid, deg) {
    const F = G().face(M, fid); if (!F) return false;
    const n = G().faceNormal(M, F), c = faceCenter(M, F), a = (+deg || 0) * Math.PI / 180, vs = new Set();
    F.loops.forEach((l) => l.forEach((i) => vs.add(i)));
    vs.forEach((i) => { M.v[i] = clean(rot(M.v[i], c, n, a)); });
    splitBent(M, [...vs]); return true;
  }
  /* ---- extrude */
  function extrude(M, fid, dist, o) {
    const g = G(), F = g.face(M, fid); if (!F) throw new Error("no such face");
    const d = +dist || 0, tw = +((o && o.twist) || 0), sc = o && o.scale > 0 ? +o.scale : 1;
    if (Math.abs(tw) < 1e-9 && Math.abs(sc - 1) < 1e-9) return g.pushPull(M, fid, d);       // plain: push / pull (- = a cut)
    const n = g.faceNormal(M, F), c = faceCenter(M, F), a = tw * Math.PI / 180;
    const vs = new Set(); F.loops.forEach((l) => l.forEach((i) => vs.add(i)));
    const inner = g.innerFaces(M, F), host = g.hostOf(M, F);
    const others = M.f.filter((H) => H !== F && !inner.includes(H) && H.loops.some((l) => l.some((i) => vs.has(i))));
    const lone = !others.length && !host;
    const map = new Map();
    vs.forEach((i) => { const p = add(c, mul(sub(rot(M.v[i], c, n, a), c), sc)); map.set(i, vNew(M, add(p, mul(n, d)))); });
    const sides = [], flip = lone && d < 0;
    F.loops.forEach((l) => g.loopEdges(l).forEach(([x, y]) => {
      const q = [x, y, map.get(y), map.get(x)];
      const tris = Math.abs(tw) > 1e-9 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [q];
      tris.forEach((t) => sides.push({ id: nid(M), loops: [flip ? t.slice().reverse() : t], mat: F.mat, grp: F.grp }));
    }));
    const top = { id: nid(M), loops: F.loops.map((l) => l.map((i) => map.get(i))), mat: F.mat, grp: F.grp };
    if (lone) { if (d > 0) F.loops = F.loops.map((l) => l.slice().reverse()); else top.loops = top.loops.map((l) => l.slice().reverse()); }
    else M.f.splice(M.f.indexOf(F), 1);
    M.f.push(...sides, top);
    return { mode: lone ? "solid" : "extrude", face: top.id };
  }
  function extrudeEdge(M, key, vec) {
    const g = G(), [a, b] = edgeEnds(M, key); if (M.v[a] == null || M.v[b] == null || len(vec) < 1e-6) return null;
    const fs = edgeFaces(M, a, b), grp = fs.length ? fs[0].F.grp : (M.e.find((E) => g.edgeKey(E.a, E.b) === key) || {}).grp || null;
    const mat = fs.length ? fs[0].F.mat : null;
    const a2 = vNew(M, add(M.v[a], vec)), b2 = vNew(M, add(M.v[b], vec));
    // a face beside it runs a -> b: the new one b -> a (it continues that surface); a lone line: either way
    const loop = fs.length && fs[0].fwd ? [b, a, a2, b2] : [a, b, b2, a2];
    const F = { id: nid(M), loops: [loop], mat, grp };
    M.f.push(F);
    M.e = M.e.filter((E) => g.edgeKey(E.a, E.b) !== key);                       // the line now borders the face
    return F;
  }
  /* ---- fillet */
  function fillet(M, key, r, seg) {
    const g = G(), [a, b] = edgeEnds(M, key), R = +r, S = Math.max(1, Math.min(32, Math.round(+seg || 6)));
    if (!(R > 0)) return { ok: false, why: "the radius must be more than 0" };
    const fs = edgeFaces(M, a, b);
    if (fs.length !== 2) return { ok: false, why: "a fillet needs an edge between two faces" };
    const [f1, f2] = fs; if (f1.fwd === f2.fwd) return { ok: false, why: "the two faces face opposite ways" };
    const F1 = f1.F, F2 = f2.F, n1 = g.faceNormal(M, F1), n2 = g.faceNormal(M, F2);
    if (Math.abs(dot(n1, n2)) > 1 - 1e-6) return { ok: false, why: "the faces are flat with each other - nothing to round" };
    const A = M.v[a], B = M.v[b], u = norm(sub(B, A));
    // into each face, square to the edge
    const inF = (F, n) => { let w = norm(cross(n, u)); const c = faceCenter(M, F); if (dot(sub(c, A), w) < 0) w = mul(w, -1); return w; };
    const u1 = inF(F1, n1), u2 = inF(F2, n2);
    const al = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2))));
    if (al < 1e-3 || al > Math.PI - 1e-3) return { ok: false, why: "the faces meet too flat to round" };
    const t = R / Math.tan(al / 2), bis = norm(add(u1, u2)), cd = R / Math.sin(al / 2);
    // the faces at each end (the caps): one at most besides F1 / F2
    const capOf = (v) => M.f.filter((F) => F !== F1 && F !== F2 && F.loops.some((l) => l.includes(v)));
    const capA = capOf(a), capB = capOf(b);
    if (capA.length > 1 || capB.length > 1) return { ok: false, why: "more than three faces meet at an end of the edge" };
    // how far each face reaches from the edge at each end (the fillet must fit)
    const reach = (F, v, w) => { const l = F.loops.find((x) => x.includes(v)), i = l.indexOf(v), nb = [l[(i + 1) % l.length], l[(i - 1 + l.length) % l.length]].filter((x) => x !== a && x !== b); return nb.length ? dot(sub(M.v[nb[0]], M.v[v]), w) : Infinity; };
    if ([reach(F1, a, u1), reach(F1, b, u1), reach(F2, a, u2), reach(F2, b, u2)].some((x) => x < t - 1e-9)) return { ok: false, why: "the radius is too big for the faces beside the edge" };
    // the arc in the section through an end, then slid along the edge onto that end's cap (so the cap stays flat)
    const arc = (P, cap) => {
      const c = add(P, mul(bis, cd)), p1 = add(P, mul(u1, t)), p2 = add(P, mul(u2, t)), v1 = sub(p1, c), v2 = sub(p2, c);
      const ax = norm(cross(v1, v2)), th = Math.acos(Math.max(-1, Math.min(1, dot(norm(v1), norm(v2)))));
      const pts = []; for (let k = 0; k <= S; k++) pts.push(rot(p1, c, ax, th * k / S));
      if (!cap) return pts;
      const cn = g.faceNormal(M, cap), den = dot(cn, u); if (Math.abs(den) < 1e-6) return pts;
      return pts.map((q) => add(q, mul(u, -dot(cn, sub(q, P)) / den)));
    };
    const PA = arc(A, capA[0]), PB = arc(B, capB[0]);
    const IA = PA.map((p) => vNew(M, p)), IB = PB.map((p) => vNew(M, p));
    // the two faces: the edge's ends -> the arc's ends
    const swap = (F, v, nv) => { F.loops = F.loops.map((l) => l.map((x) => (x === v ? nv : x))); };
    swap(F1, a, IA[0]); swap(F1, b, IB[0]); swap(F2, a, IA[S]); swap(F2, b, IB[S]);
    // the caps: the corner -> the arc (in the order the cap's loop runs)
    const capArc = (cap, v, I) => {
      if (!cap) return;
      cap.loops = cap.loops.map((l) => {
        const i = l.indexOf(v); if (i < 0) return l;
        const prev = l[(i - 1 + l.length) % l.length];
        const fromF1 = F1.loops.some((x) => x.includes(prev));
        const seq = fromF1 ? I.slice() : I.slice().reverse();
        return l.slice(0, i).concat(seq, l.slice(i + 1));
      });
    };
    capArc(capA[0], a, IA); capArc(capB[0], b, IB);
    // the rounded strip, facing out (the way the two faces face)
    const out = norm(add(n1, n2)), faces = [];
    for (let k = 0; k < S; k++) {
      let q = [IA[k], IA[k + 1], IB[k + 1], IB[k]];
      const nn = g.newell(q.map((i) => M.v[i])); if (dot(nn, out) < 0) q = q.reverse();
      const F = { id: nid(M), loops: [q], mat: F1.mat, grp: F1.grp }; M.f.push(F); faces.push(F.id);
    }
    splitBent(M, [].concat(IA, IB));
    return { ok: true, faces, t };
  }

  const api = { extrude, rotateFace, moveVerts, setEdgeLength, extrudeEdge, fillet, edgeFaces, edgeLoop, findV, edgeEnds, edgeDir, faceCenter, splitBent, rot };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPMesh = api;
})(typeof window !== "undefined" ? window : globalThis);
