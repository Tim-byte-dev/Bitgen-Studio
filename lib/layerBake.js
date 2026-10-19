// bitGen Studio — lib/layerBake.js (2.490.0): a timeline layer the compile cannot place by itself, BAKED by the page -
// every frame drawn by the canvas (ext/timelinedock/tlparent.js: a layer that follows a parent), sent here as PNGs and
// made into video/tlb_<id>.webm (VP9 with transparency, the frame's size). The compile overlays that file as it is
// (lib/tlKeys.js imageKeys -> baked, worker.py). Used by routes/layerBake.js.
//   saveFrame(id, i, png)      frame i (0 starts a bake afresh)
//   encode(id, {fps, frames})  {name, dur, frames}
//   fileOf(name)               the full path of video/tlb_<id>.webm when it is one of ours and on disk, else null
"use strict";
const fs = require("fs"), path = require("path");
const { execFile } = require("child_process");
const core = require("./core");

const MAX_FRAMES = 24 * 60 * 20;
const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const isPng = (b) => Buffer.isBuffer(b) && b.length > 8 && b.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
const NAME = /^tlb_[A-Za-z0-9_-]{1,40}\.webm$/;

function frameDir(id) {
  const i = ID(id); if (!i) throw bad("a layer id is required");
  return path.join(core.projDir(core.getProject()), "workspace", "tlb_" + i);
}
function saveFrame(id, i, buf) {
  const n = Math.floor(Number(i));
  if (!Number.isFinite(n) || n < 0 || n >= MAX_FRAMES) throw bad("frame number out of range");
  if (!isPng(buf)) throw bad("send the frame as image/png");
  const d = frameDir(id);
  if (n === 0) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "f_" + String(n).padStart(5, "0") + ".png"), buf);
  return { frame: n };
}
function run(args) {
  return new Promise((ok, no) => execFile("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 }, (err, _o, se) =>
    (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok())));
}
async function encode(id, o) {
  const d = frameDir(id), fps = Math.max(1, Math.min(60, Math.round(Number((o || {}).fps) || 24)));
  const have = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^f_\d{5}\.png$/.test(f)).length : 0;
  const frames = Math.floor(Number((o || {}).frames) || have);
  if (!have) throw bad("no frames were sent for this layer", 404);
  if (have < frames) throw bad(`only ${have} of ${frames} frames arrived`, 409);
  core.ensureProject(core.getProject());
  const vdir = core.pDir("video"); fs.mkdirSync(vdir, { recursive: true });
  const name = `tlb_${ID(id)}.webm`, out = path.join(vdir, name), tmp = path.join(vdir, `.tlb_${ID(id)}.tmp.webm`);
  // 2.505.0: lossless = a DATA video (tldist.js's displacement maps: every grey level is a pixel of movement) - VP9
  // lossless in planar RGB (YUV would round a grey by one level = a pixel of movement), no alpha
  const codec = (o || {}).lossless === true
    ? ["-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "gbrp", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4"]
    : ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "20", "-row-mt", "1",
      "-deadline", "good", "-cpu-used", "4"];
  await run(["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(d, "f_%05d.png"), "-frames:v", String(frames),
    ...codec, "-f", "webm", tmp]);
  fs.renameSync(tmp, out);
  fs.rmSync(d, { recursive: true, force: true });
  return { name, dur: frames / fps, frames };
}
function fileOf(name) {
  const n = path.basename(String(name || ""));
  if (!NAME.test(n)) return null;
  const f = path.join(core.pDir("video"), n);
  return fs.existsSync(f) ? f : null;
}
module.exports = { saveFrame, encode, fileOf, frameDir, ID, NAME, MAX_FRAMES };
