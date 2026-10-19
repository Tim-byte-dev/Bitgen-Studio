#!/usr/bin/env node
/* bitGen Studio — 2.425.0 units: VECTOR LINES THE CORELDRAW WAY (pcbezier.js) + the wiring of pcvline.js
 *   1. the outline pen: dash patterns (per width, caps), arrowheads (outline, what they hide), trimming a line end
 *   2. Corel's nodes: cusp / smooth / symmetrical, moving handles by type, To Line / To Curve, Break, Join, Extend to
 *      close / Auto-close, Extract, Reverse, Reduce, bending a segment
 *   3. the tools' curves: B-spline, 3-point curve, the Curvature Pen's curve through its points, Ctrl's 15°
 *   4. Path Selection's align / distribute
 *   5. SVG out and back (data-bitgen-vline), pcpath keeps symmetrical nodes and hands vector lines to pcbezier
 *   6. the wiring: ext.json, the install, F5 / F10 / F12 / Ctrl+Q, the menus, the Paths panel's 〰, PSD (XMP), the Pen's
 *      Rubber Band, E.pen's new exports
 * Tim: "continue with the photoshop gap closure, add a bezier line tool that can be a vector and converted to a path and
 * back to a vector. make the bezier line tool the same as coreldraw" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const Q = require(path.join(ROOT, "ext", "imageeditdock", "pcpath.js"));
const B = require(path.join(ROOT, "ext", "imageeditdock", "pcbezier.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const A = Q.anchor;
const line = (pts, closed) => ({ subs: [{ closed: !!closed, op: "add", pts: pts.map(([x, y]) => A(x, y)) }] });

/* ---- 1 */
check("dashOf: none for solid; dashes scale with the width; round caps take the cap out of the dash and give it to the gap",
  B.dashOf({ style: "solid" }, 4).length === 0 && JSON.stringify(B.dashOf({ style: "dash", cap: "butt" }, 3)) === "[12,6]" && JSON.stringify(B.dashOf({ style: "dash", cap: "round" }, 2)) === "[6,6]");
check("...dotted = dots (zero-length dashes with round caps, short ones with butt caps); custom lists, odd ones repeated",
  JSON.stringify(B.dashOf({ style: "dot", cap: "round" }, 2)) === "[0,4]" && JSON.stringify(B.dashOf({ style: "dot", cap: "butt" }, 2)) === "[2,3]"
  && B.dashOf({ style: "custom", dash: "5 1 2", cap: "butt" }, 1).length === 6 && B.dashOf({ style: "custom", dash: "x", cap: "butt" }, 1).length === 0);
const h = B.arrowHead("arrow", 100, 50, 0, 2, 4);
check("arrowHead: an arrow's tip ON the line end, its back behind it, symmetric; it hides 60 % of its length",
  near(h.polys[0][0][0], 100) && near(h.polys[0][0][1], 50) && h.polys[0][1][0] < 100 && near(h.polys[0][1][1] - 50, -(h.polys[0][3][1] - 50), 1e-3) && near(h.trim, 8 * 0.6), h);
const hv = B.arrowHead("triangle", 0, 0, Math.PI / 2, 1, 4);
check("...turned with the line (pointing down: the head is above the tip), at least width + 6 px long", hv.polys[0].every(([, y]) => y <= 1e-9) && Math.min(...hv.polys[0].map(([, y]) => y)) <= -7 + 1e-6, hv);
check("...every kind: open (stroked), circle / square / diamond / bar / half (filled), none = nothing",
  B.arrowHead("open", 0, 0, 0, 2, 4).lines.length === 1 && ["circle", "square", "diamond", "bar", "half"].every((k) => B.arrowHead(k, 0, 0, 0, 2, 4).polys.length === 1) && B.arrowHead("none", 0, 0, 0, 2).trim === 0 && B.ARROWS.length === 9);
