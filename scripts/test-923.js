#!/usr/bin/env node
// bitGen Studio 2.923.0 - the 🎶 Song tab transcribes a song with no lyrics, with a progress bar.
// Tim: "can we add a transcribe and put the lyrics in the song tab if no lyrics are found. let user know that it is
// transcribing with a progress bar"
// Units: lib/songLyrics.js (the lyrics from Whisper's segments, the job and its stages through the suite's stand-in),
// lib/stems.js / lib/asr.js (a file of its own, the progress lines, the segments), the routes, the dock's bar and button,
// and the phone page's voice fix. The browser run: test-ui923-ui.js. Run: node scripts/test-923.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 600)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const L = require("../lib/songLyrics");
  const ly = L.toLyrics([{ start: 0, end: 3, text: " Neon lights on the  street" }, { start: 3.2, end: 6, text: "we run all night ♪" }, { start: 6.1, end: 9, text: "[Music]" },
    { start: 12, end: 15, text: "Here comes the chorus" }, { start: 15.2, end: 16, text: "Thank you for watching!" }, { start: 16, end: 17, text: "♪" }], "");
  check("Whisper's segments -> the lyrics: a line each, a blank line at a pause of 2.5 s+ (a verse), ♪ / [Music] / 'thank you for watching' left out",
    ly === "Neon lights on the street\nwe run all night\n\nHere comes the chorus", ly);
  check("no segments: the text, a sentence a line; nothing heard = empty", L.toLyrics([], "Hello there. How are you? Fine") === "Hello there.\nHow are you?\nFine" && L.toLyrics([{ start: 0, end: 1, text: "[Music]" }], "") === "");

  process.env.H3_E2E = "1";
  const tmp = path.join(os.tmpdir(), "bg923-" + process.pid + ".mp3"); fs.writeFileSync(tmp, "x");
  const j0 = L.start({ file: tmp, name: "Neon.mp3", keep: false, test: [{ start: 0, end: 2, text: "first line" }, { start: 5, end: 7, text: "second verse" }] });
  check("start(): a job id at once, queued / its file named", /^[0-9a-f]{12}$/.test(j0.id) && j0.file === "Neon.mp3" && j0.pct === 0, j0);
  const seen = new Set(), pcts = [];
  for (let i = 0; i < 40; i++) { const s = L.get(j0.id); seen.add(s.stage); pcts.push(s.pct); if (s.stage === "done" || s.stage === "error") break; await sleep(150); }
  const end = L.get(j0.id);
  check("the job goes load -> transcribe -> done, its bar only climbing to 100", seen.has("load") && seen.has("transcribe") && end.stage === "done" && end.pct === 100
    && pcts.every((p, i) => i === 0 || p == null || pcts[i - 1] == null || p >= pcts[i - 1]), { seen: [...seen], pcts });
  check("...the words as lyrics (the verse break kept), the mix said, the upload deleted (keep: false)", end.lyrics === "first line\n\nsecond verse" && end.mix === true && end.finished && !fs.existsSync(tmp), end);
  const j1 = L.start({ file: tmp, name: "x.mp3", keep: true, test: [{ start: 0, end: 1, text: "[Music]" }] });
  let e1; for (let i = 0; i < 40; i++) { e1 = L.get(j1.id); if (e1.stage === "done" || e1.stage === "error") break; await sleep(150); }
  check("nothing sung -> an error that says so (never empty lyrics)", e1.stage === "error" && /no words were heard/.test(e1.error), e1);
  check("an unknown job -> null", L.get("nope") === null);
  delete process.env.H3_E2E;

  const sl = src("lib/songLyrics.js");
  check("the real path: Speech to Text checked first (need: whisper), Song Separation first when installed (into a temp folder, removed after), its tqdm % = 0-40 of the bar, Whisper's '[asr] t/total s' = the rest",
    /j\.need = "whisper"/.test(sl) && /stems\.runtime\(\)\.installed/.test(sl) && /stems\.separate\("", \{ file: src, out_dir: tmp, stem: "song"/.test(sl) && /fs\.rm\(tmp, \{ recursive: true/.test(sl)
    && /\(\\d\{1,3\}\)%\\\|/.test(sl) && /\\\[asr\\\] \(\[\\d\.\]\+\)\\\/\(\[\\d\.\]\+\)s/.test(sl) && /const split = sep \? 40 : 0/.test(sl));
  check("the stand-in runs only under H3_E2E", /process\.env\.H3_E2E === "1" && Array\.isArray\(o\.test\)/.test(sl));
  const st = src("lib/stems.js"), as = src("lib/asr.js");
  check("lib/stems.separate: a file of its own + an output folder + a stem name (the Sound assets untouched)", /const src = o\.file && fs\.existsSync\(o\.file\) \? o\.file : findAsset\(name\)/.test(st) && /const outDir = o\.out_dir \|\| core\.pDir\("sound"\)/.test(st) && /const stem = o\.stem \|\|/.test(st));
  check("lib/asr.transcribeFile: the progress lines (onLog, on a pod too) and the segments back", /async function transcribeFile\(file, o\)/.test(as) && (as.match(/onLog: o\.onLog/g) || []).length >= 4 && /return \{ text, language: j\.language \|\| null, segments \};/.test(as));
  check("the phone page's voice read '[object Object]' (transcribeFile answers an object) - fixed", /String\(\(\(await asr\.transcribeFile\(f\.path\)\) \|\| \{\}\)\.text \|\| ""\)/.test(src("routes/remote.js")));

  const rt = src("routes/songTags.js");
  check("POST /api/song-tags/transcribe: an upload (renamed with its extension, deleted after) or a project song (src + name, the project's folders only); GET /:id follows it",
    /app\.post\("\/api\/song-tags\/transcribe", up\.single\("audio"\)/.test(rt) && /fs\.renameSync\(f\.path, file\); keep = false/.test(rt) && /mm\.resolve\(s, name\)/.test(rt)
    && /app\.get\("\/api\/song-tags\/transcribe\/:id"/.test(rt) && /process\.env\.H3_E2E === "1" && b\.test_segments/.test(rt));
  check("server.js untouched", !/songLyrics|song-tags/.test(src("misc/server.js")));

  const html = src("ext/musicdock/dock.html"), sf = src("ext/musicdock/songfile.js");
  check("the Song tab: 🎤 Transcribe (off until a song is loaded) and the progress box (text, %, bar, ⤵ Use the heard words, ✕) above the lyrics",
    /id="muTranscribe" disabled[^>]*>🎤 Transcribe<\/button>/.test(html) && /id="muTrBox" class="hidden" role="status" aria-live="polite"/.test(html) && /id="muTrPct"/.test(html) && /id="muTrFill"/.test(html)
    && /id="muTrUse"/.test(html) && /id="muTrX"/.test(html) && html.indexOf('id="muTrBox"') < html.indexOf('id="muLyrics"'));
  check("...the bar: striped while it cannot be measured, the stage named, its %, green when done, red when it stops", /#muTrBox\.busy #muTrFill \{ background-image: linear-gradient/.test(html) && /#muTrBox\.ok #muTrFill/.test(html) && /#muTrBox\.bad/.test(html)
    && /var STAGE = \{ queued: "starting", separate: "taking the voice out of the music", load: "loading the speech model", transcribe: "hearing the words" \}/.test(sf));
  check("no lyrics in the tags (or no details at all) -> transcribed by itself", /if \(!s\.lyrics\) transcribe\(s\.title \|\| label, false\)/.test(sf) && /transcribing its words"\);\n\s+transcribe\(label, false\);/.test(sf));
  check("Speech to Text not installed -> the ⬇ Download / Cancel box first (static/needinstall.js)", /window\.H3NeedInstall\.ensure\("whisper"/.test(sf));
  check("the heard words go only into an EMPTY Lyrics box by themselves (yours or the last song's are kept - ⤵ puts them in); 🎤 pressed twice = over them",
    /var lyEl = \$\("muLyrics"\), empty = lyEl && !before\.trim\(\) && !lyEl\.value\.trim\(\);/.test(sf) && /if \(lyEl && \(replace \|\| empty\)\)/.test(sf) && /press 🎤 Transcribe again to replace them/.test(sf));
  check("🎤 hears the song loaded last (the file again, or the project song by name); a newer transcription takes over the bar", /last = \{ file: f, name: f\.name \}/.test(sf) && /last = \{ src: src, name: name \}/.test(sf) && /var me = \+\+watch/.test(sf));

  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL:", e && e.stack || e); process.exit(1); });
