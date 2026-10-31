#!/usr/bin/env node
/* bitGen Studio — 2.629.0 (pure + wiring): THE SKETCHER GETS THE HOUSE BUILDER'S MATERIALS, 📷 CAMERAS (shot + depth + normal
 * maps, 📍 360° locations), 🪄 FURNISH; THE FURNITURE IS EXPORTED. (ext/pushpulldock/ppcam.js, ppfurn.js materials) */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
globalThis.polygonClipping = require(path.join(R0, "static", "vendor", "polygon-clipping.umd.min.js"));
globalThis.H3HouseGeo = require(path.join(R0, "static", "housegeo.js"));
globalThis.PPFurn = require(path.join(R0, "ext", "pushpulldock", "ppfurn.js"));
globalThis.PPCam = require(path.join(R0, "ext", "pushpulldock", "ppcam.js"));
const C = globalThis.PPCam, F = globalThis.PPFurn, P = require(path.join(R0, "ext", "pushpulldock", "pparch.js")), G = require(path.join(R0, "ext", "pushpulldock", "ppgeo.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const c = C.make([0, 0], [0, -5], 0.5);
check("a camera: where it stands + where it looks -> eye 1.6 m over its floor, yaw clockwise from above (looking -y = 90°)", c.z === 2.1 && c.yaw === 90 && c.fov === 60 && C.make([0, 0], [3, 0], 0).yaw === 0 && C.make([0, 0], [0, 3], 0).yaw === 270);
const d = C.dir(Object.assign({}, c, { pitch: 30 }));
check("its direction (with tilt)", near(d[0], 0, 1e-9) && near(d[1], -Math.cos(Math.PI / 6)) && near(d[2], 0.5));
check("its glyph: 4 edges from the eye + the picture's rectangle", C.frustum(c).length === 8 && C.frustum(c).slice(0, 4).every((s) => s[0][0] === 0 && s[0][2] === 2.1));
check("its pictures' names / the Location's name", C.fileName("model 1", { name: "Camera 1" }, "depth") === "sketcher_model_1_camera_1_depth.png" && C.envName("My House", { name: "Kitchen cam" }) === "my-house-kitchen-cam");
const A = P.clean({ cams: [{ name: "A", x: 1, y: 2, z: 1.6, yaw: 45, fov: 500 }, null], rooms: [{ pts: [[0, 0], [4, 0], [4, 3], [0, 3]], wall: "mat:brick", floor: "mat:oak" }] });
check("kept with the building (arch.cams, clamped; find / remove 'cam'); a room's walls / floor keep a material", A.cams.length === 1 && A.cams[0].fov === 140 && P.find(A, "cam", A.cams[0].id) && A.rooms[0].wall === "mat:brick" && A.rooms[0].floor === "mat:oak" && P.clean({ rooms: [{ pts: [[0, 0], [1, 0], [1, 1]], wall: "mat:<x>" }] }).rooms[0].wall !== "mat:<x>");
const M = G.fromJson({ v: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], f: [{ id: 1, loops: [[0, 1, 2]], mat: "mat:marble" }, { id: 2, loops: [[0, 2, 1]], mat: "bad" }], e: [], g: [], n: 3 });
check("a face keeps a material (\"mat:<key>\"), not nonsense", M.f[0].mat === "mat:marble" && M.f[1].mat === null);
const mats = F.materials();
check("the materials: the House builder's (Brick, Stone, Oak floor, Tiles, Marble, Carpet …) - not its glass / lamp / car paint", mats.some((m) => m.key === "brick" && m.tex === "brick") && mats.some((m) => m.key === "marble") && !mats.some((m) => /^(glass|light|paint_car)$/.test(m.key)));
check("hex(): a material's own colour (exports / swatches), a colour stays", F.hex("mat:brick") === H3HouseGeo.MATERIALS.brick.color && F.hex("#123456") === "#123456" && F.isMat("mat:x") && !F.isMat("#fff"));
const uv = F.uvs([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1]);
check("uvs(): metres on the plane a triangle faces (a floor: x / y; a wall facing x: y / z)", Array.from(uv.slice(0, 6)).join() === "0,0,1,0,1,1" && Array.from(uv.slice(6)).join() === "0,0,0,1,2,1", Array.from(uv));
const TL = read("ext/pushpulldock/pparchtools.js"), AV = read("ext/pushpulldock/pparchview.js"), VW = read("ext/pushpulldock/ppview.js"), DK = read("ext/pushpulldock/ppdock.js"), DH = read("ext/pushpulldock/dock.html"), EJ = JSON.parse(read("ext/pushpulldock/ext.json"));
check("the 📷 Camera tool (Z), its panel (👁 Look through, 📷 Shot + depth + normal, 📍 360° location), Select drags it; 🪄 Furnish in a room's panel (/api/house/furnish)",
  /\["camera", "📷", "Camera", "z"\]/.test(TL) && /function lookThrough/.test(TL) && /PPCam\.shots/.test(TL) && /PPCam\.location/.test(TL) && /function furnishRoom/.test(TL) && /\/api\/house\/furnish/.test(TL));
check("the view: shot({camera, normal, depth (linear for a camera)}), pano() - a cube camera, Z up; cameras never in a picture; materials textured; furniture exported",
  /o\.camera/.test(VW) && /MeshNormalMaterial/.test(VW) && /function pano\(p, yaw, W\)/.test(VW) && /CubeCamera/.test(VW) && /camsG\]\)/.test(AV) && /PPFurn\.look/.test(VW) && /PPFurn\.look/.test(AV) && /furn\.traverse/.test(AV));
check("▦ Materials ▾ beside the colours (the paint = \"mat:<key>\"); ppcam.js loads before pparch.js", /id="ppMatBtn"/.test(DH) && /setColor\("mat:" \+ m\.key\)/.test(DK) && EJ.scripts.indexOf("ppcam.js") < EJ.scripts.indexOf("pparch.js"));
check("server.js untouched by this release", !/ppcam|camera/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
