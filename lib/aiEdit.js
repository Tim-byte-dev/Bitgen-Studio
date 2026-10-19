"use strict";
/**
 * aiEdit.js — THE IMAGE EDITOR'S AI (2.332.0), our own take on Krita AI
 * Diffusion (github.com/Acly/krita-ai-diffusion).
 *
 * Tim: "we just need about 20 brush presets, selections tools are the most
 * important, to select and edit via qwen edit, kontext or regenerate that
 * portion like krita ai diffusion does ... our own version".
 *
 * The editor always sends a CROP: the selection's box padded by a context
 * margin (or the whole picture when nothing is selected). What happens to it
 * depends on the MODE, as in Krita's selection workspace:
 *
 *   generate  regenerate the selection from the prompt at 100 % - the style's
 *             INPAINT path (lib/infill.js: its inpaint_workflow, FLUX.2 Klein's
 *             edit graph, or the SDXL inpaint export) with the mask.
 *   refine    the same graph at a STRENGTH below 100 % (the sampler's denoise;
 *             scripts/comfy_image.apply_denoise swaps VAEEncodeForInpaint for
 *             VAEEncode + SetLatentNoiseMask so a partial denoise keeps the
 *             real pixels). Needs a graph that takes the mask.
 *   remove    generate with "nothing here" words when the prompt is empty; the
 *             editor pre-fills the hole with the surroundings first, so the
 *             model continues the background instead of redrawing the object.
 *   edit      an INSTRUCTION EDIT model on the crop - Qwen-Image-Edit 2511,
 *             FLUX.1 Kontext, FLUX.2 Klein edit: "make her jacket red". The
 *             graph sees the crop only; the editor pastes the answer back under
 *             the feathered selection, so nothing outside it changes.
 *
 * Background replace (invert + generate) and canvas expand (grow the canvas,
 * select the new strip, generate) are editor-side combinations of these.
 * Every result is its own image job; `count` queues several with consecutive
 * seeds so the editor can offer them side by side, like Krita's history.
 */
const fs = require("fs");
const path = require("path");
const infill = require("./infill");
const imageRefs = require("./imageRefs");

const MODES = ["generate", "refine", "remove", "edit"];
const MAX_COUNT = 4;
// classes that make a graph an INSTRUCTION-EDIT graph (the picture is a
// reference the text talks about, not a canvas to denoise)
const EDIT_CLASSES = /^(TextEncodeQwenImageEdit|TextEncodeQwenImage21|ReferenceLatent|FluxKontextMultiReferenceLatentMethod|FluxKontextImageScale)/;
const REMOVE_PROMPT = "empty background, the surroundings continue seamlessly through this area, nothing in front";
const REMOVE_NEGATIVE = "person, object, animal, text, watermark, logo, frame";

function readGraph(baseDir, rel) {
  try {
    const p = path.isAbsolute(rel) ? rel : path.join(baseDir, rel);
    const g = JSON.parse(fs.readFileSync(p, "utf8"));
    return Object.fromEntries(Object.entries(g).filter(([k, v]) => !String(k).startsWith("_") && v && typeof v === "object"));
  } catch { return null; }
}

/** Is this graph an instruction-edit graph with a picture slot? */
function isEditGraph(baseDir, rel) {
  if (!rel) return false;
  const g = readGraph(baseDir, rel);
  if (!g) return false;
  const classes = Object.values(g).map((n) => String(n.class_type || ""));
  return classes.some((c) => EDIT_CLASSES.test(c)) && classes.includes("LoadImage")
    && !classes.some((c) => /InpaintModelConditioning|VAEEncodeForInpaint/.test(c));
}

/** The edit graph a style renders an EDIT with, or throws in words. */
function editGraph(style, baseDir) {
  const s = style || {};
  if (s.engine !== "comfy") throw new Error(`"${s.name || s.id}" is not a ComfyUI style - Edit needs Qwen Image Edit, FLUX Kontext or FLUX.2 Klein edit`);
  if ((s.kind || "image") !== "image") throw new Error(`"${s.name || s.id}" is not an image style`);
  if (isEditGraph(baseDir, s.workflow))
    return { workflow: s.workflow, slots: imageRefs.slotsIn(baseDir, s.workflow), input: "crop",
             note: `edit with ${path.basename(s.workflow)} (the crop is Picture 1; the editor pastes the answer under the selection)` };
  if (imageRefs.isKlein9b(s)) {
    const r = imageRefs.resolve(s, 1, baseDir);
    if (r.swapped && isEditGraph(baseDir, r.workflow))
      return { workflow: r.workflow, slots: r.slots, input: "crop",
               note: `edit via ${imageRefs.isKlein3(s) ? "FLUX 3" : "FLUX.2"} Klein edit graph ${path.basename(r.workflow)} (the crop is Picture 1)` };
  }
  throw new Error(`"${s.name || s.id}" cannot follow an edit instruction - pick Qwen Image Edit 2511, FLUX.1 Kontext edit or a FLUX.2 / FLUX 3 Klein (edit) style`);
}

