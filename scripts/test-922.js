#!/usr/bin/env node
// bitGen Studio 2.922.0 - a song file into the Audio docker's 🎶 Song tab: its title, lyrics and details from its tags.
// Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
// name from the meta tags?"
// Units (pure, no ffmpeg): lib/songTags.js's readings, lib/mediaMeta.js's use of bitGen's tag, and the wiring (the worker
// tags every song, the route is mounted outside server.js, the dock's 🎵 From file + drop). Real files: test-922-live.js;
// the browser: test-ui922-ui.js. Run: node scripts/test-922.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 600)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../lib/songTags");

const blob = JSON.stringify({ v: 1, title: "Neon Nights", lyrics: "[verse]\nneon lights", caption: "synthwave", style_id: "st_1", style_name: "ACE", dur: 90, seed: 42, format: "mp3", bpm: 120, made_at: "2026-11-23T10:00:00", junk: "x" });
const b1 = T.bitgenOf({ BITGEN: blob, TITLE: "other" });
check("bitGen's own tag (any case) -> the song's details (unknown keys dropped)", b1 && b1.title === "Neon Nights" && b1.lyrics === "[verse]\nneon lights" && b1.seed === 42 && b1.bpm === 120 && b1.made_at && !("junk" in b1), b1);
const b2 = T.bitgenOf({ comment: "Made with bitGen Studio - ACE, seed 42\nbitgen:" + blob });
check("a WAV's comment after \"bitgen:\" (RIFF INFO keeps no custom tags) -> the same details", b2 && b2.title === "Neon Nights" && b2.dur === 90, b2);
check("no bitGen tag / a broken one -> nothing (never a guess)", T.bitgenOf({ title: "x" }) === null && T.bitgenOf({ bitgen: "{nope" }) === null);

const ace = { 3: { class_type: "KSampler", inputs: { seed: 99, model: ["1", 0], positive: ["14", 0] } },
  14: { class_type: "TextEncodeAceStepAudio1.5", inputs: { tags: "synthpop, female vocal", lyrics: "[verse]\nhey there", bpm: 120, keyscale: "C major", timesignature: "4", language: "en", duration: 60 } },
  17: { class_type: "EmptyAceStep1.5LatentAudio", inputs: { seconds: 60, batch_size: 1 } }, 9: { class_type: "SaveAudio", inputs: { filename_prefix: "audio/x" } } };
const g1 = T.fromGraph(JSON.stringify(ace));
check("an older bitGen song's ComfyUI graph tag (ACE-Step 1.5): lyrics, caption (its tags), bpm, key, time, language, length, seed",
  g1 && g1.lyrics === "[verse]\nhey there" && g1.caption === "synthpop, female vocal" && g1.bpm === 120 && g1.keyscale === "C major" && g1.timesig === "4" && g1.language === "en" && g1.dur === 60 && g1.seed === 99, g1);
const g2 = T.fromGraph({ 1: { class_type: "YuE2GenerateMusic", inputs: { lyrics: "[chorus]\nla la", style: "rock, male", seed: 7 } } });
check("YuE2: lyrics + style -> caption, its seed", g2 && g2.lyrics === "[chorus]\nla la" && g2.caption === "rock, male" && g2.seed === 7, g2);
const g3 = T.fromGraph({ 5: { class_type: "MiniMaxMusic3TextEncode", inputs: { lyrics: "[verse]\nx", caption: "Genre: synthwave", max_duration: 9 } }, 6: { class_type: "KSampler", inputs: { seed: ["8", 0] } },
  8: { class_type: "SeedNode", inputs: { seed: 55 } } });
const g4 = T.fromGraph({ 6: { class_type: "KSampler", inputs: { seed: ["9", 0], lyrics: "y" } }, 9: { class_type: "SomethingElse", inputs: { image: ["2", 0] } } });
check("MiniMax Music3 (bitGen's graph): lyrics, caption, max_duration; the seed through its SeedNode; a seed wired to no number = none",
  g3 && g3.caption === "Genre: synthwave" && g3.dur === 9 && g3.seed === 55 && g4.seed === undefined, [g3, g4]);
check("not a graph -> nothing", T.fromGraph("{bad") === null && T.fromGraph({ 1: { class_type: "SaveImage", inputs: { images: ["2", 0] } } }) === null);

const t1 = T.fromTags({ TITLE: "Paper Moon", LYRICS: "line one\r\nline two", GENRE: "Pop", TBPM: "98" });
check("a music player's tags: title, lyrics (CRLF -> LF), genre, bpm", t1 && t1.title === "Paper Moon" && t1.lyrics === "line one\nline two" && t1.genre === "Pop" && t1.bpm === 98, t1);
check("...UNSYNCEDLYRICS / lyrics-eng too", T.fromTags({ UNSYNCEDLYRICS: "a" }).lyrics === "a" && T.fromTags({ "lyrics-eng": "b" }).lyrics === "b");
const n1 = T.fromName("Neon-Nights_20261122-101010_s42_ab12cd.flac"), n2 = T.fromName("20261122-101010_s7_ab12cd_2.mp3"), n3 = T.fromName("My Song.mp3");
check("bitGen's filename: <Title>_<stamp>_s<seed>_<job> -> the title and the seed; another name -> nothing", n1.title === "Neon Nights" && n1.seed === 42 && n2.seed === 7 && !n2.title && n3 === null, [n1, n2, n3]);
check("FIELDS = the Song tab's + the style's music details", ["title", "lyrics", "caption", "style_id", "style_name", "dur", "seed", "format", "bpm", "keyscale", "timesig", "language"].every((k) => T.FIELDS.includes(k)));

