#!/usr/bin/env node
/* bitGen Studio — 2.510.0 unit tests: 🧊 2D LAYERS IN 3D - cards, the 3D camera, depth of field, shadows
 * (ext/timelinedock/tl3d.js). Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 4: 2D layers in 3D). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const T = require(path.join(ROOT, "ext", "timelinedock", "tl3d.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const W = 640, H = 360;

check("clean / live: a card with depth and turns; off = not 3D", T.live({ d3: { z: 5 } }) && !T.live({ d3: { on: false } }) && !T.live({}) && T.clean({ z: "x", rx: 99999 }).z === 0 && T.clean({ rx: 99999 }).rx === 36000);
const cam = T.camClean({});
check("the default camera: at z -1000 looking ahead, zoom 1000 (a card at z 0 = its 2D place and size)", cam.z === -1000 && cam.zoom === 1000 && !cam.dof && !cam.light);
const pl = T.plane(T.clean({ z: 0 }), { cx: 420, cy: 130, w: 200, h: 100, rot: 0 }, W, H);
const corners = T.grid(pl, 1).map((P) => T.project(cam, W, H, P));
check("project: at z 0 with the default camera the card's corners land exactly on its 2D box",
  near(corners[0][0], 320) && near(corners[0][1], 80) && near(corners[3][0], 520) && near(corners[3][1], 180) && near(corners[0][2], 1000), corners);
const far = T.plane(T.clean({ z: 1000 }), { cx: 420, cy: 130, w: 200, h: 100, rot: 0 }, W, H), cf = T.grid(far, 1).map((P) => T.project(cam, W, H, P));
check("depth: at z 1000 (twice as far) the card is half its size, drawn towards the centre", near(cf[3][0] - cf[0][0], 100) && near(cf[3][1] - cf[0][1], 50) && near((cf[0][0] + cf[3][0]) / 2, 320 + 50), cf);
const R = T.rot(0, 90, 0), v = [R[0], R[3], R[6]];
check("rot: a 90° y-turn swings the card's x axis into depth", near(v[0], 0) && near(Math.abs(v[2]), 1));
const tilt = T.plane(T.clean({ rx: 60 }), { cx: 320, cy: 180, w: 200, h: 200, rot: 0 }, W, H), ct = T.grid(tilt, 1).map((P) => T.project(cam, W, H, P));
check("perspective: an x-turned card - its near edge wider than its far edge", Math.abs((ct[1][0] - ct[0][0]) - (ct[3][0] - ct[2][0])) > 10, ct);
const B = T.basis(T.camClean({ x: 1000, z: 0 }));
check("basis: a camera to the right aiming at the centre looks along -x, x-right stays level", near(B.f[0], -1) && near(B.d[1], 1) && near(B.r[2], 1), B);
const moved = T.project(T.camClean({ x: 100, tx: 100 }), W, H, [0, 0, 0]);
check("a camera tracked 100 px right sees the centre 100 px to the left", near(moved[0], 220) && near(moved[1], 180), moved);
const ck = { kf: KF.set(KF.set(undefined, 0, { cz: -1000 }, 24), 2, { cz: -500 }, 24) };
check("camAt: camera keys (cz ...) at timeline time", near(T.camAt(ck, 1, KF).z, -750) && T.camAt(ck, 1, KF).zoom === 1000);
/* shadows */
const L = [0, 0, -1000], rec = T.plane(T.clean({ z: 500 }), { cx: 320, cy: 180, w: 400, h: 400, rot: 0 }, W, H);
const X = T.onPlane(L, [50, 0, 0], rec), u = T.toLocal(rec, X);
check("onPlane: a point halfway from the light to a card behind throws its shadow 1.5x further out; toLocal = the card's 0..1",
  near(X[0], 75) && near(X[2], 500) && near(u[0], 0.5 + 75 / 400) && near(u[1], 0.5), [X, u]);
check("onPlane: nothing lands on a card in FRONT of the caster (or one edge-on)", T.onPlane(L, [0, 0, 800], rec) === null);
check("blurOf: in focus = sharp; one focus distance off = the aperture; off = 0", T.blurOf(T.camClean({ dof: true, focus: 1000, ap: 12 }), 1000) === 0 && near(T.blurOf(T.camClean({ dof: true, focus: 1000, ap: 12 }), 2000), 12) && T.blurOf(T.camClean({}), 3000) === 0);
/* wiring */
const CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TV = read("ext", "timelinedock", "tlvbake.js"), T3 = read("ext", "timelinedock", "tl3d.js");
check("canvas: a 3D card drawn by Tl3D in both paths (before ⏱ / ▢); never on the GPU path",
  /Tl3D\.draw\(g, pic, c, Ly\.kind, t, opac\(c, Ly\.L, t\), false\)/.test(CV) && /Tl3D\.draw\(tg, pic, c, Ly\.kind, t, opac\(c, Ly\.L, t\), S\.playing\)/.test(CV) && CV.indexOf("Tl3D.draw(g, pic") < CV.indexOf("TlTime.draw(g, c") && /c\.warp \|\| c\.d3; \}/.test(CV));
check("the compile: a 3D picture layer is baked by the page, a 3D video layer baked whole; both re-bake when the camera / light / other cards change (sceneSig)",
  /Tl3D\.live\(c\)\)/.test(TP) && /Tl3D\.sceneSig\(x\.c\)/.test(TP) && /Tl3D\.sceneSig\(x\.c\)/.test(TV) && /c\.vbakeSig = sig\(c, extra\(x\)\)/.test(TV) && /TlVBake\.register\("d3", live\)/.test(T3));
check("the page: 🧊 3D layer (depth z, x / y turn ◇, casts / accepts), 🎥 3D camera (position, aim, zoom ◇, depth of field, a light), the 🧊 Orbit tool (Shift+O)",
  /id="tlp3On"/.test(T3) && /id="tlp3Cast"/.test(T3) && /id="tlp3Dof"/.test(T3) && /id="tlp3Light"/.test(T3) && /id: "orbit", icon: "🧊"/.test(T3) && /key: "shift\+o"/.test(T3));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tl3d.js after tlvbake.js / tlwarp.js", EXT.indexOf("tl3d.js") > EXT.indexOf("tlwarp.js") && EXT.indexOf("tlwarp.js") > EXT.indexOf("tlvbake.js"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
