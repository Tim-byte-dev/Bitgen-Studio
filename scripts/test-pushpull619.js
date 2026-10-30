#!/usr/bin/env node
/* bitGen Studio — 2.619.0 (pure + wiring): THE 📏 PUSHPULL DOCKER - SketchUp-style modelling written for bitGen.
 * Tim: "can we add a final docker, i feel this one will complete bitgen ... looks like a sketchup made for linux" - picked:
 * our own SketchUp docker (IngeTrazo is GPL desktop software - nothing of it is used).
 *   ext/pushpulldock/ppgeo.js   faces with shared vertices, push/pull (a solid, the sides stretched, a pocket, a boss, a
 *                               hole through, a step from a split face), offset (walls), split, copy / move / rotate /
 *                               scale, erase, groups, the Measurements box, the file
 *   ext/pushpulldock/ppglb.js   .glb (glTF 2.0, Y up) / .obj / .stl
 *   lib/pushPull.js + routes/pushPull.js   the models kept per project; the wiring of the docker */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const G = require(path.join(R, "ext", "pushpulldock", "ppgeo.js"));
const O = require(path.join(R, "ext", "pushpulldock", "ppglb.js"));

/** every edge used by exactly two faces = a closed solid */
function closed(M) { const c = new Map(); M.f.forEach((F) => F.loops.forEach((l) => G.loopEdges(l).forEach(([a, b]) => { const k = G.edgeKey(a, b); c.set(k, (c.get(k) || 0) + 1); }))); return [...c.values()].every((n) => n === 2); }
/** the volume (each loop's Newell vector . a point / 6 - holes count with their own winding) */
function vol(M) { let V = 0; M.f.forEach((F) => F.loops.forEach((l) => { const P = l.map((i) => M.v[i]); V += G.v3.dot(P[0], G.newell(P)) / 6; })); return V; }
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

let M = G.newModel();
const F = G.addFace(M, G.rectPts([0, 0, 0], [3, 2, 0]));
check("addFace: a rectangle on the ground faces UP (push/pull goes up)", F && JSON.stringify(G.faceNormal(M, F)) === "[0,0,1]" && near(G.faceArea(M, F), 6));
let r = G.pushPull(M, F.id, 2.5);
check("pushPull of a lone face = a closed solid: 6 faces, 3 × 2 × 2.5 = 15 m³", r.mode === "solid" && M.f.length === 6 && closed(M) && near(vol(M), 15), { r, n: M.f.length, v: vol(M) });
const top = G.face(M, r.face);
r = G.pushPull(M, top.id, 0.5);
check("…its top pushed again: the sides STRETCH (still 6 faces, 18 m³)", r.mode === "move" && M.f.length === 6 && closed(M) && near(vol(M), 18), { r, v: vol(M) });
const inner = G.addFace(M, G.rectPts([1, 0.5, 3], [2, 1.5, 3]));
check("a rectangle drawn INSIDE the top (its plane) = a face in a hole of it, facing the same way", G.face(M, top.id).loops.length === 2 && JSON.stringify(G.faceNormal(M, inner)) === "[0,0,1]" && G.hostOf(M, inner) === G.face(M, top.id));
r = G.pushPull(M, inner.id, -1);
check("…pushed in 1 m = a POCKET (11 faces, closed, 17 m³)", r.mode === "extrude" && M.f.length === 11 && closed(M) && near(vol(M), 17), { r, n: M.f.length, v: vol(M) });
r = G.pushPull(M, r.face, -2);
check("…its floor pushed to the far side = a HOLE THROUGH (10 faces, closed, 15 m³)", r.mode === "through" && M.f.length === 10 && closed(M) && near(vol(M), 15), { r, n: M.f.length, v: vol(M) });
const M5 = G.fromJson(JSON.parse(JSON.stringify(G.toJson(M))));
check("toJson / fromJson: the same model back (faces, holes, ids)", M5.f.length === 10 && closed(M5) && near(vol(M5), 15) && M5.n === M.n);

let B = G.newModel(); const b0 = G.addFace(B, G.rectPts([0, 0, 0], [4, 4, 0])); G.pushPull(B, b0.id, 1);
const disc = G.addFace(B, G.circlePts([2, 2, 1], 1, [0, 0, 1], 24));
r = G.pushPull(B, disc.id, 2);
const cyl = 24 / 2 * Math.sin(2 * Math.PI / 24) * 2;   // the 24-gon's area x 2 m
check("a circle on the top pulled up = a BOSS (closed, 16 + the 24-gon × 2 m³)", r.mode === "extrude" && closed(B) && near(vol(B), 16 + cyl, 1e-6), { v: vol(B), e: 16 + cyl });

