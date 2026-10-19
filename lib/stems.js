// bitGen Studio — STEM SEPARATION (2.269.0, Tim: "is there any way bitgen
// can separate the lyrics from the instruments/music" + "add the demucs stem
// separation as an extension").
//
// Runs Meta's demucs (htdemucs) LOCALLY in its own venv (venvs/demucs) via
// scripts/stems_local.py — the same runJson contract whisper and OmniVoice
// use. --two-stems=vocals yields exactly the asked-for pair: the LYRICS
// (vocals) apart from the INSTRUMENTS (instrumental). Weights come from
// demucs' own hub cache on first separate; fully offline afterwards.
//
// Outputs land in the project's sound folder as <song>_vocals.wav and
// <song>_instrumental.wav — ordinary audio assets, so they show up wherever
// songs do (the music dock, chapter SOUND references, the timeline). The
// vocal stem makes the cleanest @music timing reference when a full mix
// confuses lip-sync.
const fs = require("fs");
const path = require("path");
const core = require("./core");
const venv = require("./venv");

function cfg() {
  const c = core.getConfig().stems || {};
  return {
    venv: c.venv || "",
    model: c.model || "htdemucs",
    device: c.device || "auto",
    timeout_ms: Math.max(30000, parseInt(c.timeout_ms, 10) || 1200000),
  };
}

const HELPER = () => path.join(core.resolvePath("scripts"), "stems_local.py");

function runtime() {
  const c = cfg();
  const dir = venv.venvDir("demucs", c.venv);
  const python = venv.venvPython(dir);
  return { dir, python, installed: fs.existsSync(python), ...c };
}

/** Locate a song by name across the folders audio lives in. */
function findAsset(name) {
  const base = path.basename(String(name || ""));
  if (!base) return null;
  for (const d of [core.pDir("sound"), core.pDir("video"), core.pDir("output"),
                   path.join(core.projDir(core.getProject()), "final")]) {
    const p = path.join(d, base);
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

/** Separate one song into vocals + instrumental, into the sound folder.
 *  Returns { vocals, instrumental } as ASSET NAMES (basenames). */
async function separate(name, o = {}) {
  const rt = runtime();
  if (!rt.installed) {
    const e = new Error("demucs is not installed — press Install in the Stems dock "
      + `(expected a venv at ${rt.dir})`);
    e.status = 503; throw e;
  }
  const src = findAsset(name);
  if (!src) { const e = new Error(`no such audio asset: ${name}`); e.status = 404; throw e; }
  const outDir = core.pDir("sound");
  fs.mkdirSync(outDir, { recursive: true });
  const stem = path.basename(src).replace(/\.[^.]+$/, "");
  const j = await venv.runJson(rt.python, HELPER(), {
    file: src, out_dir: outDir, model: rt.model, device: rt.device, stem,
  }, { timeout_ms: rt.timeout_ms, onLog: o.onLog });
  if (j.error) { const e = new Error(j.error); e.status = 500; throw e; }
  return { vocals: path.basename(j.vocals), instrumental: path.basename(j.instrumental) };
}

// ---- MUSIC-VIDEO SEGMENTS (2.270.0, Tim: "automatically split the track
// into 15 second files, and add them to each scene as audio reference.
// ... save segments in music\temp\songname_<n>.<ext> if song name or title
// doesn't exist call it tmp_stem_<n>.<ext>") --------------------------------
//
// ffmpeg's segment muxer cuts the vocal stem (or any track) into 15-second
// pieces at <app>/music/temp/<base>_<n>.<ext> (n is 1-based). Segment n is
// then registered on scene n as a scene-bound chapter SOUND reference (the
// route does the registering) — each scene renders against ITS 15 seconds of
// the song, the cleanest per-scene lipsync timing there is.
const { spawn } = require("child_process");
const chars = require("./characters");

const SEG_SECONDS = 15;
const SEG_DIR = () => core.resolvePath(path.join("music", "temp"));

/** The segment base name: the song's name made tag-safe (the stored name
 *  becomes a ComfyUI upload name and a screenplay @tag's twin — space-free,
 *  the 2.180 rule), demucs' own _vocals/_instrumental suffix stripped so a
 *  stem inherits its SONG's name. No usable name → "tmp_stem" (by
 *  instruction). */
function segBase(name) {
  let s = String(name || "").replace(/\.[^.]+$/, "");
  s = s.replace(/_(vocals|instrumental)$/i, "");
  // tagOf answers "ref" for anything empty (its own reference fallback) —
  // that must never NAME a song, so the no-usable-characters case goes to
  // tmp_stem here (by instruction). \p{L}\p{N}: the 2.246 unicode lesson.
  if (!/[\p{L}\p{N}]/u.test(s)) return "tmp_stem";
  return chars.tagOf(s) || "tmp_stem";
}

function ffmpegRun(args, timeout_ms) {
  return new Promise((resolve) => {
    let out = "";
    let p;
    try { p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] }); }
    catch (e) { return resolve({ code: -1, out: String(e.message || e) }); }
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, timeout_ms || 300000);
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out: String(e.message || e) }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}

