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
check("with your words: the lead no longer says \"add nothing else\"; the prompt is followed in full (location, setting, other people), last", !/add nothing else/.test(withText) && withText.includes(R.FOLLOW) && /other people, animals or objects/.test(R.FOLLOW) && /\nThe prompt: a farmhouse in Tuscany at sunset, a woman walking her dog in front$/.test(withText), withText);
check("…the model keeps its shapes / camera (the depth line stays)", /depth map/.test(withText) && /keeps its shapes, layout and camera angle/.test(withText));
check("no words: the scene alone, as before (\"add nothing else\", no FOLLOW)", /add nothing else/.test(none) && !none.includes(R.FOLLOW));
check("the default words (\"create a real photo of the model in view\") count as no words", !R.promptFor(R.DEFAULT, null, sc).includes(R.FOLLOW));
const dk = rd("ext/pushpulldock/ppdock.js"), fr = rd("ext/pushpulldock/ppframe.js"), vw = rd("ext/pushpulldock/ppview.js");
check("→ Image editor (the bar's button and the frame's menu) sends a TRANSPARENT picture; Send ▾ still has one with the background", /\$\("ppToIE"\)\.onclick = \(\) => guard\("→ Image editor", \(\) => toEditor\(true\)\)/.test(dk) && /h\.toEditor\(true\)/.test(fr) && /with its background \(sky \/ backdrop\)/.test(dk));
check("a transparent shot: no sky / backdrop and no ground either, put back after", /if \(o\.transparent\) \{ R\.setClearColor\(0x000000, 0\); scene\.background = null; ground\.visible = false; \}/.test(vw) && /if \(tr0\) \{ scene\.background = tr0\.bg; ground\.visible = tr0\.gr; \}/.test(vw));
// 2.990.0 (Tim: "woman standing in a park ... it just renders a white background not a park")
check("2.990.0 with words: the grey round the model is EMPTY - replaced by the prompt's place (ground, surroundings, sky), never a plain / white background", withText.includes(R.EMPTY) && /never keep a plain, grey or white background/.test(R.EMPTY) && !none.includes(R.EMPTY) && R.FILL === 0x808080 && !R.promptFor("a park", { tiles: [], bg: { src: "x", kind: "sky" }, refs: [] }, sc).includes(R.EMPTY));   // a backdrop / sky of your own stays
check("…picture 1 drawn on that flat grey (no sky / backdrop / ground) only when there are words", /Object\.assign\(\{ clean: true, photo: true \}, (words|fillBg) \? \{ fill: FILL \} : \{\}\)/ /* 2.993.0: fillBg = words or references, no environment one */.test(rd("ext/pushpulldock/ppreal.js")) && /if \(fill0\) \{ scene\.background = null; ground\.visible = false; R\.setClearColor\(o\.fill, 1\); \}/.test(vw));
// 2.991.0: ONE reference = the picture itself (whole), its own line - with words and without
const one = { tiles: [], bg: null, refs: [{ src: "blob:x", cap: "Reference 1" }], single: true };
check("2.991.0 one reference: \"{img3} is the reference picture\" (its place, surroundings, look) - not the tiles' line; both with and without words", R.promptFor("a park", one, sc).includes(R.REF1) && R.promptFor("", one, sc).includes(R.REF1) && !R.promptFor("a park", one, sc).includes("tiles marked Reference"));
check("…sent whole (refPic, 1024 px at most) instead of a cropped board tile; several references / materials still a board", /used\.single = used\.refs\.length === 1 && !used\.tiles\.length && !used\.bg/.test(rd("ext/pushpulldock/ppreal.js")) && /async function refPic\(src\)/.test(rd("ext/pushpulldock/ppreal.js")));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
