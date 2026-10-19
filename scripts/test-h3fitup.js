#!/usr/bin/env node
/* bitGen Studio — 2.380.0: the video docker's ⚙ "H3 size": 704 (round down) or 736 (render up, crop back to 720).
 * Run: node scripts/test-h3fitup.js
 * Tim: "add the 736 as an option in videodocker settings".
 *   1. lib/renderSettings: h3_fit "down" | "up" (default down), the ⚙ preview line says what renders;
 *   2. lib/core: every job.json carries the project's h3_fit; worker.py takes it into params;
 *   3. worker._h3_size "up": 1280x720 -> 1280x736 (and says the take is cropped back); 1280x704 untouched;
 *   4. worker._fit_keyframe(pad_to): a picture fits the size ASKED for, its edge is smeared out to the render size
 *      (a 736-high take's last frame is sent as it is - a Cont chain never zooms);
 *   5. worker._crop_take: an h264 take and its FFV1 lossless master are cropped back to 1280x720 (top-left), the
 *      sound kept;
 *   6. the wiring: comfy_generate keeps the asked size, crops by the upscaler's factor too; the main loop crops each
 *      chunk; the ⚙ dropdown. */
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
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RS = require(path.join(ROOT, "lib", "renderSettings"));

// 1
check("renderSettings: h3_fit down (default) | up; anything else -> down", RS.normalize({}).h3_fit === "down" && RS.normalize({ h3_fit: "up" }).h3_fit === "up"
  && RS.normalize({ h3_fit: "sideways" }).h3_fit === "down");
const up = RS.jobOverrides({ res: "720", aspect: "16:9", h3_fit: "up" }, { width: 1, height: 1 });
const dn = RS.jobOverrides({ res: "720", aspect: "16:9" }, { width: 1, height: 1 });
check("...the ⚙ preview says what renders: 736 + crop, or 704", up.h3_fit === "up" && up.notes.some((n) => /renders 1280x736, the take cropped to 1280x720/.test(n))
  && dn.notes.some((n) => /H3 size: 1280x704/.test(n)), [up.notes, dn.notes]);

