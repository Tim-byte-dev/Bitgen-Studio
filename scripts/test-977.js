#!/usr/bin/env node
// bitGen Studio 2.977.0 - 📚 THE DAZ LIBRARY read by bitGen itself + our own cloth / hair drape + a face from a photo.
// Tim: "daz ships many assets when u dl it. can we use the assets ... without starting daz?" -> "just for bitgen to point to the
// daz library, and can we build our own dforce... but also make sure to say this is not a replacement for daz studio this is
// made for light tasks and DAZ studio is a very powerful character creator" -> "build steps 1-4" -> "also use our dforce for
// hair and other physics". A made-up library in a temp folder (OUR OWN tiny figure - no Daz content): DSON plain + gzipped,
// an encrypted file, a figure with bones / skin / UVs / a dial / a material picture, eyes + a shirt + hair conformed.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const pt = (x, y, z) => [{ id: "x", value: x }, { id: "y", value: y }, { id: "z", value: z }];

/** a grid mesh (quads) in the XY plane at z, w x h cells, size sx x sy cm, from (x0, y0) */
function grid(nx, ny, x0, y0, sx, sy, z) {
  const v = [], p = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v.push([x0 + sx * i / nx, y0 + sy * j / ny, z]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; p.push([0, 0, a, a + 1, a + nx + 2, a + nx + 1]); }
  return { v, p };
}
function makeLib(dir) {
  const w = (rel, obj, gz) => { const f = path.join(dir, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); const t = Buffer.from(JSON.stringify(obj)); fs.writeFileSync(f, gz ? zlib.gzipSync(t) : t); return f; };
  // the body: a 20 x 20 grid standing at z 10 cm, 40 cm wide, 170 cm tall (a "wall" person - enough for the maths)
  const g = grid(10, 34, -20, 0, 40, 170, 10);
  const uvs = g.v.map((q) => [(q[0] + 20) / 40, q[1] / 170]);
  w("data/Test Co/Mini/Base/Mini.dsf", {
    file_version: "0.6.0.0", asset_info: { id: "/data/Test%20Co/Mini/Base/Mini.dsf", type: "figure" },
    geometry_library: [{ id: "Mini-geo", type: "polygon_mesh", vertices: { count: g.v.length, values: g.v }, polygon_groups: { values: ["body"] },
      polygon_material_groups: { values: ["Face", "Body"] }, polylist: { count: g.p.length, values: g.p.map((q, i) => (q[1] = (i >= g.p.length - 40 ? 0 : 1), q)) }, default_uv_set: "/data/Test%20Co/Mini/UV/Base.dsf#base" }],
    node_library: [{ id: "Mini", name: "Mini", type: "figure", center_point: pt(0, 0, 0) }, { id: "hip", name: "hip", type: "bone", parent: "#Mini", center_point: pt(0, 100, 0) },
      { id: "head", name: "head", type: "bone", parent: "#hip", center_point: pt(0, 150, 0) }, { id: "l_eye", name: "l_eye", type: "bone", parent: "#head", center_point: pt(3.2, 160, 11) },
      { id: "r_eye", name: "r_eye", type: "bone", parent: "#head", center_point: pt(-3.2, 160, 11) }],
    modifier_library: [{ id: "SkinBinding", parent: "#Mini", skin: { node: "#Mini", geometry: "#Mini-geo", vertex_count: g.v.length,
      joints: [{ id: "hip", node: "#hip", node_weights: { count: g.v.length, values: g.v.map((q, i) => [i, q[1] < 140 ? 1 : 0.2]) } }, { id: "head", node: "#head", node_weights: { values: g.v.map((q, i) => [i, q[1] < 140 ? 0 : 0.8]).filter((x) => x[1]) } }] } }],
  });
  w("data/Test Co/Mini/UV/Base.dsf", { uv_set_library: [{ id: "base", uvs: { count: uvs.length, values: uvs }, polygon_vertex_indices: [[0, 0, uvs.length - 1]] }] }, true);
  w("data/Test Co/Mini/Base/Morphs/Test Co/Tall.dsf", { modifier_library: [{ id: "Tall", name: "Tall", parent: "/data/Test%20Co/Mini/Base/Mini.dsf#Mini", group: "/Body/Size",
    channel: { id: "value", type: "float", label: "Tall", min: 0, max: 1, value: 0 }, morph: { vertex_count: g.v.length, deltas: { count: g.v.length, values: g.v.map((q, i) => [i, 0, q[1] * 0.1, 0]) } } }] });
  w("data/Test Co/Mini/Base/Morphs/Test Co/Hidden.dsf", { modifier_library: [{ id: "Hid", channel: { label: "Hidden", visible: false }, morph: { deltas: { values: [] } } }] });
  // a picture (the face / body material)
  const tex = path.join(dir, "Runtime", "Textures", "Test Co", "skin.png"); fs.mkdirSync(path.dirname(tex), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xb08060:s=256x256", "-frames:v", "1", tex]);
  const mats = ["Face", "Body"].map((gname) => ({ id: gname, url: "#" + gname, geometry: "#Mini-geo", groups: [gname], diffuse: { channel: { id: "diffuse", image_file: "/Runtime/Textures/Test%20Co/skin.png" } } }));
  // eyes (conformed, their own bones l_eye / r_eye shared), a shirt (conformed), hair
  const eg = grid(2, 1, -4, 158, 8, 4, 10.5);
  w("data/Test Co/Mini/Eyes/MiniEyes.dsf", { geometry_library: [{ id: "eyes-geo", vertices: { values: eg.v }, polygon_material_groups: { values: ["EyeMoisture"] }, polylist: { values: eg.p } }],
    node_library: [{ id: "MiniEyes", type: "figure" }, { id: "l_eye", type: "bone", center_point: pt(3.2, 160, 11) }], modifier_library: [{ id: "skin", skin: { joints: [{ node: "#l_eye", node_weights: { values: eg.v.map((_, i) => [i, 1]) } }] } }] });
  w("People/Mini/Mini.duf", { asset_info: { type: "figure" }, scene: {
    nodes: [{ id: "Mini", url: "/data/Test%20Co/Mini/Base/Mini.dsf#Mini", geometries: [{ url: "/data/Test%20Co/Mini/Base/Mini.dsf#Mini-geo" }] },
      { id: "MiniEyes", url: "/data/Test%20Co/Mini/Eyes/MiniEyes.dsf#MiniEyes", parent: "#Mini", conform_target: "#Mini", label: "Mini Eyes" }],
    materials: mats } });
  fs.writeFileSync(path.join(dir, "People", "Mini", "Mini.duf.png"), fs.readFileSync(tex));
  const sg = grid(6, 6, -22, 90, 44, 40, 11);
  w("data/Test Co/Shirt/Shirt.dsf", { geometry_library: [{ id: "shirt-geo", vertices: { values: sg.v }, polygon_material_groups: { values: ["Cloth"] }, polylist: { values: sg.p } }],
    node_library: [{ id: "Shirt", type: "figure" }, { id: "hip", type: "bone", center_point: pt(0, 100, 0) }], modifier_library: [{ id: "skin", skin: { joints: [{ node: "#hip", node_weights: { values: sg.v.map((_, i) => [i, 1]) } }] } }] });
  w("People/Mini/Clothing/Shirt.duf", { asset_info: { type: "wearable" }, scene: { nodes: [{ id: "Shirt", url: "/data/Test%20Co/Shirt/Shirt.dsf#Shirt", conform_target: "#Mini" }] } }, true);
  const hg = grid(4, 6, -8, 150, 16, 24, 10.6);
  w("data/Test Co/Hair/Hair.dsf", { geometry_library: [{ id: "hair-geo", vertices: { values: hg.v }, polygon_material_groups: { values: ["Hair"] }, polylist: { values: hg.p } }],
    node_library: [{ id: "Hair", type: "figure" }], modifier_library: [{ id: "skin", skin: { joints: [{ node: "#head", node_weights: { values: hg.v.map((_, i) => [i, 1]) } }] } }] });
  w("People/Mini/Hair/Hair.duf", { asset_info: { type: "wearable" }, scene: { nodes: [{ id: "Hair", url: "/data/Test%20Co/Hair/Hair.dsf#Hair", conform_target: "#Mini" }] } });
  fs.writeFileSync(path.join(dir, "People", "Mini", "Secret.duf.enc"), "x");
  return { dir, tex };
}

(async () => {
  const core = require(path.join(ROOT, "lib/core")), D = require(path.join(ROOT, "lib/dazLib")), CS = require(path.join(ROOT, "lib/clothSim")), FC = require(path.join(ROOT, "lib/dazFace")), G = require(path.join(ROOT, "lib/glbMerge"));
  /* the cloth (pure) */
  check("clothSim: edges / bend pairs of two triangles", JSON.stringify(CS.edgesOf([0, 1, 2, 2, 1, 3])) === JSON.stringify([0, 1, 1, 2, 0, 2, 1, 3, 2, 3]) && JSON.stringify(CS.bendPairs([0, 1, 2, 2, 1, 3])) === JSON.stringify([0, 3]));
  const cl = grid(8, 8, -10, 0, 20, 20, 0), cpos = new Float32Array(cl.v.flat().map((x) => x * 0.01)), ctris = cl.p.flatMap((q) => [q[2], q[3], q[4], q[2], q[4], q[5]]);
  const free = CS.drape({ pos: cpos, tris: ctris }, null, { frames: 20, memory: 0 });
  const top = cl.v.map((q, i) => (q[1] === 20 ? i : -1)).filter((i) => i >= 0), stiff = new Float32Array(cl.v.length); top.forEach((i) => { stiff[i] = 1; });
  const hung = CS.drape({ pos: cpos, tris: ctris }, null, { frames: 30, stiffness: stiff, memory: 0 });
  const len0 = Math.hypot(cpos[3] - cpos[0], cpos[4] - cpos[1]), len1 = Math.hypot(hung.pos[3] - hung.pos[0], hung.pos[4] - hung.pos[1]);
  check("clothSim: free cloth falls; pinned along the top it hangs (the top stays, the bottom swings / keeps its length)", free.pos[1] < cpos[1] - 0.05 && top.every((i) => Math.abs(hung.pos[i * 3 + 1] - cpos[i * 3 + 1]) < 1e-6) && Math.abs(len1 - len0) / len0 < 0.15, { fell: free.pos[1] - cpos[1], len0, len1 });
  const bodyG = grid(8, 8, -10, 0, 20, 20, 0), bpos = new Float32Array(bodyG.v.flat().map((x) => x * 0.01)), btris = bodyG.p.flatMap((q) => [q[2], q[3], q[4], q[2], q[4], q[5]]);
  const inside = new Float32Array(cpos); for (let i = 2; i < inside.length; i += 3) inside[i] = -0.002;   // 2 mm behind a body facing +z
  const pushed = CS.drape({ pos: inside, tris: ctris }, { pos: bpos, tris: btris }, { frames: 1, substeps: 1, iters: 1, thickness: 0.004, gravity: 0 });
  check("clothSim: cloth inside a body is pushed out to the thickness (the fit to a shape that grew)", pushed.pos[2] > 0.0035, pushed.pos[2]);

  /* the library */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daz977_")), lib = makeLib(path.join(tmp, "My Library"));
  const realCfg = core.getConfig, cfg = { daz_library: { roots: [lib.dir] } }, realSet = core.setConfig, realM3d = require(path.join(ROOT, "lib/m3d")).dir;
  core.getConfig = () => cfg; core.setConfig = (c) => Object.assign(cfg, c);
  try {
    check("roots(): the folder set in the settings; setRoots keeps only real folders", JSON.stringify(D.roots()) === JSON.stringify([lib.dir]) && JSON.stringify(D.setRoots([lib.dir, path.join(tmp, "nope")])) === JSON.stringify([lib.dir]));
    const sc = D.scan({});
    const by = Object.fromEntries(sc.items.map((x) => [x.name, x.kind]));
    check("scan(): People/ .duf assets by kind (figure, clothing, hair) with thumbnails; the encrypted one counted, skipped; the note says not a replacement",
      by.Mini === "figure" && by.Shirt === "clothing" && by.Hair === "hair" && sc.items.find((x) => x.name === "Mini").thumb === "People/Mini/Mini.duf.png" && sc.encrypted === 1 && /not a replacement for Daz Studio/.test(sc.note), sc);
    check("readDson(): gzipped or plain; .enc -> encrypted", D.readDson(path.join(lib.dir, "People/Mini/Clothing/Shirt.duf")).asset_info.type === "wearable"
      && (() => { try { D.readDson(path.join(lib.dir, "People/Mini/Secret.duf.enc")); return false; } catch (e) { return e.encrypted === true; } })());
    const r = D.resolve("/data/Test%20Co/Mini/Base/Mini.dsf#l_eye");
    check("resolve(): a DSON url (escaped spaces) -> the object in its library", r && r.kind === "node_library" && r.obj.id === "l_eye");
    check("abs(): only inside a library folder", (() => { try { D.abs(lib.dir, "../../etc/passwd"); return false; } catch (e) { return e.status === 403; } })());
    const sn = D.sceneNodes(path.join(lib.dir, "People/Mini/Mini.duf"));
    const dials = D.morphsFor(sn.fig.url);
    check("morphsFor(): the figure's shape dials (Morphs/ beside its data file), hidden ones left out", dials.length === 1 && dials[0].label === "Tall" && /#Tall$/.test(dials[0].url), dials);

    /* the build: the figure + a dial + the shirt + hair, draped, eyes conformed */
    const out = await D.build({ root: lib.dir, rel: "People/Mini/Mini.duf", dials: [{ url: dials[0].url, value: 0.5 }], wear: [{ rel: "People/Mini/Clothing/Shirt.duf" }, { rel: "People/Mini/Hair/Hair.duf" }], drape: { frames: 10 }, maxTex: 128 });
    const J = G.parse(out.glb).json;
    const meshNames = J.meshes.map((m) => m.name);
    check("build(): one .glb - the body, its eyes, the shirt, the hair (each skinned to ONE skeleton)", meshNames.length === 4 && J.skins.length === 1 && J.nodes.filter((n) => n.mesh != null).every((n) => n.skin === 0), meshNames);
    const bodyAcc = J.accessors[J.meshes[0].primitives[0].attributes.POSITION];
    check("build(): Daz cm -> metres; the dial at 0.5 makes the body 5% taller (170 cm -> 1.785 m)", Math.abs(bodyAcc.max[1] - 1.785) < 1e-4, bodyAcc.max);
    check("build(): the dial is a morph target too (named), the skeleton's bones are nodes (hip, head, l_eye, r_eye)", J.meshes[0].extras.targetNames[0] === "Tall" && J.meshes[0].primitives[0].targets.length >= 1
      && ["hip", "head", "l_eye", "r_eye"].every((b) => J.nodes.some((n) => n.name === b)));
    check("build(): the material picture embedded (Face / Body groups -> two materials with a texture); the eyes' moisture see-through", J.images.length >= 1 && J.materials.some((m) => m.name === "Face" && m.pbrMetallicRoughness.baseColorTexture) && J.materials.find((m) => m.name === "EyeMoisture").alphaMode === "BLEND");
    const shirt = out.info.pieces.find((p) => p.kind === "clothing"), hair = out.info.pieces.find((p) => p.kind === "hair");
    check("build(): our cloth drape moved the shirt (gravity + the grown body) and the hair (held at the roots)", shirt.draped_mm > 1 && hair.draped_mm >= 0 && out.info.note === D.NOT_DAZ, out.info.pieces);
    const st = D.hairStiffness(new Float32Array([0, 1, 0.105, 0, 1, 0.2]), new Float32Array([0, 1, 0.1]), new CS.Hash(new Float32Array([0, 1, 0.1]), 0.03));
    check("hairStiffness(): held at the roots (5 mm from the scalp = 1), free at the ends (10 cm = 0)", st[0] === 1 && st[1] === 0, [...st]);

    /* 4 the face from a photo (pure parts + a run) */
    check("parseLandmarks(): the Vision model's JSON (0..1 rescaled); without the eyes / chin -> null",
      JSON.stringify(FC.parseLandmarks('```json {"left_eye":[0.6,0.4],"right_eye":[400,400],"mouth":[500,600],"chin":[500,800]}```')) === JSON.stringify({ left_eye: [600, 400], right_eye: [400, 400], mouth: [500, 600], chin: [500, 800] }) && FC.parseLandmarks("{}") === null);
    const sim = FC.similarity([0, 0], [1, 0], [10, 10], [10, 12]), q = sim([1, 1]);
    check("similarity(): two points onto two points (scale 2, turned 90°)", Math.abs(q[0] - 8) < 1e-9 && Math.abs(q[1] - 12) < 1e-9, q);
    check("blendWeight(): facing the camera in the middle = 1, side-on or outside = 0", FC.blendWeight(1, 0.2) === 1 && FC.blendWeight(0.1, 0.2) === 0 && FC.blendWeight(1, 1.1) === 0);
    const photo = path.join(tmp, "me.png");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3050f0:s=400x400", "-frames:v", "1", photo]);
    const f2 = await D.build({ root: lib.dir, rel: "People/Mini/Mini.duf", face: { photo, landmarks: { left_eye: [580, 400], right_eye: [420, 400], mouth: [500, 560], chin: [500, 700] } }, maxTex: 256 });
    check("build() + face: the face material gets the photo blended in (a new picture), the chin scaled", f2.info.face && f2.info.face.materials.length === 1 && /^Face/.test(f2.info.face.materials[0]) && f2.info.face.chin_scale >= 0.8 && f2.info.face.chin_scale <= 1.25 && !f2.info.warnings.length, f2.info);
    const J2 = G.parse(f2.glb), fm = J2.json.materials.find((m) => m.name === "Face"), img = J2.json.images[J2.json.textures[fm.pbrMetallicRoughness.baseColorTexture.index].source];
    const bv = J2.json.bufferViews[img.bufferView], png = J2.bin.slice(bv.byteOffset, bv.byteOffset + bv.byteLength), pf = path.join(tmp, "face.png"); fs.writeFileSync(pf, png);
    const px = FC.readRgba(pf), blue = [...Array(px.w * px.h).keys()].filter((i) => px.d[i * 4 + 2] > px.d[i * 4] + 20).length;
    check("the face texture: the photo's colour blended into the skin (matched toward the skin colour, never a hard paste)", img.mimeType === "image/png" && blue > 50 && blue < px.w * px.h * 0.9, { blue, of: px.w * px.h });
  } finally { core.getConfig = realCfg; core.setConfig = realSet; fs.rmSync(tmp, { recursive: true, force: true }); void realM3d; }

  /* wiring + the words */
  check("routes: mounted from routes/index.js (never server.js); scan / thumb / dials / build / roots", /require\("\.\/dazLibrary"\)\.mount\(app\)/.test(src("routes/index.js")) && !/dazLibrary/.test(src("misc/server.js"))
    && ["/api/dazlib/scan", "/api/dazlib/thumb", "/api/dazlib/dials", "/api/dazlib/build", "/api/dazlib/roots"].every((x) => src("routes/dazLibrary.js").includes(x)));
  const ui = src("ext/pushpulldock/ppdazlib.js");
  check("the Sketcher: 📚 Daz library (ppdazlib.js) - the not-a-replacement words shown, folders, kinds, dials, wear, drape (clothes / hair / other), face, Open in the Sketcher",
    /Daz Studio is a very powerful character creator/.test(ui) && /not a replacement for Daz Studio/i.test(ui) && /dials/.test(ui) && /drape/.test(ui) && /face/.test(ui) && /importModel/.test(ui) && JSON.parse(src("ext/pushpulldock/ext.json")).scripts.includes("ppdazlib.js") && /id="ppDazLib"/.test(src("ext/pushpulldock/dock.html")));
  check("the docs: USAGE + FEATURES + NOTICE say it is not a replacement for Daz Studio", /not a replacement for Daz Studio/.test(src("docs/USAGE.md")) && /not a replacement for Daz Studio/.test(src("docs/FEATURES.md")) && /not a replacement for Daz Studio/.test(src("misc/NOTICE.md")) && /2\.977\.0/.test(src("misc/CHANGELOG.md")));
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
