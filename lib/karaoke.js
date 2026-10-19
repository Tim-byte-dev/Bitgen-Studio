"use strict";
/**
 * karaoke.js — A SONG'S LYRICS ON DISK, AND A KARAOKE OVERLAY FOR EVERY SCENE (2.373.0).
 *
 * Tim: "when bitgen produces a song save the lyrics in a txt file in the project folder. is it possible to add a
 * kareoke layer to the timeline, and generate the kareoke style bouncing ball in videodocker - if it is possible
 * can we add a checkbox to videodocker menu for kareoke - when the video renders, render another video with
 * transparent background with the kareoke lyrics that can be added as an overlay layer in timeline - first render
 * of the scene won't have the kareoke lyrics".
 *
 *   saveLyrics   a finished song's lyrics -> projects/<p>/lyrics/<song name>.txt (lib/core, the music job's end)
 *   lyricsFor    the lyrics of a sound asset: lyrics/<stem>.txt (yours or bitGen's), else the song's render record
 *   align        the KNOWN lyric words matched to speech-to-text's word timings (the words come from the lyrics,
 *                the times from Whisper; a word Whisper missed is placed between its neighbours)
 *   timing       a song's word timings, cached in karaoke/<stem>.timing.json (one transcription per song)
 *   board state  karaoke/board.json - the video docker's 🎤 checkbox and, per scene, its overlay job / file /
 *                "waiting for the timeline" flag (kept beside the board, never inside the .prj's scenes)
 *   onTake       a scene's take just landed and 🎤 is on -> queue its overlay (karaoke_worker.py): the scene's
 *                window of the song [start, start + take length], the take's size, transparent VP9 webm
 *   harvest      the board poll files a finished overlay and flags it for the timeline's Karaoke layer
 * The scene's take itself is never touched - the lyrics only ever live on the overlay.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");

const pdirOf = (project) => core.projDir(project || core.getProject());
const kDir = (project) => { const d = path.join(pdirOf(project), "karaoke"); fs.mkdirSync(d, { recursive: true }); return d; };
const lyricsDir = (project) => path.join(pdirOf(project), "lyrics");
const stemOf = (name) => path.basename(String(name || "")).replace(/\.[^.]+$/, "");
const r3 = (x) => Math.round(x * 1000) / 1000;

// ------------------------------------------------------------------ lyrics on disk
/** A finished song's lyrics -> <pdir>/lyrics/<song stem>.txt. Returns the file name, or null. */
function saveLyrics(pdir, songName, lyrics) {
  const text = String(lyrics || "").replace(/\r\n/g, "\n").trim();
  const stem = stemOf(songName);
  if (!text || !stem) return null;
  const d = path.join(pdir, "lyrics");
  fs.mkdirSync(d, { recursive: true });
  const f = stem + ".txt";
  fs.writeFileSync(path.join(d, f), text + "\n", "utf8");
  return f;
}

/** The lyrics of a sound asset ("" when there are none). */
function lyricsFor(project, song) {
  const stem = stemOf(song);
  if (!stem) return "";
  try { return fs.readFileSync(path.join(lyricsDir(project), stem + ".txt"), "utf8"); } catch { /* next */ }
  try {
    for (const r of require("./songs").listRecords(pdirOf(project)))
      if (stemOf(r.filename) === stem && r.lyrics) return r.lyrics;
  } catch { /* no records */ }
  return "";
}

/** Lyric text -> [{text, line}]: section tags ([verse], [chorus] ...) and empty lines dropped. */
function lyricWords(text) {
  const out = [];
  let line = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const s = raw.replace(/\[[^\]]*\]/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!s) continue;
    for (const w of s.split(" ")) if (w) out.push({ text: w, line });
    line++;
  }
  return out;
}