/** Split one audio file into 15s segments at music/temp/<base>_<n>.<ext>.
 *  Previous segments of the SAME base are cleared first (temp semantics —
 *  a re-split replaces, never mixes takes). Stream-copy first; a container
 *  that refuses copy-segmenting (some ogg/m4a) is re-encoded instead.
 *  Returns { base, ext, dir, files } — files are basenames, 1..N order. */
/* ---- 2.285.0 (Tim: "add a button to all the waveforms to segment the
   song ... drag the lines ... save a text file as songname.seg"): the
   SEGMENT MAP. A song's segmentation lives beside it as <base>.seg,
   human-readable ("segment 1: 12 seconds"), the single source of truth
   the split, the dock's red lines and the iterative writer all read.
   No .seg means the default 15-second grid over the song's real
   duration (ffprobe). Durations are seconds (fractions kept). ---- */
function segFilePath(songName) {
  return path.join(core.pDir("sound"),
    segBase(songName) + ".seg");
}
function probeSeconds(file) {
  try {
    const r = require("child_process").execFileSync("ffprobe",
      ["-v", "error", "-show_entries", "format=duration",
       "-of", "default=noprint_wrappers=1:nokey=1", file],
      { encoding: "utf8", timeout: 15000 });
    const d = parseFloat(r);
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch { return 0; }
}
function parseSeg(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m2 = /segment\s+(\d+)\s*:\s*([\d.]+)s\s+to\s+([\d.]+)s\s*\(([\d.]+)\s*seconds?\)(\s*\[manual\])?/i.exec(line);
    const m = m2 ? null
      : /segment\s+(\d+)\s*:\s*([\d.]+)\s*seconds?(\s*\[manual\])?/i.exec(line);
    if (m2) out[parseInt(m2[1], 10) - 1] =
      { d: parseFloat(m2[4]), manual: !!m2[5] };
    else if (m) out[parseInt(m[1], 10) - 1] =
      { d: parseFloat(m[2]), manual: !!m[3] };
  }
  const kept = out.filter((x) => x && Number.isFinite(x.d) && x.d > 0);
  return { durations: kept.map((x) => x.d), manual: kept.map((x) => x.manual) };
}
function segments(songName) {
  const src = path.join(core.pDir("sound"), path.basename(String(songName || "")));
  const total = probeSeconds(src);
  const f = segFilePath(songName);
  let durations = [], manual = [];
  if (fs.existsSync(f)) {
    const ps = parseSeg(fs.readFileSync(f, "utf8"));
    durations = ps.durations; manual = ps.manual;
  }
  if (!durations.length && total > 0) {
    const n = Math.max(1, Math.ceil(total / SEG_SECONDS));
    for (let i = 0; i < n; i++)
      durations.push(i < n - 1 ? SEG_SECONDS
        : Math.max(1, total - SEG_SECONDS * (n - 1)));
  }
  const boundaries = [];                     // cumulative, EXCLUDING 0 and total
  let acc = 0;
  for (let i = 0; i < durations.length - 1; i++) {
    acc += durations[i]; boundaries.push(acc);
  }
  while (manual.length < durations.length) manual.push(false);
  return { song: path.basename(String(songName || "")), total, durations,
           manual, boundaries, file: fs.existsSync(f) ? path.basename(f) : null };
}
function saveSegments(songName, durations, manual) {
  const ds = (durations || []).map(Number)
    .filter((x) => Number.isFinite(x) && x > 0);
  if (!ds.length) { const e = new Error("no segment durations"); e.status = 400; throw e; }
  /* 2.286.0: a MANUALLY-set duration is marked [manual] in the file - the
     dock draws it locked and drags it as a whole segment. */
  const mf = Array.isArray(manual) ? manual : [];
  /* 2.288.0 (Tim: "we just need to store the segment times from to in
     the .seg file"): the file now says the WINDOW - "segment 1: 0s to
     12s (12 seconds)" - which is exactly what the TrimAudioDuration
     node takes. parseSeg still reads the old duration-only shape. */
  let acc0 = 0;
  const lines = ds.map((d, i) => {
    const a = Math.round(acc0 * 10) / 10; acc0 += d;
    const b = Math.round(acc0 * 10) / 10;
    return `segment ${i + 1}: ${a}s to ${b}s `
      + `(${Math.round(d * 10) / 10} seconds)` + (mf[i] ? " [manual]" : "");
  });
  fs.writeFileSync(segFilePath(songName), lines.join("\n") + "\n", "utf8");
  return segments(songName);
}

