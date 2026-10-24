#!/usr/bin/env node
/* bitGen Studio — 2.421.0 units: THE IMAGE EDITOR'S PEN, PATHS, VECTOR MASKS AND CUSTOM SHAPES (gap 1 of the Photoshop list)
 *   1. pcpath.js maths: Béziers (cubicAt, splitCubic, flatten, bbox, nearestSeg, hitAnchor)
 *   2. the edits: insertAt keeps the curve, removeAnchor, setCorner / setSmooth / convert, dragHandle (smooth vs cusp),
 *      pullHandles, moveAnchors / moveSubs, transform / fitBox, reverseSub
 *   3. shapes: fromShape (rect / rounded / ellipse / polygon / line), toPathShape, syncShape / fitShape, custom shapes
 *   4. pixels: raster with the four ops, contours (holes, diagonal pixels), fromMask round trip, fromPolygon fitting
 *   5. SVG in / out, PSD knots in / out
 *   6. the wiring: ext.json, pcdoc DEEP + vector mask in masked(), snapStruct carries the paths, the tools / tabs / menus,
 *      P belongs to the editor (pfloat), the shortcuts doc
 * Tim: "can we close the gap with 1,2,3,4 and 5 first" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const Q = require(path.join(ROOT, "ext", "imageeditdock", "pcpath.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const area = (m) => { let n = 0; for (const v of m) if (v) n++; return n; };

/* ---- 1. Béziers */
const c = [0, 0, 0, 100, 100, 100, 100, 0];
const mid = Q.cubicAt(c, 0.5);
check("cubicAt: the middle of a symmetric arch (50, 75); the ends are the anchors", near(mid[0], 50) && near(mid[1], 75) && near(Q.cubicAt(c, 0)[1], 0) && near(Q.cubicAt(c, 1)[0], 100), mid);
const [L, R] = Q.splitCubic(c, 0.3);
check("splitCubic: both halves meet at cubicAt(t) and trace the same curve", near(L[6], Q.cubicAt(c, 0.3)[0]) && near(R[0], L[6]) && near(Q.cubicAt(L, 0.5)[1], Q.cubicAt(c, 0.15)[1], 1e-9) && near(Q.cubicAt(R, 0.5)[0], Q.cubicAt(c, 0.65)[0], 1e-9));
const sq = Q.fromShape({ kind: "rect", x: 10, y: 20, w: 100, h: 50 });
check("fromShape rect: 4 corner anchors, closed; bbox = the rectangle; flatten closes on the start", sq.subs[0].pts.length === 4 && sq.subs[0].closed && JSON.stringify(Q.bbox(sq)) === '{"x":10,"y":20,"w":100,"h":50}'
  && JSON.stringify(Q.flatten(sq.subs[0]).slice(-1)[0]) === "[10,20]");
const el = { subs: [Q.ellipseSub(100, 100, 50, 30)] }, eb = Q.bbox(el);
check("an ellipse (4 smooth anchors, kappa handles): its box is the ellipse's, its points stay on it (within 0.1 %)", near(eb.x, 50, 0.01) && near(eb.w, 100, 0.02) && near(eb.h, 60, 0.02)
  && Q.flatten(el.subs[0], 0.1).every(([x, y]) => Math.abs(Math.hypot((x - 100) / 50, (y - 100) / 30) - 1) < 0.001), eb);
const ns = Q.nearestSeg(sq, 60, 23);
check("nearestSeg: the point on the path nearest (60, 23) is on the top edge (segment 0, t = 0.5, 3 px away)", ns.s === 0 && ns.i === 0 && near(ns.t, 0.5, 1e-3) && near(ns.d, 3, 1e-3), ns);
const hit = Q.hitAnchor(sq, 108, 22, 5), hitH = Q.hitAnchor(el, 128, 70, 4, () => true);
check("hitAnchor: an anchor within r; a handle only where handlesFor says (the ellipse top's out handle)", hit && hit.s === 0 && hit.i === 1 && hit.part === "anchor" && hitH && hitH.part === "out" && hitH.i === 0
  && Q.hitAnchor(sq, 60, 60, 5) === null, { hit, hitH });

