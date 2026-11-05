#!/usr/bin/env node
/* bitGen Studio — 2.650.0: THE SKETCHER HIGHLIGHTS WHAT IS PICKED (the accent) AND WHAT IS UNDER THE POINTER (blue, not over a
 * picked one) - in 3D (pparchview.js tint) and on the 📐 floorplan (ppplan.js hlShapes) - pure + the wiring. The real view:
 * scripts/test-ui650-ui.js. Tim (verbatim): "when an object is selected like a wall etc, highlight it so user knows they have
 * selected the object same in floorplan view, hover over object highlights the object in a different color unless it is
 * selected" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js")); globalThis.PPArch = P;
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));
const A = P.empty(), R = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]], { name: "K" }), U = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]], { name: "Up", z: 2.85 });
const W = P.addRoom(A, [[6, 0], [6, 4]], { name: "Wall", closed: false });
const d = P.addOp(A, "door", 0.9, { room: R.id, edge: 0, at: 2 });
A.stairs.push({ id: 90, x: 1, y: 1, ang: 0, w: 1, len: 2, rise: 2.85, z: 0 }); A.lights.push({ id: 91, type: "downlight", x: 2, y: 2, z: 2.6, room: R.id });
A.items = [{ id: 92, type: "bed", x: 3, y: 2, z: 0, rot: 0, w: 1, d: 2, h: 0.5 }];
const box = (rg) => { const xs = rg.map((p) => p[0]), ys = rg.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(3)); };
const H = (t, z) => PL.hlShapes(A, t, z == null ? 0 : z, { footprint: (it) => [[it.x - it.w / 2, it.y - it.d / 2], [it.x + it.w / 2, it.y - it.d / 2], [it.x + it.w / 2, it.y + it.d / 2], [it.x - it.w / 2, it.y + it.d / 2]] });
const whole = H({ ak: "room", id: R.id });
check("a room = its outside outline (walls included), closed", whole.length === 1 && JSON.stringify(box(whole[0])) === "[-0.075,-0.075,4.075,3.075]" && JSON.stringify(whole[0][0]) === JSON.stringify(whole[0][whole[0].length - 1]), whole.map(box));
const wall = H({ ak: "room", id: R.id, part: "wall", edge: 1 });
check("one wall = that wall's piece (the east wall, 15 cm thick, square ends at its corners - 2.662.0)", wall.length === 1 && JSON.stringify(box(wall[0])) === "[3.925,0,4.075,3]", wall.map(box));
check("its floor / ceiling = the inside", JSON.stringify(box(H({ ak: "room", id: R.id, part: "floor" })[0])) === "[0.075,0.075,3.925,2.925]");
check("a free-standing wall = its quads; a room on another storey = nothing here (its own storey: its outline)", H({ ak: "room", id: W.id }).length === 1 && H({ ak: "room", id: U.id }).length === 0 && H({ ak: "room", id: U.id }, 2.85).length === 1);
check("a door = its cut through the wall; stairs, a piece = their outline; a light = a disc", box(H({ ak: "op", id: d.id })[0])[2] - box(H({ ak: "op", id: d.id })[0])[0] > 0.89
  && JSON.stringify(box(H({ ak: "stair", id: 90 })[0])) === "[1,0.5,3,1.5]" && JSON.stringify(box(H({ ak: "item", id: 92 })[0])) === "[2.5,1,3.5,3]" && Math.abs(box(H({ ak: "light", id: 91 })[0])[2] - 2.24) < 0.01);
check("nothing / a missing thing = no shape", H(null).length === 0 && H({ ak: "op", id: 999 }).length === 0);

const AV = read("ext/pushpulldock/pparchview.js"), PS = read("ext/pushpulldock/ppplan.js");
check("3D: the picked things tinted in the accent, the hovered one blue - not when it is picked; the floorplan draws its own",
  /const HOVER = 0x3b82f6;/.test(AV) && /if \(!plan\) \{ picked\.forEach\(\(t\) => tint\(t, acc, 0\.38, selG\)\); if \(hov\) tint\(hov, HOVER, 0\.3, selG\); \}/.test(AV) && /const hov = A\.hover && !isPicked\(A\.hover\) \? A\.hover : null;/.test(AV) && /if \(hov\) outline\(hov, HOVER, selG\);/.test(AV));
check("3D: a wall's tint = the wall faces inside its own footprint; a piece / light = its own meshes (shared geometry, not disposed)",
  /if \(t\.ak === "room" && t\.part === "wall" && t\.edge != null\) \{ const R = P\(\)\.room\(Ar, t\.id\), q = P\(\)\.wallQuads/.test(AV.replace(/R && /, "")) || /wallQuads\(R\)\.find\(\(w\) => w\.i === t\.edge\); return q \? inQ\(q\.quad, R\) : null;/.test(AV)
  && /m\.userData\.shared = true;/.test(AV) && /if \(o\.geometry && !o\.userData\.shared\) o\.geometry\.dispose\(\);/.test(AV));
check("the floorplan: the picked filled in the accent (0.42), the hovered in blue (0.32), over the plan's symbols, cleared when it ends",
  /\[st\.sel\]\.concat\(st\.more \|\| \[\]\)\.filter\(Boolean\)\.forEach\(\(t\) => put\(t, st\.accent, 0\.42\)\);/.test(PS) && /if \(st\.hover\) put\(st\.hover, st\.hoverCol, 0\.32\);/.test(PS) && /m\.renderOrder = 8;/.test(PS) && /clear\(\); clearHL\(\);/.test(PS));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
