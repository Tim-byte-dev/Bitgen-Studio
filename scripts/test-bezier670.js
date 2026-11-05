#!/usr/bin/env node
/* bitGen Studio — 2.670.0: THE SKETCHER'S PROFILES AS BÉZIER PATHS (ext/pushpulldock/ppprofile.js: paths, flatten, split,
 * toggle, remove; the built-in arcs as ONE curve each; lib/ppProfiles.js keeps the path). The editor in a real browser:
 * scripts/test-ui670-ui.js.
 * Tim (verbatim): "in the sketcher editors for cornice and skirting, change the arcs to bezier curves , a curved template with
 * only 2 vertices on the arc (start and finish) double click on the line adds a node, click on a segment to select the right
 * click to toggle convert to line/convert to curve in context menu" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const PF = require(path.join(ROOT, "ext/pushpulldock/ppprofile.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

// the built-in profiles: every arc / ogee ONE curve - two nodes on it
const cove = PF.byId("preset:cornice-cove"), bull = PF.byId("preset:skirt-bullnose"), ogee = PF.byId("preset:skirt-ogee"), torus = PF.byId("preset:skirt-torus"), col = PF.byId("preset:doorframe-colonial");
check("cornice Cove: 3 nodes, the quarter round ONE curve (its two ends the only nodes on it)", cove.path.n.length === 3 && cove.path.c.filter(Boolean).length === 1, cove.path);
check("skirting Bullnose / Ogee / Torus: one curve each (5 / 5 / 7 nodes)", bull.path.c.filter(Boolean).length === 1 && bull.path.n.length === 5 && ogee.path.c.filter(Boolean).length === 1 && torus.path.c.filter(Boolean).length === 1 && torus.path.n.length === 7);
check("a frame's Colonial moulding: its ogee + its bead - two curves", col.path.c.filter(Boolean).length === 2);
check("every built-in profile has a path and its flattened pts (what the sweep and the thumbnails use)", PF.PRESETS.every((p) => p.path && p.path.n.length >= 3 && p.pts.length >= p.path.n.length));
// the curve is a real arc: the cove's middle point on the circle (radius 0.09 round (0.09, 0.09))
const ci = cove.path.c.findIndex(Boolean), A = cove.path.n[ci], Bn = cove.path.n[(ci + 1) % cove.path.n.length], m = PF.bez(A, cove.path.c[ci][0], cove.path.c[ci][1], Bn, 0.5);
check("…the curve follows the arc (its middle within 0.05 mm of the circle)", near(Math.hypot(m[0] - 0.09, m[1] - 0.09), 0.09, 5e-5), m);
check("…sizes kept: Bullnose 18 x 100 mm, Cove 90 x 90 mm", near(PF.size(bull).w, 0.018) && near(PF.size(bull).h, 0.1) && near(PF.size(cove).w, 0.09) && near(PF.size(cove).h, 0.09), [PF.size(bull), PF.size(cove)]);

// editing a path
const sq = PF.pathFromPts([[0, 0], [0.02, 0], [0.02, 0.1], [0, 0.1]]);
check("pathFromPts: an older profile (points only) = straight sides", sq.n.length === 4 && sq.c.every((c) => c === null));
const i1 = PF.splitSeg(sq, 1, 0.5);
check("splitSeg on a line: a node in its middle (the side stays straight)", i1 === 2 && JSON.stringify(sq.n[2]) === "[0.02,0.05]" && sq.c.length === 5 && sq.c.every((c) => c === null), sq);
check("toggleSeg: a line -> a curve (two handles a third / two thirds along, bowed out) -> a line", PF.toggleSeg(sq, 2) === "curve" && sq.c[2] && sq.c[2][0][0] > 0.02 && PF.toggleSeg(sq, 2) === "line" && sq.c[2] === null, sq.c);
PF.toggleSeg(sq, 2);
const o = { a: sq.n[2].slice(), b: sq.n[3].slice(), c: sq.c[2].map((q) => q.slice()) }, P0 = (t) => PF.bez(o.a, o.c[0], o.c[1], o.b, t), mid0 = P0(0.3);
const i2 = PF.splitSeg(sq, 2, 0.3), q65 = PF.bez(sq.n[3], sq.c[3][0], sq.c[3][1], sq.n[4], 0.5), p65 = P0(0.65);
check("splitSeg on a curve: a node exactly on it, the two halves the same shape (de Casteljau)", i2 === 3 && near(sq.n[i2][0], mid0[0]) && near(sq.n[i2][1], mid0[1]) && near(q65[0], p65[0], 2e-6) && near(q65[1], p65[1], 2e-6), { q65, p65 });
const ns = PF.nearestSeg(sq, [0.01, -0.001]);
check("nearestSeg: the bottom side, half way", ns.i === 0 && near(ns.t, 0.5, 0.03) && ns.d < 0.002, ns);
check("removeNode: the node gone, the two segments one (a curve when either was)", PF.removeNode(sq, i2) && sq.n.length === 5 && sq.c[2] !== null, sq);
const tri = PF.pathFromPts([[0, 0], [1, 0], [0, 1]]);
check("removeNode: a straight profile keeps at least 3 nodes", !PF.removeNode(tri, 0) && tri.n.length === 3);

// clean: the path decides, kept counter-clockwise, flattened into pts
const cw = PF.clean({ kind: "skirt", name: "cw", path: { n: [[0, 0], [0, 0.1], [0.02, 0.1], [0.02, 0]], c: [null, [[0.005, 0.12], [0.015, 0.12]], null, null] } });
check("clean: a clockwise path turned counter-clockwise (its curve's handles swapped with it), pts flattened from it", cw && PF.area2(cw.pts) > 0 && cw.path.c.filter(Boolean).length === 1 && cw.pts.length === 4 + 15 && cw.path.c.find(Boolean)[0][1] === 0.12, cw);
check("clean: an older profile without a path stays as it was (no path)", !PF.clean({ kind: "skirt", pts: [[0, 0], [0.02, 0], [0.02, 0.1], [0, 0.1]] }).path);
check("cleanList keeps the paths (a model's own copies)", PF.cleanList([cw])[0].path.n.length === 4);

// the server keeps the path
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pp670-"));
const core = require(path.join(ROOT, "lib", "core.js"));
const LP = require(path.join(ROOT, "lib", "ppProfiles.js"));
const chk = LP.check({ kind: "skirt", name: "x", pts: cw.pts, path: cw.path });
check("lib/ppProfiles.js check: the path kept (nodes + handles / null)", chk.path && chk.path.n.length === 4 && chk.path.c.filter(Boolean).length === 1, chk.path);
let bad = ""; try { LP.check({ kind: "skirt", name: "x", pts: cw.pts, path: { n: [[0, 0], [9, 9]], c: [] } }); } catch (e) { bad = e.message; }
check("…a path outside 1 m refused", /within 1 m/.test(bad), bad);
fs.rmSync(tmp, { recursive: true, force: true }); void core;

const DL = read("ext/pushpulldock/ppprofiledlg.js");
check("the editor: dblclick on a segment = splitSeg, a click picks a segment, right-click = Convert to curve / line + Delete node, curves drawn with bezierCurveTo and their handles dragged",
  /addEventListener\("dblclick"/.test(DL) && /PF\(\)\.splitSeg\(D\.p\.path, h\.i, h\.t\)/.test(DL) && /Convert to line/.test(DL) && /Convert to curve/.test(DL) && /Delete node/.test(DL) && /bezierCurveTo/.test(DL) && /what: "handle"/.test(DL));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
