#!/usr/bin/env node
/* bitGen Studio — 2.810.0: the Shape tool's modes, ✂ Trim, ⇋ Mirror and ⧈ Offset (ext/imageeditdock/pcshapeops.js) -
 * the pure maths in Node + pins on where it is hooked in.
 * Tim (verbatim): "in image editor, click on shape will draw new shapes, shift+click on shape will change shape to new
 * shape clicked, ctrl+ click will add shape to existing shape (boolean) , alt + click will subtract new selected shape
 * from shape on selected layer ... add a trim button so shapes can be trimmed like in fusion 360. Add mirror and offset
 * buttons for selected shapes" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const P = require("../ext/imageeditdock/pcpath.js"), O = require("../ext/imageeditdock/pcshapeops.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1 : t);
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

check("modeOf: click new, Shift replace, Ctrl add, Alt subtract, Ctrl+Alt intersect, ⌘ = Ctrl",
  [O.modeOf({}), O.modeOf({ shiftKey: true }), O.modeOf({ ctrlKey: true }), O.modeOf({ altKey: true }), O.modeOf({ ctrlKey: true, altKey: true }), O.modeOf({ metaKey: true })].join() === "new,replace,add,subtract,intersect,add");

// trim: two overlapping circles in one shape
const c1 = P.ellipseSub(100, 100, 50, 50), c2 = P.ellipseSub(160, 100, 50, 50), two = { subs: [c1, c2] };
const k1 = O.cutsOf(two, 0, []);
check("cutsOf: a circle crossed twice by the other", k1.length === 2, k1);
let r = O.trimAt(two, [], 150, 100, 3);
check("trimAt the inside arc of circle 1: circle 2 stays closed, circle 1 left as an open arc (a line - nofill)", r && r.subs.length === 2 && r.subs.filter((s) => s.closed).length === 1 && r.subs.some((s) => !s.closed && s.nofill), r && r.subs.map((s) => [s.closed, s.nofill]));
r = O.trimAt({ subs: r.subs }, [], 110, 100, 3);
const bb = r && P.bbox({ subs: r.subs });
check("…then circle 2's inside arc: the two arcs join into ONE closed outline round both (filled again)", r && r.subs.length === 1 && r.subs[0].closed && !r.subs[0].nofill && near(bb.x, 50) && near(bb.w, 160), r && { n: r.subs.length, bb });
// trim a rectangle with a line on another layer
const rect = P.fromShape({ kind: "rect", x: 0, y: 0, w: 100, h: 50 });
const line = { subs: [{ closed: false, op: "add", pts: [P.anchor(50, -10), P.anchor(50, 60)] }] };
r = O.trimAt(rect, [line], 100, 25, 3);
const rb = r && P.bbox({ subs: r.subs });
check("a rectangle cut by a line (another layer): the right half of its outline goes, the left half is an open line", r && r.subs.length === 1 && !r.subs[0].closed && near(rb.x, 0) && near(rb.w, 50), r && { rb, n: r.subs.length });
r = O.trimAt(line, [rect], 50, 25, 3);
check("a line trimmed where it crosses the rectangle: two pieces left, outside it", r && r.subs.length === 2 && r.subs.every((s) => { const b = P.bbox({ subs: [s] }); return b.y + b.h <= 0.5 || b.y >= 49.5; }), r && r.subs.map((s) => P.bbox({ subs: [s] })));
check("nothing crossing a closed outline: the whole outline is trimmed", (() => { const t = O.trimPlan({ subs: [c1] }, [], 150, 100, 3); return t && t.whole; })());
check("nothing under the point: null", O.trimAt(two, [], 300, 300, 3) === null);
const sl = O.sliceSub(c1, 3.5, 0.5);
check("sliceSub wraps a closed sub (3.5 -> 0.5 = across its start)", sl && !sl.closed && near(sl.pts[0].x, P.cubicAt(P.segs(c1)[3], 0.5)[0], 0.01) && near(sl.pts[sl.pts.length - 1].x, P.cubicAt(P.segs(c1)[0], 0.5)[0], 0.01), sl && sl.pts.length);
const j = O.joinOpen([{ closed: false, op: "add", pts: [P.anchor(0, 0), P.anchor(10, 0)] }, { closed: false, op: "add", pts: [P.anchor(0, 10), P.anchor(10, 10)] }, { closed: false, op: "add", pts: [P.anchor(10, 0), P.anchor(10, 10)] }, { closed: false, op: "add", pts: [P.anchor(0, 0), P.anchor(0, 10)] }]);
check("joinOpen: four lines meeting end to end (any direction) = one closed square", j.length === 1 && j[0].closed && j[0].pts.length === 4 && !j[0].nofill, j);
check("pcpath: normalize keeps nofill on open subs; fillArea leaves them out", P.normalize({ subs: [{ closed: false, nofill: true, pts: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }] }).subs[0].nofill === true && /filter\(\(s\) => s\.pts\.length > 1 && !s\.nofill\)/.test(src("ext/imageeditdock/pcpath.js")));

// mirror
const tri = { subs: [{ closed: true, op: "add", pts: [P.anchor(0, 0), P.anchor(10, 0), P.anchor(0, 10)] }] };
const f = O.mirrorPath(tri, "h", 5), fa = P.signedArea(f.subs[0].pts.map((a) => [a.x, a.y])), ta = P.signedArea(tri.subs[0].pts.map((a) => [a.x, a.y]));
check("mirrorPath h about x = 5: the corner at x 10, wound the same way", f.subs[0].pts.some((a) => a.x === 10 && a.y === 10) && Math.sign(fa) === Math.sign(ta), f.subs[0].pts);
const mc = O.mirrorCopy(tri, "right", { x: 0, y: 0, w: 10, h: 10 }), mb = P.bbox(mc);
check("mirrorCopy right: the copy joined in, mirrored about the box's right side (twice as wide)", mc.subs.length === 2 && mb.w === 20 && mb.h === 10, mb);
const md = P.bbox(O.mirrorCopy(tri, "down", { x: 0, y: 0, w: 10, h: 10 }));
check("mirrorCopy down: twice as tall", md.w === 10 && md.h === 20, md);

// offset
let o = O.offsetPath(rect, 10), ob = P.bbox(o);
check("offsetPath +10: a rectangle 10 px bigger all round", o && near(ob.x, -10, 0.6) && near(ob.w, 120, 1) && near(ob.h, 70, 1), ob);
o = O.offsetPath(rect, -10); ob = P.bbox(o);
check("offsetPath −10: 10 px smaller all round", o && near(ob.x, 10, 0.6) && near(ob.w, 80, 1) && near(ob.h, 30, 1), ob);
check("offsetPath −30 on a 50 px tall rectangle: nothing left (null)", O.offsetPath(rect, -30) === null);
const ring = { subs: [P.ellipseSub(0, 0, 50, 50), P.reverseSub(P.ellipseSub(0, 0, 30, 30))] };
o = O.offsetPath(ring, 5);
const areas = o ? o.subs.map((s) => P.signedArea(P.flatten(s, 0.5))) : [];
check("offsetPath of a ring (+5): outer 55, its hole shrinks to 25 - two subs wound opposite ways, all \"add\"", o && o.subs.length === 2 && o.subs.every((s) => s.op === "add") && Math.sign(areas[0]) !== Math.sign(areas[1]) && near(P.bbox(o).w, 110, 1.2), { n: o && o.subs.length, areas, bb: o && P.bbox(o) });
const ops = { subs: [P.ellipseSub(0, 0, 50, 50), Object.assign(P.ellipseSub(0, 0, 20, 20), { op: "subtract" })] };
o = O.offsetPath(ops, -5);
check("offsetPath of a shape with a subtract op (−5): the ops are honoured (a hole that grows)", o && o.subs.length === 2 && near(P.bbox(o).w, 90, 1.2), o && { n: o.subs.length, bb: P.bbox(o) });
o = O.offsetPath(line, 4); ob = P.bbox(o);
check("offsetPath +4 of a line: the band round it", o && near(ob.w, 8, 1) && near(ob.h, 78, 1), ob);
const D = O.edt(Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]), 3, 3);
check("edt: squared distances to the seed", D[4] === 0 && D[1] === 1 && D[0] === 2, Array.from(D));

// hooks
const FR = src("ext/imageeditdock/pcframes.js"), IE = src("ext/imageeditdock/imageedit.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json")), SO = src("ext/imageeditdock/pcshapeops.js");
check("pcframes: E.shapeMenu() first in the canvas menu", /const sm = E\.shapeMenu \? E\.shapeMenu\(\) : \[\]; if \(sm\.length\) items\.push\(\.\.\.sm, sep\);/.test(FR) && FR.indexOf("E.shapeMenu") < FR.indexOf('"layer.rasterizetext"'));
check("E.shapeMenu only with the Shape / Trim tool", /E\.shapeMenu = \(\) => \(S\.tool === "shape" \|\| S\.tool === "shapetrim"/.test(SO));
check("loaded after pcfocus.js and installed after PCFocus", EX.scripts.indexOf("pcshapeops.js") === EX.scripts.indexOf("pcfocus.js") + 1 && IE.indexOf("PCShapeOps.install(E)") > IE.indexOf("PCFocus.install(E)"));
check("the shape buttons take the mode (pickKind on click, modifiers read)", /b\.onclick = \(ev\) => pickKind\(b\.dataset\.sk, ev\);/.test(SO));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
