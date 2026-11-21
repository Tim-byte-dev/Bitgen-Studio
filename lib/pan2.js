"use strict";
/**
 * lib/pan2.js — PAN 2 VIDEO STYLES (2.890.0).
 *
 * Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2"
 *
 * PAN 2 (IFM at MBZUAI, Apache-2.0) is a 29B world model: text, or a first picture + text, becomes a video at 24 fps -
 * 1248 x 704 is what it was trained at, 10 s by default, up to 20 s (481 frames). ComfyUI runs it with its OWN nodes
 * since PR #17755 (15 Nov 2026, the v0.46.0 release): UNETLoader, CLIPLoader type "pan2" (Qwen3.5-9B), the Wan 2.2 VAE,
 * Wan22ImageToVideoLatent (a first picture optional), KSampler euler / simple, 50 steps, cfg 2.5, shift 9. The files are
 * Comfy-Org/PAN2's repacks (Settings ▸ Add-ons ▸ PAN 2, lib/pan2Addon.js).
 *
 * THE PROMPT. PAN 2 was trained on structured JSON world-state captions - a one-line prompt comes back as noise. So the
 * words the user types are rewritten by the app's LLM with PAN 2's own rewriter policy (lib/pan2/system_prompt.md,
 * ifm-ai/PAN2 inference/pan-prompt-rewriter, Apache-2.0, unchanged) into the seven-key caption, checked here the way
 * their prompt_tools.py checks it (keys and order, events covering 0..duration, camera tags, subject IDs), asked once
 * more with the problems when it is wrong, and wrapped by bitGen as a one-event caption when there is no LLM or it
 * fails twice (said in the job's log). A prompt that already IS a caption is used as it is. The negative is their fixed
 * generic negative (lib/pan2/generic_negative.txt) with its three "0 to {duration_sec}" filled in; words in the ⊖
 * negative docker are added to its video_style line.
 *
 *   isPan2Style(st)          a video style whose arch is "pan2"
 *   framesFor(seconds)       4n+1 at 24 fps, 25..481
 *   size(w, h)               32-px steps, 256..2048 (1248 x 704 when not given)
 *   parseCaption(text)       -> the caption object | null (a JSON caption string, or {"refined_prompt": "..."})
 *   check(cap, seconds)      -> [problems] (empty = fine)
 *   ordered(cap)             the seven keys in their order (nothing else changed)
 *   wrap(prompt, seconds, o) a one-event caption from plain words (no LLM)
 *   negative(seconds, extra) the fixed negative, its times filled in (+ the user's words)
 *   caption(o) async         -> {caption (string), how: "given" | "llm" | "wrapped", notes}
 *   params(o)                -> job params (mode "pan2") | {error}
 *   summary(p)               a line for the queue / the log
 *   comfySupport(o) async    -> {online, nodes} - does the running ComfyUI know CLIPLoader type "pan2"?
 */
const fs = require("fs");
const path = require("path");

const FPS = 24;
const MAX_SECONDS = 20;
const DEFAULT_SECONDS = 10;
const W0 = 1248, H0 = 704;
const KEYS = ["video_style", "lighting", "perspective_view", "subjects_lifecycle", "init_frame_visual_description", "events", "quality"];
const CAMERAS = ["static", "pan_left", "pan_right", "tilt_up", "tilt_down", "track_left", "track_right", "dolly_forward",
  "dolly_backward", "dolly_up", "dolly_down", "zoom_in", "zoom_out", "roll_clockwise", "roll_counterclockwise", "unstable"];
const ID_RE = /<\|Subject[1-9][0-9]*\|>/g;
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const DEFAULTS = { steps: 50, cfg: 2.5, shift: 9, sampler: "euler", scheduler: "simple" };
// the soft limit is 1,480 tokens of PAN 2's own tokenizer - characters are only a rough guide (about 4 a token)
const SOFT_CHARS = 1480 * 4;
const UPDATE = "PAN 2 runs in ComfyUI's own nodes since 15 Nov 2026 (the v0.46.0 release) - update ComfyUI (Settings ▸ ComfyUI ▸ "
  + "⤓ Update ComfyUI, or the portable build's update\\update_comfyui.bat), then restart it";

const isPan2Style = (st) => !!st && st.kind === "video" && String(st.arch || "") === "pan2";

