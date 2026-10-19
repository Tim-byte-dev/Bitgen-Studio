"use strict";
/**
 * sceneLyrics.js — THE WORDS SUNG IN EACH SCENE'S STRETCH OF THE SONG (2.356.0).
 *
 * Tim: "the llm is writing [Shot 1] @apartment ... @jesse_paul's lips remain fully closed for every frame ...
 * for the video no words for lip sync, so my vid doesn't have lip sync".
 *
 * The music-video writer decided on its own that the scene was instrumental (rule 2 lets it close the lips
 * "on an instrumental stretch"), and nothing told it - or the render - which stretches of the song actually
 * have a vocal. The song's TIMED transcript does: the .srt / .lrc lib/asr writes (Voice / Stems ->
 * Transcribe, "lyrics" mode) into projects/<p>/transcripts/<song stem>.*, or one beside the song.
 *
 *   load(songPath)             -> [{start, end, text}] or null (no timed transcript)
 *   words(segs, start, dur)    -> the words sung inside the window ("" = none: instrumental)
 *   forWindow(songPath, win)   -> {known, words, file}
 *   boardNote(st, songPath)    -> the writer's "WHAT IS SUNG IN EACH SCENE" block ("" without a transcript)
 */
const fs = require("fs");
const path = require("path");

function parseSrt(txt) {
  const out = [];
  const t = (h, m, s, ms) => (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
  for (const block of String(txt || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const m = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/.exec(block);
    if (!m) continue;
    const text = block.split("\n").slice(block.split("\n").findIndex((l) => l.includes("-->")) + 1).join(" ").trim();
    if (text) out.push({ start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]), text });
  }
  return out;
}

function parseLrc(txt) {
  const rows = [];
  for (const line of String(txt || "").replace(/\r/g, "").split("\n")) {
    const stamps = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    for (const s of stamps) rows.push({ start: (+s[1]) * 60 + (+s[2]), text });
  }
  rows.sort((a, b) => a.start - b.start);
  // an LRC line runs to the next line (the last one: 6 s at most)
  return rows.filter((r) => r.text).map((r, i, a) => ({ start: r.start, end: i + 1 < a.length ? a[i + 1].start : r.start + 6, text: r.text }));
}

/** The transcript files a song may have (the asr folder first, then beside the song). */
function candidates(songPath, transcriptsDir) {
  const stem = path.basename(String(songPath || "")).replace(/\.[^.]+$/, "");
  const safe = stem.replace(/[^A-Za-z0-9._ -]+/g, "_");   // lib/asr's own naming
  const dirs = [transcriptsDir, path.dirname(String(songPath || ""))].filter(Boolean);
  const out = [];
  for (const d of dirs) for (const s of [...new Set([stem, safe])]) for (const ext of [".srt", ".lrc"]) out.push(path.join(d, s + ext));
  return out;
}

/** -> {segs, file} | null */
function load(songPath, transcriptsDir) {
  if (!songPath) return null;
  for (const f of candidates(songPath, transcriptsDir)) {
    let txt = null;
    try { txt = fs.readFileSync(f, "utf8"); } catch { continue; }
    const segs = /\.srt$/i.test(f) ? parseSrt(txt) : parseLrc(txt);
    if (segs.length) return { segs, file: f };
  }
  return null;
}

/** The words sung inside [start, start+dur] - a line counts when at least half of it (or 1 s) is inside. */
function words(segs, start, dur) {
  const a = Math.max(0, +start || 0), b = a + Math.max(0, +dur || 0);
  const hit = (segs || []).filter((s) => {
    const ov = Math.min(b, s.end) - Math.max(a, s.start);
    return ov > 0 && (ov >= Math.min(1, (s.end - s.start) / 2));
  });
  return hit.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

/** {known, words, file} for one scene's song window. */
function forWindow(songPath, win, transcriptsDir) {
  const t = load(songPath, transcriptsDir);
  if (!t || !win || !(Number.isFinite(+win.dur) && +win.dur > 0)) return { known: false, words: "", file: t ? t.file : "" };
  return { known: true, words: words(t.segs, win.start, win.dur), file: t.file };
}

/** The writer's block: what is sung in each scene's window ("" when the song has no timed transcript). */
function boardNote(windows, songPath, transcriptsDir) {
  const t = load(songPath, transcriptsDir);
  if (!t || !(windows || []).length) return "";
  const lines = windows.map((w) => {
    const ws = words(t.segs, w.start, w.dur);
    return `scene ${w.n} (${(+w.start).toFixed(1)}-${(+w.start + +w.dur).toFixed(1)} s): `
      + (ws ? `SUNG - "${ws.slice(0, 300)}"` : "instrumental - no words");
  });
  return "\n\nWHAT IS SUNG IN EACH SCENE (the song's timed transcript, " + path.basename(t.file) + "): a SUNG scene MUST use the "
    + "singing line (it lip-syncs these words); ONLY an instrumental scene may close the lips.\n" + lines.join("\n");
}

module.exports = { parseSrt, parseLrc, candidates, load, words, forWindow, boardNote };
