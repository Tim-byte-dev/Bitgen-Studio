// bitGen Studio — lib/charSheetH3.js (2.870.0): THE CHARACTER SHEET, MADE BY THE H3 CHARACTER SHEET DESIGNER.
//
// Tim (verbatim): "https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer can we integrate this into bitgen, if we can
// then remove our character designer and use this one"
//
// The designer is a ComfyUI node pack (MIT for its code; its mannequin artwork is outside that licence and is never copied
// into bitGen Studio - the pack is cloned into the user's own ComfyUI by Settings ▸ Add-ons, lib/h3SheetAddon.js). Its
// MiniMaxH3ImageCharacterSheetDesigner node turns a settings object (state_json) + the character picture + up to three
// part pictures into the prompt, the canvas size and (optionally) a layout guide for MiniMax H3 Image - ComfyUI's own
// MiniMaxH3ImageConditioning node (ComfyUI 0.45+). bitGen Studio builds that graph here and runs it as a mode:"graph"
// job (misc/graph_worker.py: transport + collection only), so the takes land in the Character creator's strip exactly
// like before and ✔ adopts one as the character's sheet.
//
// EVERY node / input name below was read from the pack's source at the commit in PACK.commit (v1.5.2), never guessed:
//   MiniMaxH3ImageCharacterSheetDesigner  required state_json (STRING), character_image (IMAGE); optional
//     reference_image_1..3 (IMAGE), use_layout_image (BOOLEAN), style (one of STYLES); outputs 0 prompt, 1 width,
//     2 height, 3 layout_image (None when the layout is off), 4 character_image, 5..7 reference_image_1..3 (passed through)
//   state_json schema_version 3: views, size {mode auto|manual, body_height, manual_width, manual_height - multiples of
//     32}, part_prompts {part: text <= 1000}, hand_state, clothing_mode (garment - the MiniMax H3 Image node's default),
//     clothing_type (none = no clothing · natural body surface), footwear_state, + optional reference_roles (all three
//     keys), view_prompts (view: text <= 2000), resolution_profile
//   its read-only preview route POST PREVIEW_PATH {state_json, use_layout_image, style, reference_presence} answers the
//     compiled sheet (prompt, width, height, semantic_layout.panels [{id, rect [x, y, w, h] 0-1, view}], default_view_prompts)
//   the generation side as the pack's own MiniMax H3 Image template wires it: UNETLoader, CLIPLoader (type minimax),
//     VAELoader, MiniMaxH3ImageConditioning (clip, vae, prompt, width, height, images.image_0..4 = character, layout,
//     reference 1..3 - a picture that is not there is simply not wired, the pack numbers the pictures it gets), its
//     output 0 positive + output 1 the latent, ConditioningZeroOut as the negative, KSampler euler / simple, 6 steps,
//     cfg 1, denoise 1, VAEDecode (or VAEDecodeTiled 512 / 64 / 64 / 8)
//
//   VIEWS / PRESETS / CLOTHING / HANDS / FEET / STYLES / ROLES / PARTS / SIZES   the choices, in bitGen Studio's words
//   state(o)            -> the designer's state object (whitelisted, ordered); throws Error with the words when it cannot be
//   graph(o)            -> {graph, uploads}  (graph_worker's [{node, input, path, kind}] upload contract)
//   pickName(list, kind)  the ComfyUI dropdown value for the model file of that kind (unet / clip / vae), "" = not there
//   readiness(info)     -> {designer, cond, names: {unet, clip, vae}, styles, missing: [words]}  from ComfyUI's /object_info
//   summary(state)      the short words for a take ("5 views · High detail · layout guide")
"use strict";

const PACK = { id: "h3sheet", folder: "H3-Character-Sheet-Designer",
               url: "https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer",
               commit: "33a2b753166ed9c114396864e5ae7cc090129c02", version: "1.5.2" };
const NODE = "MiniMaxH3ImageCharacterSheetDesigner";
const COND = "MiniMaxH3ImageConditioning";
const PREVIEW_PATH = "/h3_character_sheet_designer/minimax_image/preview";