async function split(srcPath, songName, o = {}) {
  if (!fs.existsSync(srcPath)) {
    const e = new Error(`no such audio file: ${srcPath}`); e.status = 404; throw e;
  }
  const base = segBase(songName || path.basename(srcPath));
  const ext = (path.extname(srcPath) || ".wav").toLowerCase();
  const dir = SEG_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const mine = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    + "_\\d+\\.[A-Za-z0-9]+$");
  for (const f of fs.readdirSync(dir)) {
    if (mine.test(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
  }
  const pattern = path.join(dir, `${base}_%d${ext}`);
  /* 2.285.0: a .seg map beside the song wins - the cut points are its
     cumulative boundaries (variable lengths); without one, the fixed
     15-second grid stands as ever. */
  const segMap = segments(songName || path.basename(srcPath));
  const cutArgs = (segMap.boundaries || []).length
    ? ["-segment_times", segMap.boundaries.map((t) => t.toFixed(3)).join(",")]
    : ["-segment_time", String(SEG_SECONDS)];
  const common = ["-hide_banner", "-y", "-i", srcPath, "-f", "segment",
    ...cutArgs, "-segment_start_number", "1",
    "-reset_timestamps", "1", "-map", "0:a:0"];
  let r = await ffmpegRun([...common, "-c", "copy", pattern], o.timeout_ms);
  let files = fs.readdirSync(dir).filter((f) => mine.test(f));
  if (r.code !== 0 || !files.length) {
    // stream-copy refused (container can't cut on packet bounds) — re-encode;
    // ffmpeg picks the encoder from the extension
    r = await ffmpegRun([...common, pattern], o.timeout_ms);
    files = fs.readdirSync(dir).filter((f) => mine.test(f));
  }
  if (r.code !== 0 || !files.length) {
    const e = new Error("ffmpeg could not split the track: "
      + String(r.out || "").split("\n").filter(Boolean).slice(-3).join(" | "));
    e.status = 500; throw e;
  }
  files.sort((a, b) => (parseInt(a.match(/_(\d+)\.[^.]+$/)[1], 10)
                      - parseInt(b.match(/_(\d+)\.[^.]+$/)[1], 10)));
  const out = { base, ext, dir, files, seconds: SEG_SECONDS,
    durations: (segMap.durations || []).slice(0, files.length) };
  // 2.275.0: the LAST split persists — "create the music video" writes a
  // FRESH scene list, and the segments must re-bind to it after the fact
  try { fs.writeFileSync(path.join(dir, "last_split.json"),
    JSON.stringify({ ...out, at: Date.now() }, null, 2), "utf8"); } catch {}
  return out;
}

/** The last split's record, or null. Files gone from disk are dropped —
 *  the record never claims a segment that no longer exists. */
function lastSplit() {
  try {
    const j = JSON.parse(fs.readFileSync(
      path.join(SEG_DIR(), "last_split.json"), "utf8"));
    if (!j || !Array.isArray(j.files)) return null;
    j.dir = SEG_DIR();
    j.files = j.files.filter((f) => fs.existsSync(path.join(j.dir, f)));
    return j.files.length ? j : null;
  } catch { return null; }
}

/** Bind split segments to the board: segment n → scene n, as scene-bound
 *  chapter SOUND references (2.270's contract, extracted here in 2.275.0 so
 *  the split route AND the music-video ask share ONE assignment). A fresh
 *  call replaces the previous assignment wholesale. */
/* ---- 2.287.0 (Tim: "save the segments to project name/songs/song name/
   segments/song name_seg_n.mp3 (allow user to select mp3 or wav)"): the
   SEGMENT EXPORT - real files the user owns, cut at the .seg map's
   boundaries, named <base>_seg_<n>.<ext> under
   projects/<p>/songs/<base>/segments/. mp3 re-encodes (libmp3lame
   default), wav decodes to pcm; previous exports of the same base are
   replaced. Returns { base, dir, files, format, durations }. ---- */
async function exportSegments(songName, format, o = {}) {
  const fmt = String(format || "mp3").toLowerCase() === "wav" ? "wav" : "mp3";
  const src = path.join(core.pDir("sound"), path.basename(String(songName || "")));
  if (!fs.existsSync(src)) {
    const e = new Error(`no such song: ${path.basename(String(songName || ""))}`);
    e.status = 404; throw e;
  }
  const map = segments(songName);
  if (!(map.total > 0) || !map.durations.length) {
    const e = new Error("the song has no segment map - press ✂# in the "
      + "stems dock first"); e.status = 400; throw e;
  }
  const base = segBase(songName);
  const dir = path.join(path.dirname(core.pDir("sound")),
    "songs", base, "segments");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    if (new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        + "_seg_\\d+\\.(mp3|wav)$").test(f)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  }
  const files = [];
  let start = 0;
  for (let i = 0; i < map.durations.length; i++) {
    const name = `${base}_seg_${i + 1}.${fmt}`;
    const args = ["-hide_banner", "-y", "-ss", start.toFixed(3),
      "-t", map.durations[i].toFixed(3), "-i", src, "-map", "0:a:0"];
    if (fmt === "wav") args.push("-c:a", "pcm_s16le");
    args.push(path.join(dir, name));
    const r = await ffmpegRun(args, o.timeout_ms);
    if (r.code !== 0 || !fs.existsSync(path.join(dir, name))) {
      const e = new Error(`ffmpeg could not cut segment ${i + 1}: `
        + String(r.out || "").split("\n").filter(Boolean).slice(-2).join(" | "));
      e.status = 500; throw e;
    }
    files.push(name); start += map.durations[i];
  }
  return { base, dir, files, format: fmt, durations: map.durations.slice() };
}

