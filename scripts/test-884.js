#!/usr/bin/env node
/* bitGen Studio — 2.884.0 units: 📇 the business card sheet (ext/imageeditdock/pccardsheet.js) - how many cards fit (A4 / Letter,
 * portrait or landscape, a gap), centred, the backs' columns mirrored, cut marks only in the margin, the card's size from the page;
 * wired into the image editor (File menu, install) and ✨ Create's message.
 * Tim (verbatim): "will the business cards be printable" -> "yes, please add the next steps" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/imageeditdock/pccardsheet.js");
let L = C.sheetLayout(90, 55, {});
check("Australian 90 × 55 on A4: 10 cards, 2 × 5 portrait, centred (15 mm sides, 11 mm top / bottom)", L.n === 10 && L.cols === 2 && L.rows === 5 && L.orient === "portrait" && L.x0 === 15 && L.y0 === 11 && L.w === 210 && L.h === 297, L);
check("US 3.5 × 2 in on Letter: 10 (2 × 5); Japan 91 × 55 on A4: 10; square 63.5: 2 × 4 = 8 (10 mm margins); mini 70 × 32: 2 × 8 = 16", C.sheetLayout(88.9, 50.8, { paper: "letter" }).n === 10 && C.sheetLayout(91, 55, {}).n === 10 && C.sheetLayout(63.5, 63.5, {}).n === 8 && C.sheetLayout(70, 32, {}).n === 16);
L = C.sheetLayout(90, 55, { gap: 3 });
check("a 3 mm gap: landscape holds more (3 × 3 = 9 against 2 × 4 portrait), the cells 93 / 58 mm apart", L.n === 9 && L.orient === "landscape" && L.w === 297 && L.cells[1].x - L.cells[0].x === 93 && L.cells[3].y - L.cells[0].y === 58, L.cells.slice(0, 4));
const L0 = C.sheetLayout(90, 55, {});
check("the backs: the same row, the column mirrored (long-edge duplex)", C.backCell(L0, L0.cells[0]).c === 1 && C.backCell(L0, L0.cells[0]).r === 0 && C.backCell(L0, L0.cells[9]).c === 0 && C.backCell(L0, L0.cells[9]).r === 4);
const M = C.cutMarks(L0), cardHit = (m) => L0.cells.some((c) => Math.max(m.x1, m.x2) > c.x + 0.01 && Math.min(m.x1, m.x2) < c.x + L0.cw - 0.01 && Math.max(m.y1, m.y2) > c.y + 0.01 && Math.min(m.y1, m.y2) < c.y + L0.ch - 0.01);
check("cut marks: on every cut line (3 across, 6 down - top, bottom, left, right = 18), never over a card, inside the paper", M.length === 18 && !M.some(cardHit) && M.every((m) => Math.min(m.x1, m.x2, m.y1, m.y2) >= 0 && Math.max(m.x1, m.x2) <= 210 && Math.max(m.y1, m.y2) <= 297), M.slice(0, 4));
check("with a gap both edges of every gap get marks (6 across + 6 down, each at both ends = 24)", C.cutMarks(L).length === 24, C.cutMarks(L).length);
check("too big a card is refused", (() => { try { C.sheetLayout(300, 200, {}); return false; } catch (e) { return /does not fit/.test(e.message); } })());
check("the card's size from the page (landscape 90 × 55 kept wide) or its pixels at 300 dpi", JSON.stringify(C.guessCard({ wmm: 55, hmm: 90, orient: "landscape" })) === '{"w":90,"h":55}' && JSON.stringify(C.guessCard(null, 1063, 650)) === '{"w":90,"h":55}');
const ui = src("ext/imageeditdock/pccardsheet.js"), ie = src("ext/imageeditdock/imageedit.js");
check("wired: File ▸ 📇 Business Card Sheet… (after Print Preview), installed by the editor, in ext.json; the PDF via pdf-lib saved to /api/pdf/save + downloaded; ✨ Create's card message points to it",
  /addCmd\("file\.cardsheet", "📇 Business Card Sheet…"/.test(ui) && /\["File", "file\.printpreview"\]/.test(ui) && /PCCardSheet\.install\(E\)/.test(ie) && /"pccardsheet\.js"/.test(src("ext/imageeditdock/ext.json"))
  && /\/api\/pdf\/save\?name=/.test(ui) && /pdf-lib\.min\.js/.test(ui) && /Business Card Sheet… for a sheet of them/.test(src("ext/imageeditdock/pccreate.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
