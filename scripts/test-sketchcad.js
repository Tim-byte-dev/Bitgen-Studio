// scripts/test-sketchcad.js — 2.464.0: the sketch's MEASURING and CAD FILES, the pure part (ext/imageeditdock/pcsketchcad.js):
// measure (points, lines, circles, arcs, two of them), closed regions (exact area / perimeter, holes, fillets, slots),
// SVG out, DXF out (R12; checked by ezdxf when it is installed), DXF in (LINE / CIRCLE / ARC / POINT / LWPOLYLINE with
// bulges / POLYLINE / SPLINE / ELLIPSE; the rest left out and counted), a round trip; + the wiring (the Measure tool, the
// typed values, the cad route).
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");
const K = require("../ext/imageeditdock/pcsketch.js");
const C = require("../ext/imageeditdock/pcsketchcad.js");
const ROOT = path.join(__dirname, "..");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 700))); if (!ok) fail++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const row = (m, l) => { const r = m && m.rows.find((x) => x[0] === l); return r ? r[1] : NaN; };

/* ---- measure */
let s = K.create(500, 500);
const pa = K.addPoint(s, 100, 100), pb = K.addPoint(s, 130, 140);
let m = C.measure(s, [{ k: "pt", id: pa }, { k: "pt", id: pb }]);
check("two points: distance 50, ΔX 30, ΔY 40, angle from level (y down -> up on screen) 306.87°", near(row(m, "Distance"), 50) && near(row(m, "ΔX"), 30) && near(row(m, "ΔY"), 40) && near(row(m, "Angle from level"), 360 - Math.atan2(40, 30) * 180 / Math.PI, 1e-6), m);
const l30 = K.line(s, [0, 300], [100 * Math.cos(Math.PI / 6), 300 - 100 * Math.sin(Math.PI / 6)]);
m = C.measure(s, [{ k: "ent", id: l30 }]);
check("a line: length 100, angle 30°", near(row(m, "Length"), 100) && near(row(m, "Angle from level"), 30, 1e-6), m);
const lh = K.line(s, [0, 400], [200, 400]), lh2 = K.line(s, [0, 430], [50, 430]);
m = C.measure(s, [{ k: "ent", id: l30 }, { k: "ent", id: lh }]);
check("two lines: the angle 30 and its supplement 150", near(row(m, "Angle"), 30, 1e-6) && near(row(m, "Its supplement"), 150, 1e-6), m);
m = C.measure(s, [{ k: "ent", id: lh }, { k: "ent", id: lh2 }]);
check("two parallel lines: 30 apart", m.title === "Two parallel lines" && near(row(m, "Distance apart"), 30), m);
m = C.measure(s, [{ k: "pt", id: pb }, { k: "ent", id: lh }]);
check("a point + a line: the distance to the line (260) and to the segment", near(row(m, "Distance to the line"), 260) && near(row(m, "Nearest distance to the segment"), 260), m);
const c1 = K.circle(s, [700, 100], 20), c2 = K.circle(s, [800, 100], 30);
m = C.measure(s, [{ k: "ent", id: c1 }]);
check("a circle: radius, diameter, circumference, area", near(row(m, "Radius"), 20) && near(row(m, "Diameter"), 40) && near(row(m, "Circumference"), 40 * Math.PI) && near(row(m, "Area"), 400 * Math.PI), m);
m = C.measure(s, [{ k: "ent", id: c1 }, { k: "ent", id: c2 }]);
check("two circles: centre to centre 100, gap 50", near(row(m, "Centre to centre"), 100) && near(row(m, "Gap between them"), 50), m);
m = C.measure(s, [{ k: "pt", id: pa }, { k: "ent", id: c1 }]);
check("a point + a circle: to the centre and to the edge", near(row(m, "To the centre"), 600) && near(row(m, "To the edge"), 580), m);
const ar = K.arc(s, [300, 300], [340, 300], [300, 340]);
m = C.measure(s, [{ k: "ent", id: ar }]);
check("an arc: radius 40, sweep 90°, length 20π", near(row(m, "Radius"), 40) && near(row(m, "Sweep"), 90, 1e-9) && near(row(m, "Arc length"), 20 * Math.PI), m);
const sp = K.spline(s, [[0, 0], [50, 0], [100, 0]]);
m = C.measure(s, [{ k: "ent", id: sp }]);
check("a straight spline: length 100", near(row(m, "Length"), 100, 1e-6), m);
check("one point alone measures nothing (the tool waits for a second)", C.measure(s, [{ k: "pt", id: pa }]) === null);

