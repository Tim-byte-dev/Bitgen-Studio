// bitGen Studio — THE CHARACTER SWAP DIALOG's record (2.329.0).
//
// Tim (verbatim): "create a dialog for character swap, image placeholder on
// the left, click opens select file dialog, in the middle is the video
// preview, below the preview is the filmstrip and selector box, this one
// will be able to do the entire movie in segments of max length which will
// be an input in the video menubar ... Swap button in menubar, load video
// button, start time, duration, automatic segment button (this will segment
// to the max duration input on the menubar. the final video preview will be
// on the right with save and retry and upscale buttons in it's menubar. add
// a button in the video docker "Swap" to open the dialog". Then: "add the
// finished segments to a vidTemp folder, user will be able to select
// segments to join. allow user to start 1 segment at a time or all
// segments, the segments to keep will be put in vidSwap folder, add a
// compile button to the right menubar".
//
// ONE RECORD PER PROJECT: projects/<p>/swap_dialog.json
//   { video, picture, text, max,
//     segments: [ {id, start, dur, frames} ],            the plan (24 fps grid)
//     results:  [ {id, seg, video, start, dur, frames, seed, job, status,
//                  file, where: "temp"|"keep", upscaled, error} ] }
// Finished segments land in projects/<p>/vidTemp; KEEP moves one to
// projects/<p>/vidSwap; COMPILE joins the ticked kept ones (in time order)
// into the project's Video assets. Pure planning + naming + the ffmpeg
// compile args live here (tested); routes/swapdlg.js is the HTTP skin and
// swap_worker.py does each render (lib/swap.jobParams).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const RS = require("./rippleSwap");        // 2.339.0: the LTX Ripple engine's first frames

const FILE = "swap_dialog.json";
const TEMP = "vidTemp";
const KEEP = "vidSwap";
const FPS = 24;                          // the swap renders at 24 fps (swap_graph.FPS)
const STATUSES = ["queued", "running", "done", "failed", "cancelled", "lost"];

const r3 = (x) => Math.round(x * 1000) / 1000;
const newId = () => crypto.randomBytes(5).toString("hex");

/** H3's frame grid: the largest 17k+5 <= n (0 below 5). */
function snapDown(n) {
  n = Math.floor(+n || 0);
  return n < 5 ? 0 : 5 + 17 * Math.floor((n - 5) / 17);
}

/** The longest segment one run takes, in seconds, for a ceiling in frames. */
function maxSeconds(ceilingFrames) { return snapDown(ceilingFrames || 362) / FPS; }

/** 2.334.0: the DEFAULT segment - 124 frames (5.17 s). The swap LoRA
 *  (akatz-ai/MiniMax-H3-Character-Swap-LoRA) holds the new character best on
 *  4-5 s shots; a full 15 s run drifts back to the original performer (Tim:
 *  "the character swap worked for the first 2 seconds of a video, then it
 *  wouldn't work at all"). Max can still be raised to one run. */
const BEST_FRAMES = 124;
function bestSeconds(ceilingFrames) { return Math.min(maxSeconds(ceilingFrames), BEST_FRAMES / FPS); }

/** The Max input clamped: 1 s .. one run. Blank / junk = one run. */
function clampMax(max, ceilingFrames) {
  const top = maxSeconds(ceilingFrames);
  const m = +max;
  if (!Number.isFinite(m) || m <= 0) return r3(top);
  return r3(Math.min(top, Math.max(1, m)));
}

/**
 * AUTOMATIC SEGMENTS: the whole video from `start` (default 0) cut into
 * back-to-back runs of at most `max` seconds, each a whole 17k+5 frame
 * count at 24 fps, so segment n+1 starts EXACTLY where n ends and the
 * joined movie has no gap or overlap. The last one is whatever is left,
 * snapped down to the grid; what that leaves (under 17 frames, < 0.71 s -
 * one more run for it would be a whole model load for a blink) is the
 * reported tail. Returns { segments: [{start, dur, frames}], tail, frames }.
 */
