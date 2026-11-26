// bitGen Studio — lib/glbMerge.js (2.975.0): several .glb models + a 360° panorama -> ONE scene .glb (pure, no dependencies).
// For 🧱 Picture → 3D scene (lib/picScene.js): each object's model placed where it stood in the picture, the surroundings as
// the panorama on an inside-out sphere round the camera, a camera at eye height looking at FRONT - one file the Sketcher, the
// timeline's 3D layers, Blender, Unity, Unreal and Godot all open.
//
//   parse(buf)                  -> {json, bin}           a glTF 2.0 binary (throws on anything else)
//   bounds(json, bin)           -> {min:[x,y,z], max}     over every POSITION accessor (their own min / max)
//   merge(parts, o)             -> Buffer                 parts [{glb: Buffer, name, translation, rotation, scale}],
//                                                         o.pano {data: Buffer (PNG / JPEG), mime, radius, center}, o.camera {y}
//   sphere(radius, seg, rings)  -> {pos, uv, idx}         an inside-out UV sphere: ERP u = longitude (-180..180, FRONT = -Z,
//                                                         right = +X), v = latitude (top = up) - what an equirectangular wants
//   glb(json, bin)              -> Buffer                 a glTF binary from its JSON + BIN
"use strict";

function pad4(n) { return (4 - (n % 4)) % 4; }
function parse(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 20 || buf.toString("ascii", 0, 4) !== "glTF") throw new Error("not a .glb (glTF binary)");
  if (buf.readUInt32LE(4) !== 2) throw new Error("only glTF 2.0 .glb files");
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), body = buf.slice(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8").replace(/[\u0000\s]+$/, ""));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error("that .glb has no JSON");
  return { json, bin };
}
function glb(json, bin) {
  const j = Buffer.from(JSON.stringify(json), "utf8"), jp = Buffer.concat([j, Buffer.alloc(pad4(j.length), 0x20)]);
  const b = bin && bin.length ? Buffer.concat([bin, Buffer.alloc(pad4(bin.length), 0)]) : null;
  const total = 12 + 8 + jp.length + (b ? 8 + b.length : 0), out = Buffer.alloc(total);
  out.write("glTF", 0, "ascii"); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jp.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jp.copy(out, 20);
  if (b) { const o = 20 + jp.length; out.writeUInt32LE(b.length, o); out.writeUInt32LE(0x004e4942, o + 4); b.copy(out, o + 8); }
  return out;
}
function bounds(json) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  (json.meshes || []).forEach((m) => (m.primitives || []).forEach((p) => {
    const a = p.attributes && json.accessors && json.accessors[p.attributes.POSITION];
    if (a && a.min && a.max) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a.min[k]); max[k] = Math.max(max[k], a.max[k]); }
  }));
  if (!isFinite(min[0])) return { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };
  return { min, max };
}
/** an inside-out UV sphere (faces point in) with equirectangular UVs */
function sphere(r, seg, rings) {
  const S = seg || 64, R = rings || 32, pos = [], uv = [], idx = [];
  for (let y = 0; y <= R; y++) {
    const v = y / R, lat = Math.PI / 2 - v * Math.PI;
    for (let x = 0; x <= S; x++) {
      const u = x / S, lon = u * 2 * Math.PI - Math.PI;
      pos.push(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.cos(lon));
      uv.push(u, v);
    }
  }
  for (let y = 0; y < R; y++) for (let x = 0; x < S; x++) {
    const a = y * (S + 1) + x, b = a + S + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);   // wound to face the centre
  }
  return { pos, uv, idx };
}
const TEXKEY = /Texture$/;
function shiftTex(o, texOff) {
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === "object") { if (TEXKEY.test(k) && typeof v.index === "number") v.index += texOff; shiftTex(v, texOff); }
  }
}
/** the parts + the panorama -> one scene .glb */
function merge(parts, o) {
  const x = o || {}, J = { asset: { version: "2.0", generator: "bitGen Studio - Picture to 3D scene" }, scene: 0, scenes: [{ name: x.name || "scene", nodes: [] }],
    nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }], materials: [], textures: [], images: [], samplers: [] };
  const used = new Set(), req = new Set(), bins = []; let binLen = 0;
  const addBin = (b) => { const p = pad4(binLen); if (p) { bins.push(Buffer.alloc(p)); binLen += p; } const at = binLen; bins.push(b); binLen += b.length; return at; };
  for (const part of parts || []) {
    const { json: g, bin } = parse(part.glb), at = addBin(bin);
    const off = { bv: J.bufferViews.length, acc: J.accessors.length, mesh: J.meshes.length, mat: J.materials.length, tex: J.textures.length, img: J.images.length, smp: J.samplers.length, node: J.nodes.length };
    (g.bufferViews || []).forEach((v) => J.bufferViews.push(Object.assign({}, v, { buffer: 0, byteOffset: (v.byteOffset || 0) + at })));
    (g.accessors || []).forEach((a) => { const c = JSON.parse(JSON.stringify(a)); if (typeof c.bufferView === "number") c.bufferView += off.bv;
      if (c.sparse) { c.sparse.indices.bufferView += off.bv; c.sparse.values.bufferView += off.bv; } J.accessors.push(c); });
    (g.images || []).forEach((im) => { const c = Object.assign({}, im); if (typeof c.bufferView === "number") c.bufferView += off.bv; J.images.push(c); });
    (g.samplers || []).forEach((s) => J.samplers.push(Object.assign({}, s)));
    (g.textures || []).forEach((t) => { const c = JSON.parse(JSON.stringify(t)); if (typeof c.source === "number") c.source += off.img; if (typeof c.sampler === "number") c.sampler += off.smp;
      if (c.extensions) Object.values(c.extensions).forEach((e) => { if (e && typeof e.source === "number") e.source += off.img; }); J.textures.push(c); });
    (g.materials || []).forEach((m) => { const c = JSON.parse(JSON.stringify(m)); shiftTex(c, off.tex); J.materials.push(c); });
    (g.meshes || []).forEach((m) => { const c = JSON.parse(JSON.stringify(m)); (c.primitives || []).forEach((p) => {
      Object.keys(p.attributes || {}).forEach((k) => { p.attributes[k] += off.acc; });
      if (typeof p.indices === "number") p.indices += off.acc; if (typeof p.material === "number") p.material += off.mat;
      (p.targets || []).forEach((t) => Object.keys(t).forEach((k) => { t[k] += off.acc; })); }); J.meshes.push(c); });
    (g.nodes || []).forEach((n) => { const c = JSON.parse(JSON.stringify(n)); if (typeof c.mesh === "number") c.mesh += off.mesh;
      if (c.children) c.children = c.children.map((k) => k + off.node); delete c.skin; delete c.camera; J.nodes.push(c); });
    (g.extensionsUsed || []).forEach((e) => used.add(e)); (g.extensionsRequired || []).forEach((e) => req.add(e));
    const sc = (g.scenes && g.scenes[g.scene || 0]) || { nodes: (g.nodes || []).map((_, i) => i) };
    const root = { name: part.name || "object", children: (sc.nodes || []).map((k) => k + off.node) };
    if (part.translation) root.translation = part.translation.map(Number);
    if (part.rotation) root.rotation = part.rotation.map(Number);
    if (part.scale != null) root.scale = Array.isArray(part.scale) ? part.scale.map(Number) : [+part.scale, +part.scale, +part.scale];
    J.scenes[0].nodes.push(J.nodes.length); J.nodes.push(root);
  }
  // the surroundings: the panorama inside a sphere round the camera, lit by nothing (unlit - it IS the light)
  if (x.pano && x.pano.data) {
    const R = +x.pano.radius || 40, cy = x.pano.center != null ? +x.pano.center : 1.6, S = sphere(R, 96, 48);
    const fl = (arr) => Buffer.from(new Float32Array(arr).buffer), ix = Buffer.from(new Uint32Array(S.idx).buffer);
    const pAt = addBin(fl(S.pos)), uAt = addBin(fl(S.uv)), iAt = addBin(ix), mAt = addBin(x.pano.data);
    const bv = J.bufferViews.length;
    J.bufferViews.push({ buffer: 0, byteOffset: pAt, byteLength: S.pos.length * 4, target: 34962 }, { buffer: 0, byteOffset: uAt, byteLength: S.uv.length * 4, target: 34962 },
      { buffer: 0, byteOffset: iAt, byteLength: S.idx.length * 4, target: 34963 }, { buffer: 0, byteOffset: mAt, byteLength: x.pano.data.length });
    const ac = J.accessors.length;
    J.accessors.push({ bufferView: bv, componentType: 5126, count: S.pos.length / 3, type: "VEC3", min: [-R, -R, -R], max: [R, R, R] },
      { bufferView: bv + 1, componentType: 5126, count: S.uv.length / 2, type: "VEC2" }, { bufferView: bv + 2, componentType: 5125, count: S.idx.length, type: "SCALAR" });
    J.images.push({ bufferView: bv + 3, mimeType: x.pano.mime || "image/png", name: "panorama" });
    J.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 });
    J.textures.push({ source: J.images.length - 1, sampler: J.samplers.length - 1 });
    J.materials.push({ name: "panorama", doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: J.textures.length - 1 }, metallicFactor: 0, roughnessFactor: 1 },
      extensions: { KHR_materials_unlit: {} } });
    used.add("KHR_materials_unlit");
    J.meshes.push({ name: "panorama", primitives: [{ attributes: { POSITION: ac, TEXCOORD_0: ac + 1 }, indices: ac + 2, material: J.materials.length - 1 }] });
    J.scenes[0].nodes.push(J.nodes.length); J.nodes.push({ name: "surroundings (360 panorama)", mesh: J.meshes.length - 1, translation: [0, cy, 0] });
  }
  if (x.camera !== false) {
    J.cameras = [{ name: "the picture's camera", type: "perspective", perspective: { yfov: ((x.camera && x.camera.vfov) || 42) * Math.PI / 180, znear: 0.05, zfar: 500, aspectRatio: (x.camera && x.camera.aspect) || 16 / 9 } }];
    J.scenes[0].nodes.push(J.nodes.length); J.nodes.push({ name: "camera", camera: 0, translation: [0, (x.camera && x.camera.y) || 1.6, 0] });
  }
  ["textures", "images", "samplers", "materials"].forEach((k) => { if (!J[k].length) delete J[k]; });
  if (used.size) J.extensionsUsed = [...used]; if (req.size) J.extensionsRequired = [...req];
  const bin = Buffer.concat(bins); if (bin.length) J.buffers[0].byteLength = bin.length; else delete J.buffers;
  return glb(J, bin);
}

module.exports = { parse, glb, bounds, sphere, merge };
