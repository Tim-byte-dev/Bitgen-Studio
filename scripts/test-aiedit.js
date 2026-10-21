#!/usr/bin/env node
/* bitGen Studio — the image editor's ✨ AI + brushes + selection (2.332.0).
 *
 * Tim: "we just need about 20 brush presets, selections tools are the most
 * important, to select and edit via qwen edit, kontext or regenerate that
 * portion like krita ai diffusion does".
 *   node scripts/test-aiedit.js
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };

const A = require("../lib/aiEdit");
const styles = require("../lib/styles");
const { P, TOOLS, PAINT, MODES } = require("../ext/imageeditdock/imageedit.js");
const B = require("../ext/imageeditdock/brushes.js");

/* ---------------- the starters + engines ---------------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aie-"));
styles.seedStarters(dir);
const list = styles.read(dir, "image");
const Q = list.find((s) => s.name === "Qwen Image Edit 2511"), K = list.find((s) => s.name === "FLUX.1 Kontext edit");
check("starters: Qwen Image Edit 2511 (4 steps, cfg 1, the Lightning LoRA in slot 1) and FLUX.1 Kontext edit",
  Q && K && Q.steps === 4 && Q.cfg === 1 && Q.loras[0].path === "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors"
  && Q.workflow.endsWith("img_qwen_edit_2511.json") && K.workflow.endsWith("img_flux_kontext_edit.json"), [Q, K]);
const E = A.engines(list, ROOT);
const en = (arr) => arr.map((x) => x.name);
check("engines: the edit models are Qwen, Kontext and the Klein edit graphs; none of the inpaint-only styles",
  ["Qwen Image Edit 2511", "FLUX.1 Kontext edit", "FLUX.2 Klein 9B edit"].every((n) => en(E.edit).includes(n))
  && !en(E.edit).includes("SDXL") && !en(E.edit).includes("FLUX Fill inpaint"), en(E.edit));
check("engines: FLUX Fill inpaint + SDXL regenerate AND refine; Klein regenerates but cannot refine; Qwen/Kontext are not inpaint styles",
  E.inpaint.find((x) => x.name === "FLUX Fill inpaint").refine && E.inpaint.find((x) => x.name === "SDXL").refine
  && E.inpaint.find((x) => x.name === "FLUX.2 Klein 9B edit").refine === false
  && !en(E.inpaint).includes("Qwen Image Edit 2511") && !en(E.inpaint).includes("FLUX.1 Kontext edit"), E.inpaint);
check("engines: defaults - FLUX Fill inpaint to regenerate, Qwen to edit",
  E.defaults.inpaint === list.find((s) => s.name === "FLUX Fill inpaint").id && E.defaults.edit === Q.id, E.defaults);
check("isEditGraph: the Qwen + Kontext + Klein edit graphs yes; the FLUX Fill inpaint graph (Kontext UNET but InpaintModelConditioning) no",
  A.isEditGraph(ROOT, "comfy_workflows/img_qwen_edit_2511.json") && A.isEditGraph(ROOT, "comfy_workflows/img_flux_kontext_edit.json")
  && A.isEditGraph(ROOT, "comfy_workflows/img_flux2_9b_edit_verified.json") && !A.isEditGraph(ROOT, "comfy_workflows/img_flux_fill_inpaint.json")
  && !A.isEditGraph(ROOT, "comfy_workflows/img_sdxl_t2i.json"));

/* ---------------- plan() ---------------- */
const SD = list.find((s) => s.name === "SDXL"), FF = list.find((s) => s.name === "FLUX Fill inpaint"), KL = list.find((s) => s.name === "FLUX.2 Klein 9B edit");
const p1 = A.plan(FF, { mode: "generate", prompt: "a lamp" }, ROOT);
check("plan generate: the style's inpaint graph, no denoise (100 %)", p1.workflow.endsWith("img_flux_fill_inpaint.json") && p1.denoise === null && p1.input === "rgba", p1);
const p2 = A.plan(SD, { mode: "refine", prompt: "a lamp", strength: 35 }, ROOT);
check("plan refine: denoise = strength / 100 through the SDXL inpaint export", p2.denoise === 0.35 && p2.workflow.endsWith("img_inpaint_sdxl.json") && p2.selfContained, p2);
check("plan refine: the strength is clamped to 5..95 %", A.plan(SD, { mode: "refine", prompt: "x", strength: 180 }, ROOT).denoise === 0.95
  && A.plan(SD, { mode: "refine", prompt: "x", strength: 1 }, ROOT).denoise === 0.05);