const norm = (w) => String(w || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");

/** speech-to-text segments -> [{text, start, end}] (a segment without word times is spread over its length). */
function asrWords(segments) {
  const out = [];
  for (const s of segments || []) {
    const ws = (s.words || []).filter((w) => w && String(w.text || w.word || "").trim()
      && Number.isFinite(+w.start) && Number.isFinite(+w.end));
    if (ws.length) {
      for (const w of ws) out.push({ text: String(w.text || w.word).trim(), start: +w.start, end: +w.end });
      continue;
    }
    const parts = String(s.text || "").split(/\s+/).filter(Boolean);
    const t0 = +s.start || 0, t1 = Math.max(t0 + 0.1, +s.end || t0 + parts.length * 0.4);
    parts.forEach((p, i) => out.push({ text: p, start: t0 + (t1 - t0) * i / parts.length,
                                       end: t0 + (t1 - t0) * (i + 1) / parts.length }));
  }
  return out;
}

/** The lyric words timed by the recognised words: longest common subsequence on normalised words; the matched
 *  lyric words take Whisper's times, the rest are spread between their timed neighbours (by letters). */
function align(lyr, heard) {
  const n = lyr.length, m = heard.length;
  if (!n) return [];
  const a = lyr.map((w) => norm(w.text)), b = heard.map((w) => norm(w.text));
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const t = lyr.map((w) => ({ text: w.text, line: w.line, start: null, end: null }));
  let i = 0, j = 0, matched = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) { t[i].start = heard[j].start; t[i].end = heard[j].end; matched++; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // the gaps: between two anchors by letter count; before the first / after the last at ~0.35 s a word
  const anchors = t.map((w, k) => (w.start !== null ? k : -1)).filter((k) => k >= 0);
  if (!anchors.length) return { words: [], matched: 0 };
  const per = 0.35;
  for (let k = anchors[0] - 1; k >= 0; k--) {
    t[k].end = t[k + 1].start;
    t[k].start = Math.max(0, t[k].end - per);
  }
  for (let q = 0; q + 1 < anchors.length; q++) {
    const lo = anchors[q], hi = anchors[q + 1];
    if (hi - lo < 2) continue;
    const from = t[lo].end, to = t[hi].start;
    const mid = t.slice(lo + 1, hi);
    const total = mid.reduce((s, w) => s + Math.max(1, norm(w.text).length), 0);
    let acc = 0;
    for (const w of mid) {
      const len = Math.max(1, norm(w.text).length);
      w.start = from + (to - from) * acc / total;
      acc += len;
      w.end = from + (to - from) * acc / total;
    }
  }
  for (let k = anchors[anchors.length - 1] + 1; k < n; k++) {
    t[k].start = t[k - 1].end;
    t[k].end = t[k].start + per;
  }
  for (const w of t) { w.start = r3(w.start); w.end = r3(Math.max(w.end, w.start + 0.05)); }
  return { words: t, matched };
}

/** No speech-to-text: the lyric lines spread evenly over the song (a rough guide, said so in the log). */
function evenTiming(lyr, dur) {
  if (!lyr.length || !(dur > 0)) return [];
  const total = lyr.reduce((s, w) => s + Math.max(1, norm(w.text).length), 0);
  let acc = 0;
  const lead = Math.min(dur * 0.1, 8);
  const span = Math.max(1, dur - lead - 1);
  return lyr.map((w) => {
    const len = Math.max(1, norm(w.text).length);
    const s = lead + span * acc / total;
    acc += len;
    return { text: w.text, line: w.line, start: r3(s), end: r3(lead + span * acc / total) };
  });
}

function songPath(project, song) {
  const p = path.join(pdirOf(project), "sound", path.basename(String(song || "")));
  return fs.existsSync(p) ? p : null;
}

/** A song's word timings {song, how, words:[{text,line,start,end}], lyrics: bool}; cached per song + lyrics. */
async function timing(project, song, opts) {
  const o = opts || {};
  const sp = songPath(project, song);
  if (!sp) throw new Error(`the song "${song}" is not in this project's sound assets`);
  const lyrics = lyricsFor(project, song);
  // 2.408.0: the WHOLE lyrics in the key - it used to be the length + the first 64 characters, so fixing a word further
  // down (same length: "wrong" -> "right") kept the old, wrong words from the cache
  const key = timingKey(sp, lyrics);
  const cache = path.join(kDir(project), stemOf(song) + ".timing.json");
  // 2.408.0: the words corrected one by one in the 🎤 dialog (words + their times) win while the lyrics are the same
  const fixed = readFixed(project, song, key);
  if (fixed && !o.raw) return fixed;
  if (!o.fresh) {
    try { const c = JSON.parse(fs.readFileSync(cache, "utf8")); if (c.key === key && Array.isArray(c.words)) return c; }
    catch { /* none yet */ }
  }
  const lyr = lyricWords(lyrics);
  let heard = [], asrError = "";
  try {
    const asr = o.asr || require("./asr");
    const tr = await asr.transcribe({ name: path.basename(sp), mode: "lyrics" });
    heard = asrWords(tr.segments);
  } catch (e) { asrError = String(e && e.message || e); }
  let words = [], how = "";
  if (lyr.length && heard.length) {
    const al = align(lyr, heard);
    if (al.matched >= Math.max(1, Math.min(3, Math.floor(lyr.length * 0.1)))) {
      words = al.words; how = `the lyrics timed by speech-to-text (${al.matched} of ${lyr.length} words heard)`;
    }
  }
  if (!words.length && lyr.length) {
    words = evenTiming(lyr, core.probeDuration(sp) || 0);
    how = heard.length ? "the lyrics spread evenly (speech-to-text heard too few of them)"
      : `the lyrics spread evenly (no speech-to-text: ${asrError || "nothing heard"})`;
  }
  if (!words.length && heard.length) {
    // no lyrics on file: what speech-to-text heard is the karaoke (a line = a pause of 0.8 s or more)
    let line = 0;
    words = heard.map((w, k) => {
      if (k && w.start - heard[k - 1].end > 0.8) line++;
      return { text: w.text, line, start: r3(w.start), end: r3(w.end) };
    });
    how = "the words speech-to-text heard (no lyrics file for this song)";
  }
  if (!words.length) throw new Error(`no lyrics for "${song}" - put them in lyrics/${stemOf(song)}.txt`
    + (asrError ? `, or install speech-to-text (${asrError})` : ""));
  const out = { song: path.basename(sp), key, how, lyrics: !!lyr.length, words, made: new Date().toISOString() };
  fs.writeFileSync(cache, JSON.stringify(out, null, 1));
  return out;
}

function timingKey(sp, lyrics) {
  return `${fs.statSync(sp).mtimeMs}:${require("crypto").createHash("sha1").update(String(lyrics)).digest("hex")}`;
}
const fixedFile = (project, song) => path.join(kDir(project), stemOf(song) + ".words.json");
function readFixed(project, song, key) {
  try {
    const f = JSON.parse(fs.readFileSync(fixedFile(project, song), "utf8"));
    if (f.key === key && Array.isArray(f.words) && f.words.length)
      return { song: path.basename(song), key, how: "your corrected words", lyrics: true, fixed: true, words: f.words, made: f.made };
  } catch { /* none */ }
  return null;
}
/** 2.408.0: the 🎤 dialog's word list saved as THE words of this song (their text and times) - until its lyrics change.
 *  words [{text, line, start, end}] -> the cleaned list; [] / null clears the corrections. */
function saveWords(project, song, words) {
  const sp = songPath(project, song);
  if (!sp) throw Object.assign(new Error(`the song "${song}" is not in this project's sound assets`), { status: 404 });
  const f = fixedFile(project, song);
  if (!Array.isArray(words) || !words.length) { try { fs.unlinkSync(f); } catch { /* none */ } return []; }
  const clean = words.map((w) => ({ text: String((w && w.text) || "").replace(/\s+/g, " ").trim().slice(0, 80),
                                     line: Math.max(0, Math.round(+w.line || 0)), start: r3(Math.max(0, +w.start || 0)), end: r3(Math.max(0, +w.end || 0)) }))
    .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => (w.end > w.start ? w : Object.assign(w, { end: r3(w.start + 0.3) })))
    .sort((a, b) => a.start - b.start);
  if (!clean.length) throw Object.assign(new Error("no words left"), { status: 400 });
  fs.writeFileSync(f, JSON.stringify({ key: timingKey(sp, lyricsFor(project, song)), words: clean, made: new Date().toISOString() }, null, 1));
  return clean;
}
/** words -> lyric text (a line per `line`) - what the 🎤 dialog's box shows when the song has no lyrics on file */
function wordsText(words) {
  const lines = [];
  (words || []).forEach((w) => { const l = Math.max(0, +w.line || 0); (lines[l] = lines[l] || []).push(w.text); });
  return lines.filter(Boolean).map((l) => l.join(" ")).join("\n");
}