const L0 = line([[0, 0], [100, 0]]).subs[0], tr = B.trimSub(L0, 10, 20);
check("trimSub: 10 px off the start, 20 off the end, along the line", near(tr.pts[0].x, 10, 0.2) && near(tr.pts[1].x, 80, 0.2) && near(B.subLength(L0), 100, 1e-6), tr.pts);
const curve = { closed: false, op: "add", pts: [A(0, 0, 0, 0, 0, -50), A(100, 0, 100, -50, 100, 0)] }, L1 = B.subLength(curve), tc = B.trimSub(curve, 0, 15);
check("...on a curve too: the cut-off length is right (the rest is the length minus 15)", near(B.subLength(tc), L1 - 15, 0.5), [L1, B.subLength(tc)]);
const ep = B.endPose(curve, "end"), sp = B.endPose(curve, "start");
check("endPose: the end points along its last handle (down here), the start along its first (also down - out of the line)", near(ep.ang, Math.PI / 2, 1e-6) && near(sp.ang, Math.PI / 2, 1e-6) && ep.x === 100, [ep, sp]);
const P = B.parts({ path: { subs: [curve, line([[0, 0], [10, 0], [10, 10]], true).subs[0]] }, strokeW: 2, strokeOn: true, line: { start: "circle", end: "arrow" } });
check("parts: closed parts filled + stroked, open ones trimmed under their two heads", P.fill.subs.length === 1 && P.open.length === 1 && P.heads.length === 2 && B.subLength(P.open[0]) < L1 - 8, [P.heads.length, B.subLength(P.open[0])]);

/* ---- 2 */
const Z = { subs: [{ closed: false, op: "add", pts: [A(0, 0), A(50, 0, 40, -10, 70, 20, true), A(100, 50)] }] };
const sy = B.nodeType(Z, 0, 1, "symmetrical").subs[0].pts[1], li = Math.hypot(sy.ix - 50, sy.iy), lo = Math.hypot(sy.ox - 50, sy.oy);
check("nodeType symmetrical: handles in line and the same length; smooth keeps their lengths; cusp just frees them",
  sy.sym && sy.smooth && near(li, lo, 1e-6) && near((sy.ix - 50) / li + (sy.ox - 50) / lo, 0, 1e-6) && B.nodeTypeOf(sy) === "symmetrical"
  && B.nodeTypeOf(B.nodeType(Z, 0, 1, "cusp").subs[0].pts[1]) === "cusp" && B.nodeTypeOf(B.nodeType(Z, 0, 0, "smooth").subs[0].pts[0]) === "smooth", sy);
const ZY = B.nodeType(Z, 0, 1, "symmetrical"), mv = B.moveHandle(ZY, 0, 1, "out", 80, 0).subs[0].pts[1];
const ZS = B.nodeType(Z, 0, 1, "smooth"), mvs = B.moveHandle(ZS, 0, 1, "out", 80, 0).subs[0].pts[1], ZC = B.nodeType(Z, 0, 1, "cusp"), mvc = B.moveHandle(ZC, 0, 1, "out", 80, 0).subs[0].pts[1];
check("moveHandle: symmetrical mirrors it exactly, smooth turns the other (its length kept), cusp leaves it",
  near(mv.ix, 20) && near(mv.iy, 0) && near(mvs.iy, 0, 1e-6) && mvs.ix < 50 && near(Math.hypot(mvs.ix - 50, mvs.iy), Math.hypot(ZS.subs[0].pts[1].ix - 50, ZS.subs[0].pts[1].iy), 1e-6) && mvc.ix === ZC.subs[0].pts[1].ix, [mv, mvs, mvc]);
const tlz = B.toLine(Z, 0, 0);
check("toLine / toCurve: the segment straight (handles on the nodes), then curved again (handles at its thirds)", B.isLineSeg(B.toLine(Z, 0, 1).subs[0], 1) && B.isLineSeg(tlz.subs[0], 0) && !B.isLineSeg(B.toCurve(B.toLine(Z, 0, 1), 0, 1).subs[0], 1));
const brk = B.breakAt(Z, 0, 1), brc = B.breakAt(line([[0, 0], [10, 0], [10, 10], [0, 10]], true), 0, 2);
check("breakAt: an open line in two at the node; a closed one opens there (the node doubled: start = end)",
  brk.subs.length === 2 && brk.subs[0].pts.length === 2 && brk.subs[1].pts.length === 2 && brk.subs[1].pts[0].x === 50 && !brc.subs[0].closed && brc.subs[0].pts.length === 5 && brc.subs[0].pts[0].x === 10 && brc.subs[0].pts[4].x === 10 && brc.subs[0].pts[4].y === 10, [brk, brc]);
