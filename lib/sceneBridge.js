"use strict";
/**
 * sceneBridge.js — TRANSITION GAPS BETWEEN THE SONG'S SEGMENTS (2.358.0).
 *
 * Tim: "what if we add a transition checkbox to the song menubar before the save button, with a duration
 * input. if user adds a 0.5 second transition when resegment the song with a 0.5 sec (or x duration) after
 * each segment. this way i could render segment 1 and 3 as ref for example and segment 2 as fl2va, first
 * frame will be last frame of segment 1 and last frame will be first frame of segment 3. If user clicks
 * transition then we can do standard transitions like wipe, fade, dissolve etc from the last frame of seg 1
 * to first frame of seg 3".
 *
 * The song strip's ☐ Transition + seconds + type (ext/videodock): 💾 stages the song with a BRIDGE scene of
 * that length after every segment but the last. The gap is carved from the END of each segment, so every
 * segment still starts on the cut the user placed. The .seg keeps the user's cuts; the board keeps the gap
 * (st.seg_gap) and each bridge row carries bridge {type, after}:
 *   type "ai"      fl2va through the native-audio board: starts on the scene before's LAST frame and ends
 *                  on the scene after's FIRST frame. H3 renders 17n+5 frames, so the clip renders the next
 *                  length up and is then fitted to the gap exactly (retimed; the song window re-laid).
 *   a catalogue id (lib/transitions.json - fade, dissolve, wipe..., the timeline's own list): no model at
 *                  all - bridge_worker.py draws that transition with ffmpeg between the same two frames and
 *                  lays the song window under it.
 *   after          the content scene it follows (1 = after the first segment's scene), so a writer's plan
 *                  (which only knows the segments) is woven back around the bridges (weave()).
 */
const fs = require("fs");
const path = require("path");

const GAP_MIN = 0.1, GAP_MAX = 4;
const MIN_LEFT = 0.5;            // a segment keeps at least this much once its gap is carved
const FPS = 24;
const AI = "ai";

function catalogue() { return require("./transitions").list().filter((t) => t.xfade); }

/** The types a bridge can be: AI first, then the timeline's transitions that draw something. */
function types() {
  return [{ id: AI, label: "AI (fl2va) - the model moves from frame to frame", group: "AI" }]
    .concat(catalogue().map((t) => ({ id: t.id, label: t.label, group: t.group })));
}

function normType(t) {
  const id = String(t || "").trim();
  return id === AI || catalogue().some((x) => x.id === id) ? id : AI;
}

/** The gap in seconds (0 = none), clamped to 0.1..4 and rounded to 0.05 s. */
function normGap(g) {
  const v = Number(g);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(Math.min(GAP_MAX, Math.max(GAP_MIN, v)) * 20) / 20;
}

const r2 = (x) => Math.round(x * 100) / 100;

/** The board's windows for a segment map with a gap after each segment but the last:
 *  [{start, dur, bridge: false} | {start, dur, bridge: true, after: k}], plus the cuts left without a gap
 *  (a segment too short to give it up). */
function gapWindows(durations, gap) {
  const g = normGap(gap);
  const out = [], skipped = [];
  let acc = 0, k = 0;
  (durations || []).forEach((d, i) => {
    const last = i === durations.length - 1;
    k += 1;
    if (!last && g > 0 && d - g >= MIN_LEFT) {
      out.push({ start: r2(acc), dur: r2(d - g), bridge: false, k });
      out.push({ start: r2(acc + d - g), dur: g, bridge: true, after: k });
    } else {
      if (!last && g > 0) skipped.push(k);
      out.push({ start: r2(acc), dur: r2(d), bridge: false, k });
    }
    acc += d;
  });
  return { windows: out, skipped, gap: g };
}

/** The H3 length that COVERS `dur` seconds (the next 17n+5 up), capped at the ceiling. */
function framesFor(dur, ceiling) {
  const need = Math.max(5, Math.ceil(Math.max(0.01, Number(dur) || 0) * FPS - 1e-9));
  const f = 5 + 17 * Math.ceil((need - 5) / 17);
  return Math.min(ceiling || 362, f);
}

const isBridge = (r) => !!(r && r.bridge && typeof r.bridge === "object");

/** A row's bridge, coerced ({type, after}) or undefined. */
function safeBridge(b) {
  if (!b || typeof b !== "object") return undefined;
  const after = parseInt(b.after, 10);
  return { type: normType(b.type), after: Number.isFinite(after) && after > 0 ? after : 1 };
}

