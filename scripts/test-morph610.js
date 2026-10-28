#!/usr/bin/env node
/* bitGen Studio — 2.610.0 (pure + wiring): 🧬 MORPH between two layers of the timeline.
 * Tim: "lets automate the morph - add a morph tab to the properties docker, properties will be, character 1, character 2 ,
 * layer 1, layer 2 where the layers will be where the 2 clips are then automatically write the prompt and take the first
 * and last images from the layers, create the movie and insert the clip on a morph layer between the 2 layers starting at
 * the end of layer 1 and start layer 2 at the end of the morph"
 *   ext/timelinedock/tlmorph.js  isUsable, lastClip, nextClip, writePrompt, NEG, plan, kindOfLk, layerSlot; the wiring */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const M = require(path.join(R, "ext", "timelinedock", "tlmorph.js"));

check("a morph starts / ends on a video or a picture - never a text, shape, 3D layer, adjustment, null or generator",
  M.isUsable({ name: "a.mp4" }) && M.isUsable({ name: "b.png", len: 3 }) && !M.isUsable({ name: "t.png", text: {} }) && !M.isUsable({ name: "", shape: {} }) && !M.isUsable({ name: "x", m3d: {} }) && !M.isUsable({ name: "x", adjust: {} }) && !M.isUsable(null));
const len = (c) => c.l;
const a = { name: "a", start: 0, l: 3 }, b = { name: "b", start: 4, l: 2 }, t = { name: "t", start: 9, l: 5, text: {} };
check("layer 1's clip: the one that ENDS last (a text after it does not count)", M.lastClip([b, a, t], len) === b && M.lastClip([t], len) === null);
const c1 = { name: "c1", start: 6 }, c2 = { name: "c2", start: 2 }, c3 = { name: "c3", start: 10 };
check("layer 2's clip: the first starting at / after a time (not layer 1's own); on another layer, its first",
  M.nextClip([c3, c1, c2], 5) === c1 && M.nextClip([c3, c1, c2], 5, c1) === c3 && M.nextClip([c1, c2], 7, null) === c2 && M.nextClip([c1], 7, c1) === null);
const p = M.writePrompt("a monkey", "a man", "golden hour");
check("the prompt is written from the two characters: one continuous transformation, the same pose and framing, cinematic + photoreal, the extra words at the end",
  /^A monkey slowly and seamlessly transforms into a man in one continuous, uninterrupted shot\./.test(p) && /from a monkey to a man/.test(p) && /same pose, position and camera framing/.test(p) && /Cinematic lighting, photorealistic/.test(p) && / golden hour$/.test(p)
  && /^The first character slowly/.test(M.writePrompt("", "", "")));
check("the morph's negatives keep cuts, cross-fades, a second subject and flicker out", /cut, scene change, cross-fade/.test(M.NEG) && /two subjects/.test(M.NEG) && /flicker/.test(M.NEG));
check("plan: the morph starts at the end of layer 1's clip; layer 2's clip starts at the morph's end (moved later or earlier)",
  JSON.stringify(M.plan(4, 10, 3)) === JSON.stringify({ start: 4, start2: 7, shift: -3 }) && JSON.stringify(M.plan(4, 5, 3)) === JSON.stringify({ start: 4, start2: 7, shift: 2 }));
check("layerSlot: the morph layer BETWEEN the two - two video layers: above the lower; V1 + a video layer: right under it; a picture layer: the top of the video layers; V1 + V1: just above V1",
  M.layerSlot("vl:1", "vl:3", 5) === 2 && M.layerSlot("vl:3", "vl:1", 5) === 2 && M.layerSlot("v1", "vl:2", 4) === 2 && M.layerSlot("vl:2", "v1", 4) === 2 && M.layerSlot("vl:0", "i:1", 3) === 1
  && M.layerSlot("v1", "i:0", 3) === 3 && M.layerSlot("v1", "v1", 3) === 0 && M.kindOfLk("i:2") === "img" && M.kindOfLk("vl:0") === "vl" && M.kindOfLk("v1") === "v1" && M.kindOfLk("x") === null);

const S = read("ext/timelinedock/tlmorph.js"), ej = JSON.parse(read("ext/timelinedock/ext.json")).scripts;
check("the page: the 🧬 Morph tab beside Properties; the two frames as shown (a video's out / in frame by the server, a picture as it is); ONE first + last frame render (fl2va / LTX auto); the morph layer + layer 2 moved, one save (one ↶)",
  /data-tlt="morph"/.test(S) && /\/api\/tlai\/frame/.test(S) && /\/passets\/images\//.test(S) && /fd\.append\("mode", "fl2va"\)/.test(S) && /fd\.append\("ltx_mode", "auto"\)/.test(S)
  && /fd\.append\("references", first, "morph_first\.png"\)/.test(S) && /fd\.append\("references", last, "morph_last\.png"\)/.test(S) && /mkLayer\("🧬 Morph"/.test(S) && /tl\.vlayers\.splice/.test(S) && ej.includes("tlmorph.js"));
check("kept with the project (tl.morph) - the timeline's own save", /tl\.morph = \{ c1: "", c2: "", l1: "", l2: "", secs: 3/.test(S));
check("server.js untouched by this release", !/morph/i.test(read("misc/server.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
