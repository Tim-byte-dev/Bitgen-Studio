// bitGen Studio — lib/captions.js (2.406.0): the timeline's CAPTION track, made from what is said on it.
//
// Tim: "lets start closing the gap and go with your suggestions as you see fit" (caption tracks from the transcript).
//
//   build(tl, opts)   every clip that SPEAKS (V1 and the video layers unless muted, plus any sound clip whose role is
//                     voice) is transcribed once per file (faster-whisper, lib/asr.js - cached by the file's size + time
//                     in <project>/transcripts/<stem>.words.json), its words kept to the clip's in..out, moved to where
//                     the clip sits on the timeline (its speed / ramp too - static/clipfx.js), and cut into cues of at
//                     most `maxChars` characters / `maxSecs` seconds, broken at sentence ends.
//   normalize(c)      tl.captions as the compile reads it: {cues, style, burn, srt} (scripts/captions_ass.py) or null
//   toSrt(cues)       the SubRip text (the panel's "⬇ .srt")
// routes/captions.js serves these; the panel is ext/timelinedock/captions.js.
"use strict";
const fs = require("fs");
const path = require("path");
const FX = require("../static/clipfx.js");

function asr() { return require("./asr"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const STYLE = { font: "Arial", size: 5.5, color: "#ffffff", outline: 2.5, outline_color: "#000000", box: false,
                box_color: "#000000", box_opacity: 0.6, position: "bottom", margin: 6, bold: true };
const FONTS = ["Arial", "Helvetica", "Verdana", "Trebuchet MS", "Georgia", "Times New Roman", "Courier New", "Impact",
               "DejaVu Sans", "Liberation Sans", "Noto Sans"];

function style(st) {
  const s = Object.assign({}, STYLE, st && typeof st === "object" ? st : {});
  const hex = (v, d) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(v || "")) ? String(v) : d);
  return {
    font: String(s.font || STYLE.font).replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40) || STYLE.font,
    size: clamp(num(s.size, STYLE.size), 1, 20),
    color: hex(s.color, STYLE.color),
    outline: clamp(num(s.outline, STYLE.outline), 0, 20),
    outline_color: hex(s.outline_color, STYLE.outline_color),
    box: !!s.box,
    box_color: hex(s.box_color, STYLE.box_color),
    box_opacity: clamp(num(s.box_opacity, STYLE.box_opacity), 0, 1),
    position: ["bottom", "top", "middle"].includes(s.position) ? s.position : "bottom",
    margin: clamp(num(s.margin, STYLE.margin), 0, 40),
    bold: s.bold !== false,
  };
}
function cleanCues(cues) {
  return (Array.isArray(cues) ? cues : [])
    .map((c) => ({ start: +num(c && c.start, NaN).toFixed(3), end: +num(c && c.end, NaN).toFixed(3),
                   text: String((c && c.text) || "").replace(/\r/g, "").trim().slice(0, 400) }))
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c.text)
    .sort((a, b) => a.start - b.start)
    .slice(0, 5000);
}
/** tl.captions for the compile: null when there is nothing to burn or write */
function normalize(c) {
  if (!c || typeof c !== "object") return null;
  const cues = cleanCues(c.cues);
  if (!cues.length || c.visible === false) return null;
  const burn = c.burn !== false, srt = !!c.srt;
  if (!burn && !srt) return null;
  return { cues, style: style(c.style), burn, srt };
}