/** The scene before a bridge and the scene after it (content scenes, by board order). */
function neighbours(st, row) {
  const list = ((st && st.list) || []).filter((x) => x && !isBridge(x));
  const prev = list.filter((x) => x.n < row.n).sort((a, b) => b.n - a.n)[0] || null;
  const next = list.filter((x) => x.n > row.n).sort((a, b) => a.n - b.n)[0] || null;
  return { prev, next };
}

/** The board number of the k-th content scene (the writer counts content scenes only), or null. */
function contentN(st, k) {
  const list = ((st && st.list) || []).filter((x) => x && !isBridge(x)).sort((a, b) => a.n - b.n);
  const r = list[k - 1];
  return r ? r.n : null;
}

/** A bridge card's prompt (the AI render reads it; a standard transition just shows it). */
function promptFor(type, dur, after) {
  const t = normType(type);
  const what = t === AI ? "AI fl2va"
    : (catalogue().find((x) => x.id === t) || { label: t }).label.toLowerCase();
  return [`[Bridge ${after}] (${what}, ${dur}s: from scene ${after}'s last frame to the next scene's first frame) `
    + "One continuous move from the opening frame to the closing frame - the same performers, place and light, "
    + "no cut, no new people, no on-screen text."];
}

/** Bridge rows that a plan without bridges (the writer's) must keep: woven back in after content shot
 *  `after`. A bridge whose next content scene no longer exists is left out. */
function weave(shots, bridgeRows) {
  const content = (shots || []).filter((s) => s && !s.bridge);
  const by = new Map();
  for (const b of bridgeRows || []) {
    const bb = safeBridge(b.bridge);
    if (!bb || bb.after >= content.length) continue;
    if (!by.has(bb.after)) by.set(bb.after, []);
    by.get(bb.after).push({ id: b.id, prompt: b.prompt, length: b.length, seed: b.seed,
                            audio_start: b.audio_start, audio_dur: b.audio_dur, bridge: bb });
  }
  if (!by.size) return shots;
  const out = [];
  content.forEach((s, i) => { out.push(s); for (const b of by.get(i + 1) || []) out.push(b); });
  return out;
}

/** {file, label} of a take's frame (time null = the last frame), from its lossless master when it has one. */
function frameOf(takePath, time, label) {
  const f = require("./sceneRefs").extractFrame(takePath, time);
  return f ? { file: f, name: path.basename(f), label } : null;
}

/** The take of a row on disk (abs path) or "". */
function takePath(row) {
  if (!row || !row.output || !["rendered", "kept"].includes(row.status)) return "";
  const p = require("./sceneFrames").takeOf(row);
  return p && fs.existsSync(p) ? p : "";
}

/** What a bridge needs from its neighbours: {prev, next, prevTake, nextTake} or {error}. */
function sources(st, row) {
  const { prev, next } = neighbours(st, row);
  if (!prev || !next) return { error: `bridge scene ${row.n} sits at the ${prev ? "end" : "start"} of the board - `
    + "it needs a scene on each side" };
  const prevTake = takePath(prev), nextTake = takePath(next);
  const miss = [!prevTake ? prev.n : null, !nextTake ? next.n : null].filter((x) => x != null);
  if (miss.length) return { error: `bridge scene ${row.n} goes from scene ${prev.n}'s last frame to scene ${next.n}'s `
    + `first frame - render scene ${miss.join(" and ")} first (Render selected queues bridges after the scenes)` };
  return { prev, next, prevTake, nextTake };
}

/** The AI bridge's closing frame: the next scene's FIRST frame ({file, name, label}) or {error}. */
function aiLast(st, row) {
  const s = sources(st, row);
  if (s.error) return s;
  const f = frameOf(s.nextTake, 0, `scene ${s.next.n}'s first frame`);
  return f ? { frame: f, prev: s.prev, next: s.next }
    : { error: `could not read scene ${s.next.n}'s first frame` };
}

/** The params of a standard-transition bridge job (bridge_worker.py). */
function standardParams(st, row, o) {
  const s = sources(st, row);
  if (s.error) return s;
  const t = (catalogue().find((x) => x.id === normType(row.bridge.type)) || {});
  const dur = Number(o.dur) > 0 ? Number(o.dur) : (Number(row.audio_dur) > 0 ? Number(row.audio_dur) : 0.5);
  const master = (p) => { try { return require("./rawMaster").sourceFor(p); } catch { return p; } };
  return { params: {
    mode: "bridge",
    prompt: (row.prompt || []).join(" ").slice(0, 400),
    bridge: { xfade: t.xfade || "fade", type: t.id || "fade", label: t.label || "Cross dissolve",
              seconds: Math.round(dur * 1000) / 1000,
              prev_take: master(s.prevTake), next_take: master(s.nextTake),
              song: o.song || "", start: Number(o.start) || 0, fps: FPS,
              width: o.width || 0, height: o.height || 0 },
    scene: { n: row.n, chapter: row.chapter || "", bridge: true },
  }, note: `bridge scene ${row.n}: ${t.label || "Cross dissolve"} for ${Math.round(dur * 100) / 100}s from scene `
    + `${s.prev.n}'s last frame to scene ${s.next.n}'s first frame (ffmpeg, no model)`
    + (o.song ? " with the song window under it" : "") };
}

