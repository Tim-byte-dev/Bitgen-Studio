#!/usr/bin/env node
// bitGen Studio 2.928.0 - the character sheet's DISPLAY MANNEQUINS (glossy, on black, like Tim's pictures).
// Tim: "use these mannequins as included character sheet mannequins (create new ones that look similar) ad our garment
// design" -> "your mannequins don't look human" -> "3D + your PC makes them real".
// Units: the 3D bodies (static/mannequins/mesh - MakeHuman's CC0 base mesh: heights, joints, the hands where the arms now
// hang, a closed mesh, the OBJ for the garments), the renders (front / side / back 832 x 1216, the sheet with every
// view), the renderer's views, the licence note, the route's height. Run: node scripts/test-928.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const png = (p) => { const b = fs.readFileSync(path.join(ROOT, p)); return { sig: b.slice(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20), size: b.length }; };
const MESH = "static/mannequins/mesh/";
for (const sex of ["male", "female"]) {
  const m = JSON.parse(src(MESH + sex + ".json"));
  const pos = new Float32Array(Uint8Array.from(Buffer.from(m.pos, "base64")).buffer), idx = new Uint32Array(Uint8Array.from(Buffer.from(m.idx, "base64")).buffer);
  check(`${sex}: ${m.verts} vertices, ${m.tris} triangles, every index inside`, pos.length === m.verts * 3 && idx.length === m.tris * 3 && Math.max(...idx.slice(0, 50000)) < m.verts && m.verts > 13000);
  let y0 = 1e9, y1 = -1e9; for (let i = 1; i < pos.length; i += 3) { y0 = Math.min(y0, pos[i]); y1 = Math.max(y1, pos[i]); }
  check(`${sex}: feet on the floor, ${Math.round(m.height_m * 100)} cm tall (male 175-190, female 165-180)`, Math.abs(y0) < 0.002 && Math.abs(y1 - m.height_m) < 0.002 && (sex === "male" ? m.height_m > 1.75 && m.height_m < 1.9 : m.height_m > 1.65 && m.height_m < 1.8));
  const hd = m.joints["l-hand"], an = m.joints["l-ankle"], nk = m.joints.neck;
  check(`${sex}: the arms hang by the sides (the hand at the hip, beside the body - MakeHuman's A pose lowered)`, hd && hd[1] > 0.7 && hd[1] < 1.0 && Math.abs(hd[0]) < 0.4 && Math.abs(hd[2]) < 0.15, hd);
  check(`${sex}: the joints the sheet frames (neck, head, jaw, ankle)`, nk && m.joints.head && m.joints.jaw && an && nk[1] > 1.3 && an[1] < 0.15);
  check(`${sex}: credited CC0 (MakeHuman)`, /MakeHuman/.test(m.credit) && /CC0/.test(m.credit));
  const obj = src(MESH + sex + ".obj");
  check(`${sex}.obj for Blender and the garments: metres, the same mesh`, /^# bitGen Studio display mannequin/.test(obj) && (obj.match(/\nv /g) || []).length === m.verts);
  const fr = png("static/mannequins/" + sex + "_front.png"), sh = png("static/mannequins/" + sex + "_sheet.png");
  check(`${sex}: the start picture 832 x 1216 + side / back, the sheet 2600 x 2400`, fr.sig === "PNG" && fr.w === 832 && fr.h === 1216 && sh.w === 2600 && sh.h === 2400
    && ["side", "back"].every((v) => png("static/mannequins/" + sex + "_" + v + ".png").w === 832));
}
const G = require("../static/mannequinGloss.js"), m = JSON.parse(src(MESH + "male.json"));
const views = ["front", "side", "back", "side2", "three", "head", "headthree", "headback", "torso", "torsoside", "hips", "palm", "handback", "handside", "sole", "foottop", "footside"];
check("the renderer frames every view of the sheet (4 full, 3 head, torso / side / hips, 3 hands, 3 feet)", views.every((v) => { const s = G.shot(m, v); return s && s[1].length === 3 && s[2].length === 3 && s[3] > 10; }));
check("…the hand close-ups look at the hand where it now hangs", G.shot(m, "palm")[2] === m.joints["l-hand"]);
check("the licence note beside the meshes", /CC0 1\.0/.test(src(MESH + "LICENSE-MakeHuman.txt")) && /makehumancommunity\/makehuman/.test(src(MESH + "LICENSE-MakeHuman.txt")));
check("the mesh builder is in scripts/ (MakeHuman's data path as its argument)", /def pose_arms/.test(src("scripts/make_mannequin_mesh.py")) && /def eyeballs/.test(src("scripts/make_mannequin_mesh.py")));
check("the route's height_cm is the mesh's own", /mannequins", "mesh", sex \+ "\.json"/.test(src("routes/charSheetH3.js")));
check("server.js untouched", !/mannequinGloss/.test(src("misc/server.js")));
console.log("\n" + P + " passed, " + F + " failed");
process.exit(F ? 1 : 0);