/* ---- closed regions: exact */
s = K.create(500, 500);
const R = K.rect2(s, [100, 100], [300, 200]); K.circle(s, [150, 150], 20);
let g = C.regionAt(s, 250, 150);
check("a 200 x 100 rectangle with a round hole r 20: area 20000 - 400π, perimeter 600 + 40π (inside the hole = the hole's own region)", g && near(g.area, 20000 - 400 * Math.PI, 1e-6) && near(g.perimeter, 600 + 40 * Math.PI, 1e-6) && g.holes === 1 && near(C.regionAt(s, 150, 150).area, 400 * Math.PI, 1e-6), g);
check("outside everything: no region", C.regionAt(s, 50, 50) === null);
const fr = K.fillet(s, R.lines[1], R.lines[2], 30);
g = C.regionAt(s, 250, 150);
check("...a fillet r 30 on a corner: the area loses r² - πr²/4 exactly (an arc's area is exact, not polygon-flattened)", fr.ok && near(g.area, 20000 - 400 * Math.PI - (900 - 900 * Math.PI / 4), 1e-6), { fr: fr.ok, area: g && g.area });
s = K.create(500, 500); K.slot(s, [100, 100], [260, 100], 40);
g = C.regionAt(s, 180, 100);
check("a slot 160 centre to centre, 40 wide: area 160·40 + 400π, perimeter 320 + 40π", g && near(g.area, 6400 + 400 * Math.PI, 1e-6) && near(g.perimeter, 320 + 40 * Math.PI, 1e-6), g);

/* ---- SVG */
s = K.create(400, 250); s.style.fill = "#ccddee";
K.rect2(s, [100, 100], [300, 200]); K.arc(s, [200, 150], [230, 150], [200, 180]); K.line(s, [0, 0], [10, 10], true); K.circle(s, [350, 50], 10);
let svg = C.toSVG(s, { w: 800, h: 500, unit: "mm", scale: 0.25 });
check("SVG: an <svg> the picture's size (mm = 200 x 125), the sketch's lines / arc / circle as paths (no construction), the profiles filled", /<svg [^>]*width="200mm" height="125mm" viewBox="0 0 800 500"/.test(svg) && (svg.match(/<path id=/g) || []).length === 6 && /A30 30 0 0 1 200 180/.test(svg) && /<g id="profiles" fill="#ccddee"/.test(svg) && !/construction/.test(svg), svg.slice(0, 600));
svg = C.toSVG(s, { w: 800, h: 500, construction: true });
check("SVG: construction lines too when asked (dashed)", /<g id="construction"[^>]*stroke-dasharray/.test(svg) && /width="800" height="500"/.test(svg));

