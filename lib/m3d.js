// bitGen Studio — lib/m3d.js (2.382.0): the timeline canvas's 3D LAYERS on disk.
//
// Tim: "can we add 3d model(fbx, obj) to timeline canvas and 3d text?"
//
// The page draws a 3D layer live with three.js (static/m3d.js, ext/timelinedock/m3d.js) and, for the compile, bakes it
// into a see-through video. This keeps the files:
//   saveModel(name, buf)        a model file (.fbx / .obj) or what it needs beside it (.mtl, textures) ->
//                               projects/<p>/models3d/<name> (the name made safe, the bytes as sent)
//   listModels()                the project's models3d/ (.fbx / .obj only)
//   modelPath(name)             a file in models3d/ (null when missing) - served to the page for the loaders
//   fontFile(family, bold, italic)  the font's TTF / OTF on this machine (Windows / Linux / macOS font folders), for
//                               3D text in the same fonts as the canvas's 2D text; a common sans when the family is
//                               not installed; null when no font file exists at all
//   saveFrame(id, i, buf)       one baked frame (PNG with alpha) -> projects/<p>/workspace/m3d_<id>/f_00000.png
//   encode(id, {fps, frames})   the frames -> video/m3d_<id>.webm, VP9 yuva420p (alpha_mode=1: the canvas and the
//                               compile read it see-through, like the ✨ Fill videos) -> {name, dur, frames}; the
//                               frames are removed after
"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const core = require("./core");

// 2.385.0: + glTF (.glb, or .gltf with its .bin) - what the Blender add-on sends
const MODEL_EXT = [".fbx", ".obj", ".glb", ".gltf"];
const SIDE_EXT = [".mtl", ".bin", ".png", ".jpg", ".jpeg", ".tga", ".bmp", ".webp", ".dds", ".tif", ".tiff"];
const TEX_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const MAX_FRAMES = 24 * 60 * 5;                 // five minutes at 24 fps
const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
const isPng = (b) => Buffer.isBuffer(b) && b.length > 8 && b.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function dir() {
  core.ensureProject(core.getProject());
  const d = path.join(core.projDir(core.getProject()), "models3d");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function safeName(name) {
  const b = path.basename(String(name || "")).replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return b;
}
function saveModel(name, buf) {
  const n = safeName(name);
  const ext = path.extname(n).toLowerCase();
  if (!n || ![...MODEL_EXT, ...SIDE_EXT].includes(ext)) throw bad("a 3D model is .fbx, .obj, .glb or .gltf (with its .mtl / .bin and textures beside it)");
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the file is empty");
  fs.writeFileSync(path.join(dir(), n), buf);
  return { name: n, bytes: buf.length, model: MODEL_EXT.includes(ext) };
}
function listModels() {
  return fs.readdirSync(dir()).filter((f) => MODEL_EXT.includes(path.extname(f).toLowerCase())).sort()
    .map((f) => ({ name: f, size: fs.statSync(path.join(dir(), f)).size }));
}
/* 2.385.0: the pictures in models3d/ (a material's texture) */
function listTextures() {
  return fs.readdirSync(dir()).filter((f) => TEX_EXT.includes(path.extname(f).toLowerCase())).sort()
    .map((f) => ({ name: f, size: fs.statSync(path.join(dir(), f)).size }));
}
function modelPath(name) {
  const n = safeName(name);
  if (!n) return null;
  const p = path.join(dir(), n);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}

/* ---- fonts (the same family names as the canvas's 2D text) */
const FONT_DIRS = [path.join(process.env.WINDIR || "C:\\Windows", "Fonts"),
  path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Windows", "Fonts"),
  "/usr/share/fonts", "/usr/local/share/fonts", path.join(require("os").homedir(), ".fonts"),
  "/Library/Fonts", "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"];
// Windows' file stems that do not start with the family's name
const STEMS = { arialblack: ["ariblk"], timesnewroman: ["times", "liberationserif", "dejavuserif"], trebuchetms: ["trebuc"],
                couriernew: ["cour", "liberationmono", "dejavusansmono"],
                comicsansms: ["comic"], arial: ["arial", "liberationsans"], verdana: ["verdana", "dejavusans"],
                georgia: ["georgia", "dejavuserif"], impact: ["impact"] };
const FALLBACK = ["arial", "liberationsans", "dejavusans", "notosans", "freesans", "helvetica"];
let fontIndex = null;
function walk(d, out, depth) {
  if (depth > 5) return;
  let ents = [];
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (/\.(ttf|otf)$/i.test(e.name)) out.push(p);
  }
}
function fonts() {
  if (fontIndex) return fontIndex;
  const out = [];
  for (const d of FONT_DIRS) if (d && fs.existsSync(d)) walk(d, out, 0);
  fontIndex = out;
  return out;
}
const key = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function fontFile(family, bold, italic) {
  const files = fonts();
  const want = key(family);
  const pick = (stems) => {
    let best = null;
    for (const f of files) {
      const stem = key(path.basename(f).replace(/\.[^.]+$/, ""));
      for (const s of stems) {
        if (!stem.startsWith(s)) continue;
        const rest = stem.slice(s.length);
        const isB = /^(bd|bold|b|bi|boldi|bolditalic|z)$/.test(rest) || /bold/.test(rest);
        const isI = /^(i|it|italic|bi|z|oblique)$/.test(rest) || /italic|oblique/.test(rest);
        if (rest && !isB && !isI && !/^(regular|r|book|roman|normal)$/.test(rest)) continue;   // another family (arialnarrow)
        const score = (isB === !!bold ? 2 : 0) + (isI === !!italic ? 1 : 0) + (rest === "" ? 0.5 : 0);
        if (!best || score > best[0]) best = [score, f];
      }
    }
    return best && best[1];
  };
  return (want && pick(STEMS[want] || [want])) || pick(FALLBACK) || files[0] || null;
}

