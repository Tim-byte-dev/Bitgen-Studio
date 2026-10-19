/* bitGen Studio — lib/houseGltf.js (2.529.0): a house as ONE .glb (binary glTF 2.0) - Blender, Unreal, Godot, three.js
 * and most 3D viewers open it as it is, with its materials (base colour, roughness, metalness, see-through glass).
 * From the recommendations Tim asked to be worked through ("House builder extras ... glTF export").
 *   toGlb(meshes, name, MATERIALS) (pure): every mesh of H3HouseGeo.build (grouped by material + colour) -> one glTF mesh
 *   primitive with POSITION / NORMAL / TEXCOORD_0 + uint32 indices; a PBR material per group; metres, Y up (glTF's own).
 */
"use strict";

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function hexRgb(hex) {
  const h = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#888888";
  return [1, 3, 5].map((i) => srgbToLinear(parseInt(h.substr(i, 2), 16) / 255));
}
function pad4(buf, fill) { const r = buf.length % 4; return r ? Buffer.concat([buf, Buffer.alloc(4 - r, fill || 0)]) : buf; }

/** -> a Buffer: the .glb */
function toGlb(meshes, name, MATERIALS) {
  const M = MATERIALS || {};
  const views = [], accessors = [], materials = [], primitives = [], chunks = [];
  let offset = 0;
  const addView = (buf, target) => {
    const b = pad4(buf);
    views.push(Object.assign({ buffer: 0, byteOffset: offset, byteLength: buf.length }, target ? { target } : {}));
    chunks.push(b); offset += b.length;
    return views.length - 1;
  };
  const f32 = (arr) => Buffer.from(new Float32Array(arr).buffer);
  (meshes || []).forEach((g) => {
    if (!g || !g.idx || !g.idx.length || !g.pos || !g.pos.length) return;
    const n = g.pos.length / 3;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.pos.length; i += 3) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], g.pos[i + j]); mx[j] = Math.max(mx[j], g.pos[i + j]); }
    const vp = addView(f32(g.pos), 34962), vn = addView(f32(g.nrm), 34962), vt = addView(f32(g.uv), 34962);
    const vi = addView(Buffer.from(new Uint32Array(g.idx).buffer), 34963);
    accessors.push({ bufferView: vp, componentType: 5126, count: n, type: "VEC3", min: mn, max: mx });
    accessors.push({ bufferView: vn, componentType: 5126, count: n, type: "VEC3" });
    accessors.push({ bufferView: vt, componentType: 5126, count: n, type: "VEC2" });
    accessors.push({ bufferView: vi, componentType: 5125, count: g.idx.length, type: "SCALAR" });
    const a = accessors.length - 4;
    const mm = M[g.mat] || {}, rgb = hexRgb(g.color || mm.color);
    const mat = { name: `${g.mat}_${String(g.color || "").replace("#", "")}`, doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: rgb.concat([mm.opacity != null ? mm.opacity : 1]), metallicFactor: mm.metal || 0, roughnessFactor: mm.rough != null ? mm.rough : 0.8 } };
    if (mm.opacity != null) mat.alphaMode = "BLEND";
    if (mm.emissive) mat.emissiveFactor = rgb;
    materials.push(mat);
    primitives.push({ attributes: { POSITION: a, NORMAL: a + 1, TEXCOORD_0: a + 2 }, indices: a + 3, material: materials.length - 1, mode: 4 });
  });
  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: "2.0", generator: "bitGen Studio house builder" },
    scene: 0, scenes: [{ name: String(name || "house"), nodes: [0] }],
    nodes: [{ name: String(name || "house"), mesh: 0 }],
    meshes: [{ name: String(name || "house"), primitives }],
    materials, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }],
  };
  const json = pad4(Buffer.from(JSON.stringify(gltf), "utf8"), 0x20);
  const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, json, bh, bin]);
}
/** a .glb back to {json, bin} (tests) */
function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a .glb");
  const jl = buf.readUInt32LE(12), json = JSON.parse(buf.slice(20, 20 + jl).toString("utf8").trim());
  const bl = buf.readUInt32LE(20 + jl), bin = buf.slice(28 + jl, 28 + jl + bl);
  return { json, bin, length: buf.readUInt32LE(8) };
}

module.exports = { toGlb, readGlb, hexRgb };
