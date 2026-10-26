// bitGen Studio — lib/to3d.js (2.594.0): 🧊 CONVERT TO 3D from any picture - the queue job of /api/mesh3d (Hunyuan3D 2.1 /
// TRELLIS.2 in ComfyUI, lib/mesh3d.js) for a project picture OR a picture the page sends (a reference-dock picture, the
// image editor's canvas / layer).
//
// Tim (verbatim): "right click on an image in gallery, assets, reference or image-editor and convert to 3d using context
// menu , the 3d model can go into image-editor or solidcraft docker" (Hi3D skipped: "Skip Hi3D for now").
//
//   queue(picture, {engine, seed, model_name}) -> {job dict..., model: "<name>.glb"} | throws {status}
//   savePicture(buf, name)   a PNG / JPEG / WebP the page sent -> <project>/images/<stem>.png|jpg|webp (a new name when
//                            taken - nothing is overwritten) -> the path; anything else is refused (400)
//   kindOf(buf)              "png" | "jpg" | "webp" | "" (pure)
//   stemOf(name)             a safe file stem (pure)
// Routes: routes/to3d.js (POST /api/to3d/picture) and routes/sceneAI.js (POST /api/mesh3d) both queue through here.
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function kindOf(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return "";
  if (b.slice(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  return "";
}
function stemOf(name) {
  const s = path.basename(String(name || "")).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return s || "picture";
}
function savePicture(buf, name) {
  const k = kindOf(buf);
  if (!k) throw bad("send a PNG, JPEG or WebP picture");
  if (buf.length > 60 * 1024 * 1024) throw bad("that picture is over 60 MB", 413);
  const d = core.pDir("images");
  fs.mkdirSync(d, { recursive: true });
  const stem = stemOf(name);
  let f = path.join(d, `${stem}.${k}`), n = 2;
  while (fs.existsSync(f)) f = path.join(d, `${stem}-${n++}.${k}`);
  fs.writeFileSync(f, buf);
  return f;
}
function queue(pic, o) {
  const x = o || {};
  if (!pic || !fs.existsSync(pic)) throw bad("that picture is not in this project", 404);
  const mesh3d = require("./mesh3d");
  const jp = mesh3d.jobParams({ picture: pic, name: x.model_name || path.basename(pic).replace(/\.[^.]+$/, ""),
    engine: x.engine, seed: x.seed, models_dir: require("./m3d").dir() });
  if (jp.error) throw bad(jp.error);
  const job = core.makeJob(jp.params);
  job.chunk = { i: 0, n: 1 };
  return { ...core.jobDict(job), model: jp.params.name + ".glb" };
}
module.exports = { kindOf, stemOf, savePicture, queue };
