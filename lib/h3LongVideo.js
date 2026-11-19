/* bitGen Studio — lib/h3LongVideo.js (2.872.0): H3 LONG VIDEO - one prompt, several chained MiniMax H3 shots, one video.
 *
 * Tim (verbatim): "this workflow is for 40 second h3 video. can we add this one and remove the 30sec one - the 30sec one
 * changes faces and flow after 15secs". His export (Long Videos MiniMax H3 - 2K upscaler) runs the H3LongVideos node
 * (the H3-LongVideos pack, installed from its own page - its licence forbids passing it on, so bitGen Studio never ships
 * it): the prompt's FIRST paragraph is the anchor (scene + style, repeated on every shot), every later paragraph is one
 * beat = one shot, and each shot starts from the last frame of the one before - so faces and the flow hold where the old
 * 30 s single run drifted after 15 s. Its model is MATLOWAI's fused turbo int8 file (8 steps), its attention is PlagueKind's
 * H3 SLA (sparse) attention behind ComfyUI's comfy kitchen backend, and its 2K pass is NVIDIA's RTX Video Super Resolution
 * (Comfy-Org's ComfyUI_Nvidia_VFX_Nodes). Nothing here is copied from the export: the graph is BUILT from the class and
 * input names it uses, against what the running ComfyUI says each node takes (/object_info) - a value is only written to
 * an input that exists, every other input gets ComfyUI's own default (the node packs change between versions).
 *
 *   PACKS / NODE / SLA / RTX / CLEAN / BACKEND / WANT / VALUES / SLA_VALUES
 *   readiness(info)                  {ok, missing [words], warnings [words], names {unet, clip, vvae, avae}, has {...}}
 *   graph(o)                         {graph, uploads, applied, warnings}  (o: info, names, prompt, seed, first, refs[≤4],
 *                                     memory, width, height, shotSeconds, shotLength, upscale2k, prefix)
 *   beats(text) / compose(anchor, beats) / plan(text, seconds) / memory(cast, firstFrame) / wants(o) / ratio(w, h, list)
 */
"use strict";
const G = require("./graphToApi");

const PACKS = {
  long: { id: "h3long", folder: "H3-LongVideos", url: "https://huggingface.co/Smite79/MiniMax-H3-Longvideos",
          licence: "its own (h3-longvideos-no-redistribution) - installed from its page, never bundled" },
  sla: { id: "plaguekind", folder: "ComfyUI-PlagueKind-Nodes", url: "https://github.com/PlagueKind/ComfyUI-PlagueKind-Nodes", licence: "MIT" },
  rtx: { id: "nvvfx", folder: "ComfyUI_Nvidia_VFX_Nodes", url: "https://github.com/Comfy-Org/ComfyUI_Nvidia_VFX_Nodes", licence: "Apache-2.0" },
};
const NODE = "H3LongVideos", SLA = "H3SLAAttention", RTX = "RTXVideoSuperResolution";
const CLEAN = "easy cleanGpuUsed", BACKEND = "ModelAttentionBackend";
const CORE = ["UNETLoader", "CLIPLoader", "VAELoader", "LoadImage", "CreateVideo", "SaveVideo"];
const MODEL_FILE = "minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors";
/* what each loader looks for in ComfyUI's lists, best first (a plain MiniMax H3 file still runs - slower, 20+ steps) */
const WANT = {
  unet: ["minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot", "minimax_h3_fused"],
  clip: ["qwen3vl_32b_minimax_h3_nvfp4_awq", "qwen3vl_32b_minimax_h3"],
  vvae: ["minimax_h3_video_vae"],
  avae: ["minimax_h3_audio_vae"],
};
/* the export's own settings for the long-video node (its sampler is the turbo file's: 8 steps, cfg 1, res_multistep) */
const VALUES = {
  resolution: "16:9", megapixels: 0.5, shot_seconds: 15, steps: 8, cfg: 1, sampler_name: "res_multistep", scheduler: "simple",
  shift_video: 10, shift_audio: 3, apply_model_sampling: false, silence_nonspeech: true, trim_seam: true, ref_noise_aug: 0.999,
  tiled_decode: true, cleanup_between_shots: true, latent_upscale: "off", latent_upscale_scale: 2, upscale: "off",
  upscale_model: "none", upscale_target_short_edge: 0, upscale_batch: 1, shot_length: "fixed", auto_remove: false,
  restart_after_removal: false, hold_restraints: false, plan_only: false, anchor: "", character_guard: true, pace: 1,
  auto_sound: true, hold_scene_state: true, mouths_shut_when_no_line: true, hold_gaze: true, ambient_level: 0.25,
  foley_level: 0.35, speech_lead_seconds: 0.2, speech_tail_seconds: 0.3, beat_leads: true, hold_levels: 0.8,
  hold_camera: true, verbatim: true,
};
const SLA_VALUES = { sparsity_ratio: 0.9, block_size: "64", min_seq_len: 8192, dense_last_steps: 0, protect_audio: true,
  enabled: true, dense_steps: "1", dense_backend: "comfy_kitchen", disable_fp16_accum: true, stabilize_motion: false,
  reference_protection: "Off", tail_correction: false, use_int8_qk: true, engine: "comfy_kitchen" };
