#!/usr/bin/env node
/* bitGen Studio — 2.541.0 units: the prompt docker's ▾ Generate / Edit / Refine / Fill / Replace background / Remove
 * (pcimgop.js), what its button does (pcpromptlink.js actionFor), BLENDER MODE's model edits (pc3d.js setObj / objDrag /
 * objBox / pickObject, lib/layer3d.js cleanObjects) and the wiring. Pure - no server, no Blender.
 * Tim: "add blender bridge to image-editor so user can modify model/view/camera - add a dropdown to the prompt top
 * menubar- Generate,edit,refine,fill,replace background,remove ... work like the krita ai plugin". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const O = require(path.join(ROOT, "ext", "imageeditdock", "pcimgop.js"));
const PL = require(path.join(ROOT, "ext", "imageeditdock", "pcpromptlink.js"));
const P3 = require(path.join(ROOT, "ext", "imageeditdock", "pc3d.js"));
const L3 = require(path.join(ROOT, "lib", "layer3d.js"));

// ---- the dropdown
check("the choices in Tim's order: Generate, Edit, Refine, Fill, Replace background, Remove (+ 2.543.0 Compose)", O.OPS.map((o) => o.label).join("|") === "Generate|Edit|Refine|Fill|Replace background|Remove|Compose");
check("each picks the ✨ AI panel's mode (Fill = Generate into the selection; Replace background = New background)",
  ["generate", "edit", "refine", "fill", "background", "remove", "compose"].map(O.modeFor).join() === "generate,edit,refine,generate,background,remove,compose");
check("the panel's mode -> the dropdown: Generate keeps Fill when Fill was picked; unknown = no change (2.543.0: Compose is one of them)",
  O.opForMode("generate", "fill") === "fill" && O.opForMode("generate", "edit") === "generate" && O.opForMode("refine", "x") === "refine" && O.opForMode("compose", "edit") === "compose" && O.opForMode("zz") === null);
check("the button's words: \"🔁 Refine 30%\", \"✏ Edit · 🟧 Blender\" in Blender mode, \"🪣 Fill\", \"🖼 Replace background\"",
  O.labelFor("refine", 30) === "🔁 Refine 30%" && O.labelFor("edit", 50, true) === "✏ Edit · 🟧 Blender" && O.labelFor("fill") === "🪣 Fill" && O.labelFor("background") === "🖼 Replace background" && O.labelFor("nope") === "✨ Generate");
check("shown only in 🖼 Image mode", O.shown("image") && !O.shown("video") && !O.shown("chat"));

// ---- what the button does (2.543.0 rules - test-imgop543.js has the rest)
const s = { onScreen: true, open: true, aiShown: false, mode: "generate", genMode: "image", hasSel: false, blender: false, picks: 0, refs: 0 };
const A = (x) => PL.actionFor(Object.assign({}, s, x));
check("✨ Generate: the prompt docker's own (null) unless the ✨ AI panel shows its Generate (then into the selection / the whole picture, as 2.444)",
  A({ op: "generate" }) === null && A({ op: "generate", aiShown: true }).kind === "run" && A({ op: "generate", aiShown: true }).into === true && A({ op: "generate", genMode: "video" }) === null);
check("Edit / Refine without a selection: from the selected LAYER (a new layer each); Refine with a selection: the picture's selection",
  JSON.stringify(A({ op: "edit" })) === JSON.stringify({ kind: "layer", op: "edit", mode: "edit" }) && A({ op: "refine" }).kind === "layer" && A({ op: "refine", hasSel: true }).kind === "run");
check("Fill / Remove need a selection (said); with one: Generate into it (blends on ✔) / Remove; Replace background with one = New background",
  A({ op: "fill" }).kind === "say" && /select the area/.test(A({ op: "fill" }).msg) && A({ op: "remove" }).kind === "say"
  && JSON.stringify(A({ op: "fill", hasSel: true })) === JSON.stringify({ kind: "run", op: "fill", mode: "generate", whole: false, into: true })
  && A({ op: "background", hasSel: true }).mode === "background" && A({ op: "remove", hasSel: true }).mode === "remove");
check("no picture -> say so; not in Image mode -> the prompt docker's own",
  A({ op: "refine", open: false }).kind === "say" && A({ op: "edit", genMode: "video" }) === null);
check("🟧 Blender mode: Edit / Refine render the scene (kind blender); Fill / Remove still work on the canvas",
  JSON.stringify(A({ op: "edit", blender: true })) === JSON.stringify({ kind: "blender", op: "edit", mode: "edit" }) && A({ op: "refine", blender: true }).kind === "blender"
  && A({ op: "fill", blender: true, hasSel: true }).kind === "run");

// ---- the model
const objs = P3.setObj({}, "Body", { move: [1, 0, 0] });
check("setObj: an object's edit set / merged; a no-op edit dropped; scale 1 and zero turns left out",
  JSON.stringify(objs) === '{"Body":{"move":[1,0,0]}}' && JSON.stringify(P3.setObj(objs, "Body", { move: [0, 0, 0] })) === "{}"
  && JSON.stringify(P3.setObj(objs, "Body", { turn: [0, 0, 45], scale: 0.5 })) === '{"Body":{"move":[1,0,0],"turn":[0,0,45],"scale":0.5}}' && JSON.stringify(P3.setObj({}, "A", { hide: true })) === '{"A":{"hide":true}}');
const front = { target: [0, 0, 1], dist: 6, yaw: -90, pitch: 0, fov: 40 };       // at (0, -6, 1) looking along +Y
const m1 = P3.objDrag(front, {}, 100, 0, "move", 480), m2 = P3.objDrag(front, {}, 0, -100, "move", 480), m3 = P3.objDrag(front, {}, 0, -100, "lift", 480), m4 = P3.objDrag(front, { turn: [0, 0, 10] }, 40, 0, "turn", 480);
check("objDrag: right = +X as the camera sees it, up = away (+Y) along the ground, Shift (lift) up = +Z, Ctrl (turn) = round Z; the size follows the view (100 px of 480 at 6 m, 40° = 0.91 m)",
  m1.move[0] > 0.85 && m1.move[0] < 0.95 && Math.abs(m1.move[1]) < 1e-6 && m2.move[1] > 0.85 && Math.abs(m2.move[0]) < 1e-6 && m2.move[2] === 0 && m3.move[2] > 0.85 && m3.move[1] === 0 && m4.turn[2] === -10, { m1, m2, m3, m4 });
const metaObjs = [{ name: "Floor", type: "MESH", box: [[-5, -5, -0.1], [5, 5, 0]] }, { name: "Body", type: "MESH", box: [[-0.5, -0.5, 0], [0.5, 0.5, 2]] }, { name: "Cam", type: "CAMERA" }, { name: "bitgen_x", type: "MESH", box: [[0, 0, 0], [1, 1, 1]] }];
const bb = P3.objBox(metaObjs[1], null, front, 640, 480), bm = P3.objBox(metaObjs[1], { move: [1, 0, 0] }, front, 640, 480);
check("objBox: the object's box on the picture, moved with its edit (1 m right = further right)", bb && bm && bm[0] > bb[0] + 40 && bb[0] < 320 && bb[2] > 320, { bb, bm });
check("pickObject: the smallest box under the point (Body over the floor); outside = the floor; a hidden one is skipped; cameras / bitGen's helpers never",
  P3.pickObject(metaObjs, {}, front, 640, 480, 320, 240) === "Body" && P3.pickObject(metaObjs, {}, front, 640, 480, 320, 380) === "Body" && P3.pickObject(metaObjs, { Body: { hide: true } }, front, 640, 480, 320, 380) === "Floor" && P3.pickObject(metaObjs, {}, front, 640, 480, 20, 100) === null
  && P3.editable(metaObjs).map((o) => o.name).join() === "Floor,Body");
const cj = L3.cleanJob({ objects: { Body: { move: [1, "x", 2e9], turn: [0, 0, 45], scale: 1 }, Arm: { hide: true }, bitgen_view: { move: [1, 0, 0] }, Same: { move: [0, 0, 0], scale: 1 } } });
check("lib/layer3d cleanJob: objects checked - finite, bounded (±10 km, ±360°, 1 % - 100 x), no-ops and bitGen's own dropped",
  JSON.stringify(cj.objects) === '{"Body":{"move":[1,0,10000],"turn":[0,0,45]},"Arm":{"hide":true}}' && JSON.stringify(L3.cleanJob({}).objects) === "{}" && L3.cleanObjects({ A: { scale: 1e9 } }).A.scale === 100, cj.objects);

// ---- the wiring
const IE = rd("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, PY = rd("scripts", "blend_layer3d.py"), C3 = rd("ext", "imageeditdock", "pc3d.js");
check("the editor: pcimgop.js loaded and installed before the prompt link; runAI takes a source picture (Blender mode) and a label; E.setAiMode / E.setStrength; a ✔ on each result",
  EXT.includes("pcimgop.js") && IE.indexOf("PCImgOp.install(E)") > 0 && IE.indexOf("PCImgOp.install(E)") < IE.indexOf("PCPromptLink.install(E)")
  && /const src = source \|\| flatten\(\);/.test(IE) && /label: opt\.label \|\| ""/.test(IE) && /E\.setAiMode = setAiMode;/.test(IE) && /E\.setStrength = /.test(IE) && /ok\.className = "kxthok"/.test(IE) && /showResult\(i\); applyResult\(\);/.test(IE));
check("pc3d.js: the job carries the model (objects: l.objs), Edit from the scene renders at the picture's size without touching the layer, runAI with that source",
  /objects: l\.objs \|\| \{\}/.test(C3) && /async function editFromScene\(L, text, mode, editStyle\)/.test(C3) && /renderImage\(L, true, S\.w, S\.h\)/.test(C3) && /source: c, whole: true, into: false/.test(C3));
check("blend_layer3d.py: every job starts from the file's own places (reset), then the frame, the pose, the model (world: scale, turn, move round its origin)",
  /def keep_objects\(\)/.test(PY) && /reset_objects\(\)\s+# 2\.541\.0/.test(PY) && /apply_objects\(job\.get\("objects"\)\)/.test(PY) && /Matrix\.Translation\(mv\) @ about @ m/.test(PY) && (PY.match(/keep_objects\(\)/g) || []).length >= 3);
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
