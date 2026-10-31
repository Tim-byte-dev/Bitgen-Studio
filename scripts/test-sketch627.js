#!/usr/bin/env node
/* bitGen Studio — 2.627.0 (pure + wiring): THE SKETCHER'S REAL PHOTO - A CLEAN RENDER + ITS DEPTH MAP, THE LEAD PROMPT.
 * Tim: "before generating the picture do a clean render + depth and prepend the prompt to convert image n with Turn this 3D
 * render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft
 * shadows, no outlines, DSLR photo." */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const K = require(path.join(R0, "ext", "pushpulldock", "ppreal.js"));
const RW = require(path.join(R0, "lib", "refWords.js"));
const p1 = K.promptFor(K.DEFAULT), p2 = K.promptFor("at dusk, wet street");
check("the prompt starts with Tim's words: \"Convert {img1}: Turn this 3D render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft shadows, no outlines, DSLR photo.\"",
  p1.startsWith("Convert {img1}: Turn this 3D render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft shadows, no outlines, DSLR photo."), p1);
check("…then the depth map's line ({img2}); the default words are not added, the user's own words are (after it)", /\{img2\} is the depth map of \{img1\}/.test(p1) && !p1.includes(K.DEFAULT) && p2.endsWith("\nat dusk, wet street"), { p1, p2 });
const sub = (t, w) => t.replace(/\{img(\d)\}/g, (_, n) => RW.tag(n, w));
check("{img1} / {img2} become the edit model's own words (Qwen 2.1: <image1> / <image2>; Klein: image 1; else Picture 1)", sub(p1, "qwen21").startsWith("Convert <image1>:") && /<image2> is the depth map of <image1>/.test(sub(p1, "qwen21")) && sub(p1, "image").startsWith("Convert image 1:") && sub(p1, "picture").startsWith("Convert Picture 1:"));
const RA = read("routes/aiedit.js"), RL = read("ext/pushpulldock/ppreal.js"), VW = read("ext/pushpulldock/ppview.js");
check("routes/aiedit.js: ref_raw = the prompt names its pictures itself ({imgN} -> refWords.tag), else as before", /b\.ref_raw === "1"/.test(RA) && /refWords\.tag\(n, wording\)/.test(RA) && /aiEdit\.refPrompt\(plan\.prompt, b\.ref_desc, wording\)/.test(RA));
check("the run: picture 1 = a clean render (photo), picture 2 = its depth map (ref0, ref_raw)", /photo: true/.test(RL) && /depth: true/.test(RL) && /fd\.append\("ref0", dblob/.test(RL) && /fd\.append\("ref_raw", "1"\)/.test(RL));
check("the view's shot: photo = no lines, shadows, a daylight sky; depth = MeshDepthMaterial, near / far fitted to the model; the faces without shadow acne",
  /o\.photo/.test(VW) && /0xc9dcec/.test(VW) && /MeshDepthMaterial/.test(VW) && /persp\.near = Math\.max\(0\.01, d - br/.test(VW) && /sun\.shadow\.normalBias/.test(VW));
check("server.js untouched by this release", !/ref_raw|ppreal/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