/** The words inside [start, start + dur] of the song, shifted so 0 = the window's start. */
function windowWords(words, start, dur) {
  const a = +start || 0, b = a + Math.max(0, +dur || 0);
  return (words || []).filter((w) => w.end > a && w.start < b)
    .map((w) => ({ text: w.text, line: w.line, start: r3(Math.max(0, w.start - a)), end: r3(Math.min(b, w.end) - a) }));
}

// ------------------------------------------------------------------ the board's karaoke state
const boardFile = (project) => path.join(kDir(project), "board.json");
function readBoard(project) {
  try {
    const b = JSON.parse(fs.readFileSync(boardFile(project), "utf8")) || {};
    return { on: b.on === true, scenes: b.scenes && typeof b.scenes === "object" ? b.scenes : {} };
  } catch { return { on: false, scenes: {} }; }
}
function writeBoard(project, b) {
  fs.writeFileSync(boardFile(project), JSON.stringify({ on: !!b.on, scenes: b.scenes || {} }, null, 1));
  return b;
}
function setEntry(project, n, patch) {
  const b = readBoard(project);
  const k = String(parseInt(n, 10));
  b.scenes[k] = { ...(b.scenes[k] || {}), ...patch, at: new Date().toISOString() };
  writeBoard(project, b);
  return b.scenes[k];
}