/**
 * Which graph a request runs and how. -> {workflow, input, denoise, note,
 * prompt, negative, selfContained} or throws.
 */
function plan(style, req, baseDir) {
  const q = req || {};
  const mode = MODES.includes(q.mode) ? q.mode : "generate";
  let prompt = String(q.prompt || "").trim();
  let negative = q.negative != null ? String(q.negative) : null;
  if (mode === "edit") {
    const e = editGraph(style, baseDir);
    if (!prompt) throw new Error("write the edit instruction in the prompt first (\"make the sky stormy\", \"remove the glasses\")");
    return Object.assign(e, { mode, prompt, negative, denoise: null, selfContained: false });
  }
  const r = infill.resolve(style, baseDir);           // throws in words
  let denoise = null;
  if (mode === "refine") {
    const st = Math.max(5, Math.min(95, parseFloat(q.strength) || 50));
    if (!r.takesMask && r.input !== "rgba")
      throw new Error(`Refine needs an inpaint graph that takes the selection as a mask - ${path.basename(r.workflow)} regenerates the whole crop. Use Generate, or an inpaint style (FLUX Fill inpaint, SDXL)`);
    denoise = st / 100;
  } else if (q.strength != null && q.strength !== "" && parseFloat(q.strength) < 100 && (r.takesMask || r.input === "rgba")) {
    denoise = Math.max(0.05, parseFloat(q.strength) / 100);
  }
  if (mode === "remove") {
    if (!prompt) prompt = REMOVE_PROMPT;
    if (negative == null || !negative.trim()) negative = REMOVE_NEGATIVE;
  }
  if (!prompt) throw new Error("write what should appear in the selection in the prompt box first");
  return Object.assign({}, r, { mode, prompt, negative, denoise });
}

/** The styles each mode can use, for the editor's dropdowns. */
function engines(list, baseDir) {
  const inpaint = [], edit = [];
  for (const s of list || []) {
    if ((s.kind || "image") !== "image" || s.engine !== "comfy" || s.chain) continue;
    try { const r = infill.resolve(s, baseDir); inpaint.push({ id: s.id, name: s.name, refine: !!(r.takesMask || r.input === "rgba") }); } catch { /* not inpaint */ }
    try { editGraph(s, baseDir); edit.push({ id: s.id, name: s.name }); } catch { /* not edit */ }
  }
  const pref = (arr, re) => ((arr.find((x) => re.test(x.name)) || arr[0] || {}).id || "");
  return { inpaint, edit, modes: MODES, max_count: MAX_COUNT,
           // 2.337.0: "Qwen Image Edit 2511" (4-step Lightning) stays the editor's
           // default; "Qwen Image 2.1 edit" is the scene cards' ✎ First frame default
           defaults: { inpaint: pref(inpaint, /flux fill inpaint/i),
                       edit: ((edit.find((x) => /qwen[\s_-]*image[\s_-]*edit/i.test(x.name))
                               || edit.find((x) => /qwen.*edit/i.test(x.name)) || edit[0] || {}).id || "") } };
}

/* ---------------- CONTROL LAYERS (2.333.0) ----------------
 * Krita AI Diffusion's control layers, ours: any layer of the picture can be
 * a control of one TYPE - drawn by hand, or made by "From image" (the type's
 * preprocessor, scripts/cn_stage.PRE_NODES). Each has a strength and a
 * RANGE (start / end of the sampling where it guides). They ride Generate /
 * Refine / Remove / Background as ControlNetApplyAdvanced chained on the
 * primary sampler (image_worker.aiedit_controls_hook). Edit models take the
 * picture itself, so controls are not sent with an Edit. */
