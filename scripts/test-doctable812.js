#!/usr/bin/env node
/* bitGen Studio — 2.812.0: tables in document text (ext/imageeditdock/pcdoctable.js) - the grid edits in Node (jsdom), the
 * repeated header row in pcdoctext.js windows(), and the hooks.
 * Tim (verbatim): "go with the next part please" (the word plan's step 2: tables). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { JSDOM } = require("jsdom");
const T = require("../ext/imageeditdock/pcdoctable.js"), X = require("../ext/imageeditdock/pcdoctext.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const d = new JSDOM("<body></body>").window.document;
const mk = (h) => { const b = d.createElement("div"); b.innerHTML = h; return b.querySelector("table"); };
const sig = (t) => T.grid(t).map((r) => r.map((c) => c.textContent || "·").join("")).join("/");

let t = mk(T.tableHtml(3, 3, true)); [...t.querySelectorAll("th,td")].forEach((c, i) => { c.textContent = "abcdefghi"[i]; });
check("tableHtml 3 x 3 + header: thead of th, 2 body rows, 3 even cols, fixed layout", sig(t) === "abc/def/ghi" && t.tHead.rows.length === 1 && t.querySelectorAll("th").length === 3 && t.querySelectorAll("col").length === 3 && /table-layout:fixed/.test(T.tableHtml(1, 1)), sig(t));
T.insertRow(t, 1, true);
check("insertRow below row 1", sig(t) === "abc/def/···/ghi", sig(t));
T.insertCol(t, 0, true);
check("insertCol right of column 0: a cell in every row, widths 25%", sig(t) === "a·bc/d·ef/····/g·hi" && T.colWidths(t).every((w) => Math.abs(w - 25) < 0.01), sig(t));
let g = T.grid(t); const m = T.mergeCells(t, [g[1][0], g[1][1], g[2][0], g[2][1]]);
check("mergeCells 2 x 2: rowspan 2, colspan 2, the words kept", sig(t) === "a·bc/ddef/dd··/g·hi" && m.getAttribute("rowspan") === "2" && m.getAttribute("colspan") === "2", sig(t));
g = T.grid(t);
check("mergeCells refuses cells that are not a rectangle", T.mergeCells(t, [g[0][0], g[1][2]]) === null);
T.insertRow(t, 1, true);
check("insertRow inside a merged cell: the span grows", sig(t) === "a·bc/ddef/dd··/dd··/g·hi", sig(t));
T.insertCol(t, 0, true);
check("insertCol inside a merged cell: its colspan grows", sig(t) === "a··bc/dddef/ddd··/ddd··/g··hi", sig(t));
T.deleteRow(t, 1);
check("deleteRow at a merged cell's first row: the cell moves down, a row shorter", sig(t) === "a··bc/ddd··/ddd··/g··hi", sig(t));
T.deleteCol(t, 0);
check("deleteCol through a merged cell: its colspan shrinks", sig(t) === "··bc/dd··/dd··/··hi", sig(t));
check("splitCell: back to single cells", T.splitCell(t, T.grid(t)[1][0]) && sig(t) === "··bc/d···/····/··hi", sig(t));
T.setHeader(t, false);
check("setHeader off: no thead, no th", !t.tHead && !t.querySelector("th"));
T.setHeader(t, true);
check("setHeader on: the first row is the header (th)", t.tHead.rows.length === 1 && t.querySelectorAll("th").length === 4);
T.setColWidths(t, [1, 3, 1, 1]);
check("setColWidths: normalised to 100%", JSON.stringify(T.colWidths(t)) === JSON.stringify([16.667, 50, 16.667, 16.667]), T.colWidths(t));
T.setBorders(t, "outside", "#ff0000");
check("setBorders outside: the table's border, the cells' border-style none", /1px solid/.test(t.style.border) && [...t.querySelectorAll("td,th")].every((c) => c.style.borderStyle === "none"));
const t2 = mk(T.tableHtml(2, 2)); T.deleteRow(t2, 0); T.deleteRow(t2, 0);
check("deleting the last row deletes the table", !t2.isConnected || !t2.parentNode);
// the repeated header in windows()
const lines = Array.from({ length: 10 }, (_, i) => ({ top: i * 20, bottom: i * 20 + 15 }));
const w = X.windows(lines, [50, 50], () => ({ h: 20, html: "<table></table>" }));
check("windows: a later frame starting inside a table with a header row has 20 px less room and carries the header", w[0].lines === 2 && !w[0].head && w[1].lines === 1 && w[1].head && w[1].head.h === 20, w);
check("sanitize keeps colgroup / col widths and th", X.sanitize('<table><colgroup><col style="width:30%"></colgroup><thead><tr><th>H</th></tr></thead></table>', d) === '<table><colgroup><col style="width:30%"></colgroup><thead><tr><th>H</th></tr></thead></table>', X.sanitize('<table><colgroup><col style="width:30%"></colgroup><thead><tr><th>H</th></tr></thead></table>', d));
const DT = src("ext/imageeditdock/pcdoctext.js"), IE = src("ext/imageeditdock/imageedit.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json"));
check("pcdoctext: the repeated header drawn above the window; frames on other pages drawn again; Tab never leaves the page", /D\.rep \? `<div class="pcdoc"/.test(DT) && /D\.rasterize\(f\.L\);\s+\/\/ 2\.812\.0/.test(DT) && /e\.key === "Tab"/.test(DT));
check("pcdoctable.js loaded after pcdoctext.js, installed after PCDocText", EX.scripts.indexOf("pcdoctable.js") === EX.scripts.indexOf("pcdoctext.js") + 1 && IE.indexOf("PCDocTable.install(E)") > IE.indexOf("PCDocText.install(E)"));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