check("plan refine: refused for a graph that regenerates the whole crop (Klein edit)", throws(() => A.plan(KL, { mode: "refine", prompt: "x" }, ROOT), /Refine needs an inpaint graph/));
const p3 = A.plan(SD, { mode: "remove", prompt: "" }, ROOT);
check("plan remove: an empty prompt becomes 'continue the surroundings' + an object negative", p3.prompt === A.REMOVE_PROMPT && p3.negative === A.REMOVE_NEGATIVE, p3);
check("plan remove: a prompt the user wrote is kept", A.plan(SD, { mode: "remove", prompt: "brick wall" }, ROOT).prompt === "brick wall");
const p4 = A.plan(Q, { mode: "edit", prompt: "make it night" }, ROOT);
check("plan edit: Qwen - its own graph, the crop alone, no denoise", p4.workflow.endsWith("img_qwen_edit_2511.json") && p4.input === "crop" && p4.denoise === null && p4.mode === "edit", p4);
check("plan edit: a Klein 9B t2i style swaps to its edit sibling", /edit/.test(A.plan(list.find((s) => s.name === "FLUX.2 Klein 9B"), { mode: "edit", prompt: "x" }, ROOT).workflow));
check("plan edit: SDXL cannot follow an instruction - refused in words", throws(() => A.plan(SD, { mode: "edit", prompt: "x" }, ROOT), /cannot follow an edit instruction/));
check("plan edit: no instruction = refused", throws(() => A.plan(Q, { mode: "edit", prompt: " " }, ROOT), /edit instruction/));
check("plan generate: no prompt = refused", throws(() => A.plan(FF, { mode: "generate" }, ROOT), /prompt box/));
check("plan: an unknown mode is generate", A.plan(FF, { mode: "zzz", prompt: "a" }, ROOT).mode === "generate");
check("count: 1..4", A.count(0) === 1 && A.count(9) === 4 && A.count("3") === 3);

/* ---------------- the graphs through the real patcher (python) ---------------- */
const py = spawnSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C
out = {}
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_qwen_edit_2511.json"))})
r = C.roles(g)
g2, rep = C.patch(g, {"loras": [{"path": "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors", "weight": 1}], "steps": 4, "cfg": 1}, {"prompt": "make it red", "images": ["up.png"], "seed": 7})
out["qwen"] = {"pos": r["positive"], "neg": r["negative"], "slots": r["image_slots"], "prompt": g2["9"]["inputs"]["value"],
               "img": g2["1"]["inputs"]["image"], "lora": g2["6"]["inputs"]["lora_name"], "seed": g2["15"]["inputs"]["seed"]}
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_flux_kontext_edit.json"))})
r = C.roles(g)
g2, rep = C.patch(g, {}, {"prompt": "make it red", "images": ["up.png"], "seed": 7, "negative": "blurry"})
out["kontext"] = {"pos": r["positive"], "zeroed": r["zeroed_negative"], "text": g2["6"]["inputs"]["text"], "img": g2["1"]["inputs"]["image"]}
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_inpaint_sdxl.json"))})
g2, rep = C.patch(g, {}, {"prompt": "x", "images": ["up.png"], "seed": 1, "denoise": 0.3})
cls = sorted(set(v["class_type"] for v in g2.values()))
out["sdxl"] = {"cls": cls, "denoise": g2["3"]["inputs"]["denoise"], "rep": [l for l in rep if "strength" in l],
               "nm": g2["26"]["inputs"]}
