#!/usr/bin/env node
/* bitGen Studio — 2.569.0 units: 🔲 ZONES in the image editor - boxes on the canvas, each with what goes in it, filled one
 * box at a time / by the Edit model in one pass / as a regional prompt in one pass (ext/imageeditdock/pczones.js pure;
 * lib/regions.js; the wiring: runAI, the document, .bgi, /api/genimage).
 * Tim: "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to put kite in this
 * box, dog in this box, bench in this box?" - "let me pick per run", on "both" a picture and a blank canvas. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const Z = require(path.join(ROOT, "ext", "imageeditdock", "pczones.js"));
const RG = require(path.join(ROOT, "lib", "regions.js"));

/* 1 boxes */
check("normBox: any corner order -> x / y / w / h in whole pixels, inside the picture", JSON.stringify(Z.normBox(300, 200, 100.4, -20, 400, 300)) === '{"x":100,"y":0,"w":200,"h":200}');
const zs = [{ x: 10, y: 10, w: 100, h: 80 }, { x: 60, y: 50, w: 100, h: 100 }];
check("hitZone: the top-most box first; inside = move, near an edge / a corner = that edge / corner; outside = null",
  Z.hitZone(zs, 80, 70, 4).i === 1 && Z.hitZone(zs, 80, 70, 4).part === "move" && Z.hitZone(zs, 20, 20, 4).i === 0 && Z.hitZone(zs, 161, 151, 4).part === "se"
  && Z.hitZone(zs, 10, 40, 4).part === "w" && Z.hitZone(zs, 300, 300, 4) === null);
check("moveZone: move keeps it inside the picture; an edge / corner sizes it (at least 8 px), its words and colour kept",
  JSON.stringify(Z.moveZone({ x: 10, y: 10, w: 100, h: 80, text: "a kite", color: "red" }, "move", 500, -50, 400, 300)) === '{"x":300,"y":0,"w":100,"h":80,"text":"a kite","color":"red"}'
  && Z.moveZone({ x: 10, y: 10, w: 100, h: 80 }, "se", 20, 30, 400, 300).w === 120 && Z.moveZone({ x: 10, y: 10, w: 100, h: 80 }, "nw", 200, 0, 400, 300).w === 8);
const m = Z.rectMask({ x: 2, y: 1, w: 3, h: 2 }, 6, 4);
check("rectMask: the box as a selection (255 inside, 0 elsewhere)", m.length === 24 && m[1 * 6 + 2] === 255 && m[2 * 6 + 4] === 255 && m[1 * 6 + 5] === 0 && m[3 * 6 + 2] === 0 && m.reduce((a, v) => a + (v ? 1 : 0), 0) === 6);
const white = new Uint8ClampedArray(64).fill(255), spot = Uint8ClampedArray.from(white); spot[20] = 0; spot[21] = 0;
check("isBlank: one colour / see-through = blank; anything drawn = a picture; the method starts on Regional for a blank canvas, One box at a time for a picture",
  Z.isBlank(white) && Z.isBlank(new Uint8ClampedArray(64)) && !Z.isBlank(spot) && Z.defaultMethod(true) === "regional" && Z.defaultMethod(false) === "boxes"
  && Z.METHODS.map((x) => x[0]).join() === "boxes,edit,regional");

/* 2 the words */
const zz = [{ x: 0, y: 0, w: 10, h: 10, text: "a red kite.", color: "red" }, { x: 0, y: 0, w: 10, h: 10, text: "  a dog ", color: "blue" }, { x: 0, y: 0, w: 5, h: 5, text: "", color: "green" }];
const ins = Z.instruction(zz, "a sunny park", false), ins2 = Z.instruction(zz, "a sunny park", true);
check("instruction (✎ Edit model): each box by its colour, the scene, the outlines taken away, the rest unchanged; a blank canvas = turn it into the scene; a box with no words left out",
  /^The scene: a sunny park\. Put a red kite inside the red box\. Put a dog inside the blue box\./.test(ins) && /Remove every coloured box outline completely; everything outside the boxes stays exactly the same\.$/.test(ins)
  && !/green/.test(ins) && /^Turn this blank canvas into a picture: a sunny park\./.test(ins2) && /nothing of the outlines is left/.test(ins2), { ins, ins2 });
