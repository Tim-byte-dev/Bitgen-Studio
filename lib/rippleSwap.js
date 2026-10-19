"use strict";
/**
 * rippleSwap.js — THE SWAP DIALOG'S SECOND ENGINE: LTX RIPPLE (2.339.0).
 *
 * Tim: "a dropdown in character swap for ltx2 ripple, with ltx2 style, i
 * think ripple is a lora". It is: WepeNerd/LTX-Ripple LTX25_Ripple_v11
 * .safetensors, an IC-LoRA for LTX 2.5 - "input your video, edit its first
 * frame, and it figures out the rest of the video based on your image edit"
 * (its README; strength 1.35). So a Ripple swap of one segment is two jobs:
 *
 *   1. ✎ FIRST FRAME  the segment's first frame + the new character's
 *                     picture -> Qwen Image 2.1 edit (the character put into
 *                     the frame, pose / framing / light kept). The result is
 *                     the segment's `ff` - look at it, redo it, or touch it up
 *                     in the image editor and put it back (⤒).
 *   (2.342.0: RIPPLE runs TIM'S OWN workflow, LTX_Ripple_FFAF_Edit_v11 -
 *   ripple_worker.py; the text below is the 2.339.0 route it replaced)
 *   2. RIPPLE         Tim's LTX canvas, style-transfer mode (v2v), with the
 *                     edited frame as Load Image1, the segment's own clip
 *                     (raw - no pose / depth preprocessor) as the IC guide and
 *                     the Ripple LoRA instead of the union-control one.
 *                     ltx_worker cuts the clip at the render size, renders
 *                     8k+1 frames, trims back to the segment's frames and puts
 *                     the ORIGINAL audio back - so the take slots into the
 *                     compile exactly like an H3 one.
 *
 * Pure: names, prompts, frame maths, the job's params. routes/swapdlg.js is
 * the HTTP skin; ltx_worker.py renders (params.ripple).
 */
const path = require("path");

const VN = require("./viggleNative");                   // 2.351.0 (pure)
const ENGINES = [
  { id: "h3", label: "MiniMax H3", note: "the swap LoRA through H3 (one job per segment)" },
  { id: "ripple", label: "LTX Ripple", note: "✎ Qwen 2.1 edits the first frame, LTX Ripple carries it through the clip" },
  // 2.344.0 (Tim: "can you see if we can add viggle to our styles\workflow")
  { id: "viggle", label: "Viggle (H3)", note: "✎ Qwen 2.1 edits the first frame, Viggle-Animate on MiniMax H3 carries it through the clip (3 steps)" },
  // 2.351.0 (Tim: "can we build our own wan2gp engine?"): the same model, our own engine - no ComfyUI
  { id: "viggle_native", label: "Viggle (native)", note: "✎ Qwen 2.1 edits the first frame, Viggle-Animate carries it through the clip in bitGen's own engine (no ComfyUI; the weights streamed to the GPU)" },
];
/** 2.344.0: the engines that start from a ✎ first frame (and share its flow). */
const FIRST_FRAME_ENGINES = ["ripple", "viggle", "viggle_native"];
/** 2.351.0: the two Viggle engines share the 480 canvas + the take's rules. */
const isViggle = (e) => e === "viggle" || e === "viggle_native";
const usesFirstFrame = (e) => FIRST_FRAME_ENGINES.includes(String(e));
const ENGINE_IDS = ENGINES.map((e) => e.id);
const engineOf = (v) => (ENGINE_IDS.includes(String(v)) ? String(v) : "h3");

const LORA = "LTX25_Ripple_v11.safetensors";
const LORA_RE = /ripple/i;
const STRENGTH = 1.35;
const FPS = 24;
const SHORT_SIDE = 544;                  // the canvas's own 960x544
/** The README's default prompt, verbatim. */
const DEFAULT_PROMPT = "Use the reference video for motion, timing, camera movement, composition, and unchanged "
  + "scene content, while consistently propagating the visual edit established in the first frame throughout the video.";
const FF_STATUSES = ["", "running", "done", "failed"];

/** LTX renders 8k+1 frames. 2.342.0 (Tim's workflow): output frame 0 is the
 *  edited still, frame k follows clip frame k-1 - so the smallest 8k+1
 *  covering the segment PLUS that still (at least 9). */
function renderFrames(n) {
  const f = Math.max(1, Math.floor(+n || 0)) + 1;
  return Math.max(9, 8 * Math.ceil((f - 1) / 8) + 1);
}

