"use strict";
/**
 * bitGen Studio — lib/openjutsu.js (2.949.0): THE ⇄ SWAP DIALOG'S OPENJUTSU ENGINE - its graphs.
 *
 * Tim: "is this worth adding? https://github.com/D3voz/openjutsu" -> yes, as a fourth engine in bitGen's own ⇄ Swap
 * dialog -> "lets do it".
 *
 * OpenJutsu (D3voz, MIT) swaps a video's people / objects on MiniMax H3 + SAM 3.1 + a Qwen3-VL describer, through its
 * own ComfyUI workflows. bitGen ships those workflows UNMODIFIED (comfy_workflows/openjutsu/*.api.json, MIT - its
 * LICENSE beside them) and fills them here the way OpenJutsu's own server does (its lib/simple.ts, advanced.ts,
 * object.ts, face.ts, color.ts, model.ts, comfy.ts at the pinned commit below) - NOT its Next.js page or its
 * comfy-api-proxy: misc/openjutsu_worker.py uploads the files and talks to ComfyUI itself.
 *
 * What a job is (kinds):
 *   simple          one character replaces the main person (picture 1 = the dialog's picture)
 *   advanced        1-4 characters, each with a role ("the drummer") - only those people are regenerated
 *   advanced_maxq   one pass per person (2 characters, slower, cleaner)
 *   object          change / remove / background - what SAM tracks, what it becomes (OpenJutsu's "add" needs a
 *                   keyframed box drawn on the video - not in bitGen yet)
 *   mask            👁 check the mask: what is regenerated (cyan), the tracked person (orange), the grey mannequin
 *   color           🎨 fix colours of a finished take (Image Detail Contrast + Orion4D's DCTL tone mapper)
 *   face            🙂 fix faces of a finished take - OPT-IN: it needs InsightFace buffalo_l (non-commercial research
 *                   only) and the Ultralytics YOLO weights (AGPL-3.0); off until the user ticks that they accept that
 *
 * Pure: reads the shipped workflow files, writes nothing.
 *   KINDS, MODES, RESOLUTIONS, ...       the settings' choices
 *   settingsBlank() / settingsSafe(s)    the dialog record's st.oj
 *   kindFor(settings)                    the swap kind a segment renders with
 *   loadGraph(kind, base?)               the shipped workflow + "soundtrack or silence" (comfy.ts silenceWhenSoundless)
 *   build(kind, o)                       -> {graph, uploads: [{node, input, path}], final, notes} | throws
 *   jobParams(o)                         -> the mode "openjutsu" job params (or {error})
 *   summary(p)                           one line for the queue
 *   requiredClasses(kind, base?)         the node classes that kind's graph uses (the worker checks them)
 */
const fs = require("fs");
const path = require("path");

/** OpenJutsu at the commit these workflows and this port come from (README of 2026-10-30). */
const PIN = { repo: "https://github.com/D3voz/openjutsu", commit: "7fe118bb5a61fcfac0148e1bfea3dd29884dbf26", date: "2026-10-30" };
/** The node packs at the commits the class names / inputs were read from (2026-11-24) - lib/openjutsuAddon.js installs
 *  the packs' current versions (OpenJutsu wants "Oneclick Swap must be current"); diff against these when one breaks. */
const PACK_PINS = {
  "ComfyUI-MiniMaxH3-Contex-Loop": "43afeffcc570beb5f7382593e79e4b211c7e02f6 (0.7.3)",
  "comfyui-h3-oneclick-swap": "e44a56e92920000e675d14be484aea0d7498d63e",
  "ComfyUI-Fantastic-MiniMaxH3-PromptBuilder": "22e719fe89336c628383363182a4da3cb58d4f9b",
  "ComfyUI-KJNodes": "187868f53a7d9df007dbfe85891dab41453f7933",
  "ComfyUI-VideoHelperSuite": "4d907bee61e92c2e65af3bd6383a4e4d356126d1",
  "comfyui-image-detail-contrast": "485a5e246424ce012b998862b45f06d21e8d63b2",
  "Orion4D_FXMax": "7048e8423ad7d1a6a52119d0d4870c2b7fc2885f",
  "ComfyUI-H3-FaceRefine": "d8521d14fe0d721d80cd9417fff5a559cbc21aba",
  "ComfyUI-Impact-Pack": "5f5756b76a7ce4a2c82cae6ef1f1e988cab9666d",
  "ComfyUI-Spectrum-MiniMax-H3": "7df883bb2361b7884ad789e97effd1dc37c8963a",
};
/** The node packs OpenJutsu's workflows use, the classes each provides there (read from each pack's own
 *  NODE_CLASS_MAPPINGS at the pins above), its id in lib/nodePacks.json and its licence (checked 2026-11-24).
 *  face: only 🙂 Fix faces needs it (opt-in - not in nodePacks.json, so a plain setup never installs it). */
