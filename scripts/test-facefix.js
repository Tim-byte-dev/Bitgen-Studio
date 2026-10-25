#!/usr/bin/env node
/* bitGen Studio — 2.322.0: FACE FIX + POSE FACE POINTS, the app side.
 * Run: node scripts/test-facefix.js
 * Tim: "is there any way to get the persons face to look 'not distorted'" ->
 * "please add the 2 reccommendations".
 *   1. lib/faceFix: normalize, save/read LIVE, jobSpec;
 *   2. lib/cnBasics pose_face (off by default, rides the job);
 *   3. the routes + the models scan (ultralytics). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const FF = require(path.join(ROOT, "lib", "faceFix"));
const CB = require(path.join(ROOT, "lib", "cnBasics"));

const d0 = FF.normalize({});
check("faceFix.normalize: off, denoise 0.4, the default detector; junk blanked (non-boolean tick, out-of-range denoise held, a path escape)",
  d0.enabled === false && d0.denoise === 0.4 && d0.detector === ""
  && FF.normalize({ enabled: "yes" }).enabled === false && FF.normalize({ denoise: 3 }).denoise === 1
  && FF.normalize({ denoise: 0 }).denoise === 0.05 && FF.normalize({ detector: "../x.pt" }).detector === "", d0);
const d = fs.mkdtempSync(path.join(os.tmpdir(), "ff-"));
try {
  FF.save(d, { enabled: true });
  const r = FF.save(d, { denoise: 0.35, detector: "bbox/face_yolov8n.pt" });
  check("save/read LIVE: projects/<p>/face_fix.json, patches merge",
    r.enabled && r.denoise === 0.35 && r.detector === "bbox/face_yolov8n.pt" && FF.read(d).denoise === 0.35
    && fs.existsSync(path.join(d, "face_fix.json")), r);
} finally { fs.rmSync(d, { recursive: true, force: true }); }
check("jobSpec: off -> null; on -> {denoise, detector} (blank detector = bbox/face_yolov8m.pt)",
  FF.jobSpec({ enabled: false }) === null
  && JSON.stringify(FF.jobSpec({ enabled: true, denoise: 0.45 })) === '{"denoise":0.45,"detector":"bbox/face_yolov8m.pt"}');
const base = { v: 2, enabled: true, controlnet: "c", model: "SDXL/x.safetensors", model_cat: "checkpoints" };
check("cnBasics pose_face: OFF by default, a real tick only, carried to the job",
  CB.normalize({}).pose_face === false && CB.normalize({ pose_face: "yes" }).pose_face === false
  && CB.jobSpec({ ...base, pose_face: true }, [], [], ROOT).pose_face === true
  && CB.jobSpec(base, [], [], ROOT).pose_face === false);
const RI = read("routes", "index.js"), MD = read("lib", "comfyModels.js");
check("routes: GET/POST /api/facefix; genimage takes the panel's settings inline (only the prompt's Generate sends them)",
  RI.includes('app.get("/api/facefix"') && RI.includes('app.post("/api/facefix"')
  && RI.includes('if (featOn("facefix") && b.face_fix && typeof b.face_fix === "object") {')   // 2.593.0: + only while the add-on is on
  && RI.includes("const ff = faceFix.jobSpec({ ...b.face_fix, enabled: true });")
  && RI.includes("if (ff) p.face_fix = ff;"));
check("the models scan knows ComfyUI's ultralytics folder + Impact-Subpack's detector combo",
  MD.includes('ultralytics: ["ultralytics"],') && MD.includes('ultralytics: [["UltralyticsDetectorProvider", "model_name"]],'));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
