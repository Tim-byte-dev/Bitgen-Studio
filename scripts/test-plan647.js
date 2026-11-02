#!/usr/bin/env node
/* bitGen Studio — 2.647.0: THE SKETCHER'S 📐 FLOORPLAN (ext/pushpulldock/ppplan.js), Esc = no tool + 🔄 Orbit (pptools.js /
 * pparchtools.js) and a room's WIDTH × LENGTH (pparch.js roomSize / resizeRoom) - pure + the wiring. The real view:
 * scripts/test-ui647-ui.js. Tim (verbatim): "add floorplan view to sketcher, the buttons will still draw what they are set too
 * but with floorplan symbols in floorplan mode. esc deselects all tools and changes to orbit mode in all views, rooms will have
 * width and length properties" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
globalThis.PPArch = P;
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));

// ---- a room's width × length
let A = P.empty();
const R = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]], {});
const s0 = P.roomSize(R);
check("roomSize: a 4 × 3 room = width 4 (along its first wall) × length 3", s0 && s0.w === 4 && s0.l === 3, s0);
check("resizeRoom: a rectangle 5 × 2 keeps its first corner", P.resizeRoom(A, R.id, 5, 2) && JSON.stringify(R.pts) === "[[0,0],[5,0],[5,2],[0,2]]", R.pts);
const Lr = P.addRoom(A, [[10, 0], [14, 0], [14, 2], [12, 2], [12, 4], [10, 4]], {});
const d0 = P.addOp(A, "door", 0.9, { room: Lr.id, edge: 0, at: 2 });
check("roomSize: an L-shaped room = its box along its first wall (4 × 4)", JSON.stringify([P.roomSize(Lr).w, P.roomSize(Lr).l]) === "[4,4]", P.roomSize(Lr));
P.resizeRoom(A, Lr.id, 8, 2);
check("resizeRoom: any other shape stretched from its box's corner (8 × 2), its door kept in proportion along its wall", JSON.stringify([P.roomSize(Lr).w, P.roomSize(Lr).l]) === "[8,2]" && Lr.pts[1][0] === 18 && d0 && Math.abs(A.ops.find((o) => o.id === d0.id).at - 4) < 1e-6, { pts: Lr.pts, op: A.ops });
check("resizeRoom: not too small, not a free wall", !P.resizeRoom(A, R.id, 0.01, 2) && !P.resizeRoom(A, 999, 3, 3));

// ---- the floorplan's symbols
A = P.empty();
const K = P.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" });
const B = P.addRoom(A, [[5, 0], [9, 0], [9, 4], [5, 4]], { name: "Bed" });
const door = P.addOp(A, "door", 0.9, { room: K.id, edge: 0, at: 2 });
const dbl = P.addOp(A, "door", 1.6, { room: K.id, edge: 3, at: 2, style: "double" });
const win = P.addOp(A, "window", 1.2, { room: B.id, edge: 2, at: 2, style: "double" });
const up = P.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Loft", z: 2.85 });
A.stairs.push({ id: A.n++, x: 1, y: 2, ang: 0, w: 1, len: 3, rise: 2.85, z: 0, col: "#b08a62" });
A.lights.push({ id: A.n++, type: "downlight", x: 2.5, y: 2, z: 2.68, room: K.id, col: "#fff", lm: 800, on: true });
A.items = [{ id: A.n++, type: "bed", x: 8, y: 3, z: 0, rot: 0, w: 1, d: 1, h: 0.5, color: "" }, { id: 999, type: "rug", x: 7, y: 2, z: 0, rot: 0, w: 1.6, d: 2, h: 0.01, color: "" }];
check("levels: the storeys lowest first (0, 2.85)", JSON.stringify(PL.levels(A)) === "[0,2.85]", PL.levels(A));
const fp = (it) => [[it.x - it.w / 2, it.y - it.d / 2], [it.x + it.w / 2, it.y - it.d / 2], [it.x + it.w / 2, it.y + it.d / 2], [it.x - it.w / 2, it.y + it.d / 2]];
const S = PL.symbols(A, 0, { footprint: fp, label: (it) => it.type });
const floors = S.fills.filter((f) => f.k === "floor"), walls = S.fills.filter((f) => f.k === "wall");
check("the ground floor: two rooms' floors (the loft is on the other storey)", floors.length === 2 && floors.every((f) => f.tag.ak === "room") && !floors.some((f) => f.tag.id === up.id), floors.map((f) => f.tag));
check("the walls: ONE solid shape (the shared wall once), the openings cut out of it (holes / gaps)", walls.length >= 1 && walls.length <= 3 && walls.some((w) => w.rings.length >= 2 || walls.length > 1), walls.map((w) => w.rings.length));
const names = S.texts.map((t) => t.t);
check("each room: its name, its Width × Length, its area", ["Kitchen", "Bed", "5 × 4 m", "4 × 4 m"].every((n) => names.some((x) => x.replace(/\.(\d)0\b/, ".$1") .startsWith(n.split(" m")[0]) || x === n)) && names.some((x) => /m²$/.test(x)), names);
const arcs = S.lines.filter((l) => l.pts.length >= 10);
check("doors: a single door = one leaf + its swing, a double door = two leaves + two swings (quarter circles)", arcs.length >= 3 + 1, arcs.length);
const qtr = arcs.find((l) => { const a = l.pts[0], b = l.pts[l.pts.length - 1]; return Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1]) - 0.9 * Math.SQRT2) < 0.02; });
check("…the single door's swing: a quarter circle of its width (0.9 m)", !!qtr);
const glass = S.lines.filter((l) => l.col === PL.COL.glass);
check("a window: its glass (two lines for two panes)", glass.length === 2, glass.length);
check("the stairs: outline, every tread, the walking line + arrow, UP", S.texts.some((t) => t.t === "UP") && S.lines.filter((l) => l.col === PL.COL.stair).length >= 10);
check("a light: a circle and a cross", S.lines.filter((l) => l.col === PL.COL.light).length === 3);
const bedLab = S.texts.find((t) => t.t === "Bed"), stLab = S.texts.find((t) => t.t === "Kitchen"), inR = (q, x0, y0, x1, y1) => q[0] > x0 && q[0] < x1 && q[1] > y0 && q[1] < y1;
check("furniture: its outline on white + its name; a room's label moves off the furniture / the stairs under its middle", S.fills.some((f) => f.k === "furn" && f.tag && f.tag.ak === "item") && names.includes("bed") && names.includes("rug")
  && !inR(bedLab.p, 6.2, 1, 7.8, 3) && !inR(stLab.p, 1, 1.55, 3.6, 2.45), { names, bed: bedLab.p, kitchen: stLab.p });
const S2 = PL.symbols(A, 2.85, { footprint: fp });
check("the upper storey: only the loft (no stairs from here, no ground-floor door)", S2.fills.filter((f) => f.k === "floor").length === 1 && !S2.texts.some((t) => t.t === "UP"));
A.hide = ["room:" + B.id];
check("what the outline docker hides is not drawn", PL.symbols(A, 0, {}).fills.filter((f) => f.k === "floor").length === 1);
A.hide = [];

// ---- picking on the plan
const pk = (x, y, z) => PL.pickAt(A, [x, y], z || 0);
check("pick: the door (in its gap and in its swing)", pk(2, 0)?.ak === "op" && pk(2, 0).id === door.id && pk(1.8, 0.6)?.ak === "op", [pk(2, 0), pk(1.8, 0.6)]);
check("pick: the window", pk(7, 4)?.ak === "op" && pk(7, 4).id === win.id, pk(7, 4));
check("pick: the light, the stairs", pk(2.55, 2.05)?.ak === "light" && pk(2, 2.2)?.ak === "stair", [pk(2.55, 2.05), pk(2, 2.2)]);
check("pick: a wall (its room + which wall) - away from the door", JSON.stringify(pk(4, 0)) === JSON.stringify({ ak: "wall", room: K.id, edge: 0 }), pk(4, 0));
check("pick: inside a room = the room; the loft on its own storey", pk(4, 3.5)?.ak === "room" && pk(4, 3.5).id === K.id && pk(4, 3.5, 2.85)?.id === up.id, [pk(4, 3.5), pk(4, 3.5, 2.85)]);
check("pick: nothing outside", pk(20, 20) === null);
check("tint: a floor colour 72 % paper; a material / nothing = a light grey", PL.tint("#c8a882") === "#eadfd1" && PL.tint("mat:oak") === "#ece8df", [PL.tint("#c8a882"), PL.tint("mat:oak")]);

// ---- the wiring
const D = "ext/pushpulldock/", T = read(D + "pptools.js"), AT = read(D + "pparchtools.js"), AV = read(D + "pparchview.js"), PD = read(D + "ppdock.js"), H = read(D + "dock.html"), PS = read(D + "ppplan.js"), EJ = JSON.parse(read(D + "ext.json"));
check("ppplan.js loaded after pparchview.js", EJ.scripts.indexOf("ppplan.js") === EJ.scripts.indexOf("pparchview.js") + 1);
check("Esc: ONE press - the step ends (a wall run kept), the group left, nothing picked, 🔄 Orbit; not ours when there is nothing (a maximized docker)",
  /if \(k === "Escape"\) return escape\(\);\s*\n\s*if \(AT && AT\.key\(e, tool\)\) return true;/.test(T) && /if \(tool !== "orbit"\) \{ use\("orbit"\); did = true; \}/.test(T) && /if \(!did\) return false;/.test(T)
  && /baseTool === "wall" && st\.pts && st\.pts\.length >= 2\) \{ finishWall\(false\); did = "kept"; \}/.test(AT) && /if \(asel\) \{ setSel\(null, true\); did = did \|\| true; \}/.test(AT)
  && /if \(r === "kept" && ctx\.statusText\) kept = ctx\.statusText\(\);/.test(T));
check("…Esc in the Measurements box too", /if \(S\.T && S\.T\.escape\) S\.T\.escape\(\);/.test(PD));
check("the 📐 Plan button, View ▾ Floorplan, the storey list", /id="ppPlan"/.test(H) && /<option value="plan">📐 Floorplan<\/option>/.test(H) && /id="ppPlanLvl"/.test(H) && /\$\("ppPlan"\)\.onclick/.test(PD) && /if \(v === "plan"\)/.test(PD));
check("another view or a camera's view ends the floorplan", /if \(S\.P && S\.P\.on\(\)\) setPlan\(false, true\);/.test(PD) && /if \(ctx\.leavePlan\) ctx\.leavePlan\(\);/.test(AT));
check("the 3D view's hooks: the plan's own picking, rebuilt with the building, its paper kept, the outline over it",
  /if \(A\.planPick\) \{ const h = A\.planPick\(ev\); if \(h !== undefined\) return h; \}/.test(AV) && /if \(A\.onRebuild\)/.test(AV) && /if \(A\.onLayers\) A\.onLayers\(\);/.test(AV) && /if \(A\.onPaint\) A\.onPaint\(selG\);/.test(AV));
check("the plan view: straight down, parallel, flat (orbit only turns it), the 3D building hidden, back as it was",
  /V\.view\("top"\)/.test(PS) && /c\.maxPolarAngle = 1e-3/.test(PS) && /HIDE = \["pp-arch", "pp-fixtures", "pp-furniture"\]/.test(PS) && /V\.restore\(plan\.keep\)/.test(PS));
check("a room's panel: Width + Length for any room; the Room tool: Width + Length = one click",
  /numIn\("Width", sz\.w/.test(AT) && /numIn\("Length", sz\.l/.test(AT) && /numIn\("Length", o\.l \|\| 0, opt\("l"\)/.test(AT) && /finishRoom\(p, \[p\[0\] \+ O\.room\.w, p\[1\] \+ O\.room\.l\]\)/.test(AT) && /room: "Width,Length"/.test(AT));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