const SHOT_MAX = 15;          // seconds one shot holds well (the old single runs drifted past it)
const MAX_SECONDS = 120;      // the pack's own "about two minutes"
const SHOT_LENGTHS = ["fixed", "from the beat"];

/* ---- /object_info reading ---- */
function spec(info, cls) { return info && info[cls] ? info[cls] : null; }
function inputSpec(info, cls, name) {
  const s = spec(info, cls); if (!s || !s.input) return null;
  return (s.input.required || {})[name] || (s.input.optional || {})[name] || null;
}
function optionsOf(info, cls, name) {
  const sp = inputSpec(info, cls, name); if (!sp) return [];
  if (Array.isArray(sp) && Array.isArray(sp[0])) return sp[0].map(String);
  const o = Array.isArray(sp) ? sp[1] || {} : sp;
  return Array.isArray(o.options) ? o.options.map(String) : Array.isArray(o.values) ? o.values.map(String) : [];
}
/** the best file in a loader's list for one of WANT's kinds ("" = none) */
function pick(list, kind) {
  const L = (list || []).map(String);
  for (const w of WANT[kind] || []) {
    const hit = L.find((x) => x.toLowerCase().replace(/\\/g, "/").split("/").pop().startsWith(w.toLowerCase()));
    if (hit) return hit;
  }
  return "";
}
function readiness(info) {
  const missing = [], warnings = [];
  const has = { node: !!spec(info, NODE), sla: !!spec(info, SLA), rtx: !!spec(info, RTX), clean: !!spec(info, CLEAN), backend: !!spec(info, BACKEND) };
  if (!has.node) missing.push(`the H3-LongVideos node pack (${NODE}) - Settings ▸ Add-ons ▸ H3 Long Video ⤓ Install, then restart ComfyUI`);
  for (const c of CORE) if (!spec(info, c)) missing.push(`ComfyUI's ${c} node - update ComfyUI`);
  const names = {
    unet: pick(optionsOf(info, "UNETLoader", "unet_name"), "unet"),
    clip: pick(optionsOf(info, "CLIPLoader", "clip_name"), "clip"),
    vvae: pick(optionsOf(info, "VAELoader", "vae_name"), "vvae"),
    avae: pick(optionsOf(info, "VAELoader", "vae_name"), "avae"),
  };
  if (!names.unet) missing.push(`the model ${MODEL_FILE} (models/diffusion_models)`);
  if (!names.clip) missing.push("the MiniMax H3 text encoder qwen3vl_32b_minimax_h3_nvfp4_awq (models/text_encoders)");
  if (!names.vvae) missing.push("the MiniMax H3 video VAE (models/vae)");
  if (!names.avae) missing.push("the MiniMax H3 audio VAE (models/vae)");
  if (names.unet && !/fused/i.test(names.unet)) warnings.push("not the fused turbo model - set more steps");
  if (!has.sla) warnings.push(`no ${SLA} (PlagueKind's node pack) - it renders with full attention: slower, more VRAM`);
  if (!has.backend) warnings.push(`no ${BACKEND} - update ComfyUI for comfy kitchen attention`);
  return { ok: !missing.length, missing, warnings, names, has };
}