/* ---- 2. edits */
const arch = { subs: [{ closed: false, op: "add", pts: [Q.anchor(0, 0, 0, 0, 0, 100), Q.anchor(100, 0, 100, 100, 100, 0)] }] };
const ins = Q.insertAt(arch, 0, 0, 0.5), mp = ins.subs[0].pts[1];
const same = [0.1, 0.25, 0.4].every((t) => { const a = Q.cubicAt(Q.segs(arch.subs[0])[0], t / 2), b = Q.cubicAt(Q.segs(ins.subs[0])[0], t); return near(a[0], b[0], 1e-9) && near(a[1], b[1], 1e-9); });
check("insertAt: a new SMOOTH anchor on the curve at t (50, 75), the curve's shape kept exactly; the original untouched", ins.subs[0].pts.length === 3 && mp.smooth && near(mp.x, 50) && near(mp.y, 75) && same && arch.subs[0].pts.length === 2);
check("removeAnchor: back to two anchors; the last one gone = the sub-path gone", Q.removeAnchor(ins, 0, 1).subs[0].pts.length === 2 && Q.removeAnchor({ subs: [{ closed: false, op: "add", pts: [Q.anchor(1, 1)] }] }, 0, 0).subs.length === 0);
const sm = Q.setSmooth(sq, 0, 1).subs[0].pts[1];
check("setSmooth: a corner gets handles along the line through its neighbours (a third of each side); setCorner takes them away; convert toggles",
  sm.smooth && near(sm.ix, 110 - 100 / Math.hypot(100, 50) * 100 / 3, 1e-9) && near(sm.iy, 20 - 50 / Math.hypot(100, 50) * 100 / 3, 1e-9) && near(sm.ox, 110 + 100 / Math.hypot(100, 50) * 50 / 3, 1e-9)
  && !Q.setCorner(Q.setSmooth(sq, 0, 1), 0, 1).subs[0].pts[1].smooth && Q.convert(Q.convert(sq, 0, 1), 0, 1).subs[0].pts[1].ix === 110, sm);
const e2 = Q.dragHandle(el, 0, 0, "out", 100, 50), t0 = e2.subs[0].pts[0];
const lenIn = Math.hypot(el.subs[0].pts[0].ix - 100, el.subs[0].pts[0].iy - 70);
check("dragHandle on a SMOOTH anchor: the other handle turns to stay opposite and keeps its own length", near(t0.ox, 100) && near(t0.oy, 50) && near(t0.ix, 100, 1e-9) && near(t0.iy, 70 + lenIn, 1e-9) && t0.smooth, t0);
const e3 = Q.dragHandle(el, 0, 0, "out", 100, 50, true), t3 = e3.subs[0].pts[0];
check("...with Alt (a cusp): only that handle moves, the anchor stops being smooth", near(t3.ix, el.subs[0].pts[0].ix) && !t3.smooth);
const pl = Q.pullHandles(sq, 0, 0, 30, 0).subs[0].pts[0];
check("pullHandles (the Pen's drag): out = the pointer, in = its mirror", pl.ox === 30 && pl.oy === 0 && pl.ix === -10 && pl.iy === 40 && pl.smooth);
const mv = Q.moveAnchors(sq, [[0, 0]], 5, -5), ms = Q.moveSubs({ subs: [sq.subs[0], el.subs[0]] }, [1], 10, 0);
check("moveAnchors moves the anchor with its handles; moveSubs whole components only", mv.subs[0].pts[0].x === 15 && mv.subs[0].pts[0].oy === 15 && mv.subs[0].pts[1].x === 110
  && near(ms.subs[1].pts[0].x, 110) && ms.subs[0].pts[0].x === 10);
