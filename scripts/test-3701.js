#!/usr/bin/env node
/* bitGen Studio — 3.7.1: A DAZ FIGURE'S SKELETON AND PIECES FOLLOW ITS SHAPE (lib/dazRigFollow.js, lib/dazLib.js build).
 * Tim: "when the g9 model is converted from our body and face, it seems to lose it's bones and looks terrible" - a shape from
 * bitGen (📷 B's scan wrap, 🙂 the 3D head, 👤 Make this person, a dial) moved the body but not its joints, and not its eyes /
 * mouth (Genesis 9's are figures of their own). A made-up library (OUR OWN tiny figure - no Daz content): a "wall" body
 * 170 cm tall, hip / head / eye bones, eyes conformed, a Tall dial (+10 % height at 1). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const RF = require(path.join(ROOT, "lib/dazRigFollow.js"));

// ---- the pure parts
{
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = new Float32Array(3000); for (let i = 0; i < pts.length; i++) pts[i] = rnd() * 0.5;
  const G = new RF.Grid(pts, 0.02);
  let same = true;
  for (let t = 0; t < 30; t++) {
    const q = [rnd() * 0.5, rnd() * 0.5, rnd() * 0.5];
    const brute = [...Array(1000).keys()].map((i) => [i, Math.hypot(pts[i * 3] - q[0], pts[i * 3 + 1] - q[1], pts[i * 3 + 2] - q[2])]).sort((a, b) => a[1] - b[1]).slice(0, 8);
    const got = G.near(q[0], q[1], q[2], 8, 1);
    if (got.map((g) => g[0]).join() !== brute.map((g) => g[0]).join()) { same = false; break; }
  }
  check("Grid.near: the same 8 nearest as looking at every point", same);
  const base = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), shaped = base.map((v, i) => v + [0.1, 0.2, 0.3][i % 3]);
  const f = RF.follow(new Float32Array([0.5, 0.5, 0.05, 3, 3, 0]), { base, shaped });
  check("follow: a piece near the body and one far off (the coarse grid) both carried by the body's movement", near(f[0], 0.6, 1e-5) && near(f[1], 0.7, 1e-5) && near(f[2], 0.35, 1e-5) && near(f[3], 3.1, 1e-5) && near(f[5], 0.3, 1e-5), Array.from(f));
  check("moved: the largest vertex movement", near(RF.moved(base, shaped), Math.hypot(0.1, 0.2, 0.3), 1e-6));
  // a stretched column: the lower half skinned to bone 0, the upper to bone 1; stretching the upper half moves only bone 1's joint
  const col = [], J = [], W = [];
  for (let y = 0; y <= 20; y++) for (const x of [-0.1, 0.1]) { col.push(x, y * 0.1, 0); J.push(y < 10 ? 0 : 1, 0, 0, 0); W.push(1, 0, 0, 0); }
  const cb = new Float32Array(col), cs = cb.map((v, i) => (i % 3 === 1 && v > 1 ? 1 + (v - 1) * 1.5 : v));
  const stock = [{ id: "a", parent: null, center: [0, 50, 0] }, { id: "b", parent: "a", center: [0, 150, 0], end: [0, 200, 0] }];
  const r = RF.fitBones(stock, { base: cb, shaped: cs, J: new Uint16Array(J), W: new Float32Array(W) }, 0.01);
  check("fitBones: a joint moves with the body it skins (the stretched part's joint up, the other stays)", near(r.bones[0].center[1], 50, 0.5) && r.bones[1].center[1] > 170 && r.bones[1].center[1] < 180 && r.bones[1].end[1] > 240, r.bones.map((b) => [b.center, b.end]));
  check("fitBones: the stock bones are not changed (copies - build() fits from them every time)", stock[1].center[1] === 150 && stock[1].end[1] === 200 && r.bones[1] !== stock[1]);
}

// ---- 📷 B's wrap: Tim's screenshot - one arm the photo holds down by the side, the figure's in an A-pose
{
  const BF = require(path.join(ROOT, "lib/dazBodyFit.js"));
  /** a square tube p0 -> p1 (half-width r, seg rings, capped), wound outward -> {pos, tris} appended to M */
  function tube(M, p0, p1, r, seg) {
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(...d), u = d.map((x) => x / L);
    const a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], v = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]], lv = Math.hypot(...v); for (let k = 0; k < 3; k++) v[k] /= lv;
    const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], b0 = M.pos.length / 3, vs = [];
    for (let s2 = 0; s2 <= seg; s2++) for (const [cv, cw] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) { const t = s2 / seg; const q = [0, 1, 2].map((k) => p0[k] + d[k] * t + (v[k] * cv + w[k] * cw) * r); M.pos.push(...q); }
    const T = [];
    for (let s2 = 0; s2 < seg; s2++) for (let e = 0; e < 4; e++) { const A = b0 + s2 * 4 + e, B = b0 + s2 * 4 + (e + 1) % 4, C = A + 4, D2 = B + 4; T.push(A, B, D2, A, D2, C); }
    T.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2); const e0 = b0 + seg * 4; T.push(e0, e0 + 1, e0 + 2, e0, e0 + 2, e0 + 3);
    let vol = 0; for (let t = 0; t < T.length; t += 3) { const P3 = (i) => [M.pos[i * 3], M.pos[i * 3 + 1], M.pos[i * 3 + 2]], A = P3(T[t]), B = P3(T[t + 1]), C = P3(T[t + 2]); vol += A[0] * ((B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1])) + A[1] * ((B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2])) + A[2] * ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])); }
    if (vol < 0) for (let t = 0; t < T.length; t += 3) { const x2 = T[t + 1]; T[t + 1] = T[t + 2]; T[t + 2] = x2; }
    M.tris.push(...T);
    return [...Array((seg + 1) * 4).keys()].map((i) => b0 + i);
  }
  const body = { pos: [], tris: [] }, scan = { pos: [], tris: [] };
  tube(body, [0, 0.9, 0], [0, 1.45, 0], 0.15, 12); tube(body, [0, 1.45, 0], [0, 1.65, 0], 0.08, 4);   // torso, head
  const rArm = tube(body, [-0.16, 1.4, 0], [-0.58, 0.98, 0], 0.04, 12), lArm = tube(body, [0.16, 1.4, 0], [0.58, 0.98, 0], 0.04, 12);
  tube(scan, [0, 0.9, 0], [0, 1.45, 0], 0.17, 12); tube(scan, [0, 1.45, 0], [0, 1.65, 0], 0.085, 4);   // the person: a bit wider than the figure
  tube(scan, [-0.235, 1.4, 0], [-0.235, 0.85, 0], 0.045, 12);                   // their right arm held DOWN by the side
  tube(scan, [0.16, 1.4, 0], [0.58, 0.98, 0], 0.05, 12);                        // their left arm as the figure's, a little thicker
  const pos = Float64Array.from(body.pos), sp = { pos: Float64Array.from(scan.pos), tris: Uint32Array.from(scan.tris) }, tris = Uint32Array.from(body.tris);
  const shapeChange = (P, ids) => { const c0 = [0, 1, 2].map((k) => ids.reduce((s3, i) => s3 + P[i * 3 + k] - pos[i * 3 + k], 0) / ids.length); return Math.max(...ids.map((i) => Math.hypot(...[0, 1, 2].map((k) => P[i * 3 + k] - pos[i * 3 + k] - c0[k])))); };
  const old = BF.wrap({ pos, tris, scan: sp, facing: -2, maxMove: 10 });         // the old wrap: any surface, no limit
  check("the case reproduces the screenshot: the old wrap bends the right arm out of shape (" + (shapeChange(old.pos, rArm) * 100).toFixed(1) + " cm)", shapeChange(old.pos, rArm) > 0.04, shapeChange(old.pos, rArm));
  const parts = [{ name: "right arm", verts: rArm }, { name: "left arm", verts: lArm }];
  const nw = BF.wrap({ pos, tris, scan: sp, parts });
  check("3.7.1: the right arm the photo holds differently is KEPT and said; the left arm (the same pose) is wrapped", nw.kept.map((k) => k.name).join() === "right arm", nw.kept);
  check("…the kept arm keeps its shape exactly (it moves as one with its shoulder)", shapeChange(nw.pos, rArm) < 1e-9, shapeChange(nw.pos, rArm));
  const thick = (P, ids) => { const c = [0, 1, 2].map((k) => ids.reduce((s3, i) => s3 + P[i * 3 + k], 0) / ids.length); return ids.reduce((s3, i) => s3 + Math.hypot(P[i * 3] - c[0], P[i * 3 + 2] - c[2]), 0) / ids.length; };
  const mid = (ids) => ids.slice(16, 36);                                       // rings away from the shoulder and the hand end
  check("…the left arm takes the photo's thicker arm", thick(nw.pos, mid(lArm)) > thick(pos, mid(lArm)) + 0.004, [thick(pos, mid(lArm)), thick(nw.pos, mid(lArm))]);
  let worst = 0; for (let i = 0; i < pos.length / 3; i++) worst = Math.max(worst, Math.hypot(nw.pos[i * 3] - pos[i * 3], nw.pos[i * 3 + 1] - pos[i * 3 + 1], nw.pos[i * 3 + 2] - pos[i * 3 + 2]));
  check("…no vertex moved more than 7 cm (a body's shape differs by centimetres; more is another pose)", worst <= 0.0701, worst);
  const torso = [...Array(13 * 4).keys()];
  check("…and the torso widened toward the photo's (15 -> 17 cm half-width)", thick(nw.pos, torso.slice(8, 40)) > thick(pos, torso.slice(8, 40)) + 0.01, [thick(pos, torso.slice(8, 40)), thick(nw.pos, torso.slice(8, 40))]);
  const al = BF.alignScan(Float64Array.from(scan.pos), pos, false, scan.tris, body.tris);
  const box0 = (() => { let mn = 1e9, mx = -1e9; for (let i = 0; i < scan.pos.length; i += 3) { mn = Math.min(mn, scan.pos[i]); mx = Math.max(mx, scan.pos[i]); } return (mn + mx) / 2; })();
  check("alignScan: centred on the head over the torso, not the box (its middle " + (box0 * 100).toFixed(0) + " cm off) - the arm held down does not pull the scan sideways", Math.abs(al.from[0] - al.to[0]) < 0.002 && Math.abs(box0) > 0.1, { al, box0 });
}

