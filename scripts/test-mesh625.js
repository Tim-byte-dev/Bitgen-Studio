#!/usr/bin/env node
/* bitGen Studio — 2.625.0 (pure + wiring): PUSHPULL - FACES EXTRUDED (+ / − A CUT / TWISTED), FACES TURNED, EDGES MOVED /
 * STRETCHED / EXTRUDED / FILLETED, EDGE LOOPS, CORNERS MOVED (ext/pushpulldock/ppmesh.js); A WINDOW'S ELEVATION AND THE
 * DOOR / WINDOW GRIPS (pparch.js opHandles / resizeOp); ⛶ BETWEEN THE TITLE BAR AND THE STATUS BAR.
 * Tim: "in window properties add window elevation (height from floor) input. if user clicks a placed window allow the user to
 * move and resized the window,door,etc interactively. if user clicks a face show extrude in the properties panel, ... if user
 * selects a vertex move vertex." + "fix the miximize button to maximize to full screen but keeping the bitgen titlebar and
 * statusbar" */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
globalThis.polygonClipping = require(path.join(R0, "static", "vendor", "polygon-clipping.umd.min.js"));
const G = require(path.join(R0, "ext", "pushpulldock", "ppgeo.js"));
const X = require(path.join(R0, "ext", "pushpulldock", "ppmesh.js"));
const P = require(path.join(R0, "ext", "pushpulldock", "pparch.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const box = () => { const M = G.newModel(); const F = G.addFace(M, G.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); G.pushPull(M, F.id, 1); return M; };
const topOf = (M) => M.f.find((F) => G.faceNormal(M, F)[2] > 0.9);
const closed = (M) => { const c = new Map(), d = new Set(); let dup = 0; M.f.forEach((F) => F.loops.forEach((l) => G.loopEdges(l).forEach(([a, b]) => { const k = G.edgeKey(a, b); c.set(k, (c.get(k) || 0) + 1); if (d.has(a + ">" + b)) dup++; d.add(a + ">" + b); }))); return [...c.values()].every((x) => x === 2) && dup === 0; };
const vol = (M) => { let v = 0; M.f.forEach((F) => { const l = F.loops[0]; for (let i = 1; i + 1 < l.length; i++) v += G.v3.dot(M.v[l[0]], G.v3.cross(M.v[l[i]], M.v[l[i + 1]])) / 6; }); return v; };
const keyOn = (M, F, test) => G.loopEdges(F.loops[0]).map(([a, b]) => G.edgeKey(a, b)).find((k) => { const [a, b] = X.edgeEnds(M, k); return test(M.v[a], M.v[b]); });

/* faces */
let M = box();
let r = X.extrude(M, topOf(M).id, 0.5);
check("extrude +0.5 a box's top: out (1.5 m tall, still a closed solid)", near(G.bbox(M).max[2], 1.5) && closed(M) && near(vol(M), 3), { bb: G.bbox(M), vol: vol(M) });
M = box(); r = X.extrude(M, topOf(M).id, -0.4);
check("extrude −0.4: IN - a cut (0.6 m tall)", near(G.bbox(M).max[2], 0.6) && near(vol(M), 1.2), G.bbox(M));
M = box(); const F0 = G.addFace(M, G.rectPts([0.5, 0.25, 1], [1.5, 0.75, 1], [0, 0, 1]));
r = X.extrude(M, F0.id, -0.3);
const floor = G.face(M, r.face);
check("…a shape drawn on a face, extruded − : a pocket cut into the object (its floor 30 cm down, the top keeps a hole)", floor && G.loopPts(M, floor.loops[0]).every((q) => near(q[2], 0.7)) && near(G.faceArea(M, floor), 0.5) && topOf(M).loops.length === 2 && closed(M), { r, top: topOf(M).loops.length });
M = box(); r = X.extrude(M, topOf(M).id, 1, { twist: 45 });
const tp = G.face(M, r.face), c = X.faceCenter(M, tp), q0 = M.v[tp.loops[0][0]];
check("extrude with a twist (45°): the top turned round its normal, the sides two triangles each (flat), closed", near(c[2], 2) && M.f.filter((F) => F.loops[0].length === 3).length === 8 && closed(M)
  && near(Math.atan2(q0[1] - c[1], q0[0] - c[0]) - Math.atan2(0 - 0.5, 0 - 1), 45 * Math.PI / 180, 1e-6), { r, q0, c });
M = G.newModel(); const lone = G.addFace(M, G.rectPts([0, 0, 0], [1, 1, 0], [0, 0, 1])); r = X.extrude(M, lone.id, 1, { twist: 30 });
check("…a lone face extruded with a twist: a twisted solid (closed)", r.mode === "solid" && closed(M) && vol(M) > 0.7, { r, vol: vol(M) });
M = box(); X.rotateFace(M, topOf(M).id, 20);
check("turn a face 20° (no extrusion): its corners turned, the sides bent - split into triangles, still closed", closed(M) && M.f.filter((F) => F.loops[0].length === 3).length === 8 && near(G.bbox(M).max[2], 1), { vol: vol(M), n: M.f.length });

/* edges */
M = box(); let T = topOf(M);
const kFront = keyOn(M, T, (a, b) => a[1] === 0 && b[1] === 0);
check("an edge's faces (2) and the loop round its face (4 edges)", X.edgeFaces(M, ...X.edgeEnds(M, kFront)).length === 2 && X.edgeLoop(M, kFront, T.id).length === 4 && X.edgeLoop(M, kFront, T.id).includes(kFront));
X.moveVerts(M, X.edgeEnds(M, kFront), [0, 0, 0.5]);
check("an edge moved up 0.5: its faces bent out of flat are split, still closed", near(G.bbox(M).max[2], 1.5) && closed(M) && M.f.every((F) => F.loops[0].length === 3 || (() => { const Pp = F.loops[0].map((i) => M.v[i]), n = G.v3.norm(G.newell(Pp)); return Pp.every((p) => Math.abs(G.v3.dot(n, G.v3.sub(p, Pp[0]))) < 1e-6); })()), G.bbox(M));
M = box(); T = topOf(M); const kf = keyOn(M, T, (a, b) => a[1] === 0 && b[1] === 0);
X.setEdgeLength(M, kf, 1);
const [ea, eb] = X.edgeEnds(M, kf);
check("an edge's Length 1 m: about its middle", near(Math.abs(M.v[ea][0] - M.v[eb][0]), 1) && near((M.v[ea][0] + M.v[eb][0]) / 2, 1) && closed(M));
M = box(); T = topOf(M); const k2 = keyOn(M, T, (a, b) => a[1] === 0 && b[1] === 0), nf = M.f.length;
const EF = X.extrudeEdge(M, k2, [0, 0, 0.5]);
check("Extrude edge 0.5 up: a new face (the edge to the edge moved)", EF && M.f.length === nf + 1 && EF.loops[0].length === 4 && near(G.bbox(M).max[2], 1.5) && near(G.faceArea(M, EF), 1), EF);
M = G.newModel(); const ln = G.addEdge(M, [0, 0, 0], [2, 0, 0]); const lk = G.edgeKey(M.e[0].a, M.e[0].b);
const LF = X.extrudeEdge(M, lk, [0, 0, 1]);
check("…a lone line extruded: a face, the line now its border", LF && M.f.length === 1 && M.e.length === 0 && near(G.faceArea(M, LF), 2), { ln, f: M.f.length, e: M.e.length });
M = box(); T = topOf(M); const k3 = keyOn(M, T, (a, b) => a[1] === 0 && b[1] === 0);
r = X.fillet(M, k3, 0.2, 6);
check("Fillet (r 20 cm, 6 pieces) a box's edge: rounded - 6 new faces, the ends' faces keep it flat, closed, the corner's material gone", r.ok && r.faces.length === 6 && closed(M) && vol(M) < 2 && vol(M) > 2 - 2 * 0.04 * (1 - Math.PI / 4) - 1e-3, { r, vol: vol(M) });
M = box(); T = topOf(M);
check("…too big a radius: no (it says why)", !X.fillet(M, keyOn(M, T, (a, b) => a[1] === 0 && b[1] === 0), 5, 6).ok);
M = G.newModel(); G.addFace(M, G.rectPts([0, 0, 0], [1, 1, 0], [0, 0, 1]));
check("…an edge with one face: no fillet", /two faces/.test(X.fillet(M, G.edgeKey(0, 1), 0.1, 4).why || ""));
M = box(); T = topOf(M); const k4 = keyOn(M, T, (a, b) => a[1] === 0 && b[1] === 0), k5 = keyOn(M, T, (a, b) => a[1] === 1 && b[1] === 1);
check("…two edges, one after the other (not touching): both round", X.fillet(M, k4, 0.1, 3).ok && X.fillet(M, k5, 0.1, 3).ok && closed(M));

/* corners */
M = box(); const vi = X.findV(M, [2, 0, 1]); X.moveVerts(M, [vi], [0, 0, 0.4]);
check("a corner moved up 0.4: its faces split where they bend, closed", near(G.bbox(M).max[2], 1.4) && closed(M), G.bbox(M));

/* doors / windows: grips + elevation */
const A = P.empty(), Rm = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]]), w = P.addOp(A, "window", 1.2, { room: Rm.id, edge: 0, at: 2 });
w.sill = 0.9; w.h = 1.2;
const H = P.opHandles(A, w);
check("a window's grips: its sides (width), top (height), bottom (elevation) - on both faces of the wall", H.map((h) => h.key).join() === "l,r,t,b" && H.every((h) => h.sides.length === 2) && near(H[2].p[2], 2.1) && near(H[3].p[2], 0.9) && near(H[0].p[0], 1.4), H.map((h) => [h.key, h.p]));
P.resizeOp(A, w, "r", 3.1, 1.5);
check("…the right grip to 3.1 m: wider (1.7 m), the left side stays", near(w.w, 1.7) && near(w.at - w.w / 2, 1.4));
P.resizeOp(A, w, "t", 0, 2.4);
check("…the top grip to 2.4 m: taller (1.5 m)", near(w.h, 1.5));
P.resizeOp(A, w, "b", 0, 0.6);
check("…the bottom grip to 0.6 m: the elevation 0.6 m, the top where it was", near(w.sill, 0.6) && near(w.sill + w.h, 2.4));
const dr = P.addOp(A, "door", 0.9, { room: Rm.id, edge: 2, at: 2 });
check("a door: no bottom grip (it stands on the floor)", P.opHandles(A, dr).map((h) => h.key).join() === "l,r,t" && P.resizeOp(A, dr, "b", 0, 0.5) === false);

