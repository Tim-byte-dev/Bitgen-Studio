#!/usr/bin/env node
/* bitGen Studio — 2.507.0 unit tests: 📌 PUPPET PINS and ⌗ MESH WARP (ext/timelinedock/tlwarp.js).
 * Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 1: particles, light rays, mesh warp, puppet pins). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const WP = require(path.join(ROOT, "ext", "timelinedock", "tlwarp.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

const o = WP.clean({ cols: 99, rows: 0, mesh: [[1, 1]], pins: [{ id: 1, x: 0.2, y: 0.2 }, { id: 1, x: 0.8, y: 0.8, dx: 9 }], detail: 999, falloff: 0 });
check("clean: columns / rows 1..8, a mesh of the wrong size dropped, pin ids made unique, offsets clamped, detail 4..48, falloff 0.5..4",
  o.cols === 8 && o.rows === 1 && o.mesh === null && o.pins[0].id === 1 && o.pins[1].id === 2 && o.pins[1].dx === 3 && o.detail === 48 && o.falloff === 0.5, o);
check("live: on with pins or a mesh; off / nothing = not live", WP.live({ warp: { pins: [{ x: 0.5, y: 0.5 }] } }) && WP.live({ warp: { cols: 1, rows: 1, mesh: [[0, 0], [0, 0], [0, 0], [0, 0]] } }) && !WP.live({ warp: { on: false, pins: [{}] } }) && !WP.live({ warp: {} }) && !WP.live({}));

/* MLS */
const P = [[0, 0], [100, 0]], Qt = [[10, 5], [110, 5]];
const m1 = WP.mls(P, Qt, 50, 40, 1.5);
check("mls: every pin moved the same = the whole picture shifts by it", near(m1[0], 60) && near(m1[1], 45), m1);
const Qr = [[0, 0], [0, 100]], m2 = WP.mls(P, Qr, 100, 0, 1.5), m3 = WP.mls(P, Qr, 50, 0, 1.5);
check("mls: a pin lands exactly where it was dragged; turning the pins 90° turns what is between them (rigid - no stretch)", near(m2[0], 0) && near(m2[1], 100) && near(m3[0], 0, 1e-6) && near(m3[1], 50, 1e-6), [m2, m3]);
const one = WP.mls([[10, 10]], [[30, 40]], 0, 0, 1);
check("mls: one pin = the picture follows it (moves by the same)", near(one[0], 20) && near(one[1], 30));
const still = WP.mls(P, P, 33, 77, 2);
check("mls: pins where they rest = nothing moves", near(still[0], 33) && near(still[1], 77));
const PP = [[0, 0], [100, 0], [0, 100], [100, 100]], QQ = [[0, 0], [100, 0], [0, 100], [140, 100]];
const nearC = WP.mls(PP, QQ, 95, 95, 2), farC = WP.mls(PP, QQ, 5, 5, 2), farLow = WP.mls(PP, QQ, 5, 5, 0.5);
check("falloff: near the dragged pin the picture follows it, near a still pin it barely moves; a low falloff reaches further",
  nearC[0] - 95 > 25 && Math.hypot(farC[0] - 5, farC[1] - 5) < 2 && Math.hypot(farLow[0] - 5, farLow[1] - 5) > Math.hypot(farC[0] - 5, farC[1] - 5), [nearC, farC, farLow]);

/* the mesh */
const mo = WP.clean({ cols: 2, rows: 2, mesh: [[0, 0], [0, 0], [0, 0], [0, 0], [0.1, -0.05], [0, 0], [0, 0], [0, 0], [0, 0]] });
const c0 = WP.meshOff(mo, mo.mesh, 0.5, 0.5), c1 = WP.meshOff(mo, mo.mesh, 0, 0), cq = WP.meshOff(mo, mo.mesh, 0.25, 0.5);
check("mesh: a grid point's offset exactly at that point, nothing at an unmoved corner, a smooth share between (Catmull-Rom)",
  near(c0[0], 0.1) && near(c0[1], -0.05) && near(c1[0], 0) && cq[0] > 0.03 && cq[0] < 0.1, [c0, c1, cq]);