// ---- build(): a made-up library
const D = require(path.join(ROOT, "lib/dazLib.js"));
const pt = (x, y, z) => [{ id: "x", value: x }, { id: "y", value: y }, { id: "z", value: z }];
function grid(nx, ny, x0, y0, sx, sy, z) {
  const v = [], p = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v.push([x0 + sx * i / nx, y0 + sy * j / ny, z]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; p.push([0, 0, a, a + 1, a + nx + 2, a + nx + 1]); }
  return { v, p };
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rig3701-"));
const w = (rel, obj) => { const f = path.join(dir, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
const g = grid(10, 34, -20, 0, 40, 170, 10);
w("data/T/Mini/Mini.dsf", { geometry_library: [{ id: "Mini-geo", vertices: { values: g.v }, polygon_material_groups: { values: ["Body"] }, polylist: { values: g.p } }],
  node_library: [{ id: "Mini", name: "Mini", type: "figure", center_point: pt(0, 0, 0) }, { id: "hip", name: "hip", type: "bone", parent: "#Mini", center_point: pt(0, 100, 10), end_point: pt(0, 150, 10) },
    { id: "head", name: "head", type: "bone", parent: "#hip", center_point: pt(0, 150, 10), end_point: pt(0, 170, 10) }, { id: "l_eye", name: "l_eye", type: "bone", parent: "#head", center_point: pt(3.2, 160, 11) },
    { id: "r_eye", name: "r_eye", type: "bone", parent: "#head", center_point: pt(-3.2, 160, 11) }],
  modifier_library: [{ id: "SkinBinding", skin: { joints: [{ node: "#hip", node_weights: { values: g.v.map((q, i) => [i, q[1] < 140 ? 1 : 0.2]) } }, { node: "#head", node_weights: { values: g.v.map((q, i) => [i, q[1] < 140 ? 0 : 0.8]).filter((x) => x[1]) } }] } }] });
w("data/T/Mini/Morphs/Tall.dsf", { modifier_library: [{ id: "Tall", name: "Tall", channel: { label: "Tall", min: 0, max: 1 }, morph: { deltas: { values: g.v.map((q, i) => [i, 0, q[1] * 0.1, 0]) } } }] });
const eg = grid(2, 1, -4, 158, 8, 4, 10.5);
w("data/T/Eyes/Eyes.dsf", { geometry_library: [{ id: "eyes-geo", vertices: { values: eg.v }, polygon_material_groups: { values: ["EyeMoisture"] }, polylist: { values: eg.p } }],
  node_library: [{ id: "Eyes", type: "figure" }, { id: "l_eye", type: "bone", center_point: pt(3.2, 160, 11) }], modifier_library: [{ id: "skin", skin: { joints: [{ node: "#l_eye", node_weights: { values: eg.v.map((_, i) => [i, 1]) } }] } }] });
w("People/Mini.duf", { scene: { nodes: [{ id: "Mini", url: "/data/T/Mini/Mini.dsf#Mini", geometries: [{ url: "/data/T/Mini/Mini.dsf#Mini-geo" }] },
  { id: "Eyes", url: "/data/T/Eyes/Eyes.dsf#Eyes", parent: "#Mini", conform_target: "#Mini", label: "Mini Eyes" }] } });

function readGlb(buf) {
  const jl = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + jl).toString("utf8")), bin = buf.slice(28 + jl);
  const accMinMax = (i) => J.accessors[i];
  const world = (name) => { let n = J.nodes.findIndex((x) => x.name === name), p = [0, 0, 0]; const parentOf = (k) => J.nodes.findIndex((x) => (x.children || []).includes(k));
    while (n >= 0) { const t = J.nodes[n].translation || [0, 0, 0]; p = [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; n = parentOf(n); } return p; };
  return { J, bin, accMinMax, world };
}
(async () => {
  const roots0 = D.roots(); D.setRoots([dir]);
  try {
    const plain = readGlb((await D.build({ root: dir, rel: "People/Mini.duf", maxTex: 64 })).glb);
    const out = await D.build({ root: dir, rel: "People/Mini.duf", dials: [{ url: "/data/T/Mini/Morphs/Tall.dsf#Tall", value: 1 }], maxTex: 64 });
    const tall = readGlb(out.glb);
    check("no shape: the stock joints (head at 1.50 m), nothing carried, no rig report", near(plain.world("head")[1], 1.5, 1e-4));
    check("the body 10 % taller: the hip joint follows it (1.00 -> 1.10 m)", near(tall.world("hip")[1], 1.10, 0.01), tall.world("hip"));
    check("…the head joint too (1.50 -> 1.65 m) - it no longer sits in the neck of a shorter body", near(tall.world("head")[1], 1.65, 0.01), tall.world("head"));
    check("…and the eye bones (1.60 -> 1.76 m), from the body round them (they skin no body vertex)", near(tall.world("l_eye")[1], 1.76, 0.015), tall.world("l_eye"));
    const eyeMesh = tall.J.meshes.findIndex((m) => /Eyes/.test(m.name)), eyeAcc = tall.J.accessors[tall.J.meshes[eyeMesh].primitives[0].attributes.POSITION];
    check("the eyes (a figure of their own) carried with the head: 1.58 - 1.62 m -> 1.738 - 1.782 m (they stayed at the stock place before)", near(eyeAcc.min[1], 1.738, 0.004) && near(eyeAcc.max[1], 1.782, 0.004), [eyeAcc.min, eyeAcc.max]);
    const ibm = tall.J.accessors[tall.J.skins[0].inverseBindMatrices], hb = tall.bin.slice(tall.J.bufferViews[ibm.bufferView].byteOffset, tall.J.bufferViews[ibm.bufferView].byteOffset + 16 * 4 * 5);
    const headIx = tall.J.skins[0].joints.findIndex((n) => tall.J.nodes[n].name === "head"), ty = hb.readFloatLE(headIx * 64 + 13 * 4);
    check("the skin's bind matrices match the moved joints (the mesh stands still at rest, turns round the right points)", near(-ty, 1.65, 0.01), -ty);
    check("info.rig says how many joints moved and the most (cm), the pieces carried", out.info.rig && out.info.rig.joints_moved >= 4 && out.info.rig.max_cm > 10 && out.info.rig.pieces_carried === 1, out.info.rig);
    check("a plain build has no rig report", (await D.build({ root: dir, rel: "People/Mini.duf", maxTex: 64 })).info.rig === null);
  } catch (e) { check("the builds ran: " + (e.stack || e.message), false); }
  finally { D.setRoots(roots0); fs.rmSync(dir, { recursive: true, force: true }); }
  const lib = fs.readFileSync(path.join(ROOT, "lib/dazLib.js"), "utf8");
  check("build(): the rig fitted before the face step (it anchors on the eye bones) and again at the end", lib.indexOf("fitRig();\n  }\n  // 3 the drape") > 0 && lib.indexOf("fitRig();\n  }\n  const daz = {") > 0);
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
