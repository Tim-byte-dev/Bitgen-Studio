// bitGen Studio — lib/tlFill.js (2.380.0): the timeline canvas's ✨ FILL results on disk.
//
// Tim: "add a selection box and masking tools - allow user to generate an image or video in that selection that
// blends with the rest of the scene".
// ext/timelinedock/fill.js does the selection, the mask and the inpaint (POST /api/aiedit, the image editor's
// engines); this keeps what it makes:
//   saveLayer(id, buf)          a PNG (the filled area with its feathered mask as alpha) -> images/layer_<id>.png
//   maskVideo(o)                a rendered clip (output/<name>) scaled to the selection's box and given the feathered
//                               mask (images/layer_<mask>.png, white = keep) as its ALPHA -> video/fillv_<id>.webm
//                               (VP9 yuva420p, alpha_mode=1: the canvas plays it see-through, the compile reads its
//                               alpha through libvpx - worker.py has_alpha). Resolves {name, dur}.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const core = require("./core");

const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
const isPng = (b) => Buffer.isBuffer(b) && b.length > 8 && b.slice(0, 8).toString("hex") === "89504e470d0a1a0a";

function saveLayer(id, buf) {
  const i = ID(id);
  if (!i) { const e = new Error("a layer id is required"); e.status = 400; throw e; }
  if (!isPng(buf)) { const e = new Error("send the layer as image/png"); e.status = 400; throw e; }
  core.ensureProject(core.getProject());
  const dir = core.pDir("images");
  fs.mkdirSync(dir, { recursive: true });
  const name = `layer_${i}.png`;
  fs.writeFileSync(path.join(dir, name), buf);
  return { name, bytes: buf.length };
}

function run(args) {
  return new Promise((ok, no) => execFile("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 }, (err, _o, se) =>
    (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok())));
}

async function maskVideo(o) {
  const out = path.basename(String((o || {}).output || ""));
  const mask = path.basename(String((o || {}).mask || ""));
  const w = Math.max(2, Math.round(+o.width || 0)) & ~1, h = Math.max(2, Math.round(+o.height || 0)) & ~1;
  if (!out || !mask || !(w > 2 && h > 2)) { const e = new Error("output, mask, width and height are required"); e.status = 400; throw e; }
  let src = path.join(core.pDir("output"), out);
  if (!fs.existsSync(src)) src = path.join(core.pDir("video"), out);
  const mp = path.join(core.pDir("images"), mask);
  if (!fs.existsSync(src)) { const e = new Error(`${out} is not in this project`); e.status = 404; throw e; }
  if (!fs.existsSync(mp)) { const e = new Error(`${mask} is not in this project's images`); e.status = 404; throw e; }
  const id = ID(o.id) || Date.now().toString(36);
  const name = `fillv_${id}.webm`;
  const dst = path.join(core.pDir("video"), name);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  // the still mask loops for exactly the clip's length (an endless -loop input would never let ffmpeg finish)
  const len = core.probeDuration(src) || 0;
  if (!(len > 0)) { const e = new Error(`${out} has no duration`); e.status = 400; throw e; }
  await run(["-y", "-loglevel", "error", "-i", src, "-loop", "1", "-t", len.toFixed(3), "-i", mp, "-filter_complex",
    // the mask flattened on black: a page mask (white strokes, their feather in ALPHA) and a plain black / white
    // picture both become "how much to keep" in grey
    `[0:v]scale=${w}:${h}:flags=lanczos,format=rgba[v];[1:v]scale=${w}:${h},format=rgba[mk];`
    + `color=c=black:s=${w}x${h}[bk];[bk][mk]overlay=shortest=1:format=auto,format=gray[m];[v][m]alphamerge,format=yuva420p[o]`,
    "-map", "[o]", "-t", len.toFixed(3), "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
    "-b:v", "0", "-crf", "24", "-deadline", "good", "-cpu-used", "4", "-metadata:s:v:0", "alpha_mode=1", dst]);
  return { name, dur: core.probeDuration(dst) || null };
}

module.exports = { saveLayer, maskVideo, isPng };
