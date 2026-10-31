#!/usr/bin/env node
/* bitGen Studio — 2.631.0 (wiring): THE SKETCHER'S VIEW ▾ LISTS ITS CAMERAS; PICKED = THE VIEW FROM IT.
 * Tim: "in sketcher view add camera n to the dropdown when a camera is added. show the view from the camera" */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const DK = read("ext/pushpulldock/ppdock.js"), TL = read("ext/pushpulldock/pparchtools.js"), AV = read("ext/pushpulldock/pparchview.js");
check("View ▾: an optgroup Cameras - 📷 <name> per camera (value cam:<id>), painted with the model's info (added / renamed / deleted)", /function paintViewSel/.test(DK) && /g\.label = "Cameras"/.test(DK) && /"cam:" \+ c\.id/.test(DK) && /function info\(\) \{\n    paintViewSel\(\);/.test(DK));
check("picked: lookThrough - its place, its way, its lens; the cameras' glyphs hidden; the dropdown shows it", /v\.startsWith\("cam:"\)/.test(DK) && /cam\.fov = c\.fov \|\| 60/.test(TL) && /camsShown\(false\)/.test(TL) && /function camsShown/.test(AV) && /onThrough: \(\) => paintViewSel\(\)/.test(DK));
check("left by the user's orbit / pan / zoom (controls start) or a standard view: the lens back, the glyphs shown", /function leaveThrough/.test(TL) && /V\.controls\.addEventListener\("start"/.test(TL) && /S\.T\.arch\.leaveThrough\(\)/.test(DK));
check("its panel's changes while looking through it: the view follows", /if \(through && through\.id === c\.id\) lookThrough\(c\)/.test(TL));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
