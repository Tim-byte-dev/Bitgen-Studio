#!/usr/bin/env node
/* bitGen Studio — 2.656.0: THE SKETCHER'S ✂ CUT / FILL PADS (ext/pushpulldock/ppterrain.js addPad / applyPad / padAt / meanIn,
 * kept by clean, drawn on the floorplan) + the wiring. The clicks: scripts/test-ui656-ui.js.
 * Tim (verbatim): "can you add a cut/fill landscaping tool to sketcher" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const T = require(path.join(ROOT, "ext/pushpulldock/ppterrain.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));
require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const slope = () => { const t = T.clean({ x0: -10, y0: -10, cell: 0.5, nx: 40, ny: 40 }); for (let j = 0; j <= 40; j++) for (let i = 0; i <= 40; i++) t.h[j * 41 + i] = (i - 20) * 0.1; return t; };
const sq = [[-3, -3], [3, -3], [3, 3], [-3, 3]];

const t = slope();
check("meanIn: the ground's mean inside an outline (a slope's middle)", near(T.meanIn(t, sq), 0, 0.06), T.meanIn(t, sq));
const q = T.addPad(t, sq, { batter: 2 });
check("addPad: a level = the mean (balanced), flat inside", near(q.z, 0, 0.06) && near(T.at(t, 2.5, 2), q.z) && near(T.at(t, -2.5, -2), q.z), { z: q.z });
check("…batters: cut down to the pad 1 : 2 on the high side, filled up on the low side, the far ground untouched",
  near(T.at(t, 5, 0), q.z + 1, 0.01) && near(T.at(t, -4, 0), q.z - 0.5, 0.01) && near(T.at(t, -5, 0), -1, 1e-6) && near(T.at(t, 9, 0), 1.8, 1e-6), [T.at(t, 5, 0), T.at(t, -4, 0), T.at(t, 9, 0)]);
check("…the cut and fill volumes (m³) kept on the pad, both > 0 on a slope", q.cut > 5 && q.fill > 5 && q.name === "Pad 1", q);
const t2 = slope(); const qc = T.addPad(t2, sq, { z: 0.5, mode: "cut" });
check("cut only: nothing filled (the low side stays under the level)", qc.fill === 0 && qc.cut > 0 && T.at(t2, -2, 0) < 0.5, qc);
const t3 = slope(); const qf = T.addPad(t3, sq, { z: -0.5, mode: "fill" });
check("fill only: nothing cut", qf.cut === 0 && qf.fill > 0 && T.at(t3, 2, 0) > -0.5, qf);
q.z = 1; T.applyPad(t, q);
check("applyPad again at a new level: flat at it, the volumes recounted", near(T.at(t, 0, 0), 1) && q.fill > 0, q);
check("padAt: inside / on the outline = the pad; far = none", T.padAt(t, [0, 0], 0.2) === q && T.padAt(t, [3.1, 0], 0.2) === q && T.padAt(t, [6, 6], 0.2) === null);
const C = T.clean(JSON.parse(JSON.stringify(t)));
check("clean keeps the pads (level, batter, mode, volumes); bad ones dropped", C.pads.length === 1 && C.pads[0].z === 1 && C.pads[0].batter === 2 && T.clean({ pads: [{ pts: [[0, 0], [1, 1]] }, null, { pts: [[0, 0], [1, 0], [1, 1]], mode: "x", batter: 99 }] }).pads.map((x) => x.mode + x.batter).join() === "both20");
const A = { rooms: [], ops: [], roofs: [], slabs: [], stairs: [], lights: [], items: [], cams: [], hide: [], groups: [], terrain: C };
const S = PL.symbols(A, 0, {});
check("the floorplan: the pad's dashed outline, its name + level, its cut / fill", S.lines.some((l) => l.dash && l.k === "contour" && l.pts.length === 5) && S.texts.some((x) => /^Pad 1 1 m$/.test(x.t)) && S.texts.some((x) => /^cut .* · fill /.test(x.t)), S.texts.map((x) => x.t));
const J = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppterraintools.js"), "utf8");
check("the tool: ✂ Cut / fill mode, corners on the ground, closed / double-click / Enter, a pad picked, its panel", /\["pad", "✂", "Cut \/ fill"\]/.test(J) && /function padDown/.test(J) && /finishPad\(\)/.test(J) && ["ppPadZ", "ppPadBatter", "ppPadMode", "ppPadAgain", "ppPadForget", "ppPadAuto"].every((id) => J.includes(id)));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
