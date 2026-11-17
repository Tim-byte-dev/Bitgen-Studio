#!/usr/bin/env node
/* bitGen Studio — 2.813.0: page numbers on the master (every page) + their format, and View ▸ Pages (several pages in the
 * window) - the pure layout + pins.
 * Tim (verbatim): "fix the pagination, page number shows on page 1, but not on page 2. Also add formatting for page numbers.
 * allow user to change "view" to show multiple pages on the same window" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const V = require("../ext/imageeditdock/pcpageview.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const s = [{ w: 100, h: 140 }, { w: 100, h: 140 }, { w: 100, h: 140 }, { w: 100, h: 140 }, { w: 100, h: 140 }];
const two = V.layout(s, "two", 10);
check("layout two: 2 across, rows below", JSON.stringify(two.map((p) => [p.x, p.y])) === JSON.stringify([[0, 0], [110, 0], [0, 150], [110, 150], [0, 300]]), two);
const many = V.layout(s, "many", 10);
check("layout many: 4 across", many[3].x === 330 && many[3].y === 0 && many[4].x === 0 && many[4].y === 150, many);
check("layout one: one column", V.layout(s, "one", 10)[1].y === 150 && V.layout(s, "one", 10)[1].x === 0);
const mixed = V.layout([{ w: 100, h: 140 }, { w: 60, h: 100 }], "two", 10);
check("pages of different sizes: centred in cells the size of the biggest page", mixed[1].x === 110 + 20 && mixed[1].y === 0, mixed);
const PG = src("ext/imageeditdock/pcpages.js"), PV = src("ext/imageeditdock/pcpageview.js"), IE = src("ext/imageeditdock/imageedit.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json"));
check("pcpages: the page number goes on the master (made + given to every page when there is none), page-only numbers taken off", /if \(mi < 0\) \{ addMaster\(\);/.test(PG) && /pg\.st\.layers = pg\.st\.layers\.filter\(\(L\) => !isNumL\(L\)\)/.test(PG) && /placeNumber\(o\);\s+closeMaster\(\)/.test(PG));
check("pcpages: Page Numbers… - format (Page {page} of {pages} …), numbers (1 i I a A + start), position, font, size, colour; # and the command open it", /const NUM_FORMATS = \["\{page\}", "Page \{page\}", "Page \{page\} of \{pages\}"/.test(PG) && /\$\("pgNumIns"\)\.onclick = \(\) => numberDialog\(\);/.test(PG) && /C\("page\.number", "Page Numbers…", "", \(\) => numberDialog\(\)/.test(PG));
check("View ▸ Pages: One / Two / Many; a click on another page brings it to the front in place", /E\.ui\.addCmd\("view\.pages\." \+ m, n, ""/.test(PV) && /\["two", "Pages: Two Pages"\]/.test(PV) && /E\.pages\.go\(i\);\s+\/\/ go\(\) fits the page alone/.test(PV));
check("pcpageview.js after pcdoctable.js, installed after PCDocTable", EX.scripts.indexOf("pcpageview.js") === EX.scripts.indexOf("pcdoctable.js") + 1 && IE.indexOf("PCPageView.install(E)") > IE.indexOf("PCDocTable.install(E)"));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