const two = { subs: [line([[0, 0], [10, 0]]).subs[0], line([[30, 0], [12, 0]]).subs[0]] }, jn = B.joinEnds(two, [0, 1], [1, 1]);
check("joinEnds: two lines' ends meet at their middle - one line (the second turned round); one line's two ends = it closes",
  jn && jn.subs.length === 1 && jn.subs[0].pts.length === 3 && jn.subs[0].pts[1].x === 11 && jn.subs[0].pts[2].x === 30 && B.joinEnds(line([[0, 0], [10, 0], [10, 10]]), [0, 0], [0, 2]).subs[0].closed
  && B.joinEnds(two, [0, 0], [0, 0]) === null && B.joinEnds(Z, [0, 1], [0, 2]) === null, jn);
const op = line([[0, 0], [10, 0], [10, 10]]);
check("extendToClose / autoClose: closed with a straight segment (an end ON the start merges into it)",
  B.extendToClose(op, 0).subs[0].closed && B.extendToClose(op, 0).subs[0].pts.length === 3 && B.extendToClose(line([[0, 0], [10, 0], [10, 10], [0, 0]]), 0).subs[0].pts.length === 3
  && B.autoClose({ subs: [op.subs[0], line([[5, 5], [6, 6]]).subs[0]] }).subs.every((s) => s.closed));
const ex = B.extract({ subs: [op.subs[0], line([[5, 5], [6, 6]]).subs[0]] }, 1);
check("extract: [the rest, the one taken out]; reverse: the order and handles swap", ex[0].subs.length === 1 && ex[1].subs[0].pts[0].x === 5 && B.reverse(Z, 0).subs[0].pts[0].x === 100 && B.reverse(Z, 0).subs[0].pts[1].ox === 40);
const wig = []; for (let i = 0; i <= 200; i++) wig.push([i, Math.sin(i / 20) * 30 + ((i % 2) ? 0.3 : -0.3)]);
const dense = Q.fromPolygon(wig, false, 0.25, 60), red = B.reduce(dense, 60);
check("reduce: fewer nodes (Curve smoothness), the shape kept within a few px", red.pts.length < dense.pts.length && red.pts.length >= 2 && Q.flatten(red, 0.5).every(([x, y]) => Math.abs(y - Math.sin(x / 20) * 30) < 7), [dense.pts.length, red.pts.length]);
const bent = B.bendSegment(line([[0, 0], [100, 0]]), 0, 0, 0.5, 0, 30), mid = Q.cubicAt(Q.segs(bent.subs[0])[0], 0.5);
check("bendSegment: a dragged segment's point follows the pointer (both handles move)", near(mid[0], 50, 1e-6) && near(mid[1], 30, 1e-6), mid);

/* ---- 3 */
const bsO = B.bspline([[0, 0], [100, 0], [100, 100], [0, 100]], false), bsC = B.bspline([[0, 0], [100, 0], [100, 100], [0, 100]], true);
check("bspline: open = clamped (starts / ends ON the first / last control point), smooth joins; closed = periodic, inside the control polygon",
  bsO.pts[0].x === 0 && bsO.pts[0].y === 0 && bsO.pts[bsO.pts.length - 1].y === 100 && bsO.pts.slice(1, -1).every((a) => a.smooth) && bsC.closed && bsC.pts.length === 4
  && Q.flatten(bsC, 0.5).every(([x, y]) => x > 0 && x < 100 && y > 0 && y < 100), [bsO.pts.length, bsC.pts.map((a) => [a.x, a.y])]);
const t3 = B.threePoint([0, 0], [100, 0], [50, 40]), m3 = Q.cubicAt(Q.segs(t3)[0], 0.5);
check("threePoint: from the start to the end, through the third point", near(m3[0], 50, 1e-9) && near(m3[1], 40, 1e-9) && t3.pts.length === 2);
const cvp = B.curvature([[0, 0], [50, 40], [100, 0], [150, 40, true], [200, 0]], false);
check("curvature: through every point, smooth where not asked otherwise, a corner where asked",
  cvp.pts.length === 5 && cvp.pts[1].smooth && cvp.pts[2].smooth && !cvp.pts[3].smooth && cvp.pts[3].ix === 150 && cvp.pts[3].ox === 150 && cvp.pts[0].x === 0, cvp.pts.map((a) => a.smooth));
const cc = B.constrain(0, 0, 100, 30);
check("constrain: Ctrl's 15° steps (same distance)", near(Math.atan2(cc[1], cc[0]), Math.PI / 12, 1e-9) && near(Math.hypot(cc[0], cc[1]), Math.hypot(100, 30), 1e-9), cc);