g2, rep = C.patch(g, {}, {"prompt": "x", "images": ["up.png"], "seed": 1, "denoise": 1})
out["sdxl_full"] = sorted(set(v["class_type"] for v in g2.values()))
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_flux_fill_inpaint.json"))})
g2, rep = C.patch(g, {}, {"prompt": "x", "images": ["up.png"], "seed": 1, "denoise": 0.5})
out["fill"] = [v["inputs"].get("denoise") for v in g2.values() if v["class_type"] == "KSampler"]
g2, rep = C.patch(g, {}, {"prompt": "x", "images": ["up.png"], "seed": 1})
out["fill_none"] = [v["inputs"].get("denoise") for v in g2.values() if v["class_type"] == "KSampler"]
print(json.dumps(out))
`], { encoding: "utf8" });
let R = null;
try { R = JSON.parse(py.stdout); } catch { R = null; }
check("patcher: ran", !!R, py.stderr.slice(-800));
if (R) {
  check("Qwen graph: the prompt reaches its Primitive, no negative text node, one picture slot, the style's Lightning LoRA fills slot 6",
    R.qwen.pos === "9" && R.qwen.neg === null && R.qwen.slots.join() === "1" && R.qwen.prompt === "make it red" && R.qwen.img === "up.png"
    && /Lightning-4steps/.test(R.qwen.lora) && R.qwen.seed === 7, R.qwen);
  check("Kontext graph: the negative is ConditioningZeroOut of the prompt (a negative is NOT written over the prompt)",
    R.kontext.pos === "6" && R.kontext.zeroed === true && R.kontext.text === "make it red" && R.kontext.img === "up.png", R.kontext);
  check("Refine on the SDXL export: denoise 0.3, VAEEncodeForInpaint swapped for VAEEncode + SetLatentNoiseMask on the SAME mask",
    R.sdxl.denoise === 0.3 && R.sdxl.cls.includes("SetLatentNoiseMask") && !R.sdxl.cls.includes("VAEEncodeForInpaint")
    && JSON.stringify(R.sdxl.nm.mask) === '["20",1]' && /SetLatentNoiseMask/.test(R.sdxl.rep[0]), R.sdxl);
  check("...at 100 % the export is left as it is (VAEEncodeForInpaint stays)", R.sdxl_full.includes("VAEEncodeForInpaint"), R.sdxl_full);
  check("Refine on FLUX Fill (InpaintModelConditioning): only the KSampler's denoise changes; no denoise param = the template's",
    R.fill.join() === "0.5" && R.fill_none.join() === "1", [R.fill, R.fill_none]);
}

/* ---------------- the model catalog carries what the edit graphs load ---------------- */
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "modelCatalog.json"), "utf8"));
const names = new Set(CAT.models.map((m) => m.as || path.basename(m.file || "")));
const need = new Set();
for (const f of ["img_qwen_edit_2511.json", "img_flux_kontext_edit.json", "img_flux_fill_inpaint.json"]) {
  const t = fs.readFileSync(path.join(ROOT, "comfy_workflows", f), "utf8");
  for (const m of t.matchAll(/"([^"\s]+\.safetensors)"/g)) need.add(m[1]);
}
check("catalog: every file the Qwen / Kontext / FLUX Fill graphs load is downloadable in setup (the edit group)",
  [...need].every((n) => names.has(n)) && CAT.groups.some((g) => g.id === "edit"), [...need].filter((n) => !names.has(n)));
const T = require("../lib/setupTune");
const G = require("../lib/setupGpu");
const hi = T.recommend(G.profile(G.parseNvidia("0, RTX 4090, 24564, 560, 8.9"), 64e9, "win32"), {});
const mid = T.recommend(G.profile(G.parseNvidia("0, RTX 4080, 16376, 560, 8.9"), 64e9, "win32"), {});
check("setup recommends: 24 GB gets Kontext (+ the Fill inpaint files) and Qwen Edit; 16 GB gets Kontext only",
  ["kontext", "flux_t5", "qwen_edit", "qwen_lightning"].every((i) => hi.includes(i)) && mid.includes("kontext") && !mid.includes("qwen_edit"), [hi, mid]);

/* ---------------- brushes ---------------- */
check("27 brush presets (2.570.0: + 7 pen brushes), unique ids, every engine known", B.PRESETS.length === 27 && new Set(B.PRESETS.map((p) => p.id)).size === 27
  && B.PRESETS.every((p) => ["paint", "erase", "smudge", "blur"].includes(p.engine) && p.size > 0 && p.spacing > 0), B.PRESETS.length);
check("presets include the Krita basics: round, soft, airbrush, pencil, ink, chalk, watercolor, smudge, blur, erasers",
  ["basic", "soft", "airbrush", "pencil", "ink", "chalk", "water", "smudge", "blur", "erase", "erasesoft"].every((id) => B.PRESETS.some((p) => p.id === id)));
check("every preset blend is a canvas composite", B.PRESETS.every((p) => !p.blend || B.BLENDS.includes(p.blend)));
const d = B.dabs([0, 0], [10, 0], 3, 0);
check("dabs: every 3 px along a 10 px move (3, 6, 9) carrying 1 px to the next move", d.pts.map((x) => x[0]).join() === "3,6,9" && Math.abs(d.carry - 1) < 1e-9, d);
const d2 = B.dabs([10, 0], [14, 0], 3, d.carry);
check("dabs: the carry keeps the spacing even across moves (next dab at 12)", d2.pts.map((x) => x[0]).join() === "12", d2);
const ink = B.byId("ink");
check("pressure: the ink pen's size follows the pen (light = thin), full pressure = the size",
  B.atPressure(ink, 20, 1, 0.1).size < 6 && B.atPressure(ink, 20, 1, 1).size === 20);
check("pressure: the airbrush's flow follows the pen, its size does not",
  B.atPressure(B.byId("airbrush"), 100, 0.5, 0.2).size === 100 && B.atPressure(B.byId("airbrush"), 100, 0.5, 0.2).flow < 0.5);
const hard = B.tipAlpha({ tip: "round", hardness: 1 }, 20), soft = B.tipAlpha({ tip: "round", hardness: 0 }, 20);
check("tip: a hard round tip is solid to its edge, a soft one fades; both empty in the corners",
  hard.alpha[10 * 20 + 10] === 255 && hard.alpha[10 * 20 + 18] === 255 && soft.alpha[10 * 20 + 18] < 80 && hard.alpha[0] === 0 && soft.alpha[0] === 0,
  [hard.alpha[10 * 20 + 18], soft.alpha[10 * 20 + 18]]);
const gr1 = B.tipAlpha(B.byId("chalk"), 24, 5), gr2 = B.tipAlpha(B.byId("chalk"), 24, 5);
check("tip: the grain is seeded (the same chalk every time) and textured", gr1.alpha.join() === gr2.alpha.join() && new Set(gr1.alpha).size > 20);
check("tip: square and bristle tips render", B.tipAlpha(B.byId("marker"), 16).alpha[0] > 0 && B.tipAlpha(B.byId("oil"), 30).alpha.some((v) => v > 0));

/* ---------------- the selection helpers ---------------- */
const W = 64, H = 48;
check("the six selection tools keep their ids; six paint tools; six AI modes (2.390.0: + compose)",
  TOOLS.map((t) => t[0]).join() === "rect,ellipse,lasso,poly,wand,brush" && PAINT.map((t) => t[0]).join() === "paint,erase,fill,picker,move,hand"
  && MODES.map((m) => m[0]).join() === "generate,refine,remove,edit,background,compose");
const a = P.rectMask(0, 0, 20, 20, W, H), b = P.rectMask(10, 10, 30, 30, W, H);
check("combine intersect (Shift+Alt) keeps only the overlap", P.count(P.combine(Uint8Array.from(a), b, "intersect")) === 100);
check("invert", P.count(P.invert(a)) === W * H - 400);
const bd = P.border(P.rectMask(10, 10, 30, 30, W, H), W, H, 2);
check("border: a ring 2 px each side of the edge", P.count(bd) === 24 * 24 - 16 * 16 && !bd[20 * W + 20] && bd[10 * W + 20], P.count(bd));
check("shift: the move tool carries the selection", P.shift(a, W, H, 5, 3)[3 * W + 5] === 255 && !P.shift(a, W, H, 5, 3)[0] && P.count(P.shift(a, W, H, 5, 3)) === 400);
const rgbaA = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < 10; i++) rgbaA[i * 4 + 3] = 200;
check("fromAlpha: select opaque", P.count(P.fromAlpha(rgbaA, W, H)) === 10);
check("expand: all sides by 50 -> +100 each way, the old picture at (50, 50); left only", JSON.stringify(P.expand(100, 80, "all", 50)) === JSON.stringify({ w: 200, h: 180, ox: 50, oy: 50 })
  && JSON.stringify(P.expand(100, 80, "left", 50)) === JSON.stringify({ w: 150, h: 80, ox: 50, oy: 0 }));
const f1 = P.fitSize(4000, 3000, 1048576, 16), f2 = P.fitSize(300, 200, 1048576, 16);
check("fitSize: a 12 MP crop is rendered at ~1 MP on the 16 grid, aspect kept; a small crop is never upscaled",
  f1.w * f1.h <= 1.1 * 1048576 && f1.w % 16 === 0 && Math.abs(f1.w / f1.h - 4 / 3) < 0.02 && f2.w <= 304 && f2.scale <= 1.02, [f1, f2]);
// hole fill: left half red, right half blue, a hole in the middle of the red
const hw = 40, hh = 20, img = new Uint8ClampedArray(hw * hh * 4), hole = new Uint8Array(hw * hh);
for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { const i = (y * hw + x) * 4; img[i] = x < 20 ? 220 : 10; img[i + 2] = x < 20 ? 10 : 220; img[i + 3] = 255; if (x >= 6 && x < 12 && y >= 6 && y < 14) hole[y * hw + x] = 255; }
img[(10 * hw + 8) * 4] = 0; img[(10 * hw + 8) * 4 + 1] = 255;   // "the object" in the hole: green
P.fillHole(img, hole, hw, hh);
const c = (x, y) => Array.from(img.slice((y * hw + x) * 4, (y * hw + x) * 4 + 4));
check("fillHole: the object is gone - the hole takes the surrounding red, opaque", c(8, 10)[0] > 150 && c(8, 10)[1] < 60 && c(8, 10)[3] === 255, c(8, 10));
check("fillHole: pixels outside the hole are untouched", c(30, 10).join() === "10,0,220,255" && c(2, 2).join() === "220,0,10,255");
const tr = new Uint8ClampedArray(8 * 1 * 4); for (let x = 0; x < 4; x++) { tr[x * 4] = 200; tr[x * 4 + 3] = 255; }
P.fillHole(tr, new Uint8Array(8), 8, 1);
check("fillHole: transparent pixels (an expanded strip) are filled from what is there", tr[7 * 4] > 150 && tr[7 * 4 + 3] === 255, Array.from(tr));
const eg = P.edges(P.rectMask(2, 2, 6, 5, 10, 10), 10, 10);
const len = eg.reduce((s, [x0, y0, x1, y1]) => s + Math.abs(x1 - x0) + Math.abs(y1 - y0), 0);
check("edges: a 4x3 rectangle's outline is 4 merged segments, 14 px long", eg.length === 4 && len === 14, eg);
const pm = new Uint8ClampedArray(4 * 4).fill(255);
P.maskAlpha(pm, Uint8Array.from([255, 128, 0, 64]));
check("maskAlpha: the result's alpha is the feathered selection", pm[3] === 255 && pm[7] === 128 && pm[11] === 0 && pm[15] === 64, Array.from(pm));
const big = P.rectMask(100, 100, 1900, 1100, 2000, 1200), t0 = Date.now();
const gb = P.morph(big, 2000, 1200, 40);
check("morph: grow by 40 px on a 2000x1200 selection is fast (separable) and exact", Date.now() - t0 < 1500 && P.count(gb) === 1880 * 1080, [Date.now() - t0, P.count(gb)]);

/* ---------------- the dock wiring ---------------- */
const EXT = JSON.parse(fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "ext.json"), "utf8"));
check("ext.json loads brushes.js + filters.js (+ 2.389.0's pcdoc / pctools / pcui, 2.390.0's pcsam / pcpsd, 2.396.0's pcfill, 2.397.0's pcstyles / pctext, 2.421.0's pcpath / pcpen, 2.422.0's pcmesh / pcsmart / pcwarp, 2.423.0's pcselect / pcretouch / pcrefine / pcheal, 2.424.0's pcpdf, 2.425.0's pcbezier / pcvline, 2.426.0's pctype, 2.427.0's pcactions, 2.428.0's pcdraw, 2.429.0's pcdockers, 2.430.0's pcdocs / pcpalette, 2.434.0's pcgrad / pccomps, 2.436.0's pcbgi, 2.437.0's pcgenfill / pcpattern, 2.438.0's pcpanels, 2.439.0's pcpropbar, 2.440.0's pcguides, 2.441.0's pcdims, 2.442.0's pcframes, 2.444.0's pcprefs / pcpromptlink, 2.447.0's pcartboards, 2.448.0's pccafill, 2.449.0's pcruns, 2.457.0's pcdimgroup, 2.458.0's pcdimauto, 2.460.0's pc3d, 2.462.0's pcsketch / pcsketchtools, 2.464.0's pcsketchcad / pcsketchcadui, 2.466.0's pcotype, 2.467.0's pcchannels, 2.468.0's pcactionsx, 2.469.0's pclinked / pcatn) BEFORE imageedit.js", EXT.scripts.join() === "brushes.js,filters.js,pcdoc.js,pcpath.js,pcbezier.js,pcmesh.js,pcselect.js,pcretouch.js,pctools.js,pcui.js,pcdocs.js,pcsam.js,pcpsd.js,pcfill.js,pcstyles.js,pctext.js,pctype.js,pcotype.js,pcruns.js,pcpen.js,pcvline.js,pcdraw.js,pcdockers.js,pcpalette.js,pcgrad.js,pcsmart.js,pcwarp.js,pclinked.js,pcchannels.js,pcrefine.js,pcheal.js,pcpdf.js,pcatn.js,pcactions.js,pccomps.js,pcactionsx.js,pcbgi.js,pcgenfill.js,pcpattern.js,pcpanels.js,pcpropbar.js,pcguides.js,pcdims.js,pcframes.js,pcprefs.js,pcpromptlink.js,pcartboards.js,pccafill.js,pcdimgroup.js,pcdimauto.js,pc3d.js,pcsketch.js,pcsketchtools.js,pcsketchcad.js,pcsketchcadui.js,pchandles.js,pcselhl.js,pcmultisel.js,pccadbar.js,pcbody.js,pcunreal.js,pcuecam.js,pcuelights.js,filters2.js,filters3.js,filters4.js,filters5.js,pcmeasure.js,brushdyn.js,pcfileplus.js,pcmerge.js,pcmode.js,pcsubject.js,pcimgop.js,pcblendlayer.js,pctablet.js,pczones.js,pcpending.js,imageedit.js,mount.js,ieeditonly.js", EXT.scripts);
const GLUE = fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "mount.js"), "utf8");
check("mount.js: the AI panel talks to /api/aiedit and /api/aiedit/engines, results through awaitJob",
  /\/api\/aiedit"/.test(GLUE) && /\/api\/aiedit\/engines/.test(GLUE) && /awaitJob\(id[,)]/.test(GLUE));
const IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
check("routes/aiedit.js is mounted from routes/index.js (server.js untouched)", /require\("\.\/aiedit"\)\.mount\(app\)/.test(IDX)
  && !/aiedit/.test(fs.readFileSync(path.join(ROOT, "server.js"), "utf8")));


/* ================= 2.333.0: ◈ CONTROL LAYERS ================= */
check("control types: Krita's structural set - scribble, line art, soft edge, canny, depth, normal, pose, segmentation",
  A.CONTROL_TYPES.map((t) => t.id).join() === "scribble,lineart,softedge,canny,depth,normal,pose,segmentation" && A.MAX_CONTROLS === 4
  && A.CONTROL_TYPES.filter((t) => t.lines).map((t) => t.id).join() === "scribble,lineart,softedge,canny");
const CN = ["diffusers_xl_depth_full.safetensors", "t2i-adapter_canny_sdxl.safetensors", "controlnet-union-sdxl-1.0-promax.safetensors", "other.safetensors"];
check("pickControlNet: the model whose name says the type; else a union / ProMax model; else none",
  A.pickControlNet("depth", CN) === CN[0] && A.pickControlNet("canny", CN) === CN[1] && A.pickControlNet("pose", CN) === CN[2]
  && A.pickControlNet("pose", ["other.safetensors"]) === "" && A.pickControlNet("nope", CN) === "");
const cv = A.controls(JSON.stringify([{ type: "depth", strength: 3, start: -1, end: 0.6 }, { type: "pose", model: "mine.safetensors" }]), CN);
check("controls: JSON in, strength clamped to 0..2, start to 0..0.95, the model auto-picked or kept",
  cv.length === 2 && cv[0].strength === 2 && cv[0].start === 0 && cv[0].end === 0.6 && cv[0].model === CN[0] && cv[1].model === "mine.safetensors" && cv[1].strength === 1, cv);
check("controls: refused in words - an unknown type, no model to be found, a range that ends before it starts, more than 4",
  throws(() => A.controls([{ type: "hologram" }], CN), /unknown type/) && throws(() => A.controls([{ type: "depth" }], []), /no ControlNet model/)
  && throws(() => A.controls([{ type: "depth", start: 0.8, end: 0.3 }], CN), /ends .* before it starts/)
  && throws(() => A.controls(Array(5).fill({ type: "depth" }), CN), /at most 4/));
const py2 = spawnSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import cn_stage as cs, comfy_image as C
out = {}
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_inpaint_sdxl.json"))})
g, n1 = cs.apply_controlnet(g, "a.png", "m1.safetensors", 0.6, 0.7, start=0.1, first_only=True)
g, n2 = cs.apply_controlnet(g, "b.png", "m2.safetensors", 1.2, 1.0, first_only=True)
ap = {k: v["inputs"] for k, v in g.items() if v["class_type"] == "ControlNetApplyAdvanced"}
out["sdxl"] = {"ks": g["3"]["inputs"]["positive"], "ref": g["54"]["inputs"]["positive"], "ap": ap, "n1": n1, "n2": n2}
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_flux_fill_inpaint.json"))})
g, n = cs.apply_controlnet(g, "a.png", "m.safetensors", 1, 1, first_only=True)
out["fill"] = sorted(k for k, v in g.items() if v["class_type"] == "ControlNetApplyAdvanced")
out["pre"] = {t: cs.preprocess_graph("x.png", t)[0]["cn_pre"] for t in cs.PRE_NODES}
print(json.dumps(out))
`], { encoding: "utf8" });
let R2 = null; try { R2 = JSON.parse(py2.stdout); } catch { R2 = null; }
check("cn_stage: ran", !!R2, py2.stderr.slice(-600));
if (R2) {
  const ap = R2.sdxl.ap, ks = R2.sdxl.ks[0], second = ap[ks], first = ap[second.positive[0]];
  check("two control layers CHAIN on the SDXL inpaint export's primary sampler: KSampler <- control 2 <- control 1 <- the prompt",
    Object.keys(ap).length === 2 && first && first.positive[0] === "34" && JSON.stringify(R2.sdxl.ref) === '["50",0]', R2.sdxl);
  check("each control keeps its own range and strength (start 10% / end 70% / 0.6; 0% / 100% / 1.2) and the note says so",
    first.start_percent === 0.1 && first.end_percent === 0.7 && first.strength === 0.6 && second.start_percent === 0 && second.strength === 1.2
    && /starts at 10%, ends at 70%/.test(R2.sdxl.n1[0]), [first, second]);
  check("FLUX Fill inpaint: one ControlNet on its one sampler", R2.fill.length === 1, R2.fill);
  const pre = R2.pre;
  check("From image: every type has its preprocessor - canny is ComfyUI's core node (thresholds, no resolution)",
    Object.keys(pre).length === 8 && pre.canny.class_type === "Canny" && pre.canny.inputs.low_threshold === 0.4 && !("resolution" in pre.canny.inputs)
    && pre.depth.class_type === "DepthAnythingV2Preprocessor" && pre.softedge.class_type === "PiDiNetPreprocessor"
    && pre.normal.class_type === "BAE-NormalMapPreprocessor" && pre.segmentation.class_type === "OneFormer-ADE20K-SemSegPreprocessor", pre);
}
const RT = fs.readFileSync(path.join(ROOT, "routes", "aiedit.js"), "utf8"), IW = fs.readFileSync(path.join(ROOT, "image_worker.py"), "utf8");
check("routes: /api/aiedit/controlnets + /api/aiedit/preprocess; inputs go to temp/aiedit; results are not filed as assets",
  /\/api\/aiedit\/controlnets/.test(RT) && /\/api\/aiedit\/preprocess/.test(RT) && /tempDir\(\), "aiedit"/.test(RT) && /no_assets: true/.test(RT));
