#!/usr/bin/env node
/* bitGen Studio — 2.989.0: the Sketcher -> the image editor with a TRANSPARENT background; ✨ Photo / ✏ Edit (Sketcher) follow
 * the whole prompt. Tim: "sketcher should render a transparent background when scene is sent to image-editor, but when photo
 * button is pressed or edit in sketcher button in prompt docker is pressed the follow the full prompt , location , setting,
 * other characters etc." */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const R = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));
const sc = R.sceneWords({ rooms: [{ closed: true }] }, [], {});
const withText = R.promptFor("a farmhouse in Tuscany at sunset, a woman walking her dog in front", null, sc), none = R.promptFor("", null, sc);
check("2.996.0 (replaces 2.989.0's FOLLOW): with your words, step 1 uses them for the model itself and keeps the grey - the place is step 2", withText.includes(R.KEEP_GREY) && /\nWhat the photo is for \(use it for the model itself - keep the grey\): a farmhouse/.test(withText), withText);
check("…the model keeps its shapes / camera (the depth line stays)", /depth map/.test(withText) && /keep exactly the same shapes, layout, proportions and camera angle/.test(withText));
check("no words: the scene alone (\"add nothing else\")", /add nothing else/.test(none) && none.includes(R.KEEP_GREY));
check("the default words (\"create a real photo of the model in view\") count as no words", !/What the photo is for/.test(R.promptFor(R.DEFAULT, null, sc)));
const dk = rd("ext/pushpulldock/ppdock.js"), fr = rd("ext/pushpulldock/ppframe.js"), vw = rd("ext/pushpulldock/ppview.js");
check("→ Image editor (the bar's button and the frame's menu) sends a TRANSPARENT picture; Send ▾ still has one with the background", /\$\("ppToIE"\)\.onclick = \(\) => guard\("→ Image editor", \(\) => toEditor\(true\)\)/.test(dk) && /h\.toEditor\(true\)/.test(fr) && /with its background \(sky \/ backdrop\)/.test(dk));
check("a transparent shot: no sky / backdrop and no ground either, put back after", /if \(o\.transparent\) \{ R\.setClearColor\(0x000000, 0\); scene\.background = null; ground\.visible = false; \}/.test(vw) && /if \(tr0\) \{ scene\.background = tr0\.bg; ground\.visible = tr0\.gr; \}/.test(vw));
// 2.990.0 (Tim: "woman standing in a park ... it just renders a white background not a park")
check("2.996.0 (replaces 2.990.0's EMPTY line): the grey is never step 1's to replace - fillPrompt (step 2) fills it, never green / grey / white", !withText.includes("replace all of it") && /Never leave green, grey, white or a plain backdrop/.test(R.fillPrompt("a park", false)));
check("…picture 1 drawn on that flat grey unless the model has its own backdrop / sky (2.996.0: the same for every way in)", /Object\.assign\(\{ clean: true, photo: true \}, p\.mode === "own" \? \{\} : \{ fill: FILL \}\)/.test(rd("ext/pushpulldock/ppreal.js")));
// 2.991.0: ONE reference = the picture itself (whole), its own line - with words and without
const one = { tiles: [], bg: null, refs: [{ src: "blob:x", cap: "Reference 1" }], single: true };
check("2.996.0 (replaces 2.991.0's REF1 \"its place, its look\" - it came back AS the reference): one reference for the model = SUBJ1, in the render's pose", R.promptFor("a park", one, sc).includes(R.SUBJ1) && !/its place, ground/.test(R.promptFor("", one, sc)));
check("…sent whole (refPic, 1024 px at most) instead of a cropped board tile; several references / materials still a board", /used\.single = used\.refs\.length === 1 && !used\.tiles\.length && !used\.bg/.test(rd("ext/pushpulldock/ppreal.js")) && /async function refPic\(src\)/.test(rd("ext/pushpulldock/ppreal.js")));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
