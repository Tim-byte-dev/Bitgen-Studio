#!/usr/bin/env node
/* bitGen Studio — 3.8.0: MOVE, TURN AND POSE THE DAZ CHARACTERS (AND THEIR ASSETS) IN THE SKETCHER'S VIEW; 👁 ON EVERY
 * OBJECT AND OBJECT GROUP IN THE 🗂 OUTLINE (ext/pushpulldock/ppdazgizmo.js, ppdazscene.js pieceMove / movesOf,
 * ppdaztools.js, ppoutline.js, ppgeo.js hid / hidden, ppview.js, ppglb.js, ppdock.js) - pure + the wiring.
 * In a real browser: scripts/test-ui3800-ui.js.
 * Tim: "allow user to move and pose the daz characters and assets. add an eye icon button to each object and object group
 * to turn visibility on/off" */
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
const GLB = require(path.join(ROOT, "ext/pushpulldock/ppglb.js"));
const GZ = require(path.join(ROOT, "ext/pushpulldock/ppdazgizmo.js"));
const SC = require(path.join(ROOT, "ext/pushpulldock/ppdazscene.js"));
const DT = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

/* ---------------- the gizmo's pure parts */
check("wrap folds a step into -180..180", GZ.wrap(190) === -170 && GZ.wrap(-190) === 170 && GZ.wrap(45) === 45 && GZ.wrap(180) === 180, [GZ.wrap(190), GZ.wrap(-190), GZ.wrap(180)]);
check("screenAngle: right 0°, up 90° (screen y down)", near(GZ.screenAngle([0, 0], [10, 0]), 0) && near(GZ.screenAngle([0, 0], [0, -10]), 90) && near(GZ.screenAngle([0, 0], [-10, 0]), 180));
const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
check("nearPolyline: on an edge 0, 3 px off it 3, the closing edge counts", near(GZ.nearPolyline(sq, [5, 0]), 0) && near(GZ.nearPolyline(sq, [5, -3]), 3) && near(GZ.nearPolyline(sq, [-2, 5]), 2));
const rp = GZ.ringPts([1, 2, 3], [0, 1, 1], 0.5, 32), ax = [0, Math.SQRT1_2, Math.SQRT1_2];
check("ringPts: n points, all at the radius, all square to the axis", rp.length === 32 && rp.every((p) => near(Math.hypot(p[0] - 1, p[1] - 2, p[2] - 3), 0.5, 1e-9) && near((p[0] - 1) * ax[0] + (p[1] - 2) * ax[1] + (p[2] - 3) * ax[2], 0, 1e-9)));
check("ringPts round Z lies flat (a floor ring)", GZ.ringPts([0, 0, 0.01], [0, 0, 1], 1, 16).every((p) => near(p[2], 0.01)));
check("clamp / snap", GZ.clamp(5, 0, 3) === 3 && GZ.clamp(-1, 0, 3) === 0 && near(GZ.snap(0.26, 0.1), 0.3) && GZ.snap(7, 15) === 0 && GZ.snap(8, 15) === 15 && GZ.snap(3.3, 0) === 3.3);
check("asset(): kept moves made safe (bad -> 0, far -> 3 m, turn folded)", JSON.stringify(GZ.asset({ pos: [9, "x", 1], rot: 200 })) === JSON.stringify({ pos: [0, 0, 0], rot: -160 }) && JSON.stringify(GZ.asset({ pos: [9, -9, 0.5], rot: 10 })) === JSON.stringify({ pos: [3, -3, 0.5], rot: 10 }), GZ.asset({ pos: [9, -9, 0.5] }));
check("glOf: the character's Z-up -> the glTF's Y-up (X, Z, -Y)", JSON.stringify(GZ.glOf([1, 2, 3])) === JSON.stringify([1, 3, -2]));
// the turn that glOf + makeRotationY gives matches a turn round the Sketcher's Z (the inner group's +90° round X)
{
  const rx = (p) => [p[0], -p[2], p[1]], th = 0.7, ry = (p) => [Math.cos(th) * p[0] + Math.sin(th) * p[2], p[1], -Math.sin(th) * p[0] + Math.cos(th) * p[2]];
  const rz = (p) => [Math.cos(th) * p[0] - Math.sin(th) * p[1], Math.sin(th) * p[0] + Math.cos(th) * p[1], p[2]];
  const p = [0.3, 0.2, -0.4], a = rx(ry(p)), b = rz(rx(p));
  check("an asset turned round the model's Y is turned round the Sketcher's Z", a.every((x, i) => near(x, b[i], 1e-12)), [a, b]);
  const t = [0.1, 0.2, 0.3], m = rx(GZ.glOf(t));
  check("…and slid by glOf(t) it slides by t in the Sketcher", m.every((x, i) => near(x, t[i], 1e-12)), m);
}