const PACKS = [
  { id: "contexloop", folder: "ComfyUI-MiniMaxH3-Contex-Loop", licence: "GPL-3.0", min: "0.7.3",
    provides: ["MiniMaxH3GenerationProfile", "MiniMaxH3SourceTimeline", "MiniMaxH3ChainPlanModern", "MiniMaxH3ChainLoopStart", "MiniMaxH3ChainCurrent",
               "MiniMaxH3ChainContext", "MiniMaxH3ChainSegmentSave", "MiniMaxH3ChainReview", "MiniMaxH3ChainLoopEnd", "MiniMaxH3ChainAssemble",
               "MiniMaxH3ContexLoopMaskSlice", "MiniMaxH3ContexMaskedTarget", "MiniMaxH3ContexMaskGridPreview", "MiniMaxH3LoopTrim"] },
  { id: "oneclick", folder: "comfyui-h3-oneclick-swap", url: "https://github.com/D3voz/comfyui-h3-oneclick-swap", licence: "MIT",
    provides: ["H3OneClickSwapPlan", "H3AdvancedSwapPlan", "H3ObjectSwapPlan", "H3SoundtrackOrSilence", "H3SourceSlice", "H3PeopleMask",
               "H3GreyMannequins", "H3ClipShots", "H3FillShots", "H3TrackCrops", "H3TrackRoles", "H3RoleMask", "H3SubjectPrompt", "H3FaceChunks", "H3FaceJoin"] },
  { id: "fantasticpb", folder: "ComfyUI-Fantastic-MiniMaxH3-PromptBuilder", url: "https://github.com/Adudeguyman/ComfyUI-Fantastic-MiniMaxH3-PromptBuilder",
    licence: "MIT", provides: ["MiniMaxH3FantasticVideoEditLatent"] },
  { id: "kjnodes", folder: "ComfyUI-KJNodes", licence: "GPL-3.0", provides: ["GrowMaskWithBlur", "ImageAndMaskPreview"] },
  { id: "vhs", folder: "ComfyUI-VideoHelperSuite", licence: "GPL-3.0", provides: ["VHS_LoadVideo", "VHS_SelectEveryNthImage", "VHS_VideoCombine"] },
  { id: "detailcontrast", folder: "comfyui-image-detail-contrast", url: "https://github.com/D3voz/comfyui-image-detail-contrast", licence: "MIT",
    provides: ["ImageDetailContrast"] },
  { id: "orionfx", folder: "Orion4D_FXMax", url: "https://github.com/orion4d/Orion4D_FXMax", licence: "MIT", provides: ["Orion4D_FXMax_DCTLToneMapper"] },
  { id: "spectrum", folder: "ComfyUI-Spectrum-MiniMax-H3", licence: "GPL-3.0", provides: ["SpectrumApplyMiniMaxH3"], optional: true },
  { id: "impact", folder: "ComfyUI-Impact-Pack", licence: "GPL-3.0", provides: ["SAMLoader"], face: true },
  { id: "h3facerefine", folder: "ComfyUI-H3-FaceRefine", url: "https://github.com/Carasibana/ComfyUI-H3-FaceRefine", licence: "MIT (its models: InsightFace non-commercial, YOLO AGPL-3.0)",
    provides: ["H3FaceTrackCrop", "H3FaceMaskSAM", "H3FaceStitch"], face: true },
];
/** The pack a class comes from, in words ("" = ComfyUI's own core). */
function packOf(cls) { const p = PACKS.find((x) => x.provides.includes(cls)); return p ? p.folder : ""; }
const WF_DIR = ["comfy_workflows", "openjutsu"];
const KINDS = ["simple", "advanced", "advanced_maxq", "object", "mask", "color", "face"];
const SWAP_KINDS = ["simple", "advanced", "advanced_maxq", "object"];
const MODES = [
  { id: "simple", label: "Simple - one character", kind: "simple" },
  { id: "advanced", label: "Advanced - 1-4 characters with roles", kind: "advanced" },
  { id: "maxq", label: "One pass per person (2 characters)", kind: "advanced_maxq" },
  { id: "object", label: "Object - change / remove / background", kind: "object" },
];
const RESOLUTIONS = ["480p", "576p", "736p", "768p", "1080p"];
const CUSTOM_SIZE = { min: 256, max: 2048, step: 32 };
const CLIP_SECONDS = { min: 2.5, max: 15, default: 6 };
const CHUNK_SECONDS = { min: 2.5, max: 15, default: 6.5 };   // Fix faces (face.ts)
const MAX_SEED = 0xffffffff;
const MARGINS = { tight: 20, normal: 40, loose: 60 };          // edit-mask grow in px at SAM's 1008 px canvas
const OBJECT_MARGINS = { tight: 10, normal: 20, loose: 40 };
const MOTION_SIZES = [512, 768, 1376];
const OBJECT_MODES = ["change", "remove", "background"];
const FACE_STYLES = ["photo", "mouth"];
const MAX_CHARACTERS = 4;
const FPS = 24;                                                // every export loads the video at force_rate 24
/** The longest window one OpenJutsu job takes: its Context Loop chains 6 s clips itself, so a segment can be a
 *  minute (H3's 17k+5 grid at 24 fps: 5 + 17 * 84 = 1433 frames = 59.7 s). */
const CEILING = 1433;

const DEFAULT_DESCRIBER = "qwen3vl_8b_int8_convrot.safetensors";
const DEFAULT_MODEL = {
  model: "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
  lora: "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors",
  steps: 6,
  textEncoder: "qwen3vl_32b_minimax_h3_int4_convrot.safetensors",
  videoVae: "minimax_h3_video_vae_int8_convrot.safetensors",
  audioVae: "minimax_h3_audio_vae_fp32.safetensors",
  sam: "sam3.1_multiplex_fp16.safetensors",
};
const STEPS = { min: 1, max: 100, dmad: 6, plain: 20 };

