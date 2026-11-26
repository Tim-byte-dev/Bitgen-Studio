// bitGen Studio — lib/clothSim.js (2.977.0): bitGen's OWN cloth drape (pure, no dependencies) - a garment's mesh settled on
// a body under gravity: position-based dynamics (stretch + bend distance constraints, a weak shape memory so it does not
// slide off) with the body as the collider (nearest body vertex + its normal, a spatial hash). Pushing the cloth out of a
// body that grew (shape dials) is also how a garment made for the base shape is FITTED to a morphed one.
// Tim: "can we build our own dforce" - this is a LIGHT drape for stills / a settled pose, not a replacement for Daz Studio's
// dForce (a full simulation engine with its own per-garment settings).
//
//   drape({pos, tris}, {pos, tris}, o) -> {pos: Float32Array, frames, moved}   positions in metres, Y up
//     o: frames 60, substeps 4, iters 8, gravity 9.81, thickness 0.004, stretch 1, bend 0.15, memory 0.02, damping 0.02,
//        stiffness per vertex (Float32Array 0..1 - 1 = held where it is, like a dForce "dynamics strength" of 0)
//   edgesOf(tris), bendPairs(tris), vertexNormals(pos, tris), Hash   (tests)
"use strict";

function edgesOf(tris) {
  const seen = new Set(), out = [];
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = tris[t + k], b = tris[t + (k + 1) % 3], key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    if (!seen.has(key)) { seen.add(key); out.push(a < b ? a : b, a < b ? b : a); }
  }
  return out;
}
/** the two vertices opposite each shared edge (a bend constraint keeps their distance) */
function bendPairs(tris) {
  const opp = new Map(), out = [];
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = tris[t + k], b = tris[t + (k + 1) % 3], c = tris[t + (k + 2) % 3], key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    const o = opp.get(key);
    if (o === undefined) opp.set(key, c); else if (o !== c) out.push(o, c);
  }
  return out;
}
function vertexNormals(pos, tris) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
/** a uniform grid over points: near(x, y, z) -> the nearest point index within one cell around (or -1) */
class Hash {
  constructor(pos, cell) {
    this.p = pos; this.c = cell; this.m = new Map();
    for (let i = 0; i < pos.length / 3; i++) { const k = this.key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); let l = this.m.get(k); if (!l) this.m.set(k, (l = [])); l.push(i); }
  }
  key(x, y, z) { const c = this.c; return ((Math.floor(x / c) * 73856093) ^ (Math.floor(y / c) * 19349663) ^ (Math.floor(z / c) * 83492791)) | 0; }
  near(x, y, z) {
    const c = this.c, p = this.p; let best = -1, bd = Infinity;
    const ix = Math.floor(x / c), iy = Math.floor(y / c), iz = Math.floor(z / c);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = this.m.get((((ix + dx) * 73856093) ^ ((iy + dy) * 19349663) ^ ((iz + dz) * 83492791)) | 0); if (!l) continue;
      for (const i of l) { const ex = p[i * 3] - x, ey = p[i * 3 + 1] - y, ez = p[i * 3 + 2] - z, d = ex * ex + ey * ey + ez * ez; if (d < bd) { bd = d; best = i; } }
    }
    return best;
  }
}

