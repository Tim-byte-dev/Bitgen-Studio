#!/usr/bin/env node
/* bitGen Studio — 2.453.0 units: FRAMES LIKE CORELDRAW'S POWERCLIP (pcframes.js + pchandles.js wiring): contents locked
 * to their frame (the Move tool and its handles take the frame), the canvas right-click menu, the double-click left to
 * the rotate handles, the frame's contents carried by the handles' drag. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const FR = read("ext", "imageeditdock", "pcframes.js"), HD = read("ext", "imageeditdock", "pchandles.js");
const F = require(path.join(ROOT, "ext", "imageeditdock", "pcframes.js"));
// frameOf / underFrame drive "locked": a layer inside a frame inside a frame belongs to both
const Ls = [{ id: 1, type: "shape", frame: {}, parent: null }, { id: 2, type: "shape", frame: {}, parent: 1 }, { id: 3, type: "pixel", parent: 2 }];
check("frameOf / underFrame: a layer inside a frame inside a frame - its frame, and both above it", F.frameOf(Ls, Ls[2]) === 2 && F.frameOf(Ls, Ls[1]) === 1 && !!F.underFrame(Ls, Ls[2], 1));
check("LOCKED: owner(L) = the outermost locked frame holding L (not while that frame is being edited); the Move tool's pointerdown (capture) makes it the active layer",
  /const owner = \(L\) =>/.test(FR) && /F\.frame && F\.frame\.lock !== false && S\.frameEdit !== F\.id\) top = F/.test(FR) && /const o = owner\(A\(\)\); if \(o\) \{ E\.setActive/.test(FR));
check("RIGHT-CLICK on the canvas: the layer there picked, Edit Frame Contents / Extract / Lock (+ Duplicate / Delete); Finish Editing Frame first while editing; Place Inside Frame… otherwise",
  /addEventListener\("contextmenu"/.test(FR) && /items\.push\("frame\.finish", sep, "frame\.extract", "frame\.lock"\)/.test(FR) && /items\.push\("frame\.edit", "frame\.extract", "frame\.lock"\)/.test(FR) && /items\.push\("frame\.place"\)/.test(FR) && /E\.ui\.menuAt\(items/.test(FR));
check("the double-click no longer enters editing (it is the Move tool's rotate handles - 2.452.0)", !/addEventListener\("dblclick"[\s\S]{0,200}edit\(F\)/.test(FR));
check("the handles: a locked layer's frame is the target; dragging a frame carries its contents (hidden, drawn clipped to it), applied through the frame (FOLLOW moves them in the same undo step)",
  /E\.frames\.owner\(L\); if \(o\) L = o;/.test(HD) && /E\.frames\.kidsOf\(L\)/.test(HD) && /g\.clip\("evenodd"\)/.test(HD) && /owner, kidsOf \}/.test(FR));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
