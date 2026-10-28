// bitGen Studio — lib/tlJoin.js (2.612.0): the two parts of a CUT clip made into ONE file again, so the timeline holds
// one continuous clip instead of two clips side by side (the hand-over from one to the other showed a black frame in the
// preview). Used by routes/tlJoin.js (POST /api/timeline/join) - the page calls it after ✂ Cut / Del on frames
// (ext/timelinedock/tljoin.js).
//
// Tim (verbatim): "when clips are cut the remaining portion is being put next to the part before the cut as a separate
// clip, it is leaving a black frame that can't be edited - can we merge the before cut and after cut portion of the layer
// so it is 1 continuous clip".
//
//   plan(o)            {kind, file, parts: [[in, out] ...], ext} or throws in words - pure (the unit test's)
//   outName(name, ext, taken)   "<base>-join<n><ext>" - the first free n (a joined file joined again stays short)
//   filterOf(parts, audio, video)  the ffmpeg -filter_complex: each part trimmed (frame-exact, decoded), then concat
//   join(o)            {name, dur, src?} - the new file in the project's Video (or Sound) assets
"use strict";
const fs = require("fs"), path = require("path");
const { execFile } = require("child_process");

const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const r6 = (v) => Math.round(v * 1e6) / 1e6;

function outName(name, ext, taken) {
  const base = path.basename(String(name || "clip")).replace(/\.[^.]+$/, "").replace(/-join\d+$/, "").replace(/[^\w.\- ()]+/g, "_").slice(0, 80) || "clip";
  const has = typeof taken === "function" ? taken : () => false;
  for (let n = 1; n < 10000; n++) { const f = `${base}-join${n}${ext}`; if (!has(f)) return f; }
  throw bad("no free name for the joined clip");
}
function plan(o) {
  const b = o || {};
  const kind = b.kind === "audio" ? "audio" : "video";
  const name = path.basename(String(b.name || ""));
  if (!name) throw bad("which clip? (name)");
  const parts = (Array.isArray(b.parts) ? b.parts : []).map((p) => [Number(p && p[0]), Number(p && p[1])]);
  if (parts.length < 2) throw bad("two parts or more are joined");
  if (parts.length > 16) throw bad("16 parts at most");
  for (const [a, z] of parts) if (!Number.isFinite(a) || !Number.isFinite(z) || a < 0 || z - a < 1e-3) throw bad("each part is [in, out] seconds of the file, out after in");
  const src = String(b.src || "");
  const ext0 = path.extname(name).toLowerCase();
  const ext = kind === "audio" ? ".flac" : ext0 === ".webm" ? ".webm" : ".mp4";   // a .webm can carry transparency - kept
  return { kind, name, src, parts: parts.map(([a, z]) => [r6(a), r6(z)]), ext, dur: r6(parts.reduce((s, [a, z]) => s + (z - a), 0)) };
}
function filterOf(parts, audio, video) {
  const f = [], cat = [];
  parts.forEach(([a, z], i) => {
    if (video) f.push(`[0:v]trim=start=${a}:end=${z},setpts=PTS-STARTPTS[v${i}]`);
    if (audio) f.push(`[0:a]atrim=start=${a}:end=${z},asetpts=PTS-STARTPTS[a${i}]`);
    cat.push((video ? `[v${i}]` : "") + (audio ? `[a${i}]` : ""));
  });
  f.push(`${cat.join("")}concat=n=${parts.length}:v=${video ? 1 : 0}:a=${audio ? 1 : 0}${video ? "[v]" : ""}${audio ? "[a]" : ""}`);
  return f.join(";");
}
function run(bin, args) {
  return new Promise((ok, no) => execFile(bin, args, { maxBuffer: 16 * 1024 * 1024 }, (err, so, se) =>
    (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok(String(so || "")))));
}
async function hasAudio(file) {
  try { return /audio/.test(await run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file])); }
  catch { return false; }
}
async function join(o) {
  const core = require("./core"), frames = require("./frames");
  const p = plan(o);
  const file = frames.resolveMedia(p.name, p.kind === "audio" ? (p.src === "video" ? "video" : p.src === "output" ? "output" : "sound") : p.src);
  if (!file) throw bad("the clip's file is not in this project: " + p.name, 404);
  core.ensureProject(core.getProject());
  const dir = core.pDir(p.kind === "audio" ? "sound" : "video"); fs.mkdirSync(dir, { recursive: true });
  const name = outName(p.name, p.ext, (f) => fs.existsSync(path.join(dir, f)));
  const out = path.join(dir, name), tmp = path.join(dir, "." + name + ".tmp" + p.ext);
  const audio = await hasAudio(file), video = p.kind === "video";
  if (!video && !audio) throw bad("that file has no sound to join");
  const codec = !video ? ["-c:a", "flac"]
    : p.ext === ".webm"
      ? ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "18", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4"].concat(audio ? ["-c:a", "libopus", "-b:a", "192k"] : [])
      : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart"].concat(audio ? ["-c:a", "aac", "-b:a", "256k"] : []);
  const maps = (video ? ["-map", "[v]"] : []).concat(audio ? ["-map", "[a]"] : []);
  try {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-filter_complex", filterOf(p.parts, audio, video)].concat(maps, codec, ["-f", p.ext === ".webm" ? "webm" : p.ext === ".flac" ? "flac" : "mp4", tmp]));
    fs.renameSync(tmp, out);
  } catch (e) { try { fs.rmSync(tmp, { force: true }); } catch { /* fine */ } throw e; }
  return video ? { name, dur: p.dur, src: "video", audio } : { name, dur: p.dur };
}
module.exports = { plan, outName, filterOf, join };