/* ---- one API node, by input name ---- */
function make(info, cls, vals, links, warn) {
  const s = spec(info, cls) || { input: {} };
  const inputs = {};
  const walk = (list) => {
    for (const w of list) {
      const v = (vals || {})[w.name];
      if (v !== undefined && G.fits(w, v)) inputs[w.name] = v;
      else G.fillDefault(inputs, w);
      if (w.dyn) walk(G.dynChildren(w.name, w.dyn, inputs[w.name]));
    }
  };
  walk(G.widgetNames(s) || []);
  const req = (s.input || {}).required || {}, opt = (s.input || {}).optional || {};
  for (const [k, v] of Object.entries(links || {})) {
    if (!v) continue;
    if (k in req || k in opt) inputs[k] = v;
    else if (warn) warn(`${cls} has no "${k}" input in this version - left out`);
  }
  return { class_type: cls, inputs };
}

/** the resolution choice closest to w x h (the node's own list, e.g. 16:9 / 9:16 / 1:1 …) */
function ratio(w, h, list) {
  const L = (list && list.length ? list : ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]).map(String);
  const want = (+w > 0 && +h > 0) ? +w / +h : 16 / 9;
  let best = L[0], bd = Infinity;
  for (const o of L) {
    const m = o.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/); if (!m) continue;
    const d = Math.abs(Math.log((+m[1] / +m[2]) / want));
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
const mp = (w, h) => { const v = (+w || 960) * (+h || 544) / 1e6; return Math.round(Math.min(2, Math.max(0.2, v)) * 100) / 100; };

