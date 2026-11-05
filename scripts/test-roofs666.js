#!/usr/bin/env node
/* bitGen Studio — 2.666.0: THE SKETCHER'S ROOF TYPES (ext/pushpulldock/pparch.js roofShape / roofType / roofIcon + the Roof
 * panel's pictures in pparchtools.js) - gable, hip, skillion, Dutch gable, clipped gable, gambrel, mansard, saltbox, pyramid,
 * butterfly, flat, follow. The panel in a real browser: scripts/test-ui666-ui.js.
 * Tim (verbatim): "can you add roof options, gable, skilion, hip etc" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));

const TYPES = ["gable", "hip", "shed", "dutch", "jerkin", "gambrel", "mansard", "saltbox", "pyramid", "butterfly", "flat", "follow"];
check("the types: gable, hip, skillion (shed), Dutch gable, clipped gable, gambrel, mansard, saltbox, pyramid, butterfly, flat, follow", JSON.stringify(P.ROOFS) === JSON.stringify(TYPES), P.ROOFS);
check("their names: Skillion (lean-to), Dutch gable (gablet), Clipped gable (jerkinhead), Gambrel (barn)", P.ROOF_LABELS.shed === "Skillion (lean-to)" && /Dutch/.test(P.ROOF_LABELS.dutch) && /jerkinhead/.test(P.ROOF_LABELS.jerkin) && /barn/.test(P.ROOF_LABELS.gambrel));
check("roofType: skillion / skilion / lean-to = shed, jerkinhead = jerkin, barn = gambrel, unknown = gable", P.roofType("Skillion") === "shed" && P.roofType("skilion") === "shed" && P.roofType("lean-to") === "shed" && P.roofType("jerkinhead") === "jerkin" && P.roofType("barn") === "gambrel" && P.roofType("igloo") === "gable");

// every top polygon planar; the eaves no higher than the wall tops at the walls' line
const W = 8, D = 5, ov = 0.4, top = 2.7, tp = Math.tan(30 * Math.PI / 180), t = 0.2;
const planar = (Q) => {
  if (Q.length < 4) return true;
  const a = Q[0], b = Q[1]; let c = null;
  for (let i = 2; i < Q.length && !c; i++) { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [Q[i][0] - a[0], Q[i][1] - a[1], Q[i][2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(...n); if (L > 1e-6) c = n.map((x) => x / L); }
  return Q.every((p) => Math.abs((p[0] - a[0]) * c[0] + (p[1] - a[1]) * c[1] + (p[2] - a[2]) * c[2]) < 1e-6);
};
TYPES.filter((x) => x !== "flat" && x !== "follow").forEach((type) => {
  const S = P.roofShape(type, W, D, ov, top, tp, t, { pitch2: 60 });
  check(type + ": " + S.tops.length + " planar roof faces" + (S.ups.length ? ", " + S.ups.length + " walled-up ends / sides" : ""), S.tops.length >= 1 && S.tops.every(planar), S.tops);
});
const hgt = (S, x, y) => { let best = null; S.tops.forEach((Q) => { /* z at (x, y) if inside the face's plan */ const n = Q.length; let inside = false; for (let i = 0, j = n - 1; i < n; j = i++) { const a = Q[i], b = Q[j]; if (((a[1] > y) !== (b[1] > y)) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } if (!inside) return; const a = Q[0], b = Q[1], c = Q.find((q, k) => k > 1 && Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) > 1e-6); const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const z = a[2] - (nn[0] * (x - a[0]) + nn[1] * (y - a[1])) / nn[2]; if (best == null || z > best) best = z; }); return best; };
["gable", "hip", "shed", "dutch", "jerkin", "gambrel", "mansard", "saltbox", "pyramid"].forEach((type) => {
  const S = P.roofShape(type, W, D, ov, top, tp, t, { pitch2: 60 }), z = hgt(S, W / 2, 0.001);
  check(type + ": it rests on the front wall (the roof's underside at the wall line = the wall's top)", z != null && Math.abs(z - top) < 3e-3, z);
});
const dg = P.roofShape("dutch", W, D, ov, top, tp, t, {}), rz = top + D / 2 * tp;
check("Dutch gable: a gablet (a small vertical gable) at each end above the hip, the ridge at full height", dg.ups.length === 2 && dg.ups.every((u) => u[0].some((p) => Math.abs(p[1] - rz) < 1e-9)) && dg.tops.length === 4);
const jk = P.roofShape("jerkin", W, D, ov, top, tp, t, { k: 0.3 });
check("Clipped gable: gable ends walled up to the clip (a trapezoid), a small hip above (two triangles)", jk.ups.length === 2 && jk.ups[0][0].length === 4 && jk.tops.filter((q) => q.length === 3).length === 2);
const gb = P.roofShape("gambrel", W, D, ov, top, tp, t, { pitch2: 60 }), ms = P.roofShape("mansard", W, D, ov, top, 0, t, { pitch2: 70 });
check("Gambrel: four slopes (steep below the break, shallow above), five-sided ends", gb.tops.length === 4 && gb.ups[0][0].length === 5);
check("Mansard: steep on all four sides, an upper pitch of 0 = a flat top", ms.tops.length === 5 && ms.tops[4].every((p) => Math.abs(p[2] - ms.tops[4][0][2]) < 1e-9));
const sb = P.roofShape("saltbox", W, D, ov, top, tp, t, { k: 0.3 });
check("Saltbox: the ridge 30 % in from the front, both eaves on the walls", Math.abs(sb.tops[0][2][1] - 0.3 * D) < 1e-9 && Math.abs(hgt(sb, W / 2, D - 0.001) - top) < 1e-3);
const bf = P.roofShape("butterfly", W, D, ov, top, tp, t, {});
check("Butterfly: two slopes down to a valley in the middle (at the wall top), the outside walls up to the high eaves", bf.tops.length === 2 && Math.abs(hgt(bf, W / 2, D / 2 - 0.01) - top) < 0.01 && bf.ups.length === 6);

