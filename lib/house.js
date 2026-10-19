// bitGen Studio — lib/house.js (2.524.0): 🏠 THE HOUSE BUILDER's houses (static/housebuilder.js; the geometry is
// static/housegeo.js - one module for the 3D view, the location renders and the .obj).
// Tim (verbatim): "i would like a floorplan/housebuilder floating docker that i can use as a location as well" - he chose:
// 360° into Locations, camera shots + depth maps, ✨ Make it real, the .obj for Blender / Unreal; rooms / walls / doors /
// windows, furniture, floors + stairs, materials + light; metres.
//
//   A HOUSE     projects/<p>/houses/<slug>/house.json (the model - H3HouseGeo.normalize) + plan.png (the list's picture)
//               + renders/ (every shot / depth / normal / 360 made from it)
//   SHOTS       a camera's picture, its depth map (white = near) and its normal map go to renders/ AND into the project's
//               Images assets (house-<slug>-<camera>-shot|depth|normal.png) - the reference dock, ControlNet, ✨ Make it real
//   360°        the docker renders the panorama and makes the LOCATION itself through /api/environments (lib/environments.js
//               - the same location everything else uses: its view, its @tag, the global prompt's location block)
//   .obj        H3HouseGeo.build -> toObj: house.obj + house.mtl + README (metres, Y up) in one .zip (lib/zipWrite)
//   ✨ STYLES   the image styles that take a picture (an edit workflow, or a FLUX.2 Klein style with its edit sibling -
//               lib/imageRefs) - Make it real sends the shot to /api/genimage as its reference
// Pure (scripts/test-house524.js): slugOf, renderName.
"use strict";
const fs = require("fs");
const path = require("path");
const G = require("../static/housegeo.js");