function plan(duration, start, max, ceilingFrames) {
  const total = Math.floor((+duration || 0) * FPS + 1e-6);
  let at = Math.max(0, Math.round((+start || 0) * FPS));
  const per = Math.max(5, Math.min(snapDown(ceilingFrames || 362), snapDown(Math.round(clampMax(max, ceilingFrames) * FPS))));
  const segments = [];
  while (total - at >= 5) {
    const n = Math.min(per, snapDown(total - at));
    segments.push({ start: r3(at / FPS), dur: n / FPS, frames: n });
    at += n;
    if (n < per) break;          // the last, shorter one: what is left now is < 17 frames
  }
  return { segments, tail: r3(Math.max(0, total - at) / FPS), frames: per };
}

/** One hand-picked window (the box) as a segment on the same grid. */
function one(duration, start, dur, ceilingFrames) {
  const total = Math.floor((+duration || 0) * FPS + 1e-6);
  const at = Math.max(0, Math.min(total - 5, Math.round((+start || 0) * FPS)));
  if (!(total - at >= 5)) return null;
  let want = Math.round((+dur || 0) * FPS);
  if (!(want >= 5)) want = total - at;
  const n = Math.min(snapDown(ceilingFrames || 362), snapDown(Math.min(want, total - at)));
  return n >= 5 ? { start: r3(at / FPS), dur: n / FPS, frames: n } : null;
}

/* 2.330.0 (Tim: "is it possible to make it 360 stereo and 180sbs ? and
   usable results" -> "yes please build it"): VR. The swap renders a
   VIRTUAL CAMERA aimed at the person in the left eye (yaw / pitch / field
   of view / shape); stereo builds the right eye through the original
   footage's depth; scripts/vr_swap.py does the work, this is the record +
   the JS mirror of its view maths (the dialog's 👁 still). */
const VR_MODES = {
  off: null,
  mono360: { stereo: "", proj: "e", suffix: "_360", label: "360° mono" },
  tb360: { stereo: "tb", proj: "e", suffix: "_360_TB", label: "360° stereo (top-bottom)" },
  sbs180: { stereo: "sbs", proj: "hequirect", suffix: "_180_LR", label: "180° stereo (side by side)" },
};
const VR_SHAPES = ["1:1", "3:4", "9:16", "4:3", "16:9"];

function vrBlank() { return { mode: "off", yaw: 0, pitch: 0, fov: 70, shape: "1:1" }; }
/** The aim, clamped exactly like vr_swap.clamp_view. */
function vrSafe(v) {
  const o = v && typeof v === "object" ? v : {};
  const mode = Object.prototype.hasOwnProperty.call(VR_MODES, o.mode) ? o.mode : "off";
  const yaw = r3((((+o.yaw || 0) + 180) % 360 + 360) % 360 - 180);
  const pitch = r3(Math.max(-85, Math.min(85, +o.pitch || 0)));
  const fov = r3(Math.max(20, Math.min(140, +o.fov || 70)));
  return { mode, yaw, pitch, fov, shape: VR_SHAPES.includes(o.shape) ? o.shape : "1:1" };
}
/** The aim alone (a result remembers it, so ↻ / ⏫ re-render the SAME view). */
function aimOf(a) { const v = vrSafe(a); return { yaw: v.yaw, pitch: v.pitch, fov: v.fov, shape: v.shape }; }
/** What a job carries (null = a flat swap). */
function vrParams(v) {
  const s = vrSafe(v);
  return s.mode === "off" ? null : s;
}
function vrSuffix(mode) { return (VR_MODES[mode] || {}).suffix || ""; }

/** The format a file most likely is: from its NAME (players' own tokens:
 *  _TB / _OU / _LR / _SBS / _180 / _360), else only a hint from its shape.
 *  -> {mode, sure} ; mode "" = nothing to say. */