// Fix colours (color.ts): OpenJutsu's "H3 soft" tone - a lighter take on zuanfilm's H3 preset
const TONE_MODES = ["Filmic Soft", "Filmic Strong", "ACES Approx", "Reinhard", "Cineon-ish"];
const DEFAULT_TONE = { mode: "Reinhard", exposure: 0.09, contrast: 0.84, pivot: 0.69, highlight_rolloff: 0.27,
  shadow_lift: 0.15, black_floor: 0.03, saturation: 1.05, strength: 0.2 };
const DETAIL = { min: -1, max: 1, default: -0.2 };

const LICENCE = {
  face: "🙂 Fix faces uses InsightFace's buffalo_l face models (non-commercial research use only) and the Ultralytics "
    + "YOLO face / person detectors (AGPL-3.0). Only turn it on if those licences suit what you make.",
};

// ------------------------------------------------------------------ settings (st.oj in swap_dialog.json)
const clampN = (v, lo, hi, dflt) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);
const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
const snap32 = (v) => Math.round(clampN(v, CUSTOM_SIZE.min, CUSTOM_SIZE.max, 736) / 32) * 32;

function settingsBlank() {
  return { mode: "simple", role: "", target: "person", roles: ["", "", "", ""], pictures: ["", "", ""],
           object: { mode: "change", target: "hair, top", change_to: "", biggest: false, outline: true },
           resolution: "736p", width: 1248, height: 736, motion: 512, margin: "normal", hat: false, nolip: false,
           clip: CLIP_SECONDS.default, dmad: true, steps: STEPS.dmad, spectrum: false,
           color: { detail: DETAIL.default, detail_on: true, tone_on: true },
           face: { ok: false, style: "photo", chunk: CHUNK_SECONDS.default } };
}
function settingsSafe(s0) {
  const b = settingsBlank(), s = s0 && typeof s0 === "object" ? s0 : {};
  const o = s.object && typeof s.object === "object" ? s.object : {};
  const c = s.color && typeof s.color === "object" ? s.color : {};
  const f = s.face && typeof s.face === "object" ? s.face : {};
  const roles = Array.isArray(s.roles) ? s.roles : [];
  const pics = Array.isArray(s.pictures) ? s.pictures : [];
  const dmad = s.dmad !== false;
  return {
    mode: pick(s.mode, MODES.map((m) => m.id), b.mode),
    role: str(s.role, 160), target: str(s.target, 80) || "person",
    roles: [0, 1, 2, 3].map((i) => str(roles[i], 160)),
    pictures: [0, 1, 2].map((i) => path.basename(String(pics[i] || ""))),
    object: { mode: pick(o.mode, OBJECT_MODES, b.object.mode), target: str(o.target, 160) || b.object.target,
              change_to: str(o.change_to, 400), biggest: o.biggest === true, outline: o.outline !== false },
    resolution: s.resolution === "custom" ? "custom" : pick(s.resolution, RESOLUTIONS, b.resolution),
    width: snap32(s.width != null ? s.width : b.width), height: snap32(s.height != null ? s.height : b.height),
    motion: pick(+s.motion, MOTION_SIZES, b.motion), margin: pick(s.margin, Object.keys(MARGINS), b.margin),
    hat: s.hat === true, nolip: s.nolip === true,
    clip: Math.round(clampN(s.clip, CLIP_SECONDS.min, CLIP_SECONDS.max, b.clip) * 10) / 10,
    dmad, steps: Math.round(clampN(s.steps, STEPS.min, STEPS.max, dmad ? STEPS.dmad : STEPS.plain)),
    // Spectrum is approximate and fights a speed LoRA (model.ts checkAcceleration): only without DMAD
    spectrum: !dmad && s.spectrum === true,
    color: { detail: Math.round(clampN(c.detail, DETAIL.min, DETAIL.max, DETAIL.default) * 100) / 100,
             detail_on: c.detail_on !== false, tone_on: c.tone_on !== false },
    face: { ok: f.ok === true, style: pick(f.style, FACE_STYLES, "photo"),
            chunk: Math.round(clampN(f.chunk, CHUNK_SECONDS.min, CHUNK_SECONDS.max, CHUNK_SECONDS.default) * 10) / 10 },
  };
}
/** The swap kind a segment renders with. */
const kindFor = (s) => (MODES.find((m) => m.id === settingsSafe(s).mode) || MODES[0]).kind;
/** How many character pictures an advanced kind takes (1 + the extra ones set), capped by the kind. */
function pictureCount(s, kind) {
  const x = settingsSafe(s);
  const extra = x.pictures.filter(Boolean).length;
  return kind === "advanced_maxq" ? Math.min(2, 1 + extra) : Math.min(MAX_CHARACTERS, 1 + extra);
}

// ------------------------------------------------------------------ graph helpers (simple.ts / advanced.ts)
const isLink = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "number";
const clone = (g) => JSON.parse(JSON.stringify(g));
const titleOf = (n) => ((n && n._meta) || {}).title || "";

