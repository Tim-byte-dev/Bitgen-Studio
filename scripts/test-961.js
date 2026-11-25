#!/usr/bin/env node
// bitGen Studio 2.961.0 - 🎹 the tempo track: tempo changes over the song (a step, or a ramp to the next); the beat grid, ⌗ snap,
// 🕒 click, the loop's default bars and bar.beat follow it. Tim: "continue please". Browser test: scripts/test-ui961-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../ext/synthdock/synthtlcore.js");
const J = (x) => JSON.stringify(x), near = (a, b) => Math.abs(a - b) < 1e-6;

const m = T.cleanTempo([{ t: 4, bpm: 60 }, { t: 2, bpm: 120, ramp: true }, { t: 6, bpm: 999, ramp: true }, null, { t: "x", bpm: 1 }, { t: 2, bpm: 120, ramp: true }]);
check("cleanTempo: sorted, the first at 0 (the first tempo), 20-300 BPM, one a time, the last never ramps, junk dropped",
  J(m) === J([{ t: 0, bpm: 120, ramp: false }, { t: 2, bpm: 120, ramp: true }, { t: 4, bpm: 60, ramp: false }, { t: 6, bpm: 300, ramp: false }]) && J(T.cleanTempo(null)) === "[]", m);
check("a new timeline: no tempo track (the looper's BPM); cleanTL keeps it, on only with a tempo",
  T.newTL().tempoOn === false && J(T.newTL().tempo) === "[]" && (() => { const j = T.cleanTL({ layers: [{}], tempoOn: true, tempo: [{ t: 0, bpm: 90 }] }); const k = T.cleanTL({ layers: [{}], tempoOn: true }); return j.tempoOn && j.tempo[0].bpm === 90 && !k.tempoOn; })());
check("beatAt: steps add beats at their tempo, a ramp at its average (120 -> 60 over 2 s = 3 beats)",
  near(T.beatAt(m, 2), 4) && near(T.beatAt(m, 4), 7) && near(T.beatAt(m, 5), 8) && near(T.beatAt(m, 7), 14) && near(T.beatAt(m, 0), 0));
check("bpmAt: the tempo there (mid-ramp = between)", T.bpmAt(m, 1) === 120 && T.bpmAt(m, 3) === 90 && T.bpmAt(m, 4.5) === 60 && T.bpmAt(m, 9) === 300 && T.bpmAt([], 1) === 120);
check("timeAt undoes beatAt - in a step, a ramp, after the last", [0, 1, 4, 5.5, 6.25, 7, 8, 13.5].every((b) => near(T.beatAt(m, T.timeAt(m, b)), b)) && near(T.timeAt(m, 4), 2) && near(T.timeAt(m, 14), 7));
const c = T.beatTimes([{ t: 0, bpm: 120 }, { t: 2, bpm: 60 }], 0, 4.01, 4);
check("beatTimes: the click follows the changes, the first of each bar accented", c.map((x) => x.t + (x.accent ? "A" : "")).join() === "0A,0.5,1,1.5,2A,3,4", c);
check("…a ramp's beats come closer (accelerando)", (() => { const r = T.beatTimes([{ t: 0, bpm: 60, ramp: true }, { t: 4, bpm: 180 }], 0, 4, 4).map((x) => x.t); const g = r.slice(1).map((t, i) => t - r[i]); return g.every((d, i) => i === 0 || d < g[i - 1]); })());
check("snapBeat: 16ths of the tempo there; off = free", near(T.snapBeat([{ t: 0, bpm: 60 }], 1.13, true, 4), 1.25) && near(T.snapBeat([{ t: 0, bpm: 120 }], 1.13, true, 4), 1.125) && T.snapBeat([{ t: 0, bpm: 60 }], 1.13, false) === 1.13);
check("barBeat: bar.beat (4/4)", J(T.barBeat([{ t: 0, bpm: 120 }], 2.6)) === J({ bar: 2, beat: 2 }) && J(T.barBeat(m, 9)) === J({ bar: 7, beat: 1 }) && J(T.barBeat([{ t: 0, bpm: 120 }], 0)) === J({ bar: 1, beat: 1 }));
const TJ = src("ext/synthdock/synthtl.js"), DH = src("ext/synthdock/dock.html");
check("the timeline follows the map: the grid, ⌗ snap (every drag), 🕒 click, the loop's 2 bars, the roll's grid, the readout",
  /function tmap\(\)/.test(TJ) && /T\.beatAt\(tm, t0\)/.test(TJ) && !/T\.snap\(/.test(TJ) && /function snapT\(t, on\) \{ return T\.snapBeat\(tmap\(\), t, on, 4\); \}/.test(TJ)
  && /T\.beatTimes\(tmap\(\), from, until, 4\)/.test(TJ) && /T\.timeAt\(tm3, b0 \+ 8\)/.test(TJ) && /bpm: T\.bpmAt\(tmap\(\), c\.start\)/.test(TJ) && /T\.barBeat\(tmap\(\), S\.ph\)/.test(TJ));
check("♩ Tempo: the strip under the ruler (RULER grows), double-click = a change, drag up / down = BPM, sideways = when, right-click / Delete = gone (not the first); its bar: BPM + Ramp",
  DH.includes('id="syTTempo"') && /RULER = R0 \+ \(TLD\.tempoOn \? TS : 0\)/.test(TJ) && /kind: "tpt"/.test(TJ) && /function delTempo\(i\)/.test(TJ) && /The first tempo stays/.test(TJ) && /"syTBpm"/.test(TJ) && /"syTRamp"/.test(TJ) && /\.sytltempo \{/.test(DH));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