// 2
const CORE = read("lib", "core.js"), W = read("worker.py");
check("core: job.json carries the project's h3_fit (renderSettings); the worker reads it into params",
  /h3_fit: job\.params\.h3_fit \|\| \(\(\) => \{\s*try \{ return require\("\.\/renderSettings"\)\.read\(projDir\(job\.project \|\| currentProject\)\)\.h3_fit;/.test(CORE)
  && /if job\.get\("h3_fit"\) and not params\.get\("h3_fit"\):\s*# 2\.380\.0[^\n]*\n\s*params\["h3_fit"\] = job\["h3_fit"\]/.test(W));

// 3-5 (python)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3up-"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));
ff(["-f", "lavfi", "-i", "color=c=red:s=1280x720", "-frames:v", "1", path.join(tmp, "first.png")]);
ff(["-f", "lavfi", "-i", "color=c=green:s=1280x736", "-frames:v", "1", path.join(tmp, "handoff.png")]);
// a 1280x736 take: the bottom 16 rows blue (the rows the crop removes), the rest gray, with sound
ff(["-f", "lavfi", "-i", "color=c=gray:s=1280x736:r=24:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-filter_complex",
    "[0:v]drawbox=x=0:y=720:w=1280:h=16:color=blue:t=fill[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(tmp, "chunk_01.mp4")]);
ff(["-f", "lavfi", "-i", "color=c=gray:s=1280x736:r=24:d=1", "-c:v", "ffv1", "-level", "3", path.join(tmp, "chunk_01.raw.avi")]);
const out = execFileSync("python3", ["-c", [
  "import sys, json, os; sys.argv=['x']; sys.path.insert(0, " + JSON.stringify(ROOT) + "); import worker",
  "os.chdir(" + JSON.stringify(tmp) + ")",
  "h3 = {'40': {'class_type': 'MiniMaxH3ImageToVideo', 'inputs': {}}}",
  "a = worker._h3_size(h3, 1280, 720, 'up'); b = worker._h3_size(h3, 1280, 704, 'up')",
  "f1 = worker._fit_keyframe('first.png', 1280, 720, pad_to=(1280, 736)); f2 = worker._fit_keyframe('handoff.png', 1280, 720, pad_to=(1280, 736))",
  "c1 = worker._crop_take('chunk_01.mp4', 1280, 720); c2 = worker._crop_take('chunk_01.raw.avi', 1280, 720)",
  "print(json.dumps({'a': a, 'b': b, 'f1': [f1[0], f1[1], worker._image_wh(f1[0])], 'f2': f2,",
  "  'c1': c1, 'c2': c2, 'wh1': worker._image_wh('chunk_01.mp4'), 'wh2': worker._image_wh('chunk_01.raw.avi'),",
  "  'codec2': worker._stream_codec('chunk_01.raw.avi', 'v'), 'aud': worker.has_audio(worker.Path('chunk_01.mp4'))}))"].join("\n")],
  { encoding: "utf8" }).trim().split("\n").pop();
const R = JSON.parse(out);
check("_h3_size up: 1280x720 -> 1280x736, said (the take is cropped back); 1280x704 is already a step", R.a[0] === 1280 && R.a[1] === 736
  && /rounded UP/.test(R.a[2]) && /cropped back to 1280x720/.test(R.a[2]) && R.b[1] === 704 && R.b[2] === null, R);
check("_fit_keyframe pad_to: a 1280x720 First picture -> 1280x736 (fitted at 720, the edge extended), said", R.f1[0].endsWith(path.join("keyframe_1280x736", "first.png"))
  && JSON.stringify(R.f1[2]) === "[1280,736]" && /its edge extended to 1280x736/.test(R.f1[1]), R.f1);
const pf = execFileSync("ffmpeg", ["-loglevel", "error", "-i", path.join(tmp, "keyframe_1280x736", "first.png"), "-vf", "crop=1:1:600:730", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
check("...the extended rows repeat the picture's edge (red), never black", pf[0] > 200 && pf[1] < 60, [...pf]);
check("...a hand-off frame that is already 1280x736 goes as it is", R.f2[0] === "handoff.png" && R.f2[1] === null, R.f2);
const bottom = execFileSync("ffmpeg", ["-loglevel", "error", "-i", path.join(tmp, "chunk_01.mp4"), "-frames:v", "1", "-vf", "format=rgb24,crop=1:1:600:715", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
check("_crop_take: the take back to 1280x720 (the blue bottom rows gone), the sound kept; the FFV1 master too, still lossless",
  R.c1 && R.c2 && JSON.stringify(R.wh1) === "[1280,720]" && JSON.stringify(R.wh2) === "[1280,720]" && R.codec2 === "ffv1" && R.aud === true
  && bottom[2] < 160 && Math.abs(bottom[0] - bottom[2]) < 30, { R, bottom: [...bottom] });
fs.rmSync(tmp, { recursive: true, force: true });

// 6
check("comfy_generate: the size ASKED for stays (_req_w / _req_h), up -> _h3_crop; an upscaled take is cropped by the same factor",
  /_rw = int\(params\.setdefault\("_req_w", int\(params\["width"\]\)\)\)/.test(W) && /_fit = "up" if str\(params\.get\("h3_fit"\) or ""\) == "up" else "down"/.test(W)
  && /params\["_h3_crop"\] = \[_rw, _rh\]/.test(W) && /params\["_h3_crop"\] = \[ev\(_rw \* uw \/ _w32\), ev\(_rh \* uh \/ _h32\)\]/.test(W)
  && /x, fnote = _fit_keyframe\(x, params\["_req_w"\], params\["_req_h"\],\s*pad_to=\(params\["width"\], params\["height"\]\)\)/.test(W));
check("the main loop crops each chunk (and its lossless master) back before the hand-off frame is taken",
  /if params\.get\("_h3_crop"\):\s*# 2\.380\.0[^\n]*\n\s*cw, ch = params\["_h3_crop"\]\s*okc = _crop_take\(seg_out, cw, ch\) and \(not mst\.exists\(\) or _crop_take\(mst, cw, ch\)\)/.test(W)
  && W.indexOf("okc = _crop_take(seg_out") < W.indexOf('handoff = workdir / f"handoff_{i:02d}.png"'));
const VD = read("ext", "videodock", "dock.html"), VR = read("ext", "videodock", "rendersettings.js");
check("the video docker's ⚙: H3 size 704 / 736, saved with the other render settings",
  /id="vdSetH3Fit"/.test(VD) && /<option value="down">704/.test(VD) && /<option value="up">736/.test(VD)
  && /h3_fit: el\("vdSetH3Fit"\) \? el\("vdSetH3Fit"\)\.value : "down"/.test(VR) && /"vdSetPngUp", "vdSetH3Fit"\]\.forEach/.test(VR));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