function nodeByTitle(graph, title) {
  const ids = Object.keys(graph).filter((id) => titleOf(graph[id]) === title);
  if (ids.length !== 1) throw new Error(`Expected one "${title}" node in the workflow, found ${ids.length}.`);
  return ids[0];
}
function checkLinks(graph) {
  for (const [id, node] of Object.entries(graph))
    for (const [name, v] of Object.entries(node.inputs || {}))
      if (isLink(v) && !graph[v[0]]) throw new Error(`Node ${id}.${name} still links to removed node ${v[0]}.`);
}

/** comfy.ts silenceWhenSoundless: VHS fails as soon as anything reads the soundtrack of a video that has none, so
 *  every reader of a VHS_LoadVideo's audio (output 2) gets H3SoundtrackOrSilence instead. */
function silenceWhenSoundless(graph) {
  for (const id of Object.keys(graph).filter((k) => graph[k].class_type === "VHS_LoadVideo")) {
    const soundtrack = `${id}_soundtrack`;
    let read = false;
    for (const node of Object.values(graph))
      for (const [name, v] of Object.entries(node.inputs || {}))
        if (isLink(v) && v[0] === id && v[1] === 2) { node.inputs[name] = [soundtrack, 0]; read = true; }
    if (read) graph[soundtrack] = { class_type: "H3SoundtrackOrSilence", inputs: { audio: [id, 2], video_info: [id, 3] },
                                    _meta: { title: "Soundtrack (silence if none)" } };
  }
  return graph;
}

/** A custom size scales and centre-crops the source frames before anything reads them (simple.ts cropSource). */
function cropSource(graph, video, size) {
  for (const node of Object.values(graph))
    for (const [name, v] of Object.entries(node.inputs || {}))
      if (isLink(v) && v[0] === video && v[1] === 0) node.inputs[name] = ["custom_size", 0];
  graph.custom_size = { class_type: "ImageScale", inputs: { image: [video, 0], upscale_method: "bilinear",
    width: size.width, height: size.height, crop: "center" }, _meta: { title: "Custom size (centre crop)" } };
}
function setResolution(graph, plan, video, s) {
  if (s.resolution !== "custom") { graph[plan].inputs.resolution = s.resolution; return; }
  cropSource(graph, video, { width: s.width, height: s.height });
  graph[plan].inputs.short_edge = Math.min(s.width, s.height);
}
/** The part of the source video: skip / cap at 24 fps (VHS cuts the soundtrack the same way). */
function setSection(graph, video, section) {
  const sec = section || {};
  graph[video].inputs.skip_first_frames = Math.max(0, Math.round((+sec.start || 0) * FPS));
  graph[video].inputs.frame_load_cap = Math.max(0, Math.round((+sec.length || 0) * FPS));
}

// The No lip-sync nodes, titled the same in every swap export (workflows/build/oneclick_*_build.js).
const MUTE = /^Mute the (clip|reference) audio H3 hears$/;
const NO_LIP_SYNC = /^(No lip-sync in the prompt|SAM: faces|SAM 3\.1 track faces|Faces \(shown on the mannequins?\))$/;
/** No lip-sync off: the nodes go, H3 hears the soundtrack again and the mannequins get no faces. */
function dropNoLipSync(graph) {
  const through = new Map();
  for (const [id, node] of Object.entries(graph)) {
    const t = titleOf(node);
    if (MUTE.test(t)) through.set(id, node.inputs.audio);
    else if (NO_LIP_SYNC.test(t)) through.set(id, undefined);
  }
  for (const id of through.keys()) delete graph[id];
  for (const [id, node] of Object.entries(graph))
    for (const [name, v] of Object.entries(node.inputs || {})) {
      if (!isLink(v) || !through.has(v[0])) continue;
      if (through.get(v[0])) node.inputs[name] = through.get(v[0]);
      else if (["no_lip_sync", "faces", "face_size"].includes(name)) delete node.inputs[name];
      else throw new Error(`Node ${id}.${name} still links to removed node ${v[0]}.`);
    }
}
/** Settings the Swap Plan's run name does not know get their own run, so a rerun never resumes from clips made
 *  without them. */
function suffixRunName(graph, id, suffix, title) {
  const plans = Object.values(graph).filter((n) => n.class_type === "MiniMaxH3ChainPlanModern");
  if (plans.length !== 1) throw new Error(`Expected one Production Plan node in the workflow, found ${plans.length}.`);
  graph[id] = { class_type: "StringConcatenate", inputs: { string_a: plans[0].inputs.run_name, string_b: suffix, delimiter: "" }, _meta: { title } };
  plans[0].inputs.run_name = [id, 0];
}
/** Every motion reference resize (One pass per person's pass 2 too). */
function setMotionSize(graph, size) {
  const nodes = Object.values(graph).filter((n) => n.class_type === "ImageScaleToMaxDimension" && /motion reference/i.test(titleOf(n)));
  if (!nodes.length) throw new Error("Expected a motion reference resize in the workflow.");
  for (const n of nodes) n.inputs.largest_size = size;
  if (size === MOTION_SIZES[0]) return;
  suffixRunName(graph, "motion_run_name", `_motion${size}`, "Run name for this motion reference size");
}

// Node ids in workflows/simple.api.json and mask.api.json (simple.ts NODES / MASK_NODES).
const NODES = { picture: "2", video: "5", plan: "11", target: "24", peopleMask: "39", growMask: "42", final: "67",
                hat: ["47", "48", "49", "50", "51", "52"] };
