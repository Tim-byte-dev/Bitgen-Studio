#!/usr/bin/env node
/* bitGen Studio — 2.665.0: 📄 THE SKETCHER'S BUILDING PLANS (ext/pushpulldock/ppsheets.js) - pure: the options, the views,
 * the scales they fit at, the dimensions, the title block, one sheet / one view per page, and the PDF read back with pdf-lib.
 * The dialog in a real browser: scripts/test-ui665-ui.js. Tim (verbatim): "add a button in sketcher top toolstrip to create
 * building plans - create building plans from sketch to scale and save it to a pdf, allow user to select scale by using, A4,
 * A3,A2,A1 for the scale size, add a title block and dimensions like a professional building plan. bring up a dialog with
 * titlebar for building plans custom so user can check if they want dimensions, all views on 1 a1 page, views of different
 * pages etc" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js")); globalThis.PPArch = P;
const PL = require(path.join(ROOT, "ext/pushpulldock/ppplan.js"));
const SH = require(path.join(ROOT, "ext/pushpulldock/ppsheets.js"));
const LIB = require(path.join(ROOT, "static/vendor/pdf-lib.min.js"));
const deps = { PPArch: P, PPPlan: PL };
const texts = (pg) => pg.prims.filter((p) => p.t === "text").map((p) => p.str);
const inside = (pg) => pg.prims.every((p) => (p.t === "poly" ? p.rings.flat() : p.t === "line" ? p.pts : [[p.x, p.y]]).every((q) => q[0] >= -0.01 && q[1] >= -0.01 && q[0] <= pg.w + 0.01 && q[1] <= pg.h + 0.01));

// ---- the options
const d0 = SH.defaults();
check("defaults: A3 landscape, auto scale, all on one sheet, every view, dimensions on, today's date", d0.sheet === "A3" && d0.orient === "landscape" && d0.scale === "auto" && d0.pages === "one" && d0.plans && d0.elevations && d0.roof && d0.dims && /^\d{4}-\d\d-\d\d$/.test(d0.date), d0);
const c1 = SH.clean({ sheet: "B5", scale: "abc", pages: "x", orient: "up", dims: 0, project: "x".repeat(300) });
check("clean: an unknown sheet = A3, a bad scale = auto, pages one, landscape, ticks as booleans, words cut", c1.sheet === "A3" && c1.scale === "auto" && c1.pages === "one" && c1.orient === "landscape" && c1.dims === false && c1.project.length === 80, c1);
check("clean: a scale typed as text = its number (1:50)", SH.clean({ scale: "50" }).scale === 50);
check("sheet sizes: A4 297 x 210 ... A1 841 x 594 (mm), portrait turned", JSON.stringify(SH.sheetSize({ sheet: "A1", orient: "landscape" })) === "[841,594]" && JSON.stringify(SH.sheetSize({ sheet: "A4", orient: "portrait" })) === "[210,297]");

// ---- an empty model
let A = P.empty();
let R = SH.compose(A, {}, deps);
check("nothing drawn yet: one sheet (border + title block) with a note, not fitting, no views", R.pages.length === 1 && R.n === 0 && !R.fits && /draw rooms first/.test(R.warn) && texts(R.pages[0]).includes("Nothing to draw yet - draw rooms first"), R.warn);

// ---- a house: two storeys, a door, windows, a roof
A = P.empty();
const K = P.addRoom(A, P.rectPts([0, 0], [5, 4]), { name: "Kitchen" });
const B = P.addRoom(A, P.rectPts([5, 0], [9, 4]), { name: "Bed 1" });
P.addOp(A, "door", 0.9, { room: K.id, edge: 0, at: 2 });
P.addOp(A, "window", 1.2, { room: B.id, edge: 0, at: 2 });
const U = P.addRoom(A, P.rectPts([0, 0], [5, 4]), { name: "Loft", z: 2.7 });
P.addRoof(A, [U.id], { type: "gable" });
A = P.clean(A) || A;

const V = SH.views(A, {}, deps);
check("views: a plan per storey (ground, first), four elevations, the roof / site plan", JSON.stringify(V.map((v) => v.title)) === JSON.stringify(["GROUND FLOOR PLAN", "FIRST FLOOR PLAN", "NORTH ELEVATION", "EAST ELEVATION", "SOUTH ELEVATION", "WEST ELEVATION", "ROOF / SITE PLAN"]), V.map((v) => v.title));
check("views: only the ones ticked (no elevations, no roof)", SH.views(A, { elevations: false, roof: false }, deps).length === 2);

// the plan's dimensions: the door's chain along the south face, the face, the overall
const pv = SH.planView(A, { kind: "plan", z: 0 }, SH.clean({}), deps, 100);
const pt = pv.prims.filter((p) => p.t === "text").map((p) => p.str);
check("plan dimensions in mm: the south face 9150 (walls' outside), the door's chain 1625 / 900 / ...", pt.includes("9150") && pt.includes("900") && pt.includes("1625"), pt);
check("plan dimensions: the depth 4150 (east / west faces), no overall repeated when a face already is it", pt.includes("4150") && pt.filter((t) => t === "9150").length === 2, pt.filter((t) => /^\d+$/.test(t)));
check("plan: the rooms' names / sizes / areas (Kitchen, 5 × 4 m, m²)", pt.includes("Kitchen") && pt.some((t) => /5 × 4 m/.test(t)) && pt.some((t) => /m²$/.test(t)), pt);
const pv2 = SH.planView(A, { kind: "plan", z: 0 }, SH.clean({ dims: false, rooms: false }), deps, 100);
const pt2 = pv2.prims.filter((p) => p.t === "text").map((p) => p.str);
check("plan: Dimensions + Room names off = no numbers, no names", !pt2.some((t) => /^\d+$/.test(t)) && !pt2.includes("Kitchen"), pt2);
check("plan: the walls poché (a dark fill) and the door's swing are there", pv.prims.some((p) => p.t === "poly" && p.fill === "#1d1e21") && pv.prims.filter((p) => p.t === "line").length > 20);
check("plan: not coloured = white floors (the room's colour only when Coloured is ticked)", pv.prims.filter((p) => p.t === "poly" && p.fill !== "#1d1e21" && p.fill !== "#6b6d73").every((p) => p.fill === "#ffffff"));

// the elevations: what faces you, a plane's inner seams left out
const south = SH.projGroups(A, "south", deps, SH.clean({}));
check("south elevation: the walls / roof / door / window faces facing south, far ones first (painter's order)", south.length > 3 && south.every((g, i) => !i || south[i - 1].near >= g.near - 1e-4), south.map((g) => g.near));
const big = south.reduce((a, g) => (g.polys.length > a.polys.length ? g : a));
check("south elevation: a plane's outline (the wall's banded faces joined - fewer edges than ring sides)", big.edges.length > 0 && big.edges.length < big.polys.reduce((s, p) => s + p.rings.reduce((t, r) => t + r.length, 0), 0), { e: big.edges.length });
const ev = SH.projView(A, { kind: "elev", dir: "south" }, SH.clean({}), deps, 100);
const et = ev.prims.filter((p) => p.t === "text").map((p) => p.str);
check("elevation: FFL marks for both storeys, the top, the overall height", et.includes("FFL +0.000 (L0)") && et.includes("FFL +2.700 (L1)") && et.some((t) => /^TOP \+\d/.test(t)) && et.some((t) => /^\d{4}$/.test(t)), et);
check("elevation: the ground line (a thick line at FFL 0)", ev.prims.some((p) => p.t === "line" && p.lw >= 0.6 && p.pts[0][1] === 0 && p.pts[1][1] === 0));
const sq = SH.outline([{ rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }, { rings: [[[1, 0], [2, 0], [2, 1], [1, 1]]] }]);
check("outline: two squares side by side = the outside only (the shared edge cancels)", sq.length === 4 && !sq.some((s) => s[0][0] === 1 && s[1][0] === 1), sq);
const tj = SH.outline([{ rings: [[[0, 0], [2, 0], [2, 1], [0, 1]]] }, { rings: [[[0, 1], [1, 1], [1, 2], [0, 2]]] }]);
check("outline: a T-junction - the long top edge kept where nothing meets it (1..2), dropped where it does", tj.some((s) => Math.abs(s[0][1] - 1) < 1e-9 && Math.abs(s[1][1] - 1) < 1e-9 && Math.min(s[0][0], s[1][0]) === 1), tj);

// ---- one sheet: auto scale, everything inside the sheet, the title block
R = SH.compose(A, { sheet: "A1" }, deps);
check("A1, all on one sheet: one page 841 x 594 mm, all 7 views, a standard scale (auto: 1:50 for this house)", R.pages.length === 1 && R.pages[0].w === 841 && R.pages[0].h === 594 && R.n === 7 && R.fits && R.scales[0] === 50, { s: R.scales, n: R.n, w: R.warn });
check("…every line / text on the sheet", inside(R.pages[0]));
const t1 = texts(R.pages[0]);
check("title block: NOTES, PROJECT, DRAWING, DRAWN BY, DATE, SCALE 1:50 @ A1, SHEET 1 OF 1, REVISION, the north arrow's N", ["NOTES", "PROJECT", "DRAWING", "DRAWN BY", "DATE", "SCALE", "SHEET", "REVISION", "N", "1:50 @ A1", "1 OF 1"].every((t) => t1.includes(t)), t1.slice(-40));
check("each view titled with its scale (GROUND FLOOR PLAN, SCALE 1:50)", t1.includes("GROUND FLOOR PLAN") && t1.includes("NORTH ELEVATION") && t1.filter((t) => t === "SCALE 1:50").length === 7);
const R3 = SH.compose(A, { sheet: "A4" }, deps);
check("A4: the same 7 views at a smaller scale (auto picks one that fits)", R3.fits && R3.scales[0] > 50 && R3.n === 7 && inside(R3.pages[0]), R3.scales);
const R4 = SH.compose(A, { sheet: "A4", scale: 20 }, deps);
check("A4 at 1:20, all on one sheet: does not fit - drawn anyway with a warning", !R4.fits && /do not fit on A4 at 1:20/.test(R4.warn) && R4.pages.length === 1, R4.warn);

// ---- one view per page
const RM = SH.compose(A, { sheet: "A3", pages: "many", project: "Smith house", drawnBy: "T. Paul" }, deps);
check("one view per page: 7 pages, SHEET n OF 7, each its own scale (auto)", RM.pages.length === 7 && RM.scales.length === 7 && texts(RM.pages[2]).includes("3 OF 7") && RM.pages.every(inside), RM.scales);
check("…the title block's words (project, drawn by, the drawing = the view)", texts(RM.pages[0]).includes("Smith house") && texts(RM.pages[0]).includes("T. Paul") && texts(RM.pages[3]).some((t) => /EAST ELEVATION/.test(t)));
const RP = SH.compose(A, { sheet: "A2", orient: "portrait", pages: "many", scale: 100 }, deps);
check("A2 portrait at 1:100: pages 420 x 594, every page 1:100", RP.pages[0].w === 420 && RP.pages[0].h === 594 && RP.scales.every((s) => s === 100) && RP.fits);

// ---- the PDF, read back
(async () => {
  try {
    const bytes = await SH.toPdf(RM.pages, LIB, { title: "Smith house - plans", author: "T. Paul" });
    const D = await LIB.PDFDocument.load(bytes);
    const sz = D.getPage(0).getSize();
    check("PDF: 7 pages, A3 landscape in points (1190.6 x 841.9)", D.getPageCount() === 7 && Math.abs(sz.width - 420 * 72 / 25.4) < 0.5 && Math.abs(sz.height - 297 * 72 / 25.4) < 0.5, sz);
    check("PDF: its title / author / creator", D.getTitle() === "Smith house - plans" && D.getAuthor() === "T. Paul" && /bitGen Studio/.test(D.getCreator()));
    const b1 = await SH.toPdf(R.pages, LIB, {}), D1 = await LIB.PDFDocument.load(b1), s1 = D1.getPage(0).getSize();
    check("PDF: all on one A1 sheet = 1 page 2383.9 x 1683.8 pt", D1.getPageCount() === 1 && Math.abs(s1.width - 841 * 72 / 25.4) < 0.5 && Math.abs(s1.height - 594 * 72 / 25.4) < 0.5, s1);
    check("PDF: the standard fonts' letters only (WinAnsi) - × ² kept, others become ?", SH.winAnsi("5 × 4 m · 20 m² ↑") === "5 × 4 m · 20 m² ?");
  } catch (e) { fail++; console.log("FAIL: the PDF - " + (e.stack || e.message)); }
  // ---- the wiring
  const ext = JSON.parse(read("ext/pushpulldock/ext.json")).scripts;
  check("ext.json: ppsheets.js after ppplan.js, ppsheetsdlg.js last", ext.indexOf("ppsheets.js") === ext.indexOf("ppplan.js") + 1 && ext[ext.length - 1] === "ppsheetsdlg.js", ext);
  const html = read("ext/pushpulldock/dock.html");
  check("dock.html: 📄 Plans on the bar, right after ✨ Photo", /id="ppReal"[^\n]*\n\s*<button[^>]*id="ppPlans"[^>]*>📄 Plans<\/button>/.test(html));
  const dlg = read("ext/pushpulldock/ppsheetsdlg.js");
  check("the dialog: a title bar to drag (data-dlg-drag), saved through /api/pdf/save (routes/pdf.js - no server.js change)", /data-dlg-drag/.test(dlg) && /\/api\/pdf\/save\?name=/.test(dlg) && !/server\.js/.test(read("routes/pdf.js").replace(/never server\.js/g, "")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