/* ---------------- the scene's / explorer's kept moves */
check("ppdazscene movesOf: kept, made safe, zero moves dropped", JSON.stringify(SC.movesOf({ Hat: { pos: [0, 0, 0.1], rot: 0 }, Sword: { pos: [1, 2, 9], rot: 370 }, Nothing: { pos: [0, 0, 0], rot: 0 }, Bad: 5 })) === JSON.stringify({ Hat: { pos: [0, 0, 0.1], rot: 0 }, Sword: { pos: [1, 2, 3], rot: 10 } }), SC.movesOf({ Sword: { pos: [1, 2, 9], rot: 370 } }));
check("movesOf of junk is {}", JSON.stringify(SC.movesOf(null)) === "{}" && JSON.stringify(SC.movesOf([1, 2])) === "{}");
const cs = DT.cleanScene({ chars: [{ id: "c1", name: "Ann", fig: { rel: "People/Genesis 9/Genesis 9.duf" }, pieceMove: { "Sword": { pos: [0.1, 0, 0], rot: 90 }, x: "bad" } }] });
check("the explorer keeps an asset's move with the character (reload)", cs.chars[0].pieceMove && cs.chars[0].pieceMove.Sword && cs.chars[0].pieceMove.Sword.rot === 90 && !("x" in cs.chars[0].pieceMove), cs.chars[0].pieceMove);

/* ---------------- 👁 shapes and groups: the geometry */
const M = G.newModel();
const f1 = G.addFace(M, G.rectPts([0, 0, 0], [2, 1, 0])); G.pushPull(M, f1.id, 1);          // a box (Solid 1)
const f2 = G.addFace(M, G.rectPts([5, 0, 0], [6, 1, 0]));                                    // Shape 1
G.addEdge(M, [10, 0, 0], [11, 0, 0]);                                                         // Lines 1
const f3 = G.addFace(M, G.rectPts([20, 0, 0], [21, 1, 0])); const grp = G.group(M, { f: [f3.id], e: [] }, "Shed");
const sh = CS.shapes(M), box = sh.find((s) => s.kind === "solid"), rect = sh.find((s) => s.kind === "shape"), lines = sh.find((s) => s.kind === "lines"), shed = sh.find((s) => s.kind === "group");
check("setHidden flips a shape's faces + lines (hidden when any shows)", G.setHidden(M, rect.f, rect.e, null) === true && M.f.find((F) => F.id === f2.id).hid === true);
check("…again: shown (the flag gone)", G.setHidden(M, rect.f, rect.e, null) === false && !("hid" in M.f.find((F) => F.id === f2.id)));
G.setHidden(M, box.f, [], true); M.g.find((g) => g.id === (grp.id || grp)).hidden = true;
const J = G.fromJson(JSON.parse(JSON.stringify(G.toJson(M))));
check("fromJson keeps hid on faces + hidden on groups (saved, undo)", J.f.filter((F) => F.hid).length === 6 && J.g.some((g) => g.hidden), [J.f.filter((F) => F.hid).length, J.g]);
G.setHidden(M, [], lines.e, true);
const J2 = G.fromJson(JSON.parse(JSON.stringify(G.toJson(M))));
check("…and hid on lines", J2.e.filter((E) => E.hid).length === 1);
const hg = G.hiddenGroups(J2);
check("isHidden: own flag, its group's, the open group shown", G.isHidden(J2, J2.f.find((F) => F.id === box.f[0]), hg) && G.isHidden(J2, J2.f.find((F) => F.id === f3.id), hg) && !G.isHidden(J2, J2.f.find((F) => F.id === f2.id), hg)
  && !G.isHidden(J2, J2.f.find((F) => F.id === f3.id), G.hiddenGroups(J2, J2.f.find((F) => F.id === f3.id).grp)));
