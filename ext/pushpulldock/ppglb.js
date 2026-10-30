/* bitGen Studio — ext/pushpulldock/ppglb.js (2.619.0): the push/pull model OUT as .glb / .obj / .stl (window.PPOut / require()).
 * Tim: "can we add a final docker ... looks like a sketchup" - the model has to reach the rest of bitGen: the timeline's
 * 3D layers, the image editor's 3D layers (Blender), the House builder, Blender, Unreal - all take a .glb from the
 * project's 3D models (POST /api/tlcanvas/model).
 *   meshes(M, tri)  the faces triangulated (tri(face) -> [[a, b, c] vertex positions ...], the page's three.js ShapeUtils)
 *                   and grouped by colour -> [{color, pos, nrm, idx}] in Z up metres
 *   glb(meshes, name, lights) -> Uint8Array   glTF 2.0 binary: Y up (glTF's own: x, z, -y), a PBR material per colour, both sides;
 *                   2.620.0: a mesh's alpha < 1 (glass) = a see-through material; lights [{name, type: point | spot, color, cd, p, ang}]
 *                   = KHR_lights_punctual nodes (Blender / Unreal bring the rooms' lights in)
 *   obj(meshes, name) -> {obj, mtl}   text, a material per colour
 *   stl(meshes, name) -> Uint8Array   binary STL (millimetres - what printers expect)
 * Pure (Node: scripts/test-pushpull619.js). */