const tr = Q.transform(sq, [0, 1, -1, 0, 400, 0]).subs[0].pts[1], fb = Q.bbox(Q.fitBox(sq, Q.bbox(sq), { x: 0, y: 0, w: 50, h: 100 }));
check("transform (a canvas matrix: 90° turn) and fitBox (box onto box)", tr.x === 380 && tr.y === 110 && JSON.stringify(fb) === '{"x":0,"y":0,"w":50,"h":100}', { tr, fb });
const rv = Q.reverseSub(el.subs[0]);
check("reverseSub: the anchors the other way round, in / out handles swapped (the same curve)", rv.pts[0].x === el.subs[0].pts[3].x && rv.pts[0].ix === el.subs[0].pts[3].ox && near(Q.signedArea(Q.flatten(rv)), -Q.signedArea(Q.flatten(el.subs[0])), 1e-6));

/* ---- 3. shapes */
const rr = Q.fromShape({ kind: "rect", x: 0, y: 0, w: 100, h: 60, radius: 10 }), poly = Q.fromShape({ kind: "polygon", x: 0, y: 0, w: 100, h: 100, sides: 6 }), ln = Q.fromShape({ kind: "line", x: 5, y: 5, w: 90, h: 0 });
check("fromShape: rounded rect 8 anchors, polygon n corners, line = an OPEN two-anchor path", rr.subs[0].pts.length === 8 && poly.subs[0].pts.length === 6 && ln.subs[0].pts.length === 2 && !ln.subs[0].closed && near(Q.bbox(rr).w, 100, 0.01));
const ps = Q.toPathShape({ kind: "line", x: 5, y: 5, w: 90, h: 0, fill: "#ff0000", fillOn: true, stroke: "#000", strokeOn: false, strokeW: 0 });
check("toPathShape: a line keeps its look as a path shape (no fill, stroked in its colour, at least 1 px); x / y / w / h = its box", ps.kind === "path" && ps.fillOn === false && ps.strokeOn && ps.stroke === "#ff0000" && ps.strokeW >= 1 && ps.x === 5 && ps.w === 90 && Array.isArray(ps._bb));
const fsh = Q.toPathShape({ kind: "rect", x: 10, y: 10, w: 100, h: 100 });
fsh.x += 20; Q.fitShape(fsh);
const fsh2 = Object.assign({}, fsh); fsh2.w = 50; Q.fitShape(fsh2);
check("fitShape: whatever moved / sized x, y, w, h (the move tool, crop, Image Size, Properties) moves / scales the path", fsh.path.subs[0].pts[0].x === 30 && near(Q.bbox(fsh2.path).w, 50) && near(Q.bbox(fsh2.path).x, 30));
const ids = Q.CUSTOM.map((x) => x.id), heart = Q.custom("heart", 10, 20, 200, 184), ring = Q.custom("ring", 0, 0, 100, 100, "subtract");
check("custom shapes: 16 of them (heart, star, arrow, bubble, ring, frame …) fitted to a box; the first component takes the op", Q.CUSTOM.length === 16 && new Set(ids).size === 16
  && ["heart", "star5", "arrow", "bubble", "ring", "frame", "cloud", "check"].every((x) => ids.includes(x)) && JSON.stringify(Q.bbox(heart)) === '{"x":10,"y":20,"w":200,"h":184}' && ring.subs[0].op === "subtract" && ring.subs[1].op === "subtract");

/* ---- 4. pixels */
const W = 120, H = 80;
const A = Q.fromShape({ kind: "rect", x: 10, y: 10, w: 60, h: 40 }), B = Q.fromShape({ kind: "rect", x: 40, y: 30, w: 60, h: 40 });
const op = (o) => area(Q.raster({ subs: [A.subs[0], Object.assign(Q.clone(B.subs[0]), { op: o })] }, W, H));
check("raster: the four ops - add 4200, subtract 1800, intersect 600, exclude 3600 (60 x 40 rectangles overlapping 30 x 20)", op("add") === 4200 && op("subtract") === 1800 && op("intersect") === 600 && op("exclude") === 3600,
  [op("add"), op("subtract"), op("intersect"), op("exclude")]);