/** Multiples of 32 at the source's aspect, short side = short. */
function size(w, h, short) {
  const W = +w > 0 ? +w : 16, H = +h > 0 ? +h : 9, S = +short > 0 ? +short : SHORT_SIDE;
  const k = S / Math.min(W, H);
  const r = (v) => Math.max(256, Math.min(2048, Math.round(v * k / 32) * 32));
  return { width: r(W), height: r(H) };
}

/** An H3 swap prompt (with its <Video 1> / <Picture 1> tags) says nothing to
 *  LTX - only plain direction rides along. */
function direction(text) {
  const t = String(text || "").trim();
  if (!t || /<\s*(video|picture|image)\s*\d+\s*>/i.test(t)) return "";
  return t.slice(0, 600);
}

/** Qwen Image 2.1: <image1> the segment's first frame, <image2> the character. */
function editPrompt(text) {
  const d = direction(text);
  return "<image1> is a frame from a video. Replace the person in <image1> with the character from <image2>: "
    + "their face, hair, skin, body, clothing and art style come from <image2>. Keep everything else in <image1> "
    + "exactly as it is - the pose, the expression, the hands, the camera framing, the lighting, the background "
    + "and every object." + (d ? " " + d : "");
}

/** The LTX prompt: the README's default + what changed (+ the user's words). */
function ltxPrompt(text) {
  const d = direction(text);
  return DEFAULT_PROMPT + " The person is replaced by the new character from the first frame - keep their "
    + "face, hair and clothing exactly as in the first frame in every frame." + (d ? " " + d : "");
}

/** A segment's first-frame file in vidTemp. */
const ffName = (segId, ext) => `_ripple_ff_${String(segId).replace(/[^a-z0-9]/gi, "")}${ext || ".png"}`;
/** 2.348.0: candidate n (1 = the classic name, then _2, _3 ...). */
const ffCandName = (segId, n, ext) => (n <= 1 ? ffName(segId, ext)
  : `_ripple_ff_${String(segId).replace(/[^a-z0-9]/gi, "")}_${n}${ext || ".png"}`);
const FF_MAX_CANDS = 12, FF_MAX_JOBS = 8, FF_MAX_COUNT = 4;

/* 2.348.0 (Tim: "allow user to generate multiple "first image" for a scene
   and let the user select the one he wants to use, double click will do the
   preview, single click will select the file"): a segment's ff keeps every
   candidate it has made (cands) and which one is used (file); jobs are the
   ✎ runs still going (job = the first of them, for older readers). */
function ffSafe(ff) {
  const o = ff && typeof ff === "object" ? ff : {};
  const file = path.basename(String(o.file || ""));
  let cands = (Array.isArray(o.cands) ? o.cands : []).filter((c) => c && c.file)
    .map((c) => ({ file: path.basename(String(c.file)), label: String(c.label || "").slice(0, 120), at: +c.at || 0 }));
  if (file && !cands.some((c) => c.file === file)) cands.unshift({ file, label: String(o.label || "").slice(0, 120), at: +o.at || 0 });
  cands = cands.filter((c, i) => cands.findIndex((x) => x.file === c.file) === i).slice(-FF_MAX_CANDS);
  const jobs = [...new Set([...(Array.isArray(o.jobs) ? o.jobs : []), ...(o.job ? [o.job] : [])].map(String).filter(Boolean))].slice(0, FF_MAX_JOBS);
  const status = FF_STATUSES.includes(o.status) ? o.status : "";
  return { file, job: jobs[0] || "", jobs, cands,
           status: jobs.length && status !== "failed" ? "running" : status, error: String(o.error || "").slice(0, 400),
           label: String(o.label || "").slice(0, 120), at: +o.at || 0,
           // 2.343.0: ▶ Swap made this first frame -> render as soon as it is done
           ...(o.auto ? { auto: true, text: String(o.text || "").slice(0, 4000) } : {}) };
}
/** 2.348.0: use candidate `file` (-> false if it is not one of them). */
function ffSelect(ff, file) {
  const s = ffSafe(ff), c = s.cands.find((x) => x.file === path.basename(String(file || "")));
  if (!c) return false;
  s.file = c.file; s.label = c.label; s.at = c.at; if (!s.jobs.length) s.status = "done";
  return s;
}
/** 2.348.0: drop candidate `file` (default the used one); the newest left is used. -> {ff|null, removed} */
function ffDrop(ff, file) {
  const s = ffSafe(ff), f = path.basename(String(file || s.file));
  const had = s.cands.some((x) => x.file === f);
  s.cands = s.cands.filter((x) => x.file !== f);
  if (s.file === f) {
    const last = s.cands[s.cands.length - 1];
    s.file = last ? last.file : ""; s.label = last ? last.label : ""; s.at = last ? last.at : 0;
  }
  if (!s.file && !s.jobs.length) return { ff: null, removed: had ? f : "" };
  if (!s.jobs.length) s.status = s.file ? "done" : s.status;
  return { ff: s, removed: had ? f : "" };
}
const ffBlank = (ff) => { const s = ffSafe(ff); return !s.file && !s.job && !s.status; };

