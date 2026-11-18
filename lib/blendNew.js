// bitGen Studio — lib/blendNew.js (2.851.0): 🆕 a NEW Blender scene for the image editor's 🟧 Blender ▾ menu.
// Tim (verbatim): "make the blender button a dropdown with new scene, open, save, import and up to 5 recent files. open and
// new scene will start blender."
//   plan(o)            the empty scene's plan for scripts/blend_build.py (pure): 5 s at 24 fps, 1280 x 720, a ground, the sun,
//                      a camera looking at the middle from the front - no objects
//   fileName(name)     a safe file name (pure): "My room" -> "My_room.blend"; empty -> "scene"
//   create({name})     Blender builds it (blendView.run "build") into <project>/blender/scenes/<name>.blend - a name in use
//                      gets " (2)", " (3)" … -> {path, name}. The image editor then opens it in the scene tools.
"use strict";
const fs = require("fs");
const path = require("path");

function plan(o) {
  const x = o || {};
  return {
    title: String(x.name || "New scene").slice(0, 80), fps: 24, seconds: 5, width: 1280, height: 720,
    sky: "#a9c4dc", ground: { size: 40, color: "grass" }, sun: { strength: 3, elevation: 45, azimuth: 135 },
    objects: [], camera: { lens: 35, keys: [{ t: 0, at: [0, -10, 1.7], look: [0, 0, 1] }] },
  };
}
function fileName(name) {
  const s = String(name || "").replace(/\.blend\d*$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, " ").trim().replace(/\s+/g, "_").slice(0, 60);
  return (s || "scene") + ".blend";
}
function freePath(d, name) {
  let p = path.join(d, name);
  for (let i = 2; fs.existsSync(p) && i < 1000; i++) p = path.join(d, name.replace(/\.blend$/, ` (${i}).blend`));
  return p;
}
let BV = () => require("./blendView");
function setBlendView(f) { BV = () => f; }   // tests

async function create(o) {
  const x = o || {}, bv = BV(), d = path.join(bv.dir(), "scenes");
  fs.mkdirSync(d, { recursive: true });
  const out = freePath(d, fileName(x.name));
  const pf = out.replace(/\.blend$/, ".plan.json");
  fs.writeFileSync(pf, JSON.stringify(plan(x), null, 1));
  const r = await bv.run(["build", pf, out], null, x.exe);
  try { fs.unlinkSync(pf); } catch { /* gone */ }
  if (r.error || !fs.existsSync(out)) { const e = new Error("Blender could not make the scene: " + (r.error || "no file")); e.status = 500; throw e; }
  return { path: out, name: path.basename(out) };
}

module.exports = { plan, fileName, create, setBlendView };
