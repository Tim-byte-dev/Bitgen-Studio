#!/usr/bin/env node
/* bitGen Studio — 2.807.0 pins: (1) the image editor's AI / Change style start this computer's ComfyUI before they queue (Tim's
 * log: "cannot reach ComfyUI at http://127.0.0.1:8188 ... actively refused it" rendering a Blender scene); (2) a Blender layer
 * comes back at the view it was left at (Tim: "is it possible to go to the same view when returning to a blender layer"). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PR = src("static/podroute.js"), MO = src("ext/imageeditdock/mount.js"), LB = src("static/lbrestyle.js"), BV = src("ext/timelinedock/blendview.js"), BL = src("ext/imageeditdock/pcblendlayer.js");
check("H3PodRoute.ready: a pod render skips; else /api/comfy/ensure + wait for reachable (no box, the job still goes in)", /function ready\(mode, styleId\)/.test(PR) && /\/api\/comfy\/ensure/.test(PR) && /function waitUp\(\)/.test(PR) && /ready: ready/.test(PR));
check("the editor's aiedit, compose and preprocess call it before they post", (MO.match(/H3PodRoute\.ready\(/g) || []).length === 3);
check("Change style calls it before the line art and the render", /H3PodRoute\.ready\("image", st\.id\)/.test(LB) && LB.indexOf('H3PodRoute.ready("image", st.id)') < LB.indexOf("line = await lineArt("));
check("TlBlend.restoreView puts back the camera matrix, field of view, orbit centre, frame / the scene camera", /function restoreView\(v\)/.test(BV) && /restoreView: restoreView/.test(BV) && /M\.decompose\(pos, q, sc\)/.test(BV));
check("a Blender layer keeps its orbit centre and its scene opens at its view (putView in afterLoad)", /target: lk && lk\.target/.test(BL) && /putView\(target\)/.test(BL));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
