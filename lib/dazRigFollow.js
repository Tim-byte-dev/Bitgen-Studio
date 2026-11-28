// bitGen Studio — lib/dazRigFollow.js (3.7.1): THE SKELETON AND THE PIECES FOLLOW THE SHAPE of a Daz figure built by bitGen
// (lib/dazLib.js build). Tim: "when the g9 model is converted from our body and face, it seems to lose it's bones and looks
// terrible".
// Two causes, both here:
//   1 the bones stayed where the stock figure has them: a shape from bitGen (📷 B's scan wrapped on, 🙂 the 3D head, 👤 Make
//     this person, the face's head width / top) or a dial whose joint formulas bitGen does not run moved the body but not its
//     joints - knees, elbows, the neck and the eyes off the body, every pose bending round the wrong points. fitBones() moves
//     each joint with the body round it (Daz Studio's "adjust rigging to shape", the plain way): the vertices it - or its
//     parent - skins, nearest first, their mean movement; a bone that skins no body vertex (an eye) by the body nearest it.
//   2 only the body took the shape: Genesis 9's eyes and mouth (teeth, tongue) - and grafts, clothes, hair - are figures of
//     their own and were built at the stock positions (eyes out of their sockets, teeth through the lips). follow() carries
//     each of their vertices by the movement of the body vertices nearest it (Daz's auto-follow / projection, the plain way).
// Pure (Node: scripts/test-3701.js): Grid, follow, fitBones, moved.
"use strict";

/** a uniform grid over points (x y z ...) for nearest-neighbour questions */
class Grid {
  constructor(pos, cell) {
    this.p = pos; this.c = cell || 0.02; this.m = new Map();
    for (let i = 0; i < pos.length / 3; i++) { const k = this.key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); const L = this.m.get(k); if (L) L.push(i); else this.m.set(k, [i]); }
  }
  key(x, y, z) { return Math.floor(x / this.c) + "," + Math.floor(y / this.c) + "," + Math.floor(z / this.c); }
  /** up to k nearest point indices to (x, y, z) within maxR (rings of cells grow until k are found) -> [[i, d] ...] nearest first */
  near(x, y, z, k, maxR, ok) {
    const cx = Math.floor(x / this.c), cy = Math.floor(y / this.c), cz = Math.floor(z / this.c), rMax = Math.ceil((maxR || 0.3) / this.c);
    let got = [];
    for (let r = 0; r <= rMax; r++) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
        const L = this.m.get((cx + a) + "," + (cy + b) + "," + (cz + c)); if (!L) continue;
        for (const i of L) { if (ok && !ok(i)) continue; got.push([i, Math.hypot(this.p[i * 3] - x, this.p[i * 3 + 1] - y, this.p[i * 3 + 2] - z)]); }
      }
      // a point found in ring r is within r cells; anything nearer may still be in ring r + 1, so look one ring further
      if (got.length >= k && r >= 1) { const ringR = (r - 1) * this.c; if (got.filter((g) => g[1] <= ringR).length >= k) break; }
    }
    got.sort((u, v) => u[1] - v[1]);
    return got.slice(0, k);
  }
}
/** the mean movement (shaped - base) of the given body vertices, nearer weighing more */
function meanMove(hits, base, shaped, soft) {
  let sx = 0, sy = 0, sz = 0, sw = 0;
  for (const [i, d] of hits) { const w = 1 / ((d + soft) * (d + soft)); sx += (shaped[i * 3] - base[i * 3]) * w; sy += (shaped[i * 3 + 1] - base[i * 3 + 1]) * w; sz += (shaped[i * 3 + 2] - base[i * 3 + 2]) * w; sw += w; }
  return sw ? [sx / sw, sy / sw, sz / sw] : [0, 0, 0];
}
/** how far the body moved: the largest vertex movement (metres) */
function moved(base, shaped) { let m = 0; for (let i = 0; i < base.length; i += 3) m = Math.max(m, Math.hypot(shaped[i] - base[i], shaped[i + 1] - base[i + 1], shaped[i + 2] - base[i + 2])); return m; }

