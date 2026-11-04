#!/usr/bin/env node
/* bitGen Studio — 2.651.0: THE SKETCHER'S MATERIAL TOOLS - each wall's inside and outside, the glass, PICTURE materials
 * (A.tex, "tex:<id>"), the BACKGROUND (A.bg backdrop / 360° sky) - the model (pparch.js), the material helpers (ppfurn.js),
 * the picker's pure parts (ppmatpick.js) and the wiring. The real clicks: scripts/test-ui651-ui.js.
 * Tim (verbatim): "can we add material tools to sketcher, so wall_1 interior, wall_1 exterior, windows, etc, and use reference
 * images for the texture, background etc." */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const F = require(path.join(ROOT, "ext/pushpulldock/ppfurn.js"));
const root = {}; new Function("window", "globalThis", read("ext/pushpulldock/ppmatpick.js"))(root, root); const M = root.PPMatPick;

// ---- the model keeps them, and only good ones
const raw = { rooms: [{ id: 1, pts: [[0, 0], [4, 0], [4, 3], [0, 3]], wcol: { 0: "tex:p1", 1: "#AABBCC", 9: "#000000" }, wext: { 2: "mat:brick", 3: "javascript:x" } }],
  ops: [{ id: 2, kind: "window", room: 1, edge: 0, at: 2, w: 1.2, glass: "#22aa55" }, { id: 3, kind: "door", room: 1, edge: 2, at: 1, w: 0.9, glass: "nope" }],
  tex: [{ id: "p1", name: "Brick photo", src: "/passets/images/brick 1.png", size: 2, rot: 30, avg: "#884422" }, { id: "p2", src: "http://evil/x.png" }, { id: "BAD!", src: "/passets/images/a.png" }, { id: "p1", src: "/passets/images/dup.png" }],
  bg: { kind: "sky", src: "/passets/images/pano.jpg", rot: 45 } };
const A = P.clean(raw), R = A.rooms[0];
check("a wall's inside (wcol) and outside (wext): pictures / materials / colours kept, a bad value or a wall that is not there dropped",
  JSON.stringify(R.wcol) === JSON.stringify({ 0: "tex:p1", 1: "#aabbcc" }) && JSON.stringify(R.wext) === JSON.stringify({ 2: "mat:brick" }), { wcol: R.wcol, wext: R.wext });
check("a window's glass kept; a bad one = the default glass", A.ops[0].glass === "#22aa55" && A.ops[1].glass === "#9ec5e8", A.ops.map((o) => o.glass));
check("the pictures (A.tex): only a project image (or a data picture), a good id, once; size / turn / average colour kept",
  A.tex.length === 1 && JSON.stringify(A.tex[0]) === JSON.stringify({ id: "p1", name: "Brick photo", src: "/passets/images/brick 1.png", size: 2, rot: 30, avg: "#884422" }), A.tex);
check("the background: a 360° sky (its picture, turned); a backdrop; nothing / a bad one = none",
  JSON.stringify(A.bg) === JSON.stringify({ kind: "sky", src: "/passets/images/pano.jpg", name: "Background", rot: 45 }) && P.cleanBg({ kind: "backdrop", src: "/passets/images/b.png" }).kind === "backdrop"
  && P.cleanBg({ kind: "wallpaper", src: "/passets/images/b.png" }) === null && P.cleanBg({ kind: "sky", src: "file:///etc/passwd" }) === null && P.clean({}).bg === null);

// ---- the outside: each wall its own (the build), the wall a point is in
const B = P.empty(), K = P.addRoom(B, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "K" }), L = P.addRoom(B, [[5, 0], [9, 0], [9, 4], [5, 4]], { name: "L" });
K.wext = { 0: "#ff0000" }; L.wext = { 1: "mat:brick" };
const w = P.wallOwner(B, [2.5, -0.02], 1);
check("wallOwner: a point inside a wall's thickness = that room + wall (K's wall 1); outside every wall = none", w && w.R.id === K.id && w.i === 0 && P.wallOwner(B, [2.5, -3], 1) === null && P.wallOwner(B, [2.5, -0.02], 50) === null, w && { r: w.R.id, i: w.i });
check("wallExt: a wall's own outside, else the building's", P.wallExt(B, K, 0) === "#ff0000" && P.wallExt(B, K, 1) === B.ext);
const built = P.build(B), outFaces = built.polys.filter((pl) => pl.tag && pl.tag.ak === "wall" && pl.tag.room == null);
const colAt = (x, y) => (outFaces.find((pl) => pl.rings[0].every((q) => Math.abs(q[1] - y) < 0.2) && pl.rings[0].some((q) => Math.abs(q[0] - x) < 2.6)) || {}).col;
const eastL = outFaces.find((pl) => pl.rings[0].every((q) => Math.abs(q[0] - 9.075) < 0.01));
check("the build: K's south wall outside red, L's east wall outside brick, the other outsides the building's colour",
  colAt(2.5, -0.075) === "#ff0000" && eastL && eastL.col === "mat:brick" && outFaces.some((pl) => pl.col === B.ext), { south: colAt(2.5, -0.075), east: eastL && eastL.col });