/* ---- DXF out */
s = K.create(500, 500);
const RR = K.rect2(s, [500, 500], [700, 400]);
K.tryAdd(s, K.dimFrom(s, "len", [RR.lines[0]]), "dim");
K.arc(s, [500, 500], [540, 500], [500, 540]);                 // right -> down (y down): with y up, 270° -> 0°
K.circle(s, [600, 450], 20); K.point(s, K.addPoint(s, 650, 480)); K.spline(s, [[800, 500], [850, 450], [900, 500]]); K.line(s, [500, 300], [600, 300], true);
let dxf = C.toDXF(s, { scale: 0.5, unit: "mm" });
const codes = dxf.split("\r\n");
check("DXF: R12 (AC1009), $INSUNITS 4 (mm), sections HEADER / TABLES / ENTITIES, EOF; CRLF lines", codes[0] === "0" && codes[1] === "SECTION" && /\$ACADVER\r\n1\r\nAC1009/.test(dxf) && /\$INSUNITS\r\n70\r\n4\r\n/.test(dxf) && /2\r\nENTITIES/.test(dxf) && dxf.endsWith("0\r\nEOF\r\n"));
let P1 = C.parseDXF(dxf);
const arcI = P1.items.find((i) => i.t === "arc");
check("DXF: the origin is 0,0, y up, scaled (the rectangle 0..100 x 0..50; the arc's own extents, not its circle's), the arc 270° -> 0°, r 20, construction left out unless asked, the spline as a 33-vertex POLYLINE", P1.items.filter((i) => i.t === "line").length === 4 && near(P1.bounds.x0, 0, 1e-9) && near(P1.bounds.y0, -20, 1e-9) && near(P1.bounds.x1, 200, 1e-9) && near(P1.bounds.y1, 50, 1e-9) && arcI && near(arcI.a0, 270) && near(arcI.a1, 0) && near(arcI.r, 20) && P1.items.some((i) => i.t === "poly" && i.v.length === 33) && P1.items.some((i) => i.t === "point"), { b: P1.bounds, arcI });
dxf = C.toDXF(s, { construction: true, dims: true });
P1 = C.parseDXF(dxf);
check("DXF: with construction (layer CONSTRUCTION) + dimensions (layer DIMENSIONS: lines + a TEXT, counted as left out on the way back)", P1.items.some((i) => i.layer === "CONSTRUCTION") && P1.items.some((i) => i.layer === "DIMENSIONS") && P1.skipped.TEXT === 1, P1.skipped);
// ezdxf (when installed) reads it without errors
const tmp = path.join(os.tmpdir(), "sketchcad" + process.pid + ".dxf"); fs.writeFileSync(tmp, dxf);
const py = spawnSync("python3", ["-c", "import sys,ezdxf\nd=ezdxf.readfile(sys.argv[1]); a=d.audit(); print(len(a.errors), sorted(set(e.dxftype() for e in d.modelspace())))", tmp], { encoding: "utf8" });
if (py.status === 0) check("DXF: ezdxf reads it, 0 audit errors, LINE / ARC / CIRCLE / POINT / POLYLINE / TEXT", /^0 /.test(py.stdout) && ["LINE", "ARC", "CIRCLE", "POINT", "POLYLINE", "TEXT"].every((t) => py.stdout.includes("'" + t + "'")), py.stdout + py.stderr);
else console.log("skip DXF checked by ezdxf (python3 -m pip install ezdxf to run it): " + String(py.stderr || "").split("\n").filter(Boolean).pop());
fs.rmSync(tmp, { force: true });

/* ---- round trip: out and back in (0,0 = the origin, the same scale) */
s = K.create(500, 500); const R2 = K.rect2(s, [500, 500], [700, 400]); K.fillet(s, R2.lines[0], R2.lines[1], 25); K.circle(s, [560, 460], 15);
const before = C.regionAt(s, 650, 470);
const t2 = K.create(300, 300);
let res = C.addDXF(t2, C.parseDXF(C.toDXF(s, { unit: "mm", scale: 0.1 })), { place: "origin", scale: 10 });
const after = C.regionAt(t2, 450, 270);
check("round trip (mm, 1 px = 0.1 mm, back at 10 px per mm round another origin): the same region - area + perimeter - ends joined (one profile with its hole)", res.ok && after && near(after.area, before.area, 1e-3) && near(after.perimeter, before.perimeter, 1e-3) && after.holes === 1, { before, after: after && { area: after.area, perimeter: after.perimeter } });