function graph(o) {
  const info = o.info || {}, names = o.names || {}, warnings = [];
  const warn = (s) => { if (!warnings.includes(s)) warnings.push(s); };
  const g = {}, uploads = [];
  let id = 0;
  const add = (node) => { const k = String(++id); g[k] = node; return k; };
  const clean = (link) => (spec(info, CLEAN) ? [add(make(info, CLEAN, {}, { anything: link }, warn)), 0] : link);
  const unet = add(make(info, "UNETLoader", { unet_name: names.unet, weight_dtype: "fp8_e4m3fn" }, {}, warn));
  let model = clean([unet, 0]);
  if (spec(info, SLA)) model = [add(make(info, SLA, SLA_VALUES, { model }, warn)), 0];
  if (spec(info, BACKEND)) {
    const opts = optionsOf(info, BACKEND, "attention");
    const att = opts.find((x) => /kitchen/i.test(x));
    if (att) model = [add(make(info, BACKEND, { attention: att }, { model }, warn)), 0];
  }
  const clip = clean([add(make(info, "CLIPLoader", { clip_name: names.clip, type: "minimax", device: "default" }, {}, warn)), 0]);
  const vvae = clean([add(make(info, "VAELoader", { vae_name: names.vvae }, {}, warn)), 0]);
  const avae = clean([add(make(info, "VAELoader", { vae_name: names.avae }, {}, warn)), 0]);
  const load = (file, input) => {
    const k = add(make(info, "LoadImage", { image: "" }, {}, warn));
    uploads.push({ node: k, input: "image", path: file, kind: input });
    return [k, 0];
  };
  const links = { model, clip, vae: vvae, audio_vae: avae };
  if (o.first) links.first_frame = load(o.first, "first_frame");
  (o.refs || []).filter(Boolean).slice(0, 4).forEach((f, i) => { links[`ref_image_${i + 1}`] = load(f, `ref_image_${i + 1}`); });
  const shotSeconds = Math.max(1, Math.min(60, +o.shotSeconds || VALUES.shot_seconds));
  const vals = Object.assign({}, VALUES, {
    prompt: String(o.prompt || ""),
    resolution: ratio(o.width, o.height, optionsOf(info, NODE, "resolution")),
    megapixels: mp(o.width, o.height),
    shot_seconds: shotSeconds,
    shot_length: SHOT_LENGTHS.includes(o.shotLength) ? o.shotLength : "fixed",
    seed: Math.max(0, Math.floor(+o.seed || 0)),
    character_memory: String(o.memory || ""),
  });
  if (o.steps > 0) vals.steps = Math.round(+o.steps);
  const main = add(make(info, NODE, vals, links, warn));
  const save = (images, prefix) => {
    const v = add(make(info, "CreateVideo", { fps: 24 }, { images, audio: [main, 1] }, warn));
    return add(make(info, "SaveVideo", { filename_prefix: prefix, format: "auto", codec: "auto" }, { video: [v, 0] }, warn));
  };
  const prefix = String(o.prefix || "h3long").replace(/[^\w.-]+/g, "_");
  save([main, 0], "video/" + prefix);
  const applied = [`${vals.resolution} · ${vals.megapixels} MP · ${vals.shot_length} shots of ${shotSeconds} s · seed ${vals.seed}`
    + (links.first_frame ? " · first frame" : "") + (o.refs && o.refs.length ? ` · ${Math.min(4, o.refs.filter(Boolean).length)} reference picture(s)` : "")];
  if (o.upscale2k) {
    if (spec(info, RTX)) {
      const up = add(make(info, RTX, { resize_type: "scale by multiplier", "resize_type.scale": 2, quality: "ULTRA" }, { images: [main, 0] }, warn));
      save([up, 0], "2K_Video/" + prefix);          // saved LAST: the job's file (@@OUT) is the 2K one
      applied.push("2K: NVIDIA RTX Video Super Resolution x2 (ULTRA)");
    } else warn(`no ${RTX} (ComfyUI_Nvidia_VFX_Nodes) - the 2K pass is skipped`);
  }
  return { graph: g, uploads, applied, warnings };
}

