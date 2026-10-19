#!/usr/bin/env node
/* bitGen Studio — 2.428.0 units: CORELDRAW'S DRAWING TOOLS - the geometry of pcdraw.js + the wiring
 *   1. live shapes: rectangle corners (round / scallop / chamfer), ellipse / pie / arc, polygon, star, complex star,
 *      spiral, graph paper, common shapes; frames from a drag (square, from the centre) and from 3 points; following a
 *      moved / scaled shape
 *   2. Artistic Media: resampling, the presets' profiles, calligraphic / pressure widths, the sprayer
 *   3. dimensions (parallel / horizontal / vertical, angular), callouts, units; connectors (anchors, routes)
 *   4. the wiring: ext.json, the install, the F6 / F8 groups + keys, the F5 group's Artistic Media, pcbezier (plain subs,
 *      even-odd, labels), pcvline (node edits / Ctrl+Q end a live shape), pcpath keeps `plain`, the action keys
 * Tim: "i would like all the drawing tools from coreldraw and the tool dockers" (the agreed order). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const Q = require(path.join(ROOT, "ext", "imageeditdock", "pcpath.js"));
const P = require(path.join(ROOT, "ext", "imageeditdock", "pcdraw.js"));
const B = require(path.join(ROOT, "ext", "imageeditdock", "pcbezier.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const F = { cx: 100, cy: 100, w: 200, h: 100, rot: 0 };
const box = (p) => Q.bbox(p);
const inside = (p, x, y) => { const pts = Q.flatten(p.subs[0], 0.25); let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

/* ---- 1 */
const r0 = P.rectPath(F, [0, 0, 0, 0]), rr = P.rectPath(F, [20, 20, 20, 20], "round"), rs = P.rectPath(F, [20, 20, 20, 20], "scallop"), rc = P.rectPath(F, [20, 0, 20, 0], "chamfer");
check("rectPath: 4 corners square; rounded = 8 anchors, the corner cut off, the box kept", r0.subs[0].pts.length === 4 && rr.subs[0].pts.length === 8 && !inside(rr, 2, 52) && inside(rr, 30, 70) && JSON.stringify(box(rr)) === JSON.stringify(box(r0)), box(rr));
check("...scallop curves IN (more cut than round), chamfer cuts straight - only where a radius is set", !inside(rs, 12, 62) && inside(rr, 12, 62) && rc.subs[0].pts.length === 6 && !inside(rc, 3, 53) && inside(rc, 198, 52), [inside(rs, 12, 62), inside(rr, 12, 62)]);
check("...radii are capped at half the shorter side", P.rectPath(F, [500, 500, 500, 500]).subs[0].pts.length === 8 && near(box(P.rectPath(F, [500, 500, 500, 500])).h, 100, 1e-6));
const el = P.ellipsePath(F), pie = P.ellipsePath(F, "pie", 0, 90), arc = P.ellipsePath(F, "arc", 0, 180);
check("ellipsePath: an ellipse in the box; a pie (0° -> 90°, counter-clockwise = the top-right quarter, closed through the centre); an arc (open)",
  JSON.stringify(box(el)) === '{"x":0,"y":50,"w":200,"h":100}' && pie.subs[0].closed && near(box(pie).x, 100, 1e-3) && near(box(pie).y, 50, 1e-3) && near(box(pie).w, 100, 1e-3) && near(box(pie).h, 50, 1e-3) && !arc.subs[0].closed && near(box(arc).h, 50, 1e-3), [box(pie), box(arc)]);
check("polygonPath / starPath: n corners from the top; a star's inner points pulled in by its sharpness",
  P.polygonPath(F, 6).subs[0].pts.length === 6 && near(P.polygonPath(F, 6).subs[0].pts[0].y, 50) && P.starPath(F, 5, 53).subs[0].pts.length === 10
  && Math.hypot(P.starPath(F, 5, 80).subs[0].pts[1].x - 100, (P.starPath(F, 5, 80).subs[0].pts[1].y - 100) * 2) < Math.hypot(P.starPath(F, 5, 20).subs[0].pts[1].x - 100, (P.starPath(F, 5, 20).subs[0].pts[1].y - 100) * 2));