function probeSize(p) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x", p], { encoding: "utf8" });
  const m = String(r.stdout || "").trim().split("\n")[0].match(/^(\d+)x(\d+)/);
  return m ? { w: +m[1], h: +m[2] } : { w: 1280, h: 720 };
}

/** Queue scene n's overlay for its CURRENT take. Never throws; the reason lands on the entry. */
async function queueScene(project, st, n, deps) {
  const d = deps || {};
  const scenes = require("./scenes"), sceneTimeline = require("./sceneTimeline");
  const r = scenes.at(st, n);
  const fail = (why) => setEntry(project, n, { status: "failed", error: why, pending: false });
  if (!r || !r.output) return fail("the scene has no take yet");
  if (!st.audio) return fail("the board has no song - karaoke follows the board's song");
  const take = path.basename(r.output);
  const takePath = path.join(pdirOf(project), "video", take);
  if (!fs.existsSync(takePath)) return fail(`the take ${take} is not in the video assets`);
  const w = sceneTimeline.windowFor(st, r.n);
  const start = Number.isFinite(w.start) ? w.start : (r.n === 1 ? 0 : null);
  if (start === null) return fail("this scene has no window of the song (start / duration)");
  const dur = core.probeDuration(takePath) || w.dur || 5;
  setEntry(project, n, { status: "timing", take, error: "", pending: false, job: "", output: "" });
  let t;
  try { t = await timing(project, st.audio, { asr: d.asr }); }
  catch (e) { return fail(String(e && e.message || e)); }
  const words = windowWords(t.words, start, dur);
  if (!words.length) return setEntry(project, n, { status: "none", error: "no lyrics in this part of the song" });
  const size = probeSize(takePath);
  const job = core.makeJob({
    mode: "karaoke", project: project || core.getProject(),
    prompt: `[karaoke] scene ${r.n} - ${words.length} word(s) of ${t.song}`,
    width: size.w, height: size.h, frames: 0, steps: 0, seed: 0, format: "webm",
    karaoke: { words, width: size.w, height: size.h, dur: r3(dur), fps: 24, name: `scene_${r.n}_karaoke`,
               scene: r.n, song: t.song, window: `${r3(start)}s - ${r3(start + dur)}s`, how: t.how,
               style: require("./karaokeStyle").read() },            // 2.380.0: the karaoke style (⚙)
  });
  return setEntry(project, n, { status: "queued", job: job.id, take, start: r3(start), dur: r3(dur), how: t.how });
}

/** 2.380.0 (Tim: "add a karaoke generator to timeline"): an overlay for ANY song (a sound asset), for its
 *  [start, start + dur] (dur 0 = to the end of the song), at the timeline picture's size. Resolves
 *  {job, words, how, start, dur, song} or throws (no song / no lyrics in that part). */
