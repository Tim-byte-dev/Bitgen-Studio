#!/usr/bin/env node
/* bitGen Studio — 2.834.0 units: Generate / Edit in the image editor the Krita AI way. Tim: "when in image-edit mode and a
 * selection has been made and prompt docker is in generate mode then generate the image inside of the selection, if no
 * selection is made generate the image to the full canvas size, in edit mode use inpaint or out paint or fill like krita ai
 * does".
 *   ext/imageeditdock/pcaifill.js pure: geometry (box, spans, holes), editPlan (Auto / Inpaint / Fill / Outpaint), holeMask
 *   (grown into the picture), canvasSize; pcpromptlink actionFor (Generate + a selection = into it, panel or not); the
 *   wiring (runAI opt.forceEdit / fillKind expand, the page's H3ImageSize, mount.js takeGenerated, ext.json). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const F = require(path.join(ROOT, "ext/imageeditdock/pcaifill.js")), L = require(path.join(ROOT, "ext/imageeditdock/pcpromptlink.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const W = 20, H = 10, full = new Uint8Array(W * H).fill(255);
const selOf = (x0, y0, x1, y1) => { const m = new Uint8Array(W * H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 255; return m; };
const framed = new Uint8Array(W * H); for (let y = 2; y < 8; y++) for (let x = 5; x < 15; x++) framed[y * W + x] = 255;   // a picture with empty canvas round it

const gMid = F.geometry(selOf(8, 3, 12, 7), full, W, H), gSpan = F.geometry(selOf(0, 3, 20, 7), full, W, H), gHole = F.geometry(selOf(1, 3, 6, 7), framed, W, H);
check("geometry: a selection in the middle - its box, not across the picture, no empty canvas", gMid.hasSel && gMid.box.x === 8 && gMid.box.w === 4 && gMid.box.h === 4 && !gMid.spans && !gMid.holeInSel && !gMid.holes, gMid);
check("geometry: across the whole width = spans; over empty canvas = holeInSel; a picture with empty canvas round it = holes",
  gSpan.spans && gHole.holeInSel && gHole.holes && F.geometry(null, framed, W, H).holes && !F.geometry(null, full, W, H).holes && F.geometry(null, new Uint8Array(W * H), W, H).empty, [gSpan, gHole]);

const P = (m, g) => F.editPlan(m, g).how;
const none = F.geometry(null, full, W, H), noneHoles = F.geometry(null, framed, W, H);
check("editPlan Auto (Krita's): a selection inside = Inpaint, across the picture / over empty canvas = Outpaint; no selection = the layer, empty canvas round it = outpaint it",
  P("auto", gMid) === "inpaint" && P("auto", gSpan) === "outpaint" && P("auto", gHole) === "outpaint" && P("auto", none) === "layer" && P("auto", noneHoles) === "outpaintEmpty");
check("editPlan Inpaint / Fill / Outpaint as picked; Fill without a selection and Outpaint with no room say so; an empty picture says Generate first",
  P("inpaint", gSpan) === "inpaint" && P("inpaint", none) === "layer" && P("fill", gMid) === "fill" && P("fill", none) === "say" && P("outpaint", gMid) === "outpaint" && P("outpaint", noneHoles) === "outpaintEmpty"
  && P("outpaint", none) === "say" && /Canvas Size/.test(F.editPlan("outpaint", none).msg) && P("auto", F.geometry(null, new Uint8Array(W * H), W, H)) === "say" && P("weird", gMid) === "inpaint");

const hm0 = F.holeMask(framed, W, H, 0), hm2 = F.holeMask(framed, W, H, 2);
const at = (m, x, y) => m[y * W + x];
check("holeMask: the empty canvas selected; grown 2 px into the picture (Chebyshev), the middle of the picture kept",
  at(hm0, 0, 0) === 255 && at(hm0, 5, 2) === 0 && at(hm2, 5, 2) === 255 && at(hm2, 6, 3) === 255 && at(hm2, 7, 4) === 0 && at(hm2, 10, 5) === 0 && at(hm2, 16, 5) === 255 && at(hm2, 14, 5) === 255 && at(hm2, 12, 5) === 0, Array.from(hm2));

const c1 = F.canvasSize(800, 600, 1), c2 = F.canvasSize(3000, 1000, 1), c3 = F.canvasSize(500, 500, 0.5);
check("canvasSize: the canvas's shape at about the megapixels asked, 16-px steps, 256..2048 a side",
  c1.width % 16 === 0 && c1.height % 16 === 0 && Math.abs(c1.width / c1.height - 4 / 3) < 0.03 && c1.width * c1.height > 950000 && c1.width * c1.height < 1150000
  && c2.width <= 2048 && Math.abs(c2.width / c2.height - 3) < 0.05 && c3.width === c3.height && c3.width === 720, [c1, c2, c3]);

const s = { onScreen: true, open: true, aiShown: false, mode: "generate", genMode: "image", hasSel: false, blender: false, picks: 0, refs: 0 };
const A = (o) => L.actionFor(Object.assign({}, s, o));
check("actionFor ✨ Generate: a selection in the editor = into it (a new layer, not the whole picture) with the ✨ AI panel hidden too; none = the prompt docker's own Generate (null)",
  JSON.stringify(A({ op: "generate", hasSel: true })) === JSON.stringify({ kind: "run", op: "generate", mode: "generate", whole: false, into: false })
  && A({ op: "generate" }) === null && A({ op: "generate", hasSel: true, onScreen: false }) === null && A({ op: "generate", blender: true }).kind === "blender" && A({ op: "generate", hasSel: true, genMode: "video" }) === null);

// the wiring
const IE = read("ext/imageeditdock/imageedit.js"), PL = read("ext/imageeditdock/pcpromptlink.js"), MT = read("ext/imageeditdock/mount.js"), IX = read("static/index.html"), AF = read("ext/imageeditdock/pcaifill.js");
const ej = JSON.parse(read("ext/imageeditdock/ext.json"));
check("runAI: opt.forceEdit sends Fill / Outpaint through the edit model; opt.fillKind 'expand' = Krita's Expand", /editOk && \(opt\.forceEdit \|\|/.test(IE) && /opt\.fillKind === "expand" \|\| bb\.w >= S\.w/.test(IE) && /PCAiFill\.install\(E\)/.test(IE));
check("pcpromptlink: Generate into the selection goes to takeOp with the prompt docker's style; ✏ Edit asks E.aiFill first",
  /act\.kind === "run" && !act\.whole\)\)\) return takeOp/.test(PL) && /E\.runAI\(\{ prompt, editStyle, style: fs,/.test(PL) && /act\.op === "edit" && !act\.bg && E\.aiFill && E\.aiFill\.edit\(prompt, editStyle\)/.test(PL));
check("the page asks window.H3ImageSize before /api/genimage; mount.js puts a canvas-shaped picture over the whole canvas; pcaifill.js loads after pcimgop.js",
  /window\.H3ImageSize\(body\)/.test(IX) && IX.indexOf("window.H3ImageSize(body)") < IX.indexOf('const res = await fetch("/api/genimage"') && /E\.aiFill\.takeGenerated\(img, label\)/.test(MT)
  && ej.scripts.indexOf("pcaifill.js") === ej.scripts.indexOf("pcimgop.js") + 1 && /#pmEdFill|pmEdFill/.test(AF));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
