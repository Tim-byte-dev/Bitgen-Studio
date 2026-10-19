#!/usr/bin/env node
/* bitGen Studio — 2.439.0 units: the image editor's PROPERTY BAR (ext/imageeditdock/pcpropbar.js) - sizes, corners,
 * outline widths, draw modes joining a shape into the picked one - and per-corner radii in pcdoc.js / pcpath.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PB = require(path.join(ROOT, "ext", "imageeditdock", "pcpropbar.js"));
const Q = require(path.join(ROOT, "ext", "imageeditdock", "pcpath.js"));

const b = { x: 10, y: 20, w: 100, h: 50 };
check("sizeMatrix: W with 🔒 scales both ways; H alone with 🔓 only the height; nothing = 1", JSON.stringify(PB.sizeMatrix(b, 200, null, true)) === '{"sx":2,"sy":2}' && JSON.stringify(PB.sizeMatrix(b, null, 25, false)) === '{"sx":1,"sy":0.5}'
  && JSON.stringify(PB.sizeMatrix(b, null, 100, true)) === '{"sx":2,"sy":2}' && JSON.stringify(PB.sizeMatrix(b, null, null, false)) === '{"sx":1,"sy":1}');
check("cornersOf: a CorelDRAW live rectangle's corners, a Shape-tool rectangle's radii (or its one radius × 4), none for anything else",
  JSON.stringify(PB.cornersOf({ shape: { kind: "path", gen: { type: "rect", corners: [1, 2, 3, 4] } } })) === "[1,2,3,4]" && JSON.stringify(PB.cornersOf({ shape: { kind: "rect", radii: [5, 0, 5, 0] } })) === "[5,0,5,0]"
  && JSON.stringify(PB.cornersOf({ shape: { kind: "rect", radius: 7 } })) === "[7,7,7,7]" && PB.cornersOf({ shape: { kind: "ellipse" } }) === null && PB.cornersOf({ type: "pixel" }) === null);
check("setCorners: one corner, or 🔗 all four; never below 0", JSON.stringify(PB.setCorners([1, 2, 3, 4], 2, 9, false)) === "[1,2,9,4]" && JSON.stringify(PB.setCorners([1, 2, 3, 4], 0, 6, true)) === "[6,6,6,6]" && JSON.stringify(PB.setCorners([1, 2, 3, 4], 1, -5, false)) === "[1,0,3,4]");
check("WIDTHS: none, hairline … 24 px; MODES: New / Add / Subtract / Intersect / Exclude", PB.WIDTHS[0][1] === "none" && PB.WIDTHS[1][1] === "hairline" && PB.WIDTHS.length >= 12 && PB.MODES.map((m) => m[0]).join() === "new,add,subtract,intersect,exclude");
const base = { subs: [{ closed: true, op: "add", pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }] };
const joined = PB.combinePath(base, { subs: [{ closed: true, pts: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }] }, { closed: false, pts: [{ x: 1, y: 1 }] }] }, "subtract");
check("combinePath: the picked shape's parts untouched (copied), the new one added as a part with the operation (a 1-point scrap dropped)", joined.subs.length === 2 && joined.subs[0].op === "add" && joined.subs[1].op === "subtract" && joined.subs[1].closed && JSON.stringify(base.subs[0].pts) === JSON.stringify(joined.subs[0].pts) && joined.subs[0] !== base.subs[0]);
check("...an unknown operation = add", PB.combinePath(base, { subs: [{ pts: [{ x: 1 }, { x: 2 }] }] }, "weird").subs[1].op === "add");
const pr = Q.fromShape({ kind: "rect", x: 0, y: 0, w: 100, h: 50, radii: [10, 0, 20, 5] });
check("pcpath fromShape: a rectangle with its own radius per corner - 7 anchors (the square corner one), the right points", pr.subs[0].pts.length === 7 && JSON.stringify(pr.subs[0].pts.map((a) => [a.x, a.y])) === "[[0,10],[10,0],[100,0],[100,30],[80,50],[5,50],[0,45]]");
check("...handles toward the corner (top left: out of (0,10) up toward (0,0))", Math.abs(pr.subs[0].pts[0].oy - (10 - 10 * 0.5522847498)) < 1e-6 && pr.subs[0].pts[0].ox === 0);
check("...one radius for all = as before (8 anchors)", Q.fromShape({ kind: "rect", x: 0, y: 0, w: 100, h: 50, radius: 8 }).subs[0].pts.length === 8);
const DOC = read("ext", "imageeditdock", "pcdoc.js"), DR = read("ext", "imageeditdock", "pcdraw.js"), IE = read("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("pcdoc draws radii per corner (roundRect with a list); pcdraw's newShape asks E.drawCombine first", /g\.roundRect\(x, y, w, h, s\.radii\.map/.test(DOC) && /if \(E\.drawCombine\) \{ const c = E\.drawCombine\(path, name\); if \(c\) return c; \}/.test(DR));
check("pcpropbar after pcpanels, installed after the dockers", EXT.indexOf("pcpropbar.js") === EXT.indexOf("pcpanels.js") + 1 && IE.indexOf("PCPropBar.install(E)") > IE.indexOf("PCDockers.install(E)"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
