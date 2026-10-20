#!/usr/bin/env node
/* bitGen Studio — 2.551.0 units: the Krita-AI-like fill (more context, a pre-filled selection, a soft mask, a start just
 * below full noise) and Free Transform's middle handles skewing.
 * Tim: "when user hovers over middle handle in image-editor, change tranform icon to skew then skew like photoshop instead
 * of rotate. can you check to see how https://github.com/Acly/krita-ai-diffusion does the fill, add, edit and generate in
 * selection, i think they may use img2img infill. kritas works well but ours just generates random images". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const A = require(path.join(ROOT, "lib", "aiEdit.js"));
const IL = require(path.join(ROOT, "lib", "inpaintLatent.js"));
const IE = rd("ext", "imageeditdock", "imageedit.js"), PT = rd("ext", "imageeditdock", "pctools.js");
// P.autoMargin lives in the editor's pure part - pull it out
const am = new Function("P", IE.slice(IE.indexOf("P.autoMargin = function"), IE.indexOf("P.contextRect = function")) + "; return P.autoMargin;")({});
check("autoMargin: at least the user's margin, 3/4 of the long side, and about 512 px across in all", am({ w: 80, h: 80 }, 64) === 216 && am({ w: 400, h: 200 }, 64) === 300 && am({ w: 1000, h: 900 }, 64) === 750 && am({ w: 10, h: 10 }, 400) === 400);
const st = { engine: "comfy", name: "Krea 2 Turbo", arch: "krea2", workflow: "comfy_workflows/img_krea2_turbo_t2i.json" };
const pg = A.plan(st, { mode: "generate", prompt: "a hat", strength: 100 }, ROOT), pr = A.plan(st, { mode: "refine", prompt: "a hat", strength: 40 }, ROOT), pm = A.plan(st, { mode: "remove", prompt: "" }, ROOT);
check("a style not trained to inpaint: (2.552.0, as Krita) Generate at full strength, Remove at FILL_DENOISE (0.9) from the pre-filled picture; Refine keeps its strength", A.FILL_DENOISE === 0.9 && pg.denoise == null && pm.denoise === 0.9 && pr.denoise === 0.4 && !!pg.graph, { pg: pg.denoise, pr: pr.denoise, pm: pm.denoise });
const g = IL.latentMaskGraph(JSON.parse(rd("comfy_workflows", "img_krea2_turbo_t2i.json")));
const by = (c) => Object.entries(g).filter(([, v]) => v.class_type === c);
check("the fill graph's mask: grown 8, MaskToImage -> ImageBlur (12 / 6) -> ImageToMask -> SetLatentNoiseMask (a soft edge for DifferentialDiffusion)",
  by("GrowMask")[0][1].inputs.expand === 8 && by("ImageBlur")[0][1].inputs.blur_radius === 12 && by("ImageToMask")[0][1].inputs.channel === "red" && by("SetLatentNoiseMask")[0][1].inputs.mask[0] === by("ImageToMask")[0][0] && by("DifferentialDiffusion").length === 1);
check("the editor: (2.555.0) Generate / Remove take Krita's context, Refine its mask bounds; Generate pre-fills by Krita's kind (Add content grey, Fill blur, Expand the border)",
  /: mode === "generate" \|\| mode === "remove" \|\| mode === "background" \? KB\.context/.test(IE) && /: fitSel \|\| mode === "refine" \? KB\.mask/.test(IE) && /kind === "add"\) \{ P\.maskedFill\(fid\.data, cropMask/.test(IE) && /kind === "expand"\) \{ P\.fillHole\(fid\.data, cropMask, box\.w, box\.h\);/.test(IE));
check("Free Transform: a middle handle skews (no key), Shift / Alt + it stretches; the skew / rotate cursors are SVGs",
  /skew: h\.kind === "edge" && !e\.shiftKey && !e\.altKey/.test(PT) && /const SKEW_H = svgCur\(/.test(PT) && /const ROT_CURSOR = svgCur\(/.test(PT) && /\(h\.i === 1 \? SKEW_H : SKEW_V\)/.test(PT));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