/* ---- 4 */
const box = (x, y) => Q.fromShape({ kind: "rect", x, y, w: 20, h: 10 }).subs[0];
const three = { subs: [box(0, 0), box(50, 30), box(200, 60)] };
const al = B.alignSubs(three, [0, 1, 2], "bottom"), alc = B.alignSubs(three, [1], "hcenter", { x: 0, y: 0, w: 400, h: 300 }), ds = B.distributeSubs(B.alignSubs(three, [0, 1, 2], "top"), [0, 1, 2], "h");
const bb = (p, k) => Q.bbox({ subs: [p.subs[k]] });
check("alignSubs: bottoms on the lowest; one to the canvas centre; distributeSubs: even centres, the outer two stay",
  [0, 1, 2].every((k) => near(bb(al, k).y + 10, 70, 1e-6)) && near(bb(alc, 1).x, 190, 1e-6) && near(bb(ds, 1).x + 10, 110, 1e-6) && near(bb(ds, 0).x, 0) && near(bb(ds, 2).x, 200), [bb(al, 0), bb(alc, 1), bb(ds, 1)]);

/* ---- 5 */
const shp = { kind: "path", path: { subs: [curve] }, stroke: "#112233", strokeW: 3, strokeOn: true, fill: "#ffcc00", fillOn: false, line: Object.assign({}, B.LINE_DEFAULT, { end: "arrow", style: "dash" }) };
const svg = B.svgDoc([shp], 200, 100), back = B.fromSvg(svg);
check("svgDoc: the line (stroke-dasharray, caps, joins), the arrowhead as a real filled outline, the outline pen in data-bitgen-vline; fromSvg brings it back",
  /stroke-dasharray="9 9"/.test(svg) && /stroke-linecap="round"/.test(svg) && /<path d="M[^"]*Z" fill="#112233"\/>/.test(svg) && /data-bitgen-vline=/.test(svg)
  && back.length === 1 && back[0].line.end === "arrow" && back[0].strokeW === 3 && JSON.stringify(back[0].path) === JSON.stringify(Q.normalize(shp.path)), svg.slice(0, 400));
check("...an SVG we did not write: no vector lines in it", B.fromSvg('<svg><path d="M0 0L1 1"/></svg>').length === 0);
const nz = Q.normalize({ subs: [{ closed: false, pts: [Object.assign(A(1, 1, 0, 1, 2, 1, true), { sym: true }), A(5, 5)] }] });
check("pcpath keeps symmetrical nodes (normalize, reverseSub); setCorner / setSmooth / a cusp drag clear it",
  nz.subs[0].pts[0].sym === true && Q.reverseSub(nz.subs[0]).pts[1].sym === true && !Q.setCorner(nz, 0, 0).subs[0].pts[0].sym && !Q.dragHandle(nz, 0, 0, "out", 3, 3, true).subs[0].pts[0].sym);
check("...and a symmetrical node's handle drag mirrors its length (Direct Selection too)", (() => { const d = Q.dragHandle(nz, 0, 0, "out", 4, 1).subs[0].pts[0]; return near(d.ix, -2) && near(d.iy, 1); })());
const PJ = read("ext", "imageeditdock", "pcpath.js");
check("pcpath's drawPathShape hands a vector line (s.line) to PCBez.drawLine", /if \(s\.line && root\.PCBez && root\.PCBez\.drawLine\) return root\.PCBez\.drawLine\(g, s\);/.test(PJ));