const cs = P.cstarPath(F, 9, 2), cs3 = P.cstarPath(F, 9, 3);
check("cstarPath: {9/2} one 9-corner polygon, {9/3} three triangles; sharpness capped", cs.subs.length === 1 && cs.subs[0].pts.length === 9 && cs3.subs.length === 3 && P.cstarPath(F, 7, 99).subs[0].pts.length === 7);
const sp = P.spiralPath({ cx: 100, cy: 100, w: 200, h: 200, rot: 0 }, 3, "sym");
check("spiralPath: one open curve from the centre outwards, inside its box", sp.subs.length === 1 && !sp.subs[0].closed && near(sp.subs[0].pts[0].x, 100, 1e-6) && near(sp.subs[0].pts[0].y, 100, 1e-6) && box(sp).w <= 200.5 && box(sp).w > 150, box(sp));
check("graphPath: columns x rows cells", P.graphPath(F, 4, 3).subs.length === 12 && P.graphPath(F, 4, 3).subs.every((s) => s.closed && s.pts.length === 4));
const cube = P.commonPath(F, "cube"), arrow = P.commonPath(F, "arrowR");
check("commonPath: fitted to the box; a shape's inner strokes (the cube's edges) are plain open lines; every Common Shape draws",
  near(box(arrow).w, 200, 1e-3) && cube.subs.filter((s) => !s.closed).every((s) => s.plain) && cube.subs.some((s) => !s.closed) && P.COMMON.every(([, id]) => P.commonPath(F, id).subs.length > 0) && P.COMMON.length >= 30, P.COMMON.length);
check("genPath dispatches every type", ["rect", "ellipse", "polygon", "star", "cstar", "spiral", "graph", "common"].every((t) => P.genPath({ type: t, frame: F, corners: [0, 0, 0, 0], sides: 5, points: 9, sharp: 2, revs: 2, cols: 2, rows: 2, id: "diamond" }).subs.length > 0) && P.genPath({ type: "nope", frame: F }).subs.length === 0);
const fd = P.frameOfDrag(10, 10, 110, 60), fs2 = P.frameOfDrag(10, 10, 110, 60, true), fc = P.frameOfDrag(50, 50, 80, 70, false, true);
check("frameOfDrag: the dragged box; Ctrl = square; Shift = from the centre", JSON.stringify(fd) === '{"cx":60,"cy":35,"w":100,"h":50,"rot":0}' && fs2.w === 100 && fs2.h === 100 && JSON.stringify(fc) === '{"cx":50,"cy":50,"w":60,"h":40,"rot":0}');
const f3 = P.frame3([0, 0], [100, 100], [0, 100]), r3p = P.rectPath(f3, [0, 0, 0, 0]);
check("frame3: the first side (here 45°) + the height to the third point; the rectangle has that side", near(f3.rot, Math.PI / 4) && near(f3.w, Math.hypot(100, 100)) && near(f3.h, Math.hypot(50, 50)) && r3p.subs[0].pts.some((a) => near(a.x, 0, 1e-6) && near(a.y, 0, 1e-6)) && r3p.subs[0].pts.some((a) => near(a.x, 100, 1e-6) && near(a.y, 100, 1e-6)), f3);
const g = { type: "star", frame: F, points: 5, sharp: 50 }, moved = Q.translate(P.genPath(g), 30, 40), fn = P.frameNow(g, moved);
const scaled = Q.fitBox(P.genPath(g), box(P.genPath(g)), { x: 0, y: 0, w: 400, h: 100 }), fs3 = P.frameNow(g, scaled);
check("frameNow: a live shape moved / scaled since is regenerated where it is now", near(fn.cx, 130, 0.05) && near(fn.cy, 140, 0.05) && near(fs3.w, 400 * F.w / box(P.genPath(g)).w, 0.5) && P.frameNow(g, P.genPath(g)) === F, [fn, fs3]);

