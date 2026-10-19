// bitGen Studio — SETUP: the settings for THIS hardware (2.331.0).
//
// Tim: "Do a gpu check, set up bitgen studio for the hardware the user is
// using ... start using bitgen studio immediately after setup". A profile
// from lib/setupGpu.js becomes (1) a settings PATCH merged into
// custom.settings through lib/core (never a hand-written file), and (2) the
// models the download page pre-ticks. Pure - tested per tier.
"use strict";

/** Render size + the single-run ceiling per VRAM tier. The size is 16-px
 *  aligned (Basic Settings' rule); the ceiling is in frames on H3's 17k+5
 *  grid - 0 = the model's own (362, ~15 s). Below 20 GB a render that will
 *  not fit is split into runs that do (chunk_on_oom) instead of failing. */
const TIERS = {
  max: { width: 960, height: 544, ceiling: 0, chunk: false },
  high: { width: 960, height: 544, ceiling: 0, chunk: false },
  mid: { width: 768, height: 432, ceiling: 209, chunk: true },
  low: { width: 640, height: 352, ceiling: 107, chunk: true },
  none: { width: 640, height: 352, ceiling: 107, chunk: true },
};

/** Which chat LLM (catalog id) fits WHERE it will run. Two cards: the
 *  second card's VRAM; one card: beside the video model it must be small
 *  (and is not auto-started, so a render gets the whole card). */
function llmChoice(p) {
  const onSecond = p.second_vram_gb > 0;
  const room = onSecond ? p.second_vram_gb : p.vram_gb;
  let id = "";
  if (onSecond) id = room >= 12 ? "llm_14b" : room >= 7 ? "llm_8b" : room >= 4 ? "llm_4b" : "";
  else if (p.cuda) id = room >= 20 ? "llm_8b" : "llm_4b";
  else id = "llm_4b";
  return {
    id,
    device: onSecond ? `cuda${p.second.index}` : p.cuda ? `cuda${p.main.index}` : "cpu",
    autostart: onSecond,                  // its own card: always ready
    why: onSecond ? `the LLM runs on ${p.second.name} (the second card), always on`
      : p.cuda ? "one card: the LLM shares it with the video model - it starts when you use it"
      : "no NVIDIA GPU: the LLM runs on the CPU (slow)",
  };
}

/** The settings patch (deep-merged into the live config by setupRun). */
function patch(p, opts) {
  const o = opts || {};
  const t = TIERS[p.tier] || TIERS.none;
  const llm = llmChoice(p);
  const cuda = p.cuda ? "cuda" : "cpu";
  const out = {
    defaults: { width: t.width, height: t.height },
    engine: { backend: "comfy",
              comfy: { autostart: true, vram_ceiling: t.ceiling,
                       vram_ceiling_note: t.ceiling ? `set by setup for ${p.vram_gb} GB of VRAM` : "",
                       chunk_on_oom: t.chunk,
                       // under 14 GB the 32B text encoder lives in system RAM
                       // while the sampler has the card (it costs ~2 min of
                       // prompt encoding per run, so only where it must)
                       clip_device: p.tier === "low" || p.tier === "none" ? "cpu" : "default" } },
    llm: { device: llm.device, autostart: llm.autostart, gpu_layers: p.cuda || llm.device !== "cpu" ? -1 : 0 },
    captioner: { device: llm.device },
    tts: { device: cuda },
    asr: { device: p.cuda ? "cuda" : "cpu" },
    stems: { device: p.cuda ? "cuda" : "cpu" },
    setup: { tier: p.tier, gpu: p.main ? p.main.name : "", vram_gb: p.vram_gb, when: o.when || "" },
  };
  if (o.python) out.python = o.python;
  return out;
}

/** The catalog ids the model page pre-ticks for this machine. */
function recommend(p, opts) {
  const o = opts || {};
  const ids = [];
  if (p.cuda || p.platform === "darwin")
    ids.push("h3_ref2va", "h3_fl2va", "h3_te", "h3_vvae", "h3_avae", "h3_turbo_ref", "h3_turbo_fl",
             "taeh3", "h3_swap_lora", "h3_charswap_lora", "face_yolo");
  // 2.332.0: the image editor's AI - Kontext (+ the FLUX Fill inpaint
  // Regenerate style, same four files) from 14 GB; Qwen Image Edit from 20 GB
  if (["mid", "high", "max"].includes(p.tier)) ids.push("kontext", "flux_clip_l", "flux_t5", "flux_ae");
  if (["high", "max"].includes(p.tier)) ids.push("qwen_edit", "qwen_te", "qwen_vae", "qwen_lightning");
  // 2.337.0: Qwen Image 2.1 (~17 GB with its encoder) - the scenes' ✎ First frame
  if (["mid", "high", "max"].includes(p.tier)) ids.push("qwen21", "qwen21_te", "qwen21_vae");
  const llm = llmChoice(p);
  if (llm.id) ids.push(llm.id);
  if (o.omnivoice) ids.push("omnivoice");
  return ids;
}

/** Deep merge (objects only; arrays and scalars replace). */
function merge(into, from) {
  for (const [k, v] of Object.entries(from || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!into[k] || typeof into[k] !== "object" || Array.isArray(into[k])) into[k] = {};
      merge(into[k], v);
    } else into[k] = v;
  }
  return into;
}

/** One line per decision - the installer's "Set up for your hardware" card. */
function summary(p) {
  const t = TIERS[p.tier] || TIERS.none;
  const llm = llmChoice(p);
  return [
    `renders at ${t.width}x${t.height}` + (t.ceiling ? `, scenes of up to ${(t.ceiling / 24).toFixed(1)} s per run (longer ones split)` : ", full-length single runs (~15 s)"),
    p.tier === "low" || p.tier === "none" ? "the 32B text encoder stays in system RAM so the sampler gets the card"
      : "the text encoder is placed by ComfyUI",
    llm.why,
    p.cuda ? `speech, transcription and stems on the GPU` : "speech, transcription and stems on the CPU",
  ];
}

module.exports = { TIERS, llmChoice, patch, recommend, merge, summary };
