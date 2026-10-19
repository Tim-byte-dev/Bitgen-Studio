#!/usr/bin/env node
/* bitGen Studio — 2.356.0: the words sung in each scene decide lip sync.
 * Run: node scripts/test-scenelyrics.js
 * Tim: "the llm is writing [Shot 1] @apartment ... @jesse_paul's lips remain fully closed for every frame ...
 * for the video no words for lip sync, so my vid doesn't have lip sync".
 *   1. lib/sceneLyrics: the song's timed transcript (.srt / .lrc in projects/<p>/transcripts or beside the
 *      song), the words inside a window, the writer's per-scene block;
 *   2. lib/mvWriter.cleanPrompt with the window's lyrics: Tim's exact scene -> singing + the sung words; an
 *      instrumental window -> closed lips; no transcript -> kept, but said (renders without lip sync);
 *   3. the writer's rule (never decide instrumental on its own) + the wiring in routes/characters.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const SL = require(path.join(ROOT, "lib", "sceneLyrics"));
const M = require(path.join(ROOT, "lib", "mvWriter"));

// ---- 1. the transcript
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lyr_"));
const tdir = path.join(tmp, "transcripts"), sdir = path.join(tmp, "sound");
fs.mkdirSync(tdir); fs.mkdirSync(sdir);
fs.writeFileSync(path.join(sdir, "Paper Moon.mp3"), "x");
fs.writeFileSync(path.join(tdir, "Paper Moon.srt"), "1\n00:00:16,000 --> 00:00:20,500\nI carved your name in the paper moon\n\n"
  + "2\n00:00:21,000 --> 00:00:28,000\nand it burned before the sun came up\n\n3\n00:00:46,000 --> 00:00:50,000\nstay\n");
const song = path.join(sdir, "Paper Moon.mp3");
const t = SL.load(song, tdir);
check("load: the song's .srt from the project's transcripts folder", t && t.segs.length === 3 && t.segs[1].start === 21 && /Paper Moon\.srt$/.test(t.file), t);
const lrc = SL.parseLrc("[ti:x]\n[00:16.00]I carved your name\n[00:21.00][01:10.50]and it burned\n");
check("an .lrc too (a line runs to the next one; repeated stamps)", lrc.length === 3 && lrc[0].end === 21 && lrc[2].start === 70.5, lrc);
check("words: the lines inside the window (a line half outside still counts when half of it is in)",
  SL.words(t.segs, 15, 15) === "I carved your name in the paper moon and it burned before the sun came up"
  && SL.words(t.segs, 0, 15) === "" && SL.words(t.segs, 30, 15) === "" && SL.words(t.segs, 45, 15) === "stay");
check("forWindow: known + the words; a window without a length is NOT taken as instrumental; no transcript -> unknown",
  SL.forWindow(song, { start: 15, dur: 15 }, tdir).known === true && SL.forWindow(song, { start: 0, dur: 15 }, tdir).words === ""
  && SL.forWindow(song, { start: 0, dur: null }, tdir).known === false && SL.forWindow(path.join(sdir, "other.mp3"), { start: 0, dur: 15 }, tdir).known === false);
const note = SL.boardNote([{ n: 1, start: 0, dur: 15 }, { n: 2, start: 15, dur: 15 }], song, tdir);
check("the writer's block: each scene SUNG with its words, or instrumental; the rule (a sung scene MUST sing)",
  /WHAT IS SUNG IN EACH SCENE/.test(note) && /scene 1 \(0\.0-15\.0 s\): instrumental - no words/.test(note)
  && /scene 2 \(15\.0-30\.0 s\): SUNG - "I carved your name/.test(note) && /ONLY an instrumental scene may close the lips/.test(note)
  && SL.boardNote([{ n: 1, start: 0, dur: 15 }], path.join(sdir, "other.mp3"), tdir) === "", note);

// ---- 2. the render-time decision
const tims = ["[Shot 1] @apartment, warm candlelight, late evening atmosphere with soft shadows.", "",
  "@jesse_paul sits on a wooden stool, cradling @picture_1, an acoustic guitar. He gently fingerpicks the strings as the camera performs a slow, intimate push-in.", "",
  "@jesse_paul's lips remain fully closed for everys frame.", "",
  "Maintain the gray tshirt, blue jeans, and the warm @apartment lighting.", "",
  "No other people, no costume change, no on-screen text, no cuts."].join("\n");
let c = M.cleanPrompt(tims, "song", ["jesse_paul"], SL.forWindow(song, { start: 15, dur: 15 }, tdir));
check("Tim's scene on a SUNG stretch: the closed-lips line becomes the singing line, the sung words follow it, said",
  !/lips remain fully closed/.test(c.text) && c.text.includes("@jesse_paul " + M.SING)
  && c.text.includes('The words sung in this clip: "I carved your name in the paper moon and it burned before the sun came up" (heard in the song only')
  // 2.377.1: the words are for the lips - the line says they are never shown (a model can paint quoted words as subtitles)
  && /never shown on screen: no subtitles, no captions, no lyrics text, no text bar at the bottom of the picture\)\./.test(c.text)
  && c.changes.includes("closed lips -> singing (this stretch of the song has words)") && c.changes.includes("the sung words added for the lip sync"), c);
check("...cleaned twice: still ONE words line", (M.cleanPrompt(c.text, "song", ["jesse_paul"], SL.forWindow(song, { start: 15, dur: 15 }, tdir)).text
  .match(/The words sung in this clip:/g) || []).length === 1);
c = M.cleanPrompt("@vera walks.\n\n@vera " + M.SING, "song", ["vera"], SL.forWindow(song, { start: 0, dur: 15 }, tdir));
check("an INSTRUMENTAL stretch: a singing line becomes the closed-lips line", c.text.includes("@vera's " + M.CLOSED) && !M.SING_RE.test(c.text)
  && c.changes.includes("singing -> closed lips (no words in this stretch of the song)"), c);
c = M.cleanPrompt(tims, "song", ["jesse_paul"], SL.forWindow(path.join(sdir, "other.mp3"), { start: 0, dur: 15 }, tdir));
check("no transcript: the closed lips stay, and the note says it renders WITHOUT lip sync and how to fix it",
  /lips remain fully closed/.test(c.text) && c.changes.some((x) => /renders WITHOUT lip sync/.test(x) && /transcribe its lyrics/.test(x)), c.changes);
check("closed-lips wording variants are recognised (stay shut / are sealed)", M.CLOSED_RE.test("her lips stay shut") && M.CLOSED_RE.test("lips are firmly sealed"));

// ---- 3. the writer's rule + the wiring
const g = M.guide([{ name: "Jesse", tag: "jesse_paul" }], [], [], "song");
check("the writer: EVERY scene sings; closed lips ONLY when the per-scene lyrics say instrumental or the brief says so; a guitar is not a reason",
  g.includes("EVERY SCENE SINGS.") && g.includes("WHAT IS") && g.includes("a guitar, a") && g.includes("renders with NO lip sync"));
const RC = fs.readFileSync(path.join(ROOT, "routes", "characters.js"), "utf8");
check("routes/characters: the render passes the window's lyrics to cleanPrompt; the writer gets WHAT IS SUNG IN EACH SCENE",
  RC.includes("const lyr = noSong ? null : sceneLyrics.forWindow(songPath, audioWin,")
  && RC.includes('cast.map((c) => chars.tagOf(c.tag || c.name)), lyr);')
  && RC.includes("return sceneLyrics.boardNote(wins, song, path.join(core.projDir(b.project || core.getProject()), \"transcripts\"));")
  && RC.includes("          + globalFirst\n          + lyricsNote\n"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
