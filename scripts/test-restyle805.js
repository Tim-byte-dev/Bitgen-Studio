#!/usr/bin/env node
/* bitGen Studio — 2.805.0 units: the image preview's style dropdown + ☐ Basic Settings beside 🎨 Change style (static/lbrestyle.js).
 * Tim (verbatim): "in preview dialog add a style dropdown next to the change style button, add a checkbox next to it to use basic
 * settings. use the last basic settings the style used to change the style of the preview picture (show change style dropdown ,
 * button and the new button and new dropdown only when in picture mode". Pure + source pins. */
"use strict";
const path = require("path"), fs = require("fs");
const R = require("../static/lbrestyle.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = fs.readFileSync(path.join(__dirname, "..", "static", "lbrestyle.js"), "utf8");

const kept = { imgSteps: "23", imgCfg: "4.5", imgSeed: "77", imgCkpt: "checkpoints/juggernautXL_v9.safetensors", ovrStyle: true, imgW: "1024" };
const a = R.ovrFromBasic(kept);
check("ovrFromBasic: steps, CFG, checkpoint (numbers), the seed beside them", a.ovr.steps === 23 && a.ovr.cfg === 4.5 && a.ovr.model === "checkpoints/juggernautXL_v9.safetensors" && a.seed === 77 && Object.keys(a.ovr).length === 3, a);
check("…said in words for the tooltip", a.words === "23 steps, CFG 4.5, juggernautXL_v9.safetensors, seed 77", a.words);
const b = R.ovrFromBasic(kept, false);
check("Use model unticked = the style's own checkpoint (no model)", b.ovr.model === undefined && b.ovr.steps === 23, b);
const c = R.ovrFromBasic({ imgSteps: "", imgCfg: "", imgCkpt: "  ", imgSeed: "-1" });
check("empty fields send nothing; seed -1 = random (not sent as a seed)", Object.keys(c.ovr).length === 0 && c.seed === -1 && c.words === "random seed", c);
check("no kept settings at all -> nothing", Object.keys(R.ovrFromBasic(null).ovr).length === 0 && R.ovrFromBasic(null).seed === null);

const opts = [{ id: "s1", name: "Illustrious" }, { id: "s2", name: "FLUX.2 Klein edit" }];
const prompt = { id: "s1", name: "Illustrious" };
check("styleFor: \"\" = the prompt's style (own)", JSON.stringify(R.styleFor("", opts, prompt)) === JSON.stringify({ id: "s1", name: "Illustrious", own: true }));
check("styleFor: a picked style", JSON.stringify(R.styleFor("s2", opts, prompt)) === JSON.stringify({ id: "s2", name: "FLUX.2 Klein edit", own: false }));
check("styleFor: the prompt's style picked by name is still 'own' (its live Basic Settings)", R.styleFor("s1", opts, prompt).own === true);
check("styleFor: a style no longer listed = the prompt's", R.styleFor("gone", opts, prompt).id === "s1");

check("pins: the new controls (#lb_rsstyle, #lb_rsbasic in #lb_rsbasicw) go after 🎨 Change style, kept in localStorage",
  /insertBefore\(b, save\); save\.parentNode\.insertBefore\(ss, save\); save\.parentNode\.insertBefore\(cw, save\)/.test(src) && /h3\.restyle\.style/.test(src) && /h3\.restyle\.basic/.test(src));
check("pins: the render uses the chosen style and its kept Basic Settings (basic_settings.tmp's image:<id>, the live ones for the prompt's)",
  /const st = chosen\(\); if \(!st\.id\)/.test(src) && /"image:" \+ st\.id/.test(src) && /st\.own && BC && BC\.collect/.test(src) && /const o = ovrBody\(st\)/.test(src));
check("pins: shown only while a picture is shown - the look, the button, the style, the tick, the message",
  /\["lb_rslook", "lb_restyle", "lb_rsstyle", "lb_rsbasicw", "lb_rsmsg"\]/.test(src) && /attributeFilter: \["open"\]/.test(src));
check("pins: Override style no longer decides here (the tick does)", !/ovrStyleOn/.test(src.split("if (typeof module")[1] || "") && /const ovrOn = \(\) => \{ const c = \$\("lb_rsbasic"\)/.test(src));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
