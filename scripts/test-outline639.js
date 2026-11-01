#!/usr/bin/env node
/* bitGen Studio — 2.639.0 (pure + wiring): THE SKETCHER'S 🗂 OUTLINE DOCKER, SKIRTING + CORNICE, HIDE / SHOW, ROOM GROUPS,
 * A WALL MOVED ACROSS ITS LINE / FREELY (Alt), Shift+click = THE WHOLE ROOM. (ext/pushpulldock/ppoutline.js, pparch.js,
 * pparchtools.js, pparchview.js)
 * Tim: "add a docker to sketcher, show each object in the docker like ceilings - ceiling 1, ceiling 2 etc. when a room is drawn
 * show the walls,ceiling,doors,windows, floors,cornices,skirting/trim in the docker under room name (room 1, room 2 etc) when
 * user clicks on a wall and drags it, it will move in the axis of the wall, alt+click will give it free movement, extend or
 * cut, walls, floor,skirting,cornices and ceiling to the new position. shift+click selects an entire room - allow user to make
 * room groups and items in the groups hidden/visible." */
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
const P = globalThis.PPArch = require(path.join(R0, "ext", "pushpulldock", "pparch.js"));
const O = require(path.join(R0, "ext", "pushpulldock", "ppoutline.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

const A = P.empty();
const R1 = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]]), R2 = P.addRoom(A, [[4, 0], [8, 0], [8, 3], [4, 3]]);
const d1 = P.addOp(A, "door", 0.9, { room: R1.id, edge: 0, at: 2 }), w1 = P.addOp(A, "window", 1.2, { room: R1.id, edge: 2, at: 2 });
check("a new room comes with skirting (10 cm) and a cornice (8 cm) in the trim colour", R1.skirtOn && R1.corniceOn && R1.skirtH === 0.1 && R1.corniceH === 0.08 && R1.trim === P.DEF.trim);
const B = P.build(A), sk = B.polys.filter((p) => p.tag.part === "skirt" && p.tag.id === R1.id), co = B.polys.filter((p) => p.tag.part === "cornice" && p.tag.id === R1.id);
check("built: Room 1's skirting round its inside with a gap at the door (5 runs), its cornice round the top (4)", sk.length === 5 * 6 && co.length === 4 * 6, { sk: sk.length / 6, co: co.length / 6 });
const zs = sk.flatMap((p) => p.rings[0].map((q) => q[2])), zc = co.flatMap((p) => p.rings[0].map((q) => q[2]));
check("…the skirting from the floor to 10 cm, the cornice under the ceiling (2.7 m)", near(Math.min(...zs), 0) && near(Math.max(...zs), 0.1) && near(Math.max(...zc), 2.696, 1e-3) && near(Math.min(...zc), 2.62, 1e-3));
const old = P.clean({ rooms: [{ pts: [[0, 0], [2, 0], [2, 2], [0, 2]] }] }).rooms[0];
check("an older model's rooms keep their look (no skirting / cornice until ticked); kept through clean()", !old.skirtOn && !old.corniceOn && P.clean(JSON.parse(JSON.stringify(A))).rooms[0].skirtOn === true);

// the outline
const T = O.tree(A);
const rooms = T.find((n) => n.key === "sec:rooms"), r1 = rooms.children[0];
const labels = r1.children.map((c) => c.label);
check("the outline: Room groups, Rooms ▸ Room 1 ▸ Wall 1 … 4, Floor 1, Ceiling 1, Skirting 1, Cornice 1, Door 1, Window 1", T[0].key === "sec:groups" && rooms.children.length === 2 && r1.label === "Room 1"
  && ["Wall 1", "Wall 2", "Wall 3", "Wall 4", "Floor 1", "Ceiling 1", "Skirting 1", "Cornice 1", "Door 1", "Window 1"].every((l) => labels.includes(l)) && rooms.children[1].children.some((c) => c.label === "Ceiling 2"), labels);