(function (root) {
  "use strict";
  const DEF = "#d8d2c4";
  function meshes(M, tri) {
    const by = new Map();
    for (const F of M.f) {
      const col = F.mat || DEF, T = tri(F); if (!T || !T.length) continue;
      if (!by.has(col)) by.set(col, { color: col, pos: [], nrm: [], idx: [] });
      const g = by.get(col);
      for (const t of T) {
        const a = t[0], b = t[1], c = t[2];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-14) continue;
        n = [n[0] / l, n[1] / l, n[2] / l];
        const base = g.pos.length / 3;
        [a, b, c].forEach((p) => { g.pos.push(p[0], p[1], p[2]); g.nrm.push(n[0], n[1], n[2]); });
        g.idx.push(base, base + 1, base + 2);
      }
    }
    return [...by.values()].filter((g) => g.idx.length);
  }
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rgb = (hex) => { const h = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : DEF; return [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255); };
  const yUp = (a) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i += 3) { o[i] = a[i]; o[i + 1] = a[i + 2]; o[i + 2] = -a[i + 1]; } return o; };
  function glb(list, name, lights) {
    const views = [], accessors = [], materials = [], primitives = [], chunks = [];
    let off = 0;
    const view = (bytes, target) => { const pad = (4 - (bytes.length % 4)) % 4; const b = new Uint8Array(bytes.length + pad); b.set(bytes); views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, target }); chunks.push(b); off += b.length; return views.length - 1; };
    (list || []).forEach((g) => {
      const P = yUp(g.pos), N = yUp(g.nrm), I = new Uint32Array(g.idx);
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
      const vp = view(new Uint8Array(P.buffer), 34962), vn = view(new Uint8Array(N.buffer), 34962), vi = view(new Uint8Array(I.buffer), 34963);
      accessors.push({ bufferView: vp, componentType: 5126, count: P.length / 3, type: "VEC3", min: mn, max: mx }, { bufferView: vn, componentType: 5126, count: N.length / 3, type: "VEC3" },
        { bufferView: vi, componentType: 5125, count: I.length, type: "SCALAR" });
      const a = accessors.length - 3, c = rgb(g.color).map(lin);
      const al = g.alpha != null && g.alpha < 1 ? g.alpha : 1;
      materials.push(Object.assign({ name: "pp_" + String(g.color).replace("#", "") + (al < 1 ? "_glass" : ""), doubleSided: true, pbrMetallicRoughness: { baseColorFactor: c.concat([al]), metallicFactor: 0, roughnessFactor: al < 1 ? 0.05 : 0.85 } }, al < 1 ? { alphaMode: "BLEND" } : {}));
      primitives.push({ attributes: { POSITION: a, NORMAL: a + 1 }, indices: a + 2, material: materials.length - 1, mode: 4 });
    });
    const bin = new Uint8Array(off); let p = 0; chunks.forEach((b) => { bin.set(b, p); p += b.length; });
    const nm = String(name || "model");
    const json = { asset: { version: "2.0", generator: "bitGen Studio PushPull" }, scene: 0, scenes: [{ name: nm, nodes: [0] }], nodes: [{ name: nm, mesh: 0 }],
      meshes: [{ name: nm, primitives }], materials, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }] };
    const LL = (lights || []).filter((L) => L && Array.isArray(L.p));
    if (LL.length) {
      json.extensionsUsed = ["KHR_lights_punctual"];
      json.extensions = { KHR_lights_punctual: { lights: LL.map((L) => Object.assign({ name: String(L.name || "light"), type: L.type === "spot" ? "spot" : "point", color: rgb(L.color).map(lin), intensity: +L.cd || 1 },
        L.type === "spot" ? { spot: { innerConeAngle: Math.max(0, (L.ang || 40) * Math.PI / 360 * 0.45), outerConeAngle: Math.min(Math.PI / 2, (L.ang || 40) * Math.PI / 360) } } : {})) } };
      LL.forEach((L, i) => { json.nodes.push(Object.assign({ name: String(L.name || "light") + " " + (i + 1), translation: [L.p[0], L.p[2], -L.p[1]], extensions: { KHR_lights_punctual: { light: i } } }, L.type === "spot" ? { rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] } : {})); json.scenes[0].nodes.push(json.nodes.length - 1); });
    }
    let jb = new TextEncoder().encode(JSON.stringify(json)); const jp = (4 - (jb.length % 4)) % 4;
    if (jp) { const t = new Uint8Array(jb.length + jp); t.set(jb); t.fill(0x20, jb.length); jb = t; }
    const out = new Uint8Array(12 + 8 + jb.length + 8 + bin.length), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
    dv.setUint32(12, jb.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jb, 20);
    dv.setUint32(20 + jb.length, bin.length, true); dv.setUint32(24 + jb.length, 0x004e4942, true); out.set(bin, 28 + jb.length);
    return out;
  }
  function obj(list, name) {
    const nm = String(name || "model").replace(/[^\w-]+/g, "_");
    let o = "# bitGen Studio PushPull\nmtllib " + nm + ".mtl\no " + nm + "\n", m = "", base = 1;
    (list || []).forEach((g) => {
      const mat = "pp_" + String(g.color).replace("#", ""), c = rgb(g.color);
      const al = g.alpha != null && g.alpha < 1 ? g.alpha : 1, mat2 = mat + (al < 1 ? "_glass" : "");
      if (!m.includes("newmtl " + mat2 + "\n")) m += "newmtl " + mat2 + "\nKd " + c.map((x) => x.toFixed(4)).join(" ") + "\nKa 0 0 0\nd " + al + "\n\n";
      for (let i = 0; i < g.pos.length; i += 3) o += "v " + g.pos[i] + " " + g.pos[i + 2] + " " + (-g.pos[i + 1]) + "\n";   // Y up
      o += "usemtl " + mat2 + "\n";
      for (let i = 0; i < g.idx.length; i += 3) o += "f " + (g.idx[i] + base) + " " + (g.idx[i + 1] + base) + " " + (g.idx[i + 2] + base) + "\n";
      base += g.pos.length / 3;
    });
    return { obj: o, mtl: m };
  }
  function stl(list, name) {
    let n = 0; (list || []).forEach((g) => { n += g.idx.length / 3; });
    const out = new Uint8Array(84 + n * 50), dv = new DataView(out.buffer);
    const head = new TextEncoder().encode(("bitGen Studio PushPull " + String(name || "")).slice(0, 79)); out.set(head, 0);
    dv.setUint32(80, n, true);
    let p = 84;
    (list || []).forEach((g) => {
      for (let i = 0; i < g.idx.length; i += 3) {
        const a = g.idx[i] * 3; dv.setFloat32(p, g.nrm[a], true); dv.setFloat32(p + 4, g.nrm[a + 1], true); dv.setFloat32(p + 8, g.nrm[a + 2], true); p += 12;
        for (let k = 0; k < 3; k++) { const q = g.idx[i + k] * 3; for (let j = 0; j < 3; j++) { dv.setFloat32(p, g.pos[q + j] * 1000, true); p += 4; } }
        p += 2;
      }
    });
    return out;
  }
  const api = { meshes, glb, obj, stl, DEF };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPOut = api;
})(typeof window !== "undefined" ? window : globalThis);
