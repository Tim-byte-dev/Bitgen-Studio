#!/usr/bin/env node
/* bitGen Studio — 2.676.0: THE IMAGE PREVIEW'S 🎨 STYLE (static/lbrestyle.js LOOKS / promptFor / fit / pickHow;
 * lib/imgOverride.js - Basic Settings' Override style through /api/aiedit). The clicks: scripts/test-ui676-ui.js.
 * Tim (verbatim): "in the image preview dialog, add a button with a dropdown to change the style of the picture,
 * photoreal, pixar, 2.5D, anime,cartoon. use the style chosen in prompt unless overide is checked to generate the image
 * from the image being previewed" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = require(path.join(ROOT, "static", "lbrestyle.js")), O = require(path.join(ROOT, "lib", "imgOverride.js"));
check("the looks: 📷 Photoreal, 🧸 Pixar, 🧊 2.5D, 🌸 Anime, 🖍 Cartoon", R.LOOKS.map((l) => l.label).join("|") === "📷 Photoreal|🧸 Pixar|🧊 2.5D|🌸 Anime|🖍 Cartoon");
const pe = R.promptFor("pixar", "edit", "a girl on a bike");
check("an edit model: an instruction to restyle + keep the composition, subjects, faces, poses (its own prompt not needed)", /^Turn this into a Pixar-style 3D animated film still/.test(pe) && /Keep the same picture/.test(pe) && !/girl on a bike/.test(pe), pe);
const pr = R.promptFor("anime", "refine", "a girl on a bike, sunset");
check("a Refine (SDXL / FLUX.1): the look's words + the picture's own prompt; a strength that changes the look", /^anime style, .*, a girl on a bike, sunset$/.test(pr) && R.LOOKS.every((l) => l.strength >= 50 && l.strength <= 80), pr);
check("the size: ~1 MP, the picture's shape, multiples of 16", JSON.stringify(R.fit(1920, 1080)) === JSON.stringify({ w: 1360, h: 768 }) && JSON.stringify(R.fit(1024, 1024)) === JSON.stringify({ w: 1024, h: 1024 }) && R.fit(500, 2000).w % 16 === 0, [R.fit(1920, 1080), R.fit(500, 2000)]);
const E = { edit: [{ id: "klein" }], inpaint: [{ id: "sdxl", refine: true }, { id: "fill", refine: false }] };
check("how: an edit model = edit, an SDXL style = refine, one that cannot = null (said)", R.pickHow("klein", E) === "edit" && R.pickHow("sdxl", E) === "refine" && R.pickHow("fill", E) === null && R.pickHow("other", E) === null && R.pickHow("", E) === null);
// the override
const fake = { styles: { applyLoraWeights: (s, w) => Object.assign({}, s, { loras: (s.loras || []).map((l) => Object.assign({}, l, w && w[l.name] != null ? { weight: w[l.name] } : {})) }) },
  modelFit: { fit: (s, m) => ({ ok: /sdxl/.test(m) }), note: (s, mf, m) => m + " does not fit" }, tempLoras: { normalize: (a) => (Array.isArray(a) ? a : []), merge: (a, b) => (a || []).concat(b) } };
const st = { id: "s", model: "own.safetensors", loras: [{ name: "detail", weight: 1 }] };
const a = O.apply(st, O.parse(JSON.stringify({ steps: 30, cfg: 5.5, model: "my_sdxl.safetensors", lora_weights: { detail: 0.4 }, extra_loras: [{ name: "x", weight: 0.7 }], mm_override: true })), fake);
check("Override style: steps / cfg to the job, the checkpoint (where it fits), LoRA strengths + temporary LoRAs, the Model manager's pick", a.steps === 30 && a.cfg === 5.5 && a.styled.model === "my_sdxl.safetensors" && a.styled.model_override && a.styled.loras[0].weight === 0.4 && a.styled.loras.length === 2 && a.styled.mm_override, a);
const b2 = O.apply(st, { model: "flux_klein.safetensors" }, fake);
check("…a checkpoint that does not fit the style's workflow: left out, the note says why; nothing sent = the style's own", b2.styled.model === "own.safetensors" && /does not fit/.test(b2.note) && b2.steps === null && O.parse("") === null && O.parse("{bad") === null && O.parse("[1]") === null);
const AE = read("routes/aiedit.js"), H = read("static/index.html");
check("routes/aiedit.js applies ovr (steps / cfg on the job, the style copy) - never server.js; index.html loads lbrestyle.js", /require\("\.\.\/lib\/imgOverride"\)\.parse\(b\.ovr\)/.test(AE) && /if \(ov\.steps != null\) p\.steps = ov\.steps/.test(AE) && /<script src="\/static\/lbrestyle\.js">/.test(H) && !/imgOverride/.test(read("misc/server.js")));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
