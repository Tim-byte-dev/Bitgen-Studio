"use strict";
/**
 * pano360.js — 360° PANORAMAS FROM PICTURES (2.971.0): the image editor's Image ▸ 🌐 360 Panorama.
 *
 * Tim: "can we add this to image-editor to create 360 panaromic images for mmh3.
 * https://github.com/nomadoor/ComfyUI-Panorama-Stickers?"
 *
 * The node pack's way, without the node pack: the editor (ext/imageeditdock/pcpano.js) projects your pictures onto a
 * 2:1 equirectangular canvas where you place them and paints the rest PURE GREEN; Qwen Image 2.1 with nomadoor's 360
 * panorama outpaint LoRA fills the green into a seamless 360° picture (comfy_workflows/img_qwen21_pano360.json - the
 * pack's own example graph with its Panorama Studio node replaced by that canvas). The result is a world for 🥽 VR World
 * (a MiniMax H3 performer inside it) or any 360 viewer.
 *
 *   TRIGGER     the LoRA's trigger sentence - every prompt starts with it, the description follows
 *   LORA        qwen_image_2_1_360_panorama_outpaint_lora_v0_1.safetensors at 0.8 (its card), the model catalogue's
 *               qwen21_pano360 (the models check offers the download) - Qwen Research License: non-commercial, like
 *               Qwen Image 2.1 itself
 *   SIZES       2048 x 1024 (the card's) and 1408 x 704 (trained at 1408 x 704 / 1088 x 544 - faster)
 *   SEAM        the seam pass: the panorama turned half way round (the left / right join in the middle) with a green
 *               strip over the join - the same model fills it (the pack's Panorama Seam Prep idea); pcpano.js turns it back
 *   pickStyle   the Qwen Image 2.1 edit style (its models), the LoRA added to its LoRAs for this job
 *   jobParams   one mode "image" job: the graph, the green canvas as its picture, 25 steps, cfg 1
 */
const TRIGGER = "Fill the green areas to complete a seamless 360° equirectangular panorama.";
const LORA = "qwen_image_2_1_360_panorama_outpaint_lora_v0_1.safetensors";
const LORA_WEIGHT = 0.8;
const WORKFLOW = "comfy_workflows/img_qwen21_pano360.json";
const STYLE_NAME = "Qwen Image 2.1 edit";
const SIZES = [
  { id: "2048", width: 2048, height: 1024, label: "2048 × 1024 - the best (the LoRA's own size)" },
  { id: "1408", width: 1408, height: 704, label: "1408 × 704 - faster" },
];
const MAX_DESC = 1200;
const SEAM_STRIP = 1 / 12;            // the seam pass's green strip: a twelfth of the width, over the join

/** the description, tidied: no trigger twice, one line, at most MAX_DESC characters */
function cleanDesc(d) {
  let s = String(d == null ? "" : d).replace(/\s+/g, " ").trim();
  if (s.toLowerCase().startsWith(TRIGGER.toLowerCase())) s = s.slice(TRIGGER.length).trim();
  return s.slice(0, MAX_DESC);
}
/** the prompt: the trigger, then the description (where it is, what is round it, where the light comes from) */
function prompt(desc) { const d = cleanDesc(desc); return d ? TRIGGER + " " + d : TRIGGER; }
function size(id) { return SIZES.find((s) => s.id === String(id)) || SIZES[0]; }
/** the Qwen Image 2.1 edit style among `list` (by name, else a Qwen 2.1 edit graph with no LoRA of its own) */
function pickStyle(list) {
  const all = Array.isArray(list) ? list : [];
  return all.find((s) => s && s.name === STYLE_NAME && s.kind !== "video")
    || all.find((s) => s && /img_qwen21_edit\.json$/.test(String(s.workflow || "")) && !(s.loras || []).length)
    || null;
}
/** the style for this job: the edit style's models + the panorama LoRA (no other LoRA - Turbo8 would fight it) */
function withLora(style) {
  if (!style) return null;
  return Object.assign({}, style, { loras: [{ path: LORA, weight: LORA_WEIGHT }], steps: 25, cfg: 1, workflow: WORKFLOW });
}
/** one image job's parameters (core.makeJob) */
function jobParams(style, o) {
  const q = o || {}, s = size(q.size), st = withLora(style);
  return {
    mode: "image", prompt: prompt(q.desc), style: st, style_id: style.id, style_name: "🌐 360 panorama (" + style.name + " + the 360 outpaint LoRA)",
    width: s.width, height: s.height, batch: 1, workflow: WORKFLOW, images: [q.file],
    workflow_note: q.seam ? "360 panorama - the seam pass (the join in the middle, filled)" : "360 panorama - the green filled into a seamless 360° picture",
    no_assets: true, pano360: q.seam ? "seam" : "make",
  };
}

module.exports = { TRIGGER, LORA, LORA_WEIGHT, WORKFLOW, STYLE_NAME, SIZES, SEAM_STRIP, MAX_DESC, cleanDesc, prompt, size, pickStyle, withLora, jobParams };