const CONTROL_TYPES = [
  { id: "scribble", label: "Scribble", lines: true, match: /(scribble|pidinet|\bhed\b|_hed|hed_)/i },
  { id: "lineart", label: "Line art", lines: true, match: /(lineart|line_art|anime_?line|mangaline)/i },
  { id: "softedge", label: "Soft edge", lines: true, match: /(softedge|soft_edge|pidi|\bhed\b|_hed|hed_)/i },
  { id: "canny", label: "Canny edge", lines: true, match: /canny/i },
  { id: "depth", label: "Depth", lines: false, match: /(depth|midas|zoe|leres)/i },
  { id: "normal", label: "Normal map", lines: false, match: /(normal|bae)/i },
  { id: "pose", label: "Pose", lines: false, match: /(openpose|dwpose|\bpose)/i },
  { id: "segmentation", label: "Segmentation", lines: false, match: /(\bseg|_seg|segment|ade20k|oneformer)/i },
];
const MAX_CONTROLS = 4;
const typeById = (id) => CONTROL_TYPES.find((t) => t.id === id) || null;

/** The ControlNet model for a type: one whose name says the type, else a
 *  UNION / ProMax model (they take every type), else "". */
function pickControlNet(type, names) {
  const t = typeById(type), list = (names || []).map(String);
  if (!t) return "";
  return list.find((n) => t.match.test(n)) || list.find((n) => /(union|promax)/i.test(n)) || "";
}

