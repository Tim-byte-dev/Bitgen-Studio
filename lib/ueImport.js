// bitGen Studio — lib/ueImport.js (2.579.0): SEND A MODEL TO UNREAL - the 📐 SolidCraft docker's "Send to Unreal".
// Tim: "add send to blender,send to unreal, send to homebuilder and send to image-editor buttons in soldicraft docker".
// SolidCraft's OBJ is millimetres with Z up; Unreal's OBJ import reads an OBJ as Y up (the format's own convention) in
// centimetres. So the model is rewritten Y up in cm - (x, y, z) mm -> (x, z, -y) / 10 (a rotation: the faces keep their
// winding) - into projects/<p>/unreal/import/<name>.obj, and the bridge plugin (1.4.0: import_mesh) imports it as a
// Static Mesh in /Game/bitGen/SolidCraft and places it in the open level (sent again: replaced where it stood).
//   zUpMmToYupCm(text)        the OBJ rewritten (pure): v and vn lines turned, v scaled; everything else as it was
//   send(model, deps)         model = a file in models3d -> {ok, assets, actor, file} | throws (the bridge's words)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

function fmt(n) { const r = Math.round(n * 1e6) / 1e6; return Object.is(r, -0) ? "0" : String(r); }
function zUpMmToYupCm(text) {
  return String(text || "").split(/\r?\n/).map((l) => {
    const m = /^(vn?)\s+(\S+)\s+(\S+)\s+(\S+)(.*)$/.exec(l);
    if (!m) return l;
    const x = +m[2], y = +m[3], z = +m[4];
    if (![x, y, z].every(Number.isFinite)) return l;
    const k = m[1] === "v" ? 0.1 : 1;
    return `${m[1]} ${fmt(x * k)} ${fmt(z * k)} ${fmt(-y * k)}${m[5]}`;
  }).join("\n");
}
async function send(model, deps) {
  const d = deps || {};
  const src = (d.modelPath || require("./m3d").modelPath)(String(model || ""));
  if (!src) { const e = new Error(`no model "${model}" in the project's 3D models`); e.status = 400; throw e; }
  const name = path.basename(src).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60) || "bitGen_mesh";
  const dir = d.dir || path.join(core.pDir("unreal"), "import");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, name + ".obj");
  fs.writeFileSync(out, zUpMmToYupCm(fs.readFileSync(src, "utf8")));
  const call = d.call || require("./unreal").call;
  const r = await call("import_mesh", { file: out, name, folder: "SolidCraft", place: true }, 180000);
  return { ok: true, assets: r.assets || [], actor: r.actor || "", file: out };
}

module.exports = { zUpMmToYupCm, send };
