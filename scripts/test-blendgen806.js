#!/usr/bin/env node
/* bitGen Studio — 2.806.0 units: ✨ Generate from a Blender layer's scene + the live Blender layer (pcblendlayer.js), the
 * prompt docker's routing (pcpromptlink.js actionFor), the ▾ label (pcimgop.js).
 * Tim (verbatim): "when in image editor and a blender layer is being worked on an the generate button is pressed, then generate
 * the image from the blender scene and the prompt and reference images if any ... if a blender scene is on a layer, if user
 * clicks away from that layer and returns show the blender scene edited blender layers are raster layers but the blender
 * scene layer is live". Pure + source pins. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const B = require("../ext/imageeditdock/pcblendlayer.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const ENG = { edit: [{ id: "klein" }, { id: "qwen" }], inpaint: [{ id: "sdxl", refine: true }, { id: "krea", refine: false }] };
check("genHow: the prompt docker's style an edit model = that model", JSON.stringify(B.genHow("qwen", ENG, 0, "klein")) === JSON.stringify({ how: "edit", style: "qwen", why: "" }));
check("genHow: a picture style that redraws, no references = Refine with it", B.genHow("sdxl", ENG, 0, "klein").how === "refine" && B.genHow("sdxl", ENG, 0, "klein").style === "sdxl");
const r = B.genHow("sdxl", ENG, 2, "klein");
check("genHow: references there = the ✏ Edit model (only an edit model takes pictures), said", r.how === "edit" && r.style === "klein" && /only an edit model takes pictures/.test(r.why), r);
const k = B.genHow("krea", ENG, 0, "");
check("genHow: a style that cannot redraw = the first edit model, said", k.how === "edit" && k.style === "klein" && /cannot redraw/.test(k.why), k);
check("genHow: nothing able = null with why", B.genHow("krea", { edit: [], inpaint: [{ id: "krea", refine: false }] }, 0, "").how === null);
check("strengthOf: 20-95, 60 by default", B.strengthOf("") === 60 && B.strengthOf(5) === 20 && B.strengthOf(99) === 95 && B.strengthOf("70") === 70);
check("liveStep: a shown Blender layer picked, tools closed = open", B.liveStep({ blender: true, shown: true }, false, false, true) === "open");
check("liveStep: another layer picked while open = close (the view kept)", B.liveStep({ blender: false, shown: true }, true, false, true) === "close" && B.liveStep(null, true, false, true) === "close");
check("liveStep: the same layer / a hidden one / Live off = nothing", B.liveStep({ blender: true, shown: true }, true, true, true) === "" && B.liveStep({ blender: true, shown: false }, false, false, true) === "" && B.liveStep({ blender: true, shown: true }, false, false, false) === "");

const BL = src("ext/imageeditdock/pcblendlayer.js"), PL = src("ext/imageeditdock/pcpromptlink.js"), IO = src("ext/imageeditdock/pcimgop.js"), IE = src("ext/imageeditdock/imageedit.js");
check("pins: generateFromScene - the scene, the References docker's pictures ALWAYS (unless Never), each result a new layer above it",
  /async function generateFromScene\(L, text, style\)/.test(BL) && /sceneWithRefs\(c, t, g\.style, L, label, "always"\)/.test(BL) && /keep: L, label, ovr: ovrNow\(\)/.test(BL));
check("pins: the live layer - renderLayersPanel + a look every 0.7 s; ☑ Live + Scene strength in the 🟧 tab",
  /E\.renderLayersPanel = function/.test(BL) && /followPick/.test(BL) && /id="kblLive"/.test(BL) && /id="kblStr"/.test(BL));
check("pins: actionFor - Generate with a Blender layer picked (editor open, no selection) = kind blender; H3TakeGenerate hands it on",
  /op === "generate" && s\.onScreen && s\.open && s\.blender && !s\.hasSel\) return \{ kind: "blender", op, mode: "generate" \}/.test(PL)
  && /act\.op !== "generate" \|\| act\.kind === "blender"/.test(PL) && /E\.blendLayer\.generateFromScene\(E\.layer\(\), text, st\)/.test(PL));
check("pins: the ▾ label ✨ Generate · 🟧 Blender, the chip for Generate too; runAI takes opt.strength + opt.ovr",
  /\(o\.id === "edit" \|\| o\.id === "generate"\) && blender/.test(IO) && /op === "refine" \|\| op === "generate"\)\);/.test(IO) && /opt\.strength/.test(IE) && /if \(opt\.ovr\) req\.ovr/.test(IE));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
