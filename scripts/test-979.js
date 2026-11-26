#!/usr/bin/env node
// bitGen Studio 2.979.0 - 💪 THE FIGURE'S OWN MUSCLE REACTIONS (JCM formulas) + 🧍 POSE (steps 1 + 2 of
// claude/DAZ-SOFT-PHYSICS-PLAN.md). Tim: "is there a way we can do live physics like deform [a character's] lips ... her body
// when she touches it, physical muscle reactions to animate?" A made-up library (OUR OWN tiny arm figure - no Daz content):
// a JCM on the elbow (TCB spline of the forearm's rotation), its strength in a "mult" stage, a second JCM chained to the first,
// an ERC (a controller dial driving a body shape), a formula into a bone centre (not applied), a figure with no JCMs (our flex).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const pt = (x, y, z) => [{ id: "x", value: x }, { id: "y", value: y }, { id: "z", value: z }];

/** a tube along +X (0..60 cm), 12 rings of 8, radius 4 cm, at y 140 */
function tube() {
  const v = [], p = [], NR = 13, NS = 8;
  for (let i = 0; i < NR; i++) for (let k = 0; k < NS; k++) { const a = k / NS * Math.PI * 2; v.push([i * 5, 140 + 4 * Math.cos(a), 4 * Math.sin(a)]); }
  for (let i = 0; i + 1 < NR; i++) for (let k = 0; k < NS; k++) { const a = i * NS + k, b = i * NS + (k + 1) % NS; p.push([0, 0, a, b, b + NS, a + NS]); }
  return { v, p };
}
function makeLib(dir, withJcm) {
  const w = (rel, obj) => { const f = path.join(dir, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  const t = tube(), N = t.v.length, FIG = "/data/Test%20Co/Arm/Arm.dsf";
  w("data/Test Co/Arm/Arm.dsf", { asset_info: { id: FIG, type: "figure" },
    geometry_library: [{ id: "Arm-geo", vertices: { values: t.v }, polygon_material_groups: { values: ["Skin"] }, polylist: { values: t.p } }],
    node_library: [{ id: "Arm", name: "Arm", type: "figure", center_point: pt(0, 0, 0) },
      { id: "lShldr", name: "lShldr", label: "Left Shoulder", type: "bone", parent: "#Arm", center_point: pt(0, 140, 0), end_point: pt(30, 140, 0), rotation_order: "XZY", rotation: [{ id: "x", min: -40, max: 40, clamped: true }, { id: "y", min: -110, max: 40, clamped: true }, { id: "z", min: -90, max: 90, clamped: true }] },
      { id: "lForearm", name: "lForearm", label: "Left Forearm", type: "bone", parent: "#lShldr", center_point: pt(30, 140, 0), end_point: pt(55, 140, 0), rotation_order: "XZY", rotation: [{ id: "x" }, { id: "y", min: -135, max: 0, clamped: true }, { id: "z", min: -20, max: 20, clamped: true }],
        formulas: [{ output: "lForearm:" + FIG + "#lForearm?center_point/x", operations: [{ op: "push", url: "Arm:#CTRLBulky?value" }] }] },
      { id: "lHand", name: "lHand", type: "bone", parent: "#lForearm", center_point: pt(55, 140, 0), end_point: pt(60, 140, 0), rotation_order: "XZY" },
      { id: "rShldr", name: "rShldr", type: "bone", parent: "#Arm", center_point: pt(0, 140, 0), rotation_order: "XZY" }],
    modifier_library: [{ id: "SkinBinding", skin: { joints: [
      { id: "lShldr", node: "#lShldr", node_weights: { values: t.v.map((q, i) => [i, q[0] < 30 ? 1 : 0]).filter((x) => x[1]) } },
      { id: "lForearm", node: "#lForearm", node_weights: { values: t.v.map((q, i) => [i, q[0] >= 30 && q[0] < 55 ? 1 : 0]).filter((x) => x[1]) } },
      { id: "lHand", node: "#lHand", node_weights: { values: t.v.map((q, i) => [i, q[0] >= 55 ? 1 : 0]).filter((x) => x[1]) } }] } }] });
  if (withJcm) {
    const M = "data/Test Co/Arm/Morphs/Test Co/";
    const elbowVerts = t.v.map((q, i) => [i, q]).filter(([, q]) => q[0] >= 20 && q[0] <= 30);
    w(M + "pJCMElbow.dsf", { modifier_library: [{ id: "pJCMElbow", parent: FIG + "#Arm", channel: { id: "value", label: "Elbow bend 90", min: 0, max: 1, clamped: true, value: 0 },
      morph: { deltas: { values: elbowVerts.map(([i, q]) => [i, 0, (q[1] - 140) * 0.1, q[2] * 0.1]) } },
      formulas: [{ output: "Arm:/data/Test%20Co/Arm/Morphs/Test%20Co/pJCMElbow.dsf#pJCMElbow?value", operations: [{ op: "push", url: "lForearm:" + FIG + "#lForearm?rotation/y/value" }, { op: "push", val: [0, 0, 0, 0, 0] }, { op: "push", val: [-90, 1, 0, 0, 0] }, { op: "push", val: 2 }, { op: "spline_tcb" }] },
        { output: "Arm:#pJCMElbow?value", stage: "mult", operations: [{ op: "push", url: "Arm:#JcmStrength?value" }] }] }] });
    w(M + "pJCMElbowB.dsf", { modifier_library: [{ id: "pJCMElbowB", channel: { id: "value", label: "Elbow crease", min: 0, max: 1, clamped: true, value: 0 },
      morph: { deltas: { values: [[elbowVerts[0][0], 0, -0.5, 0]] } },
      formulas: [{ output: "Arm:#pJCMElbowB?value", operations: [{ op: "push", url: "Arm:#pJCMElbow?value" }, { op: "push", val: 0.5 }, { op: "mult" }] }] }] });
    w(M + "JcmStrength.dsf", { modifier_library: [{ id: "JcmStrength", channel: { id: "value", label: "JCM strength", min: 0, max: 2, value: 1 } }] });
    w(M + "CTRLBulky.dsf", { modifier_library: [{ id: "CTRLBulky", channel: { id: "value", label: "Bulky", min: 0, max: 1, value: 0 } }] });
    w(M + "BodyWide.dsf", { modifier_library: [{ id: "BodyWide", channel: { id: "value", label: "Wide", min: 0, max: 2, value: 0 }, morph: { deltas: { values: t.v.map((q, i) => [i, 0, 0, q[2] > 0 ? 1 : 0]).filter((x) => x[3]) } },
      formulas: [{ output: "Arm:#BodyWide?value", operations: [{ op: "push", url: "Arm:#CTRLBulky?value" }, { op: "push", val: 2 }, { op: "mult" }] }] }] });
  }
  w("People/Arm/Arm.duf", { asset_info: { type: "figure" }, scene: { nodes: [{ id: "Arm", url: FIG + "#Arm" }] } });
  return { N };
}

(async () => {
  const FX = require(path.join(ROOT, "static/dazformula.js"));
  /* 1 the formula maths (pure) */
  const u = FX.parseUrl("lForearmBend:/data/DAZ%203D/Genesis%208/Female/Genesis8Female.dsf#lForearmBend?rotation/y/value");
  check("parseUrl(): node : file # id ? property (escaped spaces)", u.node === "lForearmBend" && u.file === "/data/DAZ 3D/Genesis 8/Female/Genesis8Female.dsf" && u.id === "lForearmBend" && u.prop === "rotation/y/value", u);
  check("key(): a bone's channel vs a value; '#id?value' with no file", FX.key("lForearmBend:/x.dsf#lForearmBend?rotation/y/value") === "b:lForearmBend:rotation/y" && FX.key("Genesis8Female:#pJCMFoo?value") === "m:pJCMFoo" && FX.key("#bar?value") === "m:bar");
  check("compact(): a formula into a bone centre is not applied (null)", FX.compact({ output: "lForearm:#lForearm?center_point/x", operations: [{ op: "push", val: 1 }] }) === null && FX.compact({ output: "A:#m?value", stage: "mult", operations: [{ op: "push", val: 2 }] }).stage === "mult");
  check("spline(): linear / constant inside, the ends held outside", near(FX.spline("spline_linear", [[0, 0], [10, 1]], 2.5), 0.25) && FX.spline("spline_constant", [[0, 0], [10, 1]], 9) === 0 && FX.spline("spline_linear", [[0, 0], [10, 1]], -5) === 0 && FX.spline("spline_linear", [[0, 0], [10, 1]], 50) === 1);
  const cr = FX.spline("spline_tcb", [[0, 0, 0, 0, 0], [1, 1, 0, 0, 0], [2, 0, 0, 0, 0]], 0.5);
  check("spline(): TCB with t = c = b = 0 is Catmull-Rom (halfway from 0 up to the peak 1 -> 0.5625); knots in any order", near(cr, 0.5625) && near(FX.spline("spline_tcb", [[2, 0], [0, 0], [1, 1]], 0.5), 0.5625), cr);
  check("run(): the stack - (3 + 4) x 2 / 7 - 1 = 1; a spline pops its count, its knots, then the input", near(FX.run([{ op: "push", val: 3 }, { op: "push", val: 4 }, { op: "add" }, { op: "push", val: 2 }, { op: "mult" }, { op: "push", val: 7 }, { op: "div" }, { op: "push", val: 1 }, { op: "sub" }], () => 0), 1)
    && near(FX.run([{ op: "push", k: "b:x:rotation/y" }, { op: "push", val: [0, 0] }, { op: "push", val: [-90, 1] }, { op: "push", val: 2 }, { op: "spline_linear" }], () => -45), 0.5) && FX.run([{ op: "push", val: 1 }, { op: "weird" }], () => 0) === 0);
  const model = { mods: { a: { value: 0, min: 0, max: 1, clamped: true }, s: { value: 1 }, loop1: { value: 0.3 } }, formulas: [
    { out: "a", stage: "sum", ops: [{ op: "push", k: "b:arm:rotation/x" }, { op: "push", val: 0.02 }, { op: "mult" }] },
    { out: "a", stage: "mult", ops: [{ op: "push", k: "m:s" }] },
    { out: "loop1", stage: "sum", ops: [{ op: "push", k: "m:loop2" }] }, { out: "loop2", stage: "sum", ops: [{ op: "push", k: "m:loop1" }] }] };
  const e1 = FX.evaluate(model, { bones: { arm: { x: 30 } } }), e2 = FX.evaluate(model, { bones: { arm: { x: 80 } }, set: { s: 0.5 } });
  check("evaluate(): (value + sum) x mult, THEN clamped to the channel (1.6 x 0.5 = 0.8); a dial set; a loop ends at its own value (no hang)", near(e1.a, 0.6) && near(e2.a, 0.8) && isFinite(e1.loop1), { e1, e2 });
  check("driven(): a value that follows a bone (and only those)", [...FX.driven(model)].join() === "a");
  const qx = FX.euler("XYZ", 90, 0, 0);
  check("euler(): 90° about X", near(qx[0], Math.SQRT1_2) && near(qx[3], Math.SQRT1_2));
  const qy = FX.euler("YZX", 0, 30, 0), qyz = FX.euler("YZX", 0, 30, 40), chk = FX.qmul(FX.euler("YZX", 0, 30, 0), FX.euler("YZX", 0, 0, 40));
  check("euler(): the order - YZX = Y, then Z in the turned frame", near(qy[1], Math.sin(15 * Math.PI / 180)) && qyz.every((v, i) => near(v, chk[i])));
  const ob = { order: "XYZ", orient: [0, 0, 90] }, bq = FX.boneQuat(ob, { x: 90 }), vv = FX.qrot(bq, [0, 0, 1]);
  check("boneQuat(): the rotation in the bone's oriented frame (oriented 90° about Z: its X is the world's Y)", near(vv[0], 1) && near(vv[2], 0), vv);
  const ax = FX.twistAxis({ order: "XZY" });
  check("swing(): a twist round the bone's own axis bends nothing; 60° of bend = 60", near(FX.swing(FX.boneQuat({ order: "XZY" }, { x: 70 }), ax), 0, 1e-4) && near(FX.swing(FX.boneQuat({ order: "XZY" }, { x: 30, y: -60 }), ax), 60, 1e-4));
  check("mirrorName() / mirrorRot(): lForearmBend <-> rForearmBend, l_thigh, LeftHand, foot_l; y / z turn the other way", FX.mirrorName("lForearmBend") === "rForearmBend" && FX.mirrorName("r_thigh") === "l_thigh" && FX.mirrorName("LeftHand") === "RightHand" && FX.mirrorName("foot_l") === "foot_r" && FX.mirrorName("hip") === "" && JSON.stringify(FX.mirrorRot({ x: 5, y: 10, z: -3 })) === JSON.stringify({ x: 5, y: -10, z: 3 }));

  /* 2 the library: the figure's formulas, the rest pose, the build */
  const core = require(path.join(ROOT, "lib/core")), D = require(path.join(ROOT, "lib/dazLib")), DM = require(path.join(ROOT, "lib/dazMuscle")), G = require(path.join(ROOT, "lib/glbMerge")), PO = require(path.join(ROOT, "ext/pushpulldock/ppdazpose.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daz979_")), libA = path.join(tmp, "LibA"), libB = path.join(tmp, "LibB"), lib = makeLib(libA, true); makeLib(libB, false);
  const realCfg = core.getConfig, realSet = core.setConfig, cfg = { daz_library: { roots: [libA] } };
  core.getConfig = () => cfg; core.setConfig = (c) => Object.assign(cfg, c);
  try {
    const figFile = path.join(libA, "data/Test Co/Arm/Arm.dsf"), ix = DM.index(figFile);
    check("index(): every modifier of the figure + its Morphs/ folder; the bone-centre formula counted as skipped", ix.mods.size === 6 && ix.formulas.length === 4 && ix.skipped === 1 && ix.files === 6, { mods: [...ix.mods.keys()], f: ix.formulas.length, skipped: ix.skipped, files: ix.files });
    check("index(): each file read once (by its mtime)", DM.modsOf(figFile) === DM.modsOf(figFile));
    const sol = DM.solve(figFile, { CTRLBulky: 0.75 }, { index: ix });
    check("solve(): the ERC - the Bulky dial drives the Wide shape (x 2) at the rest pose", sol.shape.length === 1 && sol.shape[0].id === "BodyWide" && near(sol.shape[0].w, 1.5), sol.shape.map((s) => [s.id, s.w]));
    check("solve(): the JCMs that follow the bones (the chained one too), their deltas loaded", sol.jcm.map((j) => j.id).sort().join() === "pJCMElbow,pJCMElbowB" && sol.jcm.every((j) => j.deltas.length >= 1), sol.jcm.map((j) => j.id));
    const strength = sol.client.formulas.find((f) => f.out === "pJCMElbow" && f.stage === "mult");
    check("solve(): the page's model - only those formulas; the strength (not posed) fixed as a constant 1", sol.client.formulas.length === 3 && strength && strength.ops[0].val === 1 && !("CTRLBulky" in sol.client.mods), sol.client);

    const out = await D.build({ root: libA, rel: "People/Arm/Arm.duf", dials: [{ url: "/data/Test%20Co/Arm/Morphs/Test%20Co/CTRLBulky.dsf#CTRLBulky", value: 0.5 }] });
    const GP = G.parse(out.glb), J = GP.json, body = J.meshes[0], daz = body.extras.daz;
    check("build(): no 'dial not found' for a controller; the ERC shape baked (Wide 1.0: +1 cm on the +z side)", !out.info.warnings.some((w) => /not found/.test(w)) && out.info.dials.some((d) => d.label === "Wide" && near(d.value, 1) && d.erc)
      && near(J.accessors[body.primitives[0].attributes.POSITION].max[2], 0.05, 1e-5), { w: out.info.warnings, d: out.info.dials, max: J.accessors[body.primitives[0].attributes.POSITION].max });
    const names = body.extras.targetNames, ji = names.indexOf("jcm:pJCMElbow"), acc = J.accessors[body.primitives[0].targets[ji].POSITION];
    check("build(): the muscle shapes are morph targets 'jcm:<id>' after the dials (weights 0)", ji > 0 && names.includes("jcm:pJCMElbowB") && body.weights.every((x) => x === 0) && out.info.muscles.kind === "jcm" && out.info.muscles.shapes === 2, { names, mu: out.info.muscles });
    const nCorners = J.accessors[body.primitives[0].attributes.POSITION].count;
    const ib = J.bufferViews[acc.sparse.indices.bufferView], idx = new Uint32Array(GP.bin.buffer.slice(GP.bin.byteOffset + ib.byteOffset, GP.bin.byteOffset + ib.byteOffset + ib.byteLength));
    check("build(): SPARSE targets - only the corners a shape moves, indices rising, no bufferView of the whole mesh", acc.bufferView === undefined && acc.count === nCorners && acc.sparse.count === idx.length && idx.length < nCorners / 2 && idx.every((v, i) => i === 0 || v > idx[i - 1]) && acc.min && acc.max, { count: acc.count, sp: acc.sparse.count });
    check("build(): extras.daz - the note, the model, the rest values, every bone with its order / limits (the page poses with these)", daz.note === D.NOT_DAZ && daz.muscles === "jcm" && daz.model.formulas.length === 3 && daz.rest.pJCMElbow === 0
      && daz.bones.lForearm.order === "XZY" && JSON.stringify(daz.bones.lForearm.lim.y) === "[-135,0]" && daz.bones.lShldr.label === "Left Shoulder" && daz.bones.lHand.parent === "lForearm", daz.bones.lForearm);
    check("build(): the bone-centre formula is said not to be applied (light tasks)", out.info.warnings.some((w) => /bone centres/.test(w)), out.info.warnings);
    /* the pose (the page's pure part, with the .glb's own extras) */
    const w0 = PO.muscleWeights(daz, {}, FX), w90 = PO.muscleWeights(daz, { lForearm: { y: -90 } }, FX), w45 = PO.muscleWeights(daz, { lForearm: { y: -45 } }, FX), wTw = PO.muscleWeights(daz, { lForearm: { x: 60 } }, FX);
    check("muscleWeights(): straight arm 0; elbow bent 90° = the JCM fully on, the chained crease half; 45° between; a twist does nothing", near(w0.pJCMElbow, 0) && near(w90.pJCMElbow, 1) && near(w90.pJCMElbowB, 0.5) && w45.pJCMElbow > 0.3 && w45.pJCMElbow < 0.7 && near(wTw.pJCMElbow, 0), { w90, w45 });
    check("muscleWeights(): past the limit of the shape = held at 1 (clamped)", near(PO.muscleWeights(daz, { lForearm: { y: -135 } }, FX).pJCMElbow, 1));
    const rows = PO.axisRows(daz.bones.lForearm);
    check("axisRows(): X (twist) marked from the rotation order, the figure's own limits (y -135..0)", rows[0].twist && rows[0].label === "X (twist)" && rows[1].min === -135 && rows[1].max === 0 && rows[2].min === -20);
    check("boneTree(): the figure, then the shoulder, the forearm, the hand (depths)", PO.boneTree(daz.bones).map((x) => x.id + x.depth).join() === "Arm0,lShldr1,lForearm2,lHand3,rShldr1", PO.boneTree(daz.bones));
    check("topActive(): the strongest first, nothing under 0.005", JSON.stringify(PO.topActive({ a: 0.001, b: 0.5, c: -0.9 })) === JSON.stringify([{ id: "c", v: -0.9 }, { id: "b", v: 0.5 }]));
    check("build({muscles: false}): none", (await D.build({ root: libA, rel: "People/Arm/Arm.duf", muscles: false })).info.muscles.kind === "none");

    /* 3 a figure with no JCMs: our own flex */
    cfg.daz_library.roots = [libB];
    const ob2 = await D.build({ root: libB, rel: "People/Arm/Arm.duf" }), J2 = G.parse(ob2.glb).json, d2 = J2.meshes[0].extras.daz;
    check("no JCMs in the figure -> our own flex on the upper arm (bent by the forearm) and the forearm (bent by the hand)", d2.muscles === "flex" && Object.keys(d2.rest).sort().join() === "flex_lForearm,flex_lShldr" && J2.meshes[0].extras.targetNames.includes("jcm:flex_lShldr"), { m: d2.muscles, rest: d2.rest });
    const f110 = PO.muscleWeights(d2, { lForearm: { y: -110 } }, FX).flex_lShldr, f55 = PO.muscleWeights(d2, { lForearm: { y: -55 } }, FX).flex_lShldr;
    check("flex: driven by how far the forearm bends (55° = half, 110° = full)", near(f55, 0.5, 1e-3) && near(f110, 1, 1e-3), { f55, f110 });
    const fx = DM.flex(D.figureData(D.sceneNodes(path.join(libB, "People/Arm/Arm.duf")).fig, path.join(libB, "People/Arm/Arm.duf")));
    const dl = fx.jcm[0].deltas, mid = dl.filter((x) => Math.hypot(x[2], x[3]) > 0.27);
    check("flex: the bulge pushes the middle of the bone out from its line (up to 7% of 4 cm), the ends not at all", dl.length >= 8 && mid.length > 0 && dl.every((x) => Math.hypot(x[2], x[3]) <= 0.4 * 0.7 + 1e-6 && Math.abs(x[1]) < 1e-9), dl.slice(0, 4));
  } finally { core.getConfig = realCfg; core.setConfig = realSet; fs.rmSync(tmp, { recursive: true, force: true }); }

  /* 4 wiring + the words */
  const EJ = JSON.parse(src("ext/pushpulldock/ext.json")).scripts;
  check("ext.json: ppdazpose.js right after ppdazlib.js", EJ.indexOf("ppdazpose.js") === EJ.indexOf("ppdazlib.js") + 1);
  const ui = src("ext/pushpulldock/ppdazpose.js");
  check("🧍 Pose: the not-a-replacement words, three.js + static/dazformula.js loaded when opened, morph weights 'jcm:', a click picks the bone, mirror, 💾 kept", /not a replacement for Daz Studio/.test(ui) && /Daz Studio is a very powerful character creator/.test(ui) && /\/static\/dazformula\.js/.test(ui) && /"jcm:" \+ id/.test(ui) && /Raycaster/.test(ui) && /pdpMirror/.test(ui) && /h3\.dazpose\./.test(ui));
  check("📚: 🧍 Pose… after a build (opens H3DazPose with the new model)", /id="pdlPose"/.test(src("ext/pushpulldock/ppdazlib.js")) && /H3DazPose\.open\(st\.last && st\.last\.model\)/.test(src("ext/pushpulldock/ppdazlib.js")));
  check("lib/dazLib.js uses lib/dazMuscle.js + static/dazformula.js (nothing in server.js)", /require\("\.\/dazMuscle"\)/.test(src("lib/dazLib.js")) && /require\("\.\.\/static\/dazformula\.js"\)/.test(src("lib/dazMuscle.js")) && !/dazMuscle|dazformula/.test(src("misc/server.js")));
  check("the docs: USAGE (🧍 Pose, 💪) + CHANGELOG 2.979.0 + FEATURES", /🧍 Pose/.test(src("docs/USAGE.md")) && /2\.979\.0/.test(src("misc/CHANGELOG.md")) && /JCM/.test(src("docs/FEATURES.md")));
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