/** a piece's vertices carried by the body's movement: pos (its own positions, x y z ...) -> a new Float32Array;
 *  body = {base, shaped, grid?, coarse?} in metres; o = {k 8, soft 0.004}. Near the body (6 cm) a fine grid, further out
 *  (long hair, a coat's hem) a coarse one - each vertex looks at a few cells, never thousands */
function follow(pos, body, o) {
  const x = o || {}, k = x.k || 8, soft = x.soft != null ? x.soft : 0.004;
  const G = body.grid || (body.grid = new Grid(body.base, 0.02)), C = body.coarse || (body.coarse = new Grid(body.base, 0.15)), out = Float32Array.from(pos);
  for (let i = 0; i < pos.length / 3; i++) {
    let h = G.near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], k, 0.06);
    if (h.length < 3) h = C.near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], k, 3);     // further out: the coarse grid
    const d = meanMove(h, body.base, body.shaped, soft);
    out[i * 3] += d[0]; out[i * 3 + 1] += d[1]; out[i * 3 + 2] += d[2];
  }
  return out;
}

/** the bones' centres / end points moved with the body: bones [{id, parent, center, end} (figure units)], scale = metres per
 *  figure unit, body = {base, shaped (metres), J, W (skinTop4 of the body: 4 bone indices + weights a vertex, into `bones`)}
 *  -> {bones (copies; centre / end moved), moved: [{id, cm}], max_cm} */
function fitBones(bones, body, scale, o) {
  const x = o || {}, k = x.k || 48, soft = x.soft != null ? x.soft : 0.01, s = scale || 0.01;
  const G = body.grid || new Grid(body.base, 0.02), idOf = new Map(bones.map((b, i) => [b.id, i]));
  const skins = (vi, bi, pi) => { for (let q = 0; q < 4; q++) { const j = body.J[vi * 4 + q], w = body.W[vi * 4 + q]; if (w >= 0.1 && (j === bi || (pi >= 0 && j === pi))) return true; } return false; };
  const out = [], movedL = []; let max = 0;
  bones.forEach((b, bi) => {
    const nb = Object.assign({}, b);
    if (Array.isArray(b.center)) {
      const pi = b.parent != null && idOf.has(b.parent) ? idOf.get(b.parent) : -1;
      const c = [b.center[0] * s, b.center[1] * s, b.center[2] * s];
      let h = body.J ? G.near(c[0], c[1], c[2], k, 0.25, (vi) => skins(vi, bi, pi)) : [];
      if (h.length < 4) h = G.near(c[0], c[1], c[2], Math.min(k, 16), 0.25);       // skins no body vertex (an eye): the body nearest it
      if (h.length) {
        const d = meanMove(h, body.base, body.shaped, soft);
        nb.center = [b.center[0] + d[0] / s, b.center[1] + d[1] / s, b.center[2] + d[2] / s];
        const cm = Math.hypot(d[0], d[1], d[2]) * 100; if (cm > 0.05) movedL.push({ id: b.id, cm: Math.round(cm * 10) / 10 }); max = Math.max(max, cm);
      }
    }
    if (Array.isArray(b.end)) {
      const e = [b.end[0] * s, b.end[1] * s, b.end[2] * s], h = G.near(e[0], e[1], e[2], 16, 0.25);
      if (h.length) { const d = meanMove(h, body.base, body.shaped, soft); nb.end = [b.end[0] + d[0] / s, b.end[1] + d[1] / s, b.end[2] + d[2] / s]; }
    }
    out.push(nb);
  });
  return { bones: out, moved: movedL, max_cm: Math.round(max * 10) / 10 };
}

module.exports = { Grid, follow, fitBones, moved, meanMove };
