#!/usr/bin/env node
// static/imageedit.js pure helpers (selection + infill math) and lib/infill.js (2.108.0).
// node scripts/test-imageedit.js
const path = require("path"), fs = require("fs"), os = require("os");
const { P, TOOLS } = require(path.join(__dirname, "..", "ext", "imageeditdock", "imageedit.js"));
const IF = require(path.join(__dirname, "..", "lib", "infill"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const ROOT = path.join(__dirname, "..");

check("the six Krita-style selection tools exist: rect, ellipse, lasso, polygon, wand, brush",
  TOOLS.map((t) => t[0]).join() === "rect,ellipse,lasso,poly,wand,brush", TOOLS.map((t) => t[0]));
const W = 40, H = 30;
const r = P.rectMask(5, 5, 15, 12, W, H);
check("rectMask fills [5,15)x[5,12)", P.count(r) === 10 * 7 && r[5 * W + 5] === 255 && r[5 * W + 15] === 0, P.count(r));
check("bbox of it", JSON.stringify(P.bbox(r, W, H)) === JSON.stringify({ x: 5, y: 5, w: 10, h: 7 }), P.bbox(r, W, H));
check("bbox of an empty mask is null", P.bbox(new Uint8Array(W * H), W, H) === null, null);
const e = P.ellipseMask(20, 15, 10, 5, W, H);
check("ellipseMask is inside its box and roughly pi*rx*ry", P.count(e) > 130 && P.count(e) < 175 && e[15 * W + 20] === 255 && e[15 * W + 31] === 0, P.count(e));
const poly = P.polygonMask([[0, 0], [10, 0], [10, 10], [0, 10]], W, H);
check("polygonMask of a square = rectMask of it", P.count(poly) === 100 && poly[0] === 255 && poly[9 * W + 9] === 255 && poly[10 * W + 10] === 0, P.count(poly));
const ctx = P.contextRect({ x: 5, y: 5, w: 10, h: 7 }, W, H, 4, 16);
check("contextRect pads by the margin and snaps the size up to a multiple of 16 inside the picture",
  ctx.w % 16 === 0 && ctx.h % 16 === 0 && ctx.x >= 0 && ctx.y >= 0 && ctx.x + ctx.w <= W && ctx.y + ctx.h <= H && ctx.x <= 1 && ctx.y <= 1, ctx);
const big = P.contextRect({ x: 0, y: 0, w: W, h: H }, W, H, 100, 16);
check("...and never exceeds the picture even when the margin would", big.x === 0 && big.y === 0 && big.w === W && big.h === H, big);
const cm = P.cropMask(r, W, { x: 5, y: 5, w: 10, h: 7 });
check("cropMask cuts the selection to the box", P.count(cm) === 70 && cm.length === 70, P.count(cm));
const fr = P.rectMask(5, 5, 35, 25, W, H), f = P.feather(fr, W, H, 4);
check("feather keeps the centre solid, softens the edge INSIDE, and adds nothing outside",
  f[15 * W + 20] === 255 && f[5 * W + 5] > 0 && f[5 * W + 5] < 255 && f[4 * W + 5] === 0 && f[5 * W + 4] === 0, [f[15 * W + 20], f[5 * W + 5], f[4 * W + 5]]);
check("feather(0) is the mask unchanged", P.feather(r, W, H, 0).every((v, i) => v === r[i]), null);
const g = P.morph(r, W, H, 2), sh = P.morph(r, W, H, -2);
check("grow adds a 2px ring, shrink removes one", P.count(g) === 14 * 11 && P.count(sh) === 6 * 3, [P.count(g), P.count(sh)]);
// wand on a two-colour picture
const rgba = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const left = x < 20; rgba[i] = left ? 200 : 20; rgba[i + 1] = left ? 200 : 20; rgba[i + 2] = left ? 200 : 20; rgba[i + 3] = 255; }
rgba[(3 * W + 3) * 4] = 190;    // a slightly different pixel inside the left half
const wd = P.wand(rgba, W, H, 2, 2, 16, true);
check("magic wand floods the contiguous colour region within tolerance", P.count(wd) === 20 * H && wd[3 * W + 3] === 255 && wd[2 * W + 25] === 0, P.count(wd));
check("...tolerance 0 stops at the slightly different pixel", P.wand(rgba, W, H, 2, 2, 0, true)[3 * W + 3] === 0, null);
check("...non-contiguous (global) mode selects the colour everywhere", P.count(P.wand(rgba, W, H, 2, 2, 16, false)) === 20 * H, null);
// combine modes
const base = P.rectMask(0, 0, 10, 10, W, H), add = P.rectMask(5, 5, 15, 15, W, H);
check("combine add / subtract / replace", P.count(P.combine(Uint8Array.from(base), add, "add")) === 175
  && P.count(P.combine(Uint8Array.from(base), add, "subtract")) === 75 && P.count(P.combine(Uint8Array.from(base), add, "replace")) === 100, null);
// composite: outside the mask untouched, inside replaced, edge blended
const dst = new Uint8ClampedArray(W * H * 4).fill(10), box = { x: 5, y: 5, w: 10, h: 7 };
const src = new Uint8ClampedArray(box.w * box.h * 4).fill(250);
const fm = new Uint8Array(box.w * box.h); fm.fill(255); fm[0] = 128;
P.composite(dst, W, src, box, fm);
check("composite: outside untouched, inside taken from the result, half-weight pixel blended",
  dst[0] === 10 && dst[((8) * W + 10) * 4] === 250 && dst[((5) * W + 5) * 4] === 130 && dst[((5) * W + 5) * 4 + 3] === 255, [dst[0], dst[(8 * W + 10) * 4], dst[(5 * W + 5) * 4]]);

// lib/infill.js workflow choice
const st = (o) => Object.assign({ engine: "comfy", name: "S" }, o);
const k = IF.resolve(st({ arch: "flux2klein9b", workflow: "comfy_workflows/img_flux2_9b_t2i_verified.json" }), ROOT);
// 2.550.0 (Tim: "it generates a new image not a seamless fill/blend like the krita ai does"): a Klein 9B style fills with its OWN t2i graph + a latent noise mask (lib/inpaintLatent.js)
check("infill: a Klein 9B style fills SEAMLESSLY with its own graph (crop + mask, a latent noise mask) - 2.550.0", !!k.graph && k.takesMask === true && k.input === "crop+mask" && /seamless fill/.test(k.note), k.note);
const x = IF.resolve(st({ arch: "sdxl", workflow: "comfy_workflows/img_flux2_klein_9b_ckpt_t2i.json" }), ROOT);
check("infill: a checkpoint style uses Tim's img_inpaint_sdxl.json export — one slot, the hole is the alpha, self-contained",
  x.workflow.endsWith("img_inpaint_sdxl.json") && x.slots === 1 && x.input === "rgba" && x.selfContained === true, x);
const d = fs.mkdtempSync(path.join(os.tmpdir(), "inf-")); fs.mkdirSync(path.join(d, "comfy_workflows"));
fs.writeFileSync(path.join(d, "comfy_workflows", "mine_inpaint.json"), JSON.stringify({ 1: { class_type: "LoadImage", inputs: {} }, 2: { class_type: "LoadImage", inputs: {} } }));
const own = IF.resolve(st({ arch: "sdxl", workflow: "x.json", inpaint_workflow: "comfy_workflows/mine_inpaint.json" }), d);
check("infill: a style's own inpaint_workflow always wins (two slots = crop + mask)", own.workflow === "comfy_workflows/mine_inpaint.json" && own.slots === 2 && own.input === "crop+mask", own);
const ff = IF.resolve(st({ arch: "flux", name: "FLUX Fill inpaint", workflow: "comfy_workflows/img_flux_fill_inpaint.json", inpaint_workflow: "comfy_workflows/img_flux_fill_inpaint.json" }), ROOT);
check("infill: the FLUX Fill style — one slot (alpha = hole), NOT self-contained (its single UNET loader takes the style's model + LoRAs)",
  ff.workflow.endsWith("img_flux_fill_inpaint.json") && ff.input === "rgba" && ff.selfContained === false && /LoRAs are applied/.test(ff.note), ff);
check("infill: modelLoaders counts one for FLUX Fill and three for the SDXL export",
  IF.modelLoaders(ROOT, "comfy_workflows/img_flux_fill_inpaint.json") === 1 && IF.modelLoaders(ROOT, "comfy_workflows/img_inpaint_sdxl.json") === 3, null);
check("infill: an sd-cli style is refused in words", (() => { try { IF.resolve({ engine: "sdcli", name: "old" }, ROOT); return false; } catch (e) { return /sd-cli/.test(e.message); } })(), null);
check("infill: a UNET style with a text-to-image graph fills seamlessly through it (2.550.0); one whose graph is not there is refused with the fix named",
  !!IF.resolve(st({ arch: "flux", workflow: "comfy_workflows/img_flux2_klein_9b_t2i.json", model: "flux1-dev.safetensors" }), ROOT).graph
  && (() => { try { IF.resolve(st({ arch: "flux", workflow: "comfy_workflows/nope_t2i.json", model: "flux1-dev.safetensors" }), ROOT); return false; } catch (e) { return /inpaint_workflow/.test(e.message); } })(), null);
const wf = JSON.parse(fs.readFileSync(path.join(ROOT, "comfy_workflows", "img_inpaint_sdxl.json"), "utf8"));
check("the shipped inpaint graph (Tim's export): inpaint UNet + checkpoint + refiner, ONE LoadImage, VAEEncodeForInpaint fed by its MASK output",
  Object.values(wf).filter((n) => n && n.class_type === "LoadImage").length === 1 && wf["30"].class_type === "UNETLoader"
  && wf["54"].class_type === "KSamplerAdvanced" && JSON.stringify(wf["26"].inputs.mask) === '["20",1]', null);
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