function assignSegments(project, split) {
  const scenes = require("./scenes");
  const chapterRefs = require("./chapterRefs");
  const board = scenes.load(project);
  const list = Array.isArray(board.list) ? board.list : [];
  chapterRefs.clearExternalSegments(project);
  const assigned = [], leftover = [];
  (split.files || []).forEach((f, i) => {
    const n = i + 1;
    const sc = list.find((x) => x && x.n === n);
    if (!sc) { leftover.push(f); return; }
    chapterRefs.addExternal(project, sc.chapter || "", split.dir, f, {
      label: f.replace(/\.[^.]+$/, ""), kind: "sound", scene: n,
      type: "soundtrack segment",
      description: `${(split.durations && split.durations[i])
          ? Math.round(split.durations[i] * 10) / 10 + "-second"
          : "15-second"} slice ${n} of "${split.base}" — scene ${n}'s `
        + "own soundtrack timing reference" });
    assigned.push({ scene: n, chapter: sc.chapter || "", file: f });
  });
  const note = !list.length
    ? "no scenes on the board yet — segments are saved; split again "
      + "once the board has scenes and each will bind to its scene"
    : (leftover.length
       ? `${leftover.length} segment(s) beyond the board's ${list.length} `
         + "scene(s) stay unassigned in music/temp"
       : "");
  return { assigned, leftover, note };
}

/** 2.276.0 (Tim: "the vocal separation still has some instrumental
 *  artifacts, can we add a selector for the waveform and set the volume
 *  for the selected part (flatten the wave)"): apply a gain to ONE time
 *  region of a sound asset and SAVE — the surgical fix for demucs bleed
 *  (gain 0 flattens the region to silence). ffmpeg's volume filter with a
 *  timeline enable does the cut; the result replaces the file ATOMICALLY
 *  (temp beside it, then rename), so the name every reference points at
 *  stays true and the waveform cache re-keys on the new mtime by itself. */
