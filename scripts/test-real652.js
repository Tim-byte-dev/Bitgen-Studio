#!/usr/bin/env node
/* bitGen Studio — 2.652.0: THE SKETCHER'S ✨ REAL PHOTO WITH ITS MATERIALS - the model's picture materials and its backdrop go
 * to the edit model as ONE labelled material board (picture 3: the edit models take 3 - the render, its depth, the board)
 * (ext/pushpulldock/ppreal.js) + the ✨ Photo button; the depth map never shows the backdrop (ppview.js shot) - pure + the
 * wiring. The real run: scripts/test-ui652-ui.js. Tim (verbatim): "use reference images for the texture, background etc.
 * and use our ai editor to create the scene?" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const R = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));
const A = { ext: "tex:p2", tex: [{ id: "p1", name: "Oak", src: "/passets/images/oak.jpg" }, { id: "p2", name: "Brick", src: "/passets/images/brick.jpg" }, { id: "p3", name: "Unused", src: "/passets/images/u.jpg" }],
  rooms: [{ name: "Kitchen", pts: [[0, 0], [4, 0], [4, 3], [0, 3]], wall: "#ffffff", wcol: { 1: "tex:p2" }, wext: {}, floor: "tex:p1", ceilCol: "#ffffff", closed: true },
          { name: "Bed", pts: [[4, 0], [8, 0], [8, 3], [4, 3]], wall: "#ffffff", wcol: {}, wext: { 0: "tex:p1" }, floor: "tex:p1", ceilCol: "#fff", floorOn: false, closed: true }],
  ops: [{ kind: "window", col: "#fff", glass: "tex:nope" }], roofs: [], stairs: [], slabs: [], bg: { kind: "sky", src: "/passets/images/pano.jpg", name: "Pano" } };
const u = R.usedPictures(A, [{ mat: "tex:p1" }, { mat: "#fff" }]);
const oak = u.tiles.find((t) => t.id === "p1"), brick = u.tiles.find((t) => t.id === "p2");
check("usedPictures: only the pictures in use, once each (an unused one / a missing id left out)", u.tiles.length === 2 && !u.tiles.some((t) => t.id === "p3"), u.tiles.map((t) => t.id));
check("…where each goes: Oak = Kitchen floor, Bed wall 1 outside, drawn shapes (Bed has no floor); Brick = the outside walls, Kitchen wall 2 inside",
  JSON.stringify(oak.where) === JSON.stringify(["Kitchen floor", "Bed wall 1 outside", "drawn shapes"]) && JSON.stringify(brick.where) === JSON.stringify(["outside walls", "Kitchen wall 2 inside"]), { oak: oak.where, brick: brick.where });
check("…the background (a 360° sky) rides along", u.bg && u.bg.kind === "sky" && u.bg.src === "/passets/images/pano.jpg");
check("boardCaptions: a tile each + the background last", JSON.stringify(R.boardCaptions(u)) === JSON.stringify(["outside walls, Kitchen wall 2 inside", "Kitchen floor, Bed wall 1 outside, drawn shapes", "Background (360° sky)"]), R.boardCaptions(u));
check("nothing used: no tiles, no board", R.usedPictures({ rooms: [], tex: [] }).tiles.length === 0 && R.usedPictures(null).bg === null);
const p0 = R.promptFor("at sunset"), p1 = R.promptFor("at sunset", u), p2 = R.promptFor("", { tiles: [1], bg: null });
check("promptFor: the board line names {img3} (the server puts the model's word) and says what it is for; the background line only with one; the user's words last",
  !/\{img3\}/.test(p0) && /\{img3\} is a material board/.test(p1) && /tile marked Background/.test(p1) && !/Background/.test(p2) && /\nat sunset$/.test(p1) && p1.startsWith(R.LEAD), p1);

const PR = read("ext/pushpulldock/ppreal.js"), PV = read("ext/pushpulldock/ppview.js"), PM = read("ext/pushpulldock/ppmatpick.js"), PD = read("ext/pushpulldock/ppdock.js"), DH = read("ext/pushpulldock/dock.html");
check("the run: the board as ref1 (picture 3) with ref_raw; a model that takes two pictures -> sent again without it, said so",
  /if \(withBoard\) fd\.append\("ref1", bblob, "sketcher_materials\.png"\);/.test(PR) && /promptFor\(text, withBoard \? used : null(, scene)?\)/.test(PR) && /\(\{ r, j \} = await send\(false\)\);/.test(PR) && /queued without the materials board/.test(PR));
check("the board picture: up to 6 tiles, 3 a row, cover-fitted, a caption under each", /\.slice\(0, 6\);/.test(PR) && /const cols = Math\.min\(3, items\.length\)/.test(PR) && /g\.fillText\(t, x \+ 2, y \+ T \+ 10\)/.test(PR));
check("the shot: the backdrop in the photo (fitted to the shot's shape), never in the depth / normal map", /if \(o\.depth \|\| o\.normal\) scene\.background = null; else if \(bg0 && V\.bgFit\) V\.bgFit\(w \/ h\);/.test(PV) && /scene\.background = bg0;/.test(PV) && /V\.bgFit = \(asp\) =>/.test(PM));
check("✨ Photo in the Sketcher's toolbar runs it (the prompt box's words added)", /id="ppReal"/.test(DH) && /root\.H3SketcherReal\.run\(t\)/.test(PD));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
