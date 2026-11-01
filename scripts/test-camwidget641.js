#!/usr/bin/env node
/* bitGen Studio — 2.641.0: THE SKETCHER'S CAMERA - no bounding box, picked by its eye, the 3D move widget (arrows), a
 * double-click = the rotate widget (rings), another object picked = the camera unpicked. The pure part (PPCam.moveAxes) +
 * the wiring in pparchview.js / pparchtools.js. The real clicks: scripts/test-ui641-ui.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require(path.join(ROOT, "ext/pushpulldock/ppcam.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const W = C.moveAxes({ x: 1, y: 2, z: 1.6, yaw: 30, pitch: 10, roll: 5 });
check("moveAxes: from the eye, three arrows x / y / z along the model's axes (not the camera's turn)", JSON.stringify(W.c) === "[1,2,1.6]" && W.axes.map((a) => a.key).join() === "x,y,z" && JSON.stringify(W.axes.map((a) => a.dir)) === "[[1,0,0],[0,1,0],[0,0,1]]" && W.len > 0.3, W);
const AV = read("ext/pushpulldock/pparchview.js"), AT = read("ext/pushpulldock/pparchtools.js");
check("view: the frustum lines are never picked (a three.js line picks within 1 m)", /ls\.raycast = \(\) => \{\};/.test(AV));
check("view: a camera is picked by its eye on screen (14 px) before anything else", /d < 14 && \(!best \|\| d < best\.d\)\) best = \{ d, g, p \}/.test(AV));
check("view: no bounding box round a picked camera", /else if \(t\.ak === "cam"\) return;/.test(AV) && !/t\.ak === "cam"\) camsG\.children\.forEach\(\(g\) => \{ if \(g\.userData\.tag\.id === t\.id\) box\.expandByObject/.test(AV));
check("view: the move widget (arrows) unless rotating; rings only when rotating; the body lit", /function moveWidget\(t, out\)/.test(AV) && /if \(t\.ak === "cam" && A\.gizmo !== "rotate"\) return;/.test(AV) && /function camColours\(\)/.test(AV));
check("tools: the arrows hit-tested (the eye itself = a free move), dragged along their axis", /function axisAt\(ev\)/.test(AT) && /mode: "axis"/.test(AT) && /function dragAxis\(ev, D\)/.test(AT) && /on the camera itself: a free move, not an arrow/.test(AT));
check("tools: a double-click on the camera (or its widget) = move <-> rotate", /gizmo = gizmo === "rotate" \? "move" : "rotate"/.test(AT));
check("tools: another thing picked = the widget back to move", /if \(!same\) gizmo = "move";/.test(AT));
check("tools: a camera's rings only in rotate mode", /if \(asel\.ak === "cam" && gizmo !== "rotate"\) return null;/.test(AT));

// 2.643.0: looking through the picked camera - its widget ahead of the eye (not in it), drags that follow the screen
const cw = { x: 0, y: 0, z: 1.6, yaw: 0, pitch: 0, roll: 0, fov: 60 }, wa = C.widgetAt(cw), dd = C.dir(cw);
const rel = [wa.c[0] - cw.x, wa.c[1] - cw.y, wa.c[2] - cw.z], ahead = rel[0] * dd[0] + rel[1] * dd[1] + rel[2] * dd[2];
check("2.643.0 widgetAt: 1.6 m ahead of the eye, a little below and to the right (no ring seen edge-on), smaller", Math.abs(ahead - 1.6) < 1e-9 && rel[2] < -0.3 && Math.abs(rel[1]) > 0.2 && wa.r < 0.5 && wa.len < 0.6, wa);
check("2.643.0 moveAxes / rings take that place", JSON.stringify(C.moveAxes(cw, wa).c) === JSON.stringify(wa.c) && JSON.stringify(C.rings("cam", cw, wa).c) === JSON.stringify(wa.c) && C.rings("cam", cw, wa).r === wa.r);
check("2.643.0 wiring: the view draws it there while looking through (setThrough), the tools hit-test it there, screen-based axis drags, no ray-plane turn",
  /function setThrough\(id\)/.test(AV) && /A\.through === t\.id \? root\.PPCam\.widgetAt\(o\)/.test(AV) && /const widgetOf = \(o\) =>/.test(AT) && /st\.drag\.scr = \{ ux/.test(AT) && /AV\(\)\.setThrough\(c\.id\)/.test(AT) && /AV\(\)\.setThrough\(null\)/.test(AT));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