const MASK_NODES = { video: "1", target: "3", peopleMask: "7", growMask: "9", final: "18", hat: ["10", "11", "12", "13", "19", "20"] };

function maskSettings(source, hatFix, margin, target, nodes) {
  const graph = clone(source);
  graph[nodes.target].inputs.text = target;
  graph[nodes.growMask].inputs.expand = MARGINS[margin];
  if (!hatFix) {
    for (const id of nodes.hat) delete graph[id];
    graph[nodes.growMask].inputs.mask = [nodes.peopleMask, 0];
  }
  checkLinks(graph);
  return graph;
}

function pruneSimple(source, s) {
  const graph = maskSettings(source, s.hat, s.margin, s.target, NODES);
  if (!s.nolip) dropNoLipSync(graph);
  setMotionSize(graph, s.motion);
  setResolution(graph, NODES.plan, NODES.video, s);
  const plan = graph[NODES.plan].inputs;
  plan.seed = s.seed;
  plan.clip_seconds = s.clip;
  plan.roles = s.role;
  return graph;
}
const pruneMask = (source, s) => maskSettings(source, s.hat, s.margin, s.target, MASK_NODES);

// Advanced (advanced.ts)
const HAT = /\bhats?\b/i;
const PLAN = "Swap Plan (roles, seed, size)";
const VIDEO = "Source video (people get replaced)";
function picturesIn(graph) {
  return Object.values(graph).filter((n) => n.class_type === "LoadImage" && /^Picture \d$/.test(titleOf(n))).length;
}
const ordinal = (i, count) => (count === 1 ? "the main person" : `the person with the ${["", "second ", "third ", "fourth "][i]}most screen time`);

function pruneAdvanced(source, pictures, s) {
  const graph = clone(source);
  const available = picturesIn(graph);
  if (pictures < 1 || pictures > available) throw new Error(`This mode takes 1-${available} character photos.`);
  const removed = new Set();
  for (let k = pictures + 1; k <= available; k++) {
    const load = nodeByTitle(graph, `Picture ${k}`);
    const shrink = Object.keys(graph).find((id) => isLink(graph[id].inputs.image) && graph[id].inputs.image[0] === load && graph[id].class_type === "ImageScaleToMaxDimension");
    const describe = nodeByTitle(graph, `Describe picture ${k}`);
    for (const id of [load, shrink, describe]) if (id) removed.add(id);
  }
  const bypass = new Map();
  if (!s.hat) {
    for (const [id, node] of Object.entries(graph)) {
      if (!HAT.test(titleOf(node))) continue;
      removed.add(id);
      if (node.class_type === "MaskComposite" && node.inputs.operation === "add") bypass.set(id, node.inputs.destination);
    }
  }
  for (const id of removed) delete graph[id];
  for (const [id, node] of Object.entries(graph))
    for (const [name, v] of Object.entries(node.inputs || {})) {
      if (!isLink(v) || !removed.has(v[0])) continue;
      if (bypass.has(v[0])) node.inputs[name] = bypass.get(v[0]);
      else if (/^picture_\d/.test(name) || name.startsWith("ref_images.")) delete node.inputs[name];
      else throw new Error(`Node ${id}.${name} still links to removed node ${v[0]}.`);
    }
  if (!s.nolip) dropNoLipSync(graph);
  setMotionSize(graph, s.motion);
  for (const node of Object.values(graph))
    if (node.class_type === "GrowMaskWithBlur" && / grow mask /.test(titleOf(node))) node.inputs.expand = MARGINS[s.margin];
  const planId = nodeByTitle(graph, PLAN), plan = graph[planId].inputs;
  const roles = s.roles.slice(0, pictures).map((r) => str(r, 160));
  setResolution(graph, planId, nodeByTitle(graph, VIDEO), s);
  plan.seed = s.seed;
  plan.clip_seconds = s.clip;
  plan.roles = roles.some(Boolean) ? roles.map((r, i) => r || ordinal(i, pictures)).join("\n") : "";
  return graph;
}

