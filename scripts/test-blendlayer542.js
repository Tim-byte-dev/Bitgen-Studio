#!/usr/bin/env node
/* bitGen Studio — 2.542.0 units: a BLENDER LAYER in the image editor (pcblendlayer.js), the timeline's scene tools lent to
 * it (blendview.js attach / detach / viewPicture / still), one frame as a PNG (lib/blendView.still + blend_scene.py
 * still_only), results straight in as new layers (runAI direct). Pure + the wiring - no server, no Blender.
 * Tim: "add blender button to open scene tools to image-editor as a blender layer - open blender scene etc. the same as the
 * timeline docker - when user clicks the edit button in prompt use the current scene as the reference to generate the
 * image from. create a new layer. right now the canvas is getting the rendered image and it cannot be deleted." */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const B = require(path.join(ROOT, "ext", "imageeditdock", "pcblendlayer.js"));

check("Edit from: the view as shown (instant), a Blender render - Solid, a Blender render - EEVEE; anything else = the view",
  B.REFS.map((r) => r[0]).join() === "view,WORKBENCH,EEVEE" && B.refOf("EEVEE") === "EEVEE" && B.refOf("nope") === "view" && B.refOf() === "view");
check("docSize: a new picture at the scene's shape, the long side 1280 (1280 x 704 stays; 1080 x 1920 -> 720 x 1280; nonsense -> 16 : 9)",
  B.docSize(1280, 704).join() === "1280,704" && B.docSize(1080, 1920).join() === "720,1280" && B.docSize(0, 0).join() === "1280,720");

const BV = rd("ext", "timelinedock", "blendview.js"), LB = rd("lib", "blendView.js"), RB = rd("routes", "blendView.js"), PY = rd("scripts", "blend_scene.py");
const SRC = rd("ext", "imageeditdock", "pcblendlayer.js"), IE = rd("ext", "imageeditdock", "imageedit.js"), DOC = rd("ext", "imageeditdock", "pcdoc.js");
const PL = rd("ext", "imageeditdock", "pcpromptlink.js"), OP = rd("ext", "imageeditdock", "pcimgop.js"), C3 = rd("ext", "imageeditdock", "pc3d.js");
check("the timeline's tools can be lent: attach (the view into the borrower's box, the Properties into its tab), detach (back), openUi, the borrower told when they close",
  /function attach\(h\)/.test(BV) && /ext = h; h\.wrap\.appendChild\(ov\)/.test(BV) && /function detach\(\)/.test(BV) && /\$\("tlCanvasWrap"\)\.appendChild\(ov\)/.test(BV)
  && /if \(ext && ext\.onShow\)/.test(BV) && /if \(h\.onTaken\)/.test(BV) && /attach: attach, detach: detach, openUi: openUi, snapshot: viewPicture, still: stillReal/.test(BV));
check("...the view as a picture is viewPicture (the edits' undo copy keeps the name snapshot() - one of each), the widget + grid left out of it",
  (BV.match(/function snapshot\(/g) || []).length === 1 && /function snapshot\(\) \{ return JSON\.stringify\(S\.E\); \}/.test(BV) && /function viewPicture\(w, h\)/.test(BV) && /if \(hp\) hp\.visible = false; if \(grid\) grid\.visible = false;/.test(BV));
check("lib/blendView.still: one frame through the view (or the scene camera) at w x h -> a PNG in <project>/blender/stills (an hour kept); the routes; the script stops after the still",
  /function still\(stem, opts\)/.test(LB) && /still_only: true, w, h/.test(LB) && /stillStatus, stillPath/.test(LB) && /app\.post\("\/api\/blendview\/still"/.test(RB) && /\/api\/blendview\/still\/:id\/png/.test(RB)
  && /if job\.get\("still_only"\):/.test(PY) && /if job\.get\("w"\) and job\.get\("h"\):/.test(PY));
check("the Blender layer: L.bscene (L.blend is a layer's blend MODE), kept by undo / copies (pcdoc DEEP), the 🟧 button by ⛶, Layer ▸ New Blender Layer (Scene Tools)…, the 🟧 Blender tab",
  /const isBL = \(L\) => !!\(L && L\.bscene && typeof L\.bscene === "object"\)/.test(SRC) && !/L\.blend\b/.test(SRC.replace(/not L\.blend - that/g, "")) && /"l3d", "sketch", "bscene"\]/.test(DOC)
  && /b\.id = "kblBtn"/.test(SRC) && /mr\.insertBefore\(b, \$\("kxFull"\)\)/.test(SRC) && /addCmd\("layer\.newblend", "New Blender Layer \(Scene Tools\)…"/.test(SRC) && /dataset\.tab = "kbl"/.test(SRC));
check("...the tools sit over the canvas as the stage's SIBLING (the editor's tools never see the pointer; its keys stay out, Esc closes)",
  /main\.appendChild\(wrap\)/.test(SRC) && /wrap\.addEventListener\("keydown", \(e\) => \{ if \(e\.key === "Escape"\)/.test(SRC) && /e\.stopPropagation\(\); \}\);/.test(SRC));
check("Blender mode Edit: the reference (the live view / the layer's view / a Blender still), runAI with it as the source, every result a NEW layer, the Blender layer kept picked",
  /async function reference\(L\)/.test(SRC) && /\/api\/blendview\/still/.test(SRC) && /source: c, whole: true, into: false, direct: true, keep: L/.test(SRC)
  && /if \(opt\.direct\) \{/.test(IE) && /addLayer\(L, "AI result", false\); added\+\+;/.test(IE) && /if \(opt\.keep && S\.layers\.includes\(opt\.keep\)\) S\.active = S\.layers\.indexOf\(opt\.keep\)/.test(IE));
check("...the prompt docker sends a Blender layer's Edit there (a 3D layer's to pc3d), the chip counts both, pc3d's Edit from the scene is a new layer too (nothing left over the canvas)",
  /if \(E\.blendLayer && E\.blendLayer\.isCurrent\(\)\) \{ E\.blendLayer\.editFromScene/.test(PL) && /E\.blendLayer && E\.blendLayer\.isCurrent\(\)/.test(OP) && /direct: true, keep: L, label: "🟧 " \+ L\.l3d\.name/.test(C3));
const ext = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts;
check("wiring: pcblendlayer.js loaded before imageedit.js, installed after PC3D", ext.indexOf("pcblendlayer.js") >= 0 && ext.indexOf("pcblendlayer.js") < ext.indexOf("imageedit.js") && IE.indexOf("PCBlendLayer.install(E)") > IE.indexOf("PC3D.install(E)"));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
