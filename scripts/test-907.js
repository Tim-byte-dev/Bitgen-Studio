#!/usr/bin/env node
// bitGen Studio 2.907.0 - "every video i tried only renders 16:9": a social Format of another orientation than the
// render asked no longer cuts the take to a band (lib/socialFormat.js shapeFor), Aspect picked by hand moves a fixed
// social Format to "the render's own shape" (static/socialfmt.js afterAspect), Override style ON keeps Basic Settings'
// size on a style pick (static/index.html inheritVideoStyle), the gallery shows a take's true shape.
// Run: node scripts/test-907.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 300)); } };

const SF = require("../lib/socialFormat");
let r = SF.shapeFor("16:9", 544, 960);
check("shapeFor: a 9:16 render with Format 16:9 keeps its own shape", r.aspect === "source" && /544x960 \(portrait\)/.test(r.note), r);
r = SF.shapeFor("16:9", 1280, 720);
check("shapeFor: a 16:9 render with Format 16:9 is cut to 16:9", r.aspect === "16:9" && !r.note, r);
r = SF.shapeFor("16:9", 960, 720);
check("shapeFor: 4:3 -> 16:9 (both landscape) is still cut as asked", r.aspect === "16:9", r);
r = SF.shapeFor("4:5", 720, 960);
check("shapeFor: the feed's 4:5 from its 3:4 render", r.aspect === "4:5", r);
r = SF.shapeFor("1:1", 544, 960);
check("shapeFor: a portrait render with Format square keeps its shape", r.aspect === "source", r);
r = SF.shapeFor("9:16", 1280, 720);
check("shapeFor: a landscape render with Format 9:16 keeps its shape", r.aspect === "source", r);
check("shapeFor: no size -> the Format's shape", SF.shapeFor("16:9", 0, 0).aspect === "16:9");
check("shapeFor: source stays source", SF.shapeFor("source", 544, 960).aspect === "source");

const SFM = require("../static/socialfmt.js");
check("afterAspect: Format 16:9 + Aspect 9:16 -> the render's own shape", SFM.afterAspect("social_16x9", "9:16") === "social");
check("afterAspect: Format 16:9 + Aspect 16:9 -> kept", SFM.afterAspect("social_16x9", "16:9") === "");
check("afterAspect: the feed's 4:5 + its 3:4 -> kept", SFM.afterAspect("social_4x5", "3:4") === "");
check("afterAspect: a plain mp4 -> kept", SFM.afterAspect("mp4", "9:16") === "" && SFM.afterAspect("social", "9:16") === "");

const html = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
const inh = html.slice(html.indexOf("function inheritVideoStyle(st)"), html.indexOf("function inheritVideoStyle(st)") + 1400);
check("inheritVideoStyle: Override style on returns before the style's res / aspect", /ovrStyleOn\(\)\) \{[\s\S]*?return;\s*\}\s*if \(st\.res/.test(inh), inh.slice(0, 400));
check("submitJob logs the size it sends", /\[generate\] Basic Settings: \$\{\$\("width"\)\.value\}x\$\{\$\("height"\)\.value\}/.test(html));
check("gallery thumbnails show the whole take (contain, not cover)", /\.thumb video \{[^}]*object-fit: contain/.test(html));
const sfj = fs.readFileSync(path.join(ROOT, "static", "socialfmt.js"), "utf8");
check("socialfmt.js listens to Aspect", /\$\("arSel"\)\.addEventListener\("change", onAspect\)/.test(sfj));
const sfl = fs.readFileSync(path.join(ROOT, "lib", "socialFormat.js"), "utf8");
check("socialFormat.apply runs shapeFor on the job's size", /shapeFor\(soc\.aspect, pr\._req_w \|\| pr\.width, pr\._req_h \|\| pr\.height\)/.test(sfl));
// the 2.902 lesson: no // comment inside an expression in the files touched
for (const f of ["static/socialfmt.js", "lib/socialFormat.js"]) {
  const bad = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").filter((l) => /[,(+]\s*\/\/ /.test(l) && !/^\s*\/\//.test(l));
  check(`${f}: no // comment mid-expression`, !bad.length, bad);
}
// social.py's frame for a 544x960 render: its own shape stays portrait, "16:9" was the band Tim got
{
  const { spawnSync } = require("child_process");
  const py = ["python3", "python"].find((x) => spawnSync(x, ["-c", "print(1)"]).status === 0);
  const t = py ? spawnSync(py, ["-c", "import sys; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + "); import social as S; print(S.target(544,960,'source'), S.target(544,960,'16:9'))"], { encoding: "utf8" }) : null;
  const m = t && String(t.stdout || "").match(/\((\d+), (\d+)\) \((\d+), (\d+)\)/);
  check("social.py: a 544x960 render in its own shape stays portrait; cut to 16:9 it was a landscape band", m && +m[2] > +m[1] && +m[3] > +m[4], t && (t.stdout || t.stderr));
}
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
