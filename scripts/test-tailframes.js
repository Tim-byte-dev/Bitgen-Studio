#!/usr/bin/env node
/* bitGen Studio — 2.313.0: A SCENE'S TAIL PNGs, the app side.
 * Run: node scripts/test-tailframes.js
 *
 * Tim (verbatim): "can we save the last 2 seconds of the video as 1080p
 * png, and use one of those frames to continue the video or first frame for
 * next video, i am still losing a lot of quality when getting to scene 8.
 * save the png's to song name\scene_<n>\song name_scene_<n>_x.png. add
 * option in video docker settings for png size, upscaler dropdown."
 *   1. lib/tailFrames: the folder + name rule, the PNG size, the job spec
 *      (off / lanczos / a model), adopt, the pick (last / inside the window
 *      / before it / another take's tail);
 *   2. the ⚙ record carries png_size + png_upscaler;
 *   3. the wiring: the job spec, the harvest adopt, the continuation pick,
 *      the panel's two fields.
 * The PNG writing itself runs LIVE in scripts/test-tailpngs.py; the whole
 * path (render -> PNGs -> the next scene from PNG 33) runs LIVE in the e2e. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const TF = require(path.join(ROOT, "lib", "tailFrames"));
const RS = require(path.join(ROOT, "lib", "renderSettings"));

const P = "e2e_tf313";
const root = core.projDir(P);
try {
  // ---- 1. the lib --------------------------------------------------------------------
  const st = { audio: "My Song: Live?.mp3", list: [] };
  check("the folder is <project>/<song name>/scene_<n>, the stem <song name>_scene_<n> (unsafe characters made safe)",
    TF.dirFor(P, st, 3) === path.join(root, "My Song_ Live_", "scene_3") && TF.stemFor(P, st, 3) === "My Song_ Live__scene_3",
    [TF.dirFor(P, st, 3), TF.stemFor(P, st, 3)]);
  check("...a board with no song uses the project's name", TF.stemFor(P, { list: [] }, 2) === P + "_scene_2");
  check("the PNG size: the short side at the render's aspect, even pixels (1080 of 960x544 = 1906x1080; 9:16 1080 = 1080x1920)",
    JSON.stringify(TF.dims("1080", 960, 544)) === '{"width":1906,"height":1080}'
    && JSON.stringify(TF.dims("1080", 720, 1280)) === '{"width":1080,"height":1920}', TF.dims("1080", 960, 544));
  const sp = TF.spec(P, st, 3, RS.normalize({}), 1280, 720);
  check("the job spec by default: 1080p, lanczos, the last 2 s at 24 fps",
    sp && sp.width === 1920 && sp.height === 1080 && sp.upscaler === "" && sp.seconds === 2 && sp.fps === 24
    && sp.dir === TF.dirFor(P, st, 3), sp);
  check("...with a model, and OFF gives no spec",
    TF.spec(P, st, 3, RS.normalize({ png_size: "1440", png_upscaler: "4x-ESRGAN.pth" }), 1280, 720).upscaler === "4x-ESRGAN.pth"
    && TF.spec(P, st, 3, RS.normalize({ png_size: "off" }), 1280, 720) === null);
  // a written tail
  const d = TF.dirFor(P, st, 1);
  fs.mkdirSync(d, { recursive: true });
  const files = Array.from({ length: 48 }, (_, i) => `${TF.stemFor(P, st, 1)}_${i + 1}.png`);
  for (const f of files) fs.writeFileSync(path.join(d, f), "png");
  fs.writeFileSync(path.join(d, "tail.json"), JSON.stringify({ take: "20260926-1_ab.mp4", files, first_index: 76,
    count: 48, fps: 24, time_from: 76 / 24, width: 1920, height: 1080, upscaler: "lanczos", source: "x.avi" }));
  check("adopt: the tail follows its take to the scene name; another take's name changes nothing",
    TF.adopt(P, st, 1, "other.mp4", "scene1.mp4") === false
    && TF.adopt(P, st, 1, "20260926-1_ab.mp4", "scene1.mp4") === true && TF.readMeta(d).take === "scene1.mp4");
  const row = { n: 1, output: "scene1.mp4" };
  const last = TF.pick(P, st, row, null);
  check("pick: no time -> the LAST PNG (x 48)", last && last.x === 48 && last.name === files[47]
    && last.file === path.join(d, files[47]) && last.width === 1920, last);
  const at = TF.pick(P, st, row, 4.5);
  check("pick: 4.5 s (inside the window from 3.167 s) -> PNG 33", at && at.x === 33 && at.name === files[32], at);
  check("pick: a time before the window -> null (the caller reads the video, as before)", TF.pick(P, st, row, 0.5) === null);
  check("pick: a row whose take is NOT the tail's (a newer render) -> null",
    TF.pick(P, st, { n: 1, output: "scene_1_2.mp4" }, null) === null && TF.pick(P, st, { n: 1 }, null) === null);
  fs.unlinkSync(path.join(d, files[47]));
  check("...a PNG gone from disk is skipped (the last one that exists)", TF.pick(P, st, row, null).x === 47);

  // ---- 2. the ⚙ record ---------------------------------------------------------------------------
  const n = RS.normalize({ png_size: "2160", png_upscaler: "4x.pth" });
  check("the ⚙ record: png_size (off/720/1080/1440/2160, default 1080) + png_upscaler (a file, \"\" = lanczos)",
    n.png_size === "2160" && n.png_upscaler === "4x.pth" && RS.normalize({}).png_size === "1080"
    && RS.normalize({ png_size: "999", png_upscaler: "../x" }).png_size === "1080"
    && RS.normalize({ png_upscaler: "../x" }).png_upscaler === "", n);
} finally { fs.rmSync(root, { recursive: true, force: true }); }

// ---- 3. the wiring --------------------------------------------------------------------------------
{
  const RC = read("routes", "characters.js"), DH = read("ext", "videodock", "dock.html"), RJ = read("ext", "videodock", "rendersettings.js");
  check("both board job builders pass tail_pngs (never on an upscale job)",
    RC.includes("const tailSpec = upscale ? null : tailFrames.spec(project, st, r.n,")
    && RC.includes("...(tailSpec ? { tail_pngs: tailSpec } : {}),") && RC.includes("return t ? { tail_pngs: t } : {}; })()),"));
  check("the harvest moves the tail to the take's scene name (adopt after recordRender)",
    RC.includes("if (rr.name) { try { tailFrames.adopt(project, st, r.n, path.basename(src), rr.name); } catch {} }"));
  check("the continuation reads the tail PNG first (the picked one inside the window, else the last), the video only without one - and says which",
    RC.includes("const tailPng = tailFrames.pick(project, st, srcRow,")
    && RC.includes("if (tailPng) {\n          try { fs.copyFileSync(tailPng.file, framePng); }")
    && RC.includes("if (!fs.existsSync(framePng)) try {")
    && RC.includes("(from its ${tailPng.width}x${tailPng.height} tail PNG ${tailPng.name}, ${tailPng.upscaler})"));
  check("the ⚙ panel: Tail PNG size + PNG upscaler (ComfyUI's upscale_models), saved with the record",
    /<select id="vdSetPngSize"[^>]*>\s*<option value="off">Off<\/option><option value="720">720p<\/option><option value="1080">1080p<\/option>/.test(DH)
    && DH.includes('<select id="vdSetPngUp"') && DH.includes('<option value="seedvr2">SeedVR2 7B (ComfyUI workflow)</option>')
    && RJ.includes('<option value="seedvr2">SeedVR2 7B (ComfyUI workflow)</option>') && RJ.includes("png_size: el(\"vdSetPngSize\").value, png_upscaler: el(\"vdSetPngUp\").value")
    && RJ.includes("var imgs = ((cats.upscale_models || {}).files || [])"));
  check("the image upscale workflows ship: image_upscale_model.json + (2.314.0) Tim's SeedVR2 export",
    fs.existsSync(path.join(ROOT, "comfy_workflows", "image_upscale_model.json"))
    && fs.existsSync(path.join(ROOT, "comfy_workflows", "utility_seedvr2_7b_int8_upscale_image_api.json")));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
