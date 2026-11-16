#!/usr/bin/env node
/* bitGen Studio — 2.800.0 units: master pages, page numbers, facing pages (ext/imageeditdock/pcpages.js) and spreads in the
 * export (ext/imageeditdock/pcdtpout.js joinSpread). Pure + source pins. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const P = require("../ext/imageeditdock/pcpages.js");
const X = require("../ext/imageeditdock/pcdtpout.js");

check("fmtNum: 1 2 3 / i ii iii / I II III / a b c / A B C", [1, 4, 9, 14, 2026].map((n) => P.fmtNum(n, "i")).join() === "i,iv,ix,xiv,mmxxvi" && P.fmtNum(49, "I") === "XLIX" && P.fmtNum(1, "a") === "a" && P.fmtNum(26, "a") === "z" && P.fmtNum(27, "A") === "AA" && P.fmtNum(7, "1") === "7" && P.fmtNum(0, "i") === "0");
check("resolveTokens: {page} {pages} {name}; others left as typed", P.resolveTokens("Page {page} of {pages} - {name} {x}", { page: "3", pages: "12", name: "Menu" }) === "Page 3 of 12 - Menu {x}");
check("hasTokens", P.hasTokens("p. {page}") && P.hasTokens("{pages}") && !P.hasTokens("{Page}") && !P.hasTokens("") && !P.hasTokens(null));
check("spreadsOf: facing = page 1 alone (right), then 2 + 3 …; a last odd one alone; not facing = one by one", JSON.stringify(P.spreadsOf(6, true)) === "[[0],[1,2],[3,4],[5]]" && JSON.stringify(P.spreadsOf(5, true)) === "[[0],[1,2],[3,4]]" && JSON.stringify(P.spreadsOf(3, false)) === "[[0],[1],[2]]" && JSON.stringify(P.spreadsOf(0, true)) === "[]");
check("targets: this / all / odd (1, 3 …) / even (2, 4 …)", P.targets(5, "this", 2).join() === "2" && P.targets(5, "all").join() === "0,1,2,3,4" && P.targets(5, "odd").join() === "0,2,4" && P.targets(5, "even").join() === "1,3");
check("masterName: A-Master, then the first letter free", P.masterName([]) === "A-Master" && P.masterName(["A-Master", "C-Master"]) === "B-Master");
check("NUM_STYLES", P.NUM_STYLES.map((x) => x[0]).join() === "1,i,I,a,A");
const a = { w: 100, h: 140, k: 1, name: "Page 2", layers: [{ name: "Box", items: [{ t: "vec", items: [{ t: "fill", segs: [["M", 10, 10], ["L", 20, 30], ["C", 1, 2, 3, 4, 5, 6], ["Z"]], color: "#000000", alpha: 1 }] }] }] };
const b = { w: 100, h: 150, k: 1, name: "Page 3", layers: [{ name: "Pic", items: [{ t: "img", png: new Uint8Array([1]), x: 5, y: 6, w: 10, h: 10 }] }, { name: "T", items: [{ t: "text", lines: [{ s: "x", x: 50, y: 70 }], size: 10 }] }] };
const j = X.joinSpread([a, b]);
check("joinSpread: one page as wide as both (the taller height), the right page's items moved over, layers named by page", j.w === 200 && j.h === 150 && j.name === "Page 2 + Page 3" && j.layers.map((l) => l.name).join() === "Page 2 / Box,Page 3 / Pic,Page 3 / T"
  && JSON.stringify(j.layers[0].items[0].items[0].segs) === JSON.stringify(a.layers[0].items[0].items[0].segs) && j.layers[1].items[0].x === 105 && j.layers[2].items[0].lines[0].x === 150, j);
check("joinSpread: one page = itself", X.joinSpread([a]) === a);
const a2 = Object.assign({}, a, { layers: [{ name: "Box", items: [{ t: "vec", items: [{ t: "fill", segs: [["M", 10, 10], ["C", 1, 2, 3, 4, 5, 6]], color: "#000000", alpha: 1 }] }] }] });
const j2 = X.joinSpread([b, a2]);
check("joinSpread: a path on the right page moved over (x by the left width, y kept)", JSON.stringify(j2.layers[2].items[0].items[0].segs) === JSON.stringify([["M", 110, 10], ["C", 101, 2, 103, 4, 105, 6]]), j2.layers[2]);

const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PG = src("ext/imageeditdock/pcpages.js"), DT = src("ext/imageeditdock/pcdtpout.js"), BG = src("ext/imageeditdock/pcbgi.js");
check("a page's master = a locked ⌂ layer just above its Background, made again when the master changes / the numbers change", /L\.master = m\.id; L\.locks = \{ all: true \};/.test(PG) && /\/\^background\$\/i\.test\(S\.layers\[0\]\.name\) \? 1 : 0/.test(PG) && /function renumbered\(\)/.test(PG) && /markPagesOf\(m\.id\)/.test(PG));
check("the export writes a master's own layers (Master / <layer>) with the page's number; As spreads joins facing pages", /kind = "master"/.test(DT) && /out\.layers\.push\(\{ name: "Master \/ " \+ ml\.name/.test(DT) && /joinSpread\(g\.map\(\(i\) => pages\[i\]\)\)/.test(DT) && /id="dtpSpreads"/.test(DT));
check(".bgi: a master being edited goes back first; masters saved as masters/<id>.bgi; a one-page document with a master is saved too", /E\.pages\.settle\(\)/.test(BG) && /`masters\/\$\{m\.id\}\.bgi`/.test(PG) && /E\.pages\.needsBgi \? E\.pages\.needsBgi\(\)/.test(BG));
check("menus: New Master Page, Insert Page Number", /C\("page\.master", "New Master Page"/.test(PG) && /C\("page\.number", "Insert Page Number"/.test(PG));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