const VIEWS = [
  { id: "face_front", label: "Face - front", group: "head" },
  { id: "face_left", label: "Face - left profile", group: "head" },
  { id: "face_right", label: "Face - right profile", group: "head" },
  { id: "face_3q_left", label: "Face - left three-quarter", group: "head" },
  { id: "face_3q_right", label: "Face - right three-quarter", group: "head" },
  { id: "face_back", label: "Head - back", group: "head" },
  { id: "body_front", label: "Full body - front", group: "body" },
  { id: "body_left", label: "Full body - side", group: "body" },
  { id: "body_back", label: "Full body - back", group: "body" },
  { id: "clothing_front", label: "Clothing - front", group: "clothing" },
  { id: "clothing_back", label: "Clothing - back", group: "clothing" },
  { id: "hands", label: "Hands", group: "detail" },
  { id: "feet", label: "Feet / footwear", group: "detail" },
];
const VIEW_IDS = VIEWS.map((v) => v.id);
const HEAD = VIEW_IDS.slice(0, 6), BODY = ["body_front", "body_left", "body_back"], CLOTHES = ["clothing_front", "clothing_back"];
const PRESETS = [
  { id: "five", label: "Standard · 5 views", views: ["face_front", "face_left", "body_front", "body_left", "body_back"] },
  { id: "basic", label: "Basic · 4 views", views: ["face_front", "body_front", "body_left", "body_back"] },
  { id: "turnaround", label: "Turnaround · 3 views", views: BODY.slice() },
  { id: "head", label: "Head · 6 views", views: HEAD.slice() },
  { id: "clothing", label: "Clothing · 2 views", views: CLOTHES.slice() },
  { id: "single", label: "Single view", views: ["body_front"] },
  { id: "detail", label: "All · 13 views", views: VIEW_IDS.slice() },
];
const CLOTHING = [["reference", "As in the picture"], ["pants", "Pants"], ["skirt_robe", "Skirt or robe"],
                  ["none", "No clothing · natural body surface"]];
const HANDS = [["reference", "As in the picture"], ["bare", "Bare hands"], ["gloved", "Gloves"]];
const FEET = [["reference", "As in the picture"], ["shod", "Shoes on"], ["unshod", "No shoes"]];
const STYLES = [["none", "As in the picture"], ["anime", "Anime"], ["photo", "Photo"], ["realistic_painting", "Realistic painting"],
                ["semi_realistic_anime", "Semi-realistic anime"], ["oil_painting", "Oil painting"], ["watercolor", "Watercolour"],
                ["gouache", "Gouache"], ["colored_pencil", "Coloured pencil"], ["3d", "3D render"]];
const ROLES = [["same_character", "More of the same character"], ["face", "Face"], ["head", "Head and hair"],
               ["clothing", "Clothing"], ["clothing_front", "Clothing - front"], ["clothing_back", "Clothing - back"],
               ["hands", "Hands"], ["footwear", "Footwear"]];
const PARTS = [["head_hair", "Head, hair and headwear"], ["face", "Face"], ["upper_clothing", "Upper clothing"],
               ["back_clothing", "Back of the clothing"], ["lower_body", "Lower body"], ["hands", "Hands"],
               ["footwear", "Footwear"], ["other", "Anything else"]];
const SIZES = [["current", "Standard"], ["high", "High detail"], ["max_8mp", "Up to 8 MP"], ["max_16mp", "Up to 16 MP"]];
const REF_KEYS = ["reference_image_1", "reference_image_2", "reference_image_3"];
const PART_MAX = 1000, VIEW_PROMPT_MAX = 2000, SIZE_MAX = 16384;

// the model files - the pack's MiniMax H3 Image template (Comfy-Org/MiniMax-H3-Image); the text encoder is the one the
// MiniMax H3 video already uses (nvfp4 first, the int8 one when that is what this ComfyUI has)
const WANT = {
  unet: ["minimax_h3_image_pruned_int8_convrot.safetensors"],
  clip: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "qwen3vl_32b_minimax_h3_int8_convrot.safetensors"],
  vae: ["minimax_h3_image_vae_fp16.safetensors"],
};
const LOADER = { unet: ["UNETLoader", "unet_name"], clip: ["CLIPLoader", "clip_name"], vae: ["VAELoader", "vae_name"] };

const has = (pairs, v) => pairs.some((p) => p[0] === v);
const units = (s) => String(s).length;          // UTF-16 code units, the pack's own measure
const snap32 = (n, dflt) => { const v = Math.round(Number(n)); if (!Number.isFinite(v) || v < 32) return dflt; return Math.min(SIZE_MAX, Math.max(32, Math.round(v / 32) * 32)); };

