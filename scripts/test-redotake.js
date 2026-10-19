#!/usr/bin/env node
/* bitGen Studio — 2.307.0: ↻ REDO ON A RENDERED SCENE, NEW TAKES AS scene_<n>_<x>.
 * Run: node scripts/test-redotake.js
 *
 * Tim (verbatim): "after a scene renders, change the play button to redo,
 * rerun the render as scene_n_x".
 *   1. lib/scenes.takeName: the first take keeps its scene name, every later
 *      take is scene_<n>_<x> (x = one past the highest there; a gap is not
 *      refilled while a later take exists; other scenes' takes don't count);
 *   2. recordRender files a second take as scene_<n>_2 (never "scene<n> (2)"),
 *      leaves the first take in Video assets, and its lossless master follows
 *      the new name;
 *   3. wiring: the card's button, the redo route's base check.
 * The card itself runs in scripts/test-sceneui.js (↻ / ▶ / ⏳, redo post). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const S = require(path.join(ROOT, "lib", "scenes"));

// ---- 1. takeName -------------------------------------------------------------------
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "rt-"));
  try {
    const t = () => S.takeName(d, 7, "", ".mp4");
    const put = (n) => fs.writeFileSync(path.join(d, n), "x");
    const a = t(); put("scene7.mp4");
    const b = t(); put("scene_7_2.mp4");
    const c = t();
    check("the first take keeps the scene name, the next ones are scene_7_2, scene_7_3",
      a === "scene7.mp4" && b === "scene_7_2.mp4" && c === "scene_7_3.mp4", [a, b, c]);
    put("scene_7_5.webm");
    check("...x follows the HIGHEST take there, whatever its extension (a deleted _3/_4 is not refilled)",
      t() === "scene_7_6.mp4", t());
    put("scene_17_9.mp4"); put("scene_1_12.mp4");
    check("...other scenes' takes never count (scene_17_*, scene_1_*)", t() === "scene_7_6.mp4", t());
    check("...a chaptered first take keeps its chapter; its redo is scene_<n>_<x>",
      S.takeName(d, 3, "Act One", ".mp4") === "scene3_Act_One.mp4"
      && (put("scene3_Act_One.mp4"), S.takeName(d, 3, "Act One", ".mp4") === "scene_3_2.mp4"),
      S.takeName(d, 3, "Act One", ".mp4"));
    check("...an unrendered scene in a folder of other takes starts at its scene name",
      S.takeName(d, 9, "", ".mp4") === "scene9.mp4");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

// ---- 2. recordRender -----------------------------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path");
const core = require("./lib/core"), S = require("./lib/scenes");
const P = "e2e_rt307";
const root = core.projDir(P);
const out = {};
try {
  fs.mkdirSync(path.join(root, "raw"), { recursive: true });
  const tmp = path.join(root, "worker_out"); fs.mkdirSync(tmp, { recursive: true });
  let st = S.safe({ list: [{ n: 2, id: "c2", prompt: ["x"], status: "running", job: "j1" }] });
  const w1 = path.join(tmp, "20260925-100000_aa.mp4"); fs.writeFileSync(w1, "TAKE1");
  let r = S.recordRender(st, 2, w1, P); st = r.state; out.first = r.name;
  st = S.redo(st, 2).state;
  const w2 = path.join(tmp, "20260925-110000_bb.mp4"); fs.writeFileSync(w2, "TAKE2");
  fs.writeFileSync(path.join(root, "raw", "20260925-110000_bb.avi"), "MASTER2");
  r = S.recordRender(st, 2, w2, P); st = r.state; out.second = r.name;
  const w3 = path.join(tmp, "20260925-120000_cc.mp4"); fs.writeFileSync(w3, "TAKE3");
  r = S.recordRender(S.redo(st, 2).state, 2, w3, P); out.third = r.name; out.output = S.at(r.state, 2).output;
  const vid = path.join(root, "video");
  out.files = fs.readdirSync(vid).sort();
  out.content = fs.readFileSync(path.join(vid, "scene_2_2.mp4"), "utf8");
  out.master = fs.existsSync(path.join(root, "raw", "scene_2_2.avi")) && fs.readFileSync(path.join(root, "raw", "scene_2_2.avi"), "utf8");
} catch (e) { out.error = String(e.stack || e).slice(0, 500); }
finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log("@@RT " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = require("child_process").execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@RT ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 500) }; }
  check("recordRender: take 1 = scene2.mp4, the redo = scene_2_2.mp4, the next = scene_2_3.mp4 - the scene shows the newest",
    d && d.first === "scene2.mp4" && d.second === "scene_2_2.mp4" && d.third === "scene_2_3.mp4" && d.output === "scene_2_3.mp4", d);
  check("...every take stays in Video assets (the redo never overwrites), the right content under the right name",
    d && JSON.stringify(d.files) === '["scene2.mp4","scene_2_2.mp4","scene_2_3.mp4"]' && d.content === "TAKE2", d && [d.files, d.content]);
  check("...the redo's lossless master follows it (raw/scene_2_2.avi)", d && d.master === "MASTER2", d && d.master);
}

// ---- 3. wiring -------------------------------------------------------------------------
{
  const CJ = read("ext", "videodock", "characters.js"), RC = read("routes", "characters.js"), SC = read("lib", "scenes.js");
  check("the card: ↻ once a scene has a take, ▶ before, ⏳ while running",
    CJ.includes('(r.status === "running" ? "⏳" : r.output ? "↻" : "▶")')
    && CJ.includes('var verb = r.output && r.status !== "running" ? "/redo" : "/generate";'));
  check("recordRender names through takeName (freeName only as a fallback)",
    SC.includes("const name = takeName(dir, n, r.chapter, path.extname(srcAbs))\n      || autoAssets.freeName("));
  check("the redo route makes the same base check ▶ makes, then re-renders",
    /app\.post\("\/api\/scenes\/:n\/redo"[\s\S]{0,950}ensureChainBase\(st\.style\)[\s\S]{0,300}scenes\.redo\(st, rec\.n\)/.test(RC));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
