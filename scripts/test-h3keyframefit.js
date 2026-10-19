#!/usr/bin/env node
/* bitGen Studio — 2.379.1: an H3 fl2va first / last frame is fitted to the video's 32-px size.
 * Run: node scripts/test-h3keyframefit.js
 * Tim's fl2va scene (its own First picture) failed in ComfyUI's sampler:
 *   "shape '[1, 24, 1, 1, 22, 2, 40, 2]' is invalid for input of size 86400"
 * = MiniMaxH3ImageToVideo made the 1280x720 video as a 1280x704 latent (44 rows: 32-px steps) but encoded the 1280x720
 * picture as 45 rows. Ref (no keyframe) and Cont (a take's last frame = already the video's size) worked.
 *   1. worker._fit_keyframe: 1280x720 at 1280x720 -> a 1280x704 copy in the job folder (cover + centre crop), said;
 *      a picture already at the video's size is sent as it is; another aspect is cropped, never stretched;
 *   2. comfy_generate fits the first / last frame (not ref2va references) before the upload;
 *   3. 2.379.2: every H3 render is asked for a 32-px-step size (1280x720 -> 1280x704): the 16-px strip at the bottom
 *      of 720-high takes was the rows H3 cannot draw. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3fit-"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));
// a 1280x720 picture: red left half, blue right half; a 1280x704 one; a square one
ff(["-f", "lavfi", "-i", "color=c=red:s=640x720", "-f", "lavfi", "-i", "color=c=blue:s=640x720", "-filter_complex", "hstack", "-frames:v", "1", path.join(tmp, "first.png")]);
ff(["-f", "lavfi", "-i", "color=c=green:s=1280x704", "-frames:v", "1", path.join(tmp, "take_last.png")]);
ff(["-f", "lavfi", "-i", "color=c=white:s=900x900", "-frames:v", "1", path.join(tmp, "square.png")]);
const out = execFileSync("python3", ["-c", [
  "import sys, json, os; sys.argv=['x']; sys.path.insert(0, " + JSON.stringify(ROOT) + "); import worker",
  "os.chdir(" + JSON.stringify(tmp) + ")",
  "r = [worker._fit_keyframe('first.png', 1280, 720), worker._fit_keyframe('take_last.png', 1280, 720), worker._fit_keyframe('square.png', 960, 544)]",
  "print(json.dumps([[a, b, worker._image_wh(a)] for a, b in r]))"].join("\n")], { encoding: "utf8" }).trim().split("\n").pop();
const R = JSON.parse(out);
check("1280x720 First picture for a 1280x720 render -> a 1280x704 copy (H3's 32-px video), and said", R[0][0].endsWith(path.join("keyframe_1280x704", "first.png"))
  && JSON.stringify(R[0][2]) === "[1280,704]" && /first\.png 1280x720 -> 1280x704/.test(R[0][1]) && fs.existsSync(path.join(tmp, "first.png")), R[0]);
const px = execFileSync("ffmpeg", ["-loglevel", "error", "-i", path.join(tmp, "keyframe_1280x704", "first.png"), "-vf", "crop=1:1:10:352", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
check("...scaled to cover + centre-cropped (the left edge is still the red half, nothing stretched)", px[0] > 200 && px[2] < 60, [...px]);
check("a take's last frame already at the video's size is sent as it is (Cont)", R[1][0] === "take_last.png" && R[1][1] === null, R[1]);
check("another aspect (a square picture for 960x544) is cropped to 960x544", JSON.stringify(R[2][2]) === "[960,544]", R[2]);
const W = fs.readFileSync(path.join(ROOT, "worker.py"), "utf8");
check("comfy_generate fits the first / last frame (not ref2va references) before the upload",
  /if seg_mode != "ref2va" and _frame_slot_loaders\(g\):\s*keyset = \{str\(x\) for x in \(first_frame, last_frame\) if x\}/.test(W)
  && /x, fnote = _fit_keyframe\(x, params\["width"\], params\["height"\]\)/.test(W)
  && W.indexOf("x, fnote = _fit_keyframe(") < W.indexOf("say(f\"[comfy] uploading {Path(x).name}\")\n            uploads.append(_up(x))"));
// 2.379.2: the render size itself (Tim: "it is rendering at 1280x720 ... 16px vignette at the bottom of the video")
const sz = JSON.parse(execFileSync("python3", ["-c", [
  "import sys, json; sys.argv=['x']; sys.path.insert(0, " + JSON.stringify(ROOT) + "); import worker",
  "h3 = {'40': {'class_type': 'MiniMaxH3ImageToVideo', 'inputs': {}}}",
  "other = {'1': {'class_type': 'WanImageToVideo', 'inputs': {}}}",
  "print(json.dumps([worker._h3_size(h3, 1280, 720), worker._h3_size(h3, 960, 544), worker._h3_size(h3, 720, 1280), worker._h3_size(other, 1280, 720)]))"].join("\n")],
  { encoding: "utf8" }).trim().split("\n").pop());
check("an H3 graph renders 1280x720 as 1280x704 (32-px steps) - no 16-px strip at the bottom - and says so",
  sz[0][0] === 1280 && sz[0][1] === 704 && /1280x720 -> 1280x704/.test(sz[0][2]) && /16-px strip at the bottom/.test(sz[0][2]), sz[0]);
check("...a size already in 32-px steps (960x544) is left alone; portrait 720x1280 -> 704x1280; a non-H3 graph is untouched",
  sz[1][2] === null && sz[1][1] === 544 && sz[2][0] === 704 && sz[2][1] === 1280 && sz[3][1] === 720 && sz[3][2] === null, sz);
check("comfy_generate snaps the render size BEFORE fitting keyframes and patching the graph (not for ⏫ of an existing take)",
  /_w32, _h32, _sznote = _h3_size\(g, _rw, _rh, _fit\)\s*if params\.get\("upscale_take"\):\s*_sznote = None[^\n]*\s*if _sznote:\s*say\(f"\[comfy\] \{_sznote\}"\)\s*params\["width"\], params\["height"\] = _w32, _h32[\s\S]{0,1400}?srcs, snotes = _frame_sources/.test(W));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
