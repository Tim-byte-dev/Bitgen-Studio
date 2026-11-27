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
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
