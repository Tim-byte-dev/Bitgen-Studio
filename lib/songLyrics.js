// bitGen Studio — lib/songLyrics.js (2.923.0): THE WORDS OF A SONG, HEARD - for the 🎶 Song tab when a song file has none.
//
// Tim: "can we add a transcribe and put the lyrics in the song tab if no lyrics are found. let user know that it is
// transcribing with a progress bar"
//
// A background job the Song tab follows (routes/songTags.js polls it):
//   1. the voice taken out of the music first - Song Separation (demucs, lib/stems.js) when it is installed, into a
//      folder of its own (never the Sound assets): Whisper hears sung words far better without the band. Not
//      installed = the whole mix is heard, and the job says so.
//   2. Speech to Text (faster-whisper / Bark, lib/asr.js transcribeFile) on the voice, its "[asr] 12.3/180s" lines are
//      the progress.
//   3. the segments become the lyrics: a line each, a blank line where the singer pauses (a verse break).
// state: {id, stage: queued | separate | load | transcribe | done | error, pct 0-100 | null (not measurable yet),
//         note, mix, lyrics, language, error, need}   need = "whisper" when Speech to Text is not installed
//   start({file, name, separate, keep, test}) -> state (test: the e2e suite's segments, H3_E2E only);  get(id) -> state;  toLyrics(segments, text) (pure)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const JOBS = new Map();
const KEEP_MS = 30 * 60 * 1000;
const GAP_S = 2.5;                           // a pause this long between two lines = a new verse
// what Whisper says over music that nobody sang
const NOISE = /^(?:\(?\[?(?:music|instrumental|applause|laughter|silence|inaudible)\]?\)?|♪+|thank(?:s| you) for watching[.!]*|subtitles? by .*)$/i;

/** Whisper's segments -> the Song tab's lyrics: a line per segment, a blank line at a long pause (pure) */
function toLyrics(segments, text) {
  const segs = (Array.isArray(segments) ? segments : []).map((s) => ({ start: +s.start || 0, end: +s.end || 0, text: String(s.text || "").replace(/\s+/g, " ").trim() }))
    .filter((s) => s.text && !NOISE.test(s.text.replace(/[♪]/g, "").trim() || "♪"));
  if (!segs.length) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t ? t.split(/(?<=[.!?])\s+/).join("\n") : "";
  }
  const out = [];
  segs.forEach((s, i) => {
    if (i && s.start - segs[i - 1].end >= GAP_S) out.push("");
    out.push(s.text.replace(/[♪]/g, "").trim());
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function view(j) {
  const o = {};
  for (const k of ["id", "stage", "pct", "note", "mix", "lyrics", "language", "error", "need", "file", "started", "finished", "seconds"]) if (j[k] !== undefined) o[k] = j[k];
  return o;
}
function get(id) { const j = JOBS.get(String(id || "")); return j ? view(j) : null; }
function sweep() { const now = Date.now(); for (const [id, j] of JOBS) if (j.finished && now - j.finished > KEEP_MS) JOBS.delete(id); }

/** o = {file: an audio file (the job owns it when o.keep is false - it is deleted after), name, separate (default true)} */
function start(o) {
  sweep();
  const id = require("crypto").randomBytes(6).toString("hex");
  const j = { id, stage: "queued", pct: 0, note: "starting", file: path.basename(String(o.name || o.file || "")), started: Date.now() };
  JOBS.set(id, j);
  run(j, o).catch((e) => { j.stage = "error"; j.error = String((e && e.message) || e); j.pct = null; j.finished = Date.now(); })
    .finally(() => { if (!o.keep) fs.unlink(o.file, () => {}); });
  return view(j);
}

async function run(j, o) {
  if (process.env.H3_E2E === "1" && Array.isArray(o.test)) return standIn(j, o.test);   // the suite's stand-in (no Whisper there)
  const asr = require("./asr"), stems = require("./stems");
  const st = await asr.status();
  const bark = (st.engine === "bark" && st.bark && st.bark.installed);
  if (!st.installed && !bark) {
    j.need = "whisper";
    throw new Error("Speech to Text is not installed - ⬇ Download it in the box (Settings ▸ Audio ▸ Install faster-whisper), then transcribe again");
  }
  let src = o.file, tmp = null;
  try { j.seconds = Math.round(require("./core").probeDuration(src) || 0) || undefined; } catch { /* unknown length */ }
  const sep = o.separate !== false && stems.runtime().installed;
  const split = sep ? 40 : 0;                 // the bar: separation 0-40 %, hearing 40-100 % (or all of it)
  if (sep) {
    j.stage = "separate"; j.pct = 0; j.note = "taking the voice out of the music (Song Separation)";
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-lyrics-"));
    const r = await stems.separate("", { file: src, out_dir: tmp, stem: "song", onLog: (l) => {
      const m = String(l).match(/(\d{1,3})%\|/g);
      if (m) { const p = Math.min(100, +m[m.length - 1].replace(/\D/g, "")); j.pct = Math.round(p * split / 100); }
    } });
    src = path.join(tmp, r.vocals);
  } else {
    j.mix = true;
  }
  try {
    j.stage = "load"; j.pct = split; j.note = "loading the speech model";
    const tr = await asr.transcribeFile(src, { onLog: (l) => {
      const m = /\[asr\] ([\d.]+)\/([\d.]+)s/.exec(String(l));
      if (m && +m[2] > 0) { j.stage = "transcribe"; j.note = "hearing the words"; j.pct = Math.round(split + Math.min(1, +m[1] / +m[2]) * (100 - split)); }
      else if (/\[asr\] loading/.test(String(l))) { j.stage = "load"; j.note = "loading the speech model"; }
    } });
    const lyrics = toLyrics(tr.segments, tr.text);
    if (!lyrics) throw new Error("no words were heard - is there singing in this song?");
    j.lyrics = lyrics; j.language = tr.language || undefined;
    j.stage = "done"; j.pct = 100; j.note = "done"; j.finished = Date.now();
  } finally {
    if (tmp) fs.rm(tmp, { recursive: true, force: true }, () => {});
  }
}

/** the e2e suite's stand-in: the same stages and a bar that moves (about 3 s), then the given segments as the words */
async function standIn(j, segs) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  j.mix = true; j.stage = "load"; j.note = "loading the speech model"; j.pct = 0; await wait(600);
  for (let p = 10; p <= 100; p += 15) { j.stage = "transcribe"; j.note = "hearing the words"; j.pct = Math.min(100, p); await wait(350); }
  j.lyrics = toLyrics(segs, ""); j.language = "en";
  if (!j.lyrics) throw new Error("no words were heard - is there singing in this song?");
  j.stage = "done"; j.pct = 100; j.note = "done"; j.finished = Date.now();
}

module.exports = { start, get, toLyrics, JOBS, GAP_S };