check("fromJson of an older model: nothing hidden", G.fromJson({ v: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], f: [{ id: 1, loops: [[0, 1, 2]] }], e: [], g: [] }).f.every((F) => !F.hid));
// the export skips them
const tri = (F) => { const L = F.loops[0]; const out = []; for (let i = 1; i + 1 < L.length; i++) out.push([J2.v[L[0]], J2.v[L[i]], J2.v[L[i + 1]]]); return out; };
const n0 = (Mx) => GLB.meshes(Mx, tri).reduce((a, m) => a + m.idx.length / 3, 0);
const shown = G.fromJson(JSON.parse(JSON.stringify(G.toJson(J2)))); shown.f.forEach((F) => delete F.hid); shown.g.forEach((g) => delete g.hidden);
check("ppglb.meshes (.glb / .obj / .stl) leaves the hidden faces out", n0(J2) === 2 && n0(shown) === 2 + 12 + 2, [n0(J2), n0(shown)]);

/* ---------------- 👁 the outline */
const A = P.empty();
const T = OL.tree(A, J2, [{ id: "c1", name: "Ann", hidden: false, sel: true, pieces: [{ name: "Genesis 9", kind: "figure", shown: true }, { name: "Sword", kind: "other", shown: false }] }]);
const sec = (k) => T.find((n) => n.key === k);
const S1 = sec("sec:shapes"), DZ = sec("sec:daz");
check("every shape row has an 👁 (canEye), with its hidden state", S1 && S1.children.every((n) => OL.canEye(n)) && S1.children.find((n) => n.shape.kind === "solid").hidden === true && S1.children.find((n) => n.shape.kind === "group").hidden === true && S1.children.find((n) => n.shape.kind === "shape").hidden === false, S1 && S1.children.map((n) => [n.shape.kind, n.hidden]));
check("a DAZ characters heading: the character (picked) and what it is made of, each with an 👁", DZ && DZ.children.length === 1 && DZ.children[0].daz === "c1" && DZ.children[0].on && DZ.children[0].children.length === 2 && DZ.children[0].children.every((k) => OL.canEye(k)) && DZ.children[0].children[1].hidden === true, DZ);
check("no characters -> no DAZ heading", !OL.tree(A, J2, []).some((n) => n.key === "sec:daz") && !OL.tree(A, J2).some((n) => n.key === "sec:daz"));
check("leaves: a heading's rows with an eye (through folders - Construction)", OL.leaves(S1).length === 4 && OL.leaves(DZ).length === 1);
// toggles
const M3 = G.fromJson(JSON.parse(JSON.stringify(G.toJson(J2)))), T3 = OL.tree(A, M3), S3 = T3.find((n) => n.key === "sec:shapes");
const rectN = S3.children.find((n) => n.shape.kind === "shape"), shedN = S3.children.find((n) => n.shape.kind === "group");
check("setLeaf hides a loose shape (its faces)", OL.setLeaf(A, M3, rectN, true) && M3.f.find((F) => F.id === f2.id).hid === true && OL.leafHidden(A, M3, rectN));
check("setLeaf shows a group (its hidden flag off)", OL.setLeaf(A, M3, shedN, false) && !M3.g[0].hidden && !OL.leafHidden(A, M3, shedN));
check("setLeaf: no change -> false", OL.setLeaf(A, M3, shedN, false) === false);
check("setAll on the Shapes heading: hides all (one still showed)", OL.setAll(A, M3, S3) === true && OL.leaves(S3).every((n) => OL.leafHidden(A, M3, n)));
check("…again: shows all", OL.setAll(A, M3, S3) === false && OL.leaves(S3).every((n) => !OL.leafHidden(A, M3, n)) && M3.f.every((F) => !F.hid) && M3.e.every((E) => !E.hid));
// a heading of architecture rows + construction
const A2 = P.empty(); A2.roofs.push({ id: 7 }, { id: 8 }); A2.cons = { planes: [{ id: 3, name: "Plane 1" }], lines: [{ id: 4, name: "Line 1", hidden: true }] };
const T4 = OL.tree(A2, null), roofs = T4.find((n) => n.key === "sec:roofs"), cons = T4.find((n) => n.key === "sec:cons");
check("the Roofs heading hides both roofs (arch.hide keys)", OL.setAll(A2, null, roofs) === true && A2.hide.includes("roof:7") && A2.hide.includes("roof:8"));
check("…and shows them again", OL.setAll(A2, null, roofs) === false && !A2.hide.length);
check("the Construction heading reaches planes + lines through its folders, hides them all", OL.leaves(cons).length === 2 && OL.setAll(A2, null, cons) === true && A2.cons.planes[0].hidden && A2.cons.lines[0].hidden);
check("a DAZ row is not renamed by the outline (the explorer names it)", OL.rename(A, M3, DZ.children[0], "Bob") === false);

