#!/usr/bin/env node
/* bitGen Studio — 2.690.0: WALLS JOINED END TO END - ext/pushpulldock/pparch.js endNear / addJoins / applyJoins / joinsOf and
 * A.joins in clean; the wiring in pparchtools.js (the Wall tool's pull, joins on finish / a drawn-out wall, the live follow).
 * The browser: scripts/test-ui690-ui.js.
 * Tim (verbatim): "snap walls to the end of other walls when they are close, when the new wall snaps to another wall join the
 * walls together so when the new wall moves the old walls resize" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static", "vendor", "polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext", "pushpulldock", "pparch.js"));
const two = () => { const A = P.empty(), W1 = P.addRoom(A, [[0, 0], [4, 0]], { closed: false }), W2 = P.addRoom(A, [[4, 0], [4, 3]], { closed: false }); return { A, W1, W2 }; };
const cp = (A) => P.clean(JSON.parse(JSON.stringify(A)));
const e = P.endNear(two().A, [4.1, 0.05], 0.15, 0);
check("endNear: another wall's end within reach (its room, point index) - none past it, none on another level",
  e && e.k === 1 && e.p.join() === "4,0" && !P.endNear(two().A, [4.3, 0], 0.15, 0) && !P.endNear(two().A, [4.1, 0], 0.15, 3));
const { A, W1, W2 } = two(), n = P.addJoins(A, W2);
check("addJoins: the new wall's end on the old wall's end = one join {a, b, p}; again = no second one", n === 1 && A.joins.length === 1 && A.joins[0].a === W2.id && A.joins[0].b === W1.id && A.joins[0].p.join() === "4,0" && P.addJoins(A, W2) === 0);
check("clean keeps a join while both walls are there; one wall gone = the join goes", cp(A).joins.length === 1 && P.clean(Object.assign(JSON.parse(JSON.stringify(A)), { rooms: [JSON.parse(JSON.stringify(A.rooms[0]))] })).joins.length === 0);
const B = cp(A);
const C = cp(A); C.rooms[1].pts = [[5, 0], [5, 3]]; P.applyJoins(C, B);
check("the NEW wall moved 1 m: the old wall's joined end follows (4 m -> 5 m), its far end stays; the join moves", C.rooms[0].pts.join() === "0,0,5,0" && C.joins[0].p.join() === "5,0", C.rooms[0].pts);
const D = cp(A); D.rooms[0].pts = [[0, 1], [4, 1]]; P.applyJoins(D, B);
check("the OLD wall moved: the new wall's joined end follows (3 m -> 2 m)", D.rooms[1].pts.join() === "4,1,4,3", D.rooms[1].pts);
const E = cp(A); E.rooms[1].pts = [[4.5, 0], [4.5, 3]]; P.applyJoins(E, B); E.rooms[1].pts = [[5, 0], [5, 3]]; P.applyJoins(E, B);
check("a drag that changes the model step by step: the wall whose points all moved leads - the other keeps following", E.rooms[0].pts.join() === "0,0,5,0", E.rooms[0].pts);
const F = cp(A); F.rooms.forEach((R) => { R.pts = R.pts.map((q) => [q[0] + 1, q[1]]); });
check("both moved together (several picked): nothing forced", P.applyJoins(F, B) === 0 && F.rooms[0].pts.join() === "1,0,5,0");
const G = cp(A); G.rooms[1].pts[0] = [4, -1]; P.applyJoins(G, B);
check("one end dragged: the joined end of the other wall goes with it", G.rooms[0].pts.join() === "0,0,4,-1");
check("joinsOf: a wall's joins (the other wall, the point)", JSON.stringify(P.joinsOf(A, W1.id)) === JSON.stringify([{ room: W2.id, p: [4, 0] }]));
const T = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8");
check("wired: the Wall tool pulls onto an end (Shift free) and shows ⊕ joined; joins on finish + a wall drawn out of an end; every drag keeps joined walls together",
  /const mg = !ev\.shiftKey && endMagnet\(p, O\.wall\.z\)/.test(T) && /⊕ joined to/.test(T) && /const nj = P\(\)\.addJoins\(AR\(\), R\)/.test(T) && /P\(\)\.addJoins\(A, R\);\s+\/\/ 2\.690\.0/.test(T) && /P\(\)\.applyJoins\(AR\(\), B\)/.test(T));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