// Object (object.ts - change / remove / background; "add" needs a drawn box, not here)
const OBJECT_VIDEO = "Source video";
const OBJECT_PICTURE = "Picture 1";
const OBJECT_PLAN = "Object Swap Plan (what to change)";
const objectTargets = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);
function describer(o) {
  const background = o.mode === "background";
  const things = background ? ["place (the setting, its lighting and what is around)"] : objectTargets(o.target);
  const named = things.length === 1 ? things[0] : things.slice(0, -1).join(", ") + " and the " + things[things.length - 1];
  const words = 30 + 20 * things.length;
  return {
    prompt: `Describe the ${named} in this picture in about ${words} words${things.length > 1 ? ", one sentence for each" : ""}: their shape, colours, `
      + "materials, patterns and details. "
      + (background ? "" : "Include every layer worn there, outer layer first: an open shirt or jacket over a top is part of the top. ")
      + "No preamble, and nothing about anything else in the picture.",
    max_length: 2 * words + 40,
  };
}
function pruneObject(source, picture, s) {
  const o = s.object;
  const graph = clone(source);
  const id = (t) => nodeByTitle(graph, t);
  const plan = graph[id(OBJECT_PLAN)].inputs;
  const ref = graph[id("Reference Conditioning")].inputs;
  const grow = graph[id("Grow mask")].inputs;
  const grey = graph[id("Turn it grey (shape and movement only)")].inputs;
  if (picture && o.mode !== "remove") Object.assign(graph[id("Describe picture 1")].inputs, describer(o));
  if (!picture || o.mode === "remove") {
    for (const t of [OBJECT_PICTURE, "Shrink for the describer", "Describe picture 1"]) delete graph[id(t)];
    delete plan.picture_1;
    delete plan.picture_1_text;
    delete ref["ref_images.ref_image_0"];
  }
  // H3 copies a grey shape's outline: a changed top keeps the old silhouette, a removed object would come back grey
  if (o.mode === "remove" || (o.mode === "change" && !o.outline)) {
    delete ref["ref_videos.ref_video_0"];
    delete ref["ref_video_audios.ref_video_audio_0"];
  }
  if (o.mode === "background") {
    grow.flip_input = true;
    grey.mask = [id("Grow mask"), 0];
    grey.size = [id("Grow mask"), 0];
  }
  grow.expand = OBJECT_MARGINS[s.margin];
  setMotionSize(graph, s.motion);
  const most = o.biggest ? objectTargets(o.target).length : 0;
  for (const t of ["Tracked area", "Tracked area, tight (for the grey shape)"]) graph[id(t)].inputs.max_people = most;
  graph[id("SAM: what to change")].inputs.text = o.target;
  Object.assign(plan, { mode: o.mode, target: o.target, change_to: o.change_to, keep_outline: o.outline, seed: s.seed, clip_seconds: s.clip });
  setResolution(graph, id(OBJECT_PLAN), id(OBJECT_VIDEO), s);
  checkLinks(graph);
  return graph;
}

// Fix faces (face.ts) / Fix colours (color.ts)
const FACE_VIDEO = "Video to fix";
function pruneFace(source, s) {
  const graph = clone(source);
  const id = (t) => nodeByTitle(graph, t);
  const chunks = graph[id("Face Fix Chunks")].inputs;
  if (s.face.style === "photo") {       // match the photo: no blurred face to follow - H3 draws the mouth anew
    delete graph[id("Blurred face (follow the mouth)")];
    delete chunks.follow_mouth;
    delete graph[id("Reference Conditioning")].inputs["ref_videos.ref_video_0"];
  }
  chunks.chunk_seconds = s.face.chunk;
  graph[id("Seed")].inputs.noise_seed = s.seed;
  checkLinks(graph);
  return graph;
}
function pruneColor(source, s) {
  const graph = clone(source);
  const detail = nodeByTitle(graph, "Detail contrast");
  const tone = nodeByTitle(graph, "Tone mapper");
  if (!s.color.detail_on) { graph[tone].inputs.image = graph[detail].inputs.image; delete graph[detail]; }
  else graph[detail].inputs.detail_contrast = s.color.detail;
  if (!s.color.tone_on) { graph[nodeByTitle(graph, "Fixed video")].inputs.images = graph[tone].inputs.image; delete graph[tone]; }
  else {
    // Orion uses raw_settings over its preset files when the preset names match
    const n = graph[tone].inputs;
    n.raw_settings = JSON.stringify({ node_type: "color_fx_dctl_tone_mapper", preset: n.preset,
      settings: { ...DEFAULT_TONE, preserve_luminosity: false, clamp_output: true } });
  }
  checkLinks(graph);
  return graph;
}

// Model components (model.ts applyModel): steps, the DMAD LoRA (or none), Spectrum
function componentKey(m) {
  return JSON.stringify([m.model, m.loras.map((l) => [l.name, l.strength]), m.textEncoder, m.videoVae, m.audioVae, m.acceleration]);
}
function fnv64(s) {
  let h = 14695981039346656037n;
  for (const ch of s) h = BigInt.asUintN(64, (h ^ BigInt(ch.codePointAt(0))) * 1099511628211n);
  return h.toString(16);
}
function applyModel(graph, s) {
  const m = { model: DEFAULT_MODEL.model, loras: s.dmad ? [{ name: DEFAULT_MODEL.lora, strength: 1 }] : [],
              textEncoder: DEFAULT_MODEL.textEncoder, videoVae: DEFAULT_MODEL.videoVae, audioVae: DEFAULT_MODEL.audioVae,
              acceleration: s.spectrum ? "spectrum" : "none" };
  graph[nodeByTitle(graph, "Describer: Qwen3-VL 8B")].inputs.clip_name = DEFAULT_DESCRIBER;
  for (const [title, input, value] of [["H3 Text Encoder", "clip_name", m.textEncoder], ["Video VAE", "vae_name", m.videoVae],
                                       ["Audio VAE", "vae_name", m.audioVae]]) graph[nodeByTitle(graph, title)].inputs[input] = value;
  const plans = Object.values(graph).filter((n) => ["H3OneClickSwapPlan", "H3AdvancedSwapPlan", "H3MontagePlan", "H3ObjectSwapPlan"].includes(n.class_type));
  if (plans.length > 1) throw new Error(`Expected one Swap Plan node in the workflow, found ${plans.length}.`);
  (plans[0] || graph[nodeByTitle(graph, "Schedule")]).inputs.steps = s.steps;
  const unet = nodeByTitle(graph, "H3 Diffusion Model");
  const lora = nodeByTitle(graph, "DMAD LoRA");
  graph[unet].inputs.unet_name = m.model;
  const template = graph[lora];
  delete graph[lora];
  let last = [unet, 0];
  m.loras.forEach((l, i) => {
    const nid = i === 0 ? lora : `${lora}_lora${i + 1}`;
    graph[nid] = { ...template, inputs: { ...template.inputs, lora_name: l.name, strength_model: l.strength, model: last }, _meta: { title: `LoRA ${i + 1}` } };
    last = [nid, 0];
  });
  for (const [nid, node] of Object.entries(graph)) {
    if (nid === lora || nid.startsWith(`${lora}_lora`)) continue;
    for (const [name, v] of Object.entries(node.inputs || {})) if (isLink(v) && v[0] === lora) node.inputs[name] = last;
  }
  // separate saved clips when model components change; keep the default runs resumable
  const dflt = { ...m, loras: [{ name: DEFAULT_MODEL.lora, strength: 1 }], acceleration: "none" };
  if (componentKey(m) !== componentKey(dflt) && Object.values(graph).some((n) => n.class_type === "MiniMaxH3ChainPlanModern"))
    suffixRunName(graph, "model_run_name", `_model${fnv64(componentKey(m))}`, "Run name for these model components");
  if (m.acceleration === "spectrum") {
    const patched = new Map();
    for (const node of Object.values(graph)) {
      if (node.class_type !== "BasicGuider" && node.class_type !== "CFGGuider") continue;
      const model = node.inputs.model, key = JSON.stringify(model);
      let sid = patched.get(key);
      if (!sid) {
        sid = `${model[0]}_spectrum`;
        graph[sid] = { class_type: "SpectrumApplyMiniMaxH3", inputs: { model, enabled: true, blend_weight: 0.5, degree: 1, ridge_lambda: 0.1,
          window_size: 2, flex_window: 0.75, warmup_steps: 1, tail_actual_steps: 1, max_history: 8, debug: false,
          history_storage: "system_ram", audio_blend_weight: 0, offline_smoothing_replay: true }, _meta: { title: "Spectrum acceleration" } };
        patched.set(key, sid);
      }
      node.inputs.model = [sid, 0];
    }
  }
}

