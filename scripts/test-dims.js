#!/usr/bin/env node
/* bitGen Studio — 2.441.0 units: CAD DIMENSIONS (ext/imageeditdock/pcdims.js) - the scale, the definition of a
 * dimension (read back from older ones), the end locks, the nearest point on an outline, the handles; the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const P = require(path.join(ROOT, "ext", "imageeditdock", "pcdims.js"));
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcdocs.js"));

check("SCALE_UNITS: mm cm m km in ft yd mi px", P.SCALE_UNITS.join() === "mm,cm,m,km,in,ft,yd,mi,px");
const sc = P.scaleFrom(200, 5, "m");
check("scaleFrom: a 200 px dimension that is 5 m -> 0.025 m a px; nothing for 0 / a bad unit -> mm", sc.k === 0.025 && sc.unit === "m" && sc.dec === 2 && P.scaleFrom(200, 0, "m") === null && P.scaleFrom(0, 5, "m") === null && P.scaleFrom(10, 1, "parsec").unit === "mm");
check("fmtScaled: the length in the scale, its decimals", P.fmtScaled(280, sc) === "7.00 m" && P.fmtScaled(80, { k: 3.125, unit: "cm", dec: 1 }) === "250.0 cm");
check("lockEnd (2.457.0): Shift = level with the other end (horizontal), Ctrl = straight above / below it (vertical), neither = free", JSON.stringify(P.lockEnd(10, 20, [0, 5], false, true)) === "[10,5]" && JSON.stringify(P.lockEnd(10, 20, [0, 5], true, false)) === "[0,20]" && JSON.stringify(P.lockEnd(10, 20, [0, 5], false, false)) === "[10,20]");
const line = { subs: [{ closed: false, pts: [{ x: 0, y: 0, ix: 0, iy: 0, ox: 0, oy: 0 }, { x: 100, y: 0, ix: 100, iy: 0, ox: 100, oy: 0 }] }] };
const curve = { subs: [{ closed: false, pts: [{ x: 0, y: 0, ix: 0, iy: 0, ox: 0, oy: -55.23 }, { x: 100, y: -100, ix: 44.77, iy: -100, ox: 100, oy: -100 }] }] };
const n1 = P.nearestOnPath(line, 50, 7), n2 = P.nearestOnPath(curve, 30, -70);
check("nearestOnPath: on a line (straight below), on a curve (a point of the quarter circle, within 0.5 px of radius 100 about (100, 0))", n1.x === 50 && n1.y === 0 && n1.d === 7 && Math.abs(Math.hypot(n2.x - 100, n2.y) - 100) < 0.5, { n1, n2 });
const legacy = { shape: { line: { labels: [{}] }, path: { subs: [{ plain: true, pts: [{ x: 10, y: 50 }, { x: 10, y: 20 }] }, { plain: true, pts: [{ x: 110, y: 50 }, { x: 110, y: 20 }] }, { pts: [{ x: 10, y: 26 }, { x: 110, y: 26 }] }] } } };
check("defOf: an older dimension read back from its lines (the two measured points + where its line sits)", JSON.stringify(P.defOf(legacy)) === '{"kind":"parallel","pts":[[10,50],[110,50],[60,26]]}');
check("...a dimension that keeps its definition: that one; not a dimension: none", P.defOf({ shape: { line: { labels: [{}] }, dim: { kind: "angular", pts: [[0, 0]] } } }).kind === "angular" && P.defOf({ shape: { line: {} } }) === null && P.defOf({ type: "pixel" }) === null);
check("handlesOf: the two ends + the line's place (an angle: 4)", P.handlesOf({ kind: "parallel", pts: [[1, 2], [3, 4], [5, 6]] }).length === 3 && P.handlesOf({ kind: "angular", pts: [[0, 0], [1, 0], [0, 1], [2, 2]] }).length === 4);
check("the document keeps its scale (DOC_KEYS dimScale) - and its .bgi", K.DOC_KEYS.includes("dimScale") && /dimScale: clone\(S\.dimScale \|\| null\)/.test(read("ext", "imageeditdock", "pcbgi.js")));
const DR = read("ext", "imageeditdock", "pcdraw.js"), IE = read("ext", "imageeditdock", "imageedit.js"), PB = read("ext", "imageeditdock", "pcpropbar.js");
check("pcdraw hands a new dimension's points to E.dimNew in its own undo step; pcdims installed after pcguides; the property bar's extras", /dimLayer\(r, name, undefined, id !== "ccallout" && E\.dimNew \? \(L\) => E\.dimNew\(L, id, pts\) : null\)/.test(DR) && /if \(after\) after\(L\);/.test(DR)
  && IE.indexOf("PCDims.install(E)") > IE.indexOf("PCGuides.install(E)") && /for \(const f of extras\)/.test(PB));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
