#!/usr/bin/env node
/* bitGen Studio — 2.633.0 (pure + wiring): THE SKETCHER'S ROTATE RINGS (YAW / PITCH / ROLL) FOR CAMERAS AND FURNITURE, THEIR
 * INPUTS, A CAMERA'S LENS PRESETS (FISHEYE … 200 mm), FOCAL LENGTH <-> FIELD OF VIEW. (ext/pushpulldock/ppcam.js, ppfurn.js,
 * pparch.js, pparchview.js, pparchtools.js)
 * Tim: "can you add interactive rotate , roll,yaw,pitch for camera and furniture, add the inputs to it's properties, include fov ,
 * lense, 35mm,50mm,200mm, fisheye,wide angle etc." */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
globalThis.polygonClipping = require(path.join(R0, "static", "vendor", "polygon-clipping.umd.min.js"));
globalThis.H3HouseGeo = require(path.join(R0, "static", "housegeo.js"));
globalThis.PPFurn = require(path.join(R0, "ext", "pushpulldock", "ppfurn.js"));
globalThis.PPCam = require(path.join(R0, "ext", "pushpulldock", "ppcam.js"));
const C = globalThis.PPCam, F = globalThis.PPFurn, P = require(path.join(R0, "ext", "pushpulldock", "pparch.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* lenses */
const keys = C.LENSES.map((l) => l[0]);
check("the lens presets: Fisheye, Ultra wide, Wide angle, 35, 50, 85, 135, 200 mm", ["fisheye", "ultrawide", "wide", "35", "50", "85", "135", "200"].every((k) => keys.includes(k)) && C.LENSES.find((l) => l[0] === "200")[2] === 200, keys);
check("focal length -> field of view (full frame, up-down): 50 mm = 27°, 35 mm = 37.8°, 200 mm = 6.9°, 8 mm = 112.6°; clamped 3..140", C.fovOf(50) === 27 && C.fovOf(35) === 37.8 && C.fovOf(200) === 6.9 && C.fovOf(8) === 112.6 && C.fovOf(1) === 140 && C.fovOf(5000) === 3, [C.fovOf(50), C.fovOf(35), C.fovOf(200), C.fovOf(8)]);
check("field of view -> focal length (round trip) and the preset it is (else custom)", near(C.mmOf(27), 50, 0.6) && near(C.mmOf(C.fovOf(85)), 85, 0.6) && C.lensOf(50) === "50" && C.lensOf(8.2) === "fisheye" && C.lensOf(70) === "custom", [C.mmOf(27), C.lensOf(70)]);

/* frame / roll */
const c0 = { x: 0, y: 0, z: 1.6, yaw: 0, pitch: 0, roll: 0, fov: 60 };
let f = C.frame(c0);
check("a camera's frame: looking +x, right = -y, up = +z (no roll)", near(f.d[0], 1) && near(f.rt[1], -1) && near(f.up[2], 1), f);
f = C.frame(Object.assign({}, c0, { roll: 90 }));
check("roll 90° (right-handed about its looking way): its up turns to -y, its right to -z (seen looking +x: turned anticlockwise)", near(f.up[1], -1) && near(f.rt[2], -1) && near(dot(f.d, f.up), 0), f);
f = C.frame(Object.assign({}, c0, { roll: 30 }));
check("…roll keeps the looking way and a square frame", near(f.d[0], 1) && near(dot(f.rt, f.up), 0) && near(Math.hypot(...f.up), 1), f);
const fr = C.frustum(Object.assign({}, c0, { roll: 90 }));
check("the glyph turns with its roll (its picture plane's long side upright)", fr.length === 8 && Math.abs(fr[4][1][2] - fr[4][0][2]) > Math.abs(fr[4][1][1] - fr[4][0][1]) || Math.abs(fr[5][1][2] - fr[5][0][2]) > Math.abs(fr[5][1][1] - fr[5][0][1]));
const cl = C.clean([{ x: 0, y: 0, z: 1, yaw: 0, pitch: 200, roll: 999, fov: 1 }])[0];
check("clean: pitch ±89, roll ±180, field of view 3..140", cl.pitch === 89 && cl.roll === 180 && cl.fov === 3, cl);

/* rings */
let R = C.rings("cam", Object.assign({}, c0, { yaw: 90 }));
check("a camera's rings: yaw about +z, pitch about its right, roll about its looking way - 48 points each, 0.5 m round its eye", R.rings.map((r) => r.key).join() === "yaw,pitch,roll" && R.rings.every((r) => r.pts.length === 48 && r.pts.every((q) => near(Math.hypot(q[0] - 0, q[1] - 0, q[2] - 1.6), 0.5))) && near(R.rings[2].axis[1], -1) && near(R.rings[0].axis[2], 1), R.rings.map((r) => r.axis));
check("…each ring lies across its axis", R.rings.every((r) => r.pts.every((q) => near(dot([q[0], q[1], q[2] - 1.6], r.axis), 0))));
const it = Object.assign(F.make("armchair", [5, 2], 0, 90), { id: 1 });
R = C.rings("item", it);
check("a piece's rings: round its middle, a bit bigger than it; pitch about its side, roll about its front (turned with it)", near(R.c[2], it.h / 2) && R.r > Math.max(it.w, it.d, it.h) / 2 && near(Math.abs(R.rings[1].axis[1]), 1) && near(Math.abs(R.rings[2].axis[0]), 1), R);

/* turnBy */
let o = C.turnBy(Object.assign({}, c0), "yaw", 90, "cam");
check("turnBy yaw +90° (right-handed = anticlockwise from above) = yaw 270 (yaw is clockwise)", o.yaw === 270, o);
o = C.turnBy(Object.assign({}, c0, { pitch: 80 }), "pitch", 30, "cam");
check("…a camera's pitch stops at 89°", o.pitch === 89, o);
o = C.turnBy(Object.assign({}, c0, { roll: 170 }), "roll", 20, "cam");
check("…roll wraps (170 + 20 = -170)", o.roll === -170, o);
const i2 = C.turnBy(Object.assign({}, it), "yaw", -90, "item");
check("…a piece's yaw is its Turn (rot): -90° = 90 more clockwise", i2.rot === 180, i2);
const i3 = C.turnBy(Object.assign({}, it, { pitch: 170 }), "pitch", 30, "item");
check("…a piece's pitch wraps (it can tip right over)", i3.pitch === -160, i3);

/* furniture keeps pitch / roll */
const A = P.clean({ items: [Object.assign({}, it, { pitch: 15, roll: -10 })], cams: [{ x: 9, y: 9, z: 1.6, roll: 25, fov: 27 }] });
check("kept with the building: a piece's pitch / roll, a camera's roll", A.items[0].pitch === 15 && A.items[0].roll === -10 && A.cams[0].roll === 25, { i: A.items[0], c: A.cams[0] });
const bb = P.bbox(A);
check("zoom extents takes the cameras in (the box reaches past a camera)", bb && bb.max[0] >= 9.5 && bb.max[1] >= 9.5, bb);

/* wiring */
const furn = read("ext/pushpulldock/ppfurn.js"), view = read("ext/pushpulldock/pparchview.js"), tools = read("ext/pushpulldock/pparchtools.js"), help = read("static/help/pushpull.html");
check("3D: a piece turns Z, then X (pitch), then Y (roll)", /rotation\.order = "ZXY"/.test(furn) && /rotation\.x = \(it\.pitch/.test(furn) && /rotation\.y = \(it\.roll/.test(furn));
check("the rings drawn on the picked camera / piece (blue yaw, red pitch, green roll - over everything)", /RING_COL/.test(view) && /userData\.ring/.test(view) && /rings\(A\.sel/.test(view));
check("dragging a ring: picked first, followed in its own plane (screen angle when edge-on), 5° steps / Shift free, Ctrl+Z", /function ringAt/.test(tools) && /function ringAngle/.test(tools) && /mode: "spin"/.test(tools) && /function dragSpin/.test(tools) && /Math\.round\(rh \/ 5\) \* 5/.test(tools));
check("the panels: a camera's Turn (yaw) / Tilt (pitch) / Roll / Lens / Focal length / Field of view; a piece's Turn (yaw) / Pitch / Roll", /"Roll"/.test(tools) && /"Lens"/.test(tools) && /"Focal length"/.test(tools) && /"Field of view"/.test(tools) && /"Tilt \(pitch\)"/.test(tools) && /numIn\("Pitch", it\.pitch/.test(tools));
check("looking through a camera keeps its roll", /rotateZ\(-\(c\.roll/.test(tools));
check("the help page tells it (rings, Roll, Lens, Focal length, Field of view, fisheye)", /ring/i.test(help) && /Roll/.test(help) && /Focal length/.test(help) && /Field of view/.test(help) && /[Ff]isheye/.test(help));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