/**
 * Sync the segments' first-frame jobs: done -> the file moved into vidTemp
 * as the segment's ff (move(seg, output) -> the file name); failed -> why.
 * -> { state, changed }.
 */
function syncFirstFrames(state, jobOf, move) {
  let changed = false;
  const ready = [];                        // 2.343.0: {id, text} to render now (▶ Swap made them)
  for (const g of state.segments || []) {
    const ff = ffSafe(g.ff);
    if (!ff.jobs.length) continue;
    let moved = false;
    const left = [];
    for (const id of ff.jobs) {            // 2.348.0: several ✎ runs per segment
      const j = jobOf(id);
      if (!j) { ff.error = "a first-frame job is gone (the app restarted?) - ✎ make it again"; moved = true; continue; }
      if (j.status === "done" && j.output) {
        try {
          const f = move(g, j.output), at = Date.now();
          ff.cands.push({ file: f, label: "✎ Qwen 2.1", at });
          ff.file = f; ff.label = "✎ Qwen 2.1"; ff.at = at; ff.error = "";          // the newest is used - click another to change
        } catch (e) { ff.error = String((e && e.message) || e); }
        moved = true;
      } else if (["failed", "cancelled", "lost"].includes(j.status)) {
        ff.error = j.error || `the first-frame job ${j.status}`; moved = true;
      } else left.push(id);
    }
    if (!moved) continue;
    ff.jobs = left; ff.job = left[0] || "";
    ff.cands = ff.cands.slice(-FF_MAX_CANDS);
    if (!left.length) {
      ff.status = ff.file ? "done" : "failed";
      if (ff.status === "done" && ff.auto) ready.push({ id: g.id, text: ff.text || "" });
      delete ff.auto; delete ff.text;
    }
    g.ff = ff; changed = true;
  }
  return { state, changed, ready };
}

/* 2.342.0 (Tim: "in the settings dialog, show video settings, video size (get
   from video), duration, steps, add lora button (like our other add lora
   inputs), seed (random or fixed)"): the swap dialog's ⚙ record. Duration is
   the dialog's Max (the segment length); the LoRAs are the project's "swap"
   temporary LoRA list (lib/tempLoras). */
const WORKFLOW = "LTX_Ripple_FFAF_Edit_v11_api.json";
const STEPS = 8;                          // Tim's workflow (BasicScheduler simple, 8)
const SHORT = 768;                        // Tim's workflow renders 1152x768
function settingsBlank() { return { auto_size: true, width: 0, height: 0, steps: STEPS, seed_mode: "random", seed: 0, strength: STRENGTH, auto_render: true,
  viggle_steps: 3, viggle_strength: 1, viggle_solattn: false, viggle_safe: false,          // 2.344.0: Viggle's own (the 3-step DMD schedule)
  vn_steps: VN.STEPS, vn_shift: VN.SHIFT }; }    // 2.351.0: Viggle (native) (2.352.0: its memory settings are the native engine's - config.native)
