#!/usr/bin/env node
// bitGen Studio 2.959.0 - 🎹 automation lanes (Pan / Filter / Rev drawn as points over a layer) + a per-layer lowpass filter
// + ⤓ bounce (a layer rendered to one sound on a new layer, the original muted). Tim: "continue next please". Browser: test-ui959-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../ext/synthdock/synthtlcore.js");
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

check("the lanes: pan, cut (filter), rev; a new layer has them empty and its filter open (20 kHz)",
  T.AUTO.join() === "pan,cut,rev" && JSON.stringify(T.newLayer(0).auto) === '{"pan":[],"cut":[],"rev":[]}' && T.newLayer(0).fx.cut === 20000);
const a = T.cleanAuto({ pan: [{ t: 4, v: 2 }, { t: -1, v: 0.5 }, null, { t: "x", v: 1 }, { t: 2, v: -3 }], cut: "no", zz: [{ t: 1, v: 1 }] });
check("cleanAuto: points sorted by time, t ≥ 0, v kept 0-1, junk dropped, unknown lanes gone",
  JSON.stringify(a) === JSON.stringify({ pan: [{ t: 0, v: 0.5 }, { t: 2, v: 0 }, { t: 4, v: 1 }], cut: [], rev: [] }), a);
check("cleanAuto: at most 400 points a lane", T.cleanAuto({ rev: Array.from({ length: 900 }, (_, i) => ({ t: i, v: 0.5 })) }).rev.length === 400);
check("cleanTL keeps a layer's lanes and its filter (40 Hz - 20 kHz); an old save gets empty lanes",
  (() => { const j = T.cleanTL({ layers: [{ auto: { cut: [{ t: 1, v: 0.2 }] }, fx: { cut: 5 } }, {}] }); return j.layers[0].auto.cut.length === 1 && j.layers[0].fx.cut === 40 && j.layers[1].auto.pan.length === 0 && j.layers[1].fx.cut === 20000; })());
check("values: pan 0..1 -> -1..+1, filter 0..1 -> 40 Hz..20 kHz (log), rev as is; autoNorm undoes it",
  T.autoVal("pan", 0) === -1 && T.autoVal("pan", 0.5) === 0 && T.autoVal("pan", 1) === 1 && near(T.autoVal("cut", 0), 40) && near(T.autoVal("cut", 1), 20000, 1e-3)
  && T.autoVal("rev", 0.3) === 0.3 && near(T.autoNorm("pan", 0.5), 0.75) && near(T.autoNorm("cut", 20000), 1) && near(T.autoNorm("cut", T.autoVal("cut", 0.37)), 0.37) && T.autoNorm("cut", 1) === 0);
const pts = [{ t: 1, v: 0 }, { t: 3, v: 1 }];
check("autoAt: the default before the first point, straight lines between, the last point held",
  T.autoAt(pts, 0, 0.5) === 0.5 && T.autoAt(pts, 2, 0.5) === 0.5 && T.autoAt(pts, 1.5, 0.9) === 0.25 && T.autoAt(pts, 9, 0) === 1 && T.autoAt([], 5, 0.7) === 0.7);
const ops = T.autoOps(pts, 2, 0.5);
check("autoOps from mid-way: set the value now, then ramps to the points still ahead",
  JSON.stringify(ops) === JSON.stringify([{ op: "set", t: 2, v: 0.5 }, { op: "ramp", t: 3, v: 1 }]) && T.autoOps(pts, 5, 0).length === 1, ops);

const TJ = src("ext/synthdock/synthtl.js"), MJ = src("ext/synthdock/synthmix.js"), DH = src("ext/synthdock/dock.html");
check("the mix: a lowpass per layer between the EQ and the compressor; the lanes scheduled onto pan / filter / reverb send",
  /flt\.type = "lowpass"/.test(TJ) && /hi\.connect\(flt\); flt\.connect\(comp\)/.test(TJ) && /function autoInto\(n, l, from, at\)/.test(TJ) && /autoInto\(nd, l, from, at\)/.test(TJ)
  && /exponentialRampToValueAtTime/.test(TJ) && /linearRampToValueAtTime/.test(TJ));
check("…a lane with points owns its knob (the live knob does not fight the lane)", /if \(!has\("rev"\)\)/.test(TJ) && /if \(!has\("cut"\)\)/.test(TJ) && /!\(l\.auto && l\.auto\.pan && l\.auto\.pan\.length\)/.test(TJ));
check("the heads: a lane picker (◆ Vol / Pan / Filter / Rev) and ⤓ bounce; the lane's CSS",
  /className = "sytlview"/.test(TJ) && /\["cut", "Filter"\]/.test(TJ) && /dataset\.bounce = i/.test(TJ) && /\.sytlview \{/.test(DH));
check("editing: double-click adds a point, drag moves it (between its neighbours), right-click / Delete removes it",
  /kind: "apt"/.test(TJ) && /d\.kind === "apt"/.test(TJ) && /la\.auto\[k3\]\.push\(pt\)/.test(TJ) && /L\(ha\.l\)\.auto\[ha\.k\]\.splice\(ha\.p, 1\)/.test(TJ) && /if \(S\.apt\)/.test(TJ));
check("bounce: render(48000, i) -> a WAV upload -> a new layer from 0 named (bounced), the original muted",
  /function bounce\(i\)/.test(TJ) && /return render\(48000, i\)\.then/.test(TJ) && /\(bounced\)", 0\)/.test(TJ) && /l\.mute = true/.test(TJ) && /bounce: bounce/.test(TJ));
check("the mixer: a Filter knob per strip on the log scale", /label: "Filter"/.test(MJ) && /autoVal\("cut", n\)/.test(MJ) && /"cut"\);/.test(MJ));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