/* ---- the bake: frames in, a see-through webm out */
function frameDir(id) {
  const i = ID(id);
  if (!i) throw bad("a 3D layer id is required");
  return path.join(core.projDir(core.getProject()), "workspace", "m3d_" + i);
}
function saveFrame(id, i, buf) {
  const n = Math.floor(Number(i));
  if (!Number.isFinite(n) || n < 0 || n >= MAX_FRAMES) throw bad("frame number out of range");
  if (!isPng(buf)) throw bad("send the frame as image/png");
  const d = frameDir(id);
  if (n === 0) fs.rmSync(d, { recursive: true, force: true });       // frame 0 starts a fresh bake
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "f_" + String(n).padStart(5, "0") + ".png"), buf);
  return { frame: n };
}
function run(args) {
  return new Promise((ok, no) => execFile("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 }, (err, _o, se) =>
    (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok())));
}
async function encode(id, o) {
  const d = frameDir(id);
  const fps = Math.max(1, Math.min(60, Math.round(Number((o || {}).fps) || 24)));
  const have = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^f_\d{5}\.png$/.test(f)).length : 0;
  const frames = Math.floor(Number((o || {}).frames) || have);
  if (!have) throw bad("no frames were sent for this 3D layer", 404);
  if (have < frames) throw bad(`only ${have} of ${frames} frames arrived`, 409);
  core.ensureProject(core.getProject());
  const vdir = core.pDir("video");
  fs.mkdirSync(vdir, { recursive: true });
  const name = `m3d_${ID(id)}.webm`, out = path.join(vdir, name), tmp = path.join(vdir, `.m3d_${ID(id)}.tmp.webm`);
  await run(["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(d, "f_%05d.png"),
    "-frames:v", String(frames), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
    "-b:v", "0", "-crf", "24", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-f", "webm", tmp]);
  fs.renameSync(tmp, out);
  fs.rmSync(d, { recursive: true, force: true });
  return { name, dur: frames / fps, frames };
}

module.exports = { MODEL_EXT, SIDE_EXT, TEX_EXT, saveModel, listModels, listTextures, modelPath, fontFile, saveFrame, encode, safeName,
                   frameDir, dir };
