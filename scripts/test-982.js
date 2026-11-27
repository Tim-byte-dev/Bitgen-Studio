#!/usr/bin/env node
// bitGen Studio 2.982.0 - 📏 A BODY FROM HEIGHT / WEIGHT / TAPE MEASUREMENTS + 🎬 MIXAMO MOTION ON A DAZ CHARACTER.
// Tim: "is it possible to create the model based on height and weight. And can we add mixamo motion to our character?" ->
// "yes please". Made-up data only (OUR OWN): test-981's DOLL figure, test-979's ARM figure (its elbow JCM), a Mixamo-LIKE
// skeleton (mixamoFbx() writes it as an ASCII FBX for the browser test - never a real Mixamo file).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
/** a Mixamo-like ASCII FBX (OUR OWN test data): a T-pose skeleton "mixamorig:*" in cm + rotation / translation keys */
function mixamoFbx(o) {
  const x = o || {}, T = 46186158000, B = [["Hips", null, [0, 100, 0]], ["Spine", "Hips", [0, 10, 0]], ["Spine1", "Spine", [0, 12, 0]], ["Spine2", "Spine1", [0, 14, 0]], ["Neck", "Spine2", [0, 16, 0]], ["Head", "Neck", [0, 10, 0]], ["HeadTop_End", "Head", [0, 18, 0]]];
  for (const [S, s] of [["Left", 1], ["Right", -1]]) B.push([S + "Shoulder", "Spine2", [6 * s, 12, 0]], [S + "Arm", S + "Shoulder", [12 * s, 0, 0]], [S + "ForeArm", S + "Arm", [28 * s, 0, 0]], [S + "Hand", S + "ForeArm", [25 * s, 0, 0]], [S + "UpLeg", "Hips", [9 * s, -5, 0]], [S + "Leg", S + "UpLeg", [0, -42, 0]], [S + "Foot", S + "Leg", [0, -42, 0]], [S + "ToeBase", S + "Foot", [0, -6, 12]]);
  const id = (i) => 100000 + i, L = ["; FBX 7.4.0 project file", "FBXHeaderExtension:  {", "\tFBXHeaderVersion: 1003", "\tFBXVersion: 7400", "}", "GlobalSettings:  {", "\tVersion: 1000", "\tProperties70:  {",
    '\t\tP: "UpAxis", "int", "Integer", "",1', '\t\tP: "UpAxisSign", "int", "Integer", "",1', '\t\tP: "FrontAxis", "int", "Integer", "",2', '\t\tP: "FrontAxisSign", "int", "Integer", "",1', '\t\tP: "CoordAxis", "int", "Integer", "",0', '\t\tP: "CoordAxisSign", "int", "Integer", "",1', '\t\tP: "UnitScaleFactor", "double", "Number", "",1', "\t}", "}", "Objects:  {"];
  const C = [];
  B.forEach(([n, par, t], i) => {
    L.push("\tModel: " + id(i) + ', "Model::mixamorig:' + n + '", "LimbNode" {', "\t\tVersion: 232", "\t\tProperties70:  {", '\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",' + t.join(","), "\t\t}", "\t}");
    C.push('\tC: "OO",' + id(i) + "," + (par ? id(B.findIndex((b) => b[0] === par)) : 0));
  });
  const dur = x.duration || 1, keys = x.keys || {}, nk = 1 + (x.steps || 10);
  L.push('\tAnimationStack: 900001, "AnimStack::' + (x.clip || "mixamo.com") + '", "" {', "\t\tProperties70:  {", '\t\t\tP: "LocalStop", "KTime", "Time", "",' + Math.round(dur * T), "\t\t}", "\t}", '\tAnimationLayer: 900002, "AnimLayer::BaseLayer", "" {', "\t}");
  C.push('\tC: "OO",900002,900001');
  let nid = 910000;
  for (const [bone, fn] of Object.entries(keys)) {
    const bi = B.findIndex((b) => b[0] === bone); if (bi < 0) continue;
    for (const [attr, prop] of [["R", "Lcl Rotation"], ["T", "Lcl Translation"]]) {
      const vals = Array.from({ length: nk }, (_, k) => fn(k / (nk - 1) * dur)).map((v) => v && v[attr]); if (!vals.every(Boolean)) continue;
      const cn = nid++; L.push("\tAnimationCurveNode: " + cn + ', "AnimCurveNode::' + attr + '", "" {', "\t\tProperties70:  {", '\t\t\tP: "d|X", "Number", "", "A",0', '\t\t\tP: "d|Y", "Number", "", "A",0', '\t\t\tP: "d|Z", "Number", "", "A",0', "\t\t}", "\t}");
      C.push('\tC: "OO",' + cn + ",900002", '\tC: "OP",' + cn + "," + id(bi) + ', "' + prop + '"');
      ["X", "Y", "Z"].forEach((ax, a) => {
        const cv = nid++, times = vals.map((_, k) => Math.round(k / (nk - 1) * dur * T)), v = vals.map((q) => q[a]);
        L.push("\tAnimationCurve: " + cv + ', "AnimCurve::", "" {', "\t\tDefault: 0", "\t\tKeyVer: 4008", "\t\tKeyTime: *" + nk + " {", "\t\t\ta: " + times.join(","), "\t\t}", "\t\tKeyValueFloat: *" + nk + " {", "\t\t\ta: " + v.join(","), "\t\t}", "\t}");
        C.push('\tC: "OP",' + cv + "," + cn + ', "d|' + ax + '"');
      });
    }
  }
  L.push("}", "Connections:  {", ...C, "}");
  return L.join("\n") + "\n";
}
const grab = (file, a, b) => { const t = fs.readFileSync(path.join(__dirname, file), "utf8"); return t.slice(t.indexOf(a), t.indexOf(b)); };
const { makeDoll } = new Function("require", "path", "fs", grab("test-981.js", "const pt = ", "(async () => {") + "; return { makeDoll };")(require, path, fs);
const { makeLib: makeArm } = new Function("require", "path", "fs", grab("test-979.js", "const pt = ", "(async () => {") + "; return { makeLib };")(require, path, fs);

