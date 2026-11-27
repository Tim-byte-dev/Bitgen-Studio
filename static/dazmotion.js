/* bitGen Studio — static/dazmotion.js (2.982.0): 🎬 MIXAMO MOTION ON A DAZ CHARACTER (window.H3DazMotion; require() in tests).
 * Tim: "can we add mixamo motion to our character?" -> "yes please". NOT A REPLACEMENT FOR DAZ STUDIO - light tasks.
 * Mixamo (mixamo.com, a free Adobe ID): the user downloads each animation as FBX ("Without Skin") - bitGen never ships or
 * fetches Mixamo files (its licence: royalty free in your projects, the raw files not redistributed). The page reads the FBX
 * with three.js's own FBXLoader; this file turns its skeleton's motion into the Daz figure's bones:
 *   mapBones(dazIds, srcNames) -> {dazId: srcName}   Mixamo names (mixamorig:Hips / mixamorigHips / Hips) -> Genesis 3 / 8 / 9
 *                                                    (lShldrBend / l_upperarm / lShldr ...), the first that exists
 *   setup({daz, src, map}) -> S                       the rest-pose correction per bone (Mixamo stands in a T, Genesis 8 / 9 in
 *                                                    an A: C = the turn from the Daz bone's rest direction to the Mixamo
 *                                                    bone's), the bones parents first, the hips scale (leg length ratio)
 *   frame(S, src {name: {q world, p world}}, o) -> {local {dazId: quat}, hips [x, y, z] offset}
 *                                                    Daz world(t) = delta(t) x C, delta = Mixamo world(t) x its rest^-1;
 *                                                    unmapped Daz bones (twist bones, chestUpper ...) follow their parent
 * Daz rest = no rotation (bitGen's .glb bones are world-aligned). Quaternions [x, y, z, w]. */