check("regionsOf: fractions of the picture with the words (no words = left out); renderSize: the picture's shape at ~1 MP on a 16-px grid",
  JSON.stringify(Z.regionsOf([{ x: 100, y: 50, w: 200, h: 100, text: " a kite " }, { x: 0, y: 0, w: 5, h: 5, text: "" }], 400, 200)) === '[{"x":0.25,"y":0.25,"w":0.5,"h":0.5,"text":"a kite"}]'
  && JSON.stringify(Z.renderSize(1600, 900)) === '{"width":1360,"height":768}' && JSON.stringify(Z.renderSize(500, 500)) === '{"width":1024,"height":1024}');

/* 3 the server's cleaner */
const c = RG.clean([{ x: -1, y: 0.5, w: 3, h: 0.7, text: " a\nkite " }, { x: 0.1, y: 0.1, w: 0.005, h: 0.5, text: "tiny" }, { x: 0, y: 0, w: 1, h: 1, text: "" }, { x: "a", y: 0, w: 1, h: 1, text: "nan" }, { x: 0, y: 0, w: 0.5, h: 0.5, text: "dog", strength: 9 }]);
check("lib/regions.clean: kept inside the picture, words tidied, too small / no words / not numbers dropped, strength 0.1..2, at most 8",
  c.length === 2 && JSON.stringify(c[0]) === '{"x":0,"y":0.5,"w":1,"h":0.5,"text":"a kite","strength":1}' && c[1].strength === 2
  && RG.clean(Array.from({ length: 12 }, () => ({ x: 0, y: 0, w: 1, h: 1, text: "x" }))).length === RG.MAX && RG.clean("no").length === 0);

/* 4 the wiring */
const IE = rd("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(rd("ext", "imageeditdock", "ext.json")), DOCS = require(path.join(ROOT, "ext", "imageeditdock", "pcdocs.js"));
const BGI = rd("ext", "imageeditdock", "pcbgi.js"), PZ = rd("ext", "imageeditdock", "pczones.js"), RI = rd("routes", "index.js"), CI = rd("scripts", "comfy_image.py");
check("runAI takes a zone: its own mode, its box (not the selection, not a frame), Add content, the first result applied by itself",
  /const mode = opt\.mode \|\| S\.aiMode;/.test(IE) && /hasSel\(\) && !source && !opt\.zone \?/.test(IE) && /if \(!source && !opt\.zone\) \{ if \(E\.beforeGenerate\)/.test(IE)
  && /\(opt\.fillKind \|\| S\.fillMode\) === "fill"/.test(IE) && /if \(opt\.autoApply && !applied\) \{ applied = true; E\.pending\.apply\(its\[i\]\); \}/.test(IE));
check("the module: loaded before the editor (just before pcpending.js - it stays right before imageedit.js), installed with the others; the boxes belong to the document (DOC_KEYS) and its .bgi",
  EXT.scripts.indexOf("pczones.js") === EXT.scripts.indexOf("pcpending.js") - 1 && EXT.scripts.indexOf("pczones.js") < EXT.scripts.indexOf("imageedit.js") && /win\.PCZones\.install\(E\)/.test(IE)
  && DOCS.DOC_KEYS.includes("zones") && Array.isArray(DOCS.blank().zones) && /zones: clone\(S\.zones \|\| \[\]\)/.test(BGI) && /S\.zones = Array\.isArray\(mk\.zones\)/.test(BGI));
check("the three ways: ▣ a ✨ Generate per box (all queued at once), ✎ the picture with the coloured outlines to the Edit model, ▦ /api/genimage with regions -> a layer",
  /zone: true, mode: "generate", sel: rectMask\(z, S\.w, S\.h\), prompt: words\(z\.text\), fillKind: "add"/.test(PZ) && /if \(pend\) E\.runAI\(o\); else await E\.runAI\(o\);/.test(PZ)
  && /mode: "edit", source: c, prompt: instruction\(zs, scene, blankNow\(\)\)/.test(PZ) && /regions: regionsOf\(zs, S\.w, S\.h\)/.test(PZ) && /win\.fetch\("\/api\/genimage"/.test(PZ));
check("/api/genimage: regions cleaned (lib/regions.js) into the job - a ComfyUI style only; comfy_image.patch hands them to comfy_regions.apply; nothing in server.js",
  /const rg = require\("\.\.\/lib\/regions"\)\.clean\(b\.regions\);/.test(RI) && /regional prompting needs a ComfyUI image style/.test(RI) && /if \(rg\.length\) p\.regions = rg;/.test(RI)
  && /graph, zrep = comfy_regions\.apply\(graph, params\.get\("regions"\), W, H\)/.test(CI) && !/regions/.test(rd("server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
