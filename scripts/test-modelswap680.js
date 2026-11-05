#!/usr/bin/env node
/* bitGen Studio — 2.680.0: THE PROMPT DOCKER'S ⇄ (static/modelswap.js fieldsOf / label; lib/modelSettings.js clean / read /
 * write -> model_settings.tmp; routes/modelSettings.js). The clicks: scripts/test-ui680-ui.js.
 * Tim (verbatim): "add a toggle button next to each model type dropdown in prompt docker so user can toggle between current
 * settings for the model type and previous settings - if the settings have overide checked use overide settings including
 * any temporary loras, save the settings in a file model_settings.tmp ." */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const W = require(path.join(ROOT, "static", "modelswap.js"));
check("the two model types: image (styleSel, #iset, its temporary LoRAs) + video (videoStyleSel, #vset)", W.KINDS.image.sel === "styleSel" && W.KINDS.image.set === "iset" && W.KINDS.video.sel === "videoStyleSel" && W.KINDS.video.set === "vset");
const f = W.fieldsOf([{ id: "iSteps", type: "number", value: "30" }, { id: "iSeedLock", type: "checkbox", checked: true }, { id: "x", type: "file", value: "c:/a" }, { id: "tl0", type: "text", value: "a.safetensors", lora: true }, { type: "text", value: "no id" }]);
check("a setting's values: each control by its id (checkbox = true / false) - never files, never the LoRA rows (kept apart)", JSON.stringify(f) === JSON.stringify({ iSteps: "30", iSeedLock: true }), f);
check("the tooltip: the style + 'Basic Settings (Override style), 2 temporary LoRAs'", W.label({ name: "Juggernaut", ovr: true, loras: [{}, {}] }) === "Juggernaut + Basic Settings (Override style), 2 temporary LoRAs" && W.label({ name: "Flux", ovr: false }) === "Flux" && /no previous setting yet/.test(W.label(null)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ms680-"));
const core = require(path.join(ROOT, "lib", "core.js")), was = core.BASE; core.BASE = tmp;
const MS = require(path.join(ROOT, "lib", "modelSettings.js"));
check("no file yet: empty current / previous for image and video", JSON.stringify(MS.read()) === JSON.stringify({ image: { cur: null, prev: null }, video: { cur: null, prev: null } }));
const w = MS.write({ image: { cur: { style: "st_a", name: "A", ovr: true, fields: { iSteps: "30", "bad key!": 1, iCfg: 5.5 }, loras: [{ path: "loras/x.safetensors", weight: 0.7 }, { path: "" }], at: 5 },
  prev: { style: "st_b", name: "B", ovr: false, fields: { iSteps: "9" }, loras: [{ path: "y" }] } }, video: { cur: { style: "" } } });
check("written to <app>/model_settings.tmp: Override on = its values + temporary LoRAs; Override off = the style only; bad ids / empty LoRAs / no style dropped",
  path.basename(MS.file()) === "model_settings.tmp" && fs.existsSync(path.join(tmp, "model_settings.tmp")) && w.image.cur.fields.iSteps === "30" && w.image.cur.fields.iCfg === 5.5 && !("bad key!" in w.image.cur.fields)
  && w.image.cur.loras.length === 1 && w.image.cur.loras[0].weight === 0.7 && JSON.stringify(w.image.prev.fields) === "{}" && w.image.prev.loras.length === 0 && w.video.cur === null, w);
check("…read back the same", JSON.stringify(MS.read()) === JSON.stringify(w));
fs.writeFileSync(path.join(tmp, "model_settings.tmp"), "{broken");
check("a broken file = empty (never an error)", MS.read().image.cur === null);
core.BASE = was; fs.rmSync(tmp, { recursive: true, force: true });
const IX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8"), GI = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
check("wired: routes/modelSettings.js mounted (GET / POST /api/model-settings - never server.js), modelswap.js on the page, the .tmp not in git",
  /require\("\.\/modelSettings"\)\.mount\(app\)/.test(IX) && /<script src="\/static\/modelswap\.js">/.test(H) && /^model_settings\.tmp$/m.test(GI) && !/model-settings/.test(fs.readFileSync(path.join(ROOT, "misc", "server.js"), "utf8")));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