// ------------------------------------------------------------------ the shipped workflows
const BASE = () => { try { return require("./core").BASE; } catch { return path.join(__dirname, ".."); } };
const fileOf = (kind, base) => path.join(base || BASE(), ...WF_DIR, `${kind}.api.json`);
function loadGraph(kind, base) {
  if (!KINDS.includes(kind)) throw new Error(`no OpenJutsu workflow "${kind}"`);
  const f = fileOf(kind, base);
  if (!fs.existsSync(f)) throw new Error(`comfy_workflows/openjutsu/${kind}.api.json is missing - it ships with bitGen (update the app)`);
  return silenceWhenSoundless(JSON.parse(fs.readFileSync(f, "utf8")));
}
const finalOf = (graph, kind) => (kind === "simple" ? NODES.final : kind === "mask" ? MASK_NODES.final
  : nodeByTitle(graph, ["color", "face"].includes(kind) ? "Fixed video" : "Final Video"));

/**
 * The graph for one job, filled. o = { settings (st.oj), seed, video (abs), start, length (s; 0 = to the end),
 * picture (abs, picture 1), pictures (abs, 2..4) }. -> {graph, uploads, final, notes}. Throws in words.
 */
function build(kind, o) {
  const x = o || {};
  const s = { ...settingsSafe(x.settings), seed: Math.floor(clampN(x.seed, 0, MAX_SEED, 0)) };
  const src = loadGraph(kind, x.base);
  const section = { start: +x.start || 0, length: +x.length || 0 };
  const uploads = [], notes = [];
  let graph, videoNode;
  const pic = (node, file) => { if (!file) throw new Error("pick the new character's picture first (the box on the left)"); uploads.push({ node, input: "image", path: file }); };
  if (kind === "simple") {
    graph = pruneSimple(src, s); applyModel(graph, s);
    videoNode = NODES.video; pic(NODES.picture, x.picture);
  } else if (kind === "advanced" || kind === "advanced_maxq") {
    const files = [x.picture, ...(Array.isArray(x.pictures) ? x.pictures : [])].filter(Boolean);
    const max = kind === "advanced_maxq" ? 2 : MAX_CHARACTERS;
    if (!files.length) throw new Error("pick the new character's picture first (the box on the left)");
    if (files.length > max) notes.push(`${kind === "advanced_maxq" ? "one pass per person" : "advanced"} takes ${max} characters - the first ${max} pictures are used`);
    const use = files.slice(0, max);
    graph = pruneAdvanced(src, use.length, s); applyModel(graph, s);
    videoNode = nodeByTitle(graph, VIDEO);
    use.forEach((f, i) => pic(nodeByTitle(graph, `Picture ${i + 1}`), f));
  } else if (kind === "object") {
    if (!objectTargets(s.object.target).length) throw new Error("say what to change (Object ▸ What), e.g. \"hair, top\"");
    if (s.object.mode !== "remove" && !s.object.change_to && !x.picture)
      throw new Error("say what it becomes (Object ▸ Becomes) or pick a picture of it (the box on the left)");
    const usePic = !!x.picture && s.object.mode !== "remove";
    graph = pruneObject(src, usePic, s); applyModel(graph, s);
    videoNode = nodeByTitle(graph, OBJECT_VIDEO);
    if (usePic) pic(nodeByTitle(graph, OBJECT_PICTURE), x.picture);
  } else if (kind === "mask") {
    graph = pruneMask(src, s); videoNode = MASK_NODES.video;
  } else if (kind === "color") {
    if (!s.color.detail_on && !s.color.tone_on) throw new Error("🎨 Fix colours has both steps off - turn on Detail or Tone");
    graph = pruneColor(src, s); videoNode = nodeByTitle(graph, FACE_VIDEO);
  } else if (kind === "face") {
    if (!s.face.ok) throw new Error(LICENCE.face + " Tick \"I accept\" beside 🙂 Fix faces first.");
    graph = pruneFace(src, s); applyModel(graph, s);
    videoNode = nodeByTitle(graph, FACE_VIDEO); pic(nodeByTitle(graph, "Picture 1"), x.picture);
  } else throw new Error(`no OpenJutsu workflow "${kind}"`);
  if (!x.video) throw new Error("load the video to swap first (📂 Load video)");
  setSection(graph, videoNode, section);
  uploads.unshift({ node: videoNode, input: "video", path: x.video });
  checkLinks(graph);
  return { graph, uploads, final: finalOf(graph, kind), notes };
}