function core() { return require("./core"); }
function slugOf(n) { return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50); }
/** house-<slug>-<camera>-<kind>.png (pure) */
function renderName(slug, cam, kind) { return `house-${slugOf(slug) || "house"}-${slugOf(cam) || "view"}-${String(kind).replace(/[^a-z0-9]/g, "")}.png`; }
function root() { return path.join(core().projDir(core().getProject()), "houses"); }
function dirOf(name) {
  const s = slugOf(name);
  if (!s) { const e = new Error("a house needs a name"); e.status = 400; throw e; }
  return path.join(root(), s);
}
function ev(name, what) { try { require("./testPlan").event(name, { what }); } catch { /* the 🧪 checklist */ } }
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } }
function list() {
  let names = []; try { names = fs.readdirSync(root()).filter((d) => fs.existsSync(path.join(root(), d, "house.json"))).sort(); } catch { names = []; }
  return names.map((s) => {
    const m = readJson(path.join(root(), s, "house.json"), {}), st = fs.statSync(path.join(root(), s, "house.json"));
    let renders = 0; try { renders = fs.readdirSync(path.join(root(), s, "renders")).length; } catch { renders = 0; }
    return { slug: s, name: m.name || s, floors: (m.floors || []).length, rooms: (m.rooms || []).length, items: (m.items || []).length, cameras: (m.cameras || []).length,
      area: Math.round((m.rooms || []).reduce((a, r) => a + Math.abs(G.area(r.poly || [])), 0)), updated: st.mtimeMs, plan: fs.existsSync(path.join(root(), s, "plan.png")), renders };
  });
}
function get(name) {
  const f = path.join(dirOf(name), "house.json");
  if (!fs.existsSync(f)) { const e = new Error("no such house"); e.status = 404; throw e; }
  return G.normalize(readJson(f, {}));
}
/** 💾 the model, cleaned; a new name = a new house (the old one stays) */
function save(model) {
  const m = G.normalize(model);
  const d = dirOf(m.name);
  fs.mkdirSync(path.join(d, "renders"), { recursive: true });
  fs.writeFileSync(path.join(d, "house.json"), JSON.stringify(m, null, 1));
  ev("house_saved", m.name);
  // 2.532.0: what the save shows was used (the 🧪 checklist ticks itself)
  if (m.roof && m.roof.kind && m.roof.kind !== "none") ev("house_roof", m.name + ": " + m.roof.kind);
  if ((m.people || []).length) ev("house_people", m.name + ": " + m.people.length + " people");
  return { slug: slugOf(m.name), model: m };
}
/** 🗑 a house; withAssets: its shots / depth / normal maps leave the Images assets too (by default they stay) */
function remove(name, withAssets) {
  const d = dirOf(name); if (!fs.existsSync(d)) return false;
  if (withAssets) {
    // its shots / maps (the names in renders/) + 2.528.0 its character pictures (house-<slug>-char-<tag>.<ext> - exactly,
    // so "Beach House 2"'s are not "Beach House"'s)
    const img = core().pDir("images");
    let shots = [], files = [];
    try { shots = fs.readdirSync(path.join(d, "renders")); } catch { shots = []; }
    try { files = fs.readdirSync(img); } catch { files = []; }
    const rx = new RegExp("^house-" + slugOf(name).replace(/[-]/g, "\\-") + "-(char|ref)-[a-z0-9._-]+\\.(png|jpe?g|webp)$", "i");   // 2.539.0: + its reference pictures
    files.filter((f) => (shots.includes(f) && /^house-.*\.png$/.test(f)) || rx.test(f)).forEach((f) => { try { fs.unlinkSync(path.join(img, f)); } catch { /* gone */ } });
  }
  fs.rmSync(d, { recursive: true, force: true }); return true;
}
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** a render from the docker: kind plan | shot | depth | normal | pano -> renders/ (+ the Images assets for the shots) */
function saveRender(name, kind, cam, png) {
  if (!Buffer.isBuffer(png) || png.length < 9 || !png.slice(0, 8).equals(PNG_SIG)) { const e = new Error("not a PNG"); e.status = 400; throw e; }
  const k = ["plan", "shot", "depth", "normal", "pano"].includes(kind) ? kind : null;
  if (!k) { const e = new Error("kind: plan | shot | depth | normal | pano"); e.status = 400; throw e; }
  const d = dirOf(name);
  if (!fs.existsSync(path.join(d, "house.json"))) { const e = new Error("save the house first"); e.status = 404; throw e; }
  if (k === "plan") { fs.writeFileSync(path.join(d, "plan.png"), png); return { file: "plan.png" }; }
  const file = renderName(name, cam, k);
  fs.mkdirSync(path.join(d, "renders"), { recursive: true });
  fs.writeFileSync(path.join(d, "renders", file), png);
  let asset = "";
  if (k !== "pano") {                                     // the Images assets (the reference dock, ✨ Make it real)
    const img = core().pDir("images");
    fs.mkdirSync(img, { recursive: true });
    fs.writeFileSync(path.join(img, file), png);
    asset = file;
  }
  if (k === "shot" || k === "pano") ev("house_" + k, file);
  return { file, asset };
}
function renderPath(name, file) {
  const f = path.join(dirOf(name), "renders", path.basename(String(file || "")));
  return fs.existsSync(f) ? f : null;
}
/** ⤓ the house as .obj + .mtl (one .zip) */
function exportObj(name) {
  const m = get(name), b = G.build(m, { ceilings: true }), o = G.toObj(b.meshes, m.name);
  const readme = `${m.name} - from bitGen Studio's house builder.\nhouse.obj + house.mtl: metres, Y up (Blender: import .obj with "Y up"; Unreal: import at scale 100).\n`
    + `${m.floors.length} floor(s), ${m.rooms.length} room(s), ${m.items.length} piece(s) of furniture. Materials are colours (Kd); glass is d 0.25.\n`;
  ev("house_obj", m.name);
  return { name: `${slugOf(m.name)}-obj.zip`, data: require("./zipWrite").zip([{ name: "house.obj", data: o.obj }, { name: "house.mtl", data: o.mtl }, { name: "README.txt", data: readme }]) };
}
/** 2.528.0: 🧍 a character's picture for ✨ Make it real - their reference picture (lib/characters.referenceImage: the
 *  composite when they have several) copied into the Image assets as house-<house>-char-<tag>.<ext> (genimage takes
 *  pictures from there only; 🗑 the house with ?assets=1 takes them too) -> {name, character} */