const MM = require("../lib/mediaMeta");
const mm = MM.fromTags({ bitgen: blob, comment: "Made with bitGen Studio - ACE, seed 42", prompt: JSON.stringify(ace) });
check("mediaMeta (the Gallery's 'prompt from metadata'): a bitGen song's prompt = its lyrics + its seed, not the 'Made with' comment",
  mm && mm.prompt === "[verse]\nneon lights" && mm.seed === 42 && mm.from === "tags", mm);
const mm2 = MM.fromTags({ comment: "Made with bitGen Studio - ACE", prompt: JSON.stringify(ace) });
check("...an untagged comment never hides ComfyUI's graph", mm2 && mm2.seed === 99, mm2);

const py = src("scripts/song_tags.py"), wk = src("misc/music_worker.py");
check("scripts/song_tags.py: title / lyrics / comment / date + the bitgen JSON; WAV's JSON in its comment; the audio copied (-c copy), ComfyUI's tags kept (-map_metadata 0), any trouble leaves the song untouched",
  /tags\["lyrics"\] = d\["lyrics"\]/.test(py) && /tags\["bitgen"\] = blob/.test(py) && /if ext == "wav":[\s\S]{0,40}tags\["comment"\] = note \+ "\\nbitgen:" \+ blob/.test(py)
  && /"-map_metadata", "0"/.test(py) && /"-c", "copy"/.test(py) && /the song is untouched/.test(py) && /tmp\.replace\(p\)/.test(py));
check("the music worker tags every song it writes - ComfyUI's and YuE2's, after the mp3 / wav conversion",
  /import song_tags as _tags/.test(wk) && (wk.match(/_tags\.tag\(output_dir \/ name, _tags\.details\(/g) || []).length === 2
  && /to_format\(dest, params\.get\("audio_format"\), say\)\n\s+_tags\.tag/.test(wk) && /to_format\(dest, p\.get\("audio_format"\), say\)\n[\s\S]{0,300}_tags\.tag/.test(wk));
check("the stub ComfyUI writes the graph as a \"prompt\" tag, as ComfyUI's SaveAudio does", /"-metadata", "prompt=" \+ json\.dumps\(g\)/.test(src("scripts/stub-comfy.py")));

const rt = src("routes/songTags.js"), ix = src("routes/index.js");
check("POST /api/song-tags (an upload, deleted after) + GET ?src=&name= (the project's Gallery / Sound assets only)",
  /app\.post\("\/api\/song-tags", up\.single\("audio"\)/.test(rt) && /fs\.unlink\(f\.path/.test(rt) && /app\.get\("\/api\/song-tags"/.test(rt) && /mm\.resolve\(s, name\)/.test(rt));
check("mounted from routes/index.js - server.js untouched", /require\("\.\/songTags"\)\.mount\(app\)/.test(ix) && !/songTags|song-tags/.test(src("misc/server.js")));

const html = src("ext/musicdock/dock.html"), sf = src("ext/musicdock/songfile.js"), ext = JSON.parse(src("ext/musicdock/ext.json"));
check("the Song tab: 🎵 From file beside 📂 Load (a hidden song picker)", /id="muLoad"[\s\S]{0,700}id="muFromFile"[^>]*>🎵 From file<\/button>/.test(html) && /id="muFromFileIn" accept="[^"]*\.flac[^"]*" hidden/.test(html));
check("ext/musicdock/songfile.js is loaded after musicdock.js", ext.scripts.indexOf("songfile.js") === ext.scripts.indexOf("musicdock.js") + 1);
check("...a file from this computer -> POST; a drop from the Gallery (output) / Sound assets (sound) -> GET; a dropped file -> POST",
  /fetch\("\/api\/song-tags", \{ method: "POST", body: fd \}\)/.test(sf) && /fromProject\(p\.type === "asset" \? "sound" : "output", p\.name\)/.test(sf) && /if \(f\) \{ e\.preventDefault\(\); fromFile\(f\); return; \}/.test(sf));
check("...only the fields found fill in (the rest kept), nothing found = nothing changed, a missing style said",
  /var cur = M\(\)\.collect \? M\(\)\.collect\(\) : \{\}/.test(sf) && /nothing changed/.test(sf) && /is not in this install - pick one/.test(sf));
const md = src("ext/musicdock/musicdock.js");
check("muSongApply's 'the style is gone' line has a home again (muSongMsg was never defined); the Song tab's fill / read shared as window.H3MuSong",
  /function muSongMsg\(t\) \{/.test(md) && /window\.H3MuSong = \{ apply: muSongApply, collect: muSongCollect, tab: muTabSel, msg: muSongMsg \}/.test(md) && /M\(\)\.apply\(next\)/.test(sf));

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
