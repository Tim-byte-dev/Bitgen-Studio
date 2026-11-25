#!/usr/bin/env node
// bitGen Studio 2.962.0 - 🎹 the step sequencer: step clips on any layer (a row a sound, a cell a step, accents, swing), the
// pattern repeating over the clip on the tempo track's beats. Tim: "lets do the last cakewalk item". Browser: test-ui962-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../ext/synthdock/synthtlcore.js");
const J = (x) => JSON.stringify(x), M120 = [{ t: 0, bpm: 120 }];
const n = T.newSteps(1, 2);
check("a new step clip: one bar of 16ths, kick / snare / closed + open hats, the first of each beat accented",
  n.kind === "steps" && n.n === 16 && n.div === 4 && n.rows.map((r) => r.src).join() === "kit:kick,kit:snare,kit:chat,kit:ohat" && n.rows[0].hits[0] === 2 && n.rows[1].hits[4] === 2 && n.rows[2].hits[2] === 1 && n.rows[3].hits.every((h) => !h));
const e = T.stepEvents(n, M120);
check("stepEvents: every hit (clip-relative s) at 120 BPM: a 16th = 0.125 s; accent = row volume, else 70%",
  e.length === 12 && J(e.filter((x) => x.row === 0).map((x) => [x.t, x.v])) === J([[0, 0.9], [1, 0.9]]) && e.filter((x) => x.row === 2)[1].t === 0.25 && Math.abs(e.filter((x) => x.row === 2)[1].v - 0.42) < 1e-9, e);
const long = Object.assign({}, n, { len: 4 });
check("…the pattern repeats over a longer clip", T.stepEvents(long, M120).length === 24 && T.stepEvents(long, M120).filter((x) => x.row === 0).map((x) => x.t).join() === "0,1,2,3");
const sw = Object.assign({}, n, { start: 0, swing: 0.5, rows: [{ src: "kit:rim", vol: 1, hits: [0, 1, 0, 1].concat(Array(12).fill(0)) }] });
check("swing: every second step late by that much of a step", T.stepEvents(sw, M120).map((x) => x.t).slice(0, 2).join() === "0.1875,0.4375");
const tm = [{ t: 0, bpm: 120 }, { t: 1, bpm: 60 }], t2 = Object.assign({}, n, { start: 0, len: 3 });
check("the tempo track: steps follow its beats (beat 3 = 2 beats in the first second at 120, then a second at 60)", T.stepEvents(t2, tm).filter((x) => x.row === 1).map((x) => x.t).join() === "0.5,2");
const tr = Object.assign({}, n, { start: 0, div: 3, n: 12, rows: [{ src: "kit:tom", vol: 1, hits: Array(12).fill(1) }] });
check("8th triplets: 3 steps a beat", T.stepEvents(tr, M120).slice(0, 4).map((x) => Math.round(x.t * 1000)).join() === "0,167,333,500");
const j = T.cleanTL({ layers: [{ clips: [{ kind: "steps", start: 1, len: 2, n: 99, div: 5, swing: 2, grp: "g1", ti: 0, rows: [{ src: "kit:kick", vol: 9, hits: [2, 1, 0, 7] }, { src: "../bad" }, { src: "my:x.wav", hits: [] }].concat(Array(9).fill({ src: "kit:rim" })) }] }] });
const c = j.layers[0].clips[0];
check("cleanTL: a step clip kept safe (2-64 steps, a known per-beat, swing 0-0.5, 8 rows, good sounds only, hits 0/1/2), never a take",
  c.kind === "steps" && c.n === 64 && c.div === 4 && c.swing === 0.5 && c.rows.length === 8 && c.rows[0].vol === 1 && J(c.rows[0].hits.slice(0, 5)) === J([2, 1, 0, 1, 0]) && c.rows[1].src === "my:x.wav" && !c.grp, c);
check("schedule: a step clip plays as kind steps", T.schedule(j, 0)[0].kind === "steps");
const SJ = src("ext/synthdock/synthsteps.js"), TJ = src("ext/synthdock/synthtl.js"), DH = src("ext/synthdock/dock.html"), EJ = JSON.parse(src("ext/synthdock/ext.json"));
check("the editor (synthsteps.js after the mixer): rows (a sound, a volume, the cells), Steps, per beat, Swing, ＋ Row, 🗑, ▶, ✕ / Esc; click cycles, drag paints, right-click clears",
  EJ.scripts.indexOf("synthsteps.js") === EJ.scripts.indexOf("synthmix.js") + 1 && /id="syStepN"/.test(SJ) && /id="syStepDiv"/.test(SJ) && /id="syStepSwing"/.test(SJ) && /id="syStepAdd"/.test(SJ) && /data-delrow/.test(SJ) && /\(h \+ 1\) % 3/.test(SJ) && /e\.button === 2 \? 0/.test(SJ) && /pointerover/.test(SJ));
check("the timeline: ＋ ▦ Steps, step clips drawn as their hits, played hit by hit (row sounds loaded), double-click / ▦ Steps opens the editor, ✂ refuses",
  DH.includes('id="syTSteps"') && /function addSteps\(li, t\)/.test(TJ) && /T\.stepEvents\(c, tmap\(\)\)\.forEach\(function \(ev\)/.test(TJ) && /s\.kind === "steps"\) \(s\.c\.rows/.test(TJ) && /openSteps\(h\.l, h\.c\)/.test(TJ) && /A step clip is not split/.test(TJ) && /\.systep\.acc/.test(DH));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