/* ---- DXF in: a hand-written file */
const D = (pairs) => pairs.map(([c, v]) => `${c}\n${v}`).join("\n") + "\n";
const txt = D([[0, "SECTION"], [2, "HEADER"], [9, "$INSUNITS"], [70, 4], [0, "ENDSEC"], [0, "SECTION"], [2, "ENTITIES"],
  // a stadium: LWPOLYLINE closed with two bulge-1 half circles
  [0, "LWPOLYLINE"], [8, "0"], [90, 4], [70, 1], [10, 0], [20, 0], [10, 100], [20, 0], [42, 1], [10, 100], [20, 40], [10, 0], [20, 40], [42, 1],
  // an R12 POLYLINE triangle
  [0, "POLYLINE"], [8, "0"], [66, 1], [70, 1], [0, "VERTEX"], [8, "0"], [10, 200], [20, 0], [0, "VERTEX"], [8, "0"], [10, 260], [20, 0], [0, "VERTEX"], [8, "0"], [10, 200], [20, 60], [0, "SEQEND"],
  [0, "CIRCLE"], [8, "0"], [10, 50], [20, 20], [40, 10],
  [0, "ARC"], [8, "0"], [10, 300], [20, 0], [40, 20], [50, 0], [51, 90],
  [0, "POINT"], [8, "0"], [10, 5], [20, 5],
  [0, "SPLINE"], [8, "0"], [70, 8], [74, 3], [11, 0], [21, 100], [11, 50], [21, 120], [11, 100], [21, 100],
  [0, "ELLIPSE"], [8, "0"], [10, 400], [20, 50], [11, 40], [21, 0], [40, 0.5], [41, 0], [42, 2 * Math.PI],
  [0, "TEXT"], [8, "0"], [10, 0], [20, 0], [40, 5], [1, "hello"],
  [0, "INSERT"], [8, "0"], [2, "BLOCK1"],
  [0, "ENDSEC"], [0, "EOF"]]);
const P2 = C.parseDXF(txt);
check("parseDXF: 7 items (polyline x2, circle, arc, point, spline from its fit points, the ellipse as a closed spline), TEXT + INSERT left out and counted, mm", P2.items.length === 7 && P2.units === 4 && P2.skipped.TEXT === 1 && P2.skipped.INSERT === 1 && P2.items.filter((i) => i.t === "poly").length === 2 && P2.items.find((i) => i.t === "spline" && !i.closed).pts.length === 3 && P2.items.find((i) => i.t === "spline" && i.closed).pts.length === 16, { n: P2.items.length, sk: P2.skipped, t: P2.items.map((i) => i.t) });
s = K.create(500, 500);
res = C.addDXF(s, P2, { place: "origin", scale: 1 });
const stad = C.regionAt(s, 520, 470), tri = C.regionAt(s, 710, 490), ell = C.regionAt(s, 900, 450);
check("addDXF (1 unit = 1 px at the origin, y up): the bulged stadium = 4000 + 400π exactly, the triangle 1800, the ellipse ≈ π·40·20, the circle a hole in the stadium", res.ok && stad && near(stad.area, 4000 + 400 * Math.PI - 100 * Math.PI, 1e-6) && stad.holes === 1 && tri && near(tri.area, 1800, 1e-6) && ell && Math.abs(ell.area - Math.PI * 800) < 30, { stad, tri: tri && tri.area, ell: ell && ell.area });
const imArc = s.ents.find((e) => e.t === "arc" && near(K.arcAngles(s, e).cx, 800) && near(K.arcAngles(s, e).cy, 500));
check("...the ARC 0° -> 90° (anticlockwise, y up, centre 300,0) = the picture's arc from (800, 480) round to (820, 500) - above its centre", imArc && near(K.pt(s, imArc.p1).x, 800) && near(K.pt(s, imArc.p1).y, 480) && near(K.pt(s, imArc.p2).x, 820) && near(K.pt(s, imArc.p2).y, 500), imArc && [K.pt(s, imArc.p1), K.pt(s, imArc.p2)]);
check("...ends that meet share one point (the stadium's 4 corners + the triangle's 3 = 7 points for 5 lines; 3 arcs)", s.ents.filter((e) => e.t === "line" && !e.axis).length === 5 && s.ents.filter((e) => e.t === "arc").length === 3 && new Set(s.ents.filter((e) => e.t === "line" && !e.axis).flatMap((e) => [e.p1, e.p2])).size === 7);
const t3 = K.create(400, 250); res = C.addDXF(t3, P2, { place: "fit", w: 800, h: 500 });
const xs = t3.pts.filter((p) => !K.isOrigin(t3, p.id)).map((p) => p.x), ys = t3.pts.filter((p) => !K.isOrigin(t3, p.id)).map((p) => p.y);
check("addDXF fit: scaled into 80% of the picture, centred", res.ok && Math.min(...xs) >= 79 && Math.max(...xs) <= 721 && Math.min(...ys) >= 49 && Math.max(...ys) <= 451 && (near(Math.max(...xs) - Math.min(...xs), 640, 1) || near(Math.max(...ys) - Math.min(...ys), 400, 1)), { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] });
check("bulgeArc: bulge 1 = a half circle centred on the chord; 0 = straight", JSON.stringify(C.bulgeArc([0, 0], [10, 0], 1).c.map((v) => Math.round(v * 1e6) / 1e6)) === "[5,0]" && near(C.bulgeArc([0, 0], [10, 0], 1).r, 5) && C.bulgeArc([0, 0], [10, 0], 0) === null);
check("parseDXF of nonsense: nothing, no throw", C.parseDXF("hello\nworld").items.length === 0 && C.addDXF(K.create(0, 0), C.parseDXF(""), {}).ok === false);

