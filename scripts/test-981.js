#!/usr/bin/env node
// bitGen Studio 2.981.0 - 📷 A DAZ BODY FROM A PHOTO, two ways (A fit the dials / B scan + wrap), the user tries the one they
// pick and keeps the better one. Tim: "can we build the full daz body from a picture and transfer the uv as well?" -> "add
// both, user can try both and keep the better one" + "try the one they choose".
// A made-up DOLL figure (OUR OWN - tubes for the torso, arms, legs, a head; no Daz content) with body dials: Body Wide, Legs
// Length, Arms Length, a Height CONTROLLER that drives a Height Shape through a formula (an ERC), and a face dial that the fit
// must leave alone. The fit must find known dial values from the doll's own measurements; the wrap must follow a wider scan.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const pt = (x, y, z) => [{ id: "x", value: x }, { id: "y", value: y }, { id: "z", value: z }];

/** the doll: tubes (rings of 10) - vertical ones round y, the arms round x (a T-pose) */
function doll() {
  const v = [], p = [], w = [], seg = (a, b, r, rings, bone, axis, rz) => {
    const b0 = v.length, NS = 10;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      for (let k = 0; k < NS; k++) { const q = k / NS * Math.PI * 2, s = Math.sin(q), co = Math.cos(q); v.push(axis === "x" ? [c[0], c[1] + r * co, c[2] + r * s] : [c[0] + r * co, c[1], c[2] + (rz || r) * s]); w.push(typeof bone === "function" ? bone(v[v.length - 1]) : bone); }
    }
    for (let i = 0; i < rings; i++) for (let k = 0; k < NS; k++) { const a1 = b0 + i * NS + k, b1 = b0 + i * NS + (k + 1) % NS; p.push([0, 0, a1, b1, b1 + NS, a1 + NS]); }
  };
  seg([0, 85, 0], [0, 145, 0], 15, 12, (q) => (q[1] < 112 ? "hip" : "chest"), "y", 10);
  seg([0, 145, 0], [0, 152, 0], 5, 2, "neck", "y");
  seg([0, 152, 0], [0, 176, 0], 9, 6, "head", "y");
  for (const s of [1, -1]) {
    const L = s > 0 ? "l" : "r";
    seg([18 * s, 140, 0], [46 * s, 140, 0], 4, 5, L + "Shldr", "x");
    seg([46 * s, 140, 0], [70 * s, 140, 0], 3.5, 5, L + "Forearm", "x");
    seg([70 * s, 140, 0], [80 * s, 140, 0], 3, 2, L + "Hand", "x");
    seg([10 * s, 95, 0], [10 * s, 50, 0], 7, 8, L + "Thigh", "y");
    seg([10 * s, 50, 0], [10 * s, 8, 0], 5, 8, L + "Shin", "y");
    seg([10 * s, 8, 0], [10 * s, 0, 0], 5, 2, L + "Foot", "y");
  }
  return { v, p, w };
}
function makeDoll(dir, opts) {
  const o = opts || {}, d = doll(), N = d.v.length, FIG = "/data/Test%20Co/Doll/Doll.dsf";
  const wr = (rel, obj) => { const f = path.join(dir, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  const bones = [["Doll", null, [0, 0, 0]], ["hip", "Doll", [0, 95, 0]], ["chest", "hip", [0, 120, 0]], ["neck", "chest", [0, 145, 0]], ["head", "neck", [0, 155, 0]]];
  for (const s of [1, -1]) { const L = s > 0 ? "l" : "r"; bones.push([L + "Shldr", "chest", [18 * s, 140, 0]], [L + "Forearm", L + "Shldr", [46 * s, 140, 0]], [L + "Hand", L + "Forearm", [70 * s, 140, 0]], [L + "Thigh", "hip", [10 * s, 95, 0]], [L + "Shin", L + "Thigh", [10 * s, 50, 0]], [L + "Foot", L + "Shin", [10 * s, 8, 0]]); }
  const joints = bones.slice(1).map(([id]) => ({ id, node: "#" + id, node_weights: { values: d.w.map((b, i) => (b === id ? [i, 1] : null)).filter(Boolean) } }));
  const mats = o.tex ? { polygon_material_groups: { values: ["Torso", "Limbs"] } } : { polygon_material_groups: { values: ["Skin"] } };
  const torsoP = new Set(); d.p.forEach((q, i) => { if (["hip", "chest", "neck", "head"].includes(d.w[q[2]])) torsoP.add(i); });
  const uvs = d.v.map((q, i) => [((q[0] + 80) / 160) * 0.98 + 0.01, (q[1] / 176) * 0.98 + 0.01 + (q[2] < 0 ? 0 : 0) + i * 0]);
  wr("data/Test Co/Doll/Doll.dsf", { asset_info: { id: FIG, type: "figure" },
    geometry_library: [Object.assign({ id: "Doll-geo", vertices: { values: d.v }, polylist: { values: d.p.map((q, i) => (o.tex ? [q[0], torsoP.has(i) ? 0 : 1, ...q.slice(2)] : q)) } }, mats, o.tex ? { default_uv_set: "/data/Test%20Co/Doll/UV.dsf#uv" } : {})],
    node_library: bones.map(([id, par, c]) => Object.assign({ id, name: id, type: par ? "bone" : "figure", center_point: pt(...c), rotation_order: /Shldr|Forearm|Hand/.test(id) ? "XYZ" : "YZX" }, par ? { parent: "#" + par } : {})),
    modifier_library: [{ id: "SkinBinding", skin: { joints } }] });
  if (o.tex) wr("data/Test Co/Doll/UV.dsf", { uv_set_library: [{ id: "uv", uvs: { values: uvs } }] });
  const M = "data/Test Co/Doll/Morphs/Test Co/", torso = (b) => ["hip", "chest"].includes(b), leg = (b) => /Thigh|Shin|Foot/.test(b), arm = (b) => /Shldr|Forearm|Hand/.test(b);
  const morph = (id, label, fn, extra) => wr(M + id + ".dsf", { modifier_library: [Object.assign({ id, group: "/Body/Proportion", channel: { id: "value", label, min: 0, max: 1, value: 0 }, morph: { deltas: { values: d.v.map((q, i) => { const r = fn(q, d.w[i]); return r ? [i, r[0], r[1], r[2]] : null; }).filter(Boolean) } } }, extra || {})] });
  morph("BodyWide", "Body Wide", (q, b) => (torso(b) ? [q[0] * 0.3, 0, q[2] * 0.15] : null));
  morph("LegsLength", "Proportion Legs Length", (q, b) => (leg(b) ? [0, -(95 - q[1]) * 0.3, 0] : null));
  morph("ArmsLength", "Proportion Arms Length", (q, b) => (arm(b) ? [(q[0] - Math.sign(q[0]) * 18) * 0.3, 0, 0] : null));
  morph("HeightShape", "Height Shape", (q) => [0, q[1] * 0.12, 0], { channel: { id: "value", label: "Height Shape", min: 0, max: 1, value: 0, visible: false },
    formulas: [{ output: "Doll:#HeightShape?value", operations: [{ op: "push", url: "Doll:#CTRLHeight?value" }] }] });
  wr(M + "CTRLHeight.dsf", { modifier_library: [{ id: "CTRLHeight", group: "/Body/Size", channel: { id: "value", label: "Height", min: -1, max: 1, value: 0 } }] });
  morph("FaceNose", "Nose Size", (q, b) => (b === "head" && q[2] > 5 ? [0, 0, 1] : null));
  const mtl = o.tex ? [{ id: "Torso", groups: ["Torso"], diffuse: { channel: { id: "diffuse", image_file: "/Runtime/Textures/Doll/skin.png" } } }, { id: "Limbs", groups: ["Limbs"], diffuse: { channel: { id: "diffuse", image_file: "/Runtime/Textures/Doll/skin.png" } } }] : [];
  if (o.tex) { const t = path.join(dir, "Runtime", "Textures", "Doll", "skin.png"); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.copyFileSync(o.tex, t); }
  wr("People/Doll/Doll.duf", { asset_info: { type: "figure" }, scene: { nodes: [{ id: "Doll", url: FIG + "#Doll" }], materials: mtl } });
  return { N, d };
}

(async () => {
  const BF = require(path.join(ROOT, "lib/dazBodyFit")), DM = require(path.join(ROOT, "lib/dazMuscle")), D = require(path.join(ROOT, "lib/dazLib")), core = require(path.join(ROOT, "lib/core")), G = require(path.join(ROOT, "lib/glbMerge")), T = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"));
  /* the photo's points */
  const pb = BF.parseBody('<think>x</think>```json {"top":[0.5,0.05],"chin":[500,180],"l_shoulder":[600,250],"r_shoulder":[400,250],"l_ankle":[550,950],"r_ankle":[450,950],"waist_l":[560,450],"waist_r":[440,450],"junk":[1,2],"l_knee":"x"}```');
  check("parseBody(): JSON in fences, <think> skipped, 0..1 rescaled, junk dropped; without the feet -> null", pb && near(pb.top[1], 50) && pb.waist_l[0] === 560 && !pb.junk && !pb.l_knee && BF.parseBody('{"top":[1,2],"l_shoulder":[1,1],"r_shoulder":[2,2]}') === null, pb);
  const pts = { top: [0, 0], chin: [0, 20], l_shoulder: [20, 30], r_shoulder: [-20, 30], l_elbow: [45, 30], l_wrist: [70, 30], l_hip: [10, 90], r_hip: [-10, 90], l_knee: [10, 130], l_ankle: [10, 170], r_ankle: [-10, 170], waist_l: [14, 70], waist_r: [-14, 70] };
  const f1 = BF.features(pts).f, big = Object.fromEntries(Object.entries(pts).map(([k, p]) => [k, [p[0] * 3 + 7, -p[1] * 3 + 500]])), f2 = BF.features(big).f;
  check("features(): proportions over the height - the same at another size, upside down (photo y down / model y up)", Object.keys(f1).length >= 7 && Object.keys(f1).every((k) => near(f1[k], f2[k], 1e-9)), { f1 });
  check("features(): an arm bent or straight down counts its length (pose-free lengths)", near(BF.features(Object.assign({}, pts, { l_elbow: [20, 55], l_wrist: [20, 80] })).f.arm, f1.arm, 1e-9));
  const aff = BF.affine([[0, 0], [1, 0], [0, 1], [1, 1]], [[10, 20], [12, 20], [10, 17], [12, 17]]);
  check("affine(): least squares from points to points (scale, flip, shift)", aff && near(aff([0.5, 0.5])[0], 11) && near(aff([0.5, 0.5])[1], 18.5));
  check("baryOf(): inside = its weights; outside = clamped onto the triangle", JSON.stringify(BF.baryOf([0.25, 0.25, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0]).map((x) => +x.toFixed(3))) === "[0.5,0.25,0.25]" && BF.baryOf([5, 5, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]).every((x) => x >= 0));
  const r1 = BF.lm([0, 0], [-5, -5], [0.5, 5], (x) => [x[0] - 1, x[1] - 2], 30);
  check("lm(): bounded least squares (x held at its 0.5 bound, y free to 2)", near(r1.x[0], 0.5, 1e-6) && near(r1.x[1], 2, 1e-4), r1.x);

  /* the doll */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daz981_")), lib = path.join(tmp, "DollLib"); makeDoll(lib);
  const realCfg = core.getConfig, realSet = core.setConfig, cfg = { daz_library: { roots: [lib] } };
  core.getConfig = () => cfg; core.setConfig = (c) => Object.assign(cfg, c);
  try {
    const duf = path.join(lib, "People/Doll/Doll.duf"), fig = D.figureData(D.sceneNodes(duf).fig, duf), ix = DM.index(fig.file);
    const dl = BF.bodyDials(ix).map((x) => x.id).sort();
    check("bodyDials(): the body's dials (the Height controller that drives a shape included) - not the face's, not a hidden one", dl.join() === "ArmsLength,BodyWide,CTRLHeight,LegsLength", dl);
    const posOf = (set) => { const sol = DM.solve(fig.file, set, { index: ix }), V = fig.geo.vertices.values, Pp = new Float64Array(V.length * 3); V.forEach((q, i) => { Pp[i * 3] = q[0]; Pp[i * 3 + 1] = q[1]; Pp[i * 3 + 2] = q[2]; }); for (const m of sol.shape) for (const d of m.deltas) { Pp[d[0] * 3] += d[1] * m.w; Pp[d[0] * 3 + 1] += d[2] * m.w; Pp[d[0] * 3 + 2] += d[3] * m.w; } return Pp; };
    const base = posOf({}), mk = BF.marks(fig, base, 1), mp = BF.measure(mk.sets, base);
    check("marks(): the doll's joints from its own bones (shoulders at x ±18, elbows ±46, wrists ±70, hips ±10, knees y 50, ankles y 8), the head's top / chin", near(mp.l_shoulder[0], 18, 0.6) && near(mp.r_elbow[0], -46, 0.6) && near(mp.l_wrist[0], 70, 0.6) && near(mp.l_hip[0], 10, 0.8) && near(mp.l_knee[1], 50, 0.8) && near(mp.r_ankle[1], 8, 0.8) && near(mp.top[1], 176, 0.1) && mp.chin[1] < 156, mp);
    check("marks(): the outline - chest / waist across the torso (30 cm), the hips' widest with the thighs (34 cm)", near(mp.chest_r[0] - mp.chest_l[0], 30, 1.5) && near(mp.waist_r[0] - mp.waist_l[0], 30, 1.5) && near(mp.hips_r[0] - mp.hips_l[0], 34, 1.5), { c: mp.chest_r[0] - mp.chest_l[0], h: mp.hips_r[0] - mp.hips_l[0] });
    // A: the photo = the doll at known dials -> the fit finds them
    const want = { BodyWide: 0.6, LegsLength: 0.4, ArmsLength: 0.3, CTRLHeight: 0.5 }, tp = BF.measure(mk.sets, posOf(want)), tf = BF.features(tp), Hcm = tf.H;
    const fit = BF.fitDials({ fig, ix, set0: {}, target: tf.f, heightCm: Hcm });
    const got = Object.fromEntries(Object.keys(want).map((k) => [k, +(fit.set[k] || 0).toFixed(3)]));
    check("A fitDials(): the doll's own body dials found from its measurements + its height (each within 0.06)", Object.keys(want).every((k) => near(got[k], want[k], 0.06)) && fit.error.after < 0.02 && fit.error.before > 0.05 && !("FaceNose" in fit.set), { got, err: fit.error, changed: fit.changed });
    const fitNoH = BF.fitDials({ fig, ix, set0: {}, target: tf.f });
    check("A fitDials(): without a height the proportions still match (the error small)", fitNoH.error.after < 0.03 && fitNoH.error.after < fitNoH.error.before / 3, fitNoH.error);
    const keepSet = BF.fitDials({ fig, ix, set0: { FaceNose: 0.7 }, target: tf.f, heightCm: Hcm });
    check("A fitDials(): the character's other dials kept (the face dial stays 0.7)", keepSet.set.FaceNose === 0.7);

    /* B: a scan (the doll made wider + taller, scaled x2, moved - as a 3D engine would give it) -> aligned -> wrapped */
    const sc = posOf({ BodyWide: 0.5, CTRLHeight: 0.3 }), d0 = doll();
    const T3 = []; for (const q of d0.p) { const vs = q.slice(2); T3.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); }
    const scanM = new Float32Array(sc.length); for (let i = 0; i < sc.length; i += 3) { scanM[i] = sc[i] * 0.02 + 3; scanM[i + 1] = sc[i + 1] * 0.02 - 1; scanM[i + 2] = sc[i + 2] * 0.02 + 0.5; }
    const idx = Uint32Array.from(T3), bin = Buffer.concat([Buffer.from(scanM.buffer), Buffer.from(idx.buffer)]);
    const mm = (a) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < a.length; i++) { mn[i % 3] = Math.min(mn[i % 3], a[i]); mx[i % 3] = Math.max(mx[i % 3], a[i]); } return { min: mn, max: mx }; };
    const J = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: [1, 0, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [Object.assign({ bufferView: 0, componentType: 5126, count: scanM.length / 3, type: "VEC3" }, mm(scanM)), { bufferView: 1, componentType: 5125, count: idx.length, type: "SCALAR" }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: scanM.byteLength }, { buffer: 0, byteOffset: scanM.byteLength, byteLength: idx.byteLength }], buffers: [{ byteLength: bin.length }] };
    const rm = BF.readGlbMesh(G.glb(J, bin));
    check("readGlbMesh(): a .glb's mesh in world space (the node's move applied), its triangles", rm.pos.length === scanM.length && near(rm.pos[0], scanM[0] + 1, 1e-5) && rm.tris.length === idx.length && rm.uv === null);
    const bodyM = Float64Array.from(base, (x) => x * 0.01), al = BF.alignScan(rm.pos, bodyM, false), aligned = BF.applyAlign(rm.pos, al), ab = mm(aligned), bb = mm(bodyM);
    check("alignScan(): the scan brought to the body - the same height, feet on its feet, the same centre", near(ab.max[1] - ab.min[1], bb.max[1] - bb.min[1], 1e-6) && near(ab.min[1], bb.min[1], 1e-6) && near((ab.min[0] + ab.max[0]) / 2, (bb.min[0] + bb.max[0]) / 2, 1e-6), { ab, bb });
    const turned = BF.applyAlign(rm.pos, Object.assign({}, al, { turn: true }));
    check("applyAlign(turn): the scan turned round (x and z the other way)", near(turned[0] - al.to[0], -(aligned[0] - al.to[0]), 1e-9) && near(turned[1], aligned[1], 1e-9));
    const BT = []; for (const q of fig.geo.polylist.values) { const vs = q.slice(2); BT.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); }
    const trust = BF.trustOf(fig, base.length / 3);
    const wr = BF.wrap({ pos: bodyM, tris: Uint32Array.from(BT), trust, scan: { pos: aligned, tris: rm.tris } });
    const wid = (P2) => { const m2 = BF.measure(mk.sets, P2); return m2.waist_r[0] - m2.waist_l[0]; }, H0 = (P2) => mm(P2).max[1] - mm(P2).min[1];
    const scanWaist = BF.measure(mk.sets, aligned.map ? aligned : aligned), wBefore = wid(bodyM), wAfter = wid(wr.pos), wScan = (() => { const s2 = Float64Array.from(aligned); return wid(s2); })();
    check("B wrap(): the body follows the scan - the waist from " + (wBefore * 100).toFixed(1) + " cm toward the scan's (most of the way)", wAfter > wBefore + 0.6 * (wScan - wBefore) && wAfter < wScan + 0.01 && wr.moved > 0.002, { wBefore, wAfter, wScan, moved: wr.moved });
    const hand = (P2) => BF.measure(mk.sets, P2).l_wrist;
    check("B wrap(): hands / feet trusted less (the wrist moves far less than the waist); the height kept within 1 cm", Math.hypot(hand(wr.pos)[0] - hand(bodyM)[0], hand(wr.pos)[1] - hand(bodyM)[1]) < (wAfter - wBefore) && Math.abs(H0(wr.pos) - H0(bodyM)) < 0.01, { hand0: hand(bodyM), hand1: hand(wr.pos) });
    void scanWaist;
    check("trustOf(): hands 0.15, head 0.4, torso 1", (() => { const w = BF.weightsOf(fig, base.length / 3); const of = (id) => trust[[...w.W.get(id).keys()][0]]; return near(of("lHand"), 0.15, 1e-6) && near(of("head"), 0.4, 1e-6) && of("chest") === 1; })());

    /* the project's own morph (B's result) -> build */
    const realPDir = core.pDir, pdir = path.join(tmp, "proj"); core.pDir = (k) => path.join(pdir, k);
    try {
      const nm = BF.saveMorph("Doll B", { figure: "People/Doll/Doll.duf", vertices: base.length / 3, deltas: [[0, 1, 0, 0]] }), nm2 = BF.saveMorph("Doll B", { vertices: 1, deltas: [] });
      check("saveMorph(): <project>/dazmorphs/<name>.json, a new name when taken; readMorph back", nm === "Doll B" && nm2 === "Doll B 2" && BF.readMorph("Doll B").deltas.length === 1 && BF.readMorph("nope") === null);
      const ob = await D.build({ root: lib, rel: "People/Doll/Doll.duf", custom: ["Doll B", "Doll B 2", "missing"] });
      check("build({custom}): the project's morph as a shape (📷 Doll B) - one for another figure refused, a missing one said", ob.info.dials.some((x) => x.label === "📷 Doll B") && ob.info.warnings.some((x) => /another figure/.test(x)) && ob.info.warnings.some((x) => /not in this project/.test(x)), ob.info);
    } finally { core.pDir = realPDir; }
  } finally { core.getConfig = realCfg; core.setConfig = realSet; fs.rmSync(tmp, { recursive: true, force: true }); }

  /* the explorer's part (pure) */
  const base = T.newChar({ root: "/L", rel: "People/Doll/Doll.duf", name: "Doll" }, 1); base.dials = { u: 0.2 }; base.wear = [{ rel: "s.duf", name: "Shirt" }];
  const tc = T.tryChar(base, "A", 2);
  check("tryChar(): a try = a new character (\"Doll · 📷 A 2\") - the same figure, wear, dials (copies); the route kept", tc.name === "Doll · 📷 A 2" && tc.fig.rel === base.fig.rel && tc.wear[0].name === "Shirt" && tc.wear !== base.wear && tc.dials.u === 0.2 && tc.from === "A" && tc.id !== base.id);
  check("cleanScene(): a try's morphs / paint / route kept", JSON.stringify(T.cleanScene({ chars: [Object.assign(tc, { custom: ["Doll B"], paint: { mode: "scan", scan: "x.glb" } })] }).chars[0].custom) === '["Doll B"]' && T.cleanScene({ chars: [tc] }).chars[0].paint.mode === "scan" && T.ROUTES.A && T.ROUTES.B);

  /* wiring + the words */
  check("routes/dazBody.js mounted from routes/index.js (not server.js): marks / fit / scan / wrap", /require\("\.\/dazBody"\)\.mount\(app\)/.test(src("routes/index.js")) && !/dazBody/.test(src("misc/server.js")) && ["/api/dazlib/body/marks", "/api/dazlib/body/fit", "/api/dazlib/body/scan", "/api/dazlib/body/wrap"].every((x) => src("routes/dazBody.js").includes(x)));
  check("the build route: paint (photo / face / scan) + custom morphs", /pt\.mode === "scan"/.test(src("routes/dazLibrary.js")) && /custom: Array\.isArray\(b\.custom\)/.test(src("routes/dazLibrary.js")) && /paintScan/.test(src("lib/dazLib.js")) && /paintPhoto/.test(src("lib/dazLib.js")));
  const ui = src("ext/pushpulldock/ppdaztools.js");
  check("🧭 Explorer ▸ 📷 Body from a photo: the picker, a back photo, the way (A / B), height, paint, the 3D engine, turn, ▶ Try - the models checked before B", /id="dzPhoto"/.test(ui) && /dzBackOn/.test(ui) && /id="dzRoute"/.test(ui) && /id="dzHeight"/.test(ui) && /id="dzPaint"/.test(ui) && /id="dzEngine"/.test(ui) && /id="dzTurn"/.test(ui) && /id="dzTry"/.test(ui) && /MF\.ensure\(\{ files: need\.files/.test(ui));
  check("the docs: USAGE (📷 Body from a photo, both ways) + CHANGELOG 2.981.0 + FEATURES", /📷 Body from a photo/.test(src("docs/USAGE.md")) && /2\.981\.0/.test(src("misc/CHANGELOG.md")) && /Body from a photo/.test(src("docs/FEATURES.md")));
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