let C = G.newModel(); const c0 = G.addFace(C, G.rectPts([0, 0, 0], [4, 2, 0])); G.pushPull(C, c0.id, 1);
r = G.addEdge(C, [2, 0, 1], [2, 2, 1]);
check("addEdge across a face, border to border = the face SPLIT (its neighbours get the new corners: still closed)", r && r.split && C.f.length === 7 && closed(C), { r, n: C.f.length });
r = G.pushPull(C, r.split[1], 1);
check("…one half pulled up = a STEP (closed, 8 + 4 = 12 m³)", closed(C) && near(vol(C), 12), { r, v: vol(C) });
check("a line that splits nothing = a stray line; the same line twice is not added", G.addEdge(C, [10, 0, 0], [11, 0, 0]).edge && G.addEdge(C, [10, 0, 0], [11, 0, 0]) === null && C.e.length === 1);

let W = G.newModel(); const w0 = G.addFace(W, G.rectPts([0, 0, 0], [5, 4, 0]));
r = G.offset(W, w0.id, 0.25);
check("offset 0.25 m = a loop inside the face: a ring (5 × 4 - 4.5 × 3.5) + the room's floor", W.f.length === 2 && near(G.faceArea(W, w0), 20 - 15.75) && near(G.faceArea(W, G.face(W, r.face)), 15.75));
r = G.pushPull(W, w0.id, 2.7);
check("…the ring pulled up = WALLS 2.7 m high (the floor stays down)", r.mode === "solid" && near(Math.max(...W.v.map((v) => v[2])), 2.7) && W.f.some((x) => x.id !== w0.id && x.loops[0].every((i) => W.v[i][2] === 0) && near(G.faceArea(W, x), 15.75)));
let e1 = ""; try { G.offset(W, G.face(W, W.f.find((x) => near(G.faceArea(W, x), 15.75)).id).id, 3); } catch (e) { e1 = e.message; }
check("an offset that does not fit is refused in words", /does not fit/.test(e1), e1);

let T = G.newModel(); const t0 = G.addFace(T, G.rectPts([0, 0, 0], [2, 1, 0]));
const cp = G.copyOf(T, { f: [t0.id] }); G.move(T, G.selVerts(T, cp), [0, 0, 3]);
check("copyOf + move: a copy 3 m up (its own corners), the original left", T.f.length === 2 && T.v.length === 8 && T.f[1].loops[0].every((i) => T.v[i][2] === 3));
G.rotateZ(T, G.selVerts(T, cp), [0, 0, 0], 90);
check("rotateZ 90° round the origin: (2, 0) -> (0, 2)", T.v.some((v) => near(v[0], 0) && near(v[1], 2) && v[2] === 3));
G.scale(T, G.selVerts(T, { f: [t0.id] }), [0, 0, 0], 2);
check("scale × 2 from the origin: (2, 1) -> (4, 2)", T.v.some((v) => near(v[0], 4) && near(v[1], 2) && v[2] === 0));
const gid = G.group(T, { f: [t0.id] }, "Table");
check("group: a name, its faces marked; explode: loose again (the empty group gone)", T.g[0].name === "Table" && G.face(T, t0.id).grp === gid && (G.explode(T, gid), !T.g.length && !G.face(T, t0.id).grp));
const n0 = T.f.length; G.remove(T, { edgeKeys: [G.edgeKey(T.f[0].loops[0][0], T.f[0].loops[0][1])] });
check("remove a face's border line = the face goes with it (unused corners dropped)", T.f.length === n0 - 1 && T.v.length === 4);
check("parseVcb: lengths in m / cm / mm / feet / inches, two values, sides", G.parseVcb("1.5").vals[0] === 1.5 && G.parseVcb("150cm").vals[0] === 1.5 && near(G.parseVcb("1500mm").vals[0], 1.5)
  && near(G.parseVcb("5'").vals[0], 1.524) && near(G.parseVcb('10"').vals[0], 0.254) && JSON.stringify(G.parseVcb("3,2").vals) === "[3,2]" && G.parseVcb("24s").sides === 24 && G.parseVcb("abc") === null);
check("a flat loop only (a bent one is no face); a too-small one neither", G.addFace(G.newModel(), [[0, 0, 0], [1, 0, 0], [1, 1, 1], [0, 1, 0.2]]) === null && G.addFace(G.newModel(), [[0, 0, 0], [1e-7, 0, 0], [0, 1e-7, 0]]) === null);

