// bitGen Studio — lib/dazLib.js (2.977.0): 📚 THE DAZ LIBRARY, READ BY BITGEN ITSELF (no Daz Studio running, no other add-on).
// Tim: "daz ships many assets when u dl it. can we use the assets and ones we got for free or bought directly without
// starting daz?" -> "just for bitgen to point to the daz library, and can we build our own dforce... but also make sure to say
// this is not a replacement for daz studio this is made for light tasks and DAZ studio is a very powerful character creator"
// -> "build steps 1-4".
// NOT A REPLACEMENT FOR DAZ STUDIO: a light reader for quick characters; Daz Studio is a very powerful character creator
// (its full shaping, formulas, HD detail, Iray, dForce, posing). Daz content is the user's own, used on this computer only
// (Daz's licence: renders / videos are theirs to publish, the 3D data is never shared) - bitGen ships no Daz content.
//
// DSON (.duf / .dsf - JSON, often gzipped): figures, wearables (clothes, hair, eyes, mouth, grafts), morphs (shape dials).
// Daz Connect's encrypted .duf.enc / .dsf.enc cannot be read - listed as skipped.
//   roots() / setRoots(list) / detectRoots()    the content folders (config.daz_library.roots; the usual places found)
//   readDson(file)                                gunzip + JSON (cached); .enc -> error {encrypted}
//   resolve(url, fromFile)                        "/data/DAZ%203D/...dsf#id" | "#id" -> {file, id, obj, kind}
//   scan({root, kind, q, limit})                  .duf assets under People/ (+ Props/...) with their thumbnails + kind
//   morphsFor(figureUrl, {q, limit})              the figure's shape dials: [{file, id, label, group}]
//   build(spec) -> {glb, info}                    a character: figure .duf + dials + wearables (conformed: same bones) +
//                                                 drape (lib/clothSim.js) + face (lib/dazFace.js) -> one .glb with the
//                                                 skeleton, skin weights, the dials as morph targets, base-colour textures
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const core = require("./core");

const NOT_DAZ = "This is not a replacement for Daz Studio - it is made for light tasks; Daz Studio is a very powerful character creator.";
const CM = 0.01;
const cache = new Map();
function bad(m, s) { const e = new Error(m); e.status = s || 400; return e; }

/* ---------------- the folders */
function detectRoots() {
  const h = os.homedir(), c = [path.join(h, "Documents", "DAZ 3D", "Studio", "My Library"), "C:\\Users\\Public\\Documents\\My DAZ 3D Library",
    "/Users/Shared/My DAZ 3D Library", path.join(h, "Documents", "My DAZ 3D Library"), path.join(h, "Documents", "My DAZ Connect Library")];
  return c.filter((d) => { try { return fs.statSync(path.join(d, "data")).isDirectory() || fs.statSync(path.join(d, "People")).isDirectory(); } catch { return false; } });
}
function roots() {
  const r = ((core.getConfig() || {}).daz_library || {}).roots;
  const list = Array.isArray(r) && r.length ? r : detectRoots();
  return [...new Set(list.map(String))].filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
}
function setRoots(list) {
  const c = core.getConfig() || {};
  c.daz_library = Object.assign({}, c.daz_library, { roots: (Array.isArray(list) ? list : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12) });
  core.setConfig(c);
  cache.clear();
  return roots();
}