const donut = { subs: [Q.ellipseSub(60, 40, 35, 35), Q.ellipseSub(60, 40, 15, 15, "subtract")] }, dm = Q.raster(donut, W, H);
const loops = Q.contours(dm, W, H);
check("contours: a ring = one outer outline (positive area) + one hole (negative)", loops.length === 2 && loops.filter((l) => l.area > 0).length === 1 && loops.filter((l) => l.area < 0).length === 1, loops.map((l) => l.area));
const diag = new Uint8Array(4 * 4); diag[0] = diag[5] = 255;
check("...two pixels touching only at a corner stay two outlines", Q.contours(diag, 4, 4).length === 2);
const back = Q.fromMask(dm, W, H, 1);
const rb = Q.raster(back, W, H); let diff = 0; for (let i = 0; i < dm.length; i++) if (dm[i] !== rb[i]) diff++;
check("fromMask (Make Work Path): the ring comes back as 2 smooth components (outer Combine, hole Subtract) covering the same pixels (≤ 3 % differ)",
  back.subs.length === 2 && back.subs[0].op === "add" && back.subs[1].op === "subtract" && back.subs.every((s) => s.closed && s.pts.length >= 4 && s.pts.length <= 24 && s.pts.some((a) => a.smooth)) && diff / area(dm) < 0.03, { n: back.subs.map((s) => [s.op, s.pts.length]), diff });
const isl = new Uint8Array(W * H); for (let y = 5; y < 75; y++) for (let x = 5; x < 115; x++) isl[y * W + x] = 255; for (let y = 15; y < 65; y++) for (let x = 15; x < 105; x++) isl[y * W + x] = 0; for (let y = 30; y < 50; y++) for (let x = 50; x < 70; x++) isl[y * W + x] = 255;
const nest = Q.fromMask(isl, W, H, 1);
const rn = Q.raster(nest, W, H); let dn = 0; for (let i = 0; i < isl.length; i++) if (isl[i] !== rn[i]) dn++;
check("...an island inside a hole: Combine, Subtract, Combine - in nesting order, the same pixels", nest.subs.map((s) => s.op).join() === "add,subtract,add" && dn === 0, { ops: nest.subs.map((s) => s.op), dn });
const wob = []; for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 2; wob.push([100 + Math.cos(a) * 50 + (i % 2) * 0.4, 100 + Math.sin(a) * 50]); }
const fit = Q.fromPolygon(wob, true, 2);
check("fromPolygon (Freeform Pen): 200 jittery points round a circle -> a closed path of a few smooth anchors within the tolerance",
  fit.closed && fit.pts.length >= 6 && fit.pts.length <= 16 && fit.pts.every((a) => a.smooth) && Q.flatten(fit, 0.5).every(([x, y]) => Math.abs(Math.hypot(x - 100, y - 100) - 50) < 3.5), fit.pts.length);
const zig = Q.fromPolygon([[0, 0], [50, 0], [50, 50], [100, 50]], false, 1);
check("...a sharp turn stays a CORNER (no overshoot)", zig.pts.length === 4 && zig.pts.every((a) => !a.smooth));

/* ---- 5. SVG / PSD */
const sv = Q.parseSvg("M10 10 H90 V90 H10 Z M30 30 C40 20 60 20 70 30 S80 60 50 70 Q30 60 30 30 Z");
check("parseSvg: H / V / C / S / Q, two sub-paths, closed (an end on the start merges into it); S reflects the last handle; Q becomes a cubic", sv.subs.length === 2 && sv.subs[0].pts.length === 4 && sv.subs[0].closed && sv.subs[1].pts.length === 3
  && sv.subs[1].pts[1].ox === 80 && sv.subs[1].pts[1].oy === 40 && near(sv.subs[1].pts[2].ox, 50 + 2 / 3 * (30 - 50)), sv.subs[1].pts.map((a) => [a.x, a.y, a.ox, a.oy]));
