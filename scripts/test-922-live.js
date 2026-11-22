#!/usr/bin/env node
// bitGen Studio 2.922.0 - real song files: scripts/song_tags.py writes the details into flac / mp3 / wav with ffmpeg and
// lib/songTags.js reads them back (ffprobe). Needs python3 + ffmpeg (the e2e suite; CI's unit run skips it - child_process).
// Run: node scripts/test-922-live.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 700)); } };
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.log("SKIP: no ffmpeg here"); process.exit(0); }
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg922-"));
const SCR = path.join(__dirname);
const py = (code) => execFileSync("python3", ["-c", "import sys, json; sys.path.insert(0, " + JSON.stringify(SCR) + "); import song_tags as S\n" + code], { encoding: "utf8" });
const ff = (...a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "ignore" });
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", f], { encoding: "utf8" })).format.tags || {};
const ST = require("../lib/songTags");

const graph = { 3: { class_type: "KSampler", inputs: { seed: 5, model: ["1", 0] } }, 14: { class_type: "TextEncodeAceStepAudio1.5", inputs: { tags: "old caption", lyrics: "[verse]\nold words", bpm: 100 } } };
const params = { title: "Neon Nights", prompt: "[verse]\nneon lights\n[chorus]\nall night", style_id: "st_gone", style_name: "ACE-Step Turbo", max_duration: 90, audio_format: "mp3" };
const style = { caption: "synthpop, 120 bpm", bpm: 120, keyscale: "A minor" };
const J = (o) => "json.loads(" + JSON.stringify(JSON.stringify(o)) + ")";
const d = JSON.parse(py("print(json.dumps(S.details(" + J(params) + ", " + J(style) + ", 42, 0, '.mp3')))"));
check("details(): title, lyrics, the style's caption / bpm / key, length, seed, format, when, by", d.title === "Neon Nights" && d.lyrics === params.prompt && d.caption === style.caption && d.bpm === 120 && d.keyscale === "A minor"
  && d.dur === 90 && d.seed === 42 && d.format === "mp3" && /^\d{4}-\d\d-\d\dT/.test(d.made_at) && d.made_by === "bitGen Studio" && !("index" in d), d);

for (const ext of ["flac", "mp3", "wav"]) {
  const f = path.join(T, "Neon-Nights_20261123-101010_s42_ab12cd." + ext);
  const enc = ext === "mp3" ? ["-c:a", "libmp3lame", "-q:a", "5"] : ext === "wav" ? ["-c:a", "pcm_s16le"] : ["-c:a", "flac"];
  ff("-f", "lavfi", "-i", "sine=d=3", ...enc, "-metadata", "prompt=" + JSON.stringify(graph), f);
  const before = fs.statSync(f).size;
  const ok = py("print(S.tag(" + JSON.stringify(f) + ", " + J(Object.assign({}, d, { format: ext })) + "))").trim();
  const tags = Object.fromEntries(Object.entries(probe(f)).map(([k, v]) => [k.toLowerCase(), v]));
  const r = ST.read(f);
  check(ext + ": tagged in place (no .tagging file left), the audio kept (about the same size)", ok === "True" && !fs.readdirSync(T).some((x) => /\.tagging\./.test(x)) && Math.abs(fs.statSync(f).size - before) < 4096 + 2 * JSON.stringify(d).length, { ok, before, after: fs.statSync(f).size });
  check(ext + ": a music player sees the title" + (ext === "wav" ? " (and the comment)" : " and the lyrics"), tags.title === "Neon Nights" && (ext === "wav" ? /^Made with bitGen Studio - ACE-Step Turbo, seed 42/.test(tags.comment) : tags.lyrics === params.prompt), tags);
  check(ext + ": the Song tab reads it all back from bitGen's tag (title, lyrics, caption, length, seed, format)", r.from.lyrics === "bitgen" && r.song.title === "Neon Nights" && r.song.lyrics === params.prompt
    && r.song.caption === style.caption && r.song.dur === 90 && r.song.seed === 42 && r.song.format === ext && r.song.bpm === 120 && r.style_found === false && r.song.style_id === "st_gone", r);
  if (ext !== "wav") check(ext + ": ComfyUI's own graph tag is kept beside bitGen's", !!tags.prompt && JSON.parse(tags.prompt)[14].inputs.lyrics === "[verse]\nold words");
}

// an older bitGen song: only ComfyUI's graph
const old = path.join(T, "Paper-Moon_20261001-090909_s5_cd34ef.mp3");
ff("-f", "lavfi", "-i", "sine=d=2", "-c:a", "libmp3lame", "-q:a", "5", "-metadata", "prompt=" + JSON.stringify(graph), old);
const ro = ST.read(old);
check("an older bitGen song (only ComfyUI's graph tag): the lyrics, caption, bpm and seed from the graph, the title from its filename, its length",
  ro.song.lyrics === "[verse]\nold words" && ro.from.lyrics === "graph" && ro.song.caption === "old caption" && ro.song.bpm === 100 && ro.song.seed === 5 && ro.song.title === "Paper Moon" && ro.from.title === "name" && ro.song.dur === 2 && ro.from.dur === "file", ro);
// a song from anywhere else: a player's tags
const other = path.join(T, "track01.mp3");
ff("-f", "lavfi", "-i", "sine=d=2", "-c:a", "libmp3lame", "-q:a", "5", "-metadata", "title=Someone Else", "-metadata", "lyrics=la la la", "-metadata", "genre=Folk", other);
const rt = ST.read(other);
check("a song made elsewhere: the player's title + lyrics, its genre noted, bitgen = false", rt.song.title === "Someone Else" && rt.song.lyrics === "la la la" && rt.genre === "Folk" && rt.bitgen === false, rt);
// a file that is not a song: tag() leaves it alone
const bad = path.join(T, "broken.flac"); fs.writeFileSync(bad, "not audio at all");
const res = py("print(S.tag(" + JSON.stringify(bad) + ", {'title': 'x'}))").trim();
check("a broken file: not tagged, left exactly as it was", res === "False" && fs.readFileSync(bad, "utf8") === "not audio at all" && !fs.existsSync(path.join(T, "broken.tagging.flac")), res);
fs.rmSync(T, { recursive: true, force: true });
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
