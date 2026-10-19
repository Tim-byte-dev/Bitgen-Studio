#!/usr/bin/env node
/* bitGen Studio — 2.540.3: a checkpoint override only where it fits the style's workflow.
 * Tim's first install from GitHub: Qwen Image 2.1 edit rendered with anima/animakimi_v13 ("mat1 and mat2 shapes cannot
 * be multiplied"), FLUX 3 Klein with illustrious/perfectdeliberate_v30 ("'NoneType' object has no attribute 'shape'"),
 * SDXL came out black - Basic Settings' checkpoint override was put into every style. lib/modelFit.js decides; the
 * image route leaves a misfit out for the render and the worker log says why. Pure + the route's source (the live
 * route was checked against a test studio by hand when this shipped). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const M = require(path.join(ROOT, "lib", "modelFit.js"));
const MC = require(path.join(ROOT, "lib", "modelCards.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

(async () => {
  const qwen = { name: "Qwen Image 2.1 edit", arch: "qwen-image" }, f3 = { name: "FLUX 3 Klein", arch: "flux3klein" }, sdxl = { name: "SDXL", arch: "sdxl" };
  const a = M.fit(qwen, "anima/animakimi_v13.safetensors", "anima");
  check("Tim's case 1: an Anima checkpoint does NOT fit Qwen Image 2.1 edit (qwen-image) - and says why", !a.ok && a.styleArch === "qwen-image" && /an Anima model does not load in a qwen-image workflow/.test(a.why), a);
  const b = M.fit(f3, "illustrious/perfectdeliberate_v30.safetensors", "illustrious");
  check("Tim's case 2: an Illustrious (SDXL) checkpoint does NOT fit FLUX 3 Klein", !b.ok && b.arch === "sdxl", b);
  check("…Illustrious / Pony / NoobAI / SD 1.5 / SDXL checkpoints all fit an SDXL style (one architecture)", ["illustrious", "pony", "noobai", "sd15", "sdxl"].every((f) => M.fit(sdxl, "x.safetensors", f).ok));
  check("…an Anima checkpoint does not fit SDXL (Tim's black SDXL picture)", !M.fit(sdxl, "anima/x.safetensors", "anima").ok);
  check("…a FLUX 3 Klein file fits FLUX 3 Klein; a Flux.2 file does not", M.fit(f3, "x", "flux3").ok && !M.fit(f3, "x", "flux2").ok);
  check("…nothing to compare = ok (a family with no architecture, an unknown file, a style with no arch)", M.fit(sdxl, "x", "other").ok && M.fit(sdxl, "x", "").ok && M.fit({ name: "x" }, "y", "anima").ok && M.fit(sdxl, "x", "hidream").ok);
  check("…a video model in an image style does not fit", !M.fit(sdxl, "wan.safetensors", "wan").ok);
  check("familyOf: with no ComfyUI folder the file's name decides (anima/…, illustrious/…)", M.familyOf("anima/animakimi_v13.safetensors") === MC.nameFamily("anima/animakimi_v13.safetensors") && M.familyOf("") === "", [M.familyOf("anima/animakimi_v13.safetensors")]);
  const n = M.note(qwen, a, "anima\\animakimi_v13.safetensors");
  check("note(): the file, its family, the style, what happens (left out, the style's own model) and what to do", /animakimi_v13\.safetensors \(Anima\) does not fit "Qwen Image 2\.1 edit" \(qwen-image\)/.test(n) && /left out for this render, the style's own model is used/.test(n) && /Untick Override style/.test(n), n);
  // the route
  const R = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
  check("routes/index.js /api/genimage: the override goes in only when modelFit.fit(...).ok; otherwise the note rides as workflow_note (and the later notes join it, not replace it)",
    /const modelFit = require\("\.\.\/lib\/modelFit"\)/.test(R) && /const mf = modelFit\.fit\(styled, b\.model\.trim\(\)\);\s*if \(mf\.ok\) styled = Object\.assign\(\{\}, styled, \{ model: b\.model\.trim\(\)\.slice\(0, 300\), model_override: true \}\);\s*else overrideNote = modelFit\.note/.test(R)
    && /if \(overrideNote\) p\.workflow_note = overrideNote;/.test(R) && !/p\.workflow_note = rw\.note;/.test(R));
  check("image_worker.py prints workflow_note in the log", /if params\.get\("workflow_note"\):\s*\n\s*say\(f"\[worker\] \{params\['workflow_note'\]\}"\)/.test(fs.readFileSync(path.join(ROOT, "image_worker.py"), "utf8")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
