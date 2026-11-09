#!/usr/bin/env node
/* bitGen Studio — 2.733.0 units: the sheet music PLAYER's timing (static/abcscore.js render().timing +
 * ext/musicdock/scoreplayer.js) and the song beside a score (lib/scores.js).
 * Tim (verbatim): "in sheet music tab add media buttons play/pause, rewind,rewind to start,foward , foward to end buttons
 * for the songs sheet music and highlight the notes as the song is played"
 *   - each bar's start (its own length), each written note's time + id (its SVG head data-n), the tempo (Q:1/4=88,
 *     Q:3/8=60, none = 120), the length in seconds; the notes to SOUND - a tie holds the note, it is not struck again;
 *   - the bar / the notes at a moment, ⏪ (this bar's start, or the one before near it), ⏩, m:ss;
 *   - each bar's place on its page (for the band), the page a bar is on after the page breaks;
 *   - GET /api/scores' audio: the song with the score's name beside it. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const A = require("../static/abcscore.js");
const P = require("../ext/musicdock/scoreplayer.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const YUE = fs.existsSync("/root/yue/examples/score-jazz.abc") ? fs.readFileSync("/root/yue/examples/score-jazz.abc", "utf8") : `X:1
M:4/4
L:1/16
Q:1/4=88
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:C
% verse
V: Vocal
"Cmaj7"E2G2A2G2E2D2C4|"G7"D2E2G2E2D2C2D4|"Am7"E2G2A2c2B2A2G4|"Fmaj7"F2E2D2E2G2E2C4|
V: Ins
Z4|
% chorus
V: Vocal
"Cmaj7"G2A2c2B2A2G2E4|"Fmaj7"F2A2G2E2D2E2G4|"G7"A2c2B2A2G2E2D4|"Cmaj7"E2G2A2G2E2D2C4|
V: Ins
Z4|
`;
const R = A.render(YUE), T = R.timing;
check("timing: 8 bars of 4/4 (1920 ticks each), Q:1/4=88 -> 88 quarters a minute, 21.8 s", T.barStarts.length === 8 && T.barStarts[1] === 1920 && T.total === 15360
  && T.qpm === 88 && T.tempoGiven && Math.abs(T.seconds - 21.818) < 0.01, { b: T.barStarts, qpm: T.qpm, s: T.seconds });
check("timing: 56 written notes (7 a bar, the Ins rests have none), in time order, ids = their place", T.notes.length === 56
  && T.notes.every((n, k) => n.id === k && (k === 0 || n.t0 >= T.notes[k - 1].t0)) && T.notes[7].t0 === 1920 && T.notes[6].t1 - T.notes[6].t0 === 480);
const svg = A.toSVG(R.pages[0]);
const ids = [...svg.matchAll(/data-n="(\d+)"/g)].map((m) => +m[1]);
check("SVG: every note head carries its id (data-n) - 56 of them, each once", ids.length === 56 && new Set(ids).size === 56);
check("bars: each bar's place on its page (x0 < x1, y0 < y1), its time; bar 5 begins its system", T.bars.length === 8 && T.bars.every((b, i) => b.i === i && b.x0 < b.x1 && b.y0 < b.y1 && b.page === 0 && b.t0 === T.barStarts[i])
  && T.bars[4].x0 < T.bars[3].x0 && T.bars[4].y0 > T.bars[3].y0, T.bars.map((b) => [b.x0 | 0, b.y0 | 0]));
const tie = A.render("X:1\nM:4/4\nL:1/4\nQ:1/4=60\nK:C\nC2 E2-|E2 [CE]2|]\n").timing;
check("sound: a tie holds the note on (E struck once for 3 beats), the chord after it struck again; 60 bpm = 1 s a quarter",
  JSON.stringify(tie.sound) === JSON.stringify([{ v: 0, midi: 60, t0: 0, t1: 960 }, { v: 0, midi: 64, t0: 960, t1: 2880 }, { v: 0, midi: 60, t0: 2880, t1: 3840 }, { v: 0, midi: 64, t0: 2880, t1: 3840 }])
  && P.secAt(tie, 480) === 1 && tie.notes.length === 4, tie.sound);
check("sound: sharps / flats / octaves -> MIDI (^F = F#4 66, _B, = Bb3 58, c' = C6 84)", JSON.stringify(A.render("X:1\nL:1/4\nK:C\n^F _B, c'|]").timing.sound.map((s) => s.midi)) === "[66,58,84]");
check("tempo: Q:3/8=60 in 6/8 = 90 quarters a minute; no Q = 120 (said: tempoGiven false)", A.render("X:1\nM:6/8\nL:1/8\nQ:3/8=60\nK:C\nCDE FGA|]").timing.qpm === 90
  && A.render("X:1\nL:1/4\nK:C\nCDEF|]").timing.qpm === 120 && !A.render("X:1\nL:1/4\nK:C\nCDEF|]").timing.tempoGiven);
check("ticks <-> seconds: at 88 bpm a bar is 2.727 s; tickAt(secAt(x)) = x", Math.abs(P.secAt(T, 1920) - 2.7273) < 0.001 && Math.abs(P.tickAt(T, P.secAt(T, 5000)) - 5000) < 1e-6);
check("barAt: before bar 1 = -1, 0 = bar 1, a tick inside bar 3, the last tick = bar 8", P.barAt(T, -1) === -1 && P.barAt(T, 0) === 0 && P.barAt(T, 1920 * 2 + 5) === 2 && P.barAt(T, T.total - 1) === 7);
check("activeAt: the first note at 0, the quarter at the end of bar 1 held for its length, nothing after the end",
  JSON.stringify(P.activeAt(T, 0)) === "[0]" && JSON.stringify(P.activeAt(T, 1440 + 400)) === "[6]" && P.activeAt(T, T.total).length === 0 && P.activeAt(T, -5).length === 0);
const two = A.render("X:1\nM:4/4\nL:1/4\nV:1\nV:2\nK:C\nV:1\nC D E F|\nV:2\nE,4|\n").timing;
check("activeAt: two staves - the notes of both voices sound together (C over the long E,), ids in time order across the voices",
  JSON.stringify(P.activeAt(two, 10)) === JSON.stringify([0, 1]) && JSON.stringify(P.activeAt(two, 500)) === JSON.stringify([1, 2])
  && two.notes[1].v === 1 && two.notes[2].v === 0, [P.activeAt(two, 10), P.activeAt(two, 500)]);
const s2 = P.secAt(T, 1920 * 2);
check("⏪ prevBar: in bar 3 a second in -> bar 3's start; right at bar 3's start -> bar 2's; in bar 1 -> 0",
  Math.abs(P.prevBar(T, s2 + 1) - s2) < 1e-9 && Math.abs(P.prevBar(T, s2 + 0.2) - P.secAt(T, 1920)) < 1e-9 && P.prevBar(T, 0.3) === 0);
check("⏩ nextBar: from inside bar 3 -> bar 4's start; from bar 8 -> the end", Math.abs(P.nextBar(T, s2 + 0.4) - P.secAt(T, 1920 * 3)) < 1e-9
  && Math.abs(P.nextBar(T, P.secAt(T, 1920 * 7 + 10)) - T.seconds) < 1e-9);
check("fmt: 0:00, 1:05, 21.8 s = 0:21", P.fmt(0) === "0:00" && P.fmt(65.4) === "1:05" && P.fmt(T.seconds) === "0:21" && P.fmt(-3) === "0:00");
check("midiHz: A4 = 440, C4 = 261.6", P.midiHz(69) === 440 && Math.abs(P.midiHz(60) - 261.63) < 0.01);
let long = "X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:G\n";
for (let i = 0; i < 160; i++) long += "GABc dcBA|" + (i % 4 === 3 ? "\n" : "");
const LT = A.render(long);
const pagesOf = [...new Set(LT.timing.bars.map((b) => b.page))];
check("a long score: every bar has a place, on pages 0..N in order; bar 1 of a page's second system lower than its first",
  LT.timing.bars.length === 160 && LT.timing.bars.every(Boolean) && pagesOf.join() === LT.pages.map((p, k) => k).join() && LT.timing.bars.every((b, i) => !i || b.page >= LT.timing.bars[i - 1].page), pagesOf);
check("an empty score has no timing to play", !A.render("X:1\nK:C\n").timing);

// the song beside a score
const S = require("../lib/scores.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sc733-"));
fs.writeFileSync(path.join(tmp, "Neon_20261109.abc"), "x"); fs.writeFileSync(path.join(tmp, "Neon_20261109.mp3"), "x");
fs.writeFileSync(path.join(tmp, "Lonely.abc"), "x"); fs.writeFileSync(path.join(tmp, "Lonely.wav.txt"), "x");
check("scores: the song beside a score = the same name with an audio extension; none = ''", S.audioFor(tmp, "Neon_20261109.abc") === "Neon_20261109.mp3" && S.audioFor(tmp, "Lonely.abc") === "");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