/* deform + overscan + affine + mapPoint */
const W = 400, H = 200;
const dz = WP.deform(WP.clean({ pins: [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 }] }), WP.stateAt({ warp: { pins: [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 }] } }, 0), W, H, 8);
check("deform: pins at rest = the grid where it was (nothing to draw: maxd 0)", dz.maxd < 1e-9 && near(dz.pts[2 * 4], 200) && WP.overscan(dz) === 1);
const wc = { warp: { pins: [{ id: 1, x: 0.1, y: 0.5 }, { id: 2, x: 0.9, y: 0.5, dx: 0, dy: 0.6 }] } };
const dm = WP.deform(WP.clean(wc.warp), WP.stateAt(wc, 0), W, H, 16), lp = WP.mapPoint(dm, 0.9, 0.5);
check("deform: the dragged pin's picture point lands where the pin is (0.9, 1.1 of the picture = 360, 220 px)", near(lp[0], 360, 2) && near(lp[1], 220, 2), lp);
const ov = WP.overscan(dm);
check("overscan: room for where it went (past the bottom = more than 1x), at most 3x", ov > 1.2 && ov <= 3, ov);
const A = WP.affine([0, 0, 10, 0, 0, 10], [5, 5, 25, 5, 5, 15]);
check("affine: the triangle -> triangle transform (canvas order a b c d e f)", near(A[0], 2) && near(A[1], 0) && near(A[2], 0) && near(A[3], 1) && near(A[4], 5) && near(A[5], 5), A);

/* keys */
const kc = { warp: { pins: [{ id: 3, x: 0.5, y: 0.5 }] }, kf: KF.set(KF.set(undefined, 0, { wp3x: 0, wp3y: 0 }, 24), 2, { wp3x: 0.2, wp3y: -0.1 }, 24) };
const s1 = WP.stateAt(kc, 1, KF);
check("keys: a pin's offset glides between its keys (wp<id>x / wp<id>y)", near(s1.pins[0].dx, 0.1) && near(s1.pins[0].dy, -0.05), s1.pins[0]);
const km = { warp: mo, kf: KF.set(undefined, 0, { wm4x: 0.3 }, 24) };
check("keys: a mesh point keyed (wm<n>x) wins over its own value", near(WP.stateAt(km, 0, KF).mesh[4][0], 0.3) && near(WP.stateAt(km, 0, KF).mesh[4][1], -0.05));

/* wiring */
const CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TW = read("ext", "timelinedock", "tlwarp.js"), TR = read("ext", "timelinedock", "tlrays.js");
check("canvas: the warp after the masks and before the rays in both paths (bigger by _ow); never on the GPU path",
  (CV.match(/TlWarp\.apply\(pic, c, t - \(c\.start \|\| 0\), (false|S\.playing)\)/g) || []).length === 2 && CV.indexOf("TlWarp.apply(pic, c, t - (c.start || 0), false)") < CV.indexOf("TlRays.apply(pic, c, t - (c.start || 0), false)")
  && CV.indexOf("TlMask.apply(pic, c, t - (c.start || 0));   // 2.498.0") < CV.indexOf("TlWarp.apply(pic") && /c\.rays \|\| c\.warp(?: \|\| c\.\w+)*; \}/.test(CV) && /out\._ow = \(pic\._ow \|\| 1\) \* out\.width \/ W;/.test(TR));
check("the compile: a warped picture layer is baked by the page; a warped VIDEO layer baked whole (TlVBake)",
  /TlWarp\.live\(c\)\)/.test(TP) && /TlVBake\.register\("warp", live\)/.test(TW));
check("the page: 📌 Puppet (Shift+W) - click = a pin, drag = bend, Alt+click = gone; keyed once ◇; ⌗ Mesh warp columns / rows",
  /id: "puppet", icon: "📌"/.test(TW) && /key: "shift\+w"/.test(TW) && /ev\.altKey/.test(TW) && /id="tlpWpKey"/.test(TW) && /id="tlpWpMesh"/.test(TW) && /data-wp="cols"/.test(TW));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlwarp.js after tlrays.js and tlvbake.js", EXT.indexOf("tlwarp.js") > EXT.indexOf("tlrays.js") && EXT.indexOf("tlwarp.js") > EXT.indexOf("tlvbake.js"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
