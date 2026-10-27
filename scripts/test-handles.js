#!/usr/bin/env node
/* bitGen Studio — 2.452.0 units: the Move tool's HANDLES (ext/imageeditdock/pchandles.js) - where they sit, hitting
 * them, the matrices for scale (corner / side / Shift / Alt), rotate (Shift 15°) and skew; turned type (pcdoc t.rot),
 * pcdockers turning type / smart objects; the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const H = require(path.join(ROOT, "ext", "imageeditdock", "pchandles.js"));
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]].map((v) => Math.round(v * 1000) / 1000);
const b = { x: 100, y: 100, w: 100, h: 50 };
const P = H.handlePoints(b);
check("handlePoints: the 8 handles (corners, side middles)", JSON.stringify(P.nw) === "[100,100]" && JSON.stringify(P.e) === "[200,125]" && JSON.stringify(P.s) === "[150,150]" && H.HANDLES.length === 8);
check("hitHandle: within r of a handle (corners first), else null", H.hitHandle(b, 203, 148, 6) === "se" && H.hitHandle(b, 150, 103, 6) === "n" && H.hitHandle(b, 150, 125, 6) === null);
const m1 = H.matrixFor("scale", "se", b, [200, 150], [250, 200], {});
check("scale, corner: from the opposite corner (top-left stays, 150 x 100)", JSON.stringify(ap(m1, 100, 100)) === "[100,100]" && JSON.stringify(ap(m1, 200, 150)) === "[250,200]");
const m2 = H.matrixFor("scale", "se", b, [200, 150], [300, 160], { shift: true }), m3 = H.matrixFor("scale", "e", b, [200, 125], [250, 140], {}), m4 = H.matrixFor("scale", "se", b, [200, 150], [250, 175], { alt: true });
check("scale: Shift keeps the proportions (x2 both ways); a side handle one way only; Alt from the centre",
  JSON.stringify(ap(m2, 200, 150)) === "[300,200]" && JSON.stringify(ap(m3, 200, 150)) === "[250,150]" && JSON.stringify(ap(m3, 100, 100)) === "[100,100]" && JSON.stringify(ap(m4, 150, 125)) === "[150,125]" && JSON.stringify(ap(m4, 200, 150)) === "[250,175]");
const r1 = H.matrixFor("rotate", "ne", b, [200, 100], [210, 140], { shift: true });
const ang = Math.atan2(r1[1], r1[0]) * 180 / Math.PI;
check("rotate: a corner turns round the centre (the centre stays), Shift = 15° steps", JSON.stringify(ap(r1, 150, 125)) === "[150,125]" && Math.abs(ang / 15 - Math.round(ang / 15)) < 1e-9 && ang > 0, ang);
const k1 = H.matrixFor("rotate", "n", b, [150, 100], [170, 100], {}), k2 = H.matrixFor("rotate", "e", b, [200, 125], [200, 145], {});
// 2.604.0 (Tim: "fix the skew tool"): the OPPOSITE side stays put now (it ran the other way round the centre)
check("skew: the top side slides the top sideways (the bottom stays put); the right side slides it up / down (the left stays)",
  JSON.stringify(ap(k1, 150, 100)) === "[170,100]" && JSON.stringify(ap(k1, 150, 150)) === "[150,150]" && JSON.stringify(ap(k2, 200, 125)) === "[200,145]" && JSON.stringify(ap(k2, 100, 125)) === "[100,125]");
check("turnAbout / scaleAbout / isIdentity", JSON.stringify(ap(H.turnAbout(90, 0, 0), 1, 0)) === "[0,1]" && JSON.stringify(ap(H.scaleAbout(2, 3, 10, 10), 11, 11)) === "[12,13]" && H.isIdentity([1, 0, 0, 1, 0, 0]) && !H.isIdentity([1, 0, 0, 1, 1, 0]));
const DOC = read("ext", "imageeditdock", "pcdoc.js"), DK = read("ext", "imageeditdock", "pcdockers.js"), IE = read("ext", "imageeditdock", "imageedit.js"), ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("type turns (2.604.0: and skews - textMat = t.rot + t.xm): pcdoc draws a text with t.rot turned round its centre, textBox = the turned box (textBox0 the straight one); pcdockers turns type (t.rot) and moves a smart object's quad (PCSmart.mapT)",
  /const M = textMat\(L\.text\);/.test(DOC) && /function textBox0\(t, g\)/.test(DOC) && /textBox, textBox0, textMat, drawText/.test(DOC) && /if \(Math\.abs\(a\) < 1e-6\) delete t\.rot; else t\.rot = a;/.test(DK) && /root\.PCSmart\.mapT\(L\.smart\.t, m\)/.test(DK));
check("wiring: pchandles.js after pccafill.js (2.457.0 - 2.464.0: pcdimgroup / pcdimauto / pc3d / pcsketch / pcsketchtools / pcsketchcad / pcsketchcadui between them), installed after PCCaFill", ext.indexOf("pchandles.js") === ext.indexOf("pccafill.js") + 8 && ext.indexOf("pcdimgroup.js") === ext.indexOf("pccafill.js") + 1 && IE.indexOf("PCHandles.install(E)") > IE.indexOf("PCCaFill.install(E)"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
