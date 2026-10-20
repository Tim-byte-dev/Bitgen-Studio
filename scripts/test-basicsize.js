#!/usr/bin/env node
/* bitGen Studio — 2.357.0: BOARD RENDERS USE THE LEFT BASIC SETTINGS' SIZE.
 * Run: node scripts/test-basicsize.js
 * Tim: "does the native audio use the basic settings in the left docker? I would like to be able to change
 * the resolution, i am still getting major degradation".
 *   1. lib/renderSettings: basic_width/basic_height (16-px aligned, 256..2048), rememberBasic, the size
 *      priority in jobOverrides (⚙ Resolution > Basic Settings > the app default) and its notes;
 *   2. the wiring: the three render routes keep the size, the video dock sends it with ▶ / ↻ / render selected,
 *      the ⚙ Resolution's blank choice says Basic Settings. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const RS = require(path.join(ROOT, "lib", "renderSettings"));
const base = { width: 832, height: 480, style: { name: "x" } };

// ---- 1. the module
check("defaults: no Basic size kept (0 x 0)", RS.normalize({}).basic_width === 0 && RS.normalize({}).basic_height === 0);
check("basicPatch: 16-px aligned; out of range or one side missing -> nothing",
  JSON.stringify(RS.basicPatch({ width: "1281", height: 722 })) === JSON.stringify({ basic_width: 1280, basic_height: 720 })
  && !RS.basicPatch({ width: 100, height: 720 }).basic_width && !RS.basicPatch({ width: 1280 }).basic_width
  && !RS.basicPatch(null).basic_width && !RS.basicPatch({ width: 4096, height: 2160 }).basic_width);
let o = RS.jobOverrides({}, base);
check("nothing set: the app default size, and the note says where to change it",
  o.width === 832 && o.height === 480 && o.notes.some((n) => /832x480 \(the app default - set Resolution in the left Basic Settings/.test(n)), o.notes);
o = RS.jobOverrides({ basic_width: 1280, basic_height: 720 }, base);
check("Basic Settings 1280x720: the render is 1280x720, said", o.width === 1280 && o.height === 720
  && o.notes.includes("render size 1280x720 (Basic Settings, the left dock)"), o);
o = RS.jobOverrides({ basic_width: 1280, basic_height: 720, res: "1080", aspect: "16:9" }, base);
check("the ⚙ Resolution still wins (and says how to hand it back to Basic Settings)", o.width === 1936 && o.height === 1088
  && o.notes.some((n) => /the StoryBoard's ⚙ - set its Resolution to default to use Basic Settings/.test(n)), o);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsz_"));
RS.save(tmp, { steps: 12, upscaler: "x.safetensors" });
let r = RS.rememberBasic(tmp, { width: 1024, height: 576 });
check("rememberBasic keeps the size and the other ⚙ fields", r.basic_width === 1024 && r.basic_height === 576 && r.steps === 12
  && RS.read(tmp).basic_width === 1024 && RS.read(tmp).upscaler === "x.safetensors");
r = RS.rememberBasic(tmp, { width: "abc" });
check("a bad size keeps the last good one", r.basic_width === 1024 && RS.read(tmp).basic_height === 576);
RS.save(tmp, { res: "720" });
check("saving the ⚙ keeps the Basic size", RS.read(tmp).basic_width === 1024 && RS.read(tmp).res === "720");
fs.rmSync(tmp, { recursive: true, force: true });

// ---- 2. the wiring
const RC = fs.readFileSync(path.join(ROOT, "routes", "characters.js"), "utf8");
const keep = "if (b.basic) renderSettings.rememberBasic(core.projDir(b.project || core.getProject()), b.basic);";
check("routes: render selected, ▶ generate and ↻ redo keep the size before queueing (3x)", RC.split(keep).length - 1 === 3);
const VD = fs.readFileSync(path.join(ROOT, "ext", "videodock", "characters.js"), "utf8");
check("the video dock sends the left width x height with ▶ / ↻ / render selected",
  VD.includes('document.getElementById("width"), h = document.getElementById("height")')
  && (VD.match(/scWithBasic\(/g) || []).length >= 5 && VD.includes('scPost("/api/scenes/render", scWithBasic({ scenes: ns }))'));
const DH = fs.readFileSync(path.join(ROOT, "ext", "videodock", "dock.html"), "utf8");
check("the ⚙ Resolution's blank choice reads Basic Settings", DH.includes('<option value="">Basic Settings</option><option value="480">480p</option>'));

// ---- 3. jsdom: the helper reads the left fields
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<body><input id="width" value="1280"><input id="height" value="720"></body>', { runScripts: "outside-only" });
const fn = VD.slice(VD.indexOf("function scBasic()"), VD.indexOf("function scPost("));
dom.window.eval(fn + "; window.__r = scWithBasic({ scenes: [1] });");
check("jsdom: scWithBasic adds basic {1280, 720} to the body", JSON.stringify(dom.window.__r) === JSON.stringify({ scenes: [1], basic: { width: 1280, height: 720 } }), dom.window.__r);

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