const rel = Q.parseSvg("m10 10 l20 0 l0 20 z");
check("...relative commands", JSON.stringify(rel.subs[0].pts.map((a) => [a.x, a.y])) === "[[10,10],[30,10],[30,30]]" && rel.subs[0].closed);
const rt = Q.parseSvg(Q.toSvg(donut));
const rr2 = Q.raster(rt, W, H, true); let d3 = 0; for (let i = 0; i < dm.length; i++) if (dm[i] !== rr2[i]) d3++;
check("toSvg -> parseSvg: the ring's hole is wound the other way, so a plain nonzero fill (any SVG viewer) shows the hole", d3 === 0 && /fill-rule="nonzero"/.test(Q.svgDoc(donut, W, H, "#f00")), d3);
const fsvg = Q.fromSvgFile('<svg><rect x="1" y="2" width="30" height="20"/><circle cx="50" cy="50" r="10"/><polygon points="0,0 10,0 5,8"/><path d="M0 0 L5 5"/></svg>');
check("fromSvgFile: rect, circle, polygon, path elements -> components", fsvg.subs.length === 4 && fsvg.subs[0].pts.length === 4 && fsvg.subs[1].pts.length === 4 && fsvg.subs[2].closed && !fsvg.subs[3].closed);
const psd = Q.toPsd({ subs: [donut.subs[0], donut.subs[1], Object.assign(Q.clone(sq.subs[0]), { op: "intersect" })] });
check("toPsd: ag-psd knots [in, anchor, out], Photoshop's op names (combine / subtract / intersect)", psd.paths.length === 3 && psd.paths[0].operation === "combine" && psd.paths[1].operation === "subtract" && psd.paths[2].operation === "intersect"
  && psd.paths[0].knots[0].points.length === 6 && psd.paths[0].knots[0].points[2] === 60 && psd.paths[0].knots[0].linked === true);
const pb = Q.fromPsd(psd, W, H), pf = Q.fromPsd(Object.assign({}, psd, { fillStartsWithAllPixels: true }), W, H);
check("fromPsd: the same path back; 'fill starts with all pixels' = a full-canvas component first", JSON.stringify(pb.subs.map((s) => [s.op, s.pts.length])) === JSON.stringify([["add", 4], ["subtract", 4], ["intersect", 4]])
  && near(pb.subs[1].pts[0].ox, donut.subs[1].pts[0].ox) && pf.subs.length === 4 && Q.bbox({ subs: [pf.subs[0]] }).w === W);

/* ---- 6. the wiring */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, DOC = read("ext", "imageeditdock", "pcdoc.js"), IE = read("ext", "imageeditdock", "imageedit.js"),
  UI = read("ext", "imageeditdock", "pcui.js"), PEN = read("ext", "imageeditdock", "pcpen.js"), TOOLS = read("ext", "imageeditdock", "pctools.js"), PSD = read("ext", "imageeditdock", "pcpsd.js");
check("ext.json: pcpath.js after pcdoc.js, pcpen.js before imageedit.js; imageedit.js installs PCPen", EXT.indexOf("pcpath.js") === EXT.indexOf("pcdoc.js") + 1 && EXT.indexOf("pcpen.js") < EXT.indexOf("imageedit.js")
  && /win\.PCPen\.install\(E\)/.test(IE));
