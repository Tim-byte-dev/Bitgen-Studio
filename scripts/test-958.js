#!/usr/bin/env node
// bitGen Studio 2.958.0 - 🎹 the mixer (per-layer EQ / compressor / reverb send + meters, the master), the metronome + count-in,
// timeline markers, stems. Tim: "continue" (the Cakewalk-style list). Browser test: scripts/test-ui958-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../ext/synthdock/synthtlcore.js"), K = require("../ext/synthdock/synthclick.js");
global.window = undefined;
const MX = (() => { const g = {}; const f = new Function("window", src("ext/synthdock/synthmix.js")); f(g); return g.H3SynthMix; })();
check("a new layer has its effects at rest (EQ 0 dB, no compression, no reverb); a new timeline: no markers, master 100%",
  JSON.stringify(T.newLayer(0).fx) === JSON.stringify({ lo: 0, mid: 0, hi: 0, comp: 0, rev: 0, cut: 20000 }) && T.newTL().markers.length === 0 && T.newTL().master === 1);
const j = T.cleanTL({ master: 4, markers: [{ t: 9, name: "Out" }, { t: -3, name: "<In>" }, null], layers: [{ fx: { lo: 99, mid: -99, hi: "x", comp: 2, rev: -1 } }, {}] });
check("cleanTL: effects kept in range (EQ ± 15 dB, comp / rev 0-1), markers sorted and safe, master 0-150%; an old save gets the defaults",
  JSON.stringify(j.layers[0].fx) === JSON.stringify({ lo: 15, mid: -15, hi: 0, comp: 1, rev: 0, cut: 20000 }) && j.layers[1].fx.lo === 0 && j.master === 1.5 && j.markers.map((m) => m.name + "@" + m.t).join() === "In@0,Out@9", j);
check("the click: every beat from the grid at 0, the bar's first beat accented; from / until respected", K.times(120, 0, 2.01).map((c) => c.t + (c.accent ? "A" : "")).join() === "0A,0.5,1,1.5,2A" && K.times(60, 2.5, 5).map((c) => c.t).join() === "3,4" && K.times(120, 0, 0).length === 0);
const an = { fftSize: 4, getFloatTimeDomainData: (b) => { b.set([0.5, -0.5, 0.5, -0.5]); } };
check("the meters: rms / peak of an analyser; dB", MX.level(an).rms === 0.5 && MX.level(an).peak === 0.5 && MX.level(null).peak === 0 && Math.round(MX.db(0.5)) === -6 && MX.db(0) === -100);
const TJ = src("ext/synthdock/synthtl.js"), JS = src("ext/synthdock/synthdock.js"), DH = src("ext/synthdock/dock.html"), EJ = JSON.parse(src("ext/synthdock/ext.json"));
check("the mix: per layer vol -> EQ (low shelf 200 Hz, peak 1 kHz, high shelf 4.5 kHz) -> compressor + make-up -> pan -> keyframes -> master, a send to one reverb, a meter per layer and the master",
  /lo\.type = "lowshelf"; lo\.frequency\.value = 200; mid\.type = "peaking"; mid\.frequency\.value = 1000;/.test(TJ) && /hi\.type = "highshelf"; hi\.frequency\.value = 4500/.test(TJ)
  && /vol\.connect\(lo\); lo\.connect\(mid\); mid\.connect\(hi\); hi\.connect\((?:flt\); flt\.connect\()?comp\); comp\.connect\(make\); make\.connect\(pan\); pan\.connect\(ev\);/.test(TJ) && /ev\.connect\(send\); send\.connect\(verb\)/.test(TJ) && /master\.connect\(mMeter\)/.test(TJ));
check("…the knobs are live while it plays (setFx), stems render one layer alone (only)", /function setFx\(n, l, t\)/.test(TJ) && /setFx\(n, l, t\); \}\);/.test(TJ) && /function mixInto\(ctx, dest, from, at, bufs, only(, force)?\)/ /* 2.973.0: + force */.test(TJ) && /render\(48000, i\)/.test(TJ));
check("markers: ⚑ / M at the playhead, click on the ruler = go, double-click = rename (or a new one), right-click = gone; drawn as flags", /function addMarker\(t, name\)/.test(TJ) && /k === "m" && !e\.ctrlKey/.test(TJ) && /var mk = markerAt\(p\.x\);/.test(TJ) && /Rename the marker/.test(TJ) && /TLD\.markers\.splice\(mk, 1\)/.test(TJ));
check("the bar: 🕒 Click, Count-in (off / 1 / 2 bars), ⚑ Marker, 🎚 Mixer, ⬇ Stems; scripts: synthclick.js before the recorder, synthmix.js after the roll",
  ["syClick", "syCount", "syTMark", "syTMixBtn", "syTStems", "syMix"].every((id) => DH.includes('id="' + id + '"')) && /<option value="0" selected>off<\/option>/.test(DH)
  && EJ.scripts.indexOf("synthclick.js") < EJ.scripts.indexOf("synthrec.js") && EJ.scripts.indexOf("synthmix.js") === EJ.scripts.indexOf("synthroll.js") + 1);
check("● / ⏺ start after the count-in; 🕒 clicks while recording (never in the take - the click goes to the mix, not the recorded buses)",
  /countIn\(function \(\) \{ SC\.rec\(\); recClick\(\); \}\)/.test(JS) && /countIn\(function \(\) \{ LP\.rec\(\); recClick\(\); \}\)/.test(JS) && /H3SynthClick\.run\(ctx\(\), engine\(\)\.mix,/.test(JS) && /LS\.set\("click"/.test(JS));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