/* ---- the wiring */
const ext = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts;
const IE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/imageedit.js"), "utf8");
const T = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcsketchtools.js"), "utf8");
const UI = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcui.js"), "utf8");
const CU = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcsketchcadui.js"), "utf8");
const IDX = fs.readFileSync(path.join(ROOT, "routes/index.js"), "utf8"), RC = fs.readFileSync(path.join(ROOT, "routes/cad.js"), "utf8"), ST = fs.readFileSync(path.join(ROOT, "lib/cadStore.js"), "utf8");
check("wiring: pcsketchcad.js + pcsketchcadui.js right after pcsketchtools.js; PCSketchCADUI installed after PCSketchTools, before PCHandles", ext.indexOf("pcsketchcad.js") === ext.indexOf("pcsketchtools.js") + 1 && ext.indexOf("pcsketchcadui.js") === ext.indexOf("pcsketchcad.js") + 1 && IE.indexOf("PCSketchCADUI.install(E)") > IE.indexOf("PCSketchTools.install(E)") && IE.indexOf("PCSketchCADUI.install(E)") < IE.indexOf("PCHandles.install(E)"));
check("wiring: the Measure tool in the N group with an icon, M with a sketch tool picked; the typed values (TYPED, Tab / Enter) in the sketch tools", /\["sk_measure", "Measure Tool \(sketch\)"\]\] \}/.test(UI) && /\n    sk_measure: '/.test(UI) && /m: "sk_measure"/.test(T) && /const TYPED = \{ sk_line: \[\["len", "Length"\], \["ang", "Angle °"\]\]/.test(T) && /function commitTyped\(\)/.test(T) && /E\.tools\.sk_measure = \{/.test(CU));
check("wiring: File ▸ Export Sketch as DXF… / SVG…, Import DXF… / from Project…; the routes from routes/index.js (/api/cad save / list / file) with lib/cadStore.js - not server.js", ["sketch.exportdxf", "sketch.exportsvg", "sketch.importdxf", "sketch.importdxfproj"].every((c) => CU.includes(`C("${c}"`)) && /require\("\.\/cad"\)\.mount\(app\)/.test(IDX) && /\/api\/cad\/save/.test(RC) && /\/api\/cad\/list/.test(RC) && /\/api\/cad\/file\/:name/.test(RC) && /require\("\.\.\/lib\/cadStore"\)/.test(RC) && /core\.pDir\("cad"\)/.test(ST) && !/cadStore|api\/cad/.test(fs.readFileSync(path.join(ROOT, "server.js"), "utf8")));
check("wiring: cadStore refuses an SVG with a script and a DXF without SECTION / EOF", /<script\[\\s>\]/.test(ST) && /SECTION/.test(ST) && /EOF/.test(ST));

console.log(fail ? `\n${fail} FAILED` : "\nall sketch CAD checks passed");
process.exit(fail ? 1 : 0);
