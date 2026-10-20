#!/usr/bin/env node
/* bitGen Studio — 2.552.0 units: the selection fill and Edit made like the Krita AI plugin's own code (Tim sent its
 * source: ai_diffusion/backend/workflow.py inpaint() / refine_region(), model/model.py calc_selection_pre_process(),
 * backend/resolution.py CheckpointResolution).
 *   - mask sizes by the selection's size (P.maskParams: feather 10 % of the diagonal, >= 32 px; grow 4 + feather / 2)
 *     sent in the render's pixels and used by the fill graph (lib/inpaintLatent.js opts)
 *   - a small crop rendered bigger (P.renderSize), a colour match around the selection (P.colorMatch)
 *   - Generate at full strength again (Krita), Remove 0.9
 *   - an Edit in a selection = the picture as the starting latent under the noise mask (editLatentGraph)
 * Tim: "this is krita's ai code i downloaded". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const IL = require(path.join(ROOT, "lib", "inpaintLatent.js"));
const A = require(path.join(ROOT, "lib", "aiEdit.js"));
// the editor's pure helpers (its P object) - pulled out of the file
const IEsrc = rd("ext", "imageeditdock", "imageedit.js");
const P = new Function("P", IEsrc.slice(IEsrc.indexOf("P.maskParams = function"), IEsrc.indexOf("/** The size to RENDER a crop at")) + "; return P;")({});
const byCls = (G, c) => Object.entries(G).filter(([, v]) => v.class_type === c);
const isLink = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string";
const dangling = (G) => { const bad = []; for (const [k, n] of Object.entries(G)) for (const [i, v] of Object.entries(n.inputs || {})) if (isLink(v) && !G[v[0]]) bad.push(`${k}.${i}->${v[0]}`); return bad; };

/* 1 Krita's sizes */
const m1 = P.maskParams({ w: 200, h: 100 }, 1, 24), m2 = P.maskParams({ w: 600, h: 600 }, 1), m3 = P.maskParams({ w: 600, h: 600 }, 0.5);
check("maskParams: a 200x100 selection = feather 32 (the minimum), grow 20, reach 36, the user's blend 24", m1.feather === 32 && m1.grow === 20 && m1.reach === 36 && m1.blend === 24, m1);
check("...600x600 = 10 % of the diagonal (85), grow 46, blend 25 (Krita's default); half strength halves the feather", m2.feather === 85 && m2.grow === 46 && m2.blend === 25 && m3.feather === 42, { m2, m3 });
const r1 = P.renderSize(512, 512, 1048576, 16, 0.75 * 1048576), r2 = P.renderSize(2000, 2000, 1048576, 16, 0.75 * 1048576), r3 = P.renderSize(64, 64, 1048576, 16, 0.75 * 1048576), r4 = P.renderSize(512, 512, 1048576, 16, 0);
check("renderSize: a 512 px crop renders at ~880 (>= 0.75 MP, Krita renders at the model's size), 2000 px down to the budget, at most 4x, no minimum = as it is",
  r1.w === 880 && r1.scale > 1.7 && r2.w === 1024 && r3.w === 256 && r4.w === 512, { r1, r2, r3, r4 });
// colour match: the result is 40 brighter and a little greener everywhere - outside the selection it is matched back
const W = 40, H = 40, ref = new Uint8ClampedArray(W * H * 4), dst = new Uint8ClampedArray(W * H * 4), ex = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) { const v = 60 + (i % 50); ref.set([v, v + 20, 120, 255], i * 4); dst.set([v + 40, v + 60, 160, 255], i * 4); if (i % W > 15 && i % W < 25) ex[i] = 255; }
const ok = P.colorMatch(dst, ref, ex, W, H, 1);
check("colorMatch: the colours around the selection (exclude = 0) match the original's mean and spread again", ok && Math.abs(dst[0] - ref[0]) <= 1 && Math.abs(dst[1] - ref[1]) <= 1 && Math.abs(dst[2] - ref[2]) <= 1, { d: Array.from(dst.slice(0, 3)), r: Array.from(ref.slice(0, 3)) });
check("...nothing around the selection to match = left alone", P.colorMatch(new Uint8ClampedArray(16), new Uint8ClampedArray(16), new Uint8Array(4).fill(255), 2, 2) === false);

/* 2 the fill graph takes the sizes */
const t2i = JSON.parse(rd("comfy_workflows", "img_krea2_turbo_t2i.json"));
const g = IL.latentMaskGraph(t2i, { grow: 20, feather: 32 }), g0 = IL.latentMaskGraph(t2i), gb = IL.blurFor({ grow: 300, feather: 100 });
check("latentMaskGraph(opts): GrowMask 20, ImageBlur radius 16 / sigma 8 (feather 32); without opts the old 8 / 12 / 6; blur capped at 31 / 10",
  byCls(g, "GrowMask")[0][1].inputs.expand === 20 && byCls(g, "ImageBlur")[0][1].inputs.blur_radius === 16 && byCls(g, "ImageBlur")[0][1].inputs.sigma === 8
  && byCls(g0, "GrowMask")[0][1].inputs.expand === 8 && byCls(g0, "ImageBlur")[0][1].inputs.blur_radius === 12 && gb.radius === 31 && gb.sigma === 10 && gb.grow === 256);