/** Fit a finished AI bridge to its gap: retime the clip to exactly `seconds` and lay the song window under
 *  it (in place). -> {ok, note} | {ok:false, note}. */
function fit(src, f) {
  const cp = require("child_process");
  const secs = Number(f && f.seconds);
  if (!src || !fs.existsSync(src) || !(secs > 0)) return { ok: false, note: "nothing to fit" };
  let have = 0;
  try {
    have = parseFloat(cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", src], { encoding: "utf8", timeout: 30000 })) || 0;
  } catch { have = 0; }
  if (!(have > 0)) return { ok: false, note: "the bridge take could not be probed - kept as rendered" };
  const tmp = src.replace(/(\.[^.]+)?$/, "_fit.mp4");
  const song = f.song && fs.existsSync(f.song) ? f.song : "";
  const args = ["-y", "-i", src];
  if (song) args.push("-ss", String(Math.max(0, Number(f.start) || 0)), "-t", String(secs), "-i", song);
  args.push("-filter:v", `setpts=${(secs / have).toFixed(6)}*PTS,fps=${FPS}`, "-map", "0:v:0");
  if (song) args.push("-map", "1:a:0", "-c:a", "aac", "-b:a", "192k");
  else args.push("-an");
  args.push("-t", String(secs), "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", tmp);
  try { cp.execFileSync("ffmpeg", args, { stdio: "ignore", timeout: 120000 }); } catch { /* checked below */ }
  if (!fs.existsSync(tmp)) return { ok: false, note: "the bridge could not be fitted to its gap - kept as rendered" };
  fs.renameSync(tmp, src);
  return { ok: true, note: `bridge fitted: ${Math.round(have * 100) / 100}s rendered -> ${secs}s (its gap)`
    + (song ? ", the song window laid under it" : "") };
}

/** One standard-transition bridge through bridge_worker.py: {job, notes} | {status, error}. The caller
 *  (routes/characters.js queueScene) has checked the row is idle. */
function queue(project, st, r) {
  const core = require("./core");
  const scenes = require("./scenes");
  const sceneTimeline = require("./sceneTimeline");
  const renderSettings = require("./renderSettings");
  const w = sceneTimeline.windowFor(st, r.n);
  const song = st.audio ? path.join(core.pDir("sound"), path.basename(st.audio)) : "";
  const d0 = core.getConfig().defaults || {};
  const rs = renderSettings.jobOverrides(renderSettings.read(core.projDir(project || core.getProject())),
    { width: d0.width, height: d0.height });
  const sp = standardParams(st, r, { dur: w.dur, start: w.start, song: song && fs.existsSync(song) ? song : "",
                                     width: rs.width, height: rs.height });
  if (sp.error) return { status: 409, error: sp.error };
  const job = core.makeJob(sp.params);
  scenes.save(scenes.starting(st, r.n, job.id).state, project);
  return { job, notes: [sp.note] };
}

/** Change one bridge's type (the card's picker). -> {state, row} | {error, status}. */
function setType(st, n, type) {
  const scenes = require("./scenes");
  const s = scenes.safe(st);
  const r = scenes.at(s, n);
  if (!r) return { status: 404, error: "no such scene" };
  if (!r.bridge) return { status: 400, error: `scene ${r.n} is not a bridge` };
  const t = normType(type);
  if (t === r.bridge.type) return { state: s, row: r, changed: false };
  const was = r.bridge.type;
  r.bridge = { ...r.bridge, type: t };
  r.anchor = t === AI ? "first" : undefined;
  // the card's prompt follows the type when it is still the generated one
  const gen = promptFor(was, r.audio_dur, r.bridge.after).join(" ");
  if ((r.prompt || []).join(" ") === gen) r.prompt = promptFor(t, r.audio_dur, r.bridge.after);
  const sh = ((s.plan || {}).shots || []).find((x) => x && x.id === r.id);
  if (sh) { sh.bridge = { ...r.bridge }; sh.prompt = r.prompt; }
  return { state: s, row: r, changed: true };
}

module.exports = { queue, setType, GAP_MIN, GAP_MAX, MIN_LEFT, AI, FPS, types, normType, normGap, gapWindows, framesFor, isBridge,
                   safeBridge, neighbours, contentN, promptFor, weave, frameOf, takePath, sources, aiLast,
                   standardParams, fit };