function framesFor(seconds) {
  const s = Math.max(1, Math.min(MAX_SECONDS, +seconds || DEFAULT_SECONDS));
  let n = Math.round(s * FPS) + 1;
  n = Math.max(25, Math.min(481, n));
  return n - ((n - 1) % 4);
}
/** seconds the frames really last (the caption's events must cover exactly this) - one decimal */
const secondsOf = (frames) => Math.round(((frames - 1) / FPS) * 10) / 10;

function size(w, h) {
  const r = (v, d) => Math.max(256, Math.min(2048, Math.floor((parseInt(v, 10) || d) / 32) * 32));   // down: 720 -> 704 (never more memory than asked)
  return { width: r(w, W0), height: r(h, H0) };
}

/** H3's dialogue markup and reference tags -> plain words (PAN 2 makes no sound; the tags mean nothing to it) */
function plainPrompt(p) {
  return String(p || "")
    .replace(/<d>\s*(\[[A-Za-z]+\]\s*)?/gi, "\"").replace(/<\/d>/gi, "\"")
    .replace(/,?\s*in the timbre of <Audio \d+>,?/gi, ",")
    .replace(/<(Subject|Picture|Audio|Video)\s*(\d+)>/gi, (_m, k, n) => `${k.toLowerCase()} ${n}`)
    .replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}