/* ---------------- DSON */
function readDson(file) {
  if (/\.enc$/i.test(file)) { const e = bad("encrypted (Daz Connect) - only Daz Studio can read it", 415); e.encrypted = true; throw e; }
  const st = fs.statSync(file), k = file + "|" + st.mtimeMs;
  if (cache.has(k)) return cache.get(k);
  let b = fs.readFileSync(file);
  if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  const j = JSON.parse(b.toString("utf8"));
  if (cache.size > 400) cache.clear();
  cache.set(k, j);
  return j;
}
function fileOfUrl(u, fromFile, rts) {
  const s = String(u || ""), hash = s.indexOf("#"), p = decodeURIComponent(hash >= 0 ? s.slice(0, hash) : s);
  if (!p) return fromFile;
  for (const r of rts || roots()) { const f = path.join(r, ...p.split("/").filter(Boolean)); if (fs.existsSync(f)) return f; }
  return null;
}
const LIBS = ["geometry_library", "node_library", "uv_set_library", "modifier_library", "material_library", "image_library"];
function resolve(url, fromFile, rts) {
  const s = String(url || ""), id = decodeURIComponent(s.includes("#") ? s.slice(s.indexOf("#") + 1) : "");
  const file = fileOfUrl(s, fromFile, rts); if (!file) return null;
  const j = readDson(file);
  for (const k of LIBS) for (const o of j[k] || []) if (!id || o.id === id) return { file, id: o.id, obj: o, kind: k };
  return null;
}
const strip = (s) => String(s || "").replace(/^#/, "").replace(/%20/g, " ");

/* ---------------- the library */
const KIND_RX = [["character", /\/characters?\//i], ["hair", /\/hair\//i], ["clothing", /\/(clothing|wardrobe|outfits?|shoes|footwear)\//i],
  ["anatomy", /\/anatomy\//i], ["figure", /\/people\/genesis[^/]*\/?[^/]*\.duf$/i], ["shape", /\/(shapes?|morphs?)\//i], ["pose", /\/(poses?|expressions?)\//i],
  ["material", /\/(materials?|skins?|makeup)\//i]];
function kindOf(rel, j) {
  const t = ((j && j.asset_info && j.asset_info.type) || "").toLowerCase();
  if (t === "figure") return "figure";
  if (t === "wearable" || t === "preset_wearable") return /hair/i.test(rel) ? "hair" : "clothing";
  if (t === "character" || t === "preset_character") return "character";
  if (/^preset_(pose|hierarchical_pose)/.test(t)) return "pose";
  if (/^preset_(material|shader)/.test(t)) return "material";
  if (t === "preset_shape" || t === "modifier") return "shape";
  for (const [k, rx] of KIND_RX) if (rx.test("/" + rel.replace(/\\/g, "/"))) return k;
  return "other";
}
function thumbOf(f) { for (const t of [f + ".png", f.replace(/\.duf$/i, ".png"), f.replace(/\.duf$/i, ".tip.png")]) if (fs.existsSync(t)) return t; return ""; }
function scan(o) {
  const x = o || {}, R = x.root ? [x.root] : roots(), q = String(x.q || "").toLowerCase(), lim = Math.max(1, Math.min(5000, +x.limit || 1500));
  const out = [], enc = [];
  for (const r of R) {
    const walk = (d, depth) => {
      if (depth > 9 || out.length >= lim) return;
      let L = []; try { L = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of L) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) { if (!/^(data|runtime|\.|scripts)/i.test(e.name) || depth > 0) walk(f, depth + 1); continue; }
        if (/\.duf\.enc$/i.test(e.name)) { enc.push(path.relative(r, f)); continue; }
        if (!/\.duf$/i.test(e.name)) continue;
        const rel = path.relative(r, f).replace(/\\/g, "/");
        if (q && !rel.toLowerCase().includes(q)) continue;
        let j = null; try { j = readDson(f); } catch { j = null; }
        const kind = kindOf(rel, j);
        if (x.kind && x.kind !== kind) continue;
        out.push({ root: r, rel, name: e.name.replace(/\.duf$/i, ""), kind, thumb: thumbOf(f) ? path.relative(r, thumbOf(f)).replace(/\\/g, "/") : "" });
        if (out.length >= lim) return;
      }
    };
    for (const top of ["People", "Props", "Environments"]) walk(path.join(r, top), 1);
  }
  return { items: out, encrypted: enc.length, encrypted_examples: enc.slice(0, 5), roots: R, note: NOT_DAZ };
}
/** where a library-relative file is (only inside a library folder) */
function abs(root, rel) {
  const r = roots().find((x) => path.resolve(x) === path.resolve(String(root || ""))) || roots()[0];
  if (!r) throw bad("no Daz library folder is set - 📚 ▸ Folders", 404);
  const f = path.resolve(r, String(rel || ""));
  if (!f.startsWith(path.resolve(r) + path.sep)) throw bad("not inside the library", 403);
  if (!fs.existsSync(f)) throw bad("not in the library: " + rel, 404);
  return f;
}

/* ---------------- a figure from a .duf */
const ptOf = (arr) => { const o = { x: 0, y: 0, z: 0 }; (arr || []).forEach((c) => { if (c && c.id in o) o[c.id] = +c.value || 0; }); return [o.x, o.y, o.z]; };
/** the figure node of a .duf scene (+ conformed nodes: eyes, mouth, clothes, hair, grafts) */
function sceneNodes(duf) {
  const j = readDson(duf), nodes = (j.scene && j.scene.nodes) || [];
  const fig = nodes.find((n) => !n.conform_target && !n.parent && /figure/i.test(String((resolve(n.url, duf) || {}).obj && resolve(n.url, duf).obj.type || ""))) || nodes.find((n) => !n.conform_target) || null;
  return { j, fig, conformed: nodes.filter((n) => n.conform_target), modifiers: (j.scene && j.scene.modifiers) || [], materials: (j.scene && j.scene.materials) || [] };
}
/** a figure's pieces from its data .dsf: geometry, uv, bones, skin */
function figureData(node, fromFile) {
  const nr = resolve(node.url, fromFile); if (!nr) throw bad("the figure's data file is not in the library: " + String(node.url), 404);
  const dj = readDson(nr.file);
  const gUrl = ((node.geometries || [])[0] || {}).url || ((nr.obj.geometries || [])[0] || {}).url || "#" + ((dj.geometry_library || [])[0] || {}).id;
  const g = resolve(gUrl, nr.file) || { obj: (dj.geometry_library || [])[0], file: nr.file };
  if (!g.obj) throw bad("no geometry in " + path.basename(nr.file));
  const uvr = g.obj.default_uv_set ? resolve(g.obj.default_uv_set, g.file) : null;
  // 2.979.0: + the rotation order (its first letter = the twist axis), the orientation, the rotation limits (🧍 Pose)
  const lims = (arr) => { const o = {}; (arr || []).forEach((c) => { if (c && /^[xyz]$/.test(c.id) && c.clamped !== false && (c.min != null || c.max != null)) o[c.id] = [c.min != null ? +c.min : -180, c.max != null ? +c.max : 180]; }); return o; };
  const bones = (dj.node_library || []).filter((n) => n.type === "bone" || n.type === "figure").map((n) => ({ id: n.id, name: n.name || n.id, parent: n.parent ? strip(n.parent.split("#").pop()) : null, center: ptOf(n.center_point), end: ptOf(n.end_point),
    order: /^[XYZ]{3}$/.test(n.rotation_order || "") ? n.rotation_order : "XYZ", orient: ptOf(n.orientation), lim: lims(n.rotation), label: n.label || n.name || n.id }));
  const skinMod = (dj.modifier_library || []).find((m) => m.skin);
  return { file: nr.file, id: nr.id, label: (node.label || nr.obj.label || nr.obj.name || nr.id), geo: g.obj, uv: uvr && uvr.obj, bones, skin: skinMod && skinMod.skin };
}
/** a morph's deltas (+ its label) from a modifier url */
function morphOf(url, fromFile) {
  const r = resolve(url, fromFile); if (!r || !r.obj || !r.obj.morph) return null;
  const ch = r.obj.channel || {};
  return { id: r.obj.id, label: ch.label || r.obj.name || r.obj.id, min: ch.min != null ? +ch.min : 0, max: ch.max != null ? +ch.max : 1, deltas: (r.obj.morph.deltas || {}).values || [], file: r.file };
}
function morphsFor(figureUrl, o) {
  const x = o || {}, q = String(x.q || "").toLowerCase(), lim = Math.max(1, Math.min(3000, +x.limit || 600));
  const nr = resolve(figureUrl); if (!nr) return [];
  const dir = path.join(path.dirname(nr.file), "Morphs"), out = [];
  const walk = (d, depth) => {
    if (depth > 6 || out.length >= lim) return;
    let L = []; try { L = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of L) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f, depth + 1); continue; }
      if (!/\.dsf$/i.test(e.name)) continue;
      let j; try { j = readDson(f); } catch { continue; }
      for (const m of j.modifier_library || []) {
        if (!m.morph) continue;
        const ch = m.channel || {}, label = ch.label || m.name || m.id;
        if (q && !(label + " " + m.id).toLowerCase().includes(q)) continue;
        if (ch.visible === false) continue;
        out.push({ url: "/" + path.relative(rootOf(f), f).replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/") + "#" + encodeURIComponent(m.id), label, group: String(m.group || "").split("/").pop(), min: ch.min != null ? +ch.min : 0, max: ch.max != null ? +ch.max : 1 });
        if (out.length >= lim) return;
      }
    }
  };
  walk(dir, 0);
  return out;
}
function rootOf(f) { return roots().find((r) => path.resolve(f).startsWith(path.resolve(r) + path.sep)) || path.dirname(f); }

/* ---------------- the mesh: DSON polygons -> glTF triangles (corners split by UV) */
function meshOf(fd, values, hide) {
  const V = (fd.geo.vertices || {}).values || [], PL = (fd.geo.polylist || {}).values || [];
  const mats = ((fd.geo.polygon_material_groups || {}).values || []).slice();
  const base = new Float32Array(V.length * 3); V.forEach((p, i) => { base[i * 3] = p[0] * CM; base[i * 3 + 1] = p[1] * CM; base[i * 3 + 2] = p[2] * CM; });
  const shaped = Float32Array.from(base);
  for (const m of values || []) for (const d of m.deltas) { const i = d[0] * 3; if (i + 2 < shaped.length) { shaped[i] += d[1] * CM * m.w; shaped[i + 1] += d[2] * CM * m.w; shaped[i + 2] += d[3] * CM * m.w; } }
  const UV = (fd.uv && fd.uv.uvs && fd.uv.uvs.values) || [], over = new Map();
  for (const t of (fd.uv && fd.uv.polygon_vertex_indices) || []) over.set(t[0] + ":" + t[1], t[2]);
  const keyIdx = new Map(), src = [], uvi = [], byMat = new Map();
  PL.forEach((p, pi) => {
    if (hide && hide.has(pi)) return;
    const vs = p.slice(2), corners = vs.map((v) => { const u = over.has(pi + ":" + v) ? over.get(pi + ":" + v) : v, k = v + ":" + u; let n = keyIdx.get(k); if (n === undefined) { n = src.length; keyIdx.set(k, n); src.push(v); uvi.push(u); } return n; });
    const L = byMat.get(p[1]) || []; byMat.set(p[1], L);
    for (let t = 1; t + 1 < corners.length; t++) L.push(corners[0], corners[t], corners[t + 1]);
  });
  return { base, shaped, src, uvi, UV, byMat, mats };
}

/* ---------------- the build */
function skinTop4(skin, nVerts, boneIndex) {
  const J = new Uint16Array(nVerts * 4), W = new Float32Array(nVerts * 4), cnt = new Uint8Array(nVerts);
  for (const jt of (skin && skin.joints) || []) {
    const bi = boneIndex(strip(String(jt.node || "").split("#").pop())); if (bi < 0) continue;
    for (const [v, w] of ((jt.node_weights || {}).values || [])) {
      if (v >= nVerts || !(w > 0)) continue;
      let k = cnt[v]; if (k < 4) { J[v * 4 + k] = bi; W[v * 4 + k] = w; cnt[v]++; continue; }
      let mi = 0; for (let q = 1; q < 4; q++) if (W[v * 4 + q] < W[v * 4 + mi]) mi = q;
      if (w > W[v * 4 + mi]) { J[v * 4 + mi] = bi; W[v * 4 + mi] = w; }
    }
  }
  for (let v = 0; v < nVerts; v++) { const s = W[v * 4] + W[v * 4 + 1] + W[v * 4 + 2] + W[v * 4 + 3]; if (s > 0) for (let q = 0; q < 4; q++) W[v * 4 + q] /= s; else W[v * 4] = 1; }
  return { J, W };
}
/** the diffuse / base colour picture of a material group (searched through the .duf's material overrides, then the data) */
function textureOf(mats, groupName, fromFile) {
  for (const m of mats || []) {
    if (!(m.groups || []).includes(groupName)) continue;
    let found = "";
    const look = (o) => { if (found || !o || typeof o !== "object") return; if (o.image_file && /diffuse|base ?color|albedo/i.test(String(o.id || o.label || o.name || ""))) found = o.image_file; for (const v of Object.values(o)) look(v); };
    look(m);
    if (!found) { const look2 = (o) => { if (found || !o || typeof o !== "object") return; if (o.image_file) found = o.image_file; for (const v of Object.values(o)) look2(v); }; look2(m.diffuse); }
    if (found) { const f = fileOfUrl(found, fromFile); if (f) return f; }
  }
  return "";
}

/** spec = {root, rel (a figure / character .duf), dials [{url, value}], wear [{root, rel}], drape, face {photo}, maxTex}
 *  -> {glb: Buffer, info} */
async function build(spec) {
  const s = spec || {}, duf = abs(s.root, s.rel), sc = sceneNodes(duf);
  if (!sc.fig) throw bad("no figure in " + path.basename(duf));
  const fig = figureData(sc.fig, duf), warnings = [];
  // the dials: the .duf's own (a character preset) + the ones picked
  const dialVals = new Map();
  for (const m of sc.modifiers) { const v = m.channel && (m.channel.current_value != null ? m.channel.current_value : m.channel.value); if (m.url && +v) dialVals.set(m.url, +v); }
  for (const d of s.dials || []) if (d && d.url) dialVals.set(String(d.url), +d.value || 0);
  // 2.979.0: the figure's own formulas (lib/dazMuscle.js, static/dazformula.js) - the dials + the ERCs they drive at the rest
  // pose, and the JCMs (muscle reactions) that follow the bones: morph targets the 🧍 Pose view drives live
  const DM = require("./dazMuscle"), FX = require("../static/dazformula.js"), ix = DM.index(fig.file), set = {};
  for (const [u, w] of dialVals) set[FX.parseUrl(u).id] = w;
  const sol = DM.solve(fig.file, set, { index: ix }), morphs = [], have = new Set();
  for (const [u, w0] of dialVals) {
    const id = FX.parseUrl(u).id, inIx = ix.mods.get(id);
    if (inIx && !inIx.morph) { have.add(id); continue; }                      // a controller: its shapes come through the formulas
    const m = morphOf(u, duf); if (m && m.deltas.length) { have.add(m.id); morphs.push(Object.assign(m, { w: m.id in sol.rest ? sol.rest[m.id] : w0 })); } else if (w0) warnings.push("a dial was not found: " + decodeURIComponent(u.split("#").pop()));
  }
  for (const m of sol.shape) if (!have.has(m.id) && m.deltas.length) morphs.push({ id: m.id, label: m.label, w: m.w, deltas: m.deltas, erc: true });
  // 2.981.0: the project's own morphs (📷 B - a scan wrapped onto this figure: lib/dazBodyFit.js saveMorph)
  const nV = ((fig.geo.vertices || {}).values || []).length;
  for (const cn of Array.isArray(s.custom) ? s.custom : []) {
    const cm = require("./dazBodyFit").readMorph(cn);
    if (!cm) { warnings.push("your morph \"" + cn + "\" is not in this project"); continue; }
    if (cm.vertices !== nV) { warnings.push("your morph \"" + cn + "\" was made for another figure (" + cm.vertices + " vertices, this one " + nV + ")"); continue; }
    morphs.push({ id: "custom:" + cm.name, label: "📷 " + cm.name, w: 1, deltas: cm.deltas || [], custom: true });
  }
  let muscle = s.muscles === false ? null : sol.jcm.length ? { kind: "jcm", targets: sol.jcm.filter((t) => t.deltas.length), client: sol.client } : null;
  if (!muscle && s.muscles !== false) { const fx = DM.flex(fig); if (fx.jcm.length) muscle = { kind: "flex", targets: fx.jcm, client: fx.client }; }
  if (sol.info.skipped) warnings.push(sol.info.skipped + " formula(s) into bone centres / end points not applied (light tasks - Daz Studio does those)");
  if (sol.info.more) warnings.push(sol.info.more + " more muscle shape(s) past " + DM.MAX_JCM + " left out");
  // the skeleton: the figure's bones; conformed pieces' bones found by name, else added under their parent
  const bones = fig.bones.slice(), bIdx = (id) => bones.findIndex((b) => b.id === id || b.name === id);
  const pieces = [{ fd: fig, mats: sc.materials, file: duf, kind: "figure", name: fig.label, values: morphs }];
  const wearDufs = (s.wear || []).map((w) => { try { return abs(w.root || s.root, w.rel); } catch (e) { warnings.push(e.message); return null; } }).filter(Boolean);
  const conformed = sc.conformed.map((n) => ({ n, file: duf })).concat(wearDufs.flatMap((f) => { const w = sceneNodes(f); return (w.fig ? [w.fig] : []).concat(w.conformed).map((n) => ({ n, file: f, mats: w.materials })); }));
  for (const c of conformed) {
    let fd; try { fd = figureData(c.n, c.file); } catch (e) { warnings.push(e.message); continue; }
    for (const b of fd.bones) if (bIdx(b.id) < 0) bones.push(b);
    const kind = fd.geo.graft ? "graft" : /eye/i.test(fd.label) ? "eyes" : /mouth|teeth|tongue/i.test(fd.label) ? "mouth" : /hair/i.test(c.file) ? "hair" : "clothing";
    pieces.push({ fd, mats: c.mats || sc.materials, file: c.file, kind, name: fd.label, values: [] });
  }
  // grafts hide the body polygons they replace
  const hide = new Set(); pieces.filter((p) => p.kind === "graft").forEach((p) => ((p.fd.geo.graft || {}).hidden_polys || {}).values && p.fd.geo.graft.hidden_polys.values.forEach((i) => hide.add(i)));
  const M = pieces.map((p, i) => meshOf(p.fd, p.values, i === 0 ? hide : null));
  // 3 the drape: clothing / hair settled on the (shaped) body - our own cloth (lib/clothSim.js)
  if (s.drape) {
    const body = M[0], btris = [].concat(...[...body.byMat.values()]).map((c) => body.src[c]);
    const bpos = body.shaped;
    const kinds = Array.isArray(s.drape.kinds) && s.drape.kinds.length ? s.drape.kinds : ["clothing", "hair"];
    const CS = require("./clothSim"), BH = new CS.Hash(bpos, 0.03);
    pieces.forEach((p, i) => {
      if (!kinds.includes(p.kind) || p.kind === "figure" || p.kind === "eyes" || p.kind === "mouth" || p.kind === "graft") return;
      const m = M[i], tris = [].concat(...[...m.byMat.values()]).map((c) => m.src[c]);
      // hair (and anything marked "other"): held at the roots - stiff where it touches the body, free towards the ends
      const st = p.kind === "clothing" ? null : hairStiffness(m.shaped, bpos, BH);
      const r = CS.drape({ pos: m.shaped, tris }, { pos: bpos, tris: btris }, { frames: +s.drape.frames || 45, thickness: 0.003, stiffness: st, bend: p.kind === "hair" ? 0.4 : 0.15 });
      m.shaped = r.pos; p.draped = Math.round(r.moved * 1000);
    });
  }
  // 4 the face from a photo (lib/dazFace.js): its texture onto the head (+ the proportions)
  let faceInfo = null;
  // 2.981.0: 📷 a photo (A) or a scan (B) painted into the figure's own UVs (lib/dazBodyFit.js)
  if (s.paint && (s.paint.photos || s.paint.scan)) {
    try {
      const BF = require("./dazBodyFit");
      const r = s.paint.scan ? BF.paintScan({ pieces, M, scan: BF.readGlbMesh(fs.readFileSync(s.paint.scan)), align: s.paint.align, maxTex: s.maxTex }) : BF.paintPhoto({ pieces, M, fig, photos: s.paint.photos, maxTex: s.maxTex });
      faceInfo = { textures: r.textures, summary: Object.assign({ painted: true }, r.summary) };
      if (!r.summary.materials.length) warnings.push("paint: " + (r.summary.note || "no material with a picture to paint into"));
    } catch (e) { warnings.push("paint: " + e.message); }
  }
  if (!faceInfo && s.face && s.face.photo) { try { faceInfo = await require("./dazFace").apply({ pieces, M, bones, photo: s.face.photo, landmarks: s.face.landmarks, maxTex: s.maxTex }); } catch (e) { warnings.push("face: " + e.message); } }
  const daz = { note: NOT_DAZ, muscles: muscle ? muscle.kind : "none", model: muscle ? muscle.client : { mods: {}, formulas: [] }, rest: muscle ? Object.fromEntries(muscle.targets.map((t) => [t.id, t.rest || 0])) : {},
    bones: Object.fromEntries(bones.map((b) => [b.id, { name: b.name, label: b.label, order: b.order || "XYZ", orient: b.orient || [0, 0, 0], lim: b.lim || {}, parent: b.parent }])) };
  const glb = await writeGlb(pieces, M, bones, morphs, { maxTex: +s.maxTex || 2048, faceInfo, extra: muscle ? muscle.targets.map((t) => ({ name: "jcm:" + t.id, label: t.label, deltas: t.deltas })) : [], daz });
  return { glb, info: { figure: fig.label, pieces: pieces.map((p) => ({ name: p.name, kind: p.kind, draped_mm: p.draped || 0 })), dials: morphs.map((m) => ({ label: m.label, value: m.w, erc: !!m.erc })), bones: bones.length, warnings, face: faceInfo && faceInfo.summary,
    muscles: { kind: muscle ? muscle.kind : "none", shapes: muscle ? muscle.targets.length : 0, formulas: sol.info.formulas, files: sol.info.files }, note: NOT_DAZ } };
}

/** per vertex 0..1: 1 within 1.5 cm of the body (the roots), 0 past 8 cm (the ends) - hair swings, the scalp holds it */
function hairStiffness(pos, bpos, H) {
  const n = pos.length / 3, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = H.near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const d = j < 0 ? 1 : Math.hypot(pos[i * 3] - bpos[j * 3], pos[i * 3 + 1] - bpos[j * 3 + 1], pos[i * 3 + 2] - bpos[j * 3 + 2]);
    out[i] = Math.max(0, Math.min(1, (0.08 - d) / 0.065));
  }
  return out;
}
/** pictures -> PNG / JPEG bytes (made smaller with ffmpeg when over maxTex) */
function texBytes(file, max) {
  if (!file || !fs.existsSync(file)) return null;
  const ext = path.extname(file).toLowerCase();
  const r = require("child_process").spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale='min(${max},iw)':-2`, "-frames:v", "1", "-f", "image2pipe", "-vcodec", ext === ".png" ? "png" : "mjpeg", "-q:v", "3", "-"], { maxBuffer: 1 << 28 });
  if (r.status === 0 && r.stdout && r.stdout.length) return { data: r.stdout, mime: ext === ".png" ? "image/png" : "image/jpeg" };
  if ([".png", ".jpg", ".jpeg"].includes(ext)) return { data: fs.readFileSync(file), mime: ext === ".png" ? "image/png" : "image/jpeg" };
  return null;
}
async function writeGlb(pieces, M, bones, morphs, o) {
  const G = require("./glbMerge"), bins = []; let len = 0;
  const add = (buf) => { const pad = (4 - (len % 4)) % 4; if (pad) { bins.push(Buffer.alloc(pad)); len += pad; } const at = len; bins.push(buf); len += buf.length; return at; };
  const J = { asset: { version: "2.0", generator: "bitGen Studio - Daz library (not a replacement for Daz Studio)" }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], skins: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987 }] };
  const view = (buf, target) => { J.bufferViews.push(Object.assign({ buffer: 0, byteOffset: add(buf), byteLength: buf.length }, target ? { target } : {})); return J.bufferViews.length - 1; };
  const acc = (arr, type, ct, extra) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); J.accessors.push(Object.assign({ bufferView: view(b, extra && extra.target), componentType: ct, count: arr.length / ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 })[type], type }, extra && extra.mm ? extra.mm : {})); return J.accessors.length - 1; };
  const mm3 = (a) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < a.length; i++) { const k = i % 3; if (a[i] < mn[k]) mn[k] = a[i]; if (a[i] > mx[k]) mx[k] = a[i]; } return a.length ? { min: mn, max: mx } : {}; };
  // bones -> nodes (translations relative to the parent's centre; bind = identity rotations)
  const bi0 = J.nodes.length, idOf = new Map(bones.map((b, i) => [b.id, i]));
  bones.forEach((b) => { const p = b.parent != null && idOf.has(b.parent) ? bones[idOf.get(b.parent)] : null; J.nodes.push({ name: b.name, translation: [(b.center[0] - (p ? p.center[0] : 0)) * CM, (b.center[1] - (p ? p.center[1] : 0)) * CM, (b.center[2] - (p ? p.center[2] : 0)) * CM] }); });
  bones.forEach((b, i) => { if (b.parent != null && idOf.has(b.parent)) { const pn = J.nodes[bi0 + idOf.get(b.parent)]; (pn.children = pn.children || []).push(bi0 + i); } });
  const rootsB = bones.map((b, i) => i).filter((i) => !(bones[i].parent != null && idOf.has(bones[i].parent)));
  const ibm = new Float32Array(bones.length * 16); bones.forEach((b, i) => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.center[0] * CM, -b.center[1] * CM, -b.center[2] * CM, 1], i * 16); });
  J.skins.push({ name: "skeleton", joints: bones.map((_, i) => bi0 + i), inverseBindMatrices: acc(ibm, "MAT4", 5126), skeleton: bi0 + (rootsB[0] || 0) });
  const texCache = new Map();
  const matFor = (p, gi, mesh) => {
    const gname = mesh.mats[gi] || "material " + gi, key = p.file + "|" + gname;
    if (texCache.has(key)) return texCache.get(key);
    const faceTex = o.faceInfo && o.faceInfo.textures && o.faceInfo.textures[key];
    const t = faceTex || texBytes(textureOf(p.mats, gname, p.file), o.maxTex);
    const m = { name: gname, pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.7 }, doubleSided: p.kind !== "figure" };
    if (/cornea|eye ?moisture|tear/i.test(gname)) { m.alphaMode = "BLEND"; m.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 0.05]; }
    if (t) { J.images.push({ bufferView: view(t.data), mimeType: t.mime, name: gname }); J.textures.push({ source: J.images.length - 1, sampler: 0 }); m.pbrMetallicRoughness.baseColorTexture = { index: J.textures.length - 1 }; if (p.kind === "hair") m.alphaMode = "MASK"; }
    J.materials.push(m); texCache.set(key, J.materials.length - 1); return J.materials.length - 1;
  };
  const boneIndex = (id) => { const i = bones.findIndex((b) => b.id === id || b.name === id); return i; };
  pieces.forEach((p, pi) => {
    const m = M[pi], n = m.src.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let c = 0; c < n; c++) { const v = m.src[c]; pos[c * 3] = m.shaped[v * 3]; pos[c * 3 + 1] = m.shaped[v * 3 + 1]; pos[c * 3 + 2] = m.shaped[v * 3 + 2]; const u = m.UV[m.uvi[c]] || [0, 0]; uv[c * 2] = u[0]; uv[c * 2 + 1] = 1 - u[1]; }
    const allTris = [].concat(...[...m.byMat.values()]);
    const nrm = require("./clothSim").vertexNormals(pos, allTris);
    const sk = skinTop4(p.fd.skin, m.base.length / 3, boneIndex), jj = new Uint16Array(n * 4), ww = new Float32Array(n * 4);
    for (let c = 0; c < n; c++) for (let q = 0; q < 4; q++) { jj[c * 4 + q] = sk.J[m.src[c] * 4 + q]; ww[c * 4 + q] = sk.W[m.src[c] * 4 + q]; }
    const attrs = { POSITION: acc(pos, "VEC3", 5126, { target: 34962, mm: mm3(pos) }), NORMAL: acc(nrm, "VEC3", 5126, { target: 34962 }), TEXCOORD_0: acc(uv, "VEC2", 5126, { target: 34962 }), JOINTS_0: acc(jj, "VEC4", 5123, { target: 34962 }), WEIGHTS_0: acc(ww, "VEC4", 5126, { target: 34962 }) };
    // the dials as morph targets (the body only - a dial's deltas are the body's); weights 0 (the dialled shape is already in
    // POSITION: a target moves it on by its delta) + 2.979.0 the muscle shapes (JCMs / our flex) "jcm:<id>" that 🧍 Pose
    // drives live. SPARSE accessors (only the vertices a shape moves) - 150 JCMs stay a few MB.
    const TG = pi === 0 ? morphs.map((mo) => ({ name: mo.label, deltas: mo.deltas })).concat(o.extra || []) : [];
    let cornersOf = null;
    if (TG.length) { cornersOf = new Map(); for (let c = 0; c < n; c++) { const L = cornersOf.get(m.src[c]); if (L) L.push(c); else cornersOf.set(m.src[c], [c]); } }
    const targets = TG.map((t) => {
      const per = new Map(); for (const x of t.deltas) { const L = cornersOf.get(x[0]); if (L) for (const c of L) per.set(c, x); }
      const idx = [...per.keys()].sort((a, b) => a - b), vals = new Float32Array(Math.max(1, idx.length) * 3);
      idx.forEach((c, k) => { const x = per.get(c); vals[k * 3] = x[1] * CM; vals[k * 3 + 1] = x[2] * CM; vals[k * 3 + 2] = x[3] * CM; });
      const ii = new Uint32Array(idx.length ? idx : [0]), mmv = mm3(vals);
      J.accessors.push(Object.assign({ componentType: 5126, count: n, type: "VEC3", sparse: { count: ii.length, indices: { bufferView: view(Buffer.from(ii.buffer)), componentType: 5125 }, values: { bufferView: view(Buffer.from(vals.buffer)) } } },
        { min: mmv.min.map((v) => Math.min(0, v)), max: mmv.max.map((v) => Math.max(0, v)) }));
      return { POSITION: J.accessors.length - 1 };
    });
    const prims = [...m.byMat.entries()].map(([gi, tris]) => { const idx = n > 65535 ? new Uint32Array(tris) : new Uint16Array(tris); const pr = { attributes: attrs, indices: acc(idx, "SCALAR", n > 65535 ? 5125 : 5123, { target: 34963 }), material: matFor(p, gi, m) }; if (targets.length) pr.targets = targets; return pr; });
    const mesh = { name: p.name, primitives: prims };
    if (targets.length) { mesh.weights = TG.map(() => 0); mesh.extras = { targetNames: TG.map((x) => x.name), dialled: morphs.map((x) => x.w) }; }
    if (pi === 0 && o.daz) mesh.extras = Object.assign(mesh.extras || {}, { daz: o.daz });
    J.meshes.push(mesh);
    J.nodes.push({ name: p.name + " (" + p.kind + ")", mesh: J.meshes.length - 1, skin: 0 });
    J.scenes[0].nodes.push(J.nodes.length - 1);
  });
  rootsB.forEach((i) => J.scenes[0].nodes.push(bi0 + i));
  ["textures", "images", "materials"].forEach((k) => { if (!J[k].length) delete J[k]; });
  const bin = Buffer.concat(bins); J.buffers[0].byteLength = bin.length;
  return G.glb(J, bin);
}

module.exports = { NOT_DAZ, CM, detectRoots, roots, setRoots, readDson, resolve, fileOfUrl, kindOf, scan, abs, sceneNodes, figureData, morphOf, morphsFor, meshOf, skinTop4, textureOf, hairStiffness, build, writeGlb };