/* ---- 2 */
const line = []; for (let i = 0; i <= 50; i++) line.push([i * 4, 0, 0.5]);
const rs2 = P.resample(line, 10);
check("resample: evenly spaced points along the stroke", rs2.length === 21 && rs2.every((p, i) => i === 0 || near(p[0] - rs2[i - 1][0], 10, 1e-6)), rs2.length);
check("profile: taper thin-thick-thin, teardrop thick-to-nothing, flare grows, uniform even", P.profile("taper", 0.5) > P.profile("taper", 0.02) && P.profile("teardrop", 0.95) < P.profile("teardrop", 0.3) && P.profile("flare", 0.9) > P.profile("flare", 0.1) && P.profile("uniform", 0.3) === 1);
const area = (p) => Math.abs(Q.signedArea(Q.flatten(p.subs[0], 0.5)));
const mT = P.mediaOutline(line, { mode: "preset", preset: "uniform", width: 20 }), mC0 = P.mediaOutline(line, { mode: "calligraphic", width: 20, angle: 0 }), mC90 = P.mediaOutline(line, { mode: "calligraphic", width: 20, angle: 90 });
check("mediaOutline: a closed outline - uniform ≈ length × width; a calligraphic nib along the stroke is thin, across it full", mT.subs[0].closed && near(area(mT), 200 * 20 + Math.PI * 100, 300) && area(mC0) < area(mC90) * 0.3, [area(mT), area(mC0), area(mC90)]);
const pr = line.map((p, i) => [p[0], p[1], i < 25 ? 0.2 : 1]), mP = P.mediaOutline(pr, { mode: "pressure", width: 20 });
check("...pressure: wider where pressed harder", Q.flatten(mP.subs[0], 0.5).filter(([x]) => x > 150).some(([, y]) => Math.abs(y) > 8) && Q.flatten(mP.subs[0], 0.5).filter(([x]) => x > 10 && x < 80).every(([, y]) => Math.abs(y) < 4));
const spr = P.sprayItems(line, { item: "dots", size: 10, spacing: 25 }), spr2 = P.sprayItems(line, { item: "dots", size: 10, spacing: 25 });
check("sprayItems: an item every spacing px, the same every time (seeded); rings are two components", spr.subs.length === 9 && JSON.stringify(spr) === JSON.stringify(spr2) && P.sprayItems(line, { item: "bubbles", size: 10, spacing: 50 }).subs.length === 10, spr.subs.length);

/* ---- 3 */
const dp = P.dimParallel([0, 0], [300, 400], [0, 0], "parallel", { unit: "px" });
check("dimParallel: the measured length, two plain extension lines + the dimension line", dp.length === 500 && dp.label.text === "500 px" && dp.path.subs.length === 3 && dp.path.subs[0].plain && dp.path.subs[1].plain && !dp.path.subs[2].plain);
const dh = P.dimParallel([0, 0], [100, 50], [50, -30], "auto", {}), dv = P.dimParallel([0, 0], [100, 50], [-30, 25], "auto", {});
check("...auto: placed above = horizontal (the x distance), beside = vertical (the y distance)", dh.mode === "horizontal" && dh.length === 100 && dv.mode === "vertical" && dv.length === 50, [dh.mode, dv.mode]);
check("fmtLen: px / mm / cm / in at a dpi, decimals", P.fmtLen(96, "in", 96, 1) === "1.0 in" && P.fmtLen(96, "mm", 96, 1) === "25.4 mm" && P.fmtLen(120, "cm", 300, 2) === "1.02 cm" && P.fmtLen(12.4, "px") === "12 px");
const da = P.dimAngular([0, 0], [100, 0], [0, 100], [50, 50], { dec: 1 });
check("dimAngular: the angle between the arms, an arc + two plain arms", da.label.text === "90.0°" && da.path.subs.length === 3 && da.path.subs[0].plain && !da.path.subs[2].plain && near(da.degrees, 90));
const co = P.callout([0, 0], [20, 30], [80, 30], { text: "Hi" });
check("callout: point -> elbow -> end, the text after it (left-aligned when it goes right)", co.path.subs[0].pts.length === 3 && co.label.text === "Hi" && co.label.align === "left" && co.label.x > 80);
const an = P.anchorsOf({ x: 0, y: 0, w: 100, h: 50 });
check("anchorsOf / nearestAnchor: the sides' middles and the centre; the nearest", JSON.stringify(an) === '{"n":[50,0],"e":[100,25],"s":[50,50],"w":[0,25],"c":[50,25]}' && P.nearestAnchor({ x: 0, y: 0, w: 100, h: 50 }, 98, 20)[0] === "e");
const st = P.route([0, 0], "e", [100, 80], "w", "straight"), ra = P.route([0, 0], "e", [100, 80], "w", "right"), ro = P.route([0, 0], "e", [100, 80], "w", "round", 10);
check("route: straight = 2 points; right-angle = out of the side, across, in (horizontal / vertical runs only); rounded = its corners bent",
  st.subs[0].pts.length === 2 && JSON.stringify(ra.subs[0].pts.map((a) => [a.x, a.y])) === "[[0,0],[50,0],[50,80],[100,80]]" && ro.subs[0].pts.length === 6 && ro.subs[0].pts.some((a) => a.ox !== a.x || a.ix !== a.x), ra.subs[0].pts.map((a) => [a.x, a.y]));

