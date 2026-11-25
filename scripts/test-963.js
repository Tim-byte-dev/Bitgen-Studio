#!/usr/bin/env node
// bitGen Studio 2.963.0 - 🎹 the timeline's panel top left above the layers (always there, one height): a picked clip = its name +
// Gain / Fade in / Fade out; else the picked layer = its name (rename it) + Vol / Pan / Filter. Layer names: in the panel or the head.
// Tim: "please put the panel with the filename and 3 knobs top left of the layers. when user clicks a layer it edits the selected
// layer. allow user to change the names of layers". Browser test: scripts/test-ui963-ui.js.
"use strict";
const fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const TJ = src("ext/synthdock/synthtl.js"), DH = src("ext/synthdock/dock.html");
check("the panel: top left above the layers, always shown, one height (the lanes never move)", /\.sytlkey \{ display: flex; flex-wrap: nowrap;[^}]*align-self: flex-start; height: 62px/.test(DH) && !/\.sytlkey \{[^}]*position: absolute/.test(DH)
  && DH.indexOf('id="syTKeyEd"') < DH.indexOf('class="sytlbody"'));
check("nothing picked on a layer = the layer (name + Vol / Pan / Filter); a click on a head picks the layer for it", /function layerEd\(box\)/.test(TJ) && /else layerEd\(box\)/.test(TJ) && /id = "syTLName"/.test(TJ) && /dataset\.lay = key/.test(TJ) && /S\.sel = i; S\.clip = null; S\.key = null; S\.tpt = null; S\.apt = null; keyEd\(\)/.test(TJ));
check("rename: the panel's name box and the head's (the other follows)", /l\.name = inp\.value\.replace\(\/\[<>\]\/g, ""\)\.trim\(\)\.slice\(0, 32\) \|\| "Layer " \+ \(li \+ 1\); inp\.value = l\.name; changed\(\); heads\(\)/.test(TJ) && /inp\.value = l\.name; changed\(\); keyEd\(\); draw\(\)/.test(TJ));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