check("…each row picks what it is (a wall = the room's wall i, a door = the op)", r1.children[0].sel.part === "wall" && r1.children[0].sel.edge === 0 && r1.children.find((c) => c.label === "Door 1").sel.ak === "op");
// hide / show
O.toggleKey(A, "room:" + R1.id + ":ceil");
let H = P.hiddenOf(A);
check("👁 Ceiling 1 off: hidden (not built), the rest of the room shown", H("room:" + R1.id + ":ceil") && !H("room:" + R1.id + ":floor") && !P.build(A).polys.some((p) => p.tag.id === R1.id && p.tag.part === "ceil") && P.build(A).polys.some((p) => p.tag.id === R2.id && p.tag.part === "ceil"));
O.toggleKey(A, "room:" + R1.id + ":ceil");
O.toggleKey(A, "room:" + R1.id + ":wall:3");
check("👁 a single wall off (the west one - not shared): its piece is not built (the others are)", P.hiddenOf(A)("room:" + R1.id + ":wall:3") && P.build(A).polys.length !== P.build(Object.assign({}, A, { hide: [] })).polys.length);
O.toggleKey(A, "room:" + R1.id + ":wall:3");
// groups
const g = O.newGroup(A, "Ground floor", [R1.id, R2.id]);
let T2 = O.tree(A);
check("room groups: a group holds its rooms (out of the plain Rooms list)", T2[0].children.length === 1 && T2[0].children[0].label === "Ground floor" && T2[0].children[0].children.length === 2 && T2.find((n) => n.key === "sec:rooms").children.length === 0);
O.toggleKey(A, "group:" + g.id);
H = P.hiddenOf(A);
check("the group's 👁 off: every room in it hidden - walls, floors, ceilings, skirting, doors, windows - nothing built", H("room:" + R1.id) && H("room:" + R2.id + ":wall:0") && H("op:" + d1.id) && H("op:" + w1.id) && P.build(A).polys.length === 0);
O.toggleKey(A, "group:" + g.id);
O.setGroup(A, R2.id, null); O.renameGroup(A, g.id, "Upstairs");
check("a room out of its group; a group renamed / deleted (its rooms stay)", A.groups[0].rooms.join() === String(R1.id) && A.groups[0].name === "Upstairs" && O.removeGroup(A, g.id) && !A.groups.length && A.rooms.length === 2);
const keep = P.clean(Object.assign({}, A, { hide: ["room:" + R1.id + ":floor", "../bad"], groups: [{ id: 99, name: "G", rooms: [R1.id, 12345], hidden: true }] }));
check("saved with the model: arch.hide (only good keys), arch.groups (only real rooms)", keep.hide.join() === "room:" + R1.id + ":floor" && keep.groups[0].rooms.join() === String(R1.id) && keep.groups[0].hidden);
// walls moved
const A3 = P.empty(), R3 = P.addRoom(A3, [[0, 0], [4, 0], [4, 3], [0, 3]]);
P.moveEdge(A3, R3.id, 1, 1);
check("a wall dragged: it moves across its own line (east wall 1 m out) - the walls beside it stretch", near(R3.pts[1][0], 5) && near(R3.pts[2][0], 5) && near(R3.pts[1][1], 0) && near(R3.pts[2][1], 3));
P.moveEdgeBy(A3, R3.id, 1, [1, 0.5]);
check("Alt (free): the wall moves any way - both its ends by the same, the walls beside it follow", near(R3.pts[1][0], 6) && near(R3.pts[1][1], 0.5) && near(R3.pts[2][1], 3.5));
check("…a free move that would turn the room inside out is refused", P.moveEdgeBy(A3, R3.id, 1, [-20, 0]) === false && near(R3.pts[1][0], 6));
const sk3 = P.build(A3).polys.filter((p) => p.tag.part === "skirt").flatMap((p) => p.rings[0].map((q) => q[0]));
check("…the floor, ceiling, skirting and cornice follow the new walls (built from them)", Math.max(...sk3) > 5.8);

/* the wiring */
const TL = read("ext/pushpulldock/pparchtools.js"), AV = read("ext/pushpulldock/pparchview.js"), DK = read("ext/pushpulldock/ppdock.js"), EX = JSON.parse(read("ext/pushpulldock/ext.json")), OL = read("ext/pushpulldock/ppoutline.js");
check("Shift+click on any part of a room picks the whole room (a drag then moves it); Alt+press on a wall = free", /if \(ev\.shiftKey && t\.ak === "room"\) t = \{ ak: "room", id: t\.id \}/.test(TL) && /free: !!ev\.altKey/.test(TL) && /P\(\)\.moveEdgeBy\(A, R\.id, D\.t\.edge, v\)/.test(TL));
check("the room panel: Skirting / Skirting height / Cornice / Cornice size / their colour", /chkIn\("Skirting"/.test(TL) && /"Skirting height"/.test(TL) && /chkIn\("Cornice"/.test(TL) && /"Cornice size"/.test(TL));
check("hidden furniture / cameras are not drawn; the outline repaints with the docker (info) and is loaded after ppframe.js", /hid\("item:" \+ it\.id\)/.test(AV) && /hid\("cam:" \+ c\.id\)/.test(AV) && /PPOutline\.paint\(\)/.test(DK) && EX.scripts.indexOf("ppoutline.js") > EX.scripts.indexOf("ppframe.js") && /commit, snapshot/.test(DK));
check("the docker: 🗂 Outline in the bar, 👁 / ⊞ / ＋ / ✎ / ✕, undo-able edits", /ppOutlineBtn/.test(OL) && /data-act="eye"/.test(OL) && /data-act="group"/.test(OL) && /data-act="newgroup"/.test(OL) && /h\.commit\(label, before\)/.test(OL));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
