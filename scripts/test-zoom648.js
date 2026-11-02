#!/usr/bin/env node
/* bitGen Studio — 2.648.0: SHIFT + RIGHT-DRAG ZOOM (static/zoomdrag.js), ⊡ ZOOM TO SELECTION, the POINTER icon
 * (static/pointericon.js) in the Sketcher, the timeline and the image editor; the Sketcher's Esc (Orbit <-> Select, never
 * docks it) and Ctrl+click picking several - pure + the wiring. The real presses: scripts/test-ui648-ui.js.
 * Tim (verbatim): "add zoom control, shift + drag foward = zoom in, shift + drag back = zoom out, add a zoom to selection
 * tool, change the selection icon to a pointer. do these changes for sketcher,timeline and image editor" / "if in orbit mode
 * and the user press esc go to select, esc any other time will go to orbit mode - do not dock the maximized docker when esc
 * is pressed" / "pick tool to select a single object, ctrl+click will add to the selection" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const root = {};
new Function("window", "globalThis", read("static/zoomdrag.js"))(root, root);
new Function("window", "globalThis", read("static/pointericon.js"))(root, root);
const Z = root.H3ZoomDrag, PI = root.H3PointerIcon;
check("factor: forward (up) zooms in, back zooms out, symmetric (100 px = ×1.82)", Math.abs(Z.factor(-100) - 1.8221) < 1e-3 && Math.abs(Z.factor(-100) * Z.factor(100) - 1) < 1e-12 && Z.factor(0) === 1);
check("isPress: Shift + the right button only (not left, not with Ctrl / Alt / Meta)", Z.isPress({ button: 2, shiftKey: true }) && ![{ button: 0, shiftKey: true }, { button: 2 }, { button: 2, shiftKey: true, ctrlKey: true }, { button: 2, shiftKey: true, altKey: true }, null].some((e) => Z.isPress(e)));
// attach: a fake element - a drag zooms round the press, no menu after it, a plain click leaves the menu alone
const L = {}; const el = { addEventListener: (t, f) => { L[t] = f; }, removeEventListener() {}, getBoundingClientRect: () => ({ left: 10, top: 20 }), setPointerCapture() {}, releasePointerCapture() {} };
const calls = []; Z.attach(el, { zoom: (f, x, y) => calls.push([+f.toFixed(4), x, y]) });
const E = (o) => Object.assign({ pointerId: 1, stopped: 0, prevented: 0, preventDefault() { this.prevented++; }, stopPropagation() { this.stopped++; }, stopImmediatePropagation() {} }, o);
const d0 = E({ button: 2, shiftKey: true, clientX: 110, clientY: 220 }); L.pointerdown(d0);
L.pointermove(E({ clientX: 110, clientY: 170 })); L.pointermove(E({ clientX: 112, clientY: 270 })); L.pointerup(E({}));
const m1 = E({}); L.contextmenu(m1);
check("a drag: caught first, zooms in then out round the point pressed (100, 200), no menu after it", d0.prevented && d0.stopped && calls.length === 2 && calls[0][0] > 1 && calls[1][0] < 1 && calls.every((c) => c[1] === 100 && c[2] === 200) && m1.prevented === 1, calls);
const n0 = calls.length; const d1 = E({ button: 0, shiftKey: true, clientX: 50, clientY: 50 }); L.pointerdown(d1); L.pointermove(E({ clientX: 50, clientY: 10 }));
check("a Shift + LEFT drag is not the zoom's (the editors keep it)", calls.length === n0 && !d1.prevented);
check("the pointer icon: an arrow path; svg() / apply()", /^M6 3 L6 19/.test(PI.PATH) && /<svg class="h3ptr"[^>]*><path d="M6 3/.test(PI.svg({ size: 17 })) && /width="17"/.test(PI.svg({ size: 17 })));

// ---- the Sketcher's building: the box round a picked part, several moved together
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const A = P.empty(), R1 = P.addRoom(A, [[0, 0], [4, 0], [4, 3], [0, 3]], { name: "A" }), R2 = P.addRoom(A, [[8, 0], [11, 0], [11, 3], [8, 3]], { name: "B" });
const op = P.addOp(A, "door", 0.9, { room: R1.id, edge: 0, at: 2 });
A.items = [{ id: 77, type: "bed", x: 9, y: 1.5, z: 0, rot: 0, w: 1.6, d: 2, h: 0.6 }]; A.lights.push({ id: 78, type: "downlight", x: 2, y: 1.5, z: 2.68, room: R1.id });
const bx = P.selBox(A, { ak: "room", id: R2.id });
check("selBox: a room = its walls' box (floor to wall top)", JSON.stringify(bx) === JSON.stringify({ min: [8, 0, 0], max: [11, 3, 2.7] }), bx);
const bw = P.selBox(A, { ak: "room", id: R1.id, part: "wall", edge: 1 });
check("…one of its walls = that wall only", bw.min[0] === 4 && bw.max[0] === 4 && bw.min[1] === 0 && bw.max[1] === 3, bw);
check("…a door, a piece, nothing", P.selBox(A, { ak: "op", id: op.id }).max[2] > 2 && P.selBox(A, { ak: "item", id: 77 }).min[0] < 9 && P.selBox(A, null) === null && P.selBox(A, { ak: "op", id: 999 }) === null);
P.moveMany(A, [{ ak: "room", id: R1.id, part: "ceil" }, { ak: "item", id: 77 }, { ak: "light", id: 78 }], [1, 2]);
check("moveMany: a room (picked by a part) moves whole with its light once; a piece by itself; the other room stays",
  JSON.stringify(R1.pts[0]) === "[1,2]" && A.items[0].x === 10 && A.items[0].y === 3.5 && A.lights[0].x === 3 && A.lights[0].y === 3.5 && JSON.stringify(R2.pts[0]) === "[8,0]", { r1: R1.pts[0], it: A.items[0], L: A.lights[0] });

// ---- the wiring
const H = read("static/index.html"), IE = read("ext/imageeditdock/imageedit.js"), UI = read("ext/imageeditdock/pcui.js"), FO = read("ext/imageeditdock/pcfocus.js");
const CV = read("ext/timelinedock/canvas.js"), TD = read("ext/timelinedock/dock.html"), CB = read("ext/timelinedock/tlcadbar.js");
const PD = read("ext/pushpulldock/ppdock.js"), PV = read("ext/pushpulldock/ppview.js"), PT = read("ext/pushpulldock/pptools.js"), AT = read("ext/pushpulldock/pparchtools.js"), PF = read("ext/pushpulldock/ppframe.js"), DH = read("ext/pushpulldock/dock.html");
check("loaded early by the page", /<script src="\/static\/zoomdrag\.js"><\/script>/.test(H) && /<script src="\/static\/pointericon\.js"><\/script>/.test(H) && H.indexOf("zoomdrag.js") < H.indexOf("promptfront.js"));
check("image editor: the stage zooms with it; ⊡ Zoom to Selection (View menu, Ctrl+Alt+0, the tool column); Move = the pointer",
  /H3ZoomDrag\.attach\(stage, \{ enabled: \(\) => !!S\.w, zoom: \(f, x, y\) => zoomAt\(f, x, y\) \}\)/.test(IE) && /function zoomToSel\(\)/.test(IE) && /cmd\("view\.zoomsel", "Zoom to Selection", "Ctrl\+Alt\+0"/.test(UI) && /"view\.100", "view\.zoomsel"/.test(UI) && /id = "pcZoomSel"/.test(UI) && /move: root\.H3PointerIcon \?/.test(UI));
check("artist mode: Shift + right-CLICK leaves it (on release, no drag), a drag zooms", /if \(far <= 4 && on\) setFocus\(false\);/.test(FO) && !/eatMenu = true; setTimeout\(\(\) => \{ eatMenu = false; \}, 600\);\s*\n\s*setFocus\(false\);/.test(FO));
check("timeline: the canvas zooms with it; ⊡ (and the ribbon's) zoom to the picked layer; Move = the pointer",
  /H3ZoomDrag\.attach\(cv, \{ zoom: function \(f, x, y\) \{ zoomAt\(f, x, y\); \} \}\)/.test(CV) && /function zoomToSel\(\)/.test(CV) && /id="tlTool_zsel"/.test(TD) && /c_zsel/.test(CB) && /H3PointerIcon\.apply\(\$\("tlTool_move"\)/.test(CV) && /tool\("move", "Move", window\.H3PointerIcon/.test(CB));
check("Sketcher: the 3D view zooms with it (round the point, a camera's view left); ⊡ zooms to what is picked; Select = the pointer",
  /H3ZoomDrag\.attach\(cv, \{ start:/.test(PD) && /zoom: \(f, x, y\) => S\.V\.zoomAt\(f, x, y\)/.test(PD) && /function zoomAt\(f, sx, sy\)/.test(PV) && /function frameBox\(b\)/.test(PV) && /id="ppZoomSel"/.test(DH) && /function zoomSel\(\)/.test(PD) && /if \(id === "select" && root\.H3PointerIcon\) root\.H3PointerIcon\.apply\(b/.test(PD));
check("Sketcher Esc: in Orbit = ➤ Select, otherwise 🔄 Orbit, always the Sketcher's; maximized: never docked (its own boxes too)",
  /if \(wasOrbit\) \{ use\("select"\);/.test(PT) && /return true;\s*\n\s*\}\s*\n\s*function key\(e\)/.test(PT) && /classList\.contains\("maxed"\) && !doc\.querySelector\("dialog\[open\]"\)\) \{/.test(PD) && /dock\.addEventListener\("keydown", \(e\) => \{ if \(e\.key === "Escape" && maxed\(\)\) e\.stopPropagation\(\); \}\);/.test(PF) && !/toggleMaxed\(false\); \}\);\s*\n\s*paintMax\(\);/.test(PF));
check("Sketcher pick: Ctrl+click adds (faces / lines: Ctrl only adds), building parts several at once (drag together, Delete all, the panel)",
  /pickSel\(ev, ev\.shiftKey \|\| ev\.ctrlKey \|\| ev\.metaKey, \(ev\.ctrlKey \|\| ev\.metaKey\) && !ev\.shiftKey\)/.test(PT) && /const ctrl = ev\.ctrlKey \|\| ev\.metaKey, all = picked\(\)/.test(AT) && /P\(\)\.moveMany\(M\.arch, D\.many, d\)/.test(AT) && /if \(amore\.length\) \{\s*\/\/ 2\.648\.0: several picked - all of them/.test(AT) && /head\("➤ " \+ \(amore\.length \+ 1\) \+ " picked"\)/.test(AT));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