function settingsSafe(v) {
  const o = v && typeof v === "object" ? v : {};
  const b = settingsBlank();
  const n32 = (x) => { const k = Math.round((+x || 0) / 32) * 32; return k >= 256 && k <= 2048 ? k : 0; };
  const w = n32(o.width), h = n32(o.height);
  return {
    auto_size: o.auto_size === false && w && h ? false : true,
    width: w, height: h,
    steps: Math.max(1, Math.min(100, Math.round(+o.steps || b.steps))),
    seed_mode: o.seed_mode === "fixed" ? "fixed" : "random",
    seed: Math.max(0, Math.min(2 ** 48 - 1, Math.floor(+o.seed || 0))),
    strength: Math.max(0, Math.min(3, Number.isFinite(+o.strength) && o.strength !== "" && o.strength != null ? +o.strength : b.strength)),
    // 2.343.0 (Tim: "ltx doesn't start the render after the picture is
    // generated"): ▶ Swap renders the segment as soon as its ✎ first frame is
    // made; off = stop at the first frame to check / touch it up
    auto_render: o.auto_render === false ? false : true,
    viggle_steps: Math.max(1, Math.min(50, Math.round(+o.viggle_steps || b.viggle_steps))),
    viggle_strength: Math.max(0, Math.min(3, Number.isFinite(+o.viggle_strength) && o.viggle_strength !== "" && o.viggle_strength != null ? +o.viggle_strength : b.viggle_strength)),
    // 2.346.0 (Tim's run: ComfyUI-SolAttn_triton's morton path ABORTED
    // ComfyUI mid-render): the Sol-Attn speed patch is OFF unless ticked
    viggle_solattn: o.viggle_solattn === true,
    viggle_safe: o.viggle_safe === true,                  // 2.350.0: everything that can make a black take off
    // 2.351.0: Viggle (native) - steps (4 = 3 passes), flow shift, where the weights sit, blocks per stream group
    ...(() => { const n = VN.settingsOf(o); return { vn_steps: n.steps, vn_shift: n.shift }; })(),
  };
}
/** The render size: the settings' own, else the video's aspect at 768 (32-multiples). */
function sizeFor(settings, videoW, videoH) {
  const s = settingsSafe(settings);
  if (!s.auto_size && s.width && s.height) return { width: s.width, height: s.height, auto: false };
  return { ...size(videoW || 1152, videoH || 768, SHORT), auto: true };
}
/** The seed a render uses: fixed = the settings' (a retry keeps it), random = drawn. */
function seedFor(settings, draw) {
  const s = settingsSafe(settings);
  return s.seed_mode === "fixed" ? s.seed : draw();
}

/**
 * The Ripple job's params (or {error}). o = { workflow (abs, the _api.json),
 * video (abs), start, frames (the segment's), image (the edited first frame,
 * abs), text, seed, width, height, steps, strength, loras [{path, weight}] }.
 */
function jobParams(o) {
  const x = o || {};
  const frames = Math.floor(+x.frames || 0);
  if (!(frames >= 5)) return { error: "that segment is too short for a Ripple swap" };
  if (!x.workflow) return { error: `the Ripple workflow comfy_workflows/${WORKFLOW} is missing - it ships in the full zip` };
  const rf = renderFrames(frames);
  return {
    mode: "ripple", workflow: x.workflow, video: x.video, image: x.image,
    start: +x.start || 0, trim_frames: frames, frames: rf, dur: frames / FPS,
    width: +x.width || 0, height: +x.height || 0, steps: Math.round(+x.steps || STEPS),
    seed: Number.isFinite(+x.seed) ? Math.floor(+x.seed) : -1,
    prompt: ltxPrompt(x.text), negative: "", strength: Number.isFinite(+x.strength) ? +x.strength : STRENGTH,
    loras: (Array.isArray(x.loras) ? x.loras : []).filter((l) => l && l.path).map((l) => ({ path: String(l.path), weight: Number.isFinite(+l.weight) ? +l.weight : 1 })),
    ripple: { lora: LORA, strength: Number.isFinite(+x.strength) ? +x.strength : STRENGTH, frames: rf, trim_frames: frames,
              start: +x.start || 0, dur: frames / FPS },
  };
}

function summary(p) {
  const r = p.ripple || {};
  return `LTX Ripple swap · ${r.trim_frames} frames (${(r.dur || 0).toFixed(2)}s from ${(+r.start || 0).toFixed(2)}s, `
    + `rendered as ${r.frames}) · ${path.basename(r.lora || LORA)} @ ${r.strength}`
    + (p.width && p.height ? ` · ${p.width}x${p.height}` : "") + (p.steps ? ` · ${p.steps} steps` : "")
    + ((p.loras || []).length ? ` · +${p.loras.length} LoRA(s)` : "");
}

module.exports = { ENGINES, ENGINE_IDS, engineOf, FIRST_FRAME_ENGINES, usesFirstFrame, isViggle, LORA, LORA_RE, STRENGTH, FPS, SHORT_SIDE, DEFAULT_PROMPT,
                   renderFrames, size, direction, editPrompt, ltxPrompt, ffName, ffCandName, ffSafe, ffBlank, ffSelect, ffDrop, FF_MAX_COUNT,
                   syncFirstFrames, jobParams, summary,
                   WORKFLOW, STEPS, SHORT, settingsBlank, settingsSafe, sizeFor, seedFor };
