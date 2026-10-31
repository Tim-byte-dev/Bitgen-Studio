#!/usr/bin/env node
/* bitGen Studio — 2.626.0 (pure + wiring): PUSHPULL IS NOW THE 📏 SKETCHER; WITH THE PROMPT DOCKER IT EDITS THE VIEW INTO A
 * REAL PHOTO (ext/pushpulldock/ppreal.js); → IMAGE EDITOR / → TIMELINE SEND A SKETCHER LAYER.
 * Tim: "change the name of push pull to Sketcher - when sketcher is open and prompt is open go to image mode in prompt and
 * edit - create a real photo of the model in view , when image is sent to timeline or image-editor send it as a sketcher
 * layer and when generated using prompt docker , make it a real image" */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const K = require(path.join(R0, "ext", "pushpulldock", "ppreal.js"));

check("linked: the Sketcher AND the prompt docker on screen, the image editor not (it has its own Edit link) - unless the Sketcher is maximized",
  K.linkedNow({ sketcher: true, prompt: true, editor: false }) && !K.linkedNow({ sketcher: true, prompt: false }) && !K.linkedNow({ sketcher: false, prompt: true })
  && !K.linkedNow({ sketcher: true, prompt: true, editor: true }) && K.linkedNow({ sketcher: true, prompt: true, editor: true, maxed: true }));
const E = { edit: [{ id: "a" }, { id: "qwen" }], defaults: { edit: "qwen" } };
check("the edit model: the prompt docker's style when it edits, else the default edit model, else the first; none = \"\"",
  K.pickEditStyle("a", E) === "a" && K.pickEditStyle("krea", E) === "qwen" && K.pickEditStyle("krea", { edit: [{ id: "a" }] }) === "a" && K.pickEditStyle("x", { edit: [] }) === "");
const s1 = K.shotSize(1600, 900), s2 = K.shotSize(500, 900), s3 = K.shotSize(0, 0);
check("the picture: the view's shape, its long side 1024, multiples of 16", s1.w === 1024 && s1.h === 576 && s2.h === 1024 && s2.w % 16 === 0 && Math.abs(s2.w - 569) < 16 && s3.w === 1024 && s3.h === 576, { s1, s2, s3 });
check("the real photo's name: sketcher_real_<model>.png", K.realName("model 1") === "sketcher_real_model_1.png" && K.DEFAULT === "create a real photo of the model in view");

const RL = read("ext/pushpulldock/ppreal.js"), EJ = JSON.parse(read("ext/pushpulldock/ext.json")), DH = read("ext/pushpulldock/dock.html"), DK = read("ext/pushpulldock/ppdock.js"), M3 = read("ext/timelinedock/m3d.js");
check("the name: Sketcher (the extension, its title, the help page, the shortcuts) - the Push/Pull TOOL keeps its name", EJ.name === "Sketcher" && /▾ 📏 Sketcher</.test(DH) && !/PushPull/.test(DH)
  && /<h1>📏 Sketcher<\/h1>/.test(read("static/help/pushpull.html")) && /"Sketcher - over the docker"/.test(read("docs/shortcuts.json")) && /Push\/Pull/.test(read("static/help/pushpull.html")));
check("the prompt docker: 🖼 Image + an edit model + the words when linked, put back after; its button and Generate through the page's seams (chained, the image editor's kept)",
  /setSel\("genModeSel", "image"\)/.test(RL) && /\/api\/aiedit\/engines/.test(RL) && /root\.H3TakeGenerate = mineTake/.test(RL) && /mineTake\.prev/.test(RL) && /root\.H3GoLabel = mineLabel/.test(RL) && /Edit \(Sketcher\)/.test(RL));
check("the run: the view -> /api/aiedit (mode edit, the whole picture) -> the job -> the Image assets (/api/passets) - a real image", /\/api\/aiedit"/.test(RL) && /mode: "edit"/.test(RL) && /whole: "1"/.test(RL) && /\/api\/passets/.test(RL) && EJ.scripts[EJ.scripts.length - 1] === "ppreal.js");
check("→ Image editor: a Sketcher layer ({sketcher: {model}}, sent again = updated); → Timeline: a Sketcher layer (m3d.js add takes its name)",
  /function sketcherLayer/.test(DK) && /L\.sketcher = \{ model \}/.test(DK) && /"📏 Sketcher · " \+ nameNow\(\)/.test(DK) && /function add\(type, modelName, at, t0, label\)/.test(M3) && /label \? String\(label\)/.test(M3));
check("server.js untouched by this release", !/ppreal|Sketcher/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