check("pcdoc: the vector mask undoes with the layer (DEEP) and masks it in the compositor; a path shape is drawn / traced by pcpath", /const DEEP = \[[^\]]*"vmask"[^\]]*\]/.test(DOC) && /root\.PCPath\.vmaskAlpha\(L, W, H, env\.newCanvas\)/.test(DOC)
  && /if \(s\.kind === "path"\) \{ if \(root\.PCPath\) \{ g\.save\(\); root\.PCPath\.drawPathShape\(g, s\);/.test(DOC) && /root\.PCPath\.fitShape\(L\.shape\)/.test(DOC));
check("imageedit: snapStruct / snapDoc carry the document's paths (undo), openDoc clears them, the Paths tab, a linked vector mask moves with the layer",
  /function snapStruct\(\) \{ return Object\.assign\(\{ list: S\.layers\.map\(\(L\) => D\.snapLayer\(L\)\), active: S\.active \}, snapPaths\(\)\); \}/.test(IE) && /putPaths\(d\);/.test(IE)
  && /S\.paths = \[\]; S\.work = null; S\.ptarget = null;/.test(IE) && /tab\("layers", "pcPaths", "Paths"\)/.test(IE) && /if \(E\.shiftVmask\) E\.shiftVmask\(L, dx, dy\);/.test(IE));
check("crop / canvas size / image size / rotate / expand take the paths along (E.mapPaths)", (TOOLS.match(/E\.mapPaths\(/g) || []).length === 4 && /E\.mapPaths\(\[1, 0, 0, 1, E2\.ox, E2\.oy\]\)/.test(IE));
check("pcui: P = Pen / Freeform / Add / Delete / Convert, A = Path / Direct Selection, U + Custom Shape; the Paths tab; the vector mask's thumbnail and Properties",
  /\{ k: "p", tools: \[\["pen", "Pen Tool"\], \["freepen", "Freeform Pen Tool"\], (\["curvpen", "Curvature Pen Tool"\], )?\["addanchor"/.test(UI) && /\{ k: "a", tools: \[\["pathsel", "Path Selection Tool"\], \["directsel", "Direct Selection Tool"\]\] \}/.test(UI)
  && /\["customshape", "Custom Shape Tool"\]/.test(UI) && /\["pcPaths", "Paths"\]/.test(UI) && /E\.ui\.vmaskThumb\(Ly, i\)/.test(UI) && /E\.ui\.vmaskProps\(A\)/.test(UI));
check("pcpen: every tool, the Paths panel buttons (fill, stroke, selection, work path, mask, new, duplicate, delete), the Vector Mask / path / SVG commands",
  ["pen", "freepen", "addanchor", "delanchor", "convanchor", "pathsel", "directsel", "customshape"].every((t) => new RegExp("T\\." + t + " = \\{").test(PEN))
  && ["pnFillB", "pnStrokeB", "pnSelB", "pnWorkB", "pnMaskB", "pnNewB", "pnDupB", "pnDelB"].every((b) => PEN.includes(`id="${b}"`))
  && ["vmask.reveal", "vmask.hide", "vmask.path", "vmask.raster", "path.fromsel", "path.svgout", "path.svgshape", "path.custom", "path.xform"].every((c) => PEN.includes(`C("${c}"`)));
check("PSD: vector masks both ways, a path shape as a vector shape layer (fill + stroke)", /o\.vectorMask = PP\.toPsd\(sh\.path\);/.test(PSD) && /o\.vectorFill = \{ type: "color"/.test(PSD) && /L\.vmask = \{ path, on: !ch\.vectorMask\.disable/.test(PSD));
const PF = require(path.join(ROOT, "ext", "promptdock", "pfloat.js"));
check("P belongs to the image editor while the pointer / focus is in it (its Pen); elsewhere it still toggles the prompt docker", PF.wantsToggle({ key: "p" }, { tagName: "DIV" }, false) && !PF.wantsToggle({ key: "p" }, { tagName: "DIV" }, false, true)
  && /closest\(OWN\)/.test(read("ext", "promptdock", "pfloat.js")));
check("docs/shortcuts.json: P, A, U rows for the editor; P over the editor is its Pen", /"P  \(Shift\+P cycles\)",\s*"Pen · Freeform Pen · (Curvature Pen · )?Add Anchor Point · Delete Anchor Point · Convert Point"/.test(read("docs", "shortcuts.json"))
  && /over the image editor P is its Pen/.test(read("docs", "shortcuts.json")) && /"A  \(Shift\+A cycles\)"/.test(read("docs", "shortcuts.json")));
check("server.js untouched", !/pcpath|pcpen|vmask/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
