#!/usr/bin/env node
/* bitGen Studio — 2.663.0: THE SKETCHER - A WALL SPLIT (double-click) + ITS PIECES MOVED (new walls join them to the room) /
 * TAKEN OUT, THE WALL TOOL ON A ROOM'S WALL, A CORNER / END PIECE'S OWN WIDTH, THE SKETCH PLANE + ⊥ LOOK AT
 * (ext/pushpulldock/pparch.js splitWall / openEnds / shiftEdges / setJoint, pparchtools.js, ppplane.js, ppview.js lookAlong).
 * The clicks: scripts/test-ui663-ui.js.
 * Tim (verbatim): "when user clicks a face, make that the sketch plane, add a look at button like fusion 360 has. when user
 * selects the square edge at the ends of the wall, allow user to set it's width. the wall tool walls can start and finish from
 * the room walls anywhere along the wall or snap to an edge the user created when double clicking. allow user to select
 * segments of the wall after a split(dbl click) and delete / move the selected wall, if user moves the segment add walls on
 * each side of the segment and join to the main room - this will work in floorplan and 3d mode" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const SP = require(path.join(ROOT, "ext/pushpulldock/ppplane.js"));
const J = (o) => JSON.stringify(o);

let A = P.empty(); const R = P.addRoom(A, P.rectPts([0, 0], [6, 4]), true);
R.wcol = { 0: "#111111", 1: "#222222" }; R.wext = { 3: "#333333" }; R.wkind = { 0: "int" }; A.hide = ["room:" + R.id + ":wall:2"];
P.addOp(A, "window", { room: R.id, edge: 0, at: 4.5 }); P.addOp(A, "door", { room: R.id, edge: 1, at: 2 });
check("splitWall: at the nearest point on the wall's line (its new point's number), not within 5 cm of an end", P.splitWall(A, R.id, 0, [2, 0.3]) === 1 && J(R.pts) === "[[0,0],[2,0],[6,0],[6,4],[0,4]]" && P.splitWall(A, R.id, 0, [0.03, 0]) === -1);
check("…both halves keep the wall's own settings (inside colour, interior); the walls after it one on (colours, the hidden wall)",
  R.wcol[0] === "#111111" && R.wcol[1] === "#111111" && R.wcol[2] === "#222222" && R.wext[4] === "#333333" && R.wkind[1] === "int" && J(A.hide) === J(["room:" + R.id + ":wall:3"]));
check("…a window past the split on the second half (its place from that half's start), the door on the next wall one on", J(A.ops.map((o) => [o.kind, o.edge, o.at])) === J([["window", 1, 2.5], ["door", 2, 2]]));
P.splitWall(A, R.id, 1, [4, 0]);
const k = P.openEnds(A, R.id, 1);
check("openEnds: a piece between two straight-on pieces - both its points doubled (the new short walls), its number now", k === 2 && J(R.pts) === "[[0,0],[2,0],[2,0],[4,0],[4,0],[6,0],[6,4],[0,4]]", { k, pts: R.pts });
P.moveEdge(A, R.id, k, 1);
check("…moved out 1 m: a bay - a new wall each side joins it to the room", J(R.pts) === "[[0,0],[2,0],[2,-1],[4,-1],[4,0],[6,0],[6,4],[0,4]]");
check("…the window stays on its piece (x 4..6), the door on its wall", J(A.ops.map((o) => [o.edge, o.at])) === J([[4, 0.5], [5, 2]]));
const C = P.clean(JSON.parse(J(A)));
check("…cleaned: 8 walls, a joint at each of the 8 corners, the room's area grown by the bay", P.wallQuads(C.rooms[0]).length === 8 && P.joints(C.rooms[0]).length === 8 && P.roomArea(C.rooms[0]) > P.roomArea(P.clean({ rooms: [{ pts: [[0, 0], [6, 0], [6, 4], [0, 4]] }] }).rooms[0]) + 1.5);
const R2 = P.addRoom(A, P.rectPts([10, 0], [14, 3]), true);
check("openEnds: a wall whose neighbours turn (a plain corner) - nothing added", P.openEnds(A, R2.id, 0) === 0 && R2.pts.length === 4);
R2.tops = { 0: [[0, 2.7], [0.5, 3.7], [1, 2.7]] };
P.splitWall(A, R2.id, 0, [11, 0]);
check("a sloped top split: each half keeps its part of the slope (3.2 m at the split)", near(P.topAt(R2, 0, 1), 3.2) && near(P.topAt(R2, 1, 0), 3.2) && near(Math.max(...R2.tops[1].map((q) => q[1])), 3.7));
// the corner / end pieces' own size
const W = P.addRoom(A, [[0, 10], [3, 10]], { closed: false });
check("cleanJw: a width 2 cm - 5 m, a length 0 - 5 m, a bad point dropped", J(P.cleanJw({ 0: { w: 9, l: -1 }, 5: { w: 1 }, 1: { w: "x" } }, 2)) === J({ 0: { w: 5, l: 0 } }));
P.setJoint(A, W.id, 1, { w: 0.4, l: 0.3 });
const e1 = P.joints(W).find((j) => j.k === 1), xs = e1.poly.map((q) => q[0]), ys = e1.poly.map((q) => q[1]);
check("setJoint: an end 40 cm wide, 30 cm past the end - wider than the wall: a pier round the end (30 cm back too)", e1.w === 0.4 && near(Math.max(...xs), 3.3) && near(Math.min(...xs), 2.7) && near(Math.max(...ys) - Math.min(...ys), 0.4), e1.poly);
P.setJoint(A, W.id, 1, { w: null, l: null });
check("…null: as the wall again (none kept)", !W.jw[1] && near(Math.max(...P.joints(W).find((j) => j.k === 1).poly.map((q) => q[0])), 3.075));
P.setJoint(A, R2.id, 0, { w: 0.6 });
check("a corner 60 cm: a pier round it (30 cm each way)", near(Math.min(...P.joints(R2).find((j) => j.k === 0).poly.map((q) => q[0])), 9.7));
check("clean keeps a joint's size", P.clean(JSON.parse(J(A))).rooms.find((x) => x.id === R2.id).jw[0].w === 0.6);
// the sketch plane
const B = SP.basis([0, -1, 0]);
check("ppplane basis: a wall's plane - u level along the wall, v up", near(B.u[2], 0) && near(Math.abs(B.u[0]), 1) && near(B.v[2], 1) && near(SP.basis([0, 0, 1]).n[2], 1));
const AT = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pparchtools.js"), "utf8"), TL = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/pptools.js"), "utf8"), VW = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppview.js"), "utf8"), PLN = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppplane.js"), "utf8"), EJ = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ext.json"), "utf8")).scripts;
check("the wiring: double-click splits (from above / the floorplan / on a face below its top), a dragged piece opens its ends, the Wall tool catches a wall's line, the up axis ignored on a plan, a corner / an end picked -> its panel",
  /const splitHere = \(\) =>/.test(AT) && /P\(\)\.openEnds\(A, R\.id, D\.t\.edge\)/.test(AT) && /snapPlan\(ev, O\.wall\.z, from, true\)/.test(AT) && /kind: "On Wall"/.test(AT) && /Blue Axis/.test(AT) && /setSel\(\{ ak: "joint"/.test(AT) && /"Length past the end"/.test(AT));
check("…the sketch plane: a face clicked (Select) sets it, the drawing tools draw in it, Esc / ✕ end it; ⊥ Look at (ppview lookAlong); ppplane.js before pptools.js",
  /PPSketchPlane\.set\(h\.n, h\.point/.test(AT) && /PPSketchPlane\.set\(p\.n, p\.point/.test(TL) && /oo\.plane = \{ n: sp\.n, p: sp\.p \}/.test(TL) && /function lookAlong/.test(VW) && /id = "ppLookAt"/.test(PLN.replace(/\.id = /g, 'id = ').replace(/look\.id/g, "id")) || /"ppLookAt"/.test(PLN) && EJ.indexOf("ppplane.js") < EJ.indexOf("pptools.js") && EJ.includes("ppplane.js"));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