/* the wiring */
const TL = read("ext/pushpulldock/pparchtools.js"), PT = read("ext/pushpulldock/pptools.js"), ED = read("ext/pushpulldock/ppedit.js"), EJ = JSON.parse(read("ext/pushpulldock/ext.json")), DH = read("ext/pushpulldock/dock.html"), FR = read("ext/pushpulldock/ppframe.js"), VW = read("ext/pushpulldock/ppview.js"), AV = read("ext/pushpulldock/pparchview.js");
check("a window's panel: \"Elevation (height from floor)\" (the tool's too); its grips drawn and dragged; the window dragged up / down", (TL.match(/Elevation \(height from floor\)/g) || []).length === 2 && !/Sill height/.test(TL) && /function gripAt/.test(TL) && /function dragGrip/.test(TL) && /resizeOp/.test(TL) && /opHandles/.test(AV));
check("Select asks ppedit.js (after the building): faces / edges / corners; ppmesh.js + ppedit.js load before pptools.js", /ED\.down\(ev\)/.test(PT) && /ED\.move\(ev\)/.test(PT) && /ED\.up\(ev\)/.test(PT) && /ED\.vcb\(P\)/.test(PT)
  && EJ.scripts.indexOf("ppmesh.js") < EJ.scripts.indexOf("ppedit.js") && EJ.scripts.indexOf("ppedit.js") < EJ.scripts.indexOf("pptools.js"));
check("the panel: a face's Extrude + Twist, an edge's Length / Extrude edge / Fillet, a corner's X / Y / Z; Ctrl+click = the loop", /"Extrude"/.test(ED) && /"Twist"/.test(ED) && /"Length"/.test(ED) && /Extrude edge/.test(ED) && /Fillet/.test(ED) && /\["X", "Y", "Z"\]/.test(ED) && /edgeLoop/.test(ED) && /ED\.panel\(/.test(TL));
check("picked edges and corners are drawn", /V\.sel\.k/.test(VW) && /V\.sel\.p/.test(VW) && /T\.Points/.test(VW));
check("⛶ maximized: from the title bar's bottom to the status bar's top (--pp-bottom from #statusbar)", /bottom: var\(--pp-bottom, 0px\)/.test(DH) && /\$\("statusbar"\)/.test(FR) && /--pp-bottom/.test(FR));
check("server.js untouched by this release", !/ppmesh|ppedit|pushpulldock/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
