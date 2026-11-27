// bitGen Studio — lib/glbAnim.js (2.982.0): 🎬 a glTF ANIMATION added to a .glb (a Daz character with its Mixamo motion
// baked - ext/pushpulldock/ppdazpose.js -> POST /api/dazlib/motion/bake). Pure.
//   addAnimation(glb, {name, times [s], rotations {nodeName: [x y z w per frame]}, translations {nodeName: [x y z per
//   frame]}, weights [per frame: every morph target of the body mesh]}) -> a new .glb (the old animations kept)
// Nodes are found by name; the weights go on every node whose mesh has that many morph targets (the body's pieces).
"use strict";
const G = require("./glbMerge");
function addAnimation(buf, a) {
  const P = G.parse(buf), J = P.json, parts = [P.bin.length % 4 ? Buffer.concat([P.bin, Buffer.alloc(4 - (P.bin.length % 4))]) : P.bin];
  let off = parts[0].length;
  J.bufferViews = J.bufferViews || []; J.accessors = J.accessors || [];
  const add = (arr, type, minmax) => {
    const f = Float32Array.from(arr), b = Buffer.from(f.buffer); J.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length }); parts.push(b); off += b.length;
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type], acc = { bufferView: J.bufferViews.length - 1, componentType: 5126, count: f.length / n, type };
    if (minmax) { acc.min = [Math.min(...f)]; acc.max = [Math.max(...f)]; }
    J.accessors.push(acc); return J.accessors.length - 1;
  };
  const T = a.times || [], nF = T.length; if (nF < 1) throw new Error("no frames");
  const input = add(T, "SCALAR", true), samplers = [], channels = [], byName = new Map((J.nodes || []).map((nd, i) => [nd.name, i]));
  const chan = (node, pathName, values, type) => { samplers.push({ input, output: add(values, type), interpolation: "LINEAR" }); channels.push({ sampler: samplers.length - 1, target: { node, path: pathName } }); };
  let skipped = 0;
  for (const [nm, v] of Object.entries(a.rotations || {})) { const i = byName.get(nm); if (i == null || v.length !== nF * 4) { skipped++; continue; } chan(i, "rotation", v, "VEC4"); }
  for (const [nm, v] of Object.entries(a.translations || {})) { const i = byName.get(nm); if (i == null || v.length !== nF * 3) { skipped++; continue; } chan(i, "translation", v, "VEC3"); }
  if (a.weights && a.weights.length) {
    const nT = a.weights.length / nF;
    (J.nodes || []).forEach((nd, i) => { const m = nd.mesh != null && J.meshes[nd.mesh]; if (m && m.primitives[0].targets && m.primitives[0].targets.length === nT) chan(i, "weights", a.weights, "SCALAR"); });
  }
  if (!channels.length) throw new Error("none of the animated bones are in this model");
  J.animations = (J.animations || []).concat([{ name: String(a.name || "motion").slice(0, 80), samplers, channels }]);
  const bin = Buffer.concat(parts); J.buffers = [{ byteLength: bin.length }];
  return { glb: G.glb(J, bin), channels: channels.length, skipped };
}
module.exports = { addAnimation };
