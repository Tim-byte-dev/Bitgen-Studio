#!/usr/bin/env node
/* bitGen Studio — 2.628.0 (pure + wiring): THE SKETCHER'S 🛋 FURNITURE (ext/pushpulldock/ppfurn.js - the House builder's library)
 * + THE PROJECT'S 3D MODELS; ⛶ MAXIMIZED = EVERY OTHER DOCKER CLOSED.
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker. when
 * maximized sketcher takes the full screen except for bitgen titlebar and statusbar, all the other dockers are closed" */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
globalThis.polygonClipping = require(path.join(R0, "static", "vendor", "polygon-clipping.umd.min.js"));
globalThis.H3HouseGeo = require(path.join(R0, "static", "housegeo.js"));
const F = require(path.join(R0, "ext", "pushpulldock", "ppfurn.js"));
globalThis.PPFurn = F;
const P = require(path.join(R0, "ext", "pushpulldock", "pparch.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

check("the House builder's library: 39 pieces in Living, Dining, Kitchen, Bedroom, Bathroom, Lights, Outside (its hidden \"3D model\" not listed)", F.pieces().length === 39 && F.categories().join() === "Living,Dining,Kitchen,Bedroom,Bathroom,Lights,Outside" && !F.pieces().some((p) => p.type === "model"));
const s = F.make("sofa", [1, 2], 0.5, 90);
check("make(): a piece at a point on its floor, its catalogue size, turned (degrees, clockwise from above)", s.type === "sofa" && s.x === 1 && s.y === 2 && s.z === 0.5 && s.rot === 90 && s.w === 2.1 && s.d === 0.92 && F.make("nope", [0, 0]) === null && F.make("sofa", [0, 0], 0, -90).rot === 270);
const fp = F.footprint(F.make("sofa", [0, 0], 0, 90));
check("footprint(): turned 90° the 2.1 m width lies along y", fp.every((q) => near(Math.abs(q[0]), 0.46) && near(Math.abs(q[1]), 1.05)), fp);
const A = P.clean({ items: [{ type: "bed_king", x: 3, y: 2, rot: 90, color: "#ff0000" }, { type: "nope" }, { type: "sofa", w: 999 }] });
check("kept with the building (M.arch.items - clean keeps the good ones, drops unknown pieces, clamps sizes, ids)", A.items.length === 2 && A.items[0].color === "#ff0000" && A.items[1].w === 50 && A.items.every((x) => x.id > 0) && P.has(A) && P.find(A, "item", A.items[0].id) === A.items[0]);
check("…erased like any built thing; its extents count", P.remove(A, "item", A.items[1].id) && A.items.length === 1 && P.bbox(A).max[2] === 1.05);
// group(): three.js (the browser test draws it - ui628: the House builder's parts, materials, textures)
const TL = read("ext/pushpulldock/pparchtools.js"), AV = read("ext/pushpulldock/pparchview.js"), FR = read("ext/pushpulldock/ppframe.js"), EJ = JSON.parse(read("ext/pushpulldock/ext.json")), DK = read("ext/pushpulldock/ppdock.js");
check("the 🛋 Furniture tool (A): its panel (categories + the pieces + 3D models), R turns, click places on the floor under it; Select drags / its panel", /\["furniture", "🛋", "Furniture", "a"\]/.test(TL) && /"3D models"/.test(TL) && /function floorAt/.test(TL) && /asel\.ak === "item"/.test(TL) && /ctx\.models/.test(TL) && /models: \(\) => api\("\/api\/tlcanvas\/models"\)/.test(DK));
check("drawn + picked in the arch view (a piece under a ceiling wins the click); ppfurn.js loads before pparch.js", /pp-furniture/.test(AV) && /furn\.children/.test(AV) && /firstTag\.part === "ceil"/.test(AV) && EJ.scripts.indexOf("ppfurn.js") < EJ.scripts.indexOf("pparch.js"));
check("⛶ maximized: the other dockers shown are closed, ⇲ Dock opens them again (H3GoneDocks, their lit buttons)", /function closeOthers/.test(FR) && /function reopenOthers/.test(FR) && /H3GoneDocks/.test(FR));
check("server.js untouched by this release", !/ppfurn|furniture/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