function detectVr(name, w, h) {
  const n = String(name || "").toLowerCase();
  const tok = (re) => re.test(n);
  const is180 = tok(/(^|[^a-z0-9])180([^0-9]|$)|vr180/), is360 = tok(/(^|[^a-z0-9])360([^0-9]|$)|vr360/);
  const tb = tok(/(^|[_\-. ])(tb|ou|3dv|top.?bottom|over.?under)([_\-. ]|$)/);
  const lr = tok(/(^|[_\-. ])(lr|sbs|3dh|side.?by.?side)([_\-. ]|$)/);
  if (is180 && (lr || !tb)) return { mode: "sbs180", sure: true };
  if (is360 && tb) return { mode: "tb360", sure: true };
  if (is360) return { mode: "mono360", sure: true };
  if (tb && Math.abs(w - h) <= 2) return { mode: "tb360", sure: true };
  if (w > 0 && h > 0 && Math.abs(w - h) <= 2 && w >= 2048) return { mode: "tb360", sure: false };
  if (w > 0 && h > 0 && Math.abs(w - 2 * h) <= 4 && w >= 3840) return { mode: "sbs180", sure: false };
  return { mode: "", sure: false };
}

/** Python's float text (30.0, 30.25) - the mirror strings match exactly. */
const pyf = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
function vfovOf(hfov, w, h) {
  const hf = Math.max(10, Math.min(150, +hfov));
  return (2 * Math.atan(Math.tan((hf * Math.PI / 180) / 2) * h / w)) * 180 / Math.PI;
}
/** The virtual camera's view of one eye - the ffmpeg filter (the exact
 *  string scripts/vr_swap.flat_vf builds). */
function vrFlatVf(mode, eye, view, w, h) {
  const m = VR_MODES[mode];
  if (!m) return "";
  const v = vrSafe({ ...view, mode });
  const crop = m.stereo === "tb" ? (eye === "L" ? "crop=iw:ih/2:0:0" : "crop=iw:ih/2:0:ih/2")
    : m.stereo === "sbs" ? (eye === "L" ? "crop=iw/2:ih:0:0" : "crop=iw/2:ih:iw/2:0") : "";
  const v360 = `v360=input=${m.proj}:output=flat:yaw=${pyf(v.yaw)}:pitch=${pyf(v.pitch)}`
    + `:h_fov=${pyf(v.fov)}:v_fov=${vfovOf(v.fov, w, h).toFixed(4)}:w=${w}:h=${h}`;
  return crop ? `${crop},${v360}` : v360;
}
/** A click on the whole frame (u, v in 0..1) -> the aim, in the LEFT eye
 *  (a click in the right eye aims at the same spot of the left one). */
function aimFromClick(mode, u, v) {
  const m = VR_MODES[mode];
  if (!m) return null;
  let x = +u, y = +v;
  if (m.stereo === "tb") y = (y % 0.5) * 2;
  if (m.stereo === "sbs") x = (x % 0.5) * 2;
  const span = m.proj === "hequirect" ? 180 : 360;
  return { yaw: r3((x - 0.5) * span), pitch: r3((0.5 - y) * 180) };
}
/** The render size of the view - vr_swap.view_size. */
function vrViewSize(shortSide, shape) {
  const [a, b] = String(VR_SHAPES.includes(shape) ? shape : "1:1").split(":").map(Number);
  const s = Math.max(128, parseInt(shortSide, 10) || 544);
  const q = (x) => Math.max(128, Math.round(x / 16) * 16);
  return a >= b ? { width: q(s * a / b), height: q(s) } : { width: q(s), height: q(s * b / a) };
}

// 2.336.0: quality = lib/swap.QUALITIES id (fast | full | best)
const QUALITY_IDS = ["fast", "full", "best"];
function blank() { return { video: "", picture: "", text: "", max: 0, quality: "full", engine: "h3", settings: RS.settingsBlank(), vr: vrBlank(), segments: [], results: [] }; }