(async () => {
  const FX = require(path.join(ROOT, "static/dazformula.js")), MO = require(path.join(ROOT, "static/dazmotion.js")), BF = require(path.join(ROOT, "lib/dazBodyFit")), DM = require(path.join(ROOT, "lib/dazMuscle")), D = require(path.join(ROOT, "lib/dazLib")), core = require(path.join(ROOT, "lib/core")), G = require(path.join(ROOT, "lib/glbMerge")), GA = require(path.join(ROOT, "lib/glbAnim")), PO = require(path.join(ROOT, "ext/pushpulldock/ppdazpose.js"));
  /* the maths */
  let worst = 0;
  for (const o of ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"]) for (let k = 0; k < 60; k++) { const a = { x: Math.sin(k * 1.3) * 80, y: Math.cos(k * 0.7) * 80, z: Math.sin(k * 2.1) * 80 }, b = { order: o, orient: [k % 30, 5, -k % 20] }, q = FX.boneQuat(b, a), q2 = FX.boneQuat(b, FX.boneChannels(b, q)); worst = Math.max(worst, 1 - Math.abs(q.reduce((s, v, i) => s + v * q2[i], 0))); }
  check("boneChannels(): a turn back to the bone's own channel values - exact for all six rotation orders, oriented bones too", worst < 1e-12, worst);
  check("hullPerimeter(): a tape round the points (a 1 x 1 square = 4; 64 points on a circle r 10 ≈ 2πr)", near(BF.hullPerimeter([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]), 4) && near(BF.hullPerimeter(Array.from({ length: 64 }, (_, i) => [10 * Math.cos(i / 64 * 6.2832), 10 * Math.sin(i / 64 * 6.2832)])), 62.83, 0.1));
  const cube = new Float64Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]), ct = Uint32Array.from([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 3, 0, 4, 3, 4, 7]);
  check("volume(): a closed mesh's volume (a unit cube = 1)", near(BF.volume(cube, ct), 1, 1e-9));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daz982_")), lib = path.join(tmp, "DollLib"), alib = path.join(tmp, "ArmLib"); makeDoll(lib); makeArm(alib, true);
  const realCfg = core.getConfig, realSet = core.setConfig, cfg = { daz_library: { roots: [lib, alib] } };
  core.getConfig = () => cfg; core.setConfig = (c) => Object.assign(cfg, c);
  try {
    /* 📏 height / weight / tapes on the doll */
    const duf = path.join(lib, "People/Doll/Doll.duf"), fig = D.figureData(D.sceneNodes(duf).fig, duf), ix = DM.index(fig.file);
    const m0 = BF.measureNow(fig, ix, {}), mW = BF.measureNow(fig, ix, { BodyWide: 0.5 }), mH = BF.measureNow(fig, ix, { CTRLHeight: 0.5 });
    check("measureNow(): the doll 176 cm tall, a weight from its volume, tapes round the chest / waist / hips", near(m0.height, 176, 0.01) && m0.weight > 5 && m0.chest > 70 && m0.waist > 70 && m0.hips > m0.waist, m0);
    check("measureNow(): Body Wide = heavier + a bigger waist; the Height dial (a controller, through its formula) = taller", mW.weight > m0.weight * 1.05 && mW.waist > m0.waist * 1.1 && near(mW.height, 176, 0.01) && near(mH.height, 176 * 1.06, 0.05), { mW, mH });
    const want = BF.measureNow(fig, ix, { BodyWide: 0.5, LegsLength: 0.3, CTRLHeight: 0.4 }), tgt = { height: want.height, weight: want.weight, waist: want.waist };
    const fm = BF.fitMeasures({ fig, ix, set0: {}, target: tgt, build: "average" });
    check("fitMeasures(): a height, a weight and a waist reached with the figure's own dials (each within 1%)", ["height", "weight", "waist"].every((k) => Math.abs(fm.after[k] - tgt[k]) / tgt[k] < 0.01) && fm.changed.length >= 2, { tgt, after: fm.after, changed: fm.changed });
    const slim = BF.fitMeasures({ fig, ix, set0: {}, target: { height: 180 }, build: "slim" });
    check("fitMeasures(build slim): only the dials of that build (no Body Wide); 180 cm reached", !slim.changed.some((c) => c.id === "BodyWide") && Math.abs(slim.after.height - 180) < 1, slim.changed);
    check("fitMeasures(): nothing asked = nothing moved", BF.fitMeasures({ fig, ix, set0: { BodyWide: 0.2 }, target: {} }).changed.length === 0);
  } catch (e) { check("📏 crashed: " + e.message, false); }

  /* 🎬 the retarget: a Mixamo T-pose skeleton onto a Daz A-pose one */
  const srcB = {}, loc = { Hips: [0, 100, 0], Spine: [0, 10, 0], Spine1: [0, 12, 0], Spine2: [0, 14, 0], Neck: [0, 16, 0], Head: [0, 10, 0], LeftShoulder: [6, 12, 0], LeftArm: [12, 0, 0], LeftForeArm: [28, 0, 0], LeftHand: [25, 0, 0], LeftUpLeg: [9, -5, 0], LeftLeg: [0, -42, 0], LeftFoot: [0, -42, 0] };
  const par = { Spine: "Hips", Spine1: "Spine", Spine2: "Spine1", Neck: "Spine2", Head: "Neck", LeftShoulder: "Spine2", LeftArm: "LeftShoulder", LeftForeArm: "LeftArm", LeftHand: "LeftForeArm", LeftUpLeg: "Hips", LeftLeg: "LeftUpLeg", LeftFoot: "LeftLeg" };
  const wp = (n) => (par[n] ? wp(par[n]).map((v, i) => v + loc[n][i]) : loc[n].slice());
  for (const n of Object.keys(loc)) srcB["mixamorig" + n] = { parent: par[n] ? "mixamorig" + par[n] : null, p: wp(n), q: [0, 0, 0, 1] };
  const c45 = Math.SQRT1_2, A = (p, d, L) => p.map((v, i) => v + d[i] * L), sh = [0.16, 1.42, 0], dirA = [c45, -c45, 0], el = A(sh, dirA, 0.28), wr = A(el, dirA, 0.25);
  const daz = { hip: { parent: null, pos: [0, 1.0, 0] }, abdomenLower: { parent: "hip", pos: [0, 1.1, 0] }, chestLower: { parent: "abdomenLower", pos: [0, 1.3, 0] }, chestUpper: { parent: "chestLower", pos: [0, 1.38, 0] },
    neckLower: { parent: "chestUpper", pos: [0, 1.5, 0] }, head: { parent: "neckLower", pos: [0, 1.6, 0] }, lCollar: { parent: "chestUpper", pos: [0.04, 1.42, 0] }, lShldrBend: { parent: "lCollar", pos: sh }, lShldrTwist: { parent: "lShldrBend", pos: A(sh, dirA, 0.12) },
    lForearmBend: { parent: "lShldrTwist", pos: el }, lHand: { parent: "lForearmBend", pos: wr }, lThighBend: { parent: "hip", pos: [0.09, 0.95, 0] }, lShin: { parent: "lThighBend", pos: [0.09, 0.5, 0] }, lFoot: { parent: "lShin", pos: [0.09, 0.08, 0] } };
  const map = MO.mapBones(Object.keys(daz), Object.keys(srcB));
  check("mapBones(): Mixamo -> Genesis 8 (hip, abdomenLower, chestLower, lCollar, lShldrBend, lForearmBend ...); twist / chestUpper left to follow", map.hip === "mixamorigHips" && map.lShldrBend === "mixamorigLeftArm" && map.lForearmBend === "mixamorigLeftForeArm" && map.lCollar === "mixamorigLeftShoulder" && map.chestLower === "mixamorigSpine2" && !map.lShldrTwist && !map.chestUpper, map);
  const g9 = MO.mapBones(["hip", "pelvis", "spine1", "spine2", "spine3", "neck1", "head", "l_shoulder", "l_upperarm", "l_forearm", "l_hand", "l_thigh", "l_shin", "l_foot", "l_index1"], ["mixamorig:Hips", "mixamorig:Spine", "mixamorig:LeftArm", "mixamorig1:LeftForeArm", "LeftHandIndex1", "mixamorig_LeftUpLeg"]);
  check("mapBones(): Genesis 9 names, the prefix written any way (mixamorig: / mixamorig1: / none / mixamorig_), fingers", g9.l_upperarm === "mixamorig:LeftArm" && g9.l_forearm === "mixamorig1:LeftForeArm" && g9.l_index1 === "LeftHandIndex1" && g9.spine1 === "mixamorig:Spine" && g9.l_thigh === "mixamorig_LeftUpLeg", g9);
  const S = MO.setup({ daz, src: srcB, map }), world = (fr) => { const W = {}; for (const id of S.order) { const p = daz[id].parent; W[id] = p ? FX.qmul(W[p], fr.local[id]) : fr.local[id]; } return W; };
  const dir = (W, a, b) => { const d = FX.qrot(W[a], daz[b].pos.map((v, i) => v - daz[a].pos[i])), l = Math.hypot(...d); return d.map((v) => +(v / l).toFixed(4)); };
  const restSrc = Object.fromEntries(Object.entries(srcB).map(([k, v]) => [k, { q: v.q, p: v.p }])), W0 = world(MO.frame(S, restSrc));
  check("setup + frame: the Mixamo T-pose puts the Daz A-pose arm OUT TO THE SIDE (the rest-pose correction), the forearm in line", JSON.stringify(dir(W0, "lShldrBend", "lForearmBend")) === "[1,0,0]" && JSON.stringify(dir(W0, "lForearmBend", "lHand")) === "[1,0,0]", { up: dir(W0, "lShldrBend", "lForearmBend") });
  const bend = Object.assign({}, restSrc, { mixamorigLeftForeArm: { q: FX.euler("XYZ", 0, -90, 0), p: srcB.mixamorigLeftForeArm.p }, mixamorigLeftHand: { q: FX.euler("XYZ", 0, -90, 0), p: srcB.mixamorigLeftHand.p } });
  const fb = MO.frame(S, bend), W1 = world(fb);
  check("frame: the elbow bent forward in Mixamo = the Daz forearm pointing forward (+Z); the twist bone keeps its parent's turn", JSON.stringify(dir(W1, "lForearmBend", "lHand")) === "[0,0,1]" && Math.abs(fb.local.lShldrTwist[3]) > 0.999999, dir(W1, "lForearmBend", "lHand"));
  const walk = Object.assign({}, restSrc, { mixamorigHips: { q: [0, 0, 0, 1], p: [10, 100, 50] } }), fw = MO.frame(S, walk), fi = MO.frame(S, walk, { inPlace: true });
  check("frame: the hips' walk scaled to the Daz legs (the Daz hips 0.92 m over its feet, Mixamo's 89 cm over its feet); In place = no x / z", near(S.scale, 0.92 / 89, 1e-12) && near(fw.hips[2], 50 * 0.92 / 89, 1e-9) && near(fw.hips[0], 10 * 0.92 / 89, 1e-9) && fi.hips[0] === 0 && fi.hips[2] === 0, { scale: S.scale, fw: fw.hips });

  /* 🎬 + 💪: the elbow bent by a Mixamo clip drives the arm figure's own JCM */
  try {
    const out = await D.build({ root: alib, rel: "People/Arm/Arm.duf" }), J = G.parse(out.glb).json, dz = J.meshes[0].extras.daz;
    const aB = {}; for (const [id, b] of Object.entries(dz.bones)) aB[id] = { parent: b.parent, pos: (J.nodes.find((n) => n.name === b.name) || {}).translation };
    const posW = (id) => (aB[id].parent && aB[aB[id].parent] ? posW(aB[id].parent).map((v, i) => v + aB[id].pos[i]) : aB[id].pos.slice());
    const dazArm = Object.fromEntries(Object.keys(aB).map((id) => [id, { parent: aB[id].parent && aB[aB[id].parent] ? aB[id].parent : null, pos: posW(id) }]));
    const srcArm = { mixamorigLeftArm: { parent: null, p: [0, 140, 0], q: [0, 0, 0, 1] }, mixamorigLeftForeArm: { parent: "mixamorigLeftArm", p: [30, 140, 0], q: [0, 0, 0, 1] }, mixamorigLeftHand: { parent: "mixamorigLeftForeArm", p: [55, 140, 0], q: [0, 0, 0, 1] } };
    const S2 = MO.setup({ daz: dazArm, src: srcArm }), qb = FX.euler("XYZ", 0, -90, 0);
    const f2 = MO.frame(S2, { mixamorigLeftArm: srcArm.mixamorigLeftArm, mixamorigLeftForeArm: { q: qb, p: srcArm.mixamorigLeftForeArm.p }, mixamorigLeftHand: { q: qb, p: srcArm.mixamorigLeftHand.p } });
    const ch = MO.channels(dz.bones, f2.local), w = PO.muscleWeights(dz, ch, FX);
    check("channels(): the retargeted elbow = the forearm's own Y channel -90°, so its JCM is fully on (and the chained one half)", near(ch.lForearm.y, -90, 1e-6) && near(w.pJCMElbow, 1, 1e-6) && near(w.pJCMElbowB, 0.5, 1e-6), { ch, w });
    /* ⤓ the bake: a glTF animation on a copy of the .glb */
    const nT = J.meshes[0].extras.targetNames.length, times = [0, 0.5, 1], rot = { lForearm: [0, 0, 0, 1, ...qb, ...qb] }, tr = { lShldr: [0, 1.4, 0, 0, 1.4, 0.1, 0, 1.4, 0.2] };
    const wts = []; for (let f = 0; f < 3; f++) for (let k = 0; k < nT; k++) wts.push(J.meshes[0].extras.targetNames[k] === "jcm:pJCMElbow" ? [0, 1, 1][f] : 0);
    const r = GA.addAnimation(out.glb, { name: "Waving", times, rotations: Object.assign({ nope: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] }, rot), translations: tr, weights: wts }), J2 = G.parse(r.glb).json, an = J2.animations[0];
    const inA = J2.accessors[an.samplers[0].input], wch = an.channels.filter((c) => c.target.path === "weights");
    check("addAnimation(): a glTF animation - rotation / translation / the muscle shapes' weights on the body; times 0..1; an unknown bone skipped", an.name === "Waving" && an.channels.length === 2 + wch.length && wch.length >= 1 && inA.min[0] === 0 && inA.max[0] === 1 && r.skipped === 1
      && J2.accessors[an.samplers[an.channels.find((c) => c.target.path === "weights").sampler].output].count === 3 * nT && J2.nodes[an.channels[0].target.node].name === "lForearm", { ch: an.channels, skipped: r.skipped });
    check("addAnimation(): the model itself unchanged (its meshes, skins, accessors kept)", J2.meshes.length === J.meshes.length && J2.skins.length === J.skins.length && J2.accessors.length > J.accessors.length);
    let threw = false; try { GA.addAnimation(out.glb, { times: [0, 1], rotations: { nope: [0, 0, 0, 1, 0, 0, 0, 1] } }); } catch (e) { threw = /none of the animated bones/.test(e.message); }
    check("addAnimation(): nothing that fits this model = said, nothing written", threw);
  } catch (e) { check("🎬 crashed: " + e.message, false); }
  finally { core.getConfig = realCfg; core.setConfig = realSet; fs.rmSync(tmp, { recursive: true, force: true }); }

  /* the test FBX + wiring */
  const fbx = mixamoFbx({ duration: 1, keys: { LeftForeArm: (t) => ({ R: [0, -90 * t, 0] }) } });
  check("mixamoFbx(): our own Mixamo-like ASCII FBX (mixamorig: LimbNodes, an animation stack, curves)", /FBXVersion: 7400/.test(fbx) && (fbx.match(/"LimbNode"/g) || []).length === 23 && /AnimStack::mixamo\.com/.test(fbx) && (fbx.match(/AnimationCurve: /g) || []).length === 3);
  const ui = src("ext/pushpulldock/ppdazpose.js"), tools = src("ext/pushpulldock/ppdaztools.js");
  check("🕺 Pose ▸ 🎬 Motion (Mixamo): the FBX read with the page's FBXLoader, retargeted (static/dazmotion.js), ▶ / scrub / In place / speed, ⤓ Bake; the end frame never wraps", /new T\.FBXLoader\(\)\.parse/.test(ui) && /\/static\/dazmotion\.js/.test(ui) && /id="pdpPlay"/.test(ui) && /id="pdpTime"/.test(ui) && /id="pdpInPlace"/.test(ui) && /id="pdpBake"/.test(ui) && /M\.dur - 1e-4/.test(ui) && /Without Skin/.test(ui));
  check("🧭 Explorer ▸ 📏 Height & weight: height, weight, chest / waist / hips, build, 📏 Measure it, ▶ Make (a new character)", ["dzMH", "dzMW", "dzMC", "dzMWa", "dzMHi", "dzMBuild", "dzMRead", "dzMMake"].every((id) => tools.includes('id="' + id + '"')) && /measure_only: true/.test(tools));
  check("routes/dazBody.js: /api/dazlib/body/measures + /api/dazlib/motion/bake (lib/glbAnim.js)", /\/api\/dazlib\/body\/measures/.test(src("routes/dazBody.js")) && /\/api\/dazlib\/motion\/bake/.test(src("routes/dazBody.js")) && /glbAnim/.test(src("routes/dazBody.js")));
  check("the docs: USAGE (📏 Height & weight, 🎬 Motion) + CHANGELOG 2.982.0 + FEATURES", /📏 Height & weight/.test(src("docs/USAGE.md")) && /🎬 Motion/.test(src("docs/USAGE.md")) && /2\.982\.0/.test(src("misc/CHANGELOG.md")) && /Mixamo/.test(src("docs/FEATURES.md")));
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
