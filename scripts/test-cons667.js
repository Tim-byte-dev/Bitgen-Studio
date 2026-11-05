#!/usr/bin/env node
/* bitGen Studio — 2.667.0: THE SKETCHER'S OBJECTS PANEL - CONSTRUCTION (planes + lines), SHAPES, RENAMING ANYTHING
 * (ext/pushpulldock/ppcons.js, ppoutline.js tree / rename, pparch.cleanCons / cleanLabels, ppgeo F.nm, ppview guides,
 * ppedit group push / pull) - pure + the wiring. The panel in a real browser: scripts/test-ui667-ui.js.
 * Tim (verbatim): "add construction to the objects panel as a heading, planes and construction lines will live in that
 * dropdown, add shapes, for all shapes that are created - user can rename anything in the objects panel, when user clicks a
 * shape allow user to push/pull the shape when dragged" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js")); globalThis.PPArch = P;
const G = require(path.join(ROOT, "ext/pushpulldock/ppgeo.js")); globalThis.PPGeo = G;
const CS = require(path.join(ROOT, "ext/pushpulldock/ppcons.js")); globalThis.PPCons = CS;
const OL = require(path.join(ROOT, "ext/pushpulldock/ppoutline.js"));

// ---- shapes
const M = G.newModel();
const f1 = G.addFace(M, G.rectPts([0, 0, 0], [2, 1, 0]));
G.pushPull(M, f1.id, 1);                                       // a box
const f2 = G.addFace(M, G.rectPts([5, 0, 0], [6, 1, 0]));      // a flat rectangle
G.addEdge(M, [10, 0, 0], [11, 0, 0]);                          // a loose line
const f3 = G.addFace(M, G.rectPts([20, 0, 0], [21, 1, 0])); G.group(M, { f: [f3.id], e: [] }, "Shed");
let S = CS.shapes(M);
check("shapes: the box (Solid 1), the rectangle (Shape 1), the line (Lines 1), the group (its name)", JSON.stringify(S.map((s) => [s.kind, s.def])) === JSON.stringify([["solid", "Solid 1"], ["shape", "Shape 1"], ["lines", "Lines 1"], ["group", "Shed"]]), S.map((s) => [s.kind, s.def, s.f.length, s.e.length]));
check("…the box has its 6 faces, the rectangle 1", S[0].f.length === 6 && S[1].f.length === 1 && S[2].e.length === 1);
check("renameShape: the box called 'Plinth' - kept on its faces, read back", CS.renameShape(M, S[0], "Plinth") && CS.shapeName(M, CS.shapes(M)[0]) === "Plinth");
const fid = S[0].f.find((id) => { const F = G.face(M, id); return G.faceNormal(M, F)[2] > 0.9; });
G.pushPull(M, fid, 0.5);
check("…still 'Plinth' after one of its faces is pushed / pulled", CS.shapeName(M, CS.shapes(M)[0]) === "Plinth");
check("…saved and opened: the name rides on the faces (fromJson keeps nm)", CS.shapeName(G.fromJson(JSON.parse(JSON.stringify(G.toJson(M)))), CS.shapes(M)[0]) === "Plinth");
CS.renameShape(M, CS.shapes(M)[3], "Garden shed");
check("renameShape on a group: the group's own name", M.g[0].name === "Garden shed");
check("renameShape: blank = no", !CS.renameShape(M, CS.shapes(M)[1], "   "));

// ---- construction
let A = P.empty();
const p1 = CS.addPlane(A, { n: [0, 0, 2], p: [0, 0, 3] });
check("addPlane: Plane 1, its normal unit, an id", p1 && p1.name === "Plane 1" && JSON.stringify(p1.n) === "[0,0,1]" && p1.id > 0, p1);
check("addPlane: the same plane again (either way round) = the one kept", CS.addPlane(A, { n: [0, 0, -1], p: [5, 5, 3] }) === p1 && A.cons.planes.length === 1);
const xz = CS.planeOf("xz"); CS.addPlane(A, xz);
check("planeOf: ground XY, front XZ, side YZ through the origin", xz.name === "Front plane (XZ)" && JSON.stringify(xz.n) === "[0,1,0]" && A.cons.planes.length === 2);
const l1 = CS.addLine(A, [0, 0, 0], [1, 1, 0]);
check("addLine: Construction line 1 through two points; one point twice = none", l1 && l1.name === "Construction line 1" && CS.addLine(A, [1, 1, 1], [1, 1, 1]) === null);
const A2 = P.clean(JSON.parse(JSON.stringify(A)));
check("clean keeps the construction (planes + lines) and their ids past the counter", A2.cons.planes.length === 2 && A2.cons.lines.length === 1 && A2.n > Math.max(...A2.cons.planes.map((x) => x.id), A2.cons.lines[0].id), A2.cons);
check("removeCons: the line gone", CS.removeCons(A, "line", l1.id) && A.cons.lines.length === 0);

// ---- the objects panel's tree + renaming anything
A = P.empty();
const R = P.addRoom(A, P.rectPts([0, 0], [4, 3]), { name: "Lounge" }); P.addRoof(A, [R.id], {}); A.cams = []; A = P.clean(A);
CS.addPlane(A, { n: [0, 0, 1], p: [0, 0, 1], name: "Deck level" }); CS.addLine(A, [0, 0, 0], [0, 4, 0]);
let T = OL.tree(A, M);
const sec = (k) => T.find((n) => n.key === k);
check("the tree: a Shapes heading (each shape) and a Construction heading", sec("sec:shapes") && sec("sec:shapes").children.length === 4 && sec("sec:cons"), T.map((n) => n.key));
const cons = sec("sec:cons").children;
check("Construction ▸ Planes (Deck level) and Construction lines (Construction line 1)", cons.find((n) => n.folder === "planes").children[0].label === "Deck level" && cons.find((n) => n.folder === "lines").children[0].label === "Construction line 1", cons);
const all = []; const walk = (n) => { all.push(n); (n.children || []).forEach(walk); }; T.forEach(walk);
const byKey = (k) => all.find((n) => n.key === k);
const wallKey = "room:" + R.id + ":wall:0", roofKey = "roof:" + A.roofs[0].id;
check("rename a wall: kept in arch.labels, the tree shows it", OL.rename(A, M, byKey(wallKey), "North wall") && A.labels[wallKey] === "North wall" && (() => { const t = []; OL.tree(A, M).forEach(function w(n) { t.push(n); (n.children || []).forEach(w); }); return t.find((n) => n.key === wallKey).label === "North wall"; })());
check("rename a roof, a room (its own name), a plane, a line, a shape", OL.rename(A, M, byKey(roofKey), "Main roof") && A.labels[roofKey] === "Main roof"
  && OL.rename(A, M, byKey("room:" + R.id), "Living") && A.rooms[0].name === "Living"
  && OL.rename(A, M, byKey("cplane:" + A.cons.planes[0].id), "First floor") && A.cons.planes[0].name === "First floor"
  && OL.rename(A, M, byKey("cline:" + A.cons.lines[0].id), "Grid A") && A.cons.lines[0].name === "Grid A"
  && OL.rename(A, M, byKey(sec("sec:shapes").children[1].key), "Pad") && CS.shapeName(M, CS.shapes(M)[1]) === "Pad");
check("rename: headings / folders cannot be renamed, blank names are not taken", !OL.rename(A, M, sec("sec:rooms"), "X") && !OL.rename(A, M, cons[0], "X") && !OL.rename(A, M, byKey(roofKey), "  "));
check("clean keeps the names given (and drops odd keys)", P.clean(JSON.parse(JSON.stringify(A))).labels[wallKey] === "North wall" && !("x y" in P.clean({ labels: { "x y": "no" } }).labels));

// ---- the wiring
const ext = JSON.parse(read("ext/pushpulldock/ext.json")).scripts;
check("ext.json: ppcons.js after ppplane.js, before ppoutline.js", ext.indexOf("ppcons.js") === ext.indexOf("ppplane.js") + 1 && ext.indexOf("ppcons.js") < ext.indexOf("ppoutline.js"), ext);
const VW = read("ext/pushpulldock/ppview.js"), TL = read("ext/pushpulldock/pptools.js"), ED = read("ext/pushpulldock/ppedit.js"), PL = read("ext/pushpulldock/ppplane.js"), OT = read("ext/pushpulldock/ppoutline.js");
check("snapping: On Guide / Guide Crossing from V.guides (ppview.js)", /V\.guides/.test(VW) && /"On Guide"/.test(VW) && /"Guide Crossing"/.test(VW));
check("📏 Tape measure + Ctrl on the second click = a construction line", /ev\.ctrlKey \|\| ev\.metaKey\) && root\.PPCons/.test(TL) && /PPCons\.addGuide/.test(TL));
check("📌 on the sketch plane's chip keeps it (PPCons.keepPlane)", /ppPlaneKeep/.test(PL) && /keepPlane/.test(PL));
check("a group's face dragged = push / pull (ppedit), the group stays picked", /p\.grp && p\.grp !== ctx\.group\(\)/.test(ED) && /grp: p\.grp/.test(ED) && /a group stays picked/.test(ED));
check("the panel: double-click / F2 renames, a shape row picks the shape (H3PushPull.setSel), Construction ＋ / 📌 / ⊥ / 🗑 / 👁", /dblclick/.test(OT) && /"F2"/.test(OT) && /h\.setSel\(/.test(OT) && /data-act="newcons"/.test(OT) && /data-act="keep"/.test(OT) && /data-act="look"/.test(OT) && /data-act="delcons"/.test(OT));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