/** The class types a kind's graph can use (the shipped file + what build() can add). */
function requiredClasses(kind, base) {
  const g = loadGraph(kind, base);
  const out = new Set(Object.values(g).map((n) => n.class_type));
  if (SWAP_KINDS.includes(kind)) out.add("StringConcatenate");
  return [...out].sort();
}

const KIND_WORDS = { simple: "simple swap", advanced: "advanced swap", advanced_maxq: "one pass per person", object: "object edit",
                     mask: "👁 mask check", color: "🎨 fix colours", face: "🙂 fix faces" };

/**
 * The mode "openjutsu" job params, or {error}. o = { kind, settings, seed, video, start, length, picture, pictures,
 * frames }.
 */
function jobParams(o) {
  const x = o || {};
  const kind = String(x.kind || "");
  // the worker cuts the window out first (ffmpeg, the sound kept) - the graph then reads the cut from its start
  const whole = kind === "color" || kind === "face";
  const cut = whole ? { start: 0, length: 0 } : { start: Math.max(0, +x.start || 0), length: Math.max(0, +x.length || 0) };
  let b;
  try { b = build(kind, { ...x, start: 0, length: cut.length }); } catch (e) { return { error: String((e && e.message) || e) }; }
  const packs = {};
  for (const n of Object.values(b.graph)) { const f = packOf(n.class_type); if (f) packs[n.class_type] = f; }
  const s = settingsSafe(x.settings);
  const res = s.resolution === "custom" ? `${s.width}x${s.height}` : s.resolution;
  return {
    mode: "openjutsu", kind, graph: b.graph, uploads: b.uploads, final: b.final, notes: b.notes, cut, packs,
    seed: Math.floor(clampN(x.seed, 0, MAX_SEED, 0)),
    start: +x.start || 0, dur: +x.length || 0, frames: Math.floor(+x.frames || 0),
    openjutsu: { kind, words: KIND_WORDS[kind], resolution: res, motion: s.motion, steps: SWAP_KINDS.includes(kind) || kind === "face" ? s.steps : 0,
                 dmad: s.dmad, spectrum: s.spectrum, clip: s.clip, margin: s.margin, hat: s.hat, nolip: s.nolip,
                 mode: s.mode, object: kind === "object" ? s.object.mode : "", pin: PIN.commit.slice(0, 7) },
  };
}
function summary(p) {
  const j = (p && p.openjutsu) || {};
  const part = p && p.dur ? ` · ${(+p.dur).toFixed(2)}s from ${(+p.start || 0).toFixed(2)}s` : "";
  if (j.kind === "color" || j.kind === "face" || j.kind === "mask") return `OpenJutsu ${j.words}${part}`;
  return `OpenJutsu ${j.words}${j.object ? " (" + j.object + ")" : ""}${part} · ${j.resolution} · motion ${j.motion}px · `
    + `${j.steps} steps${j.dmad ? " (DMAD)" : ""}${j.spectrum ? " · Spectrum" : ""} · ${j.clip}s clips`
    + (j.hat ? " · hat fix" : "") + (j.nolip ? " · no lip-sync" : "");
}

module.exports = { PIN, PACK_PINS, PACKS, packOf, WF_DIR, KINDS, SWAP_KINDS, MODES, RESOLUTIONS, CUSTOM_SIZE, CLIP_SECONDS, CHUNK_SECONDS, MAX_SEED,
  MARGINS, OBJECT_MARGINS, MOTION_SIZES, OBJECT_MODES, FACE_STYLES, MAX_CHARACTERS, FPS, CEILING, DEFAULT_DESCRIBER, DEFAULT_MODEL,
  STEPS, TONE_MODES, DEFAULT_TONE, DETAIL, LICENCE, NODES, MASK_NODES, KIND_WORDS,
  settingsBlank, settingsSafe, kindFor, pictureCount, isLink, nodeByTitle, silenceWhenSoundless, cropSource, setSection,
  dropNoLipSync, setMotionSize, pruneSimple, pruneMask, pruneAdvanced, pruneObject, pruneFace, pruneColor, applyModel,
  loadGraph, fileOf, build, requiredClasses, jobParams, summary, objectTargets };
