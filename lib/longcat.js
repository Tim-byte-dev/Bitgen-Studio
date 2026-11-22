"use strict";
/**
 * longcat.js — LONGCAT-VIDEO-AVATAR 1.6, A TALKING / SINGING PERSON FROM A SOUND (2.918.0).
 *
 * Tim (verbatim): "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"
 *
 * Meituan LongCat's audio-driven avatar model (MIT weights): a start picture of the person (or none - the prompt alone), a
 * prompt and the speech -> a 25 fps video AS LONG AS THE SPEECH (93-frame segments, each continuing from the last 13; past
 * 10 minutes holds up), 8 distilled steps a segment (the DMD LoRA, then the OPSD LoRA). ComfyUI's own support is still a
 * pull request, so it runs in the ComfyUI-LongCat-Avatar node pack (PedroMarinhoDev, "LongCat Avatar Native" - ComfyUI's
 * samplers / LoRA patches / dynamic VRAM); Settings ▸ Add-ons ▸ LongCat Avatar 1.6 installs the pack and the files
 * (lib/longcatAddon.js). A video style whose arch is "longcat_avatar" (the starter "LongCat Avatar 1.6") is sent by the
 * prompt docker to POST /api/longcat (routes/longcat.js, static/longcatgen.js) and rendered by misc/longcat_worker.py
 * (scripts/longcat_graph.py). The References docker's first sound is the speech (needed), its first picture (the one typed
 * "first frame" first) the person; Basic Settings' size picks 480p or 720p, the picture's shape the release's bucket.
 *   isLongcatStyle(st) / ARCH / FPS
 *   params(o)       -> the job's params | {error}     o = {style, prompt, image, audio: {path, start}, width, height, seed, max_seconds}
 *   withBasic(st, basic, f) -> {style, bo, seed}     Basic Settings' Override style (its seed; the size goes as sent)
 *   summary(p)      the queue's words
 *   comfySupport(o) -> {online, nodes}                does the running ComfyUI have the pack's nodes?
 */
const fs = require("fs");
const path = require("path");

const ARCH = "longcat_avatar";
const FPS = 25;
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const SOUND_EXT = [".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus"];
const DEFAULTS = { mix_steps: 4, mix_alpha: 1.0, ref_img_index: 10 };
const NODE = "LongCatAvatarVideo";

const isLongcatStyle = (st) => !!st && st.kind === "video" && String(st.arch || "") === ARCH;

function params(o) {
  const x = o || {};
  const st = x.style;
  if (!isLongcatStyle(st)) return { error: "not a LongCat Avatar style" };
  const img = String(x.image || "");
  if (img) {
    if (!IMAGE_EXT.includes(path.extname(img).toLowerCase())) return { error: `${path.basename(img)} is not a picture` };
    if (!fs.existsSync(img)) return { error: `the picture is gone: ${path.basename(img)}` };
  }
  const au = x.audio && x.audio.path ? String(x.audio.path) : "";
  if (!au) return { error: "LongCat Avatar makes the person talk or sing to a sound - put the speech (or a song's vocals) in the References docker first" };
  if (!SOUND_EXT.includes(path.extname(au).toLowerCase())) return { error: `${path.basename(au)} is not a sound (WAV, MP3, FLAC, M4A, OGG)` };
  if (!fs.existsSync(au)) return { error: `the sound is gone: ${path.basename(au)}` };
  const prompt = String(x.prompt || "").trim();
  if (!prompt) return { error: "write the prompt first - who is talking, how they look and move, where they are" };
  const ph = (Array.isArray(st.phases) && st.phases[0]) || {};
  const seed = parseInt(x.seed, 10);
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const w = parseInt(x.width, 10), h = parseInt(x.height, 10);
  return {
    mode: "longcat", prompt: prompt.slice(0, 8000), image: img,
    audio: { path: au, start: Math.max(0, +((x.audio || {}).start) || 0) },
    width: Number.isFinite(w) && w > 0 ? w : 832, height: Number.isFinite(h) && h > 0 ? h : 480,
    seed: Number.isFinite(seed) && seed >= 0 ? seed : -1,
    max_seconds: num(x.max_seconds != null ? x.max_seconds : st.max_seconds, 0, 0, 3600),
    mix_steps: num(st.mix_steps, DEFAULTS.mix_steps, 0, 8), mix_alpha: num(st.mix_alpha, DEFAULTS.mix_alpha, 0, 1),
    ref_img_index: num(st.ref_img_index, DEFAULTS.ref_img_index, -1000, 1000),
    model: String(x.model || ph.model || ""), te: String(((st.te || [])[0]) || ""), vae: String(st.vae || ""),
    format: "mp4",
    video_style: st, video_style_id: st.id || null, video_style_name: st.name || "LongCat Avatar 1.6",
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
  };
}

/** Basic Settings' Override style on a LongCat render: its seed (and model when Use model sends one); LongCat's 8
 *  distilled steps and cfg 1 are the model's own - Basic Settings' steps / CFG do not apply (said in the note) */
function withBasic(st, basic, f) {
  const BO = require("./basicOverride"), bo = BO.parse(basic), x = f || {};
  const style = BO.withStyle(st, bo, { loras: false });
  const seed = bo ? require("./seedPick").pick(bo.seed, style, { override: true, max: 2 ** 31 - 1 })
    : x.seed === undefined || x.seed === "" ? -1 : +x.seed;
  return { style, bo, seed, model: bo && bo.model ? String(bo.model) : "" };
}

function summary(p) {
  const bits = [`LongCat Avatar 1.6 ${p.image ? "from a start picture" : "from the prompt alone"}`,
    `talking to ${path.basename(p.audio.path)}${p.audio.start ? ` from ${p.audio.start}s` : ""}`,
    p.max_seconds ? `the first ${p.max_seconds}s of it` : "as long as the sound",
    `${FPS} fps, 8 distilled steps a segment (93 frames, each continuing from 13)`,
    "480p or 720p by Basic Settings' size, the bucket by the picture's shape"];
  return bits.join(" · ");
}

async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, nodes: false };
  try {
    const r = await f(`${String(url).replace(/\/$/, "")}/object_info/${NODE}`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return { online: true, nodes: false };
    const j = await r.json().catch(() => null);
    return { online: true, nodes: !!(j && j[NODE]) };
  } catch { return { online: false, nodes: false }; }
}

module.exports = { ARCH, FPS, DEFAULTS, NODE, IMAGE_EXT, SOUND_EXT, isLongcatStyle, params, withBasic, summary, comfySupport };