/* ---- 4 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), UI = read("ext", "imageeditdock", "pcui.js"), DR = read("ext", "imageeditdock", "pcdraw.js"),
  BZ = read("ext", "imageeditdock", "pcbezier.js"), VL = read("ext", "imageeditdock", "pcvline.js"), PJ = read("ext", "imageeditdock", "pcpath.js"), AC = read("ext", "imageeditdock", "pcactions.js");
check("ext.json: pcdraw right after pcvline; installed after PCVLine", EXT.indexOf("pcdraw.js") === EXT.indexOf("pcvline.js") + 1 && IE.indexOf("PCVLine.install(E)") < IE.indexOf("PCDraw.install(E)"));
check("pcui: the F6 group (10 shape tools), the F8 group (dimensions + connector), Artistic Media in F5; F6 / F8 select (again = the next); icons",
  /\{ k: "f6", tools: \[\["crect", "Rectangle Tool"\], \["crect3", "3-Point Rectangle Tool"\], \["cellipse"/.test(UI) && /\["ccommon", "Common Shapes Tool"\]\] \}/.test(UI) && /\{ k: "f8", tools: \[\["cdimpar"/.test(UI) && /\["cconnect", "Connector Tool"\]\] \}/.test(UI)
  && /\["cpen", "Node Pen Tool"\], \["cmedia", "Artistic Media Tool"\]\] \}/.test(UI) && /k === "f6" \|\| k === "f8"/.test(UI)
  && ["crect", "crect3", "cellipse", "cellipse3", "cpolygon", "cstar", "ccstar", "cspiral", "cgraph", "ccommon", "cmedia", "cdimpar", "cdimhv", "cdimang", "ccallout", "cconnect"].every((t) => new RegExp("\\n    " + t + ": '").test(UI) && new RegExp("T\\." + t + " = ").test(DR)));
check("pcbezier: plain sub-paths get no arrowheads; an even-odd fill (complex stars); labels drawn and in the SVG", /if \(w > 0 && sub\.pts\.length >= 2 && !sub\.plain\)/.test(BZ) && /if \(L\.evenodd\)/.test(BZ) && /for \(const lb of L\.labels \|\| \[\]\)/.test(BZ) && /<text x=/.test(BZ));
check("pcvline: editing nodes / Ctrl+Q ends a live shape or an artistic-media stroke; the bar shared (E.vline.lineBar); pcpath keeps `plain`",
  /if \(info\.L\.shape\.gen\) delete info\.L\.shape\.gen; if \(info\.L\.shape\.media\) delete info\.L\.shape\.media;/.test(VL) && /if \(L\.shape\.gen \|\| L\.shape\.media\) \{ delete L\.shape\.gen; delete L\.shape\.media; \}/.test(VL) && /E\.vline = \{ lineBar, bindLineBar, setPath, once,/.test(VL) && /s\.plain \? \{ plain: true \} : \{\}/.test(PJ));
check("the actions' function keys leave F6 / F8 to the new tools", !/"F6"|"F8"/.test(AC.match(/const KEYS = \[[^\]]*\]/)[0]));
check("a vector line keeps a plain sub's flag through parts()", B.parts({ path: { subs: [Object.assign(Q.fromShape({ kind: "line", x: 0, y: 0, w: 10, h: 0 }).subs[0], { plain: true })] }, strokeW: 2, strokeOn: true, line: { start: "arrow", end: "arrow" } }).heads.length === 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