/* ---- the prompt: anchor paragraph + one paragraph per shot ---- */
function beats(text) {
  return String(text || "").replace(/\r/g, "").split(/\n\s*\n+/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
}
function compose(anchor, list) { return [String(anchor || "").trim()].concat((list || []).map((b) => String(b).trim())).filter(Boolean).join("\n\n"); }
const sentences = (t) => (String(t || "").match(/[^.!?。！？]+(?:[.!?。！？]+["”’)]*|$)/g) || []).map((s) => s.trim()).filter(Boolean);
/** a prompt as the node wants it for `seconds`: already paragraphs -> kept; one block -> the first sentence is the anchor
 *  and the rest is shared out over ceil(seconds / 15) shots. -> {prompt, shots, shotSeconds, split} */
function plan(text, seconds) {
  const secs = Math.max(1, Math.min(MAX_SECONDS, +seconds || SHOT_MAX));
  const want = Math.max(1, Math.ceil(secs / SHOT_MAX - 1e-9));
  const p = beats(text);
  if (p.length >= 2) {
    const shots = p.length - 1;
    return { prompt: compose(p[0], p.slice(1)), shots, shotSeconds: Math.round(secs / shots * 100) / 100, split: false };
  }
  const s = sentences(p[0] || "");
  if (s.length < 2) return { prompt: compose(p[0] || "", [p[0] || ""]), shots: 1, shotSeconds: Math.round(secs * 100) / 100, split: false };
  const anchor = s[0], rest = s.slice(1);
  const n = Math.min(want, rest.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push(rest.slice(Math.floor(i * rest.length / n), Math.floor((i + 1) * rest.length / n)).join(" "));
  return { prompt: compose(anchor, out), shots: n, shotSeconds: Math.round(secs / n * 100) / 100, split: true };
}
/** "Name: <Picture k>, description" lines - pictures numbered in input order (first frame, then ref_image_1..4) */
function memory(cast, firstFrame) {
  let k = firstFrame ? 2 : 1;
  return (cast || []).filter((c) => c && c.name).slice(0, 4).map((c) => {
    const line = `${String(c.name).trim()}: <Picture ${k++}>` + (c.desc ? ", " + String(c.desc).replace(/\s+/g, " ").trim() : "");
    return line;
  }).join("\n");
}
/** does this render go through H3 Long Video? (an H3 Long Video style; or the board's ⚙ Long video on a scene with no
 *  song that runs longer than one shot) */
function wants(o) {
  const s = (o && o.style) || {};
  if (s.arch === "h3-long") return true;
  return !!(o && o.longRun && o.noSong && +o.seconds > SHOT_MAX);
}
const isStyle = (s) => !!(s && s.arch === "h3-long");

/* ---- ComfyUI's node list, kept a few minutes (the StoryBoard queues scenes from a synchronous poll) ---- */
let _info = null, _at = 0;
const KEEP_MS = 5 * 60 * 1000;
async function prime(o) {
  const f = (o && o.objectInfo) || (() => require("./comfy").objectInfo(15000));
  if (_info && Date.now() - _at < KEEP_MS && !(o && o.force)) return _info;
  _info = await f(); _at = Date.now();
  return _info;
}
const cached = () => _info;
function remember(info) { _info = info || null; _at = info ? Date.now() : 0; }

/** the job's params for core.makeJob (mode "graph") or {error, missing} - o: info, prompt, seconds, width, height, seed,
 *  steps, first, refs, memory, shotLength, upscale2k, prefix, name */
function params(o) {
  const info = o.info || cached();
  if (!info) return { error: "ComfyUI's node list could not be read - is ComfyUI running? Press ▶ again", missing: [] };
  const rd = readiness(info);
  if (!rd.ok) return { error: "H3 Long Video needs: " + rd.missing.join(" · "), missing: rd.missing, needs: "h3long" };
  const pl = plan(o.prompt, o.seconds);
  const shotLength = SHOT_LENGTHS.includes(o.shotLength) ? o.shotLength : "fixed";
  const seed = Number.isFinite(+o.seed) && +o.seed >= 0 ? Math.floor(+o.seed) : Math.floor(Math.random() * 2 ** 48);
  const built = graph({ info, names: rd.names, prompt: pl.prompt, seed, first: o.first, refs: o.refs, memory: o.memory,
    width: o.width, height: o.height, shotSeconds: pl.shotSeconds, shotLength, upscale2k: !!o.upscale2k, steps: o.steps,
    prefix: o.prefix || "h3long" });
  const notes = [`H3 Long Video: ${pl.shots} shot${pl.shots > 1 ? "s" : ""} of ${pl.shotSeconds} s (${shotLength})`
    + (pl.split ? " - one block of text, shared out over the shots (a blank line between paragraphs sets them yourself)" : "")];
  return { notes, seed, plan: pl, params: {
    mode: "graph", graph: built.graph, graph_uploads: built.uploads,
    graph_name: o.name || "H3 Long Video", graph_file: "(H3 Long Video - H3-LongVideos + MiniMax H3 fused turbo)",
    graph_applied: built.applied.concat(notes), graph_warnings: rd.warnings.concat(built.warnings),
    seed, prompt: pl.prompt, frames: Math.round(pl.shots * pl.shotSeconds * 24) } };
}

module.exports = { PACKS, NODE, SLA, RTX, CLEAN, BACKEND, CORE, MODEL_FILE, WANT, VALUES, SLA_VALUES, SHOT_MAX, MAX_SECONDS,
  SHOT_LENGTHS, readiness, graph, prime, cached, remember, params, make, pick, optionsOf, ratio, mp, beats, compose, plan, memory, wants, isStyle };