async function volumeEdit(name, a, b, gain, o = {}) {
  const src = findAsset(name);
  if (!src) { const e = new Error(`no such audio asset: ${name}`); e.status = 404; throw e; }
  const fa = Number(a), fb = Number(b), g = Number(gain);
  if (!(fa >= 0 && fb <= 1 && fa < fb)) {
    const e = new Error("the selection must be a region: 0 <= from < to <= 1");
    e.status = 400; throw e;
  }
  if (!(g >= 0 && g <= 4)) {
    const e = new Error("volume must be between 0 (silence) and 4 (x4)");
    e.status = 400; throw e;
  }
  // 2.277.0 THE VOLUME BASE — the slider applies INSTANTLY on every change,
  // so the same region gets edited repeatedly; editing the edited file
  // would COMPOUND gains (50% then 30% = 15%). Each region-session works
  // FROM A BASE COPY: rebase !== false refreshes <src>.volbase from the
  // current file (a new selection starts a new session); rebase === false
  // re-edits from the existing base, so the slider's value is ABSOLUTE.
  const base = src + ".volbase";           // no audio extension — never
  const ext = (path.extname(src) || ".wav").toLowerCase();   // lists as an asset
  if (o.rebase !== false || !fs.existsSync(base)) fs.copyFileSync(src, base);
  const dur = core.probeDuration(base);
  if (!(dur > 0)) { const e = new Error(`could not read the duration of ${name}`);
                    e.status = 500; throw e; }
  const t0 = (fa * dur).toFixed(3), t1 = (fb * dur).toFixed(3);
  // 2.277.0: the temp wears .voltmp LAST — the 2.276 form
  // (<stem>.voltmp.wav) still matched *.wav and a stranded one LISTED as
  // an asset (Tim's field report). A legacy straggler is swept here.
  const tmp = src + ".voltmp";
  try { fs.unlinkSync(src.replace(/\.[^.]+$/, "") + `.voltmp${ext}`); } catch {}
  const r = await ffmpegRun(["-hide_banner", "-y", "-i", base,
    "-f", ext.replace(".", "") === "wav" ? "wav" : ext.replace(".", ""),
    "-af", `volume=enable='between(t,${t0},${t1})':volume=${g}`,
    "-map", "0:a:0", tmp], o.timeout_ms || 300000);
  if (r.code !== 0 || !fs.existsSync(tmp)) {
    try { fs.unlinkSync(tmp); } catch {}
    const e = new Error("ffmpeg could not apply the volume: "
      + String(r.out || "").split("\n").filter(Boolean).slice(-3).join(" | "));
    e.status = 500; throw e;
  }
  // 2.277.0 WINDOWS EPERM (Tim's field report: "EPERM: operation not
  // permitted, rename ... _vocals.voltmp.wav -> ... _vocals.wav"): a
  // rename over a file some player still holds open fails on Windows.
  // The client releases its Audio handle before posting, but other
  // holders exist (the timeline, Explorer preview) — so: retry with
  // backoff, then fall back to copy-INTO the file, and only then fail
  // IN WORDS with the edit kept beside the file.
  let replaced = false, lastErr = null;
  for (const wait of [0, 100, 250, 500, 1000]) {
    if (wait) await new Promise((rs) => setTimeout(rs, wait));
    try { fs.renameSync(tmp, src); replaced = true; break; }
    catch (e) {
      lastErr = e;
      if (!/EPERM|EBUSY|EACCES/.test(String(e.code || e.message))) break;
    }
  }
  if (!replaced) {
    try { fs.copyFileSync(tmp, src); fs.unlinkSync(tmp); replaced = true; }
    catch (e2) { lastErr = e2; }
  }
  if (!replaced) {
    const e = new Error(`${path.basename(src)} is held open by another program `
      + "(a player, the timeline, or Explorer's preview) — stop playback and "
      + "apply the volume again; the edited audio is kept beside it as "
      + path.basename(tmp) + ` (${String(lastErr && lastErr.code || lastErr)})`);
    e.status = 423; throw e;
  }
  return { name: path.basename(src), from: Number(t0), to: Number(t1),
           gain: g, duration: dur };
}

module.exports = { cfg, runtime, findAsset, separate, HELPER,
                   split, segBase, SEG_DIR, SEG_SECONDS,
                   lastSplit, assignSegments, volumeEdit, exportSegments,
                   segments, saveSegments };
