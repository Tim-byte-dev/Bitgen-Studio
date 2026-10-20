#!/usr/bin/env node
/* bitGen Studio — 2.550.0 units: a seamless fill with any style's own graph (lib/inpaintLatent.js, lib/infill.js), the
 * transform's skew (pctools.js xform / skewFor), the rigged-figure pick, paste / move, the docker menu (wiring).
 * Tim: "when a selection is made, it generates a new image not a seamless fill/blend like the krita ai does ... make the
 * move tool move the selection or layer, add a transform tool, ctrl T, to scale, rotate, skew ... i can't select objects
 * in a blender scene ... add a right click context menu when user right clicks the new titlebar to delete docker". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const IL = require(path.join(ROOT, "lib", "inpaintLatent.js"));
const IF = require(path.join(ROOT, "lib", "infill.js"));
const PT = require(path.join(ROOT, "ext", "imageeditdock", "pctools.js"));

const t2i = {
  "3": { class_type: "KSampler", inputs: { model: ["10", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0], denoise: 1 } },
  "5": { class_type: "EmptySD3LatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "x", clip: ["11", 0] } }, "7": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["11", 0] } },
  "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["12", 0] } }, "9": { class_type: "SaveImage", inputs: { images: ["8", 0] } },
  "10": { class_type: "UNETLoader", inputs: { unet_name: "m.safetensors" } }, "11": { class_type: "CLIPLoader", inputs: {} }, "12": { class_type: "VAELoader", inputs: {} } };
const g = IL.latentMaskGraph(t2i);
const byCls = (G, c) => Object.entries(G).filter(([, v]) => v.class_type === c);
check("latentMaskGraph: two LoadImage nodes with the LOWEST ids (crop 1, mask 2 - the patcher fills slots in id order)", g && g["1"].class_type === "LoadImage" && g["2"].class_type === "LoadImage" && byCls(g, "LoadImage").length === 2, g && Object.keys(g));
const enc = byCls(g, "VAEEncode")[0], noise = byCls(g, "SetLatentNoiseMask")[0], grow = byCls(g, "GrowMask")[0], dd = byCls(g, "DifferentialDiffusion")[0];
check("...the crop encoded with the graph's own VAE, the mask (LoadImage #2's MASK) grown, a noise mask on the latent; the sampler reads it",
  enc[1].inputs.pixels[0] === "1" && enc[1].inputs.vae[0] === "12" && grow[1].inputs.mask.join() === "2,1" && noise[1].inputs.samples[0] === enc[0] && noise[1].inputs.mask[0] === grow[0] && g["3"].inputs.latent_image[0] === noise[0]);
check("...the model through DifferentialDiffusion (a soft change at the edge); the empty latent gone", dd && dd[1].inputs.model.join() === "10,0" && g["3"].inputs.model[0] === dd[0] && !g["5"]);
const low = JSON.parse(JSON.stringify(t2i)); low["1"] = { class_type: "Note", inputs: {} };
const g2 = IL.latentMaskGraph(low);
check("ids 1 / 2 taken: the graph is renumbered (+2) and still wired", g2 && g2["1"].class_type === "LoadImage" && g2["2"].class_type === "LoadImage" && g2["5"].class_type === "KSampler" && byCls(g2, "SetLatentNoiseMask").length === 1, g2 && Object.keys(g2));
check("no empty latent / LoadImage nodes of its own / no VAEDecode -> null (the old ways)",
  IL.latentMaskGraph({ "1": { class_type: "KSampler", inputs: {} } }) === null && IL.latentMaskGraph(Object.assign({}, t2i, { "20": { class_type: "LoadImage", inputs: {} } })) === null && IL.latentMaskGraph(null) === null);
const kr = IF.resolve({ engine: "comfy", name: "Krea 2 Turbo", arch: "krea2", workflow: "comfy_workflows/img_krea2_turbo_t2i.json" }, ROOT);
check("infill.resolve: Krea 2 (it had no inpaint path) = a seamless fill with its own graph, crop + mask, the style's model applied", !!kr.graph && kr.input === "crop+mask" && kr.takesMask && !kr.selfContained && /seamless fill/.test(kr.note), kr.note);

const T = { box: { x: 0, y: 0, w: 100, h: 50 }, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, kx: 0.5, ky: 0 };
const m = PT.xform(T), at = PT.apply(m, 50, 50), at0 = PT.apply(PT.xform(Object.assign({}, T, { kx: 0 })), 50, 50);
check("xform with a skew: the bottom middle (y 25 below the centre) moves 12.5 along at kx 0.5; no skew = unchanged", Math.abs(at[0] - 62.5) < 1e-9 && at[1] === 50 && at0[0] === 50);
const s1 = PT.skewFor({ kind: "edge", i: 1, j: 2 }, 20, 0, { rot: 0, sx: 1, sy: 1, kx: 0, ky: 0 }, T.box), s2 = PT.skewFor({ kind: "edge", i: 2, j: 1 }, 0, 10, { rot: 0, sx: 1, sy: 1, kx: 0, ky: 0 }, T.box);
check("skewFor: the bottom edge 20 px right = kx 0.8 (the edge follows the pointer); the right edge 10 px down = ky 0.2", Math.abs(s1.kx - 0.8) < 1e-9 && s1.ky === 0 && Math.abs(s2.ky - 0.2) < 1e-9 && s2.kx === 0, { s1, s2 });

const BV = rd("ext", "timelinedock", "blendview.js"), IE = rd("ext", "imageeditdock", "imageedit.js"), UI = rd("ext", "imageeditdock", "pcui.js"), PL = rd("ext", "imageeditdock", "pcpromptlink.js"), DG = rd("static", "dockgroup.js"), RA = rd("routes", "aiedit.js");
check("blendview: a skinned mesh picks its armature (pickOwner), a posed-box fallback for the ray, the object list redirects too",
  /function pickOwner\(o\)/.test(BV) && /o\.skeleton\.bones\[0\]/.test(BV) && /m\.computeBoundingBox\(\)/.test(BV) && /is moved by its rig/.test(BV));
check("paste drops the selection; the Move tool moves the whole layer when the selection holds none of its pixels; ⤡ Transform on the Move tool's bar",
  /if \(E\.hasSel && E\.hasSel\(\) && E\.deselect\) E\.deselect\(\);/.test(UI) && /if \(!alphaBox\(c\)\) \{ g\.clearRect\(0, 0, S\.w, S\.h\); g\.drawImage\(A\.canvas, 0, 0\); sc = null; \}/.test(IE) && /id="pcXform"/.test(IE));
check("Generate with a selection sends the prompt docker's style when it can fill; the route writes the fill graph", /style: fillStyle/.test(PL) && /opt\.style \|\| \$\("ieStyle"\)\.value/.test(IE) && /aiedit-\$\{stamp\}-fill\.json/.test(RA));
check("the ▣ docker's title bars (floating + permanent) open the menu on a right-click; a permanent one takes room (flex) where the window was",
  /bar\.addEventListener\("contextmenu"/.test(DG) && /head\.oncontextmenu = /.test(DG) && /🗑 Delete docker/.test(DG) && /d\.style\.flex = "1 1 " \+ r\.perm\.h \+ "px"/.test(DG) && /function placeFor\(r, main, keptId\)/.test(DG));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
