#!/usr/bin/env node
/* bitGen Studio — 2.375.0: Basic Settings' Override style reaches the video docker's renders.
 * Run: node scripts/test-basicoverride.js
 * Tim: "i don't think the overide style in basic settings is working for video generation - i set it to 15 steps
 * but it is still rendering 20 steps".
 * The board ▶ sent only Basic Settings' SIZE; Steps / CFG / Override style never left the page, so a scene rendered
 * the ⚙'s count or the workflow's 20. Now:
 *   1. the page: scBasic() sends override + steps + cfg with every board ▶;
 *   2. lib/renderSettings: basicPatch / rememberBasic keep them (with or without a usable size);
 *   3. jobOverrides: Override ON + Steps > 0 -> Basic's steps (over the ⚙ and the workflow), its CFG too, said in
 *      the notes; OFF (or Steps on auto) -> the ⚙, else the workflow's own, the note says how to override. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const rs = require(path.join(ROOT, "lib", "renderSettings"));

// 1
const CH = fs.readFileSync(path.join(ROOT, "ext", "videodock", "characters.js"), "utf8");
const fn = CH.slice(CH.indexOf("function scBasic()"), CH.indexOf("function scWithBasic("));
check("the board ▶ sends Override style + Steps + CFG with the size",
  /getElementById\("ovrStyle"\)/.test(fn) && /out\.override = !!ov\.checked/.test(fn)
  && /out\.steps = stp \? parseInt\(stp\.value, 10\) \|\| 0 : 0/.test(fn) && /out\.cfg = /.test(fn));
// run it against a fake DOM
{
  const doc = { els: { width: { value: "1280" }, height: { value: "720" }, ovrStyle: { checked: true },
                       steps: { value: "15" }, cfg: { value: "1.5" } },
                getElementById(id) { return this.els[id] || null; } };
  const scBasic = new Function("document", fn + "\nreturn scBasic();");
  const b = scBasic(doc);
  check("...the values it sends", b.width === 1280 && b.height === 720 && b.override === true && b.steps === 15 && b.cfg === 1.5, b);
  doc.els.ovrStyle.checked = false; doc.els.steps.value = "0";
  const b2 = scBasic(doc);
  check("...override off, Steps on auto", b2.override === false && b2.steps === 0, b2);
}

// 2
check("basicPatch keeps override / steps / cfg (and the size)",
  JSON.stringify(rs.basicPatch({ width: 1280, height: 720, override: true, steps: 15, cfg: 1 }))
  === JSON.stringify({ basic_width: 1280, basic_height: 720, basic_override: true, basic_steps: 15, basic_cfg: 1, basic_model: "" }));   // 2.409.0: + the model (none sent = cleared)
check("...a size out of range drops only the size; junk steps / cfg = auto",
  JSON.stringify(rs.basicPatch({ width: 100, height: 50, override: true, steps: "abc", cfg: 99 }))
  === JSON.stringify({ basic_override: true, basic_steps: 0, basic_cfg: null, basic_model: "" }));
check("...an old page (size only) leaves the override fields alone", !("basic_override" in rs.basicPatch({ width: 1280, height: 720 })));
const D = fs.mkdtempSync(path.join(os.tmpdir(), "bo375_"));
rs.save(D, { steps: 6 });
rs.rememberBasic(D, { width: 100, height: 100, override: true, steps: 15, cfg: 1 });
let rec = rs.read(D);
check("rememberBasic: kept even without a usable size; the ⚙ untouched",
  rec.basic_override === true && rec.basic_steps === 15 && rec.basic_cfg === 1 && rec.steps === 6, rec);

// 3
let j = rs.jobOverrides(rec, { width: 1280, height: 720 });
check("Override ON: Basic's 15 steps beat the ⚙'s 6, the note says so", j.steps === 15
  && j.notes.includes("steps 15 (Basic Settings - Override style is on; the StoryBoard's ⚙ says 6)"), j.notes);
check("...its CFG too", j.cfg === 1 && j.notes.some((n) => /cfg 1 \(Basic Settings - Override style/.test(n)));
rs.rememberBasic(D, { override: false, steps: 15, cfg: 3 });
j = rs.jobOverrides(rs.read(D), {});
check("Override OFF: the ⚙ rules (6), cfg the default 1", j.steps === 6 && j.cfg === 1 && j.notes.includes("steps 6 (the StoryBoard's ⚙)"), j);
rs.save(D, { steps: null });
j = rs.jobOverrides(rs.read(D), {});
check("...no ⚙ steps: the workflow's own, the note says how to override", j.steps === 0
  && j.notes.includes("steps: the workflow's own (tick Override style in Basic Settings to use its Steps)"), j.notes);
rs.rememberBasic(D, { override: true, steps: 0, cfg: 1 });
j = rs.jobOverrides(rs.read(D), {});
check("Override ON with Steps on auto: the workflow's own count", j.steps === 0
  && j.notes.includes("steps: the workflow's own (Basic Settings Steps is on auto)"), j.notes);
fs.rmSync(D, { recursive: true, force: true });

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
