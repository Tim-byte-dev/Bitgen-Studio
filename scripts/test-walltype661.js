#!/usr/bin/env node
/* bitGen Studio — 2.661.0: THE SKETCHER'S 🧱 WALL TYPES (ext/pushpulldock/ppwalltype.js + pparch.js / ppplan.js / pparchtools.js):
 * the layers, a type's thickness, the built-in types, a wall built as thick as its type, the outside layer colouring its face,
 * the seams on its top and on the floorplan, kept by clean, Use it for exterior / interior / a room, a type deleted / copied.
 * The clicks: scripts/test-ui661-ui.js.
 * Tim (verbatim): "create a docker to create wall structure like brick, air gap, frame, insulation, gyprock etc. wall thickness etc" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const WT = globalThis.PPWallType = require(path.join(ROOT, "ext/pushpulldock/ppwalltype.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));

check("the layers: brick, air gap, frames, insulation, plasterboard (gyprock), render, cladding ... each with a usual thickness",
  ["brick", "gap", "timber", "steel", "insul", "board", "plaster", "render", "weatherboard", "fibre", "block"].every((k) => WT.LAYERS[k] && WT.LAYERS[k].t > 0) && /gyprock/i.test(WT.LAYERS.plaster.label));
const ven = WT.BUILTIN.find((T) => T.id === "veneer");
check("built-in types: Brick veneer = brick 110 + gap 40 + wrap 1 + frame 90 (batts) + plasterboard 10 = 251 mm; Interior stud 110 mm",
  ven && near(WT.total(ven), 0.251) && ven.layers.find((x) => x.k === "timber").ins === true && near(WT.total(WT.BUILTIN.find((T) => T.id === "stud")), 0.11));
check("cleanTypes: an unknown layer dropped, thickness kept 1 mm - 1 m, batts only in a frame, an id once, a type with no layers dropped",
  JSON.stringify(WT.cleanTypes([{ id: "a b!", name: "X", layers: [{ k: "brick", t: 5 }, { k: "nope", t: 1 }, { k: "plaster", t: 0, ins: true }] }, { id: "ab", layers: [{ k: "gap" }] }, { id: "c", layers: [] }]))
    === JSON.stringify([{ id: "ab", name: "X", layers: [{ k: "brick", t: 1 }, { k: "plaster", t: 0.01 }] }]));
check("outerCol: a finish outside (brick) colours the face; an air gap / frame outside does not", WT.outerCol(ven) === "mat:brick" && WT.outerCol({ layers: [{ k: "timber", t: 0.09 }] }) === null);
let A = P.empty(); P.addRoom(A, P.rectPts([0, 0], [5, 4]), true); P.addRoom(A, P.rectPts([5, 0], [9, 4]), true);
A = P.clean(JSON.parse(JSON.stringify(A)));
check("list: no types kept yet - the built-in ones offered (ensure keeps them the first time)", WT.list(A) === WT.BUILTIN && A.wtypes.length === 0 && WT.ensure(A).length === WT.BUILTIN.length && A.wtypes !== WT.BUILTIN);
const R1 = A.rooms[0], R2 = A.rooms[1];
const ext = WT.targets(A, "ext", null, P), int = WT.targets(A, "int", null, P);
check("targets: 6 exterior walls, the shared pair interior; a room's walls; the picked wall", ext.length === 6 && int.length === 2 && WT.targets(A, "room", { id: R1.id }, P).length === 4 && WT.targets(A, "wall", { id: R1.id, edge: 2 }, P).length === 1);
check("assign: Brick veneer to every exterior wall (room.wt + room.tw = 0.251)", WT.assign(A, ext, "veneer") === 6 && R1.wt[0] === "veneer" && near(R1.tw[0], 0.251) && !R1.wt[1]);
WT.assign(A, int, "stud");
const q0 = P.wallQuads(R1).find((q) => q.i === 0), q1 = P.wallQuads(R1).find((q) => q.i === 1);
const wid = (q) => Math.abs(P.segDist(q.quad[0], q.quad[3], q.quad[2]).d);
check("the wall is built as thick as its type (251 mm) round its centre line; the shared wall 110 mm", near(wid(q0), 0.251, 1e-6) && near(wid(q1), 0.11, 1e-6) && near(q0.quad[3][1], -0.1255) && near(q0.quad[0][1], 0.1255), { q0: q0.quad, w1: wid(q1) });
const inn = P.interior(R1);
check("the floor: half of each wall in (the veneer side 125.5 mm, the stud side 55 mm)", near(Math.min(...inn.map((p) => p[1])), 0.1255) && near(Math.max(...inn.map((p) => p[0])), 5 - 0.055), inn);
check("the slab outline: half the veneer out", near(Math.min(...P.exterior(R1).map((p) => p[1])), -0.1255));
P.addOp(A, "window", { room: R1.id, edge: 0, at: 2 });
check("a window cut through the whole wall (its depth = 251 mm)", near(P.opInfo(A, A.ops[0]).T, 0.251));
const B = P.build(A);
const south = B.polys.filter((p) => p.tag.ak === "wall" && p.n[1] < -0.9 && p.rings[0].every((v) => v[1] < -0.1));
check("the outside face takes the outside layer's material (brick)", south.length && south.every((p) => p.col === "mat:brick"), south.map((p) => p.col));
R1.wext = { 0: "#112233" }; const own = P.build(A).polys.filter((p) => p.tag.ak === "wall" && p.n[1] < -0.9 && p.rings[0].every((v) => v[1] < -0.1) && p.rings[0].every((v) => v[0] < 5));
check("…a wall's own Outside colour still wins", own.length && own.every((p) => p.col === "#112233"), own.map((p) => p.col)); R1.wext = {};
const top = R1.z + R1.h + 0.002, seams = B.lines.filter((l) => near(l[0][2], top) && near(l[1][2], top));
check("the layers' seams drawn on the walls' tops (veneer: 4 seams a wall, stud: 2)", seams.length === 6 * 4 + 2 * 2, seams.length);
const sg = WT.seams(ven, q0.quad);
check("seams: across the wall from the outside face (the brick's inside at 110 mm in)", sg.length === 4 && near(sg[0][0][1], -0.1255 + 0.11), sg[0]);
const C = P.clean(JSON.parse(JSON.stringify(A)));
check("clean keeps the types and each wall's type, works its thickness out again (tw), drops a type that is gone",
  C.wtypes.length === WT.BUILTIN.length && C.rooms[0].wt[0] === "veneer" && near(C.rooms[0].tw[0], 0.251) && JSON.stringify(P.clean(Object.assign(JSON.parse(JSON.stringify(A)), { wtypes: [{ id: "x", layers: [{ k: "gap" }] }] })).rooms[0].wt) === "{}");
// edit a type: every wall of it follows
const T = A.wtypes.find((x) => x.id === "veneer"); T.layers[0].t = 0.09; WT.sync(A);
check("a type's layer thinner: its walls follow (sync)", near(R1.tw[0], 0.231) && near(wid(P.wallQuads(R1).find((q) => q.i === 0)), 0.231));
const cp = WT.copyType(A, "stud");
check("copyType: its own id (wt1), named ... (copy), the same layers", cp.id === "wt1" && cp.name === "Interior stud (copy)" && WT.total(cp) === WT.total(WT.find(A, "stud")));
check("usedBy / removeType: the stud's 2 walls back to the room's thickness", WT.usedBy(A, "stud") === 2 && WT.removeType(A, "stud") && !R1.wt[1] && !R1.tw[1] && near(wid(P.wallQuads(R1).find((q) => q.i === 1)), R1.t));
check("assign none: back to the room's own", WT.assign(A, [{ R: R1, i: 0 }], null) === 1 && !R1.wt[0] && near(wid(P.wallQuads(R1).find((q) => q.i === 0)), R1.t));
const sym = PL.symbols(A, 0, {});
check("the floorplan: the seams of the typed walls (k seam, over the walls' fill)", sym.lines.filter((l) => l.k === "seam").length === 5 * 4, sym.lines.filter((l) => l.k === "seam").length);
const S2 = WT.section(ven);
check("section: each layer's place across the wall (outside = 0)", S2.length === 5 && S2[0].from === 0 && near(S2[1].from, 0.11) && near(S2[4].to, 0.251) && S2[3].ins === true);
// the wiring
const J = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppwalltype.js"), "utf8"), AT = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchtools.js"), "utf8"), DK = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppdock.js"), "utf8"), EJ = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ext.json"), "utf8")).scripts;
check("the wiring: the 🧱 Wall types docker (button in the bar, the layers, ＋ a layer, Use it for), a wall's panel picks its type, repainted with the model, ppwalltype.js before pparch.js",
  /"🧱 Wall types"/.test(J) && /id="ppWTAdd"/.test(J) && /data-use="ext"/.test(J) && /selIn\("Wall type"/.test(AT) && /PPWallType\.paint\(\)/.test(DK) && EJ.indexOf("ppwalltype.js") < EJ.indexOf("pparch.js") && EJ.includes("ppwalltype.js"));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
