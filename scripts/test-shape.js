/* bitGen Studio — 2.492.0: SHAPE LAYERS + OPERATORS (ext/timelinedock/tlshape.js) - After Effects gap item 4. The
 * geometry is pure: kinds, round corners, offset, pucker & bloat, twist, zig zag, wiggle, trim paths, the repeater. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, ".."), S = require(path.join(ROOT, "ext", "timelinedock", "tlshape.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);
const D = (o) => Object.assign({}, S.DEFAULTS, o);
const ext = (pts) => [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];

{
  const r = S.base(D({ kind: "rect", w: 200, h: 100 })), e = S.base(D({ kind: "ellipse", w: 200, h: 100 })), st = S.base(D({ kind: "star", w: 100, h: 100, points: 5, inner: 0.5 })), pg = S.base(D({ kind: "polygon", w: 100, h: 100, points: 6 }));
  check("kinds: a rectangle (4 corners), an ellipse (round, its size), a 5-point star (10 corners, inner at half), a hexagon", r.pts.length === 4 && ext(r.pts).join() === "-100,100,-50,50" && e.pts.length >= 24 && near(ext(e.pts)[1], 100, 1e-9) && st.pts.length === 10 && near(Math.hypot(...st.pts[1]), 25, 1e-9) && near(Math.hypot(...st.pts[0]), 50, 1e-9) && pg.pts.length === 6);
  const rc = S.roundCorners(r.pts, 20), mid = rc[4];
  check("round corners: each corner an arc - the corner point itself is gone", rc.length === 36 && !rc.some((p) => near(p[0], -100) && near(p[1], -50)) && near(Math.hypot(mid[0] + 100, mid[1] + 50), Math.hypot(5, 5), 0.01), mid);
  const off = S.offsetPts(r.pts, 10);
  check("offset paths: pushed out 10 px on every side (either winding)", ext(off).join() === "-110,110,-60,60" && ext(S.offsetPts(r.pts.slice().reverse(), 10)).join() === "-110,110,-60,60", ext(off));
  const d = S.densify(r.pts, 10);
  check("densify: points at most 10 px apart, middles marked (1 = middle of an edge, 0 = a corner)", d.pts.length === 60 && d.mid[0] === 0 && Math.max(...d.mid) === 1);
  const bl = S.pucker(d, 50), pk = S.pucker(d, -50), edgeMidB = bl[10], edgeMidP = pk[10];
  check("pucker & bloat: bloat pushes the middles of the edges out, pucker pulls them in", Math.abs(edgeMidB[1]) > 50 && Math.abs(edgeMidP[1]) < 50, [edgeMidB, edgeMidP]);
  const tw = S.twist(d.pts, 90), far = d.pts.reduce((m, p, i) => (Math.hypot(...p) > Math.hypot(...d.pts[m]) ? i : m), 0);
  check("twist: the farthest point turns the full 90°, the centre stays", near(Math.atan2(tw[far][1], tw[far][0]) - Math.atan2(d.pts[far][1], d.pts[far][0]), Math.PI / 2, 1e-6) || near(Math.atan2(tw[far][1], tw[far][0]) - Math.atan2(d.pts[far][1], d.pts[far][0]), -3 * Math.PI / 2, 1e-6));
  const zz = S.zigzag(r.pts, 8, 4, true), dev = Math.max(...zz.map((p) => Math.min(Math.abs(Math.abs(p[0]) - 100), Math.abs(Math.abs(p[1]) - 50))));
  check("zig zag: ridges of 8 px off the outline", dev > 7 && dev < 9, dev);
  const w0 = S.wiggle(r.pts, 6, 3, 2, 0), w1 = S.wiggle(r.pts, 6, 3, 2, 0.5), w0b = S.wiggle(r.pts, 6, 3, 2, 0);
  check("wiggle paths: moves with time, the same moment the same shape", JSON.stringify(w0) === JSON.stringify(w0b) && w0.some((p, i) => !near(p[0], w1[i][0], 1e-6)));
}
{
  const r = S.base(D({ kind: "rect", w: 200, h: 100 })).pts, P = S.perimeter(r, true);
  const t = S.trim(r, 0, 50, 0), L = S.perimeter(t.lines[0], false);
  check("trim paths: 0 - 50 % = half the outline, open", !t.closed && near(L, P / 2, 1) && P === 600, [L, P]);
  const t2 = S.trim(r, 0, 100, 0), t3 = S.trim(r, 30, 30, 0), t4 = S.trim(r, 0, 25, 50);
  check("trim paths: 0 - 100 % = the whole closed outline; equal start and end = nothing; offset moves the piece round", t2.closed && t3.lines.length === 0 && near(t4.lines[0][0][0], 100, 1e-6) && near(t4.lines[0][0][1], 50, 1e-6), t4.lines[0] && t4.lines[0][0]);
}
{
  const O = S.outlines(D({ kind: "rect", w: 50, h: 50, rep: true, rcopies: 4, rx: 60, ry: 0, rscale: 50, rrot: 90, rop0: 100, rop1: 25 }), 0);
  check("repeater: 4 copies - each 60 px on, half the size, turned 90° more; opacity from 100 to 25 %", O.copies.length === 4 && O.copies[3].x === 180 && near(O.copies[3].scale, 0.125) && O.copies[3].rot === 270 && near(O.copies[3].op, 0.25) && near(O.copies[0].op, 1));
  const B = S.bounds(O, 10);
  check("bounds: the picture holds every copy and the stroke", B >= 180 + 4 && B < 200, B);
  const plain = S.outlines(D({ kind: "rect", w: 50, h: 50 }), 0);
  check("no operators: one closed outline, one copy", plain.closed && plain.lines.length === 1 && plain.copies.length === 1 && plain.copies[0].op === 1);
  check("keyable numbers: trim, repeater, offsets, sizes (the 'sh_' keys)", ["tend", "rcopies", "rrot", "oamt", "pamt", "tangle", "zsize", "wsize", "rrad", "w", "h"].every((k) => S.NUMS.includes(k)));
}
{
  const cv = read("ext/timelinedock/canvas.js"), tlx = read("ext/timelinedock/timelinedock.js"), tp = read("ext/timelinedock/tlparent.js"), w = read("misc/worker.py"), extl = JSON.parse(read("ext/timelinedock/ext.json")).scripts, g = read("ext/timelinedock/tlgraph.js"), src = read("ext/timelinedock/tlshape.js");
  check("the wiring: the canvas draws a shape's picture (its own size); a shape is baked before the compile (TlParent's bake); an unbaked shape never reaches the compile", /c\.shape && window\.TlShape/.test(cv) && /x\.c\.parent \|\| x\.c\.shape/.test(tp) && /bake: \(c\.parent \|\| c\.shape/.test(tlx) && /&& c\.bake \? c\.bake : undefined/.test(tlx) && /!\(c\.shape && !c\.bake\)/.test(tlx));
  check("the compile checks a baked clip's file (not its picture's); the Graph Editor takes the shape's keys", /require\("image", c\["baked"\] if c\.get\("baked"\) else c\["path"\]\)/.test(w) && /addProp: addProp/.test(g) && extl.indexOf("tlshape.js") > extl.indexOf("tlparent.js"));
  check("no product names", !/After Effects|Adobe/.test(src.replace(/^\s*\*.*$/gm, "")));
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
