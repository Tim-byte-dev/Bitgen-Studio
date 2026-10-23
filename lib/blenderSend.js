// bitGen Studio — lib/blenderSend.js (2.579.0): SEND A MODEL TO BLENDER - Blender opens (its window, your own startup
// and add-ons) with the model in a new scene, saved as a .blend in the project.
// Tim: "add send to blender ... buttons in soldicraft docker ... only show the blender and unreal buttons if they are
// installed too". The 📐 SolidCraft docker exports its model as OBJ (millimetres, Z up) into the project's 3D models
// (projects/<p>/models3d - the Blender add-on's "⬇ Get from bitGen" lists them too) and asks for this:
//   blender --python scripts/blend_open_model.py -- <model.obj> <projects/<p>/blender/solidcraft/<stem>.blend>
// the script empties the start scene, imports the OBJ in metres with Z up, names it, frames it and saves the .blend.
//   args(objAbs, outAbs)      the command line after the Blender exe (pure)
//   outFor(stem)              projects/<p>/blender/solidcraft/<stem>.blend
//   send(model, deps)         model = a file name in models3d -> {ok, blend, exe} | {error}  (deps.spawn / find for tests)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const SCRIPT = path.join(__dirname, "..", "scripts", "blend_open_model.py");
const args = (objAbs, outAbs) => ["--python", SCRIPT, "--", objAbs, outAbs];
const stemOf = (n) => String(n || "model").split(/[\\/]/).pop().replace(/\.[^.]+$/, "").replace(/[^\w .()+-]+/g, "_").trim().slice(0, 80) || "model";
function outFor(stem) { const d = path.join(core.pDir("blender"), "solidcraft"); fs.mkdirSync(d, { recursive: true }); return path.join(d, stemOf(stem) + ".blend"); }

function send(model, deps) {
  const d = deps || {};
  const obj = (d.modelPath || require("./m3d").modelPath)(String(model || ""));
  if (!obj) return { error: `no model "${model}" in the project's 3D models` };
  if (!/\.obj$/i.test(obj)) return { error: "send an .obj (SolidCraft's export)" };
  const exe = (d.find || require("./blender").find)();
  if (!exe) return { error: "Blender was not found - set its path in Settings ▸ 3D (or the timeline's 🟠 Blender ⚙)" };
  const out = outFor(model);
  const spawn = d.spawn || require("child_process").spawn;
  try {
    const c = spawn(exe, args(obj, out), { detached: true, stdio: "ignore", windowsHide: false, cwd: path.dirname(out) });
    if (c && c.on) c.on("error", () => {});
    if (c && c.unref) c.unref();
  } catch (e) { return { error: "Blender would not start: " + e.message }; }
  return { ok: true, blend: out, exe };
}

module.exports = { SCRIPT, args, outFor, stemOf, send };
