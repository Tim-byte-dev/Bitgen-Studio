#!/usr/bin/env node
/* bitGen Studio — 2.630.0 (pure + wiring): THE HOUSE BUILDER IS GONE - ITS LAST PARTS IN THE SKETCHER (🧍 people, its saved houses
 * brought in as Sketcher models - ext/pushpulldock/ppimport.js), SolidCraft's 📏 Send to Sketcher.
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker ..." */
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
globalThis.PPArch = require(path.join(R0, "ext", "pushpulldock", "pparch.js"));
const I = require(path.join(R0, "ext", "pushpulldock", "ppimport.js")), F = globalThis.PPFurn, P = globalThis.PPArch, HG = globalThis.H3HouseGeo;
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

/* 🧍 people */
const pe = F.make("person", [1, 2], 0.5, 90, "", "sit");
check("a person: type person, a pose (standing / sitting / walking / waving), 1.75 m, on its floor, turned", pe.type === "person" && pe.pose === "sit" && pe.h === 1.75 && pe.z === 0.5 && pe.rot === 90 && F.label(pe) === "Person (sitting)" && F.make("person", [0, 0], 0, 0, "", "fly").pose === "stand");
const kept = P.clean({ items: [Object.assign({}, pe, { name: "Ana", h: 9 }), { type: "person", pose: "wave" }] }).items;
check("…kept with the building (name, pose, height clamped)", kept.length === 2 && kept[0].name === "Ana" && kept[0].h === 2.3 && kept[1].pose === "wave" && F.label(kept[0]) === "Ana (sitting)");

/* the House builder's houses -> Sketcher models */
const ex = HG.example(), r = I.fromHouse(ex), A = r.model.arch, n = HG.normalize(ex);
check("a house -> a Sketcher model: its rooms (outline, floor height), its doors + windows on their walls, furniture, cameras", A.rooms.filter((x) => x.closed).length === n.rooms.length && A.ops.length === n.openings.length && A.items.length === n.items.length && A.cams.length === n.cameras.length && r.notes.length === 0, { rooms: A.rooms.length, ops: A.ops.length, items: A.items.length, cams: A.cams.length, notes: r.notes });
const r0 = n.rooms[0], R = A.rooms.find((x) => x.name === r0.name);
check("…the plan's y runs down, the Sketcher's up (y = -y); its height; its floor's material", R && R.pts.every((p) => r0.poly.some((q) => near(q[0], p[0], 1e-3) && near(-q[1], p[1], 1e-3))) && R.h === n.floors[0].height && (R.floor === "mat:" + r0.mat || !HG.MATERIALS[r0.mat]), { R: R && R.pts, poly: r0.poly });
const it0 = n.items[0], i0 = A.items.find((x) => x.type === it0.type && near(x.x, it0.x, 1e-3) && near(x.y, -it0.y, 1e-3));
check("…a piece where it stood, turned as it was", !!i0 && i0.rot === ((Math.round(it0.rot || 0) % 360) + 360) % 360, { it0, i0 });
const two = I.fromHouse({ name: "Two", floors: [{ name: "G", height: 2.7 }, { name: "Up", height: 2.5 }], rooms: [{ floor: 1, name: "Loft", poly: [[0, 0], [4, 0], [4, 3], [0, 3]] }], walls: [{ floor: 0, a: [0, 0], b: [5, 0] }],
  people: [{ floor: 0, x: 1, y: 1, rot: 180, pose: "wave", name: "Bo" }], lights: [{ floor: 0, x: 2, y: 2, z: 2.4, intensity: 1 }] });
const loft = two.model.arch.rooms.find((x) => x.name === "Loft"), free = two.model.arch.rooms.find((x) => !x.closed);
check("…an upper floor's room stands on its elevation; a wall on no room = a free wall; people, ◯ lights come too", loft && near(loft.z, HG.elevations(HG.normalize({ floors: [{ height: 2.7 }, { height: 2.5 }] }))[1], 1e-3) && free && free.pts.length === 2
  && two.model.arch.items.some((x) => x.type === "person" && x.name === "Bo" && x.pose === "wave" && x.rot === 90) && two.model.arch.lights.length === 1, { loft: loft && loft.z, free: !!free, items: two.model.arch.items, lights: two.model.arch.lights.length });
check("…a 3D-model piece / a roof are named as not carried", I.fromHouse({ items: [{ type: "model", model: "sc_x.obj", x: 0, y: 0 }], roof: { type: "gable" } }).notes.length >= 1);

/* the House builder is gone */
const IH = read("static/index.html"), SC = read("ext/solidcraftdock/scdock.js"), SH = read("ext/solidcraftdock/dock.html"), DK = read("ext/pushpulldock/ppdock.js"), FR = read("ext/pushpulldock/ppframe.js"), EJ = JSON.parse(read("ext/pushpulldock/ext.json")), TL = read("ext/pushpulldock/pparchtools.js");
check("the House builder is gone: no static/housebuilder.js, no script tag (housegeo.js stays - the furniture, lib/house.js)", !fs.existsSync(path.join(R0, "static", "housebuilder.js")) && !/housebuilder\.js/.test(IH.replace(/<!--[\s\S]*?-->/g, "")) && /\/static\/housegeo\.js/.test(IH));
check("nothing sends to it: the Sketcher's Send menu, SolidCraft's 📏 Send to Sketcher (into the Sketcher as a group)", !/toHouse|H3House/.test(DK) && !/H3House/.test(SC) && /id="scToSketcher"/.test(SH) && /function toSketcher/.test(SC) && /H3PushPull\.importModel\(saved\)/.test(SC));
check("☰ File ▸ 🏠 A house from the House builder… (GET /api/house, ppimport.js, saved as a Sketcher model); 🧍 People in 🛋 Furniture", /A house from the House builder/.test(FR) && /PPImport\.fromHouse/.test(FR) && EJ.scripts.includes("ppimport.js") && /"People"/.test(TL) && /data-pose|dataset\.pose/.test(TL));
check("the 🧪 checklist has no House builder items left", !/"g524"|"g528"|"g529"|"hs_size"|"house_light"|"house_tex"/.test(read("lib/testPlan.json")));
check("server.js untouched by this release", !/ppimport|housebuilder|toSketcher/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