const W = P.addOp(B, "window", 1.2, { room: K.id, edge: 0, at: 2 }); W.glass = "#22aa55";
const glassPolys = P.build(B).polys.filter((pl) => pl.tag && pl.tag.ak === "op" && pl.tag.part === "glass");
check("a window's glass: its own colour, tagged part \"glass\" (the paint bucket / panel reach it)", glassPolys.length > 0 && glassPolys.every((pl) => pl.col === "#22aa55"), glassPolys.length);

// ---- the picture materials in the 3D helpers
F.setTex([{ id: "p1", name: "x", src: "/passets/images/x.png", size: 2, rot: 0, avg: "#884422" }]);
check("PPFurn: \"tex:<id>\" is a material; its swatch colour = the picture's average; its info", F.isMat("tex:p1") && F.isTex("tex:p1") && !F.isTex("mat:brick") && F.hex("tex:p1") === "#884422" && F.hex("tex:nope") === "#999999" && F.texInfo("p1").size === 2);
const fakeT = { RepeatWrapping: 1, SRGBColorSpace: "srgb", TextureLoader: function () { this.load = () => ({ repeat: { set(x, y) { this.x = x; this.y = y; } }, rotation: 0 }); } };
const tx = F.texOf(fakeT, "p1"); F.setTex([{ id: "p1", src: "/passets/images/x.png", size: 4, rot: 90, avg: "#884422" }]);
check("…its texture: repeats every Size metres, turned Turn° - a change of size reaches the same texture", tx && Math.abs(tx.repeat.x - 0.25) < 1e-9 && Math.abs(tx.rotation - Math.PI / 2) < 1e-9 && F.texOf(fakeT, "p1") === tx);

// ---- the picker's pure parts
check("newId: p1, p2 … the first free", M.newId({ tex: [{ id: "p1" }, { id: "p3" }] }) === "p2" && M.newId({}) === "p1");
const c1 = M.coverRepeat(2, 1), c2 = M.coverRepeat(1, 2);
check("coverRepeat: a backdrop fills the view, its shape kept (a wide picture in a squarer view: its sides cropped)", c1.rx === 0.5 && c1.ry === 1 && c1.ox === 0.25 && c2.ry === 0.5 && c2.oy === 0.25 && JSON.stringify(M.coverRepeat(0, 1)) === JSON.stringify({ rx: 1, ry: 1, ox: 0, oy: 0 }));
check("urlOf: a project image's name made safe for a URL", M.urlOf("/passets/images/brick 1#.png") === "/passets/images/" + encodeURIComponent("brick 1#.png"));
root.refs = undefined;

// ---- the wiring
const AT = read("ext/pushpulldock/pparchtools.js"), PD = read("ext/pushpulldock/ppdock.js"), DH = read("ext/pushpulldock/dock.html"), EJ = JSON.parse(read("ext/pushpulldock/ext.json")), AV = read("ext/pushpulldock/pparchview.js"), PV = read("ext/pushpulldock/ppview.js"), GE = read("ext/pushpulldock/ppgeo.js");
check("ppmatpick.js loaded (after ppplan.js, before the tools)", EJ.scripts.indexOf("ppmatpick.js") > EJ.scripts.indexOf("ppplan.js") && EJ.scripts.indexOf("ppmatpick.js") < EJ.scripts.indexOf("pparchtools.js"));
check("the panels: a wall's Inside + Outside, a window's Glass, floors / ceilings / trim / roofs / stairs / slabs - material buttons",
  /matIn\("Inside", P\(\)\.wallCol\(R, i\)/.test(AT) && /matIn\("Outside", P\(\)\.wallExt\(AR\(\), R, i\)/.test(AT) && /matIn\("Glass", op\.glass/.test(AT) && (AT.match(/matIn\(/g) || []).length >= 17 && /onPick: \(v, add\) => \{ if \(add\) AR\(\)\.tex = /.test(AT));
check("the paint bucket: ONE wall's side (Shift: all of that side), the glass", /if \(ev\.shiftKey \|\| !w\) \{ get = \(\) => A\.ext;/.test(AT) && /w\.R\.wext\[w\.i\] = c;/.test(AT) && /R\.wcol\[bi\] = c;/.test(AT) && /tg\.part === "glass" \? "glass"/.test(AT));
check("the views: the pictures registered before building (walls and faces), a loaded picture redraws, the background with the building; faces may wear one",
  /root\.PPFurn\.setTex\(V\.M\.arch\.tex\)/.test(AV) && /root\.PPFurn\.setTex\(M\.arch\.tex\)/.test(PV) && /PPFurn\.onTexLoad\(\(\) => S\.V && S\.V\.draw\(\)\)/.test(PD) && /S\.A\.onBg = \(\) => root\.PPMatPick\.applyBg/.test(PD) && /tex:\[a-z0-9_\]\{1,24\}\)\$\/\.test\(F\.mat\)/.test(GE));
check("the toolbar: 🖼 Background (a popup: none / backdrop / 360° sky, the picture, turn); the paint's Materials opens the picker", /id="ppBgBtn"/.test(DH) && /function bgPop\(anchor\)/.test(PD) && /root\.PPMatPick\.open\(mb, \{ A, value: S\.color/.test(PD));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
