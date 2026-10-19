#!/usr/bin/env node
/* bitGen Studio — 2.448.0 units: THE CONTENT-AWARE FILL WORKSPACE (ext/imageeditdock/pccafill.js): the sampling areas
 * (Auto ring, Rectangular, the Sampling Brush), the colour adaptation passes, PatchMatch taking patches ONLY from the
 * sampling area (pcretouch.js inpaint opts.sample); the wiring (ext.json, imageedit.js). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const C = require(path.join(ROOT, "ext", "imageeditdock", "pccafill.js"));
const R = require(path.join(ROOT, "ext", "imageeditdock", "pcretouch.js"));

const W = 40, H = 30, hole = new Uint8Array(W * H);
for (let y = 10; y < 20; y++) for (let x = 15; x < 25; x++) hole[y * W + x] = 255;
const ring = C.ringSample(hole, W, H, 3);
check("ringSample (Auto): a ring within k of the hole, the hole itself left out",
  ring[15 * W + 13] === 255 && ring[15 * W + 12] === 255 && ring[15 * W + 10] === 0 && ring[15 * W + 20] === 0 && ring[5 * W + 20] === 0, [ring[15 * W + 13], ring[15 * W + 10], ring[15 * W + 20]]);
const rect = C.rectSample(hole, W, H, 4);
check("rectSample (Rectangular): the hole's box grown by k, the hole out; clipped to the picture",
  rect[6 * W + 11] === 255 && rect[5 * W + 11] === 0 && rect[15 * W + 20] === 0 && C.countOn(rect) === 18 * 18 - 100 && C.countOn(C.rectSample(new Uint8Array(W * H), W, H, 4)) === 0, C.countOn(rect));
const m = new Uint8Array(W * H);
C.paintDab(m, hole, W, H, 20, 15, 8, true);
const added = C.countOn(m);
C.paintDab(m, hole, W, H, 5, 15, 3, true);
C.paintDab(m, hole, W, H, 5, 15, 3, false);
check("paintDab (the Sampling Brush): adds a round dab but never inside the hole; Alt / − takes it away", added > 50 && m[15 * W + 20] === 0 && m[15 * W + 13] === 255 && C.countOn(m) === added, { added, now: C.countOn(m) });
check("bboxOf / countOn", JSON.stringify(C.bboxOf(hole, W, H)) === '{"x":15,"y":10,"w":10,"h":10}' && C.bboxOf(new Uint8Array(4), 2, 2) === null && C.countOn(hole) === 100);
check("Colour Adaptation: None / Default / High / Very High = 0 / 200 / 500 / 1000 Poisson passes", C.ADAPT.none === 0 && C.ADAPT.default === 200 && C.ADAPT.high === 500 && C.ADAPT.veryhigh === 1000);

// PatchMatch with a sampling area: left half red, right half blue, the hole in the middle - sampled from the right = blue
const w = 64, h = 32, img = new Uint8ClampedArray(w * h * 4), hl = new Uint8Array(w * h), samp = new Uint8Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; img[i] = x < 32 ? 255 : 0; img[i + 2] = x < 32 ? 0 : 255; img[i + 3] = 255; if (x >= 46) samp[y * w + x] = 255; }
for (let y = 10; y < 22; y++) for (let x = 26; x < 38; x++) hl[y * w + x] = 255;
const out = R.inpaint(img, w, h, hl, { seed: 11, sample: samp });
let blue = 0, red = 0; for (let y = 10; y < 22; y++) for (let x = 26; x < 38; x++) { const i = (y * w + x) * 4; if (out[i + 2] > 200 && out[i] < 60) blue++; if (out[i] > 200 && out[i + 2] < 60) red++; }
check("inpaint opts.sample: the fill takes patches ONLY from the sampling area (right side = all blue, no red)", blue === 144 && red === 0, { blue, red });

const IE = read("ext", "imageeditdock", "imageedit.js"), ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, SRC = read("ext", "imageeditdock", "pccafill.js");
check("wiring: pccafill.js loads after pcartboards.js, installed after PCArtboards; Edit ▸ Content-Aware Fill… re-pointed at the workspace (same command id)",
  ext.indexOf("pccafill.js") === ext.indexOf("pcartboards.js") + 1 && IE.indexOf("PCCaFill.install(E)") > IE.indexOf("PCArtboards.install(E)") && /addCmd\("edit\.cafill", "Content-Aware Fill…"/.test(SRC)
  && /cafOut/.test(SRC) && /"cur", "Current Layer"/.test(SRC) && /"new", "New Layer"/.test(SRC) && /"dup", "Duplicate Layer"/.test(SRC));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
