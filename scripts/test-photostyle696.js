#!/usr/bin/env node
/* bitGen Studio — 2.696.0: THE SKETCHER'S OWN PHOTO STYLE - ext/pushpulldock/ppreal.js sketcherStyle + the bar's #ppRealStyle
 * (dock.html, left of ✨ Photo), kept in localStorage pp.realStyle. The browser: scripts/test-ui696-ui.js.
 * Tim (verbatim): "add a dropdown to the left of the photo button with image edit styles this will be exclusive to sketcher - keep
 * the last one used as selected" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = require(path.join(ROOT, "ext", "pushpulldock", "ppreal.js"));
const E = { edit: [{ id: "a", name: "Qwen edit" }, { id: "b", name: "Klein edit" }], defaults: { edit: "a" } };
check("sketcherStyle: the Sketcher's own pick while it is an edit style", R.sketcherStyle("b", "x", E) === "b");
check("…gone / none: what pickEditStyle gives (the prompt's edit style, else the default edit model)", R.sketcherStyle("gone", "", E) === "a" && R.sketcherStyle("", "b", E) === "b" && R.sketcherStyle("b", "", { edit: [] }) === "");
const D = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "dock.html"), "utf8"), S = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ppreal.js"), "utf8");
check("the bar: #ppRealStyle right before ✨ Photo (#ppReal)", /<select id="ppRealStyle"[^\n]*\n\s*<button class="ghost gbtn" id="ppReal"/.test(D));
check("wired: kept in pp.realStyle, the run + the prompt docker link use it (sketcherStyle(ownStyle() …)), refreshed when opened",
  /const KEY = "pp\.realStyle"/.test(S) && (S.match(/sketcherStyle\(ownStyle\(\)/g) || []).length === 2 && /if \(style\) keep\(style\);/.test(S) && /fillStyles\(true\)/.test(S));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