const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, "0");
function srtTime(t) {
  const ms = Math.round(Math.max(0, t) * 1000);
  return `${pad(ms / 3600000)}:${pad((ms / 60000) % 60)}:${pad((ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}
function toSrt(cues) {
  return cleanCues(cues).map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
}

/* ---------- source second -> timeline second for a clip (inverse of FX.srcTime; null = not played) */
function tlTime(c, src) {
  const i0 = num(c.in, 0), o0 = c.out != null ? num(c.out, i0) : num(c.dur, i0 + 5);
  if (src < Math.min(i0, o0) - 1e-3 || src > Math.max(i0, o0) + 1e-3) return null;
  const len = FX.clipLen(Object.assign({}, c, { out: o0 })) || Math.max(0, o0 - i0);
  if (!FX.retimed(c.fx)) return num(c.start, 0) + (src - i0);
  // srcTime is monotone along the clip (backwards for a reversed one): bisect
  const rev = !!(c.fx && c.fx.reverse);
  let lo = 0, hi = len;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2, s = FX.srcTime(c, mid);
    if (rev ? s > src : s < src) lo = mid; else hi = mid;
  }
  return num(c.start, 0) + (lo + hi) / 2;
}

/* ---------- words -> cues */
function cut(words, opts) {
  const maxChars = clamp(num(opts && opts.maxChars, 42), 12, 120);
  const maxSecs = clamp(num(opts && opts.maxSecs, 5), 1, 12);
  const out = [];
  let cur = null;
  const flush = () => { if (cur && cur.text.trim()) out.push({ start: cur.start, end: cur.end, text: cur.text.trim() }); cur = null; };
  for (const w of words) {
    const t = String(w.word || w.text || "").trim();
    if (!t) continue;
    if (cur && (cur.text.length + 1 + t.length > maxChars || w.end - cur.start > maxSecs || w.start - cur.end > 1.2)) flush();
    if (!cur) cur = { start: w.start, end: w.end, text: t };
    else { cur.text += " " + t; cur.end = Math.max(cur.end, w.end); }
    if (/[.!?…]["')\]]?$/.test(t) && cur.text.length >= Math.min(10, maxChars * 0.35)) flush();
  }
  flush();
  // a cue stays up at least 0.7 s, never into the next one
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1] ? out[i + 1].start : Infinity;
    out[i].end = Math.min(Math.max(out[i].end, out[i].start + 0.7), next - 0.02);
    out[i].start = +out[i].start.toFixed(3); out[i].end = +Math.max(out[i].start + 0.2, out[i].end).toFixed(3);
  }
  return out;
}

/** a transcript's segments -> words (a segment without word timings is spread evenly over its length) */
function wordsOf(segments) {
  const out = [];
  for (const s of segments || []) {
    const ws = Array.isArray(s.words) ? s.words.filter((w) => w && Number.isFinite(+w.start) && Number.isFinite(+w.end)) : [];
    if (ws.length) ws.forEach((w) => out.push({ start: +w.start, end: +w.end, word: String(w.word || w.text || "").trim() }));
    else {
      const toks = String(s.text || "").trim().split(/\s+/).filter(Boolean);
      const a = +s.start || 0, b = Math.max(a + 0.1, +s.end || a + 0.1), d = (b - a) / Math.max(1, toks.length);
      toks.forEach((t, i) => out.push({ start: a + i * d, end: a + (i + 1) * d, word: t }));
    }
  }
  return out;
}

/** the clip's words on the timeline (kept to its in..out) */
function clipWords(c, words) {
  const out = [];
  for (const w of words) {
    const a = tlTime(c, w.start), b = tlTime(c, w.end);
    if (a == null || b == null) continue;
    out.push({ start: Math.min(a, b), end: Math.max(a, b), word: w.word });
  }
  return out;
}

/** the clips that speak, from the page's timeline ({video, v1, vlayers, audio}) */
function speakers(tl) {
  const out = [];
  const t = tl || {};
  const live = (L) => L && !L.muted && L.visible !== false;
  if (live(t.v1 || {}) && !t.vmute && (t.v1 || {}).role !== "music")
    (t.video || []).forEach((c) => out.push(c));
  (t.vlayers || []).forEach((L) => { if (live(L) && (L.role || "voice") === "voice") (L.clips || []).forEach((c) => out.push(c)); });
  (t.audio || []).forEach((L) => { if (live(L) && L.role === "voice") (L.clips || []).forEach((c) => out.push(c)); });
  return out.filter((c) => c && c.name && !(c.fx && c.fx.reverse));
}

function cacheFile(src) {
  const st = fs.statSync(src);
  const stem = path.basename(src).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._ -]+/g, "_");
  return { file: path.join(asr().OUT_DIR(), stem + ".words.json"), key: `${st.size}:${Math.round(st.mtimeMs)}` };
}
async function transcript(name, opts) {
  const src = asr().findAsset(name);
  if (!src) throw bad("not in this project: " + name, 404);
  const cf = cacheFile(src);
  try {
    const j = JSON.parse(fs.readFileSync(cf.file, "utf8"));
    if (j.key === cf.key && Array.isArray(j.segments) && !(opts && opts.fresh)) return { segments: j.segments, cached: true };
  } catch { /* none yet */ }
  const r = await asr().transcribe({ name, mode: "speech", word_timestamps: true, language: opts && opts.language });
  fs.writeFileSync(cf.file, JSON.stringify({ key: cf.key, name: path.basename(src), language: r.language, segments: r.segments }));
  return { segments: r.segments, cached: false };
}

/** the caption cues for the whole timeline -> {cues, sources: [{name, words, cached}], skipped: [{name, why}]} */
async function build(tl, opts) {
  const o = opts || {};
  const clips = speakers(tl);
  if (!clips.length) throw bad("nothing on the timeline speaks - captions come from V1, the video layers and any sound layer set to 🗣 voice");
  if (!o.transcribe) {
    let st = null;
    try { st = await asr().status(); } catch { st = null; }
    if (st && !st.installed) throw bad("speech-to-text (faster-whisper) is not installed - Settings → Audio installs it", 409);
  }
  const by = new Map();
  clips.forEach((c) => { const k = path.basename(String(c.name)); if (!by.has(k)) by.set(k, []); by.get(k).push(c); });
  const sources = [], skipped = [];
  let words = [];
  for (const [name, cs] of by) {
    try {
      const t = await (o.transcribe || transcript)(name, o);
      const ws = wordsOf(t.segments);
      let n = 0;
      cs.forEach((c) => { const cw = clipWords(c, ws); n += cw.length; words = words.concat(cw); });
      sources.push({ name, words: n, cached: !!t.cached });
    } catch (e) {
      const msg = String(e.message || e);
      if (/not installed/.test(msg)) throw e;               // no speech-to-text at all: say so once
      skipped.push({ name, why: /nothing was transcribed/.test(msg) ? "no speech" : /could not extract audio/.test(msg) ? "no sound" : msg });
    }
  }
  words.sort((a, b) => a.start - b.start);
  return { cues: cut(words, o), sources, skipped };
}

module.exports = { STYLE, FONTS, style, normalize, cleanCues, toSrt, tlTime, cut, wordsOf, clipWords, speakers, build, transcript };
