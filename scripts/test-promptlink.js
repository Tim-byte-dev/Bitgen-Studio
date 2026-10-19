#!/usr/bin/env node
/* bitGen Studio — 2.444.0 units: the image editor's ✨ Edit / Generate run from the PROMPT DOCKER (pcpromptlink.js) and
 * the editor's ⚙ SETTINGS (pcprefs.js): when it is linked, the button's words, the Qwen Image 2.1 edit pick; the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const L = require(path.join(ROOT, "ext", "imageeditdock", "pcpromptlink.js"));
const P = require(path.join(ROOT, "ext", "imageeditdock", "pcprefs.js"));
const on = { onScreen: true, open: true, aiShown: true, mode: "edit", genMode: "image" };
check("linkedNow: the editor on screen, the ✨ AI panel showing, Edit or Generate, the prompt docker in Image (2.451.0: no picture needed)",
  L.linkedNow(on) && L.linkedNow(Object.assign({}, on, { mode: "generate" })) && !L.linkedNow(Object.assign({}, on, { mode: "refine" })) && !L.linkedNow(Object.assign({}, on, { aiShown: false }))
  && !L.linkedNow(Object.assign({}, on, { onScreen: false })) && L.linkedNow(Object.assign({}, on, { open: false })) && !L.linkedNow(Object.assign({}, on, { genMode: "video" })));
check("goLabelFor: ✏ Edit / ✨ Generate while linked, else the button's own (null)", L.goLabelFor(on) === "✏ Edit" && L.goLabelFor(Object.assign({}, on, { mode: "generate" })) === "✨ Generate" && L.goLabelFor(Object.assign({}, on, { aiShown: false })) === null);
const opts = [{ value: "a", text: "FLUX dev" }, { value: "b", text: "Qwen Image Edit 2511" }, { value: "c", text: "Qwen Image 2.1 edit" }, { value: "d", text: "Qwen Image 2.1 edit (10 pictures)" }];
check("pickEditStyle: Qwen Image 2.1 edit first; else a Qwen edit, else any edit; none = ''", L.pickEditStyle(opts) === "c" && L.pickEditStyle(opts.slice(0, 2)) === "b" && L.pickEditStyle([{ value: "k", text: "Kontext edit" }]) === "k" && L.pickEditStyle([{ value: "x", text: "SDXL" }]) === "");
check("PCPrefs.order: tabs by their order, then as added", P.order([{ id: "a", order: 90 }, { id: "b" }, { id: "c", order: 10 }, { id: "d" }]).map((t) => t.id).join() === "c,b,d,a");
const IE = read("ext", "imageeditdock", "imageedit.js"), IDX = read("static", "index.html"), ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("the page: goLabel asks window.H3GoLabel, runGenerate asks window.H3TakeGenerate first (after the negative line is taken)",
  /window\.H3GoLabel \? window\.H3GoLabel\(\) : null/.test(IDX) && IDX.indexOf("window.H3TakeGenerate(gm, $(\"prompt\").value)") > IDX.indexOf("H3Neg.take($(\"prompt\").value)"));
check("the editor: runAI(opt) - the prompt docker's prompt, its edit style, the whole picture without a selection, ✔ Apply blends into the selected layer; setAiMode tells E.onAiMode",
  /async function runAI\(opt\)/.test(IE) && /opt\.prompt != null/.test(IE) && /opt\.editStyle \|\| \$\("ieEditStyle"\)\.value/.test(IE) && /mode === "generate" && opt\.whole/.test(IE)
  && /blendInto: !S\.genInto && opt\.into/.test(IE) && /✨ generate into " \+ B\.name/.test(IE) && /if \(E\.onAiMode\)/.test(IE));
check("installed after pcframes (pcprefs, then pcpromptlink); ⚙ Preferences… Ctrl+, in the Edit menu, ⚙ #kxPrefs on the menu bar",
  ext.indexOf("pcprefs.js") === ext.indexOf("pcframes.js") + 1 && ext.indexOf("pcpromptlink.js") === ext.indexOf("pcprefs.js") + 1 && IE.indexOf("PCPromptLink.install(E)") > IE.indexOf("PCPrefs.install(E)")
  && /addCmd\("edit\.prefs", "Preferences…", "Ctrl\+,"/.test(read("ext", "imageeditdock", "pcprefs.js")) && /b\.id = "kxPrefs"/.test(read("ext", "imageeditdock", "pcprefs.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
