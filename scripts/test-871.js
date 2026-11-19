#!/usr/bin/env node
/* bitGen Studio — 2.871.0 units: the Character creator's sheet tab makes the character picture itself (ext/videodock/h3sheet.js):
 * a prompt, an IMAGE style (the prompt docker's list) and ✨ Generate; Basic Settings ▸ Override style ticked = the picked style's
 * own Basic Settings (live when it is the prompt docker's style, else its saved ones - fromSaved), unticked = its own settings;
 * the picture opens in the sheet's canvas and joins the character's generations (characters.js H3CharSheetPic).
 * Tim (verbatim): "can we add a generate button with a prompt input in the character style dropdown to show image styles, if
 * overide settings is checked then use the selected styles overide" */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const HS = src("ext/videodock/h3sheet.js"), CH = src("ext/videodock/characters.js");
// the panel's file run with a stand-in window: only its pure helper is used here
const win = { localStorage: { getItem: () => null, setItem: () => {} } };
const ctx = { window: win, document: { getElementById: () => null }, localStorage: win.localStorage, console };
vm.createContext(ctx); vm.runInContext(HS, ctx);
const D = win.H3SheetDesign;
check("H3SheetDesign gives fromSaved / picSettings / generatePic", D && typeof D.fromSaved === "function" && typeof D.picSettings === "function" && typeof D.generatePic === "function");
const a = D.fromSaved({ imgRes: "1024", imgAr: "16:9", imgSteps: "12", imgCfg: "3.5", imgSeed: "7", imgCkpt: "sdxl/juggernaut.safetensors" }, true);
check("fromSaved: the style's saved size (long side 1024 at 16:9, 16 px steps), steps, CFG, seed, checkpoint + the words",
  a.body.width === 1024 && a.body.height === 576 && a.body.steps === 12 && a.body.cfg === 3.5 && a.body.seed === 7 && a.body.model === "sdxl/juggernaut.safetensors"
  && a.words === "1024 × 576, 12 steps, CFG 3.5, seed 7, juggernaut.safetensors", a);
const b = D.fromSaved({ imgRes: "Style's own", imgAr: "1:1", imgSteps: "", imgCfg: "", imgSeed: "-1", imgCkpt: "x.safetensors" }, false);
check("...the style's own size / empty steps + CFG left out, a random seed said, Use model off = no checkpoint", !("width" in b.body) && !("steps" in b.body) && !("cfg" in b.body) && b.body.seed === -1 && !("model" in b.body) && b.words === "random seed", b);
const c = D.fromSaved({ imgRes: "1000", imgAr: "2:3" }, true);
check("...a portrait aspect: the long side is the height", c.body.height === 1008 && c.body.width === 672, c.body);
check("picSettings with no Override style switch on the page = the style's own settings", /Override style is off/.test(D.picSettings("any").words) && !Object.keys(D.picSettings("any").body).length);
check("h3sheet.js: the row under 📂 Load picture - prompt, image style (the prompt docker's #styleSel list, the pick kept), ✨ Generate; Enter generates",
  /id="h3sPicPrompt"/.test(HS) && /id="h3sPicStyle"/.test(HS) && /id="h3sPicGo"/.test(HS) && /\$\("chSheetLoad"\), bar = load && load\.closest\("\.chBar"\)/.test(HS)
  && /\$\("styleSel"\)/.test(HS) && /S\.picStyle = \$\("h3sPicStyle"\)\.value/.test(HS) && /e\.key === "Enter"/.test(HS));
check("...Override style ticked: the prompt docker's style = Basic Settings now (imgBasicsBody), another = its saved ones (H3StyleBasic \"image:<id>\"); the line says which",
  /\$\("ovrStyle"\)/.test(HS) && /window\.imgBasicsBody\(\{\}\)/.test(HS) && /\["image:" \+ id\]/.test(HS) && /has no Basic Settings saved yet/.test(HS) && /note.id = "h3sPicNote"/.test(HS));
check("...✨ Generate: ComfyUI made ready (H3PodRoute), /api/genimage with the style + the settings, followed, the picture opened in the sheet's canvas + kept with the character",
  /H3PodRoute\.ready\("image", id\)/.test(HS) && /fetch\("\/api\/genimage"/.test(HS) && /H3CharSheetPic\.open\(outs\[0\]/.test(HS) && /H3CharSheetPic\.keep\(outs\)/.test(HS));
check("characters.js: H3CharSheetPic.open = chMaskOpen (the box, a fresh take session), keep = the character's generations",
  /window\.H3CharSheetPic = \{/.test(CH) && /img\.onload = function \(\) \{ chMaskOpen\(img, name \|\| "generated\.png"\); \}/.test(CH) && /body: JSON\.stringify\(\{ name: ccName\(\), add: urls \}\)/.test(CH));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