/** the designer's state from the dialog's choices - only known keys and values get through */
function state(o) {
  const i = o || {};
  const want = Array.isArray(i.views) ? i.views.map(String) : [];
  const views = VIEW_IDS.filter((v) => want.includes(v));
  if (!views.length) throw new Error("tick at least one view for the sheet");
  const clothing = has(CLOTHING, i.clothing) ? i.clothing : "reference";
  if (clothing === "none" && !views.some((v) => !CLOTHES.includes(v)))
    throw new Error("No clothing leaves out the clothing views - tick at least one face, body, hands or feet view");
  const sz = i.size || {};
  const manual = sz.mode === "manual";
  const s = {
    schema_version: 3, views,
    size: { mode: manual ? "manual" : "auto", body_height: snap32(sz.body_height, 1120),
            manual_width: snap32(sz.width, 3168), manual_height: snap32(sz.height, 1280) },
    part_prompts: {},
    hand_state: has(HANDS, i.hands) ? i.hands : "reference",
    clothing_mode: "garment",
    clothing_type: clothing,
    footwear_state: has(FEET, i.feet) ? i.feet : "reference",
    resolution_profile: has(SIZES, i.detail) ? i.detail : "high",
  };
  const pp = i.parts || {};
  for (const [id] of PARTS) {
    const t = typeof pp[id] === "string" ? pp[id].trim() : "";
    if (!t) continue;
    if (units(t) > PART_MAX) throw new Error(`the note for "${PARTS.find((p) => p[0] === id)[1]}" is longer than ${PART_MAX} characters`);
    s.part_prompts[id] = t;
  }
  const roles = Array.isArray(i.roles) ? i.roles : [];
  if (roles.some((r) => r)) {
    s.reference_roles = {};
    REF_KEYS.forEach((k, n) => { s.reference_roles[k] = has(ROLES, roles[n]) ? roles[n] : "same_character"; });
  }
  const vp = i.viewPrompts || {};
  const edits = {};
  for (const v of VIEW_IDS) {
    if (typeof vp[v] !== "string") continue;
    if (units(vp[v]) > VIEW_PROMPT_MAX) throw new Error(`the instruction for "${VIEWS.find((x) => x.id === v).label}" is longer than ${VIEW_PROMPT_MAX} characters`);
    edits[v] = vp[v];
  }
  if (Object.keys(edits).length) s.view_prompts = edits;
  return s;
}

/** short words for a take */
function summary(s) {
  const n = s.clothing_type === "none" ? s.views.filter((v) => !CLOTHES.includes(v)).length : s.views.length;
  const preset = PRESETS.find((p) => p.views.length === s.views.length && p.views.every((v) => s.views.includes(v)));
  const size = s.size.mode === "manual" ? `${s.size.manual_width} × ${s.size.manual_height}` : (SIZES.find((x) => x[0] === s.resolution_profile) || SIZES[1])[1];
  return [(preset ? preset.label.replace(/ · \d+ views?$/, "") + " · " : "") + n + (n === 1 ? " view" : " views"), size].join(" · ");
}

/** the dropdown value ComfyUI has for that model file ("" = not there) - by file name, any sub-folder, any separator */
function pickName(list, kind) {
  const names = Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  const base = (n) => n.split(/[\\/]/).pop().toLowerCase();
  for (const w of WANT[kind] || []) { const hit = names.find((n) => base(n) === w); if (hit) return hit; }
  return "";
}

/** what this ComfyUI can do, from its /object_info */
function readiness(info) {
  const I = info || {};
  const combo = (cls, key) => require("./comfyModels").comboFrom(I, cls, key);
  const names = {};
  for (const k of Object.keys(LOADER)) names[k] = pickName(combo(LOADER[k][0], LOADER[k][1]) || [], k);
  const designer = !!I[NODE], cond = !!I[COND];
  const styles = combo(NODE, "style") || [];
  const missing = [];
  if (!designer) missing.push("the H3 Character Sheet Designer node pack is not loaded in ComfyUI - install it in Settings ▸ Add-ons ▸ H3 Character Sheet Designer, then restart ComfyUI");
  if (!cond) missing.push("this ComfyUI has no MiniMax H3 Image Conditioning node - update ComfyUI to 0.45 or newer (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI), then restart it");
  if (!names.unet) missing.push("the MiniMax H3 Image model (" + WANT.unet[0] + ") is not in ComfyUI's diffusion_models");
  if (!names.clip) missing.push("the MiniMax H3 text encoder (" + WANT.clip[0] + ") is not in ComfyUI's text_encoders");
  if (!names.vae) missing.push("the MiniMax H3 Image VAE (" + WANT.vae[0] + ") is not in ComfyUI's vae");
  return { designer, cond, names, styles, missing };
}

/**
 * The whole graph for one take.
 * o = {state (from state()), layout: bool, style, seed, names: {unet, clip, vae}, character: path,
 *      refs: [path | null, path | null, path | null], tiled: bool, prefix}
 */