/* ---- 6 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), UI = read("ext", "imageeditdock", "pcui.js"),
  VL = read("ext", "imageeditdock", "pcvline.js"), PEN = read("ext", "imageeditdock", "pcpen.js"), PSD = read("ext", "imageeditdock", "pcpsd.js");
check("ext.json: pcbezier right after pcpath, pcvline right after pcpen (before imageedit.js); installed after PCPen",
  EXT.indexOf("pcbezier.js") === EXT.indexOf("pcpath.js") + 1 && EXT.indexOf("pcvline.js") === EXT.indexOf("pcpen.js") + 1 && EXT.indexOf("pcvline.js") < EXT.indexOf("imageedit.js")
  && IE.indexOf("PCPen.install(E)") < IE.indexOf("PCVLine.install(E)") && IE.indexOf("PCVLine.install(E)") < IE.indexOf("PCSmart.install(E)"));
check("pcui: the F5 group (Bézier, Freehand, 2-Point Line, Polyline, 3-Point Curve, B-Spline, Pen), F10 = the Shape tool, the Curvature Pen in P; F5 / F10 select (again = the next); icons",
  /\{ k: "f5", tools: \[\["bezier", "Bézier Tool"\], \["freehand", "Freehand Tool"\], \["line2", "2-Point Line Tool"\], \["polyline", "Polyline Tool"\], \["curve3", "3-Point Curve Tool"\], \["bspline", "B-Spline Tool"\], \["cpen", "Node Pen Tool"\](, \["cmedia", "Artistic Media Tool"\])?\] \}/.test(UI)
  && /\{ k: "f10", tools: \[\["shapetool", /.test(UI) && /\["freepen", "Freeform Pen Tool"\], \["curvpen", "Curvature Pen Tool"\]/.test(UI)
  && /if \(\(k === "f5" \|\|[^)]*k === "f10"\) && !e\.shiftKey\) return toolKey\(k, true\);/.test(UI) && ["bezier", "freehand", "line2", "polyline", "curve3", "bspline", "cpen", "shapetool", "curvpen"].every((t) => new RegExp("\\n    " + t + ": '").test(UI)));
check("pcvline: the tools, Outline Pen F12, Convert to Curves Ctrl+Q, Vector Line: Convert to Path / Make from Path, the SVG export, the tool commands",
  ["bezier", "cpen", "freehand", "line2", "polyline", "curve3", "bspline", "shapetool", "curvpen"].every((t) => new RegExp("T\\." + t + " = ").test(VL))
  && /C\("vl\.outline", "Outline Pen…", "F12"/.test(VL) && /C\("vl\.curves", "Convert to Curves", "Ctrl\+Q"/.test(VL) && /C\("vl\.topath", "Vector Line: Convert to Path…"/.test(VL)
  && /C\("vl\.frompath", "Vector Line: Make from Path…"/.test(VL) && /C\("path\.svgout", "Export Path as SVG…", "", exportSvg/.test(VL));
check("...a path made from a line remembers its outline pen (vec) and comes back with it; Scale with object / B-spline points follow crop / image size",
  /S\.paths\.push\(\{ id, name: name \|\| L\.name, path, vec \}\)/.test(VL) && /const vec = info\.k === "saved" && info\.e\.vec \? info\.e\.vec : null;/.test(VL) && /if \(ln\.scaleWith && Math\.abs\(k - 1\) > 1e-6\)/.test(VL) && /ln\.spline = \{ closed: ln\.spline\.closed, pts: ln\.spline\.pts\.map/.test(VL));
check("pcpen: the Paths panel's 〰 (Make Vector Line), the Pen's Rubber Band option, vector lines back from an SVG, E.pen's drawTarget / insertLayer / layerPathAt",
  /id="pnVLineB"/.test(PEN) && /q\("pnVLineB"\)\.onclick = \(\) => \(E\.vline \? E\.vline\.dlgFromPath\(\)/.test(PEN) && /id="pnRubber"/.test(PEN) && /if \(sub && hoverAt && !pd && S\.penRubber\) \{/.test(PEN)
  && /if \(asShape && E\.vlineSvg && E\.vlineSvg\(text, name\)\) return true;/.test(PEN) && /drawTarget, insertLayer, compAt, layerPathAt/.test(PEN));
check("pcpsd: a vector line's stroke as Photoshop's (caps, corners, dashes in widths, position) + its outline pen in the XMP, read back in the same order",
  /lineDashSet: VB\.dashOf\(ln, w\)\.map\(\(v\) => \(\{ units: "None"/.test(PSD) && /bitgen:vlines="\$\{encodeURIComponent\(JSON\.stringify\(vls\)\)\}"/.test(PSD) && /const vl = vlines\[vk\+\+\];/.test(PSD) && /if \(vl && vl\.line && vl\.name === L\.name\)/.test(PSD));
const SC = JSON.parse(read("docs", "shortcuts.json")), flat = JSON.stringify(SC);
check("docs/shortcuts.json: F5, F10, F12, Ctrl+Q", /"F5[^"]*"/.test(flat) && /"F10[^"]*"/.test(flat) && /"F12"/.test(flat) && /"Ctrl\+Q"/.test(flat));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
