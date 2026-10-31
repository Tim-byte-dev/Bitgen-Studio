/* bitGen Studio — ext/pushpulldock/ppfurn.js (2.628.0): THE SKETCHER'S 🛋 FURNITURE (window.PPFurn) - the House builder's
 * furniture library (static/housegeo.js CATALOGUE: 39 pieces - Living, Dining, Kitchen, Bedroom, Bathroom, Lights, Outside -
 * with its materials and procedural textures), placed in the Sketcher's building (M.arch.items).
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker ..."
 *   item {id, type, x, y, z (its floor), rot (degrees, clockwise seen from above), w, d, h, color ("" = its own)}
 *   pure: pieces() / categories() / make(type, p, z, rot) / footprint(it) / label(it) / clean(list)
 *   three: group(T, it) - the piece as a THREE.Group at its place, tagged {ak: "item", id}; its parts from
 *          H3HouseGeo.build() (the house's X / Y-up / Z-down-the-plan turned to the Sketcher's x / y / z-up)
 * Node: scripts/test-furn628.js. */
(function (root) {
  "use strict";
  const HG = () => root.H3HouseGeo || (typeof require === "function" ? require("../../static/housegeo.js") : null);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  function pieces() { const C = HG().CATALOGUE; return Object.keys(C).filter((k) => !C[k].hidden).map((k) => ({ type: k, label: C[k].label, cat: C[k].cat, w: C[k].w, d: C[k].d, h: C[k].h })); }
  function categories() { const out = []; pieces().forEach((p) => { if (!out.includes(p.cat)) out.push(p.cat); }); return out; }
  /* 2.630.0: 🧍 people (the House builder's mannequins - H3HouseGeo.POSES / personParts): type "person", pose, h, name */
  const POSES = () => HG().POSES;
  function make(type, p, z, rot, color, pose) {
    if (type === "person") return { type, x: r3(p[0]), y: r3(p[1]), z: r3(z || 0), rot: ((Math.round(+rot || 0) % 360) + 360) % 360, w: 0.5, d: 0.35, h: 1.75, color: color || "", pose: POSES()[pose] ? pose : "stand", name: "" };
    const c = HG().CATALOGUE[type]; if (!c || c.hidden) return null;
    return { type, x: r3(p[0]), y: r3(p[1]), z: r3(z || 0), rot: ((Math.round(+rot || 0) % 360) + 360) % 360, w: c.w, d: c.d, h: c.h, color: color || "" };
  }
  /** its outline on the floor (4 corners, metres) - w along its own x, d along its own y */
  function footprint(it) {
    const a = -(it.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), hw = it.w / 2, hd = it.d / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [r3(it.x + x * cs - y * sn), r3(it.y + x * sn + y * cs)]);
  }
  const label = (it) => (it.type === "person" ? (it.name || "Person") + " (" + (POSES()[it.pose] || "standing") + ")" : ((HG().CATALOGUE[it.type] || {}).label || it.type));
  function clean(list) {
    const C = HG() ? HG().CATALOGUE : {};
    return (Array.isArray(list) ? list : []).map((o) => {
      const n = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
      if (o && o.type === "person") return { id: o.id, type: "person", x: n(o.x, 0, -1e4, 1e4), y: n(o.y, 0, -1e4, 1e4), z: n(o.z, 0, -100, 1000), rot: n(o.rot, 0, -720, 720), pitch: n(o.pitch, 0, -180, 180), roll: n(o.roll, 0, -180, 180), w: 0.5, d: 0.35, h: n(o.h, 1.75, 0.9, 2.3),
        color: /^#[0-9a-f]{6}$/i.test(o.color || "") ? o.color : "", pose: HG().POSES[o.pose] ? o.pose : "stand", name: String(o.name || "").slice(0, 40) };
      if (!o || !C[o.type] || C[o.type].hidden) return null;
      return { id: o.id, type: o.type, x: n(o.x, 0, -1e4, 1e4), y: n(o.y, 0, -1e4, 1e4), z: n(o.z, 0, -100, 1000), rot: n(o.rot, 0, -720, 720), pitch: n(o.pitch, 0, -180, 180), roll: n(o.roll, 0, -180, 180), w: n(o.w, C[o.type].w, 0.02, 50), d: n(o.d, C[o.type].d, 0.02, 50), h: n(o.h, C[o.type].h, 0.01, 50), color: /^#[0-9a-f]{6}$/i.test(o.color || "") ? o.color : "" };
    }).filter(Boolean);
  }

  /* ---- three.js: the House builder's look (its materials + procedural textures - copied from static/housebuilder.js) */
  const TEX = {};
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function texture(T, kind) {
    if (!kind) return null;
    if (TEX[kind]) return TEX[kind];
    var c = document.createElement("canvas"); c.width = c.height = 256; var x = c.getContext("2d"), rnd = mulberry(kind.length * 7919);
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 256, 256);
    var noise = function (n, a) { for (var i = 0; i < n; i++) { x.fillStyle = "rgba(0,0,0," + (rnd() * a) + ")"; x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); } };
    if (kind === "planks" || kind === "grain") {
      var pw = kind === "planks" ? 256 / 5.5 : 256;
      for (var p = 0; p * pw < 256; p++) { x.fillStyle = "rgba(0,0,0," + (0.03 + rnd() * 0.09) + ")"; x.fillRect(p * pw, 0, pw, 256); for (var g = 0; g < 14; g++) { x.strokeStyle = "rgba(60,30,10," + (0.04 + rnd() * 0.08) + ")"; x.lineWidth = 1; x.beginPath(); var gx = p * pw + rnd() * pw; x.moveTo(gx, 0); x.bezierCurveTo(gx + rnd() * 8 - 4, 80, gx + rnd() * 8 - 4, 170, gx + rnd() * 6 - 3, 256); x.stroke(); }
        if (kind === "planks") { x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(p * pw, 0, 1.5, 256); x.fillRect(p * pw, (p * 97) % 256, pw, 1.5); } }
    } else if (kind === "tiles") { noise(400, 0.04); x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = 2; for (var t = 0; t <= 2; t++) { x.beginPath(); x.moveTo(t * 128, 0); x.lineTo(t * 128, 256); x.moveTo(0, t * 128); x.lineTo(256, t * 128); x.stroke(); } }
    else if (kind === "brick") { x.fillStyle = "#d8d2c8"; x.fillRect(0, 0, 256, 256); var bh = 256 / 13; for (var row = 0; row < 13; row++) for (var col = -1; col < 5; col++) { x.fillStyle = "rgb(" + (235 + rnd() * 20 | 0) + "," + (235 + rnd() * 20 | 0) + "," + (235 + rnd() * 20 | 0) + ")"; x.fillRect(col * 59 + (row % 2) * 29 + 2, row * bh + 2, 55, bh - 3); } }
    else if (kind === "marble") { noise(300, 0.03); for (var v = 0; v < 9; v++) { x.strokeStyle = "rgba(90,90,100," + (0.08 + rnd() * 0.15) + ")"; x.lineWidth = 0.5 + rnd() * 1.5; x.beginPath(); var mx = rnd() * 256, my = 0; x.moveTo(mx, my); for (var s = 0; s < 8; s++) { mx += rnd() * 60 - 30; my += 32; x.lineTo(mx, my); } x.stroke(); } }
    else if (kind === "carpet") noise(9000, 0.12);
    else if (kind === "stone" || kind === "concrete") { noise(5000, 0.1); if (kind === "stone") { x.strokeStyle = "rgba(0,0,0,.25)"; for (var k2 = 0; k2 < 12; k2++) { x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 20 + rnd() * 40, 0, 7); x.stroke(); } } }
    else noise(2500, 0.05);
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    TEX[kind] = tex; return tex;
  }

  const GEO = new Map(), MATS = new Map();
  function matFor(T, key, color) {
    const k = key + "|" + color; if (MATS.has(k)) return MATS.get(k);
    const M = HG().MATERIALS[key] || {}, glass = key === "glass", light = key === "light";
    const m = new T.MeshStandardMaterial({ color: new T.Color(color || M.color || "#cccccc"), roughness: M.rough != null ? M.rough : 0.8, metalness: /chrome|metal/.test(key) ? 0.6 : 0,
      transparent: glass, opacity: glass ? 0.3 : 1, emissive: light ? new T.Color("#fff2d0") : new T.Color(0), emissiveIntensity: light ? 0.8 : 0, side: T.DoubleSide });
    const tx = M.tex ? texture(T, M.tex) : null; if (tx) m.map = tx;
    MATS.set(k, m); return m;
  }
  /** the piece's meshes at the origin in the Sketcher's axes (cached per type / size / colour) */
  function parts(T, it) {
    const key = [it.type, it.w, it.d, it.h, it.color, it.pose || ""].join("|"); if (GEO.has(key)) return GEO.get(key);
    const person = it.type === "person";
    const m = { floors: [{ id: "f0", name: "", height: 10 }], walls: [], openings: [], rooms: [], stairs: [], cameras: [], lights: [],
      items: person ? [] : [{ id: "i", floor: 0, type: it.type, x: 0, y: 0, rot: 0, w: it.w, d: it.d, h: it.h, color: it.color || undefined }],
      people: person ? [{ id: "p", floor: 0, x: 0, y: 0, rot: 90, pose: it.pose || "stand", h: it.h, color: it.color || "" }] : [] };   // a person at rot 90 = unturned
    const out = HG().build(m).meshes.map((mh) => {
      const g = new T.BufferGeometry(), P = mh.pos, N = mh.nrm, pos = new Float32Array(P.length), nrm = new Float32Array(N.length);
      for (let i = 0; i < P.length; i += 3) { pos[i] = P[i]; pos[i + 1] = -P[i + 2]; pos[i + 2] = P[i + 1]; nrm[i] = N[i]; nrm[i + 1] = -N[i + 2]; nrm[i + 2] = N[i + 1]; }
      g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("normal", new T.BufferAttribute(nrm, 3));
      if (mh.uv) g.setAttribute("uv", new T.BufferAttribute(new Float32Array(mh.uv), 2));
      if (mh.idx) g.setIndex(Array.from(mh.idx));
      return { g, mat: mh.mat, color: mh.color };
    });
    GEO.set(key, out); return out;
  }
  function group(T, it) {
    const G3 = new T.Group(); G3.userData.tag = { ak: "item", id: it.id };
    parts(T, it).forEach((p) => { const me = new T.Mesh(p.g, matFor(T, p.mat, p.color)); me.castShadow = me.receiveShadow = true; G3.add(me); });
    G3.position.set(it.x, it.y, it.z || 0);
    G3.rotation.order = "ZXY"; G3.rotation.z = -(it.rot || 0) * Math.PI / 180;      // 2.633.0: + pitch (about its own side) and roll (about its front)
    G3.rotation.x = (it.pitch || 0) * Math.PI / 180; G3.rotation.y = (it.roll || 0) * Math.PI / 180;
    return G3;
  }
  /* 2.629.0: the House builder's MATERIALS as paints - a colour "mat:<key>" on a face / a wall / a floor */
  function materials() { const M = HG().MATERIALS; return Object.keys(M).filter((k) => !/^(light|glass|black|chrome|metal|rubber|soil|paint_car)$/.test(k)).map((k) => ({ key: k, label: M[k].label || k, color: M[k].color, tex: M[k].tex || null })); }
  const isMat = (col) => typeof col === "string" && col.startsWith("mat:");
  /** a colour -> a plain hex (a material's own colour) - exports, the swatches */
  function hex(col) { if (!isMat(col)) return col; const m = HG().MATERIALS[col.slice(4)]; return m ? m.color : "#cccccc"; }
  /** a colour -> {color, map, rough} for a three.js material (a material: its colour + procedural texture) */
  function look(T, col) {
    if (!isMat(col)) return { color: col, map: null, rough: 0.9 };
    const m = HG().MATERIALS[col.slice(4)] || {};
    return { color: m.color || "#cccccc", map: m.tex ? texture(T, m.tex) : null, rough: m.rough != null ? m.rough : 0.9 };
  }
  /** metre UVs for flat triangles (positions xyz ...): each triangle projected on its own plane - one texture a metre */
  function uvs(pos) {
    const out = new Float32Array(pos.length / 3 * 2);
    for (let i = 0; i < pos.length; i += 9) {
      const a = [pos[i], pos[i + 1], pos[i + 2]], b = [pos[i + 3], pos[i + 4], pos[i + 5]], c = [pos[i + 6], pos[i + 7], pos[i + 8]];
      const u1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], u2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]], ax = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
      const pick = ax[2] >= ax[0] && ax[2] >= ax[1] ? [0, 1] : ax[0] >= ax[1] ? [1, 2] : [0, 2];      // the plane it faces most: z -> xy, x -> yz, y -> xz
      [a, b, c].forEach((p, k) => { out[(i / 3 + k) * 2] = p[pick[0]]; out[(i / 3 + k) * 2 + 1] = p[pick[1]]; });
    }
    return out;
  }
  const api = { POSES, pieces, categories, make, footprint, label, clean, group, parts, materials, isMat, hex, look, uvs, texture };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPFurn = api;
})(typeof window !== "undefined" ? window : globalThis);