function jsonOf(text) {
  let t = String(text || "");
  try { t = require("./llmChat").stripThinking(t); } catch (e) { /* fine */ }
  t = t.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
/** a caption object from a caption string, {"refined_prompt": "<caption string>"} or the object itself -> | null */
function parseCaption(text) {
  let o = typeof text === "object" && text ? text : jsonOf(text);
  for (let i = 0; i < 2 && o && typeof o === "object"; i++) {
    if (typeof o.refined_prompt === "string") { o = jsonOf(o.refined_prompt); continue; }
    if (o.refined_prompt && typeof o.refined_prompt === "object") { o = o.refined_prompt; continue; }
    break;
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  return KEYS.filter((k) => k in o).length >= 5 && Array.isArray(o.events) ? o : null;
}
function ordered(cap) {
  const o = {};
  for (const k of KEYS) o[k] = cap[k];
  if (o.quality && typeof o.quality === "object") o.quality = { video_quality: o.quality.video_quality, text_logos_overlays: o.quality.text_logos_overlays ?? null, artifacts: null };
  return o;
}

const num = (s) => { const m = /^\s*(\d+(?:\.\d)?)\s*$/.exec(String(s)); return m ? +m[1] : NaN; };
function interval(s) {
  const m = /^\s*(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*$/.exec(String(s || ""));
  if (!m) return null;
  const a = num(m[1]), b = num(m[2]);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}
const near = (x, y) => Math.abs(x - y) < 0.051;

/** the checks of PAN 2's prompt_tools.py that need no tokenizer -> [problems] */
function check(cap, seconds) {
  const P = [];
  if (!cap || typeof cap !== "object") return ["not a JSON caption object"];
  const keys = Object.keys(cap);
  if (keys.join() !== KEYS.join()) P.push(`the caption must have exactly these keys in this order: ${KEYS.join(", ")} (it has ${keys.join(", ") || "none"})`);
  for (const k of ["video_style", "lighting", "perspective_view", "init_frame_visual_description"])
    if (typeof cap[k] !== "string" || !cap[k].trim()) P.push(`${k} must be a non-empty string`);
  if (typeof cap.init_frame_visual_description === "string" && ID_RE.test(cap.init_frame_visual_description)) P.push("init_frame_visual_description must not contain subject IDs");
  ID_RE.lastIndex = 0;
  const ids = new Set();
  if (!Array.isArray(cap.subjects_lifecycle)) P.push("subjects_lifecycle must be an array");
  else cap.subjects_lifecycle.forEach((s, i) => {
    if (!s || Object.keys(s).join() !== "subject_id,display_name,subject_attribute") P.push(`subjects_lifecycle[${i}] must have exactly subject_id, display_name, subject_attribute`);
    else if (s.subject_id !== `<|Subject${i + 1}|>`) P.push(`subjects_lifecycle[${i}].subject_id must be <|Subject${i + 1}|>`);
    else ids.add(s.subject_id);
  });
  const D = Math.round((+seconds || DEFAULT_SECONDS) * 10) / 10;
  if (!Array.isArray(cap.events) || !cap.events.length) P.push("events must be a non-empty array");
  else {
    let at = 0;
    cap.events.forEach((e, i) => {
      if (!e || Object.keys(e).join() !== "event_index,time_range_sec,event_description,camera_motion,contained_actions") { P.push(`events[${i}] must have exactly event_index, time_range_sec, event_description, camera_motion, contained_actions`); return; }
      if (e.event_index !== i) P.push(`events[${i}].event_index must be ${i}`);
      const iv = interval(e.time_range_sec);
      if (!iv || !(iv[1] > iv[0])) { P.push(`events[${i}].time_range_sec must look like "0 to 3.5" (one decimal at most)`); return; }
      if (!near(iv[0], at)) P.push(`events[${i}] must start at ${at} (events cover 0 to ${D} with no gap)`);
      at = iv[1];
      if (typeof e.event_description !== "string" || !e.event_description.trim()) P.push(`events[${i}].event_description must be a non-empty string`);
      let cat = iv[0];
      if (!Array.isArray(e.camera_motion) || !e.camera_motion.length) P.push(`events[${i}].camera_motion must be a non-empty array`);
      else e.camera_motion.forEach((c, j) => {
        const ci = c && interval(c.time_range_sec);
        if (!c || Object.keys(c).join() !== "time_range_sec,camera_motion" || !ci) { P.push(`events[${i}].camera_motion[${j}] must have time_range_sec + camera_motion`); return; }
        if (!near(ci[0], cat)) P.push(`events[${i}].camera_motion[${j}] must start at ${cat} (the camera intervals cover the event)`);
        cat = ci[1];
        const tags = Array.isArray(c.camera_motion) ? c.camera_motion : [];
        if (!tags.length || tags.some((t) => !CAMERAS.includes(t))) P.push(`events[${i}].camera_motion[${j}] tags must be from: ${CAMERAS.join(", ")}`);
        else if (tags.includes("static") && tags.length > 1) P.push(`events[${i}].camera_motion[${j}]: never combine static with movement`);
        else if (new Set(tags).size !== tags.length) P.push(`events[${i}].camera_motion[${j}]: a tag at most once`);
      });
      if (Array.isArray(e.camera_motion) && e.camera_motion.length && !near(cat, iv[1])) P.push(`events[${i}].camera_motion must end at ${iv[1]}`);
      if (!Array.isArray(e.contained_actions)) P.push(`events[${i}].contained_actions must be an array`);
      else e.contained_actions.forEach((a, j) => {
        const ai = a && interval(a.time_range_sec);
        if (!a || Object.keys(a).join() !== "time_range_sec,action" || !ai) { P.push(`events[${i}].contained_actions[${j}] must have time_range_sec + action`); return; }
        if (ai[0] < iv[0] - 0.05 || ai[1] > iv[1] + 0.05 || !(ai[1] > ai[0])) P.push(`events[${i}].contained_actions[${j}] must lie inside its event`);
        const m = /^<\|Subject[1-9][0-9]*\|>/.exec(String(a.action || ""));
        if (!m || !ids.has(m[0])) P.push(`events[${i}].contained_actions[${j}].action must begin with a declared subject ID`);
      });
    });
    if (!near(at, D)) P.push(`the events must end at ${D} (the video is ${D} s)`);
  }
  const q = cap.quality;
  if (!q || typeof q !== "object" || Object.keys(q).join() !== "video_quality,text_logos_overlays,artifacts") P.push("quality must have exactly video_quality, text_logos_overlays, artifacts");
  else if (q.artifacts !== null) P.push("quality.artifacts must be null");
  return P;
}

/** bitGen's own one-event caption when no LLM can write one - better than a one-line prompt (that comes back as noise) */
function wrap(prompt, seconds, o) {
  const x = o || {}, D = Math.round((+seconds || DEFAULT_SECONDS) * 10) / 10;
  const words = plainPrompt(prompt) || "A calm, natural scene.";
  const first = String(x.firstFrame || "").trim();
  return {
    video_style: "Realistic cinematography in one uninterrupted continuous shot.",
    lighting: "Natural light that suits the scene, with true material colours and soft shadows.",
    perspective_view: "A steady eye-level view that keeps the main action in frame.",
    subjects_lifecycle: [],
    init_frame_visual_description: (first || words).slice(0, 1200),
    events: [{ event_index: 0, time_range_sec: `0 to ${D}`, event_description: words.slice(0, 1400),
      camera_motion: [{ time_range_sec: `0 to ${D}`, camera_motion: ["static"] }], contained_actions: [] }],
    quality: { video_quality: "Sharp, stable detail with natural motion.", text_logos_overlays: null, artifacts: null },
  };
}

let _neg = null;
function negative(seconds, extra) {
  if (_neg == null) _neg = fs.readFileSync(path.join(__dirname, "pan2", "generic_negative.txt"), "utf8").trim();
  const D = String(Math.round((+seconds || DEFAULT_SECONDS) * 10) / 10);
  let t = _neg.replace(/("time_range_sec"\s*:\s*")0 to \{duration_sec\}(")/g, `$10 to ${D}$2`);
  const add = String(extra || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 1500);
  if (add) {
    const own = parseCaption(add);
    if (own) return JSON.stringify(ordered(own));          // a whole negative caption of their own: used as it is
    const o = JSON.parse(t);
    o.video_style = `${o.video_style}, ${add}`;
    t = JSON.stringify(o);
  }
  return t;
}

let _sys = null;
const systemPrompt = () => (_sys == null ? (_sys = fs.readFileSync(path.join(__dirname, "pan2", "system_prompt.md"), "utf8")) : _sys);

let completeFn = null, describeFn = null;
function setComplete(fn) { completeFn = fn || null; }
function setDescribe(fn) { describeFn = fn || null; }
async function llm(messages) {
  const r = completeFn ? await completeFn({ messages, max_tokens: 3500 })
    : await require("./llmChat").complete(require("./core"), { messages, max_tokens: 3500, temperature: 0.6 });
  if (!r || r.ok === false) throw new Error((r && r.error) || "the LLM did not answer");
  return String(r.text != null ? r.text : r.content != null ? r.content : r.reply || "");
}
/** the first picture told to the rewriter in words (the policy wants it seen - a vision model sees it for the LLM) */
async function firstFrameWords(file) {
  if (!file) return "";
  const q = "Describe this picture as the FIRST FRAME of a video, for a video writer: every visible person, animal and object, "
    + "their pose, clothing, position and what they hold; the setting, light and the camera's framing. Plain words, under 180 words.";
  const files = [{ buffer: fs.readFileSync(file), mimetype: /\.jpe?g$/i.test(file) ? "image/jpeg" : /\.webp$/i.test(file) ? "image/webp" : "image/png", prompt: q, max_tokens: 500 }];
  const out = describeFn ? await describeFn(files) : await require("./captioner").describe(require("./core"), files);
  return String((out || [])[0] || "").trim().slice(0, 2000);
}

/**
 * the caption PAN 2 needs. o = {prompt, seconds, image (abs path | ""), noLlm} -> {caption (string), how, notes}
 */
async function caption(o) {
  const x = o || {}, D = Math.round((+x.seconds || DEFAULT_SECONDS) * 10) / 10, notes = [];
  const given = parseCaption(x.prompt);
  if (given) {
    const c = ordered(given), P = check(c, D);
    if (P.length) notes.push(`your caption has ${P.length} problem(s) PAN 2's own checker would flag - used as it is: ${P.slice(0, 3).join("; ")}`);
    return { caption: JSON.stringify(c), how: "given", notes };
  }
  const plain = plainPrompt(x.prompt);
  if (!plain) throw Object.assign(new Error("write what happens in the video first"), { status: 400 });
  let seen = "";
  if (x.image) {
    try { seen = await firstFrameWords(x.image); if (seen) notes.push("the vision model described the first picture for the caption writer"); }
    catch (e) { notes.push("the first picture could not be described (" + String(e.message || e).slice(0, 120) + ") - the caption is written from your words"); }
  }
  if (!x.noLlm) {
    const req = { original_prompt: plain, duration_sec: D };
    let user = JSON.stringify(req);
    if (x.image) user += seen ? `\n\nFirst-frame image (image-to-video). A vision model looked at the attached first frame and saw:\n${seen}\nBase init_frame_visual_description only on this.`
      : "\n\nThis is image-to-video, but the first frame could not be shown to you: keep init_frame_visual_description general and true to the request.";
    const msgs = [{ role: "system", content: systemPrompt() }, { role: "user", content: user }];
    let last = [];
    for (let t = 0; t < 2; t++) {
      let text = "";
      try { text = await llm(msgs); }
      catch (e) { notes.push("the LLM could not write the caption: " + String(e.message || e).slice(0, 160)); break; }
      const c0 = parseCaption(text);
      if (!c0) { last = ["the answer was not a JSON caption"]; }
      else {
        const c = ordered(c0); last = check(c, D);
        if (!last.length) {
          const s = JSON.stringify(c);
          if (s.length > SOFT_CHARS) notes.push(`the caption is long (${s.length} characters) - PAN 2 reads about 1,480 tokens; it may be cut`);
          notes.push("the LLM wrote PAN 2's caption with PAN 2's own rewriter policy" + (t ? " (on the second try)" : ""));
          return { caption: s, how: "llm", notes };
        }
      }
      msgs.push({ role: "assistant", content: String(text).slice(0, 12000) });
      msgs.push({ role: "user", content: "The caption has these problems - write it again, fixing only them, and return only {\"refined_prompt\": \"...\"}:\n- " + last.slice(0, 12).join("\n- ") });
    }
    if (last.length) notes.push(`the LLM's caption failed the checks twice (${last.slice(0, 3).join("; ")}) - bitGen wrapped your words in a simple one-event caption instead`);
  } else notes.push("no LLM - bitGen wrapped your words in a simple one-event caption (PAN 2 does best with a caption the LLM writes)");
  return { caption: JSON.stringify(wrap(plain, D, { firstFrame: seen })), how: "wrapped", notes };
}

/**
 * the job params, or {error}. o = {style, caption (string), negative (string), image (abs) | "", seconds, width, height,
 * seed, steps, cfg, shift, model (Basic Settings' Use model), audio {path, start} | null, output_name}
 */
function params(o) {
  const x = o || {};
  const st = x.style;
  if (!isPan2Style(st)) return { error: "not a PAN 2 style" };
  const img = String(x.image || "");
  if (img) {
    if (!IMAGE_EXT.includes(path.extname(img).toLowerCase())) return { error: `${path.basename(img)} is not a picture` };
    if (!fs.existsSync(img)) return { error: `the picture is gone: ${path.basename(img)}` };
  }
  const frames = framesFor(x.seconds), sz = size(x.width, x.height);
  const ph = (Array.isArray(st.phases) && st.phases[0]) || {};
  const seed = parseInt(x.seed, 10), steps = parseInt(x.steps, 10), cfg = parseFloat(x.cfg), shift = parseFloat(x.shift);
  const audio = x.audio && x.audio.path && fs.existsSync(x.audio.path) ? { path: x.audio.path, start: Math.max(0, +x.audio.start || 0) } : null;
  return {
    mode: "pan2", pan2_mode: img ? "i2v" : "t2v",
    prompt: String(x.caption || ""), negative: String(x.negative || ""), image: img,
    frames, seconds: secondsOf(frames), width: sz.width, height: sz.height,
    seed: Number.isFinite(seed) && seed >= 0 ? seed : -1,
    steps: Number.isFinite(steps) && steps > 0 ? Math.min(150, steps) : (+ph.steps > 0 ? +ph.steps : DEFAULTS.steps),
    cfg: Number.isFinite(cfg) && cfg > 0 ? cfg : (+ph.cfg > 0 ? +ph.cfg : DEFAULTS.cfg),
    shift: Number.isFinite(shift) && shift > 0 ? shift : (+st.shift > 0 ? +st.shift : DEFAULTS.shift),
    model: String(x.model || ph.model || ""), te: String(((st.te || [])[0]) || ""), vae: String(st.vae || ""),
    loras: (Array.isArray(st.loras) ? st.loras : []).filter((l) => l && (l.path || l.name)).map((l) => ({ name: String(l.path || l.name), strength: +(l.weight ?? l.strength ?? 1) || 1 })),
    audio, format: "mp4",
    video_style: st, video_style_id: st.id || null, video_style_name: st.name || "PAN 2",
    ...(x.output_name ? { output_name: String(x.output_name) } : {}),
  };
}

function summary(p) {
  const bits = [`PAN 2 ${p.pan2_mode === "i2v" ? "from a first picture" : "from text"}`, `${p.seconds}s (${p.frames} frames at ${FPS} fps)`,
    `${p.width}x${p.height}`, `${p.steps} steps, cfg ${p.cfg}, shift ${p.shift}`];
  if (p.audio) bits.push(`sound ${path.basename(p.audio.path)} from ${p.audio.start}s`);
  return bits.join(" · ");
}

/** does the running ComfyUI know CLIPLoader type "pan2" (its PAN 2 support)? -> {online, nodes} */
async function comfySupport(o) {
  const opt = o || {};
  let url = opt.url != null ? String(opt.url) : "";
  if (opt.url == null) { try { url = require("./comfy").comfyCfg().url; } catch { url = ""; } }
  const f = opt.fetch || (typeof fetch === "function" ? fetch : null);
  if (!url || !f) return { online: false, nodes: false };
  try {
    const r = await f(`${String(url).replace(/\/$/, "")}/object_info/CLIPLoader`, { signal: AbortSignal.timeout(opt.timeout || 4000) });
    if (!r.ok) return { online: true, nodes: false };
    const j = await r.json();
    const spec = (((j || {}).CLIPLoader || {}).input || {}).required || {};
    const t = spec.type;
    const opts = Array.isArray(t) ? (Array.isArray(t[0]) ? t[0] : (t[1] && t[1].options) || []) : (t && t.options) || [];
    return { online: true, nodes: opts.includes("pan2") };
  } catch { return { online: false, nodes: false }; }
}

/* 2.902.0 (Tim: "the videos are using cached prompts or old prompts. new videos are getting old video prompts mixed with the
   new prompt" ... "it happened after a render with pan 2. maybe it is loading the json prompt as well?"): after a PAN 2 render
   the prompt box holds PAN 2's JSON caption - the OLD video's events - and a video for another model sent it along with the
   new words. PAN 2's caption is PAN 2's alone: stripCaption takes every PAN 2 caption out of a prompt for any other model.
   The words outside it are the prompt; a prompt that is ONLY a caption becomes plain words (captionWords). */
/** the end of the JSON object starting at text[i] ("{"), strings and escapes respected; -1 = not closed */
function objectEnd(t, i) {
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return j; }
  }
  return -1;
}
/** a caption as plain words: the look, the first frame, each event in order */
function captionWords(cap) {
  const c = parseCaption(cap); if (!c) return "";
  const parts = [c.video_style, c.init_frame_visual_description].concat((c.events || []).map((e) => e && e.event_description));
  return parts.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().replace(/\s+/g, " ")).join(" ").trim();
}
/** -> {text, removed (how many captions), converted (true = the prompt was only a caption, now its words)} */
function stripCaption(text) {
  const t = String(text == null ? "" : text);
  if (t.indexOf("{") < 0) return { text: t, removed: 0, converted: false };
  let out = "", i = 0, removed = 0, only = null;
  while (i < t.length) {
    const a = t.indexOf("{", i);
    if (a < 0) { out += t.slice(i); break; }
    const b = objectEnd(t, a);
    if (b < 0) { out += t.slice(i); break; }
    let cap = null; try { cap = parseCaption(JSON.parse(t.slice(a, b + 1))); } catch (e) { cap = null; }
    if (cap) { out += t.slice(i, a); removed++; only = cap; i = b + 1; } else { out += t.slice(i, a + 1); i = a + 1; }
  }
  out = out.replace(/```(?:json)?\s*```/gi, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!removed) return { text: t, removed: 0, converted: false };
  if (!out && removed === 1) return { text: captionWords(only), removed, converted: true };
  return { text: out, removed, converted: false };
}

module.exports = { FPS, MAX_SECONDS, DEFAULT_SECONDS, KEYS, CAMERAS, DEFAULTS, UPDATE, isPan2Style, framesFor, secondsOf, size,
  plainPrompt, parseCaption, ordered, check, wrap, negative, systemPrompt, caption, params, summary, comfySupport,
  setComplete, setDescribe, stripCaption, captionWords };