check("image_worker: a preprocess job runs before any style check; aiedit_controls ride the render as a graph hook",
  IW.indexOf("params.get(\"preprocess\")") < IW.indexOf("stored = params.get(\"style\")") && /aiedit_controls_hook\(params, cfg\)/.test(IW));

/* ================= 2.333.0: 🎚 ADJUST / ✦ FILTER ================= */
const FX = require("../ext/imageeditdock/filters.js");
check("Photoshop-style adjustments + filters, unique ids (2.389.0: 18 + 23 - Curves, Photo Filter, Channel Mixer, Gradient Map, Desaturate, Equalize; Box / Radial / Tilt-Shift, Sharpen, Twirl, Wave, Ripple, Spherize, Clouds, Wind, Solarize; 2.397.0: + Lens Flare, Swirl, Drop Shadow, 3D Extrude)",
  FX.FILTERS.length === 45 && new Set(FX.FILTERS.map((f) => f.id)).size === 45
  && FX.FILTERS.filter((f) => f.group === "Adjustments").length === 18 && FX.FILTERS.filter((f) => f.group === "Filters").length === 27);
const iw = 32, ih = 24, img2 = new Uint8ClampedArray(iw * ih * 4);
for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) { const i = (y * iw + x) * 4; img2[i] = x * 8; img2[i + 1] = y * 10; img2[i + 2] = 128; img2[i + 3] = 255; }
const allOk = FX.FILTERS.every((f) => { const o = FX.run(f.id, img2, iw, ih); return o.length === img2.length && o.every((v) => v >= 0 && v <= 255) && o[3] === 255; });
check("every filter runs on a picture with its defaults: same size, valid bytes, opaque stays opaque", allOk);
const px = (a, x, y) => Array.from(a.slice((y * iw + x) * 4, (y * iw + x) * 4 + 4));
const same = (a, b) => a.every((v, i) => v === b[i]);
check("Invert twice = the picture", same(FX.run("invert", FX.run("invert", img2, iw, ih), iw, ih), img2));
check("Brightness +50 lifts every channel", px(FX.run("brightness", img2, iw, ih, { brightness: 50 }), 5, 5).slice(0, 3).every((v, i) => v >= px(img2, 5, 5)[i]));
check("Threshold makes it black and white only", FX.run("threshold", img2, iw, ih).every((v, i) => i % 4 === 3 || v === 0 || v === 255));
const red = new Uint8ClampedArray([255, 0, 0, 255]);
check("Hue / Saturation: red + 180° = cyan", same(Array.from(FX.run("huesat", red, 1, 1, { hue: 180 })).map(Math.round), [0, 255, 255, 255]), Array.from(FX.run("huesat", red, 1, 1, { hue: 180 })));
check("Posterize 2 levels: only 0 and 255", FX.run("posterize", img2, iw, ih, { levels: 2 }).every((v, i) => i % 4 === 3 || v === 0 || v === 255));
check("Levels: input white 128 maps 128 -> 255", FX.run("levels", new Uint8ClampedArray([128, 64, 0, 255]), 1, 1, { inWhite: 128 })[0] === 255);
const flat = new Uint8ClampedArray(16 * 16 * 4).fill(90); for (let i = 3; i < flat.length; i += 4) flat[i] = 255;
check("Gaussian blur / oil paint / median of a flat picture = the same flat picture",
  ["gaussian", "oil", "median"].every((id) => FX.run(id, flat, 16, 16).every((v, i) => Math.abs(v - flat[i]) <= 1)));
