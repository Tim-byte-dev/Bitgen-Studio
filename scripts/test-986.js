#!/usr/bin/env node
/* bitGen Studio — 2.986.0: the Sketcher's ✂ Separate (a group -> a group per part) and its arrow keys (pan; Ctrl zoom /
 * reset / to the picked). Tim: "in sketcher can you add a tool the will separate a selected layer into layers. use arrows for
 * zoom in out pan left and right. crtl + up arrow zooms in, ctrl+down arrow zooms out, ctrl + left resets zoom, ctrl + right
 * zooms to selected . up,down left and right pan" */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const G = require(path.join(ROOT, "ext/pushpulldock/ppgeo.js"));

/** a box at x (1 m), returns its faces' ids */
const box = (M, x, nm) => { const F = G.addFace(M, [[x, 0, 0], [x + 1, 0, 0], [x + 1, 1, 0], [x, 1, 0]]); G.pushPull(M, F.id, 1); const ids = M.f.filter((f) => !f.done).map((f) => f.id); M.f.forEach((f) => { if (!f.done && nm) f.nm = nm; f.done = true; }); return ids; };
// two loose boxes in one group
let M = G.newModel(); box(M, 0); box(M, 3); M.f.forEach((f) => { delete f.done; });
const gid = G.group(M, { f: M.f.map((f) => f.id) }, "Two boxes");
const P = G.partsOf(M, M.f.map((f) => f.id));
check("partsOf: two boxes that do not touch = two loose pieces of 6 faces", P.by === "piece" && P.parts.length === 2 && P.parts.every((p) => p.f.length === 6), P);
const r = G.separate(M, [M.f[0].id]);
check("separate (one face of the group is enough): a group per piece, \"Two boxes 1 / 2\", the old group gone", r.made.length === 2 && r.by === "piece" && M.g.map((g) => g.name).sort().join() === "Two boxes 1,Two boxes 2" && !M.g.some((g) => g.id === gid), { r, g: M.g });
check("…every face in one of the new groups, each box whole in its own", M.f.every((f) => r.made.includes(f.grp)) && r.made.every((g) => M.f.filter((f) => f.grp === g).length === 6));
const again = G.separate(M, [M.f[0].id]);
check("a box alone: one piece already - nothing made, says so", again.made.length === 0 && /one piece already/.test(again.why), again);
// an imported model: its meshes' names (even touching) decide
M = G.newModel(); box(M, 0, "Seat"); box(M, 1, "Leg"); box(M, 5, "Leg"); M.f.forEach((f) => { delete f.done; });
const g2 = G.group(M, { f: M.f.map((f) => f.id) }, "Chair"); M.g.find((g) => g.id === g2).soft = true;
const r2 = G.separate(M, M.f.map((f) => f.id));
check("an imported model (its faces carry their mesh's name): split BY NAME - Seat + Leg (the two legs together), touching or not", r2.by === "name" && M.g.map((g) => g.name).sort().join() === "Chair · Leg,Chair · Seat" && M.f.filter((f) => f.nm === "Leg").every((f) => f.grp === M.f.find((y) => y.nm === "Leg").grp), M.g);
check("…the import's soft look kept on the new groups", M.g.every((g) => g.soft));
// loose faces (no group) picked
M = G.newModel(); box(M, 0); box(M, 4); M.f.forEach((f) => { delete f.done; });
const r3 = G.separate(M, M.f.map((f) => f.id));
check("loose faces picked: a group per piece (\"Part 1 / 2\")", r3.made.length === 2 && M.g.map((g) => g.name).sort().join() === "Part 1,Part 2", M.g);
check("nothing picked: says so", /pick a group/.test(G.separate(G.newModel(), []).why));
// edges of the group go with their part
M = G.newModel(); box(M, 0); box(M, 3); M.f.forEach((f) => { delete f.done; });
const e1 = G.addEdge ? G.addEdge(M, [0.2, 0.2, 1], [0.8, 0.8, 1]) : null;
const g3 = G.group(M, { f: M.f.map((f) => f.id), e: M.e.map((e) => e.id) }, "B");
if (e1) { G.separate(M, [M.f[0].id]); const E = M.e.find((x) => x.grp); check("an edge drawn on the group goes with the nearest piece; the old group gone", !!E && M.f.filter((f) => f.grp === E.grp).every((f) => f.loops[0].every((v) => M.v[v][0] < 2)) && !M.g.some((g) => g.name === "B"), { e: M.e, g: M.g }); }
void g3;

// the arrow keys
require(path.join(ROOT, "ext/pushpulldock/pptools.js"));
const T = globalThis.PPTools, A = T.arrowNav;
check("↑ ↓ ← → pan a tenth of the view (Shift: a third)", A("ArrowUp", false).pan.join() === "0,0.1" && A("ArrowDown", false).pan.join() === "0,-0.1" && A("ArrowLeft", false).pan.join() === "-0.1,0" && near(A("ArrowRight", false, true).pan[0], 1 / 3));
check("Ctrl+↑ zooms in ×1.15, Ctrl+↓ out (Shift ×1.15³)", near(A("ArrowUp", false, false, true).zoom, 1.15) && near(A("ArrowDown", false, false, true).zoom, 1 / 1.15) && near(A("ArrowUp", false, true, true).zoom, Math.pow(1.15, 3)));
check("Ctrl+← resets (everything in view), Ctrl+→ zooms to what is picked", A("ArrowLeft", false, false, true).reset === true && A("ArrowRight", false, false, true).toSel === true);
check("a tool half-way: plain arrows keep an axis (nothing for the view), Ctrl+arrows still move it", A("ArrowUp", true) === null && A("ArrowRight", true, false, true).toSel === true);
const tl = rd("ext/pushpulldock/pptools.js");
check("pptools: arrowNav gets Ctrl (or ⌘); pan -> V.panBy, reset -> V.extents, toSel -> H3PushPull.zoomSel", /arrowNav\(k, Object\.keys\(st\)\.length > 0, e\.shiftKey, e\.ctrlKey \|\| e\.metaKey\)/.test(tl) && /V\.panBy\(nav\.pan\[0\], nav\.pan\[1\]\)/.test(tl) && /nav\.reset\) \{ V\.extents\(\)/.test(tl) && /root\.H3PushPull\.zoomSel\(\)/.test(tl));
check("✂ Separate in the toolbox (no key), its hint; on what is picked at once, else a click on a group", T.TOOLS.some((t) => t[0] === "separate" && t[1] === "✂" && t[3] === "") && /name === "separate" && hasSel\(\) && ctx\.separate/.test(tl) && /tool === "separate"\) \{ const p = V\.pick/.test(tl));
const dk = rd("ext/pushpulldock/ppdock.js"), vw = rd("ext/pushpulldock/ppview.js");
check("ppdock: separate() one undo step; an import keeps each mesh's name on its faces; zoomSel frames a picked DAZ character", /G\(\)\.separate\(S\.M, fids\)/.test(dk) && /commit\("separate", before\)/.test(dk) && /if \(x\.nm\) F\.nm = x\.nm/.test(dk) && /root\.H3DazScene && root\.H3DazScene\.sel\(\)\) \{ const r = root\.H3DazScene\.rig/.test(dk));
check("ppview: panBy slides camera + target by a fraction of the view (exported)", /function panBy\(fx, fy\)/.test(vw) && /panBy, diag/.test(vw));
check("nothing added to server.js", !/separate|panBy/.test(rd("misc/server.js")));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