async function queueSong(project, o, deps) {
  const d = deps || {};
  const song = path.basename(String((o || {}).song || ""));
  const sp = songPath(project, song);
  if (!sp) throw new Error(`the song "${song}" is not in this project's sound assets`);
  const total = core.probeDuration(sp) || 0;
  const start = Math.max(0, +o.start || 0);
  let dur = +o.dur > 0 ? +o.dur : Math.max(0, total - start);
  if (total > 0) dur = Math.min(dur, Math.max(0, total - start));
  if (!(dur > 0.2)) throw new Error("that part of the song is too short");
  const t = await timing(project, song, { asr: d.asr });
  const words = windowWords(t.words, start, dur);
  if (!words.length) throw new Error("no lyrics in that part of the song");
  const even2 = (v, fb) => { const n = Math.round(+v); return Number.isFinite(n) && n >= 64 && n <= 4096 ? n - (n % 2) : fb; };
  const W = even2(o.width, 1280), H = even2(o.height, 720);
  const job = core.makeJob({
    mode: "karaoke", project: project || core.getProject(),
    prompt: `[karaoke] ${song} ${r3(start)}s - ${r3(start + dur)}s, ${words.length} word(s)`,
    width: W, height: H, frames: 0, steps: 0, seed: 0, format: "webm",
    karaoke: { words, width: W, height: H, dur: r3(dur), fps: 24, name: `${stemOf(song)}_karaoke`,
               song: t.song, window: `${r3(start)}s - ${r3(start + dur)}s`, how: t.how,
               style: require("./karaokeStyle").read() },
  });
  return { job, words: words.length, how: t.how, start: r3(start), dur: r3(dur), song: t.song };
}

/** A take just landed (the board poll): queue its overlay when 🎤 is on. */
function onTake(project, st, n, deps) {
  if (!readBoard(project).on) return false;
  queueScene(project, st, n, deps).catch(() => {});
  return true;
}

/** File finished overlay jobs: done -> the video asset's name + "waiting for the timeline". */
function harvest(project) {
  const b = readBoard(project);
  let changed = false;
  for (const [k, e] of Object.entries(b.scenes)) {
    if (e.status !== "queued" || !e.job) continue;
    const job = core.jobs.get(e.job);
    if (job && !job.finished) continue;
    if (job && job.status === "done" && job.output) {
      b.scenes[k] = { ...e, status: "done", output: path.basename(job.output), pending: true, error: "" };
    } else {
      let why = "the overlay job vanished (server restarted?)";
      try { if (job) why = require("./scenes").reasonFromLog(job.log) || "the overlay did not render"; } catch { /* keep */ }
      b.scenes[k] = { ...e, status: "failed", error: why, pending: false };
    }
    changed = true;
  }
  if (changed) writeBoard(project, b);
  return changed;
}

/** The page put scene n's overlay on the Karaoke layer. */
function placed(project, n, output) {
  const b = readBoard(project);
  const e = b.scenes[String(parseInt(n, 10))];
  if (!e) return { ok: false, error: "no karaoke for that scene" };
  if (output && path.basename(String(output)) !== e.output) return { ok: false, error: "a newer overlay is waiting" };
  e.pending = false;
  writeBoard(project, b);
  return { ok: true };
}

/** 🎤 on / off. Turning it ON queues an overlay for every rendered scene that has none for its current take. */
function setOn(project, on, st, deps) {
  const b = readBoard(project);
  b.on = !!on;
  writeBoard(project, b);
  const queued = [];
  if (b.on && st) {
    for (const r of st.list || []) {
      if (!r.output || !(r.status === "rendered" || r.status === "kept")) continue;
      const e = b.scenes[String(r.n)];
      const busy = e && (e.status === "queued" || e.status === "timing");
      if (busy || (e && e.status === "done" && e.take === path.basename(r.output))) continue;
      queued.push(r.n);
      queueScene(project, st, r.n, deps).catch(() => {});
    }
  }
  return { on: b.on, queued };
}

/** The Karaoke layer for a film built from takes [{n, take, start}] - the done overlays made for exactly those
 *  takes, each at its take's start - or null (🎤 off, or none ready). */
function timelineLayer(project, takes) {
  const b = readBoard(project);
  if (!b.on) return null;
  const clips = [];
  for (const t of takes || []) {
    const e = b.scenes[String(t.n)];
    if (!e || e.status !== "done" || !e.output || e.take !== path.basename(String(t.take || ""))) continue;
    if (!fs.existsSync(path.join(pdirOf(project), "video", e.output))) continue;
    const dur = Math.max(0.1, +e.dur || 5);
    clips.push({ name: e.output, start: +t.start || 0, dur, in: 0, out: dur, opacity: 1, src: "video", kar_n: t.n });
  }
  if (!clips.length) return null;
  return { name: "Karaoke", karaoke: true, clips, opacity: 1, volume: 1, visible: true, solo: false, muted: true };
}

module.exports = { saveLyrics, lyricsFor, lyricWords, asrWords, align, evenTiming, timing, windowWords, norm,
                   saveWords, wordsText, readFixed, timingKey,
                   readBoard, writeBoard, setEntry, queueScene, queueSong, onTake, harvest, placed, setOn, timelineLayer, lyricsDir, kDir };