const salt = Uint8ClampedArray.from(flat); salt[(8 * 16 + 8) * 4] = 255;
check("Median removes a lone speck", FX.run("median", salt, 16, 16, { radius: 1 })[(8 * 16 + 8) * 4] === 90);
check("Find Edges of a flat picture = white (no edges, Photoshop's dark-on-white)", FX.run("edges", flat, 16, 16).every((v) => v === 255));
const vg = FX.run("vignette", flat, 16, 16, { amount: -80 });
check("Vignette darkens the corners, not the centre", vg[0] < 60 && vg[(8 * 16 + 8) * 4] === 90, [vg[0], vg[(8 * 16 + 8) * 4]]);
const ac = FX.run("autocontrast", img2, iw, ih, { clip: 0, perChannel: true });
check("Auto Contrast stretches the red channel to 0..255", Math.min(...ac.filter((v, i) => i % 4 === 0)) === 0 && Math.max(...ac.filter((v, i) => i % 4 === 0)) === 255);
const pix = FX.run("pixelate", img2, iw, ih, { cell: 8 });
check("Pixelate: each 8x8 cell is one colour", same(px(pix, 0, 0), px(pix, 7, 7)) && !same(px(pix, 0, 0), px(pix, 8, 0)));
const ch = FX.run("chromatic", img2, iw, ih, { amount: 3 });
check("Chromatic aberration leaves green alone and shifts red / blue at the edge", ch.every((v, i) => i % 4 !== 1 || v === img2[i]) && !same(px(ch, 0, 0), px(img2, 0, 0)));
const orig = Uint8ClampedArray.from(img2), filt = FX.run("invert", img2, iw, ih), mk = new Uint8Array(iw * ih); mk[0] = 255; mk[1] = 128;
FX.blend(orig, filt, mk);
check("blend: the filter lands inside the selection only, half at a half-selected pixel", same(px(orig, 0, 0), px(filt, 0, 0)) && same(px(orig, 5, 5), px(img2, 5, 5))
  && Math.abs(orig[4] - Math.round((img2[4] + filt[4]) / 2)) <= 1);
check("pad: a blur's reach grows with its radius; a colour adjustment needs none", FX.pad(FX.byId("gaussian"), { radius: 10 }) === 20 && FX.pad(FX.byId("levels"), {}) === 0);

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
