// bitGen Studio — lib/camGuide.js (2.399.0): THE CAMERA PATH'S GUIDE VIDEOS on disk.
//
// Tim: "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in timeline
// docker. will we be able to tell mmh3 , wan and ltx to follow these paths" - he chose the exact-path guide too.
//
// The timeline's 🎥 Camera panel (ext/timelinedock/camera.js) renders the picture (made 3D with its depth map) along
// the camera path with three.js, twice: the picture as the camera sees it (RGB) and its DEPTH (near = white). This
// keeps them:
//   saveFrame(id, kind, i, buf)   one PNG frame -> projects/<p>/workspace/camguide_<id>/<rgb|depth>/f_00000.png
//                                 (frame 0 of the RGB pass starts the guide afresh)
//   encode(id, {fps, frames})     both passes -> video/camguide_<id>_rgb.mp4 + camguide_<id>_depth.mp4 (H.264, with a
//                                 silent sound track: LTX's style-transfer mode reads the video's sound) -> {rgb, depth}
//   resolve(name)                 a guide video's path in this project's video/, or null (only camguide_* names)
// What each model does with them: lib/camPlan.js.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const core = require("./core");

const MAX_FRAMES = 24 * 60;                    // a minute at 24 fps - a camera move, not a film
const KINDS = ["rgb", "depth"];
const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
const NAME_RE = /^camguide_[A-Za-z0-9_-]{1,40}_(rgb|depth)\.mp4$/;
const isPng = (b) => Buffer.isBuffer(b) && b.length > 8 && b.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function frameDir(id, kind) {
  const i = ID(id);
  if (!i) throw bad("a guide id is required");
  if (kind != null && !KINDS.includes(kind)) throw bad("kind must be rgb or depth");
  const d = path.join(core.projDir(core.getProject()), "workspace", "camguide_" + i);
  return kind ? path.join(d, kind) : d;
}
function saveFrame(id, kind, i, buf) {
  const n = Math.floor(Number(i));
  if (!Number.isFinite(n) || n < 0 || n >= MAX_FRAMES) throw bad("frame number out of range");
  if (!isPng(buf)) throw bad("send the frame as image/png");
  if (kind === "rgb" && n === 0) fs.rmSync(frameDir(id), { recursive: true, force: true });   // a fresh guide
  const d = frameDir(id, kind);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "f_" + String(n).padStart(5, "0") + ".png"), buf);
  return { frame: n, kind };
}
/** the ffmpeg arguments for one pass (pure - tested) */
function encodeArgs(framesGlob, fps, frames, out) {
  return ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", framesGlob,
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-frames:v", String(frames), "-map", "0:v:0", "-map", "1:a:0", "-shortest",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
    "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out];
}
function run(args) {
  return new Promise((ok, no) => execFile("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 }, (err, _o, se) =>
    (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok())));
}
async function encode(id, o) {
  const fps = Math.max(1, Math.min(60, Math.round(Number((o || {}).fps) || 24)));
  const out = {};
  core.ensureProject(core.getProject());
  const vdir = core.pDir("video");
  fs.mkdirSync(vdir, { recursive: true });
  let frames = 0;
  for (const kind of KINDS) {
    const d = frameDir(id, kind);
    const have = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^f_\d{5}\.png$/.test(f)).length : 0;
    const want = Math.floor(Number((o || {}).frames) || have);
    if (!have) throw bad(`no ${kind} frames were sent for this guide`, 404);
    if (have < want) throw bad(`only ${have} of ${want} ${kind} frames arrived`, 409);
    frames = want;
    const name = `camguide_${ID(id)}_${kind}.mp4`, dest = path.join(vdir, name), tmp = path.join(vdir, `.camguide_${ID(id)}_${kind}.tmp.mp4`);
    await run(encodeArgs(path.join(d, "f_%05d.png"), fps, want, tmp));
    fs.renameSync(tmp, dest);
    out[kind] = name;
  }
  fs.rmSync(frameDir(id), { recursive: true, force: true });
  return { rgb: out.rgb, depth: out.depth, frames, fps, dur: frames / fps };
}
/** a guide video in this project's video/ (only camguide_* names), or null */
function resolve(name) {
  const b = path.basename(String(name || ""));
  if (!NAME_RE.test(b)) return null;
  const p = path.join(core.pDir("video"), b);
  return fs.existsSync(p) ? p : null;
}

module.exports = { MAX_FRAMES, KINDS, NAME_RE, frameDir, saveFrame, encodeArgs, encode, resolve };