function charRef(id, house) {
  const C = require("./characters");
  const c = C.list().find((x) => x.id === String(id || ""));
  if (!c) { const e = new Error("no such character"); e.status = 404; throw e; }
  const file = C.referenceImage(c);
  const src = file ? path.join(C.charDir(c.name), path.basename(file)) : "";
  if (!src || !fs.existsSync(src)) { const e = new Error(`${c.name} has no picture yet - add one in the Video docker's cast`); e.status = 404; throw e; }
  const name = `house-${slugOf(house) || "house"}-char-${C.tagOf(c.name)}${path.extname(src).toLowerCase() || ".png"}`;
  const img = core().pDir("images");
  fs.mkdirSync(img, { recursive: true });
  fs.copyFileSync(src, path.join(img, name));
  return { name, character: c.name };
}
/** 2.529.0: ⤓ the house as one .glb (binary glTF - Blender, Unreal, Godot, three.js) */
function exportGlb(name) {
  const m = get(name), b = G.build(m, { ceilings: true });
  ev("house_glb", m.name);
  return { name: `${slugOf(m.name)}.glb`, data: require("./houseGltf").toGlb(b.meshes, m.name, G.MATERIALS) };
}
/** 2.529.0: 🖼 the floor-plan picture to trace over (one per house: trace.png / .jpg / .webp) -> {file} */
const SIGS = [[".png", [0x89, 0x50, 0x4e, 0x47]], [".jpg", [0xff, 0xd8, 0xff]], [".webp", [0x52, 0x49, 0x46, 0x46]]];
function saveTrace(name, buf) {
  const d = dirOf(name);
  if (!fs.existsSync(path.join(d, "house.json"))) { const e = new Error("save the house first"); e.status = 404; throw e; }
  const hit = Buffer.isBuffer(buf) ? SIGS.find(([, sig]) => sig.every((v, i) => buf[i] === v)) : null;
  if (!hit) { const e = new Error("a PNG, JPEG or WebP picture"); e.status = 400; throw e; }
  for (const [ext] of SIGS) { try { fs.unlinkSync(path.join(d, "trace" + ext)); } catch { /* none */ } }
  fs.writeFileSync(path.join(d, "trace" + hit[0]), buf);
  ev("house_trace", name);
  return { file: "trace" + hit[0] };
}
function tracePath(name) { const d = dirOf(name); for (const [ext] of SIGS) { const f = path.join(d, "trace" + ext); if (fs.existsSync(f)) return f; } return null; }
/* 2.539.0 (Tim: "can we use our reference docker images , like walls, furniture, lights etc in homebuilder"): a picture
   from the References docker kept with the house - refs/<name>.<ext> beside house.json (a wall's / a floor's texture,
   the look of a piece of furniture / a light). The same bytes under the same name are reused; another picture with the
   name gets -2, -3 ... */
/** a safe file name for a reference picture: the stem's letters / digits / . _ - (pure) */
function refFileName(orig, ext) {
  const stem = String(orig || "").replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "ref";
  return stem + ext;
}
function saveRef(name, buf, orig) {
  const d = dirOf(name);
  if (!fs.existsSync(path.join(d, "house.json"))) { const e = new Error("save the house first"); e.status = 404; throw e; }
  const hit = Buffer.isBuffer(buf) ? SIGS.find(([, sig]) => sig.every((v, i) => buf[i] === v)) : null;
  if (!hit) { const e = new Error("a PNG, JPEG or WebP picture"); e.status = 400; throw e; }
  const rd = path.join(d, "refs");
  fs.mkdirSync(rd, { recursive: true });
  const want = refFileName(orig, hit[0]), ext = hit[0], stem = want.slice(0, want.length - ext.length);
  let out = want;
  for (let n = 2; fs.existsSync(path.join(rd, out)); n++) {
    try { if (Buffer.compare(fs.readFileSync(path.join(rd, out)), buf) === 0) return { file: out, reused: true }; } catch { /* next */ }
    out = `${stem}-${n}${ext}`;
  }
  fs.writeFileSync(path.join(rd, out), buf);
  ev("house_ref", out);
  return { file: out };
}
function refPath(name, file) {
  const f = path.basename(String(file || ""));
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(f)) return null;
  const p = path.join(dirOf(name), "refs", f);
  return fs.existsSync(p) ? p : null;
}
/** ✨ Make it real takes pictures from the Image assets only: a house reference copied there as
 *  house-<house>-ref-<file> (🗑 the house with ?assets=1 takes them too) -> {name} */
function refAsset(house, file) {
  const src = refPath(house, file);
  if (!src) { const e = new Error("that reference picture is not with the house any more"); e.status = 404; throw e; }
  const name = `house-${slugOf(house) || "house"}-ref-${path.basename(src)}`;
  const img = core().pDir("images");
  fs.mkdirSync(img, { recursive: true });
  fs.copyFileSync(src, path.join(img, name));
  return { name };
}
/** ✨ the image styles that take a picture (edit workflows; FLUX.2 Klein styles via their edit sibling) */
function editStyles() {
  const C = core(), S = require("./styles");
  let all = []; try { all = S.read(C.STYLES_DIR, "image"); } catch { all = []; }
  return all.filter((s) => s && s.kind !== "music" && !s.chain).map((s) => {
    let slots = 0, swapped = false;
    try { slots = S.imageSlots(s, C.BASE); } catch { slots = 0; }
    if (!slots) { try { const r = require("./imageRefs").resolve(s, 1, C.BASE); swapped = !!(r && r.swapped); } catch { swapped = false; } }
    return { id: s.id, name: s.name, slots, swapped };
  }).filter((s) => (s.slots > 0 || s.swapped) && !/inpaint|outpaint|\bfill\b|upscal|remove.?b/i.test(s.name));   // a mask / upscale style is no use here
}

module.exports = { slugOf, renderName, root, dirOf, list, get, save, remove, saveRender, renderPath, exportObj, editStyles, charRef, exportGlb, saveTrace, tracePath,
  refFileName, saveRef, refPath, refAsset };