function safe(s) {
  const out = blank();
  if (!s || typeof s !== "object") return out;
  out.video = path.basename(String(s.video || ""));
  out.picture = path.basename(String(s.picture || ""));
  out.text = String(s.text || "").slice(0, 1500);
  out.max = +s.max > 0 ? r3(+s.max) : 0;
  out.quality = QUALITY_IDS.includes(s.quality) ? s.quality : "full";
  out.engine = RS.engineOf(s.engine);                                   // 2.339.0: h3 | ripple
  out.settings = RS.settingsSafe(s.settings);                           // 2.342.0: the ⚙ dialog
  out.vr = vrSafe(s.vr);
  out.segments = (Array.isArray(s.segments) ? s.segments : []).filter((g) => g && +g.frames >= 5)
    .map((g) => ({ id: String(g.id || newId()).replace(/[^a-z0-9]/gi, "").slice(0, 16) || newId(),
                   start: r3(+g.start || 0), dur: +g.dur || (+g.frames / FPS), frames: Math.floor(+g.frames),
                   ...(RS.ffBlank(g.ff) ? {} : { ff: RS.ffSafe(g.ff) }) }))
    .sort((a, b) => a.start - b.start);
  out.results = (Array.isArray(s.results) ? s.results : []).filter((x) => x && x.id)
    .map((x) => ({ id: String(x.id), seg: String(x.seg || ""), video: path.basename(String(x.video || "")),
                   start: r3(+x.start || 0), dur: +x.dur || 0, frames: Math.floor(+x.frames || 0),
                   seed: Number.isFinite(+x.seed) ? Math.floor(+x.seed) : -1, job: String(x.job || ""),
                   status: STATUSES.includes(x.status) ? x.status : "queued",
                   file: path.basename(String(x.file || "")), where: x.where === "keep" ? "keep" : "temp",
                   upscaled: !!x.upscaled, vr: vrParams({ mode: x.vr }) ? x.vr : "",
                   engine: RS.engineOf(x.engine),
                   aim: vrParams({ mode: x.vr }) && x.aim ? aimOf(x.aim) : null,
                   ...(x.safe === true ? { safe: true } : {}),          // 2.350.0: rendered in safe mode
                   error: String(x.error || "").slice(0, 800) }));
  return out;
}