/* ---------------- the wiring */
const ol = read("ext/pushpulldock/ppoutline.js"), vw = read("ext/pushpulldock/ppview.js"), gl = read("ext/pushpulldock/ppglb.js"), dk = read("ext/pushpulldock/ppdock.js");
const sc = read("ext/pushpulldock/ppdazscene.js"), dt = read("ext/pushpulldock/ppdaztools.js"), gz = read("ext/pushpulldock/ppdazgizmo.js"), EJ = JSON.parse(read("ext/pushpulldock/ext.json"));
check("the view draws no hidden face / line", /if \(gone\(F\)\) return;/.test(vw) && /M\.e\.forEach\(\(E\) => \{ if \(gone\(E\)\) return;/.test(vw) && /hiddenGroups\(M, V\.group\)/.test(vw));
check("Select all (Ctrl+A) leaves hidden ones out", /isHidden\(S\.M, F, hg\)/.test(dk) && /isHidden\(S\.M, E, hg\)/.test(dk));
check("the export skips them", /F\.hid \|\| \(F\.grp != null && hg\.has\(F\.grp\)\)/.test(gl));
check("headings get an 👁 (eyeall) that hides / shows everything under them in one undo step", /data-act="eyeall"/.test(ol) && /edit\(on \? "all hidden" : "all shown"/.test(ol));
check("the outline's DAZ rows: 👁 via H3DazTools.setHidden / pieceShow, a click picks the character", /D\.setHidden\(n\.daz, !n\.hidden\)/.test(ol) && /D\.pieceShow\(n\.dazPiece\.id/.test(ol) && /D\.pickChar\(/.test(ol));
check("the scene repaints the outline when a character comes, goes, shows or hides; the rings follow every change", /PPOutline\.paint\(\)/.test(sc) && /H3DazGizmo\.refresh\(\)/.test(sc));
check("the gizmo script loads after the explorer (its hook comes after the explorer's click)", EJ.scripts.indexOf("ppdazgizmo.js") > EJ.scripts.indexOf("ppdaztools.js") && EJ.scripts.indexOf("ppdazgizmo.js") === EJ.scripts.indexOf("ppdazimport.js") + 1);
check("the gizmo hooks the canvas after the explorer's click (capture phase) and stops the view's orbit while dragging", /H3DazGizmo\.hook\(V\)/.test(dt) && /addEventListener\("pointerdown", down, true\)/.test(gz) && /controls\.enabled = false/.test(gz) && /stopImmediatePropagation/.test(gz));
check("a ring's turn is held inside the slider's limits and fed to setAxis (🪞 Mirror, the slider follows)", /clamp\(d\.v0 \+ d\.sign \* d\.sum, d\.row\.min, d\.row\.max\)/.test(gz) && /function setAxis\(id, ax, val\)/.test(dt) && /mirrorRot\(rr\)/.test(dt));
check("in 🕺 Pose a press on the body is left to pick a bone", /else return;\s+\/\/ 🕺 Pose/.test(gz));
check("an asset moves in its skin's bind matrix (it still poses with its bones)", /m\.bindMatrix\.copy\(m\.userData\.bind0\); if \(O\) m\.bindMatrix\.premultiply\(O\)/.test(sc));
check("the explorer's assets get ✥ (move) and ⟲ (put back)", /class="ghost dzmv/.test(dt) && /dzmv0/.test(dt) && /pickAsset\(c\.id, q\.name\)/.test(dt));
check("a drag keeps the place / move (placed, assetMoved)", /t\.placed\(id\)/.test(gz) && /t\.assetMoved\(id, d\.m\.piece\)/.test(gz) && /c\.place = Object\.assign\(\{\}, r\.place\); keep\(\)/.test(dt));
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
