#!/usr/bin/env node
/* bitGen Studio — 2.471.0 units: PARAMETRIC 3D BODIES - the image editor's body layers (pcbody.js pure parts), the
 * server (lib/body3d.js: the engine setting, the job check, the BLENDER engine - scripts/blend_body3d.py, run here when a
 * Blender is installed, else SKIPPED), the timeline's SOLID tab and the wiring.
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" - "in settings give user option for 1 and 3, use the option the user selects but add both 1 and 3" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const PB = require(path.join(ROOT, "ext", "imageeditdock", "pcbody.js"));
const B = require(path.join(ROOT, "static", "body3d.js"));
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcsketch.js"));

// rotM = three.js Euler XYZ: (1, 0, 0) turned by yaw 90 -> (0, 0, -1); pitch 90 takes (0, 1, 0) to (0, 0, 1)
const ap = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const a = ap(PB.rotM({ yaw: 90 }), [1, 0, 0]), b2 = ap(PB.rotM({ pitch: 90 }), [0, 1, 0]), c = ap(PB.rotM({ roll: 90 }), [1, 0, 0]);
check("rotM: the same turn as three.js (Euler XYZ: pitch about X, yaw about Y, roll about Z)", near(a[0], 0) && near(a[2], -1) && near(b2[2], 1) && near(b2[1], 0) && near(c[1], 1), { a, b2, c });
const R = PB.rotM({ yaw: -35, pitch: 25, roll: 10 }), I = R.map((r) => R.map((r2) => r.reduce((s, x, k) => s + x * r2[k], 0)));
check("rotM: a true rotation (R Rᵀ = I)", I.every((r, i) => r.every((x, j) => near(x, i === j ? 1 : 0, 1e-9))));
const cube = { vertices: [0, 0, 0, 10, 0, 0, 10, 20, 0, 0, 20, 0, 0, 0, 5, 10, 0, 5, 10, 20, 5, 0, 20, 5], triangles: [] };
const pb = PB.projBox(cube, PB.VIEWS.front, 2, 6);
check("projBox (front, 2 px / unit, 6 px around): 10 x 20 -> 32 x 52, the origin at (6, 46) (y down)", pb.w === 32 && pb.h === 52 && near(pb.ox, 6) && near(pb.oy, 46), pb);
const q = [[100, 100], [116, 100], [116, 126], [100, 126]];     // a 32 x 52 picture drawn at half size
const q2 = PB.reanchor(q, 32, 52, [6, 46], 40, 60, [10, 50]);
check("reanchor: the picture grew (32 x 52 -> 40 x 60, the origin 6,46 -> 10,50): the origin stays put on the canvas, the same scale", near(q2[0][0], 100 + 3 - 5) && near(q2[0][1], 100 + 23 - 25) && near(q2[1][0] - q2[0][0], 20) && near(q2[3][1] - q2[0][1], 30), q2);
const skew = [[0, 0], [10, 2], [12, 14], [-1, 9]];
check("reanchor: a perspective quad is kept as it is", PB.reanchor(skew, 10, 10, [0, 0], 20, 20, [0, 0]) === skew);
check("the views: Home (iso) / Front / Back / Top / Bottom / Right / Left", ["home", "front", "back", "top", "bottom", "right", "left"].every((k) => PB.VIEWS[k]) && PB.VIEWS.top.pitch === 90);
check("featureLabel: what the feature list shows", PB.featureLabel(B.normFeature({ type: "extrude", name: "Extrude1", dist: "depth", dir: "sym", mode: "cut" })) === "⬆ Extrude1 - depth ⇕ · Cut"
  && PB.featureLabel(B.normFeature({ type: "fillet", name: "Fillet1", radius: "r", edges: "top" })) === "◜ Fillet1 - r r (top)"
  && /Split1 - YZ at 40 \(the − side\)/.test(PB.featureLabel(B.normFeature({ type: "split", name: "Split1", plane: "YZ", offset: "40", keep: "neg" }))));

// ---- the server
const core = require(path.join(ROOT, "lib", "core"));
const L = require(path.join(ROOT, "lib", "body3d.js"));
const st0 = L.settings();
check("lib/body3d: the engine setting - OpenCascade unless Blender is picked", ["occ", "blender"].includes(st0.engine) && L.ENGINES.join() === "occ,blender");
const errOf = (j) => { try { L.cleanJob(j); return null; } catch (e) { return e.status + " " + e.message; } };
check("cleanJob: refuses junk with a 400 (no ops, an unknown feature, a bad number, a loop with nothing, an axis with no direction, too many features)",
  /^400 no ops/.test(errOf({})) && /unknown feature/.test(errOf({ ops: [{ op: "explode" }] })) && /not a number/.test(errOf({ ops: [{ op: "fillet", radius: "x" }] }))
  && /empty loop/.test(errOf({ ops: [{ op: "extrude", dist: 2, profiles: [{ outer: [] }] }] })) && /no direction/.test(errOf({ ops: [{ op: "revolve", angle: 90, axis: { o: [0, 0], d: [0, 0] }, profiles: [{ outer: [{ k: "C", c: [0, 0], r: 1 }] }] }] }))
  && /too many/.test(errOf({ ops: new Array(201).fill({ op: "fillet", radius: 1 }) })));
const s = K.create(100, 300); K.rect2(s, [100, 300], [180, 260]); K.circle(s, [140, 280], 8);
const job = B.plan(B.newBody({ features: [{ type: "extrude", sketch: 1, dist: "25" }, { type: "chamfer", dist: "2", edges: "vertical" }] }), () => s, K).job;
const cj = L.cleanJob(JSON.parse(JSON.stringify(job)));
check("cleanJob: a planned job passes as it is (extrude with its profile + hole, a chamfer)", cj.ops.length === 2 && cj.ops[0].profiles[0].holes.length === 1 && cj.ops[1].edges === "vertical");
const BL = require(path.join(ROOT, "lib", "blender.js"));
const exe = BL.find();
(async () => {
  if (!exe) { console.log("SKIP: no Blender on this computer - the Blender engine was not run"); return done(); }
  try {
    const out = await L.build(job);
    const v = 80 * 40 * 25 - Math.PI * 64 * 25 - 4 * 2 * 25;   // the 4 vertical edges chamfered 2 (2 x 2 / 2 each)
    check("the BLENDER engine (scripts/blend_body3d.py): Extrude 25 with the hole + Chamfer 2 on the vertical edges = the right volume", Math.abs(out.volume - v) < 120 && out.mesh.triangles.length > 30 && !out.warnings.length, { vol: out.volume, v, w: out.warnings });
    const rv = await L.build({ ops: [{ op: "revolve", z: 0, angle: 360, mode: "new", axis: { o: [0, 0], d: [0, 1] }, profiles: [{ outer: [{ k: "L", a: [10, 0], b: [20, 0] }, { k: "L", a: [20, 0], b: [20, 30] }, { k: "L", a: [20, 30], b: [10, 30] }, { k: "L", a: [10, 30], b: [10, 0] }], holes: [] }] }, { op: "split", plane: "XY", offset: 0, keep: "pos" }] });
    check("the BLENDER engine: Revolve 360° (a tube) then Split at z = 0 keeping + = half the tube", Math.abs(rv.volume - Math.PI * 300 * 30 / 2) < 200, rv.volume);
    let err = null; try { await L.build({ ops: [{ op: "fillet", radius: 1 }] }); } catch (e) { err = e; }
    check("the BLENDER engine: nothing to build = a plain 422", err && err.status === 422 && /nothing to build/.test(err.message), err && err.message);
  } catch (e) { check("the Blender engine ran", false, e.stack); }
  done();
})();
function done() {
  const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), TX = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
  const IDX = read("static", "index.html"), RI = read("routes", "index.js"), PBs = read("ext", "imageeditdock", "pcbody.js"), TB = read("ext", "timelinedock", "tlbody.js"), S3 = read("static", "settings3d.js");
  check("wiring: pcbody.js right after pccadbar.js, installed right after PCCadBar; tlbody.js after tlcadbar.js; the page loads body3d.js, body3docc.js, settings3d.js; routes/body3d.js mounted from routes/index.js",
    EXT.indexOf("pcbody.js") === EXT.indexOf("pccadbar.js") + 1 && IE.indexOf("PCBody.install(E)") > IE.indexOf("PCCadBar.install(E)") && TX.indexOf("tlbody.js") === TX.indexOf("tlcadbar.js") + 1
    && /<script src="\/static\/body3d\.js"><\/script>/.test(IDX) && /<script src="\/static\/body3docc\.js"><\/script>/.test(IDX) && /<script src="\/static\/settings3d\.js"><\/script>/.test(IDX) && /require\("\.\/body3d"\)\.mount\(app\)/.test(RI));
  check("pcbody: a body layer = a smart object with L.smart.body; one undo step per edit (structOp); a sketch change rebuilds quietly (no undo step); the SOLID tab (Create / Modify / View / Export) + the 🧊 Body tab; Layer menu commands",
    /L\.smart = \{ src: id, w: pic\.w, h: pic\.h, t: \{ quad: X\.rectQuad/.test(PBs) && /E\.structOp\(label, \(\) => applyPic\(L, body, pic\)\)/.test(PBs) && /if \(S\.layers\.includes\(L\)\) \{ applyPic\(L, b2, pic\); E\.refresh\(\); pushSoon\(L\); \}/.test(PBs)
    && /E\.cadBar\.addTab\(\{ id: "solid"/.test(PBs) && /dataset\.tab = "kbody"/.test(PBs) && ["solid.extrude", "solid.revolve", "solid.fillet", "solid.chamfer", "solid.shell", "solid.split", "solid.params", "solid.totimeline"].every((c) => PBs.includes('"' + c + '"')));
  check("tlbody: the timeline's SOLID tab (Body → 3D Layer, Update Bodies, Edit in Image Editor); the live link reloads the model + re-bakes its layers", /id: "solid"/.test(TB) && /Body → 3D Layer/.test(TB) && /M\.reload\(name\)/.test(TB) && /c\.m3dBaked = null; X\.schedule\(c\)/.test(TB) && /pushTimeline/.test(PBs));
  check("Settings ▸ 3D: the two engines as radio buttons, saved through /api/body3d/settings; room for more (addSection)", /value="occ"/.test(S3) && /value="blender"/.test(S3) && /\/api\/body3d\/settings/.test(S3) && /addSection/.test(S3));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