const tri = (Mm) => (FF) => { const P = G.loopPts(Mm, FF.loops[0]); const t = []; for (let i = 1; i < P.length - 1; i++) t.push([P[0], P[i], P[i + 1]]); return t; };
const box = G.newModel(); const bx = G.addFace(box, G.rectPts([0, 0, 0], [2, 1, 0])); G.pushPull(box, bx.id, 1); box.f[0].mat = "#b5523b";
const ms = O.meshes(box, tri(box)), glb = O.glb(ms, "box");
const H = require(path.join(R, "lib", "houseGltf.js")).readGlb(Buffer.from(glb));
check(".glb: glTF 2.0 binary - a mesh per colour, Y up (2 × 1 × 1 m box -> x 0..2, y 0..1, z -1..0), both sides",
  Buffer.from(glb.slice(0, 4)).toString() === "glTF" && H.json.asset.version === "2.0" && H.json.meshes[0].primitives.length === 2 && H.json.materials.every((m) => m.doubleSided)
  && JSON.stringify(H.json.accessors.filter((a) => a.min).reduce((o, a) => [Math.min(o[0], a.min[0]), Math.max(o[1], a.max[0]), Math.min(o[2], a.min[1]), Math.max(o[3], a.max[1]), Math.min(o[4], a.min[2]), Math.max(o[5], a.max[2])], [9, -9, 9, -9, 9, -9])) === "[0,2,0,1,-1,0]");
const ob = O.obj(ms, "box"), st = O.stl(ms, "box");
check(".obj + .mtl (a material per colour) and binary .stl (12 triangles, millimetres)", /mtllib box\.mtl/.test(ob.obj) && (ob.obj.match(/^f /gm) || []).length === 12 && /newmtl pp_b5523b/.test(ob.mtl)
  && st.length === 84 + 12 * 50 && new DataView(st.buffer).getUint32(80, true) === 12);

// the server side
const L = require(path.join(R, "lib", "pushPull.js"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp619_")); L.setDir(dir);
const w = L.write("My Room", { model: G.toJson(W), view: { p: [1, 2, 3] } });
check("lib/pushPull: written as <name>.pp3d, listed, read back; a model is {v, f}; names made safe",
  w.name === "My Room" && fs.existsSync(path.join(dir, "My Room.pp3d")) && L.list()[0].name === "My Room" && L.read("My Room").model.f.length === W.f.length && L.read("My Room").view.p[2] === 3
  && (() => { try { L.write("x", { model: { a: 1 } }); return false; } catch (e) { return e.status === 400; } })() && L.nameOf("../a/b:c?.pp3d") === "b_c_" && (L.remove("My Room").ok && !L.list().length));
fs.rmSync(dir, { recursive: true, force: true });
const RT = read("routes/pushPull.js"), RI = read("routes/index.js"), EJ = JSON.parse(read("ext/pushpulldock/ext.json")), DH = read("ext/pushpulldock/dock.html"), DK = read("ext/pushpulldock/ppdock.js");
check("routes: GET / POST / DELETE /api/pushpull[/:name], mounted from routes/index.js", /app\.get\("\/api\/pushpull"/.test(RT) && /app\.post\("\/api\/pushpull\/:name"/.test(RT) && /app\.delete\("\/api\/pushpull\/:name"/.test(RT) && /require\("\.\/pushPull"\)\.mount\(app\)/.test(RI));
check("the extension: ext/pushpulldock (geometry, out, view, tools, docker); its docker owns Space; the bar's hand-overs",
  EJ.id === "pushpulldock" && ["ppgeo.js", "ppglb.js", "ppview.js", "pptools.js", "ppdock.js"].every((f, i, L) => EJ.scripts.includes(f) && (!i || EJ.scripts.indexOf(f) > EJ.scripts.indexOf(L[i - 1])))   /* 2.620.0 adds the architecture between */ && /id="pushpulldock" data-own-space="1"/.test(DH) && /id="ppVcb"/.test(DH)
  && /\/api\/tlcanvas\/model\?name=/.test(DK) && /TlM3D\.add\("model"/.test(DK) && /H3House\.addModel/.test(DK) && /\/api\/blender\/send/.test(DK) && /\/api\/unreal\/import/.test(DK) && /E\.load\(url/.test(DK));
check("its keys stay in it: Basic Settings' S / L / 2 (secfloat.js) and the prompt docker's P (pfloat.js) let it have them",
  /lastOver\.closest\("#pushpulldock"\)/.test(read("static/secfloat.js")) && /OWN = "#imageeditdock, #pushpulldock"/.test(read("ext/promptdock/pfloat.js")));
check("server.js untouched by this release", !/pushpull/i.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
