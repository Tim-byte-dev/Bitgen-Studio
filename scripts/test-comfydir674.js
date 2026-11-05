#!/usr/bin/env node
/* bitGen Studio — 2.674.0: ONE ComfyUI FOLDER FOR EVERYTHING when Settings ▸ ComfyUI ▸ Folder is empty (lib/comfy.js
 * discoveredDir / detectedDir / comfyCfg; lib/aiFillAddon.js place - every add-on; lib/setupRun.js modelPaths - the model
 * catalog; lib/comfyDetect.js detect - the model lists).
 * Tim (verbatim): "i think i know what the issue might be - when installing i set the comfyui folder to "" instead of comfy/
 * so i think the workflows might be looking in comfy/comfyui instead of the new location comfyui/" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const C = require(path.join(ROOT, "lib", "comfy.js"));
const w = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, ""); if (t) fs.utimesSync(p, t, t); };
const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "bgdir674-"));
const old = new Date("2026-01-01"), now = new Date();

let b = mk(); w(path.join(b, "ComfyUI", "main.py")); fs.mkdirSync(path.join(b, "ComfyUI", "comfy"));
check("Tim's install: a ComfyUI\\ beside the app (no comfy\\) is found - not nothing", C.discoveredDir(b) === "ComfyUI", C.discoveredDir(b));
fs.rmSync(b, { recursive: true, force: true });

b = mk(); w(path.join(b, "comfy", "ComfyUI", "main.py"), old); w(path.join(b, "ComfyUI", "main.py"), now);
check("an old comfy\\ComfyUI AND a new ComfyUI\\: the most recently updated one (ComfyUI\\)", C.discoveredDir(b) === "ComfyUI", C.discoveredDir(b));
fs.utimesSync(path.join(b, "comfy", "ComfyUI", "main.py"), now, now); fs.utimesSync(path.join(b, "ComfyUI", "main.py"), old, old);
check("…and the other way round: comfy\\ComfyUI updated last = that one", C.discoveredDir(b) === "comfy/ComfyUI", C.discoveredDir(b));
fs.rmSync(b, { recursive: true, force: true });

b = mk(); w(path.join(b, "ComfyUI_windows_portable", "python_embeded", "python.exe")); w(path.join(b, "ComfyUI_windows_portable", "ComfyUI", "main.py"));
check("a portable build beside the app: its top folder (python_embeded launches it)", C.discoveredDir(b) === "ComfyUI_windows_portable", C.discoveredDir(b));
fs.rmSync(b, { recursive: true, force: true });

b = mk(); w(path.join(b, "comfy", "python_embeded", "python.exe")); w(path.join(b, "comfy", "ComfyUI", "main.py"));
check("bitGen's own comfy\\ (portable) as before", C.discoveredDir(b) === "comfy");
fs.rmSync(b, { recursive: true, force: true });

const SRC = read("lib/comfy.js"), AF = read("lib/aiFillAddon.js"), SR = read("lib/setupRun.js"), CD = read("lib/comfyDetect.js");
check("comfyCfg: the Settings folder, else beside the app, else what comfyDetect finds (not ComfyUI Desktop)", /dir: c\.dir \|\| discoveredDir\(\) \|\| detectedDir\(\)/.test(SRC) && /d\.kind === "desktop"\) return ""/.test(SRC));
check("every add-on (aiFillAddon.place) and the model catalog (setupRun.modelPaths) take comfyCfg's folder - never a guess at comfy\\",
  /require\("\.\/comfy"\)\.comfyCfg\(\)\.dir/.test(AF) && /require\("\.\/comfy"\)\.comfyCfg\(\)\.dir/.test(SR));
check("the model lists (comfyDetect) look beside the app first, picked the way the launcher picks", /require\("\.\/comfy"\)\.discoveredDir\(app\)/.test(CD));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