(function (root, make) {
  const m = make(root.H3DazFormula || (typeof require === "function" ? require("./dazformula.js") : null));
  if (typeof module === "object" && module.exports) module.exports = m; else root.H3DazMotion = m;
})(typeof window !== "undefined" ? window : globalThis, function (F) {
  "use strict";
  const side = (L, s) => L.map((x) => x.replace(/\{s\}/g, s).replace(/\{S\}/g, s.toUpperCase()));
  /** Mixamo bone (no prefix) -> Daz candidates; {s} = l / r */
  const MAP = { Hips: ["hip"], Spine: ["abdomenLower", "spine1", "abdomen"], Spine1: ["abdomenUpper", "spine2", "abdomen2"], Spine2: ["chestLower", "spine3", "chest"],
    Neck: ["neckLower", "neck1", "neck"], Head: ["head"] };
  const LIMB = { Shoulder: ["{s}Collar", "{s}_shoulder"], Arm: ["{s}ShldrBend", "{s}_upperarm", "{s}Shldr"], ForeArm: ["{s}ForearmBend", "{s}_forearm", "{s}ForeArm", "{s}Forearm"], Hand: ["{s}Hand", "{s}_hand"],
    UpLeg: ["{s}ThighBend", "{s}_thigh", "{s}Thigh"], Leg: ["{s}Shin", "{s}_shin"], Foot: ["{s}Foot", "{s}_foot"], ToeBase: ["{s}Toe", "{s}_toes", "{s}Toes"] };
  for (const [S, s] of [["Left", "l"], ["Right", "r"]]) {
    for (const [k, L] of Object.entries(LIMB)) MAP[S + k] = side(L, s);
    for (const [f, d] of [["Thumb", "Thumb"], ["Index", "Index"], ["Middle", "Mid"], ["Ring", "Ring"], ["Pinky", "Pinky"]]) for (let i = 1; i <= 3; i++) MAP[S + "Hand" + f + i] = [s + d + i, s + "_" + d.toLowerCase() + i];
  }
  /** a source bone's name without the Mixamo prefix ("mixamorig:LeftArm", "mixamorigLeftArm", "mixamorig1:LeftArm" -> "LeftArm") */
  const bareSrc = (n) => String(n || "").replace(/^.*mixamorig\d*[:_]?/i, "").replace(/^.*:/, "");
  function mapBones(dazIds, srcNames) {
    const have = new Set(dazIds), lower = new Map(dazIds.map((d) => [d.toLowerCase(), d])), out = {};
    for (const sn of srcNames) {
      const L = MAP[bareSrc(sn)]; if (!L) continue;
      const d = L.find((x) => have.has(x)) || L.map((x) => lower.get(x.toLowerCase())).find(Boolean);
      if (d && !Object.values(out).includes(sn) && !out[d]) out[d] = sn;
    }
    return out;
  }
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  /** the shortest turn taking direction a to direction b */
  function arc(a, b) {
    a = norm3(a); b = norm3(b); const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (d > 0.999999) return [0, 0, 0, 1];
    if (d < -0.999999) { const ax = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], c = norm3([a[1] * ax[2] - a[2] * ax[1], a[2] * ax[0] - a[0] * ax[2], a[0] * ax[1] - a[1] * ax[0]]); return [c[0], c[1], c[2], 0]; }
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], q = [c[0], c[1], c[2], 1 + d], l = Math.hypot(q[0], q[1], q[2], q[3]);
    return q.map((x) => x / l);
  }
  /** o = {daz {id: {parent, pos (rest, world)}}, src {name: {parent, p (rest world), q (rest world)}}, map (mapBones)} */
  function setup(o) {
    const daz = o.daz, src = o.src, map = o.map || mapBones(Object.keys(daz), Object.keys(src)), inv = {}; for (const [d, s] of Object.entries(map)) inv[s] = d;
    const ids = Object.keys(daz), order = [], seen = new Set(), visit = (id) => { if (seen.has(id) || !daz[id]) return; seen.add(id); if (daz[id].parent) visit(daz[id].parent); order.push(id); };
    ids.forEach(visit);
    const srcKids = (s) => Object.keys(src).filter((k) => src[k].parent === s), C = {};
    for (const id of order) {
      const s = map[id]; if (!s) continue;
      if (/^Hips$/.test(bareSrc(s))) { C[id] = [0, 0, 0, 1]; continue; }
      // the direction to the next mapped bone down the source chain (the same bone on both sides)
      let pair = null; const q = srcKids(s).slice();
      while (q.length && !pair) { const k = q.shift(); if (inv[k] && daz[inv[k]]) pair = [inv[k], k]; else q.push(...srcKids(k)); }
      if (pair) { const dd = sub(daz[pair[0]].pos, daz[id].pos), ds = sub(src[pair[1]].p, src[s].p); C[id] = Math.hypot(...dd) > 1e-9 && Math.hypot(...ds) > 1e-9 ? arc(dd, ds) : [0, 0, 0, 1]; }
      else { let p = daz[id].parent; while (p && !C[p]) p = daz[p].parent; C[id] = p ? C[p].slice() : [0, 0, 0, 1]; }   // a hand / the head: as its parent
    }
    // the hips: their rest height over the feet on both sides (the walk scaled to the Daz legs)
    const hipD = Object.keys(map).find((d) => /^Hips$/.test(bareSrc(map[d]))), low = (P) => Math.min(...P);
    const dazFoot = low(ids.map((i) => daz[i].pos[1])), srcFoot = low(Object.values(src).map((b) => b.p[1]));
    const scale = hipD ? (daz[hipD].pos[1] - dazFoot) / Math.max(1e-9, src[map[hipD]].p[1] - srcFoot) : 1;
    return { map, inv, order, C, hip: hipD || "", srcHip: hipD ? map[hipD] : "", scale, daz, srcRest: Object.fromEntries(Object.entries(src).map(([k, v]) => [k, { q: v.q.slice(), p: v.p.slice() }])) };
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  /** one frame: src = {name: {q (world), p (world)}} -> {local {dazId: q}, hips [dx, dy, dz] (Daz units), mapped} */
  function frame(S, src, o) {
    const W = {}, local = {}, x = o || {};
    for (const id of S.order) {
      const par = S.daz[id].parent, Wp = par && W[par] ? W[par] : [0, 0, 0, 1], s = S.map[id];
      if (s && src[s] && S.srcRest[s]) { const delta = F.qmul(src[s].q, F.qconj(S.srcRest[s].q)); W[id] = F.qmul(delta, S.C[id]); }
      else W[id] = Wp;
      local[id] = F.qmul(F.qconj(Wp), W[id]);
      const l = Math.hypot(...local[id]); local[id] = local[id].map((v) => v / l);
    }
    let hips = [0, 0, 0];
    if (S.srcHip && src[S.srcHip] && src[S.srcHip].p) { const r = S.srcRest[S.srcHip].p, p = src[S.srcHip].p; hips = [(p[0] - r[0]) * S.scale, (p[1] - r[1]) * S.scale, (p[2] - r[2]) * S.scale]; if (x.inPlace) { hips[0] = 0; hips[2] = 0; } }
    return { local, hips };
  }
  /** a frame's local rotations -> the Daz channel values the JCM formulas read ({id: {x, y, z}} degrees) */
  function channels(dazBones, local) { const out = {}; for (const [id, q] of Object.entries(local)) { const b = dazBones[id]; if (b && Math.abs(q[3]) < 0.9999999) out[id] = F.boneChannels(b, q); } return out; }
  return { MAP, bareSrc, mapBones, arc, setup, frame, channels };
});