const style = { engine: "comfy", name: "Krea 2 Turbo", arch: "krea2", workflow: "comfy_workflows/img_krea2_turbo_t2i.json" };
const pg = A.plan(style, { mode: "generate", prompt: "a dog", mask_grow: "30", mask_feather: "40" }, ROOT), pm = A.plan(style, { mode: "remove", prompt: "" }, ROOT);
check("plan: Generate at full strength (Krita runs a plain model at 1.0), Remove 0.9; the request's mask sizes reach the graph",
  pg.denoise == null && pm.denoise === 0.9 && byCls(pg.graph, "GrowMask")[0][1].inputs.expand === 30 && byCls(pg.graph, "ImageBlur")[0][1].inputs.blur_radius === 20, { d: pg.denoise });
check("maskOpts: numbers only, capped; none = null", JSON.stringify(A.maskOpts({ mask_grow: "12", mask_feather: "x" })) === '{"grow":12,"feather":24}' && A.maskOpts({}) === null && A.maskOpts({ mask_grow: 9999 }).grow === 512);

/* 3 an Edit in a selection */
for (const f of ["img_qwen_edit_2511", "img_flux_kontext_edit", "img_flux2_klein_edit_9b", "img_flux2_9b_edit_verified", "img_flux3_klein_edit"]) {
  const src = JSON.parse(rd("comfy_workflows", f + ".json"));
  const e = IL.editLatentGraph(src, { grow: 20, feather: 32 });
  if (!e) { check(`editLatentGraph ${f}`, false, "null"); continue; }
  const slots = Object.keys(e).filter((k) => /loadimage/i.test(e[k].class_type)).sort((a, b) => (/^\d+$/.test(a) ? +a : 1e9) - (/^\d+$/.test(b) ? +b : 1e9));
  const noise = byCls(e, "SetLatentNoiseMask")[0], enc = e[noise[1].inputs.samples[0]];
  const samp = Object.keys(e).filter((k) => e[k].inputs && isLink(e[k].inputs.latent_image));
  let pix = enc.inputs.pixels, hops = 0; while (pix && pix[0] !== "1" && hops++ < 5) pix = (e[pix[0]].inputs || {}).image;
  check(`editLatentGraph ${f}: the picture is slot "1", the mask "2" (the others after); the sampler starts from the picture's own encode under the soft mask; differential diffusion; no broken links`,
    slots[0] === "1" && slots[1] === "2" && slots.slice(2).every((k) => !/^\d+$/.test(k) || +k > 2) && samp.every((k) => e[k].inputs.latent_image[0] === noise[0])
    && pix && pix[0] === "1" && byCls(e, "DifferentialDiffusion").length >= 1 && byCls(e, "GrowMask")[0][1].inputs.mask.join() === "2,1"
    && dangling(e).length === 0 && !byCls(e, "EmptyFlux2LatentImage").length, { slots, samp, d: dangling(e) });
}
check("editLatentGraph: no picture slot / an inpaint graph already = null (the old whole-crop edit)",
  IL.editLatentGraph({ "1": { class_type: "KSampler", inputs: { latent_image: ["2", 0] } } }) === null
  && IL.editLatentGraph({ "1": { class_type: "LoadImage", inputs: {} }, "2": { class_type: "VAEEncodeForInpaint", inputs: { pixels: ["1", 0] } } }) === null);
const em = A.editMasked({ workflow: "comfy_workflows/img_qwen_edit_2511.json" }, null, ROOT, { mask_grow: 10, mask_feather: 20 });
const rp = A.editMasked({ workflow: "x" }, A.withQwenPlusSlots(JSON.parse(rd("comfy_workflows", "img_qwen_edit_2511.json")), 2), ROOT, {});
const rslots = rp && Object.keys(rp.graph).filter((k) => /loadimage/i.test(rp.graph[k].class_type)).sort((a, b) => +a - +b);
check("aiEdit.editMasked: the style's edit graph (or the reference picture's graph - its Picture 2 slot sorts after the mask)",
  em && /only the selection changes/.test(em.note) && byCls(em.graph, "GrowMask")[0][1].inputs.expand === 10 && rslots && rslots.length === 3 && rslots[0] === "1" && rslots[1] === "2", rslots);

/* 4 wiring */
const RA = rd("routes", "aiedit.js"), IE = rd("ext", "imageeditdock", "imageedit.js");
check("the route: an Edit in a selection runs editMasked, images [crop, mask, (ref)], the answer says soft",
  /editMask = aiEdit\.editMasked\(plan, refGraph, core\.BASE, b\)/.test(RA) && /editMask \? \[names\.crop, names\.mask\]\.concat\(names\.ref \? \[names\.ref\] : \[\]\)/.test(RA) && /soft: !!\(editMask \|\| \(plan\.graph && plan\.mode !== "edit"\)\)/.test(RA) && /b\.whole !== "1"/.test(RA));
check("the editor: renderSize with a 0.75 MP floor (not for Edit), Krita's mask sizes in render pixels, whole flagged; the result blended out to the reach (soft) and colour-matched",
  /P\.renderSize\(box\.w, box\.h, S\.res \* 1048576, 16, mode === "edit" \|\| viaEdit \? 0 : 0\.75 \* 1048576\)/.test(IE) && /req\.mask_grow = Math\.round\(mp\.grow \* fit\.scale\)/.test(IE) && /if \(whole\) req\.whole = "1"/.test(IE)
  && /ctxInfo\.soft = !!r\.soft && !ctxInfo\.into && !clip/.test(IE) && /P\.morph\(I\.cropMask, W, H, I\.mp\.reach\)/.test(IE) && /if \(grown && I\.orig && I\.orig\.length === d\.data\.length\) P\.colorMatch\(d\.data, I\.orig, grown, W, H, 1\)/.test(IE));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
