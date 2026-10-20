// bitGen Studio — THE IMAGE EDITOR'S AI routes (2.332.0; control layers
// 2.333.0). Mounted from routes/index.js (never server.js). What each mode
// runs is lib/aiEdit.js; every result is an ordinary image job
// (image_worker.py), so it shows in the job list and the log like any other
// render. The editor's inputs (crops, masks, control pictures) go to the
// project's temp/aiedit - not the Image assets; results are not filed as
// assets either (they come back into the editor as layers; the gallery
// keeps them).
//
//   GET  /api/aiedit/engines      {inpaint:[{id,name,refine}], edit:[{id,name}],
//                                  modes, max_count, defaults:{inpaint, edit},
//                                  control_types, max_controls}
//   GET  /api/aiedit/controlnets  {models:[names], suggest:{type: name}}
//   POST /api/aiedit              multipart: crop (PNG, the selection + context
//                                  or the whole picture), mask (PNG, transparent
//                                  = the selection), rgba (the crop with the
//                                  selection transparent), ctl0..ctl3 (the
//                                  control layers' pictures, the crop's size),
//                                  mode (generate | refine | remove | edit),
//                                  prompt, negative, style_id, strength (5-100),
//                                  count (1-4), seed, width, height, controls
//                                  (JSON [{type, strength, start, end, model}])
//                                  -> {jobs:[{id,seed}], workflow, note, input, mode, controls}
//                                  2.539.0: + ref0 (a picture from the References docker) + ref_desc with mode edit:
//                                  the crop is Picture 1, the reference Picture 2
//                                  2.552.0: + mask_grow / mask_feather (the mask's grow and feather in the render's pixels,
//                                  Krita's sizes), whole ("1" = no selection); an Edit in a selection runs the edit graph
//                                  with the picture as its starting latent under the mask (lib/inpaintLatent.js
//                                  editLatentGraph) - images [crop, mask, (ref)]; the answer says soft: true when the graph
//                                  kept what is outside the selection (the editor then blends past its edge)
//                                  2.553.0: + fill_edit ("1") + edit_style_id + fill_kind (generate | remove | background):
//                                  Generate / Remove / New background in a selection run through that EDIT model with
//                                  Krita's instruction (aiEdit.fillEditPlan) under the noise mask -> edit_fill, style_name
//                                  2.555.0: Generate / Remove / Refine get the Krita AI plugin's helper for the style's family
//                                  when ComfyUI has it (lib/kritaInpaint.js: Fooocus for SDXL / Pony, inpainting ControlNets
//                                  for Illustrious / SD 1.5 / FLUX.1, MAT / LaMa before Remove) -> helpers; the engines list
//                                  says per style (helper) and what is missing (krita.missing)
//                                  2.556.0: ref0 + ref1 + ref_nums + ref_descs - up to two References docker pictures with
//                                  an Edit or any run through the edit model (fill_edit; Refine too): the prompt's docker
//                                  numbers become the model's pictures 2 / 3 (lib/refWords.js withRefs)
//   POST /api/aiedit/compose      2.390.0 LAYERS AS REFERENCES: multipart pic0..pic2 (the layers picked, Picture
//                                  1 = the scene at the picture's size), names (JSON - the layers' names), prompt,
//                                  style_id (an edit style), width, height, count, seed; 2.546.0 scene_refs (JSON - pic0
//                                  is a 3D / Blender scene, pic1.. the References docker's pictures with these numbers:
//                                  the prompt's "picture 1" becomes the model's own "image 2" / "<image2>" / "Picture 2")
//                                  -> {jobs:[{id,seed}], workflow, note, prompt}
//   POST /api/aiedit/preprocess   multipart image + type -> {job} (a control
//                                  layer's "From image"; the map is the job's output)
"use strict";
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const styles = require("../lib/styles");
const imageSeed = require("../lib/imageSeed");
const aiEdit = require("../lib/aiEdit");
const refWords = require("../lib/refWords");      // 2.546.0: the model's word for its pictures; a scene + references
const comfyModels = require("../lib/comfyModels");
const kritaInpaint = require("../lib/kritaInpaint");   // 2.555.0: the Krita AI plugin's per-family fill helpers

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 96 * 1024 * 1024, files: 8 } });
const CTL_FIELDS = Array.from({ length: aiEdit.MAX_CONTROLS }, (_, i) => ({ name: `ctl${i}`, maxCount: 1 }));

