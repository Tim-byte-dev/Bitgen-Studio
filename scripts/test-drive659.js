#!/usr/bin/env node
/* bitGen Studio — 2.659.0: THE SKETCHER'S 🛣 DRIVEWAYS on Bézier curves (ext/pushpulldock/ppsite.js): the curve, its handles,
 * smoothing, the ribbon, on the ground, kerbs, kept by clean, on the floorplan, the wiring. The clicks: scripts/test-ui659-ui.js.
 * Tim (verbatim): "a driveway tool that can be adjusted with bezier curves" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const S = require(path.join(ROOT, "ext/pushpulldock/ppsite.js"));
const T = require(path.join(ROOT, "ext/pushpulldock/ppterrain.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));
const A = P.empty(), d = S.makeDrive(A, [[0, 0], [10, 0], [10, 10]], { w: 3 });
check("makeDrive: nodes at the clicks, smooth handles (the line through the neighbours, a sixth of it, opposite), an id from the model", d.id > 0 && d.nodes.length === 3 && JSON.stringify(d.nodes[1].b) === JSON.stringify([1.667, 1.667]) && JSON.stringify(d.nodes[1].a) === JSON.stringify([-1.667, -1.667]) && JSON.stringify(d.nodes[0].a) === "[0,0]", d.nodes);
check("bez: the curve starts and ends on its points", JSON.stringify(S.bez(d.nodes[0], d.nodes[1], 0)) === "[0,0]" && JSON.stringify(S.bez(d.nodes[0], d.nodes[1], 1)) === "[10,0]");
const sharp = S.makeDrive(null, [[0, 0], [10, 0]], { sharp: true });
check("a straight two-point driveway = its length", near(S.driveLength(sharp), 10, 0.01));
const R = S.ribbon(sharp);
check("ribbon: the edges w / 2 either side of the centre line", R.every((q) => near(q.l[1], 1.5) && near(q.r[1], -1.5)), R.slice(0, 2));
d.nodes[1].b = [6, 0]; d.nodes[1].a = [-6, 0];
const mid = S.bez(d.nodes[1], d.nodes[2], 0.5);
check("a handle moved = the curve bends toward it", mid[0] > 11, mid);
S.smooth(d);
check("smooth: back to even handles", JSON.stringify(d.nodes[1].b) === JSON.stringify([1.667, 1.667]));
const out = { polys: [], lines: [] }; S.buildDrives(A, out, null);
check("buildDrives: the surface in triangles facing up, its edges as lines", out.polys.length > 20 && out.polys.every((p) => p.rings[0].length === 3 && p.n[2] > 0.99 && p.tag.ak === "drive") && out.lines.length > 20);
d.kerb = true; const o2 = { polys: [], lines: [] }; S.buildDrives(A, o2, null);
check("kerbs: an upstand each side", o2.polys.some((p) => p.tag.part === "kerb") && o2.polys.length > out.polys.length);
A.terrain = T.clean({ x0: -10, y0: -10, cell: 1, nx: 30, ny: 30 }); A.terrain.h = A.terrain.h.map(() => 2);
const o3 = { polys: [], lines: [] }; S.buildDrives(A, o3, null);
check("on the ground: 4 cm over it; not on the ground = its level", o3.polys.every((p) => p.rings[0].every((q) => near(q[2], 2.04, 1e-6) || p.tag.part === "kerb")) && (d.follow = false, d.z = 1, (() => { const o4 = { polys: [], lines: [] }; S.buildDrives(A, o4, null); return o4.polys.filter((p) => p.tag.part === "surface").every((p) => p.rings[0].every((q) => near(q[2], 1.01))); })()));
const C = P.clean(JSON.parse(JSON.stringify(A)));
check("pparch clean keeps the driveways (nodes + handles, width, kerbs, level), drops a one-point one; find / remove / bbox / has", C.drives.length === 1 && C.drives[0].nodes[1].b[1] === 1.667 && C.drives[0].kerb && !C.drives[0].follow && P.clean({ drives: [{ nodes: [{ p: [0, 0] }] }] }).drives.length === 0 && P.find(C, "drive", C.drives[0].id) && P.bbox(C).max[0] > 10 && P.remove(C, "drive", C.drives[0].id) && C.drives.length === 0);
const B = P.empty(); S.makeDrive(B, [[0, 0], [10, 0]], { w: 3, sharp: true });
const sym = PL.symbols(B, 0, {});
check("the floorplan: its surface, its centre line dashed; picked by a click on it", sym.fills.some((f) => f.tag && f.tag.ak === "drive") && sym.lines.some((l) => l.dash) && PL.pickAt(B, [5, 1], 0).ak === "drive");
const J = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppterraintools.js"), "utf8"), AT = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchtools.js"), "utf8");
check("the wiring: 🛣 Driveway (points clicked, dbl / Enter ends, the curve's points + handles dragged, Alt = one side, Delete = a point), its Select panel", /\["drive", "🛣", "Driveway", ""\]/.test(J) && /function driveHit/.test(J) && /if \(!D\.alt\)/.test(J) && /function delNode/.test(J) && /asel\.ak === "drive" && root\.PPSite/.test(AT) && /t\.ak === "drive"\) \{ x\.nodes\.forEach/.test(AT));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