function graph(o) {
  const path = require("path");
  if (!o || !o.character) throw new Error("no character picture");
  const style = has(STYLES, o.style) ? o.style : "none";
  const refs = (Array.isArray(o.refs) ? o.refs : []).slice(0, 3);
  const g = {}, uploads = [];
  const load = (id, file) => { g[id] = { class_type: "LoadImage", inputs: { image: path.basename(file) } }; uploads.push({ node: id, input: "image", path: file, kind: "image" }); };
  load("char", o.character);
  // 2.874.0: a TEMPLATE (your own finished sheet) takes the designer's layout-guide slot: the designer is asked for its layout
  // (so its words call <Picture 2> "a framed layout guide only … placeholders, not appearance"), and your sheet goes there
  // instead of its own picture; the canvas takes the template's shape, and one more line says to follow it
  const tpl = o.template && o.template.path ? o.template : null;
  const design = { state_json: JSON.stringify(o.state), character_image: ["char", 0], use_layout_image: !!(o.layout || tpl), style };
  const cond = { clip: ["clip", 0], vae: ["vae", 0], prompt: ["design", 0], width: ["design", 1], height: ["design", 2],
                 "images.image_0": ["design", 4] };
  if (tpl) {
    load("tpl", tpl.path);
    cond["images.image_1"] = ["tpl", 0];
    const sz = templateSize(tpl.w, tpl.h, o.state);
    cond.width = sz.w; cond.height = sz.h;
    if (o.concat) {
      g.tplPrompt = { class_type: "StringConcatenate", inputs: { string_a: ["design", 0], string_b: TEMPLATE_WORDS, delimiter: "\n\n" } };
      cond.prompt = ["tplPrompt", 0];
    }
  } else if (o.layout) cond["images.image_1"] = ["design", 3];
  refs.forEach((f, n) => {
    if (!f) return;
    load("ref" + (n + 1), f);
    design[REF_KEYS[n]] = ["ref" + (n + 1), 0];
    cond["images.image_" + (n + 2)] = ["design", 5 + n];
  });
  g.design = { class_type: NODE, inputs: design };
  g.unet = { class_type: "UNETLoader", inputs: { unet_name: o.names.unet, weight_dtype: "default" } };
  g.clip = { class_type: "CLIPLoader", inputs: { clip_name: o.names.clip, type: "minimax", device: "default" } };
  g.vae = { class_type: "VAELoader", inputs: { vae_name: o.names.vae } };
  g.cond = { class_type: COND, inputs: cond };
  g.zero = { class_type: "ConditioningZeroOut", inputs: { conditioning: ["cond", 0] } };
  g.sample = { class_type: "KSampler", inputs: { model: ["unet", 0], positive: ["cond", 0], negative: ["zero", 0],
               latent_image: ["cond", 1], seed: Math.max(0, Math.floor(Number(o.seed) || 0)), steps: 6, cfg: 1,
               sampler_name: "euler", scheduler: "simple", denoise: 1 } };
  g.decode = o.tiled
    ? { class_type: "VAEDecodeTiled", inputs: { samples: ["sample", 0], vae: ["vae", 0], tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 } }
    : { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["vae", 0] } };
  g.save = { class_type: "SaveImage", inputs: { images: ["decode", 0], filename_prefix: String(o.prefix || "charsheet") } };
  return { graph: g, uploads };
}

/** 2.874.0: the words added after the designer's own when a template is used (the template is <Picture 2>) */
const TEMPLATE_WORDS = "<Picture 2> is a finished character sheet used as the TEMPLATE for this sheet: follow its panel arrangement, "
  + "the number and order of its views, their view angles, poses, framing, crops and scale, its background and where its labels sit. "
  + "The people, faces, bodies, clothing and colours drawn in <Picture 2> are placeholders only - take the character's identity, "
  + "appearance, clothing and rendering style from <Picture 1>, never from <Picture 2>.";
/** the sheet's size for a template: its shape, at the pixels the Size choice asks for (16 px steps, each side 512 - 8192) */
function templateSize(tw, th, st) {
  const w0 = Math.max(1, Number(tw) || 1), h0 = Math.max(1, Number(th) || 1), sz = (st && st.size) || {};
  const MP = { current: 4.0, high: 6.0, max_8mp: 8.0, max_16mp: 16.0 };     // the state's resolution_profile
  const px = sz.mode === "manual" && sz.manual_width && sz.manual_height ? sz.manual_width * sz.manual_height
    : (MP[st && st.resolution_profile] || 6.0) * 1e6;
  let w = Math.sqrt(px * w0 / h0), h = w * h0 / w0;
  const k = Math.min(1, 8192 / w, 8192 / h); w *= k; h *= k;
  const snap = (v) => Math.max(512, Math.min(8192, Math.round(v / 16) * 16));
  return { w: snap(w), h: snap(h) };
}

/** the body the pack's preview route takes */
function previewBody(s, layout, style, refsPresent) {
  const rp = {}; REF_KEYS.forEach((k, n) => { rp[k] = !!(refsPresent || [])[n]; });
  return { state_json: JSON.stringify(s), use_layout_image: !!layout, style: has(STYLES, style) ? style : "none", reference_presence: rp };
}

module.exports = { TEMPLATE_WORDS, templateSize, PACK, NODE, COND, PREVIEW_PATH, VIEWS, VIEW_IDS, PRESETS, CLOTHING, HANDS, FEET, STYLES, ROLES, PARTS, SIZES,
                   REF_KEYS, WANT, state, summary, pickName, readiness, graph, previewBody };
