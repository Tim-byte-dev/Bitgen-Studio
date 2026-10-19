#!/usr/bin/env node
/* bitGen Studio — 2.420.0 units: THE GPU COMPOSITOR's maths + wiring (static/glcomp.js, canvas.js compGL)
 * Tim: "yes, please add your 2 suggestions" ("a real WebGL compositor for the live canvas"). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const G = require(path.join(ROOT, "static", "glcomp.js"));
const near = (a, b) => Math.abs(a - b) < 1e-9;
const c0 = G.corners({ cx: 100, cy: 50, w: 40, h: 20, rot: 0 });
check("corners: a box's four corners (strip order TL, TR, BL, BR) in picture pixels", JSON.stringify(c0) === "[[80,40],[120,40],[80,60],[120,60]]", c0);
const c90 = G.corners({ cx: 0, cy: 0, w: 40, h: 20, rot: 90 });
check("...turned 90° clockwise (the canvas's rotation: y down): the top-left corner goes to the top-right", near(c90[0][0], 10) && near(c90[0][1], -20) && near(c90[3][0], -10) && near(c90[3][1], 20), c90);
check("toClip: picture pixels -> clip space (y up)", JSON.stringify(G.toClip(0, 0, 200, 100)) === "[-1,1]" && JSON.stringify(G.toClip(200, 100, 200, 100)) === "[1,-1]" && JSON.stringify(G.toClip(100, 50, 200, 100)) === "[0,0]");
check("lutUV: the half-texel mapping static/gradegl.js uses (33³: scale 32/33, offset 1/66)", near(G.lutUV(33).scale, 32 / 33) && near(G.lutUV(33).offset, 0.5 / 33));
const GJ = read("static", "glcomp.js"), CV = read("ext", "timelinedock", "canvas.js");
check("the shader: premultiplied textures, the grade's 3D LUT in the same draw (on the un-premultiplied colour), alpha last; blend ONE / ONE_MINUS_SRC_ALPHA",
  /UNPACK_PREMULTIPLY_ALPHA_WEBGL, true/.test(GJ) && /clamp\(c\.rgb \/ c\.a, 0\., 1\.\) \* \(\(n - 1\.\) \/ n\) \+ 0\.5 \/ n/.test(GJ) && /o = c \* alpha;/.test(GJ) && /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/.test(GJ)
  && /X\.buildLut\(fx, user, N\)/.test(GJ));
check("canvas.js: the GPU frame only while PLAYING, not with an adjustment layer, not when switched off (tl.glComp); a transition drawing now / anything it cannot do -> the 2D path",
  // 2.519.0: 2.491.0 added a second 2D-only case (blend modes / track mattes / masks: !blendOn) to the same gate
  /if \(S\.playing && !adjOn && !blendOn && tl\.glComp !== false && window\.H3GLComp\)/.test(CV) && /var gc = compGL\(t\);/.test(CV) && /ok = false; return; \}   \/\/ a wipe now: 2D/.test(CV)
  && /S\.lastGL = true;/.test(CV) && /S\.lastGL = false;/.test(CV));
check("...a grade-only clip is graded in the compositor's draw; a clip with effects / a mask keeps its look pass; captions still drawn into the frame",
  /if \(fx && !sp\[0\] && !sp\[1\] && !fx\.mask && b\.src\.tagName !== "CANVAS" && G\.gradeReady\(fx\)\) \{ if \(!G\.draw\(b\.src, b, a, fx\)\) ok = false; return; \}/.test(CV)
  && /if \(!G\.draw\(pic, b, a, null\)\) ok = false;/.test(CV) && /compHooks\.forEach\(function \(fn\) \{ try \{ fn\(g, t, \{ W: S\.W, H: S\.H \}\); \} catch \(e\) \{ \/\* a hook never breaks the picture \*\/ \} \}\);\n        g\.restore\(\);\n        return;/.test(CV));
check("the GPU switch beside ⏱ (tl.glComp), static/glcomp.js loaded; nest's fingerprint ignores it", /id = "tlCGpu"/.test(read("ext", "timelinedock", "tlrender.js")) && /tl\.glComp = tl\.glComp === false \? true : false/.test(read("ext", "timelinedock", "tlrender.js"))
  && /<script src="\/static\/glcomp\.js"><\/script>/.test(read("static", "index.html")) && /"playRes", "glComp"\]/.test(read("lib", "nest.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