function drape(cloth, body, o) {
  const x = Object.assign({ frames: 60, substeps: 4, iters: 8, gravity: 9.81, thickness: 0.004, stretch: 1, bend: 0.15, memory: 0.02, damping: 0.02, fps: 30 }, o || {});
  const P = Float32Array.from(cloth.pos), N = P.length / 3, prev = Float32Array.from(P), rest = Float32Array.from(P);
  const E = edgesOf(cloth.tris), B = bendPairs(cloth.tris);
  const L = new Float32Array(E.length / 2), LB = new Float32Array(B.length / 2);
  for (let e = 0; e < E.length; e += 2) L[e / 2] = Math.hypot(P[E[e] * 3] - P[E[e + 1] * 3], P[E[e] * 3 + 1] - P[E[e + 1] * 3 + 1], P[E[e] * 3 + 2] - P[E[e + 1] * 3 + 2]);
  for (let e = 0; e < B.length; e += 2) LB[e / 2] = Math.hypot(P[B[e] * 3] - P[B[e + 1] * 3], P[B[e] * 3 + 1] - P[B[e + 1] * 3 + 1], P[B[e] * 3 + 2] - P[B[e + 1] * 3 + 2]);
  const W = new Float32Array(N); for (let i = 0; i < N; i++) W[i] = 1 - Math.max(0, Math.min(1, x.stiffness ? x.stiffness[i] : 0));
  const hasBody = body && body.pos && body.pos.length >= 9;
  const BP = hasBody ? Float32Array.from(body.pos) : null, BN = hasBody ? vertexNormals(BP, body.tris || []) : null;
  const H = hasBody ? new Hash(BP, Math.max(0.02, x.thickness * 6)) : null;
  const dt = 1 / x.fps / x.substeps, g = -x.gravity * dt * dt;
  const project = (e, len, k, list) => {
    const a = list[e] * 3, b = list[e + 1] * 3, wa = W[list[e]], wb = W[list[e + 1]], ws = wa + wb; if (!ws) return;
    const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-9, s = k * (d - len) / d / ws;
    P[a] += dx * s * wa; P[a + 1] += dy * s * wa; P[a + 2] += dz * s * wa; P[b] -= dx * s * wb; P[b + 1] -= dy * s * wb; P[b + 2] -= dz * s * wb;
  };
  const collide = () => {
    if (!H) return;
    for (let i = 0; i < N; i++) {
      const j = H.near(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); if (j < 0) continue;
      const nx = BN[j * 3], ny = BN[j * 3 + 1], nz = BN[j * 3 + 2];
      const d = (P[i * 3] - BP[j * 3]) * nx + (P[i * 3 + 1] - BP[j * 3 + 1]) * ny + (P[i * 3 + 2] - BP[j * 3 + 2]) * nz;
      if (d < x.thickness) { const push = x.thickness - d; P[i * 3] += nx * push; P[i * 3 + 1] += ny * push; P[i * 3 + 2] += nz * push; prev[i * 3] = P[i * 3]; prev[i * 3 + 1] = P[i * 3 + 1]; prev[i * 3 + 2] = P[i * 3 + 2]; }
    }
  };
  collide();                                            // a body that grew pushes the garment out first (the fit)
  for (let f = 0; f < x.frames; f++) for (let s = 0; s < x.substeps; s++) {
    for (let i = 0; i < N; i++) {
      if (!W[i]) continue;
      const k = i * 3, vx = (P[k] - prev[k]) * (1 - x.damping), vy = (P[k + 1] - prev[k + 1]) * (1 - x.damping), vz = (P[k + 2] - prev[k + 2]) * (1 - x.damping);
      prev[k] = P[k]; prev[k + 1] = P[k + 1]; prev[k + 2] = P[k + 2];
      P[k] += vx; P[k + 1] += vy + g; P[k + 2] += vz;
    }
    for (let it = 0; it < x.iters; it++) {
      for (let e = 0; e < E.length; e += 2) project(e, L[e / 2], x.stretch, E);
      for (let e = 0; e < B.length; e += 2) project(e, LB[e / 2], x.bend, B);
      collide();
    }
    // shape memory (once a step): a garment made for this body keeps its cut instead of sliding off (no friction here)
    if (x.memory) for (let i = 0; i < N; i++) { const k = i * 3, m = x.memory * W[i]; P[k] += (rest[k] - P[k]) * m; P[k + 1] += (rest[k + 1] - P[k + 1]) * m; P[k + 2] += (rest[k + 2] - P[k + 2]) * m; }
  }
  let moved = 0; for (let i = 0; i < P.length; i++) moved = Math.max(moved, Math.abs(P[i] - cloth.pos[i]));
  return { pos: P, frames: x.frames, moved };
}

module.exports = { drape, edgesOf, bendPairs, vertexNormals, Hash };