// in a model: clean keeps the new settings; flip; build makes faces
let A = P.empty();
const R = P.addRoom(A, P.rectPts([0, 0], [8, 5]), {});
P.addRoof(A, [R.id], { type: "skillion", pitch: 15, k: 2, pitch2: 99, flip: 1 });
A = P.clean(A) || A;
const rf = A.roofs[0];
check("clean: 'skillion' kept as shed, k / pitch2 held in range, flip a yes / no", rf.type === "shed" && rf.k === 0.95 && rf.pitch2 === 85 && rf.flip === true, rf);
const hiZ = (A2) => { const B = P.build(A2); let y = 0, z = -Infinity; B.polys.filter((p) => p.tag && p.tag.ak === "roof").forEach((p) => p.rings[0].forEach((q) => { if (q[2] > z) { z = q[2]; y = q[1]; } })); return y; };
const yFlip = hiZ(A); rf.flip = false; const yNot = hiZ(A);
check("Flip: the skillion's high side moves to the other wall", (yFlip < 2.5) !== (yNot < 2.5), { yFlip, yNot });
const counts = {};
TYPES.forEach((type) => { rf.type = type; rf.k = null; rf.pitch = 30; counts[type] = P.build(A).polys.filter((p) => p.tag && p.tag.ak === "roof").length; });
check("build: every type makes its roof (faces for all twelve)", TYPES.every((x) => counts[x] > 0), counts);
check("old models: a roof saved without k / pitch2 / flip still builds (k null = the type's own)", P.clean({ rooms: [{ id: 1, pts: [[0, 0], [4, 0], [4, 3], [0, 3]], closed: true }], roofs: [{ id: 2, rooms: [1], type: "hip" }] }).roofs[0].k === null);
const svg = P.roofIcon("dutch", 44);
check("roofIcon: a small SVG picture of each type (from what build makes)", /^<svg[^>]+viewBox/.test(svg) && (svg.match(/<path/g) || []).length > 5 && TYPES.every((x) => /<svg/.test(P.roofIcon(x, 44))));
const T = read("ext/pushpulldock/pparchtools.js");
check("the Roof panel: the types as pictures (.pproofs [data-roof]), Pitch / Lower pitch / the type's proportion / Flip; the tool's new roofs take them (roofOpts)", /pproofs/.test(T) && /dataset\.roof/.test(T) && /"Lower pitch"/.test(T) && /Flip - the other side high/.test(T) && (T.match(/roofOpts\(\)/g) || []).length >= 5 && !/type: O\.roof\.type, pitch: O\.roof\.pitch, over: O\.roof\.over/.test(T));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