/** The ControlNet models ComfyUI's folders hold (a folder scan - it answers
 *  whether ComfyUI is running or not). */
function controlNetNames() {
  try {
    const c = (core.getConfig().engine || {}).comfy || {};
    const dirAbs = c.dir ? core.resolvePath(c.dir) : "";
    const sc = comfyModels.scan(dirAbs, { extraPaths: c.extra_paths || "" });
    return (((sc.categories || {}).controlnet || {}).files || []).map((f) => f.name);
  } catch { return []; }
}
function inputDir() {
  const d = path.join(core.tempDir(), "aiedit");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function mount(app) {
  app.get("/api/aiedit/engines", async (_req, res) => {
    try {
      const caps = await kritaInpaint.caps();            // 2.555.0: what ComfyUI has for the Krita way
      res.json(Object.assign(aiEdit.engines(styles.read(core.STYLES_DIR, "image"), core.BASE, caps),
        { control_types: aiEdit.CONTROL_TYPES.map((t) => ({ id: t.id, label: t.label, lines: t.lines })), max_controls: aiEdit.MAX_CONTROLS,
          krita: { online: caps.online, missing: kritaInpaint.missing(caps) } }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/aiedit/controlnets", (_req, res) => {
    const models = controlNetNames();
    res.json({ models, suggest: Object.fromEntries(aiEdit.CONTROL_TYPES.map((t) => [t.id, aiEdit.pickControlNet(t.id, models)])) });
  });

  app.post("/api/aiedit/preprocess", upload.single("image"), (req, res) => {
    const b = req.body || {};
    const f = req.file;
    if (!f || !f.buffer) return res.status(400).json({ error: "image missing" });
    const type = String(b.type || "");
    if (!aiEdit.CONTROL_TYPES.some((t) => t.id === type)) return res.status(400).json({ error: `unknown control type ${JSON.stringify(type)}` });
    const name = `aiedit-${Date.now().toString(36)}-from.png`;
    fs.writeFileSync(path.join(inputDir(), name), f.buffer);
    const job = core.makeJob({ mode: "image", preprocess: { type, pose_face: b.pose_face === "1" || b.pose_face === "true" },
                               images: [path.join(inputDir(), name)], no_assets: true,
                               workflow_note: `control layer "From image": ${type}` });
    job.chunk = { i: 0, n: 1 };
    res.json({ job: job.id, type });
  });

  app.post("/api/aiedit/compose", upload.fields(Array.from({ length: aiEdit.MAX_COMPOSE }, (_, i) => ({ name: `pic${i}`, maxCount: 1 }))), (req, res) => {
    const b = req.body || {};
    const files = req.files || {};
    const pics = [];
    for (let i = 0; i < aiEdit.MAX_COMPOSE; i++) { const f = (files[`pic${i}`] || [])[0]; if (f && f.buffer) pics.push(f); else break; }
    if (!pics.length) return res.status(400).json({ error: "pick the layers first (Ctrl-click them in the Layers panel - the first is the scene)" });
    const style = styles.byId(core.STYLES_DIR, String(b.style_id || ""));
    if (!style) return res.status(400).json({ error: "pick an Edit model in the editor's AI panel (Qwen Image Edit 2511, Qwen Image 2.1 edit, FLUX.2 Klein edit)" });
    const typed = String(b.prompt || "").trim();
    if (!typed) return res.status(400).json({ error: "write what to make from the layers (\"put the dog from Layer 2 on the sofa in Layer 1\")" });
    let plan;
    try { plan = aiEdit.composePlan(style, pics.length, core.BASE); } catch (e) { return res.status(400).json({ error: e.message }); }
    let names = [];
    try { names = JSON.parse(b.names || "[]").map((x) => String(x || "").slice(0, 60)); } catch { names = []; }
    // 2.546.0: the model's own word for its pictures (Qwen 2.1 <image1>, FLUX.2 Klein "image 1", Qwen 2511 "Picture 1");
    // scene_refs = a 3D / Blender scene (pic0) + the References docker's pictures numbered as the docker numbers them
    const wording = refWords.wordingFor(style, core.BASE);
    let sceneRefs = null;
    try { sceneRefs = b.scene_refs ? JSON.parse(b.scene_refs).map((x) => parseInt(x, 10)).filter((x) => x >= 1).slice(0, pics.length - 1) : null; } catch { sceneRefs = null; }
    const prompt = sceneRefs && sceneRefs.length === pics.length - 1
      ? refWords.sceneRefsPrompt(typed, sceneRefs, wording, names.slice(1))
      : aiEdit.composePrompt(refWords.retag(typed, wording), pics.map((_p, i) => names[i] || `Layer ${i + 1}`), wording);
    const stamp = Date.now().toString(36);
    const dir = inputDir();
    const images = pics.map((f, i) => { const n = path.join(dir, `aiedit-${stamp}-compose${i + 1}.png`); fs.writeFileSync(n, f.buffer); return n; });
    let workflow = plan.workflow;
    if (plan.graph) { workflow = path.join(dir, `aiedit-${stamp}-compose.json`); fs.writeFileSync(workflow, JSON.stringify(plan.graph, null, 1)); }
    const w = Math.max(64, parseInt(b.width, 10) || 0), h = Math.max(64, parseInt(b.height, 10) || 0);
    const n = aiEdit.count(b.count);
    const first = imageSeed.forRequest(styles.numOrNull(b.seed));
    const styled = styles.applyLoraWeights(style, null);
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const p = { mode: "image", prompt, style: styled, style_id: style.id, style_name: style.name, width: w, height: h, batch: 1,
                  workflow, workflow_note: plan.note + (n > 1 ? ` (result ${i + 1} of ${n})` : ""), aiedit: "compose", no_assets: true, images };
      p.seed = (first.seed + i) % 4294967296; p.seed_random = first.random;
      const job = core.makeJob(p);
      job.chunk = { i: 0, n: 1 };
      jobs.push({ id: job.id, seed: p.seed });
    }
    res.json({ jobs, workflow: path.basename(plan.workflow), note: plan.note, prompt, mode: "compose" });
  });

  app.post("/api/aiedit", upload.fields([{ name: "crop", maxCount: 1 }, { name: "mask", maxCount: 1 }, { name: "rgba", maxCount: 1 }, { name: "ref0", maxCount: 1 }, { name: "ref1", maxCount: 1 }, ...CTL_FIELDS]), async (req, res) => {
    const b = req.body || {};
    const files = req.files || {};
    const crop = (files.crop || [])[0], mask = (files.mask || [])[0], rgba = (files.rgba || [])[0];
    // 2.539.0: a picture from the References docker; 2.556.0: up to two (ref0, ref1) + ref_nums (their docker numbers - the
    // prompt's "picture 1" means the docker's picture 1) + ref_descs
    const refFiles = ["ref0", "ref1"].map((k) => (((files[k] || [])[0] || {}).buffer ? files[k][0] : null)).filter(Boolean);
    const ref0 = refFiles[0] || null;
    const jsonArr = (v) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
    const refNums = jsonArr(b.ref_nums).map((x) => parseInt(x, 10)).filter((x) => x >= 1), refDescs = jsonArr(b.ref_descs).map((x) => String(x || "").slice(0, 200));
    if (!crop || !crop.buffer) return res.status(400).json({ error: "crop image missing" });
    let style = styles.byId(core.STYLES_DIR, String(b.style_id || ""));
    if (!style) return res.status(400).json({ error: b.mode === "edit"
      ? "pick an Edit model in the editor's AI panel (Qwen Image Edit, FLUX Kontext ...)"
      : "pick a Regenerate style in the editor's AI panel (FLUX Fill inpaint, SDXL ...)" });
    let plan = null, ctl = [];
    // 2.553.0: Generate / Remove / New background in a selection through the EDIT model (it sees the picture - the Krita
    // AI plugin's way, lib/aiEdit.js fillEditPlan); an edit style that cannot = the style's own fill as before
    if (b.fill_edit === "1" && b.mode !== "edit" && (b.mode !== "refine" || refFiles.length)) {   // 2.556.0: Refine too, with references
      const es = styles.byId(core.STYLES_DIR, String(b.edit_style_id || ""));
      if (es) { try { plan = aiEdit.fillEditPlan(es, b, core.BASE); style = es; } catch (e) { plan = null; } }
    }
    let caps = null;
    if (!plan && b.mode !== "edit") { try { caps = await kritaInpaint.caps(); } catch (e) { caps = null; } }
    try {
      if (!plan) plan = aiEdit.plan(style, b, core.BASE, caps);
      if (plan.mode !== "edit" && !plan.editFill && b.controls) ctl = aiEdit.controls(b.controls, controlNetNames());
    } catch (e) { return res.status(400).json({ error: e.message }); }
    const w = Math.max(64, parseInt(b.width, 10) || 0), h = Math.max(64, parseInt(b.height, 10) || 0);
    // 2.539.0: Edit + a reference picture = the crop is Picture 1, the reference Picture 2 (a second slot added if needed)
    let refGraph = null;
    if (ref0) {
      if (plan.mode !== "edit" && !plan.editFill) return res.status(400).json({ error: "a reference picture goes with ✨ Edit (an edit model takes it as Picture 2) - pick Edit, or Compose with the picture as a layer" });
      const nr = refFiles.length;
      try { const rp = aiEdit.composePlan(style, 1 + nr, core.BASE); plan = Object.assign({}, plan, { workflow: rp.workflow, note: plan.note + (nr > 1 ? ` + ${nr} reference pictures (pictures 2 and 3)` : " + a reference picture (Picture 2)") }); refGraph = rp.graph; }
      catch (e) { return res.status(400).json({ error: e.message }); }
      const wording = refWords.wordingFor(style, core.BASE);   // 2.546.0: the model's word
      plan.prompt = refNums.length === nr ? refWords.withRefs(plan.prompt, refNums, wording, refDescs) : aiEdit.refPrompt(plan.prompt, b.ref_desc, wording);
    }
    if (plan.mode !== "edit") {
      if (!mask || !mask.buffer) return res.status(400).json({ error: "mask image missing (select an area first)" });
      if (plan.input === "rgba" && !(rgba && rgba.buffer))
        return res.status(400).json({ error: "this inpaint graph reads the hole from the picture's alpha - the editor must send `rgba` (reload the page)" });
    }
    for (let i = 0; i < ctl.length; i++)
      if (!((files[`ctl${i}`] || [])[0] || {}).buffer) return res.status(400).json({ error: `control layer ${i + 1}: its picture (ctl${i}) is missing` });
    const stamp = Date.now().toString(36);
    const dir = inputDir();
    const names = { crop: `aiedit-${stamp}-crop.png`, mask: `aiedit-${stamp}-mask.png`, rgba: `aiedit-${stamp}-hole.png` };
    fs.writeFileSync(path.join(dir, names.crop), crop.buffer);
    if (mask && mask.buffer) fs.writeFileSync(path.join(dir, names.mask), mask.buffer);
    if (rgba && rgba.buffer) fs.writeFileSync(path.join(dir, names.rgba), rgba.buffer);
    names.refs = refFiles.map((f, i) => { const n = `aiedit-${stamp}-ref${i + 1}.png`; fs.writeFileSync(path.join(dir, n), f.buffer); return n; });
    if (names.refs.length) names.ref = names.refs[0];
    // 2.552.0: an Edit inside a selection changes only the selection (Krita AI: the picture is the starting latent under a
    // noise mask) - the mask rides as image 2: [crop, mask, (reference)]
    let editMask = null;
    if ((plan.mode === "edit" || plan.editFill) && mask && mask.buffer && b.whole !== "1") {
      editMask = aiEdit.editMasked(plan, refGraph, core.BASE, b);
      if (editMask) { refGraph = editMask.graph; plan.note += editMask.note; plan.input = "crop+mask"; }
    }
    if (refGraph) { const gp = path.join(dir, `aiedit-${stamp}-${editMask ? "edit" : "ref"}.json`); fs.writeFileSync(gp, JSON.stringify(refGraph, null, 1)); plan.workflow = gp; }
    // 2.550.0: a seamless fill builds its graph from the style's own (lib/inpaintLatent.js via lib/infill.js)
    else if (plan.graph && plan.mode !== "edit") { const gp = path.join(dir, `aiedit-${stamp}-fill.json`); fs.writeFileSync(gp, JSON.stringify(plan.graph, null, 1)); plan.workflow = gp; }
    const controls = ctl.map((c, i) => {
      const n = `aiedit-${stamp}-ctl${i}-${c.type}.png`;
      fs.writeFileSync(path.join(dir, n), files[`ctl${i}`][0].buffer);
      return Object.assign({}, c, { image: path.join(dir, n) });
    });
    let styled = styles.applyLoraWeights(style, null);
    if (plan.selfContained) styled = Object.assign({}, styled, { model: "", vae: "", te: "", loras: [], steps: null, cfg: null, width: null, height: null });
    const imgs = editMask ? [names.crop, names.mask].concat(names.refs)
      : names.refs.length ? [names.crop].concat(names.refs) : plan.input === "rgba" ? [names.rgba] : plan.input === "crop+mask" ? [names.crop, names.mask] : [names.crop];
    const n = aiEdit.count(b.count);
    const first = imageSeed.forRequest(styles.numOrNull(b.seed));
    const jobs = [];
    const ctlNote = controls.length ? ` + ${controls.length} control layer(s): ${controls.map((c) => `${c.type} ${c.strength}`).join(", ")}` : "";
    for (let i = 0; i < n; i++) {
      const p = { mode: "image", prompt: plan.prompt, style: styled, style_id: style.id, style_name: style.name,
                  width: w, height: h, batch: 1, workflow: plan.workflow,
                  workflow_note: `${plan.mode}: ${plan.note}${ctlNote}` + (n > 1 ? ` (result ${i + 1} of ${n})` : ""),
                  infill: true, infill_input: plan.input, aiedit: plan.mode, no_assets: true,
                  images: imgs.map((x) => path.join(dir, x)) };
      if (controls.length) p.aiedit_controls = controls;
      if (plan.negative) p.negative = String(plan.negative).slice(0, 2000);
      if (plan.denoise != null) p.denoise = plan.denoise;
      p.seed = (first.seed + i) % 4294967296; p.seed_random = first.random;
      const job = core.makeJob(p);
      job.chunk = { i: 0, n: 1 };
      jobs.push({ id: job.id, seed: p.seed });
    }
    // soft: the graph kept everything outside the (grown, feathered) selection - the editor blends past the edge (Krita)
    res.json({ jobs, workflow: plan.workflow, note: plan.note, input: plan.input, mode: plan.mode, soft: !!(editMask || (plan.graph && plan.mode !== "edit")),
               edit_fill: plan.editFill || null, style_name: style.name, helpers: plan.helpers || [],
               denoise: plan.denoise, crop: names.crop, controls: controls.map((c) => ({ type: c.type, model: c.model, strength: c.strength, start: c.start, end: c.end })),
               ignored_controls: plan.mode === "edit" && !!b.controls });
  });
}

module.exports = { mount };