const fileFor = (projDir) => path.join(projDir, FILE);
function load(projDir) {
  try { return safe(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); } catch { return blank(); }
}
function save(projDir, state) {
  const s = safe(state);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(s, null, 2));
  return s;
}
function dirOf(projDir, where) {
  const d = path.join(projDir, where === "keep" ? KEEP : TEMP);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Replace the plan (Auto segment) - segments that already have results
 *  keep their id when the same window comes back, so their results stay
 *  attached. */
function setSegments(state, list) {
  const s = safe(state);
  const old = s.segments;
  s.segments = (list || []).map((g) => {
    const same = old.find((o) => Math.abs(o.start - g.start) < 0.5 / FPS && o.frames === g.frames);
    // a segment the plan keeps keeps its ✎ first frame (2.339.0)
    return { id: same ? same.id : newId(), start: g.start, dur: g.dur, frames: g.frames, ...(same && same.ff ? { ff: same.ff } : {}) };
  });
  return s;
}

/** Add one window (the box) unless the plan already has it; -> {state, seg}. */
function addSegment(state, g) {
  const s = safe(state);
  let seg = s.segments.find((o) => Math.abs(o.start - g.start) < 0.5 / FPS && o.frames === g.frames);
  if (!seg) {
    seg = { id: newId(), start: g.start, dur: g.dur, frames: g.frames };
    s.segments.push(seg);
    s.segments.sort((a, b) => a.start - b.start);
  }
  return { state: s, seg };
}

function removeSegment(state, id) {
  const s = safe(state);
  s.segments = s.segments.filter((g) => g.id !== String(id));
  return s;
}

/** A finished segment's file name: <stem>_swap_<NN>_<a>-<b>s[_up].mp4 -
 *  sorts in time order, says where in the movie it belongs. */
function resultName(video, idx, start, dur, upscaled, vr) {
  const stem = path.basename(String(video || "video"), path.extname(String(video || ""))).replace(/[^\w.-]+/g, "_").slice(0, 60) || "video";
  const f = (x) => (Math.round(x * 100) / 100).toFixed(2);
  // a VR segment keeps the players' suffix LAST (_180_LR / _360_TB / _360)
  return `${stem}_swap_${String(idx).padStart(2, "0")}_${f(start)}-${f(start + dur)}s${upscaled ? "_up" : ""}${vrSuffix(vr)}.mp4`;
}

/** A name that is free in dir: name.mp4, name-2.mp4 ... */
function uniquify(dir, name) {
  const ext = path.extname(name), stem = path.basename(name, ext);
  let cand = name, i = 1;
  while (fs.existsSync(path.join(dir, cand))) cand = `${stem}-${++i}${ext}`;
  return cand;
}

/** The segment's position in the plan (1-based; 0 = not in it). */
function indexOf(state, segId) {
  const i = (state.segments || []).findIndex((g) => g.id === segId);
  return i + 1;
}

/** A new result row for a queued job. */
function addResult(state, row) {
  const s = safe(state);
  const r = { id: newId(), seg: row.seg || "", video: row.video || s.video, start: row.start, dur: row.dur,
              frames: row.frames, seed: row.seed, job: row.job, status: "queued", file: "",
              where: "temp", upscaled: !!row.upscaled, vr: vrParams({ mode: row.vr }) ? row.vr : "",
              aim: vrParams({ mode: row.vr }) && row.aim ? aimOf(row.aim) : null, error: "",
              engine: RS.engineOf(row.engine) };
  s.results.push(r);
  return { state: s, result: r };
}

/**
 * SYNC the queued / running results with the job table. `jobOf(id)` ->
 * {status, output} or null; `take(result, output)` moves a finished job's
 * file into vidTemp and returns its name (or throws). Returns
 * {state, changed}.
 */
function sync(state, jobOf, take) {
  const s = safe(state);
  let changed = false, learned = false;
  for (const r of s.results) {
    if (r.status !== "queued" && r.status !== "running") continue;
    const j = jobOf(r.job);
    if (!j) { r.status = "lost"; r.error = "the job is gone (the app restarted?) - ↻ Retry"; changed = true; continue; }
    if (j.status === "queued" || j.status === "running") {
      if (r.status !== j.status) { r.status = j.status; changed = true; }
      continue;
    }
    changed = true;
    if (j.status === "done" && j.output) {
      try { r.file = take(r, j.output); r.status = "done"; if (j.safe) { r.safe = true; learned = true; } }
      catch (e) { r.status = "failed"; r.error = `could not file the result: ${e.message}`; }
    } else {
      r.status = j.status === "cancelled" ? "cancelled" : "failed";
      // 2.343.0: the worker's OWN reason on the card, not just "see the log"
      r.error = j.status === "cancelled" ? "cancelled"
        : j.error ? `the render failed: ${String(j.error).slice(0, 700)}` : "the render failed - see the job's log";
    }
  }
  return { state: s, changed, safe: learned };
}

/**
 * 2.343.0: why a job failed, from its log - the worker's last
 * "[worker] ERROR: ..." line, else (a crash) the traceback's last line.
 * -> "" when the log says nothing useful.
 */
function workerError(lines) {
  const L = (Array.isArray(lines) ? lines : []).map((x) => String(x || "").trim()).filter(Boolean);
  for (let i = L.length - 1; i >= 0; i--) {
    const m = /\[worker\] ERROR:\s*(.*)$/.exec(L[i]);
    if (!m) continue;
    // 2.345.0 (Tim: "the render failed: ComfyUI rejected the workflow:" and
    // nothing after it): the lines the error went on with are the reason too
    const more = [];
    for (let j = i + 1; j < L.length && !/^(\[|@@)/.test(L[j]); j++) more.push(L[j]);
    return [m[1], ...more].filter(Boolean).join(" · ").replace(/: · /g, ": ").slice(0, 700);
  }
  const tb = L.findIndex((x) => /^Traceback \(most recent call last\)/.test(x));
  if (tb >= 0) {
    const last = L.slice(tb + 1).reverse().find((x) => /^[A-Za-z_.]*(Error|Exception)\b|^[A-Za-z_.]+: /.test(x));
    if (last) return ("the worker crashed: " + last).slice(0, 400);
  }
  return "";
}

/** Drop finished rows whose file is gone (deleted outside the app). */
function prune(state, exists) {
  const s = safe(state);
  const before = s.results.length;
  s.results = s.results.filter((r) => r.status !== "done" || (r.file && exists(r)));
  return { state: s, dropped: before - s.results.length };
}

/** The results to JOIN: the given ids that are kept and done, in time order
 *  (an upscaled take of a window wins over the plain one of the same window
 *  only if both were ticked - the caller decides; duplicates by id dropped). */
function toCompile(state, ids) {
  const want = new Set((Array.isArray(ids) ? ids : []).map(String));
  return safe(state).results.filter((r) => want.has(r.id) && r.status === "done" && r.where === "keep" && r.file)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** Overlapping windows among the picked results (joined as-is, the movie
 *  would repeat those frames) - reported, not refused. */
function overlaps(list) {
  const out = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (b.start < a.start + a.dur - 0.5 / FPS) out.push([a.file, b.file]);
  }
  return out;
}

/**
 * ffmpeg: join the files (each {path, audio, dur}) end to end into `dst` -
 * scaled to the first one's size (an upscaled segment among plain ones),
 * 24 fps, H.264 + AAC; a file with no audio track gets silence of its
 * length so the concat keeps every segment's picture in step with its sound.
 */
function compileArgs(files, dst, width, height, opts) {
  const o = opts || {};
  const args = ["-y", "-loglevel", "error"];
  const parts = [];
  let n = 0;
  const idx = [];
  for (const f of files) {
    args.push("-i", f.path);
    idx.push({ v: n, a: f.audio ? n : null, dur: f.dur });
    n++;
  }
  for (const it of idx) {
    if (it.a === null) {
      args.push("-f", "lavfi", "-t", (+it.dur || 1).toFixed(4), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
      it.a = n++;
    }
  }
  const W = Math.max(2, Math.round(width / 2) * 2), H = Math.max(2, Math.round(height / 2) * 2);
  idx.forEach((it, i) => {
    parts.push(`[${it.v}:v:0]fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease,`
      + `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`);
    parts.push(`[${it.a}:a:0]aresample=48000,aformat=channel_layouts=stereo[a${i}]`);
  });
  const chain = idx.map((_, i) => `[v${i}][a${i}]`).join("");
  parts.push(`${chain}concat=n=${idx.length}:v=1:a=1[v][a]`);
  // 2.330.0: VR above 4K is H.265 (players decode 8K H.265; H.264 stops
  // near 4K) and keeps moov at the END so the spherical box can be added
  const codec = o.codec || ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p"];
  args.push("-filter_complex", parts.join(";"), "-map", "[v]", "-map", "[a]", ...codec,
    "-c:a", "aac", "-b:a", "192k", ...(o.vr ? [] : ["-movflags", "+faststart"]), dst);
  return args;
}

/** The compiled movie's name in the project's Video assets. */
function compileName(video, vr) {
  const stem = path.basename(String(video || "video"), path.extname(String(video || ""))).replace(/[^\w.-]+/g, "_").slice(0, 60) || "video";
  return `${stem}_swapped${vrSuffix(vr)}.mp4`;
}

/** The video codec for a size - vr_swap.codec_args (x265 = libx265 is there). */
function codecArgs(w, h, x265) {
  if ((+w) * (+h) > 4096 * 2304 && x265)
    return ["-c:v", "libx265", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", "-tag:v", "hvc1"];
  return ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p"];
}

module.exports = { FILE, TEMP, KEEP, FPS, BEST_FRAMES, QUALITY_IDS, snapDown, maxSeconds, bestSeconds, clampMax, plan, one, blank, safe, load, save,
                   fileFor, dirOf, setSegments, addSegment, removeSegment, resultName, uniquify, indexOf,
                   addResult, sync, workerError, prune, toCompile, overlaps, compileArgs, compileName, codecArgs,
                   VR_MODES, VR_SHAPES, vrBlank, vrSafe, vrParams, aimOf, vrSuffix, detectVr, vrFlatVf, vfovOf,
                   aimFromClick, vrViewSize };
