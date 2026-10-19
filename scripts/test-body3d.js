#!/usr/bin/env node
/* bitGen Studio — 2.471.0 units: PARAMETRIC 3D BODIES (static/body3d.js + the OpenCascade engine static/body3docc.js,
 * run here on the vendored static/vendor/replicad/ files - the same WebAssembly the page runs).
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const B = require(path.join(ROOT, "static", "body3d.js"));
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcsketch.js"));
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const throws = (f) => { try { f(); return null; } catch (e) { return e.message; } };

// ---- expressions
check("expr: arithmetic, precedence, ^ (right), unary minus, parentheses", B.expr("2 + 3 * 4") === 14 && B.expr("2 ^ 3 ^ 2") === 512 && B.expr("-(2 + 3) * 2") === -10 && B.expr("10 / 4") === 2.5);
check("expr: parameters, functions, pi, units (mm cm m in deg)", B.expr("w / 2 + h", { w: 40, h: 3 }) === 23 && near(B.expr("sin(90 deg)"), 1) && near(B.expr("2 * pi"), Math.PI * 2)
  && B.expr("1 in") === 25.4 && B.expr("2 cm + 5 mm") === 25 && B.expr("max(3, 7, 2)") === 7 && B.expr("(w) cm", { w: 2 }) === 20);
check("expr: plain errors (an unknown name, a bad character, unbalanced, empty, division by zero)", /"q" is not a parameter/.test(throws(() => B.expr("q + 1"))) && /"\$" is not allowed/.test(throws(() => B.expr("2 $ 3")))
  && /expected/.test(throws(() => B.expr("(2 + 3"))) && /empty/.test(throws(() => B.expr("  "))) && /finite/.test(throws(() => B.expr("1 / 0"))));
const P = B.resolveParams([{ name: "h", expr: "w / 2" }, { name: "w", expr: "40" }, { name: "a", expr: "b + 1" }, { name: "b", expr: "a + 1" }, { name: "sin", expr: "3" }, { name: "c", expr: "h * 3" }]);
check("parameters: worked out in dependency order (h uses w, written before it), a cycle caught (a ↔ b), reserved names refused", P.values.w === 40 && P.values.h === 20 && P.values.c === 60
  && P.order.indexOf("w") < P.order.indexOf("h") && /circle/.test(P.errors.a) && /circle/.test(P.errors.b) && /usable/.test(P.errors.sin), P);

// ---- a sketch: 80 x 40 rectangle (origin at its lower-left corner) with a hole of r 8; a profile for revolving
const s = K.create(100, 300);
K.rect2(s, [100, 300], [180, 260]);
K.circle(s, [140, 280], 8);
const prof = B.profilesOf(K, s, "all");
check("profiles in model space (y up from the sketch origin): the rectangle with its hole - lines from (0, 0) to (80, 40), the circle at (40, 20) r 8", prof.length === 1 && prof[0].outer.length === 4 && prof[0].holes.length === 1
  && prof[0].outer.every((g) => g.k === "L" && [g.a, g.b].every((p) => [0, 80].some((x) => near(p[0], x)) && [0, 40].some((y) => near(p[1], y)))) && prof[0].holes[0][0].k === "C" && near(prof[0].holes[0][0].c[0], 40) && near(prof[0].holes[0][0].c[1], 20), prof);
const poly = B.segPoly([{ k: "A", a: [10, 0], m: [0, 10], b: [-10, 0] }], (10 * Math.PI) / 180);
check("segPoly: a 3-point arc (half a circle, counter-clockwise) in 10° steps", poly.length === 18 && near(poly[9][0], 0, 1e-9) && near(poly[9][1], 10, 1e-9), poly.slice(0, 3));
check("axisOf: x / y, or a sketch line (model space)", B.axisOf(K, s, "x").d.join() === "1,0" && B.axisOf(K, s, "y").d.join() === "0,1" && /not a line/.test(throws(() => B.axisOf(K, s, "nope"))));

// ---- plan
const body = B.newBody({ params: [{ name: "depth", expr: "25" }, { name: "r", expr: "depth / 10" }], features: [
  { type: "extrude", sketch: "S1", dist: "depth", mode: "join" }, { type: "fillet", radius: "r", edges: "top" }, { type: "chamfer", dist: "1", edges: "bottom", off: true }] });
const pl = B.plan(body, (id) => (id === "S1" ? s : null), K);
check("plan: the parameters into the numbers (depth 25, r 2.5); the first body feature is a NEW body; a suppressed feature left out", pl.errors.length === 0 && pl.job.ops.length === 2 && pl.job.ops[0].op === "extrude"
  && pl.job.ops[0].dist === 25 && pl.job.ops[0].mode === "new" && pl.job.ops[1].radius === 2.5 && pl.job.ops[1].edges === "top", pl);
const pl2 = B.plan(B.newBody({ params: [{ name: "x", expr: "y" }], features: [{ type: "fillet", radius: "2" }, { type: "extrude", sketch: "gone" }, { type: "extrude", sketch: "S1", dist: "x * 2" }] }), (id) => (id === "S1" ? s : null), K);
check("plan: what is wrong is said per feature (a fillet before any body, a sketch that is gone, an unknown parameter) - the rest still planned", pl2.errors.length === 4 && /make a body first/.test(pl2.errors[1].msg) && /sketch is gone/.test(pl2.errors[2].msg) && /"y" is not a parameter|has no value|not a parameter/.test(pl2.errors.map((e) => e.msg).join()), pl2.errors);

// ---- meshes (a unit cube by hand)
const cube = { vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
  triangles: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7] };
const mi = B.meshInfo(cube), fe = B.featureEdges(cube, 30);
check("meshInfo: 12 triangles, the box 0..1, area 6, volume 1", mi.tris === 12 && mi.bbox[1].join() === "1,1,1" && near(mi.area, 6) && near(mi.volume, 1), mi);
check("featureEdges: the 12 edges of the cube (the face diagonals are not drawn)", fe.length === 12 * 6, fe.length / 6);
const stl = B.toSTL(cube, "cube"), dv = new DataView(stl.buffer);
check("toSTL: binary, 12 facets (84 + 12 x 50 bytes)", stl.length === 84 + 600 && dv.getUint32(80, true) === 12);
const glb = B.toGLB(cube, { color: "#ff8800", name: "cube" }), gv = new DataView(glb.buffer);
const jl = gv.getUint32(12, true), gj = JSON.parse(Buffer.from(glb.slice(20, 20 + jl)).toString());
check("toGLB: a valid .glb (magic, version 2, length; JSON + BIN chunks), 36 corners, the colour, metres / 100", gv.getUint32(0, true) === 0x46546c67 && gv.getUint32(4, true) === 2 && gv.getUint32(8, true) === glb.length
  && gj.accessors[0].count === 36 && near(gj.materials[0].pbrMetallicRoughness.baseColorFactor[0], 1) && near(gj.accessors[0].max[0], 0.01) && gv.getUint32(20 + jl + 4, true) === 0x004e4942, gj.accessors);

// ---- the OpenCascade engine on the vendored WebAssembly
(async () => {
  const VEND = path.join(ROOT, "static", "vendor", "replicad");
  if (!fs.existsSync(path.join(VEND, "replicad_single.wasm"))) { check("static/vendor/replicad/ is there", false); return done(); }
  try {
    const R = require(path.join(VEND, "replicad.umd.js"));
    const init = (await import("file://" + path.join(VEND, "replicad_single.js"))).default;
    const OC = await init({ locateFile: () => path.join(VEND, "replicad_single.wasm") });
    R.setOC(OC); globalThis.replicad = R;
    const O = require(path.join(ROOT, "static", "body3docc.js"));
    const vol = (job) => { const { body, warnings } = O.buildWith(R, job); return { v: body ? R.measureVolume(body) : 0, warnings, body }; };
    const ops = pl.job.ops;
    const plain = vol({ ops: [ops[0]] });
    check("OpenCascade: Extrude 25 of the rectangle with its hole = 80 x 40 x 25 - π 8² x 25", near(plain.v, 80 * 40 * 25 - Math.PI * 64 * 25, 1), plain.v);
    const fil = vol({ ops });
    check("OpenCascade: + Fillet r 2.5 on the top edges takes a little away (exact fillet: 4 outer edges + the hole's rim)", fil.v < plain.v && fil.v > plain.v - 1200 && !fil.warnings.length, [fil.v, plain.v, fil.warnings]);
    const sym = vol({ ops: [Object.assign({}, ops[0], { dir: "sym" })] }), symBox = O.buildWith(R, { ops: [Object.assign({}, ops[0], { dir: "sym" })] }).body.boundingBox.bounds;
    check("OpenCascade: Symmetric extrude: the same volume, z from -12.5 to 12.5", near(sym.v, plain.v, 1) && near(symBox[0][2], -12.5, 1e-3) && near(symBox[1][2], 12.5, 1e-3), symBox);
    const half = vol({ ops: [ops[0], { op: "split", plane: "YZ", offset: 40, keep: "pos" }] }), other = vol({ ops: [ops[0], { op: "split", plane: "YZ", offset: 40, keep: "neg" }] });
    check("OpenCascade: Split at x = 40: the two halves (pos + neg) make the whole", near(half.v + other.v, plain.v, 1) && near(half.v, plain.v / 2, 1), [half.v, other.v]);
    const cut = vol({ ops: [ops[0], Object.assign({}, ops[0], { mode: "cut", z: 20, dist: 10, profiles: [{ outer: [{ k: "C", c: [20, 20], r: 5 }], holes: [] }] })] });
    check("OpenCascade: Extrude as Cut (a r 5 pocket 5 deep from z 20)", near(cut.v, plain.v - Math.PI * 25 * 5, 1), cut.v);
    const ring = vol({ ops: [{ op: "revolve", z: 0, angle: 360, mode: "new", axis: { o: [0, 0], d: [0, 1] }, profiles: [{ outer: [{ k: "L", a: [10, 0], b: [20, 0] }, { k: "L", a: [20, 0], b: [20, 30] }, { k: "L", a: [20, 30], b: [10, 30] }, { k: "L", a: [10, 30], b: [10, 0] }], holes: [] }] }] });
    check("OpenCascade: Revolve 360° of a 10 x 30 strip 10 from the Y axis = a tube π (20² - 10²) x 30", near(ring.v, Math.PI * (400 - 100) * 30, 5), ring.v);
    const quarter = vol({ ops: [{ op: "revolve", z: 0, angle: 90, mode: "new", axis: { o: [0, 0], d: [0, 1] }, profiles: [{ outer: [{ k: "L", a: [10, 0], b: [20, 0] }, { k: "L", a: [20, 0], b: [20, 30] }, { k: "L", a: [20, 30], b: [10, 30] }, { k: "L", a: [10, 30], b: [10, 0] }], holes: [] }] }] });
    check("OpenCascade: Revolve 90° = a quarter of it", near(quarter.v, ring.v / 4, 5), quarter.v);
    const arcP = { op: "extrude", z: 0, dist: 10, dir: "one", mode: "new", profiles: [{ outer: [{ k: "L", a: [-10, 0], b: [10, 0] }, { k: "A", a: [10, 0], m: [0, 10], b: [-10, 0] }], holes: [] }] };
    check("OpenCascade: a profile with a 3-point arc (a half disc r 10) extruded 10 = π 100 / 2 x 10", near(vol({ ops: [arcP] }).v, Math.PI * 50 * 10, 1));
    const sh = vol({ ops: [ops[0], { op: "shell", thick: 2, face: "top" }] });
    check("OpenCascade: Shell 2 open at the top hollows it (less than half the volume left)", sh.v > 0 && sh.v < plain.v / 2 && !sh.warnings.length, [sh.v, sh.warnings]);
    const m = O.meshOf(fil.body, 0.05);
    check("OpenCascade: the mesh (vertices / normals / triangles) + the solid's real edges as lines", m.triangles.length > 100 && m.vertices.length === m.normals.length && m.edgeLines.length > 24 && m.smooth, [m.triangles.length, m.edgeLines.length]);
    const bad = O.buildWith(R, { ops: [ops[0], { op: "fillet", id: "fx", radius: 50, edges: "all" }] });
    check("OpenCascade: a fillet too big for the body: a warning for that feature, the body before it kept", !!bad.body && bad.warnings.length === 1 && bad.warnings[0].id === "fx", bad.warnings);
    const st = fil.body.blobSTEP ? await fil.body.blobSTEP().text() : "";
    check("OpenCascade: STEP export", /^ISO-10303-21;/.test(st) && /MANIFOLD_SOLID_BREP|ADVANCED_BREP/.test(st), st.slice(0, 40));
  } catch (e) { check("the OpenCascade engine ran", false, e.stack); }
  done();
})();
function done() {
  // wiring
  const BS = fs.readFileSync(path.join(ROOT, "static", "body3docc.js"), "utf8");
  check("body3docc: the vendored files only (static/vendor/replicad/), loaded on first use", /const BASE = "\/static\/vendor\/replicad\/"/.test(BS) && /import\(BASE \+ "replicad_single\.js"\)/.test(BS)
    && fs.existsSync(path.join(ROOT, "static", "vendor", "replicad", "LICENSE-replicad.txt")) && fs.existsSync(path.join(ROOT, "static", "vendor", "replicad", "LICENSE-replicad-opencascadejs.txt")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
