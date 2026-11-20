#!/usr/bin/env node
/* bitGen Studio — 2.896.0 units: 📇 card sheet extras (ext/imageeditdock/pccardsheet.js + pccardlist.js, lib/cardStocks.js) -
 * 🏭 a print shop's sheet (SRA3 and friends, a bleed on every card, the gap at least two bleeds, crop marks outside the bleed,
 * registration targets clear of the marks), ✂ one card a page (the page = card + bleed + room for the marks, trim / bleed boxes),
 * 🏷 your own label / card stock (the cells where you measured them, the card fitted, the backs mirrored, wrong sizes said - the
 * server keeps them by name), 📋 a card per row of a list (CSV / TSV / quotes, the columns guessed from the business details or the
 * line's look, the words swapped, copies), sheets filled in order; wired (ext.json, routes/index.js).
 * Tim (2026-11-19 PARKED item 4) -> "lets do next" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const C = require("../ext/imageeditdock/pccardsheet.js"), CL = require("../ext/imageeditdock/pccardlist.js");

// 🏭 a print shop's sheet
let L = C.sheetLayout(90, 55, { mode: "shop", paper: "sra3", bleed: 3, margin: 10 });
check("🏭 SRA3 (320 × 450) with 3 mm bleed: 21 cards (3 × 7 portrait), 6 mm apart (two bleeds), centred", L.n === 21 && L.cols === 3 && L.rows === 7 && L.orient === "portrait" && L.gap === 6 && L.bleed === 3 && L.x0 === 19 && L.y0 === 14.5 && L.mode === "shop", L);
check("...a gap asked smaller than two bleeds is made two bleeds; a bigger one kept (10 mm: 3 × 6 = 18)", C.sheetLayout(90, 55, { mode: "shop", paper: "sra3", bleed: 3, gap: 2 }).gap === 6 && C.sheetLayout(90, 55, { mode: "shop", paper: "sra3", bleed: 3, gap: 10 }).n === 18);
check("...the other press sheets: A3 16, SRA4 10, 12 × 18 in 21, 13 × 19 in 21, Tabloid 16 (landscape when it holds more) (3 mm bleed, 10 mm margin)",
  [["a3", 16], ["sra4", 10], ["in12x18", 21], ["in13x19", 21], ["tabloid", 16]].every(([p, n]) => C.sheetLayout(90, 55, { mode: "shop", paper: p, bleed: 3, margin: 10 }).n === n),
  ["a3", "sra4", "in12x18", "in13x19", "tabloid"].map((p) => C.sheetLayout(90, 55, { mode: "shop", paper: p, bleed: 3, margin: 10 }).n));
check("...a custom paper (typed in mm) and its checks", C.sheetLayout(90, 55, { mode: "shop", paper: "custom", pw: 330, ph: 488, bleed: 3 }).paperLabel === "330 × 488 mm" && throwsWith(() => C.sheetLayout(90, 55, { mode: "shop", paper: "custom", pw: 20, ph: 488 }), /custom paper/));
const M = C.cutMarks(L), bleedHit = (m) => L.cells.some((c) => Math.max(m.x1, m.x2) > c.x - L.bleed + 0.01 && Math.min(m.x1, m.x2) < c.x + L.cw + L.bleed - 0.01 && Math.max(m.y1, m.y2) > c.y - L.bleed + 0.01 && Math.min(m.y1, m.y2) < c.y + L.ch + L.bleed - 0.01);
check("...crop marks on every trim line (6 x-lines top + bottom, 14 y-lines left + right = 40), never over a card's bleed, inside the paper", M.length === 40 && !M.some(bleedHit) && M.every((m) => Math.min(m.x1, m.x2, m.y1, m.y2) >= 0 && Math.max(m.x1, m.x2) <= 320 && Math.max(m.y1, m.y2) <= 450), M.slice(0, 3));
const R = C.regMarks(L), xs = [...new Set(L.cells.flatMap((c) => [c.x, c.x + L.cw]))];
check("...registration targets in the middle of each side, clear of the crop marks, on the paper", R.length === 4 && R.every((g) => g.x - g.r >= 0 && g.x + g.r <= 320 && g.y - g.r >= 0 && g.y + g.r <= 450)
  && R.filter((g) => g.y < 20 || g.y > 430).every((g) => xs.every((x) => Math.abs(x - g.x) > g.r + 1)), R);
check("...no room in the margin = no targets on that side", C.regMarks(C.sheetLayout(90, 55, { mode: "shop", paper: "sra3", bleed: 3, margin: 5 })).length <= 4);

// ✂ one card a page
let S1 = C.singleLayout(90, 55, { bleed: 3, marks: true });
check("✂ one card a page with crop marks: 120 × 85 mm (90 × 55 + 3 mm bleed + 12 mm for the marks), trim at 15 mm, bleed box 96 × 61", S1.w === 120 && S1.h === 85 && JSON.stringify(S1.trim) === '{"x":15,"y":15,"w":90,"h":55}' && S1.bleedBox.w === 96 && S1.bleedBox.h === 61 && S1.n === 1, S1);
const SM = C.cutMarks(S1);
check("...its crop marks: 8 corner marks, outside the bleed", SM.length === 8 && SM.every((m) => !(Math.max(m.x1, m.x2) > 12 && Math.min(m.x1, m.x2) < 108 && Math.max(m.y1, m.y2) > 12 && Math.min(m.y1, m.y2) < 73)), SM);
S1 = C.singleLayout(90, 55, { bleed: 3, marks: false });
check("...without marks the page is the bleed box itself (96 × 61 mm)", S1.w === 96 && S1.h === 61 && S1.trim.x === 3);

// 🏷 your own stock
const st = { name: "10-up", paper: { w: 210, h: 297 }, cols: 2, rows: 5, cw: 85, ch: 54, top: 13.5, left: 15, hpitch: 95, vpitch: 54 };
L = C.stockLayout(st, { w: 90, h: 55 });
check("🏷 your stock: 10 cells where you measured them (15 / 110 mm across, 13.5 + 54 r down)", L.n === 10 && L.cells[1].x === 110 && L.cells[2].y === 67.5 && L.mode === "stock" && L.w === 210, L.cells.slice(0, 3));
check("...a 90 × 55 card fitted inside an 85 × 54 label (whole, centred), exact when the sizes match", !L.fit.exact && Math.abs(L.fit.w - 85) < 0.01 && L.fit.h < 54 && L.fit.dy > 0 && C.stockLayout(Object.assign({}, st, { cw: 90, ch: 55, hpitch: 90, vpitch: 55, top: 11, left: 15 }), { w: 90, h: 55 }).fit.exact, L.fit);
check("...the backs mirrored across the sheet (card 1's back where card 2 is)", C.backPos(L, L.cells[0]).x === 110 && C.backPos(L, L.cells[0]).y === 13.5);
check("...wrong sizes said: a pitch under the card (overlap), past the paper, nothing typed",
  throwsWith(() => C.stockLayout(Object.assign({}, st, { hpitch: 70 })), /would overlap/) && throwsWith(() => C.stockLayout(Object.assign({}, st, { cols: 3 })), /past the 210 mm paper/) && throwsWith(() => C.stockLayout({}), /paper size/));

// sheets
check("paginate: 3 + 12 copies on 10-card sheets = 2 sheets, each person's cards together, the rest of the last sheet empty",
  JSON.stringify(C.paginate([{ copies: 3 }, { copies: 12 }], 10)) === JSON.stringify([[0, 0, 0, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, null, null, null, null, null]]));

// 📋 the list
let P = CL.parseRows("Name\tRole\tMobile\tEmail\tQty\nAlex Chen\tDesigner\t0412 345 678\talex@x.com\t50\n\nSam Lee\tCEO\t0400 111 222\tsam@x.com\t");
check("📋 rows pasted from a spreadsheet (tabs): the column names + 2 rows (the empty line skipped, short cells padded)", P.headers.join("|") === "Name|Role|Mobile|Email|Qty" && P.rows.length === 2 && P.rows[1][4] === "", P);
const Q = CL.parseRows('name,"title, dept",email\n"Lee, Sam","Boss ""Big""",s@x.com');
check("...CSV with quotes (a comma and a quote inside)", Q.headers[1] === "title, dept" && Q.rows[0][0] === "Lee, Sam" && Q.rows[0][1] === 'Boss "Big"', Q);
check("...the columns' meanings (Name, Job title, Mobile phone, E-mail, Qty / How many, Web, Business name)",
  ["Name", "Job Title", "Mobile phone", "E-mail", "Qty", "How many", "Web", "Business name", "Favourite colour"].map(CL.fieldOf).join() === "name,role,phone,email,copies,copies,website,company,");
const lines = CL.cardLines(["Tiger Art", "Tim Paul\nDirector", "0412 999 888", "tim@tigerart.com.au", "www.tigerart.com.au", "Tiger Art"]);
check("...the card's lines (each text layer split, each line once)", lines.join("|") === "Tiger Art|Tim Paul|Director|0412 999 888|tim@tigerart.com.au|www.tigerart.com.au", lines);
const map = CL.guessMap(P.headers, lines, { name: "Tim Paul", role: "Director", phone: "0412 999 888", email: "tim@tigerart.com.au" });
check("...guessed from the business details the card was made with: Name -> 'Tim Paul', Role -> 'Director', Mobile -> the phone, Email -> the email, Qty -> copies", map.join("|") === "Tim Paul|Director|0412 999 888|tim@tigerart.com.au|#copies", map);
check("...with no details, by the line's look: the email (@), the phone (8+ digits), the website (www) - the name left for you", CL.guessMap(["Name", "Mobile", "Email", "Website"], lines, null).join("|") === "|0412 999 888|tim@tigerart.com.au|www.tigerart.com.au");
const V = CL.variants(P, map, 10);
check("...a card per row: the pairs, copies from the Qty column (50), the default when blank (10), named by the first column", V.length === 2 && V[0].copies === 50 && V[1].copies === 10 && V[0].label === "Alex Chen" && V[0].pairs.length === 4 && V[0].pairs[1].value === "Designer", V);
check("...the words swapped where they stand (a line inside a longer text too), others left alone", CL.applyRow("Tim Paul\nDirector", V[0].pairs) === "Alex Chen\nDesigner" && CL.applyRow("Tim Paul · Director", V[1].pairs) === "Sam Lee · CEO" && CL.applyRow("Tiger Art", V[0].pairs) === "Tiger Art");
check("...at most 500 rows (the rest counted)", CL.parseRows("n\n" + Array.from({ length: 520 }, (_, i) => "r" + i).join("\n")).rows.length === 500 && CL.parseRows("n\n" + Array.from({ length: 520 }, (_, i) => "r" + i).join("\n")).cut === 20);

// lib/cardStocks.js
const S = require("../lib/cardStocks"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stk896-")); S._setRoot(tmp);
const a = S.save(st);
check("lib/cardStocks: saved with an id, kept in card_stocks.json, listed", /^st/.test(a.id) && S.list().stocks.length === 1 && JSON.parse(fs.readFileSync(path.join(tmp, "card_stocks.json"), "utf8")).stocks[0].cw === 85);
const b = S.save(Object.assign({}, st, { name: "10-UP", top: 14 }));
check("...the same name (any case) replaces it", b.id === a.id && S.list().stocks.length === 1 && S.list().stocks[0].top === 14);
check("...the server checks too: no name, overlap, past the paper, silly numbers",
  throwsWith(() => S.clean(Object.assign({}, st, { name: "" })), /name/) && throwsWith(() => S.clean(Object.assign({}, st, { vpitch: 40 })), /would overlap/) && throwsWith(() => S.clean(Object.assign({}, st, { rows: 6 })), /past the 297 mm paper/) && throwsWith(() => S.clean(Object.assign({}, st, { cols: 99 })), /across/));
check("...removed; a gone id = 404", S.remove(a.id) && S.list().stocks.length === 0 && (() => { try { S.remove("x"); return false; } catch (e) { return e.status === 404; } })());
fs.rmSync(tmp, { recursive: true, force: true });

// wiring
const ext = JSON.parse(src("ext/imageeditdock/ext.json")), scripts = JSON.stringify(ext);
check("wired: pccardlist.js loads before pccardsheet.js (ext.json); routes/cardStocks mounted from routes/index.js (not server.js); GET / POST / DELETE /api/cardstocks",
  scripts.indexOf("pccardlist.js") > 0 && scripts.indexOf("pccardlist.js") < scripts.indexOf("pccardsheet.js") && /require\("\.\/cardStocks"\)\.mount\(app\)/.test(src("routes/index.js")) && !/cardStocks/.test(src("misc/server.js"))
  && /app\.get\("\/api\/cardstocks"/.test(src("routes/cardStocks.js")) && /app\.delete\("\/api\/cardstocks\/:id"/.test(src("routes/cardStocks.js")));
const ui = src("ext/imageeditdock/pccardsheet.js");
check("the box: Layout ▾ (home / stock / shop / single), crop marks in registration colour, TrimBox + BleedBox, the bleed from the card's own edges, a hand-picked column kept",
  /\["home", "🖨 Home printer sheet/.test(ui) && /PL\.cmyk\(1, 1, 1, 1\)/.test(ui) && /setTrimBox/.test(ui) && /setBleedBox/.test(ui) && /function bleedCanvas/.test(ui) && /st\.hand/.test(ui));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