/** Validate the editor's control list. -> [{type, strength, start, end, model}] or throws. */
function controls(raw, names) {
  let arr = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw || "[]"); } catch { throw new Error("controls: not JSON"); } }
  if (!Array.isArray(arr)) return [];
  if (arr.length > MAX_CONTROLS) throw new Error(`at most ${MAX_CONTROLS} control layers at once`);
  return arr.map((c, i) => {
    const t = typeById(String((c || {}).type || ""));
    if (!t) throw new Error(`control layer ${i + 1}: unknown type ${JSON.stringify((c || {}).type)} - one of ${CONTROL_TYPES.map((x) => x.id).join(", ")}`);
    const model = String(c.model || "").trim() || pickControlNet(t.id, names);
    if (!model) throw new Error(`control layer ${i + 1} (${t.label}): no ControlNet model for it in ComfyUI's models/controlnet - put one there (its name should say "${t.id}", or a union / ProMax model) or pick one on the layer`);
    const n = (v, d, lo, hi) => { const x = parseFloat(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    const start = n(c.start, 0, 0, 0.95), end = n(c.end, 1, 0.05, 1);
    if (end <= start) throw new Error(`control layer ${i + 1}: the range ends (${end}) before it starts (${start})`);
    return { type: t.id, strength: n(c.strength, 1, 0, 2), start, end, model };
  });
}

/* ---------------- COMPOSE: LAYERS AS REFERENCES (2.390.0) ----------------
 * Tim: "we add 3 images to image editor, layer 1, layer 2 and layer 3, and we prompt using our local models to use them
 * as reference and create a scene". The layers picked in the Layers panel (Ctrl-click, in the order picked) go to an
 * EDIT model as Picture 1..n - the first is the scene / canvas (sent at the picture's size, so the answer lands 1:1 on
 * the canvas), the others the things to bring in. Qwen-Image-Edit 2511's own graph has ONE LoadImage, but its
 * TextEncodeQwenImageEditPlus takes image1..image3 - withQwenPlusSlots adds the slots for this render only. */
const MAX_COMPOSE = 3;
const QWEN_PLUS = "TextEncodeQwenImageEditPlus";

/** a copy of an edit graph with LoadImage (+ its ImageScaleToTotalPixels) slots for Picture 2..n wired into every
 *  TextEncodeQwenImageEditPlus as image2..imageN (pure - tested) */
function withQwenPlusSlots(graph, n) {
  const g = JSON.parse(JSON.stringify(graph || {}));
  const ids = Object.keys(g).filter((k) => !k.startsWith("_") && g[k] && /loadimage/i.test(String(g[k].class_type || "")))
    .sort((a, b) => (+a || 1e9) - (+b || 1e9));
  const encs = Object.keys(g).filter((k) => g[k] && g[k].class_type === QWEN_PLUS);
  if (!ids.length || !encs.length) throw new Error("this edit graph has no TextEncodeQwenImageEditPlus picture inputs to add slots to");
  const L1 = ids[0];
  const scale = Object.keys(g).find((k) => g[k] && g[k].class_type === "ImageScaleToTotalPixels"
    && Array.isArray((g[k].inputs || {}).image) && String(g[k].inputs.image[0]) === L1);
  let next = Math.max(0, ...Object.keys(g).map((k) => parseInt(k, 10)).filter(Number.isFinite)) + 1;
  const have = ids.length;
  for (let i = have + 1; i <= Math.min(MAX_COMPOSE, n); i++) {
    const li = String(next++);
    g[li] = { class_type: "LoadImage", inputs: { image: "placeholder.png" }, _meta: { title: `Picture ${i}` } };
    let src = li;
    if (scale) {
      const sc = String(next++);
      g[sc] = { class_type: "ImageScaleToTotalPixels", inputs: Object.assign({}, g[scale].inputs, { image: [li, 0] }) };
      src = sc;
    }
    for (const e of encs) g[e].inputs[`image${i}`] = [src, 0];
  }
  return g;
}

/** the graph + how for a COMPOSE of n pictures -> {workflow, graph (null = the file as it is), slots, note} or throws */
function composePlan(style, n, baseDir) {
  const k = Math.max(1, Math.min(MAX_COMPOSE, parseInt(n, 10) || 1));
  if ((parseInt(n, 10) || 0) > MAX_COMPOSE) throw new Error(`at most ${MAX_COMPOSE} layers at once (the edit models take three pictures)`);
  const e = editGraph(style, baseDir);         // throws in words: not an edit style
  if (e.slots >= k) return { workflow: e.workflow, graph: null, slots: e.slots, note: `compose: ${k} layer(s) as Picture 1..${k} into ${path.basename(e.workflow)}` };
  const g = readGraph(baseDir, e.workflow);
  if (g && Object.values(g).some((x) => x.class_type === QWEN_PLUS))
    return { workflow: e.workflow, graph: withQwenPlusSlots(g, k), slots: k,
             note: `compose: ${k} layer(s) as Picture 1..${k} - ${path.basename(e.workflow)} with ${k - e.slots} picture slot(s) added (TextEncodeQwenImageEditPlus image2..image${k})` };
  throw new Error(`"${style.name || style.id}" takes ${e.slots} picture(s) - for ${k} layers pick Qwen Image Edit 2511, Qwen Image 2.1 edit or a FLUX.2 Klein edit style`);
}

/** the prompt with the layers named: a layer's name in the text becomes "Picture i" (Qwen 2.1: <imageI>), and a line
 *  says which picture is which layer (pure - tested) */
function composePrompt(text, names, qwen21) {
  let t = String(text || "").trim();
  const tag = (i) => (qwen21 ? `<image${i + 1}>` : `Picture ${i + 1}`);
  const list = (names || []).map((x) => String(x || "").trim());
  const order = list.map((nm, i) => [nm, i]).filter(([nm]) => nm).sort((a, b) => b[0].length - a[0].length);   // longest first
  for (const [nm, i] of order) {
    // "Layer 2" matches "layer 2" too; any other name only as written (a layer called "Cat" leaves "the cat" alone)
    const re = new RegExp(`(^|[^A-Za-z0-9_])(${nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![A-Za-z0-9_])`, /^layer\s*\d+$/i.test(nm) ? "gi" : "g");
    t = t.replace(re, (_m, pre) => `${pre}${tag(i)}`);
  }
  const line = list.map((nm, i) => `${tag(i)} is ${i === 0 ? "the scene" : "a reference"}${nm ? ` (the layer "${nm}")` : ""}`).join("; ") + ".";
  return `${line}\n${t}`;
}

/** 2.539.0 (Tim: "can we use our reference docker images ... in homebuilder and image-editor?" - "pick one as the 'put
 *  this here' picture for an AI edit of a selected area"): an Edit with a picture from the References docker - the crop is
 *  Picture 1, the reference Picture 2 (the edit graph gets a second slot when it has one picture: composePlan) -> the
 *  prompt that says so (pure - tested) */
function refPrompt(text, desc, qwen21) {
  const t = String(text || "").trim(), d = String(desc || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const p1 = qwen21 ? "<image1>" : "Picture 1", p2 = qwen21 ? "<image2>" : "Picture 2";
  return `${p1} is the scene; ${p2} is a reference${d ? ` (${d})` : ""}. Use what is in ${p2} for this edit, matching the light, angle and scale of ${p1}.\n${t}`;
}
function refPlan(style, baseDir) { return composePlan(style, 2, baseDir); }

/** How many results (1..4). */
function count(v) { return Math.max(1, Math.min(MAX_COUNT, parseInt(v, 10) || 1)); }

module.exports = { MODES, MAX_COUNT, EDIT_CLASSES, REMOVE_PROMPT, REMOVE_NEGATIVE, isEditGraph, editGraph, plan, engines, count,
                   MAX_COMPOSE, withQwenPlusSlots, composePlan, composePrompt, refPrompt, refPlan,
                   CONTROL_TYPES, MAX_CONTROLS, pickControlNet, controls };
