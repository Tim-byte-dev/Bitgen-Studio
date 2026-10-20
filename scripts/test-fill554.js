#!/usr/bin/env node
/* bitGen Studio — 2.554.0 units: a style that cannot see around a selection (a 'latent' fill - Krea 2 …, 👁 off or no
 * edit model) makes its picture at the selection's own box (+ the soft edge's room), so what it draws is the selection's
 * size (ext/imageeditdock/imageedit.js fitSel). Tim: "i think it doesn't know to resize it to the size of the selection". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const IE = fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "imageedit.js"), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const P = new Function("P", IE.slice(IE.indexOf("P.maskParams = function"), IE.indexOf("/** The size to RENDER a crop at")) + "; return P;")({});
const bb = { x: 300, y: 200, w: 200, h: 200 }, mp = P.maskParams(bb, 1, 24), box = P.kritaBounds(bb, 800, 600, 1).mask;
check("(2.555.0 Krita's mask bounds) the selection + its feather + 4 + 6 % of the diagonal: a 200 px selection -> about 296 px (not a 512 px region)", box.w >= 280 && box.w <= 304 && box.x <= 300 - mp.reach && box.x + box.w >= 500, { box, reach: mp.reach });
check("fitSel: Generate, a selection, not through the edit model, not a layer clip, a 'latent' fill style; the box and the status line follow it",
  /const fitSel = !whole && !viaEdit && !clip && mode === "generate" && !!fillInfo && fillInfo\.latent === true;/.test(IE)
  && /: fitSel \|\| mode === "refine" \? KB\.mask/.test(IE) && /made at the selection's size/.test(IE)
  && IE.indexOf("const viaEdit =") < IE.indexOf("const fitSel ="));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
