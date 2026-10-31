#!/usr/bin/env node
/* bitGen Studio — 2.620.0 (pure + wiring): THE 📏 PUSHPULL DOCKER BUILDS - rooms, shared walls, doors, windows, floors,
 * ceilings, roofs, stairs, lights; the full-window maximize, the ☰ File menu, 🖼 → Image editor / 🎞 → Timeline buttons.
 * Tim: "add architectural tools like floor, walls,windows, ceiling,roof  etc. rooms will be able to be dragged, their  walls
 * can snap to another room and share the wall, door or window etc. add lights, downlights, pendant lights, chandelier lights,
 * ceiling mounted lights etc. when maximized it takes bitgens full window minus the titlebar, it has it's own file menu. send
 * to image editor button and send to time line button - this goes in our new sketchup docker"
 *   ext/pushpulldock/pparch.js  the data, the walls of a storey as one solid (shared walls), openings cut through, roofs,
 *                               stairs, floors, lights, the snap that shares a wall
 *   ext/pushpulldock/ppglb.js   glass + glTF lights;  ppgeo.js / lib/pushPull.js carry M.arch */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
globalThis.polygonClipping = require(path.join(R, "static", "vendor", "polygon-clipping.umd.min.js"));
const P = require(path.join(R, "ext", "pushpulldock", "pparch.js"));
const G = require(path.join(R, "ext", "pushpulldock", "ppgeo.js"));
const O = require(path.join(R, "ext", "pushpulldock", "ppglb.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const area = (ring) => { let s = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
const polyArea = (pl) => area(pl.rings[0]) - pl.rings.slice(1).reduce((s, r) => s + area(r), 0);
const caps = (B, z, up) => B.polys.filter((pl) => pl.tag.ak === "wall" && pl.n[2] === (up ? 1 : -1) && pl.rings[0].every((p) => near(p[2], z)));

/* one room */
let A = P.empty();
const r1 = P.addRoom(A, [[0, 3], [4, 3], [4, 0], [0, 0]]);           // clockwise in - kept counter-clockwise
check("a room: its centre line kept counter-clockwise, walls 2.7 m × 15 cm, a floor + a ceiling", P.area2(r1.pts) > 0 && r1.h === 2.7 && r1.t === 0.15 && r1.floorOn && r1.ceilOn);
const inn = P.interior(r1);
check("its inside = the centre line moved in half a wall (3.85 × 2.85 m)", near(area(inn), 3.85 * 2.85), area(inn));
let B = P.build(A);
const top1 = caps(B, 2.7, true);
check("its walls are ONE solid: the top at 2.7 m is one ring round the room (4.15 × 3.15 − 3.85 × 2.85 m²)", top1.length === 1 && top1[0].rings.length === 2 && near(polyArea(top1[0]), 4.15 * 3.15 - 3.85 * 2.85, 1e-6), top1.map(polyArea));
const inside = B.polys.filter((pl) => pl.tag.ak === "wall" && pl.n[2] === 0 && pl.col === r1.wall), outside = B.polys.filter((pl) => pl.tag.ak === "wall" && pl.n[2] === 0 && pl.col === A.ext);
check("each wall face takes the colour of what it faces: 4 inside (the room's), 4 outside (the outside walls')", inside.length === 4 && outside.length === 4 && inside.every((pl) => pl.tag.room === r1.id), { i: inside.length, o: outside.length });
check("a floor (up) and a ceiling (down, on the ceiling layer) the size of its inside", B.polys.some((pl) => pl.tag.part === "floor" && near(polyArea(pl), 3.85 * 2.85)) && B.polys.some((pl) => pl.tag.part === "ceil" && pl.layer === "ceil" && pl.n[2] === -1));

/* a second room snaps onto the first and shares its wall */
const r2 = P.addRoom(A, P.rectPts([4.25, 0.2], [7.25, 3.2]));
let s = P.snapMove(A, [r2.id], [0, 0], 0.4);
check("snapMove: a room 25 cm off its neighbour's wall snaps onto it (and its corner onto the neighbour's)", s.hit && s.hit.room === r1.id && s.hit.kind === "corner" && near(s.d[0], -0.25) && near(s.d[1], -0.2), s);
check("…too far (50 cm with a 40 cm reach): left where it is", P.snapMove(A, [r2.id], [0.25, 0], 0.4).hit === null);
P.moveRooms(A, [r2.id], s.d);
check("moveRooms: it moves (its wall on the neighbour's line, x = 4)", near(r2.pts[0][0], 4) && near(r2.pts[0][1], 0));
B = P.build(A);
const top2 = caps(B, 2.7, true);
check("the two rooms SHARE one wall: one solid, its top a ring with 2 holes = (7.15 × 3.15) − both insides (no double wall)", top2.length === 1 && top2[0].rings.length === 3 && near(polyArea(top2[0]), 7.15 * 3.15 - 3.85 * 2.85 - 2.85 * 2.85, 1e-6), top2.map(polyArea));
const shared = B.polys.filter((pl) => pl.tag.ak === "wall" && pl.n[2] === 0 && Math.abs(pl.n[0]) === 1 && pl.rings[0].every((p) => near(Math.abs(p[0] - 4), 0.075)));
check("…its two faces take each room's own colour (the left one's facing it, the right one's facing it)", shared.length === 2 && new Set(shared.map((pl) => pl.tag.room)).size === 2, shared.map((pl) => pl.tag));

/* a door in the shared wall, a window */
const w = P.nearestWall(A, [4.02, 1.5], 0.3);
check("nearestWall: the wall under a point (its room, edge, how far along)", w && near(w.d, 0.02) && near(w.at, 1.5) && [r1.id, r2.id].includes(w.room), w && { room: w.room, edge: w.edge, at: w.at, d: w.d });
const door = P.addOp(A, "door", w);
const win = P.addOp(A, "window", P.nearestWall(A, [2, 0], 0.3));
B = P.build(A);
const lintel = caps(B, 2.1, false).map(polyArea).sort();
check("a door in the shared wall goes THROUGH it: the underside over it at 2.1 m is the door's width × the wall (+ the window's head)", lintel.length === 2 && near(lintel[0], 0.9 * 0.15, 1e-6) && near(lintel[1], 1.2 * 0.15, 1e-6), lintel);
const sill = caps(B, 0.9, true);
check("a window: cut 0.9 → 2.1 m, its sill (up) 1.2 m × the wall", sill.length === 1 && near(polyArea(sill[0]), 1.2 * 0.15, 1e-6), sill.map(polyArea));
check("…a door: frame, leaf, handles; a window: frame, mullion, glass (see-through), sill board", B.polys.filter((pl) => pl.tag.ak === "op" && pl.tag.id === door.id).length >= 24 && B.polys.some((pl) => pl.tag.id === win.id && pl.alpha < 1));
const I = P.opInfo(A, Object.assign({}, door, { at: 0 }));
check("an opening is kept clear of the corners (pushed in: half its width + half a wall)", near(I.x0, 0.075 + 0.03, 1e-9), I.x0);
const B2 = P.build(P.clean(JSON.parse(JSON.stringify(Object.assign({}, A, { ops: [Object.assign({}, door, { kind: "opening", style: "plain" })] })))));
check("an opening without a door: the hole, no fixture", !B2.polys.some((pl) => pl.tag.ak === "op"));

/* roofs */
const rfG = P.addRoof(A, [r1.id, r2.id], { type: "gable", pitch: 30, over: 0.4 });
B = P.build(A);
const slopes = (B) => B.polys.filter((pl) => pl.tag.ak === "roof" && pl.col === rfG.col && pl.n[2] > 0.5), roofTop = slopes(B);
const ridge = Math.max(...B.polys.filter((pl) => pl.tag.ak === "roof").flatMap((pl) => pl.rings[0].map((p) => p[2])));
const dz = 0.15 / Math.cos(Math.PI / 6);
check("a gable roof over both rooms: two slopes on the walls (the ridge 2.7 + 3.15/2 · tan 30° + its thickness), the ends walled up", roofTop.length === 2 && near(ridge, 2.7 + 3.15 / 2 * Math.tan(Math.PI / 6) + dz, 1e-6) && B.polys.some((pl) => pl.tag.ak === "roof" && pl.col === A.ext) && B.roofLines.length > 0, { n: roofTop.length, ridge });
rfG.type = "hip"; B = P.build(A);
check("hip: four slopes (two trapezoids + two triangles)", slopes(B).map((pl) => pl.rings[0].length).sort().join() === "3,3,4,4", slopes(B).map((pl) => pl.rings[0].length));
rfG.type = "shed"; B = P.build(A);
check("shed: one slope, the ends + the high side walled up", slopes(B).length === 1 && B.polys.filter((pl) => pl.tag.ak === "roof" && pl.col === A.ext).length >= 15, [slopes(B).length, B.polys.filter((pl) => pl.tag.ak === "roof" && pl.col === A.ext).length]);
rfG.type = "flat"; B = P.build(A);
check("flat: a slab on the walls (2.7 → 2.85 m)", B.polys.some((pl) => pl.tag.ak === "roof" && pl.n[2] === 1 && pl.rings[0].every((p) => near(p[2], 2.85))));

/* lights */
const sp = P.lightSpot(A, "pendant", [2, 1.5], 0);
const L1 = P.addLight(A, "pendant", [2, 1.5, sp.z], { room: sp.room });
check("a pendant clicked in a room goes on its ceiling (2.7 m) and belongs to the room", sp.room === r1.id && near(sp.z, 2.7) && L1.lm === 800 && L1.drop === 0.7);
check("the light types: downlight, ceiling-mounted, pendant, chandelier, spot, wall light, floor lamp, table lamp", Object.keys(P.LIGHTS).join() === "downlight,ceiling,pendant,chandelier,spot,wall,floorlamp,tablelamp");
P.setRoom(A, r1.id, { h: 3 });
check("the room's walls raised to 3 m: its ceiling light goes up with them", near(L1.z, 3));
P.moveRooms(A, [r1.id], [1, 0]);
check("the room moved: its light moves with it (and its doors / windows: they belong to its walls)", near(L1.x, 3) && near(P.opInfo(A, win).c[0], 3));
P.moveRooms(A, [r1.id], [-1, 0]);
const C = P.duplicateRoom(A, r2.id, [3, 0]);
check("duplicate: a copy with its doors / windows / lights", C && A.rooms.length === 3 && A.ops.filter((o) => o.room === C.id).length === A.ops.filter((o) => o.room === r2.id).length);
P.rotateRoom(A, C.id, 90);
check("rotate 90°: still a room of the same size", near(P.roomArea(C), P.roomArea(r2), 1e-6));
P.removeRoom(A, C.id);
check("delete a room: its doors, windows, lights go with it", A.rooms.length === 2 && !A.ops.some((o) => o.room === C.id));

/* stairs, floors, the file */
A.stairs.push({ id: A.n++, x: 0, y: -2, ang: 0, w: 1, len: 3.6, rise: 2.7, z: 0, col: "#b08a62" });
A.slabs.push({ id: A.n++, pts: P.rectPts([-3, 0], [-1, 3]), z: 0.15, th: 0.15, col: "#9aa3ad" });
B = P.build(A);
const st = B.polys.filter((pl) => pl.tag.ak === "stair"), sideProf = st.filter((pl) => pl.rings[0].length > 4);
check("stairs: 15 steps of 18 cm (2.7 m), the side profile pushed across its width", sideProf.length === 2 && sideProf[0].rings[0].length === 2 * 15 + 2 && near(Math.max(...sideProf[0].rings[0].map((p) => p[2])), 2.7));
check("a floor without walls: a 2 × 3 m slab, its top at 15 cm", B.polys.some((pl) => pl.tag.ak === "slab" && pl.n[2] === 1 && near(polyArea(pl), 6) && near(pl.rings[0][0][2], 0.15)));
const back = P.clean(JSON.parse(JSON.stringify(A)));
check("clean(): the same building back from JSON (ids unique, counter past them); junk dropped", back.rooms.length === 2 && back.ops.length === A.ops.length && back.lights.length === 1 && back.n >= A.n
  && P.clean({ rooms: [{ pts: [[0, 0], [1, 0]] }, null], ops: [{ kind: "x", room: 1 }], lights: [{ type: "laser" }] }).rooms.length === 0);
const M = G.newModel(); M.arch = A;
const M2 = G.fromJson(JSON.parse(JSON.stringify(G.toJson(M))));
check("the model's file carries it (ppgeo toJson / fromJson: M.arch)", M2.arch && M2.arch.rooms.length === 2 && M2.arch.roofs.length === 1);
const LP = require(path.join(R, "lib", "pushPull.js")), dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp620_")); LP.setDir(dir);
LP.write("House", { model: G.toJson(M) });
check("lib/pushPull keeps it in the project's .pp3d", LP.read("House").model.arch.rooms.length === 2);
fs.rmSync(dir, { recursive: true, force: true });

/* out */
const g = O.glb([{ color: "#9ec5e8", alpha: 0.3, pos: [0, 0, 0, 1, 0, 0, 0, 1, 0], nrm: [0, 0, 1, 0, 0, 1, 0, 0, 1], idx: [0, 1, 2] }], "h", [{ name: "Pendant", type: "point", color: "#ffcf9e", cd: 63.7, p: [2, 1.5, 2] }, { name: "Downlight", type: "spot", color: "#ffffff", cd: 50, p: [1, 1, 2.7], ang: 50 }]);
const jl = new DataView(g.buffer).getUint32(12, true), J = JSON.parse(new TextDecoder().decode(g.slice(20, 20 + jl)));
check(".glb: glass is see-through (BLEND), the lights are glTF lights (KHR_lights_punctual) - a spot points down, Y up",
  J.materials[0].alphaMode === "BLEND" && J.materials[0].pbrMetallicRoughness.baseColorFactor[3] === 0.3 && J.extensionsUsed[0] === "KHR_lights_punctual" && J.extensions.KHR_lights_punctual.lights.length === 2
  && J.nodes[1].translation.join() === "2,2,-1.5" && J.nodes[2].rotation && J.scenes[0].nodes.length === 3, J.nodes);

/* the wiring */
const EJ = JSON.parse(read("ext/pushpulldock/ext.json")), DH = read("ext/pushpulldock/dock.html"), DK = read("ext/pushpulldock/ppdock.js"), FR = read("ext/pushpulldock/ppframe.js"), TL = read("ext/pushpulldock/pptools.js"), AV = read("ext/pushpulldock/pparchview.js");
check("the extension loads the architecture before the tools, the file menu last", EJ.scripts.join() === "ppgeo.js,ppglb.js,ppview.js,pparch.js,pparchview.js,pparchtools.js,pptools.js,ppdock.js,ppframe.js");
check("the bar: ☰ File, 🖼 → Image editor, 🎞 → Timeline, 🌙 Night, ⌂ Cut-away; the panel; the Build tools in the toolbar",
  /id="ppFile"/.test(DH) && /id="ppToIE"/.test(DH) && /id="ppToTL"/.test(DH) && /id="ppNight"/.test(DH) && /id="ppCut"/.test(DH) && /id="ppProps"/.test(DH)
  && /\$\("ppToIE"\)\.onclick = \(\) => guard\("→ Image editor", \(\) => toEditor\(false\)\)/.test(DK) && /\$\("ppToTL"\)\.onclick = \(\) => guard\("→ Timeline", toTimeline\)/.test(DK) && /pptsep/.test(DK));
check("maximized = fixed over the whole window under the title bar (--pp-top from #titlebar); the usual ⛶ / Esc",
  /#pushpulldock\.maxed \{ position: fixed !important; left: 0 !important; right: 0 !important; bottom: 0 !important; top: var\(--pp-top, 0px\) !important/.test(DH) && /getElementById\("titlebar"\)|\$\("titlebar"\)/.test(FR) && /toggleMax\("pushpulldock"(, on)?\)/.test(FR) && /else if \(tool !== "select"\) \{ use\("select"\);[^\n]*else return false; return true;/.test(TL));
check("☰ File: New, Open, Save, Save as, Rename, import (project / this computer), Export, → image editor / timeline, Send, Delete, Maximize, Close",
  ["＋ New", "📂 Open…", "💾 Save as…", "✎ Rename…", "From this computer", "⤓ Export…", "🖼 → the image editor", "🎞 → the timeline", "➜ Send to…", "🗑 Delete this model…", "✕ Close the docker"].every((t) => FR.includes(t)) && !/\bprompt\s*\(/.test(FR));
check("the lights are real three.js lights (point / spot) at night; walls drawn from pparch's build; the arch hooks in pptools",
  /new T\.PointLight/.test(AV) && /new T\.SpotLight/.test(AV) && /P\(\)\.build\(Ar\)/.test(AV) && /AT\.selectDown\(ev\)/.test(TL) && /AT\.eraseAt\(ev\)/.test(TL) && /AT\.paintAt\(/.test(TL));
check("polygon-clipping (MIT) in static/vendor with its licence + NOTICE", fs.existsSync(path.join(R, "static/vendor/polygon-clipping.umd.min.js")) && /MIT/.test(read("static/vendor/LICENSE-polygon-clipping.txt")) && /polygon-clipping\.umd\.min\.js/.test(read("misc/NOTICE.md")));
check("the help page and the shortcuts list tell the Build tools", /U ⌂ Room/.test(read("static/help/pushpull.html")) && /Rooms share walls/.test(read("static/help/pushpull.html")) && JSON.parse(read("docs/shortcuts.json")).groups.some((x) => x.rows.some((r) => r[0] === "U / W")));
check("server.js untouched by this release", !/pushpull|pparch/i.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
